import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { OperationalMapMarker } from '../../core/models/operations.models';

@Component({
  selector: 'app-operational-map',
  standalone: true,
  template: `<div class="map-layer-control"><button type="button" [class.active]="showNetworkAssets" (click)="showNetworkAssets = !showNetworkAssets; renderMarkers()">{{ showNetworkAssets ? 'Ocultar red' : 'Mostrar nodos/cajas' }}</button></div><div #map class="map-canvas" aria-label="Mapa operativo"></div>
    @if (!markers.length) { <p class="map-empty">{{ emptyMessage }}</p> }`,
  styles: `:host{display:block;height:100%;position:relative}.map-canvas{height:100%;min-height:360px;width:100%}.map-empty{background:rgba(255,255,255,.9);border-radius:8px;color:#52637a;font-size:13px;left:16px;margin:0;padding:9px 12px;position:absolute;top:16px;z-index:500}.map-layer-control{position:absolute;right:14px;top:14px;z-index:501}.map-layer-control button{background:#fff;border:1px solid #dbe4ed;border-radius:6px;color:#52637a;cursor:pointer;font-size:11px;padding:7px 9px;box-shadow:0 2px 6px rgba(20,40,60,.12)}.map-layer-control button.active{background:#eaf2ff;border-color:#2d74df;color:#2d74df}`
})
export class OperationalMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() markers: OperationalMapMarker[] = [];
  @Input() emptyMessage = 'Inicia sesión para consultar el mapa operativo.';
  @ViewChild('map') private mapElement?: ElementRef<HTMLDivElement>;

  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private markerLayer?: Leaflet.LayerGroup;
  showNetworkAssets = false;

  async ngAfterViewInit(): Promise<void> {
    const element = this.mapElement?.nativeElement;
    if (!element) return;
    const L = await import('leaflet');
    this.leaflet = L;
    this.map = L.map(element, { zoomControl: true }).setView([-16.5, -68.15], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);
    this.renderMarkers();
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
      const icon = L.divIcon({
        className: 'operational-marker-wrapper',
        html: `<span class="operational-marker ${marker.marker_type}">${symbol}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      L.marker([marker.latitude, marker.longitude] as Leaflet.LatLngExpression, { icon })
        .bindPopup(`<strong>${this.escapeHtml(marker.code)}</strong><br>${this.escapeHtml(marker.label)}<br><small>${this.escapeHtml(marker.status)}${eta ? `<br>ETA aproximado: ${eta} min` : ''}</small>`)
        .addTo(markerLayer);
    });
    if (validMarkers.length) {
      this.map.fitBounds(L.latLngBounds(validMarkers.map((marker) => [marker.latitude, marker.longitude] as Leaflet.LatLngTuple)), {
        padding: [32, 32], maxZoom: 15
      });
    }
  }

  private nearestEta(order: OperationalMapMarker, teams: OperationalMapMarker[]): number | null {
    if (!teams.length) return null;
    const distance = Math.min(...teams.map((team) => this.distanceKm(order.latitude, order.longitude, team.latitude, team.longitude)));
    return Math.max(1, Math.ceil((distance / 25) * 60));
  }

  private distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number {
    const radians = (value: number) => value * Math.PI / 180;
    const earthRadius = 6371;
    const deltaLatitude = radians(latitudeB - latitudeA);
    const deltaLongitude = radians(longitudeB - longitudeA);
    const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
  }
}
