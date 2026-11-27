import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GcGeoPolygon } from '@core';
import { svgGeometry } from './green-care.util';

/**
 * Lightweight site preview: the GeoJSON polygon of the green space (or its single coordinate) drawn as inline SVG, so no map
 * library is added to the bundle. The polygon is scaled to the viewbox; the marker is the centre of the site.
 */
@Component({
  selector: 'app-green-care-geo-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './green-care.scss',
  template: `
    <svg class="geo-preview" viewBox="0 0 200 200" role="img" [attr.aria-label]="label()" data-test="geo-preview">
      @if (geometry().points !== '') {
        <polygon class="polygon" [attr.points]="geometry().points"></polygon>
      }
      @if (geometry().marker; as marker) {
        <circle class="marker" [attr.cx]="marker.x" [attr.cy]="marker.y" r="6"></circle>
      }
    </svg>
  `,
})
export class GreenCareGeoPreviewComponent {
  readonly polygon = input<GcGeoPolygon | null>(null);
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly label = input<string>('');

  protected readonly geometry = computed(() => svgGeometry(this.polygon(), this.latitude(), this.longitude()));
}
