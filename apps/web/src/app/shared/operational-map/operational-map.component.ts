import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { OperationalMapMarker, WorkOrderSummary } from '../../core/models/operations.models';

@Component({
  selector: 'app-operational-map',
  standalone: true,
  template: `<div class="map-toolbar" aria-label="Controles del mapa"><button type="button" (click)="zoomIn()" aria-label="Acercar mapa">+</button><button type="button" (click)="zoomOut()" aria-label="Alejar mapa">−</button><button type="button" class="map-center" (click)="fitOperation()">Centrar operación</button></div><div #map class="map-canvas" aria-label="Mapa operativo"></div>
    @if (!markers.length) { <p class="map-empty">{{ emptyMessage }}</p> }`,
  styles: `:host{display:block;height:100%;position:relative}.map-canvas{height:100%;min-height:360px;width:100%}.map-empty{background:rgba(255,255,255,.94);border-radius:8px;color:#52637a;font-size:13px;left:16px;margin:0;padding:9px 12px;position:absolute;top:64px;z-index:500}.map-toolbar{display:flex;gap:6px;left:14px;position:absolute;top:14px;z-index:700}.map-toolbar button{background:#fff;border:1px solid #dbe4ed;border-radius:7px;color:#29415f;cursor:pointer;font-size:13px;font-weight:700;min-height:32px;padding:6px 10px;box-shadow:0 2px 6px rgba(20,40,60,.16)}.map-toolbar button:not(.map-center){font-size:20px;line-height:18px;min-width:32px;padding:4px 8px}.map-toolbar .map-center{font-size:12px}`
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

  async ngAfterViewInit(): Promise<void> {
    const element = this.mapElement?.nativeElement;
    if (!element) return;
    const leafletModule = await import('leaflet');
    // Leaflet is bundled as CommonJS by the current Angular build. In the
    // production chunk its API is exposed through `default`; development can
    // expose it directly. Supporting both shapes keeps the map working in
    // local builds and on Vercel.
    const L = ('default' in leafletModule ? leafletModule.default : leafletModule) as typeof Leaflet;
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
    const validMarkers = this.visibleMarkers();
    const teamMarkers = validMarkers.filter((marker) => marker.marker_type === 'team');
    validMarkers.forEach((marker) => {
      // A compact crew SUV is used instead of a platform-dependent emoji.
      const crewVehicle = `<svg class="crew-vehicle-icon" viewBox="0 0 64 44" aria-hidden="true"><path d="M8 28V21c0-2 1-4 4-4h6l5-9c1-2 3-3 5-3h15c3 0 5 1 7 4l5 8h4c3 0 5 2 5 5v6h-5a7 7 0 0 0-14 0H27a7 7 0 0 0-14 0H8Z" fill="#fff"/><path d="M24 17l4-7h14c1 0 2 1 3 2l4 5H24Z" fill="#8ed9ff"/><path d="M40 17V10" stroke="#1559c2" stroke-width="2"/><path d="M31 6h7" stroke="#ffd35c" stroke-linecap="round" stroke-width="3"/><circle cx="20" cy="29" r="5" fill="#193b77" stroke="#fff" stroke-width="2"/><circle cx="47" cy="29" r="5" fill="#193b77" stroke="#fff" stroke-width="2"/><circle cx="20" cy="29" r="1.8" fill="#8ed9ff"/><circle cx="47" cy="29" r="1.8" fill="#8ed9ff"/></svg>`;
      const eta = marker.marker_type === 'work_order' ? this.nearestEta(marker, teamMarkers) : null;
      const deviationKm = marker.marker_type === 'team' ? this.deviationKm(marker) : null;
      const customerPin = `<svg class="customer-pin-icon" viewBox="0 0 48 56" aria-hidden="true"><path d="M24 2C12.4 2 3 11.2 3 22.7c0 15.1 18.2 29.2 20.1 30.6a1.5 1.5 0 0 0 1.8 0C26.8 51.9 45 37.8 45 22.7 45 11.2 35.6 2 24 2Z" fill="#f97316" stroke="#fff" stroke-width="3"/><circle cx="24" cy="19" r="6" fill="#fff"/><path d="M13.6 38c1.7-7 6-10.4 10.4-10.4S32.7 31 34.4 38" fill="#fff"/></svg>`;
      const markerContent = marker.marker_type === 'team'
        ? `<span class="operational-marker team${deviationKm !== null ? ' deviation' : ''}"><span class="marker-symbol">${crewVehicle}</span>${deviationKm !== null ? '<b class="deviation-badge" aria-label="Posible desvío">!</b>' : ''}</span>`
        : `<span class="work-order-client-marker">${customerPin}</span>`;
      const markerSize = marker.marker_type === 'team' ? 54 : 44;
      const icon = L.divIcon({
        className: 'operational-marker-wrapper',
        html: markerContent,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, marker.marker_type === 'team' ? markerSize / 2 : markerSize]
      });
      L.marker([marker.latitude, marker.longitude] as Leaflet.LatLngExpression, { icon })
        .bindTooltip(marker.marker_type === 'work_order' ? `Cliente · ${this.escapeHtml(marker.code)}` : this.escapeHtml(marker.code), { direction: 'top', offset: [0, -18], opacity: .94 })
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
      (marker.marker_type === 'team' || marker.marker_type === 'work_order') &&
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
