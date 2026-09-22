import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { OperationalMapMarker, WorkOrderSummary } from '../../core/models/operations.models';

@Component({
  selector: 'app-operational-map',
  standalone: true,
  template: `<div class="map-toolbar" aria-label="Controles del mapa"><button type="button" (click)="zoomIn()" aria-label="Acercar mapa">+</button><button type="button" (click)="zoomOut()" aria-label="Alejar mapa">−</button><button type="button" class="map-center" (click)="fitOperation()">Centrar operación</button></div><div class="map-layer-control"><button type="button" [class.active]="showNetworkAssets" (click)="showNetworkAssets = !showNetworkAssets; renderMarkers()">{{ showNetworkAssets ? 'Ocultar red' : 'Mostrar nodos/cajas' }}</button></div><div #map class="map-canvas" aria-label="Mapa operativo"></div>
    @if (!markers.length) { <p class="map-empty">{{ emptyMessage }}</p> }`,
  styles: `:host{display:block;height:100%;position:relative}.map-canvas{height:100%;min-height:360px;width:100%}.map-empty{background:rgba(255,255,255,.94);border-radius:8px;color:#52637a;font-size:13px;left:16px;margin:0;padding:9px 12px;position:absolute;top:64px;z-index:500}.map-toolbar{display:flex;gap:6px;left:14px;position:absolute;top:14px;z-index:700}.map-toolbar button,.map-layer-control button{background:#fff;border:1px solid #dbe4ed;border-radius:7px;color:#29415f;cursor:pointer;font-size:13px;font-weight:700;min-height:32px;padding:6px 10px;box-shadow:0 2px 6px rgba(20,40,60,.16)}.map-toolbar button:not(.map-center){font-size:20px;line-height:18px;min-width:32px;padding:4px 8px}.map-toolbar .map-center{font-size:12px}.map-layer-control{position:absolute;right:14px;top:14px;z-index:700}.map-layer-control button.active{background:#eaf2ff;border-color:#2d74df;color:#2d74df}`
})
export class OperationalMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() markers: OperationalMapMarker[] = [];
  @Input() workOrders: WorkOrderSummary[] = [];
  @Input() emptyMessage = 'Inicia sesión para consultar el mapa operativo.';
  @ViewChild('map') private mapElement?: ElementRef<HTMLDivElement>;

  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private markerLayer?: Leaflet.LayerGroup;
  private baseTileLayer?: Leaflet.TileLayer;
  private usingFallbackTiles = false;
  showNetworkAssets = false;

  async ngAfterViewInit(): Promise<void> {
    const element = this.mapElement?.nativeElement;
    if (!element) return;
    const L = await import('leaflet');
    this.leaflet = L;
    this.map = L.map(element, { zoomControl: false }).setView([-16.5, -68.15], 11);
    this.addBaseTiles();
    this.markerLayer = L.layerGroup().addTo(this.map);
    this.map.whenReady(() => {
      requestAnimationFrame(() => {
        this.map?.invalidateSize(true);
        this.renderMarkers();
      });
    });
  }

  ngOnChanges(): void {
    this.renderMarkers();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  renderMarkers(): void {
    const L = this.leaflet;
    if (!this.map || !this.markerLayer || !L) return;
    const markerLayer = this.markerLayer;
    markerLayer.clearLayers();
    const validMarkers = this.markers.filter((marker) =>
      (this.showNetworkAssets || (marker.marker_type !== 'network_node' && marker.marker_type !== 'distribution_box')) &&
      Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)
    );
    const teamMarkers = validMarkers.filter((marker) => marker.marker_type === 'team');
    validMarkers.forEach((marker) => {
      const symbol = marker.marker_type === 'team' ? 'C' : marker.marker_type === 'network_node' ? 'N' : marker.marker_type === 'distribution_box' ? 'B' : 'OT';
      const eta = marker.marker_type === 'work_order' ? this.nearestEta(marker, teamMarkers) : null;
      const deviationKm = marker.marker_type === 'team' ? this.deviationKm(marker) : null;
      const icon = L.divIcon({
        className: 'operational-marker-wrapper',
        html: `<span class="operational-marker ${marker.marker_type}${deviationKm !== null ? ' deviation' : ''}">${deviationKm !== null ? '!' : symbol}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      L.marker([marker.latitude, marker.longitude] as Leaflet.LatLngExpression, { icon })
        .bindPopup(`<strong>${this.escapeHtml(marker.code)}</strong><br>${this.escapeHtml(marker.label)}<br><small>${this.escapeHtml(marker.status)}${eta ? `<br>ETA aproximado: ${eta} min` : ''}${deviationKm !== null ? `<br><b>Posible desvío: ${deviationKm.toFixed(1)} km de la OT asignada</b>` : ''}</small>`)
        .addTo(markerLayer);
    });
    this.fitOperation(validMarkers);
  }

  zoomIn(): void { this.map?.zoomIn(); }

  zoomOut(): void { this.map?.zoomOut(); }

  fitOperation(markers = this.visibleMarkers()): void {
    const L = this.leaflet;
    if (!this.map || !L || !markers.length) return;
    this.map.fitBounds(L.latLngBounds(markers.map((marker) => [marker.latitude, marker.longitude] as Leaflet.LatLngTuple)), {
      padding: [44, 44], maxZoom: 15
    });
  }

  private visibleMarkers(): OperationalMapMarker[] {
    return this.markers.filter((marker) =>
      (this.showNetworkAssets || (marker.marker_type !== 'network_node' && marker.marker_type !== 'distribution_box')) &&
      Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)
    );
  }

  private nearestEta(order: OperationalMapMarker, teams: OperationalMapMarker[]): number | null {
    if (!teams.length) return null;
    const distance = Math.min(...teams.map((team) => this.distanceKm(order.latitude, order.longitude, team.latitude, team.longitude)));
    return Math.max(1, Math.ceil((distance / 25) * 60));
  }

  private deviationKm(team: OperationalMapMarker): number | null {
    if (team.status !== 'in_progress') return null;
    const assignedOrderIds = new Set(this.workOrders
      .filter((order) => order.assigned_team_id === team.marker_id && order.status === 'in_progress')
      .map((order) => order.id));
    const assignedMarkers = this.markers.filter((marker) =>
      marker.marker_type === 'work_order' && assignedOrderIds.has(marker.marker_id));
    if (!assignedMarkers.length) return null;
    const distance = Math.min(...assignedMarkers.map((order) =>
      this.distanceKm(team.latitude, team.longitude, order.latitude, order.longitude)));
    return distance > 0.75 ? distance : null;
  }

  private distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number {
    const radians = (value: number) => value * Math.PI / 180;
    const earthRadius = 6371;
    const deltaLatitude = radians(latitudeB - latitudeA);
    const deltaLongitude = radians(longitudeB - longitudeA);
    const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private addBaseTiles(): void {
    const L = this.leaflet;
    if (!L || !this.map) return;
    const addOpenStreetMapFallback = () => {
      if (this.usingFallbackTiles || !this.map) return;
      this.usingFallbackTiles = true;
      this.baseTileLayer?.remove();
      this.baseTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
      }).addTo(this.map);
    };
    this.baseTileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri', maxZoom: 19
      }
    ).on('tileerror', addOpenStreetMapFallback).addTo(this.map);
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
  }
}
