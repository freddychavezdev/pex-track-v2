import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { OperationalMapMarker } from '../../core/models/operations.models';

@Component({
  selector: 'app-operational-map',
  standalone: true,
  template: `<div #map class="map-canvas" aria-label="Mapa operativo"></div>
    @if (!markers.length) { <p class="map-empty">{{ emptyMessage }}</p> }`,
  styles: `:host{display:block;height:100%;position:relative}.map-canvas{height:100%;min-height:360px;width:100%}.map-empty{background:rgba(255,255,255,.9);border-radius:8px;color:#52637a;font-size:13px;left:16px;margin:0;padding:9px 12px;position:absolute;top:16px;z-index:500}`
})
export class OperationalMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() markers: OperationalMapMarker[] = [];
  @Input() emptyMessage = 'Inicia sesión para consultar el mapa operativo.';
  @ViewChild('map') private mapElement?: ElementRef<HTMLDivElement>;

  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private markerLayer?: Leaflet.LayerGroup;

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

  private renderMarkers(): void {
    const L = this.leaflet;
    if (!this.map || !this.markerLayer || !L) return;
    const markerLayer = this.markerLayer;
    markerLayer.clearLayers();
    const validMarkers = this.markers.filter((marker) =>
      Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)
    );
    validMarkers.forEach((marker) => {
      const symbol = marker.marker_type === 'team' ? 'C' : 'OT';
      const icon = L.divIcon({
        className: 'operational-marker-wrapper',
        html: `<span class="operational-marker ${marker.marker_type}">${symbol}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      L.marker([marker.latitude, marker.longitude] as Leaflet.LatLngExpression, { icon })
        .bindPopup(`<strong>${this.escapeHtml(marker.code)}</strong><br>${this.escapeHtml(marker.label)}<br><small>${this.escapeHtml(marker.status)}</small>`)
        .addTo(markerLayer);
    });
    if (validMarkers.length) {
      this.map.fitBounds(L.latLngBounds(validMarkers.map((marker) => [marker.latitude, marker.longitude] as Leaflet.LatLngTuple)), {
        padding: [32, 32], maxZoom: 15
      });
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
  }
}
