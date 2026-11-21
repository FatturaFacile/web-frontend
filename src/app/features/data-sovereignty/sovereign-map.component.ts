import { Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@shared';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MapSite } from './data-sovereignty.store';
import { project, serviceKey } from './data-sovereignty.utils';

/** Simplified outlines (longitude, latitude) of Switzerland, Italy and its two big islands. */
const OUTLINES: Record<string, [number, number][]> = {
  CH: [
    [6.0, 46.2],
    [6.1, 46.4],
    [6.9, 47.35],
    [7.6, 47.6],
    [8.6, 47.8],
    [9.5, 47.55],
    [9.55, 47.05],
    [10.4, 46.85],
    [10.45, 46.5],
    [10.1, 46.2],
    [9.3, 46.5],
    [9.0, 45.85],
    [8.4, 46.2],
    [7.9, 45.95],
    [7.0, 45.9],
    [6.8, 46.4],
  ],
  IT: [
    [6.9, 45.1],
    [7.0, 45.9],
    [8.4, 46.45],
    [9.0, 45.85],
    [9.1, 46.35],
    [10.45, 46.5],
    [10.5, 46.85],
    [12.2, 47.05],
    [13.7, 46.5],
    [13.6, 45.7],
    [12.4, 45.2],
    [12.3, 44.2],
    [13.6, 43.5],
    [14.6, 42.0],
    [16.1, 41.9],
    [15.9, 41.5],
    [18.5, 40.2],
    [17.2, 40.4],
    [16.7, 39.7],
    [17.1, 39.0],
    [16.5, 38.4],
    [15.7, 38.0],
    [15.8, 38.7],
    [15.5, 40.0],
    [14.2, 40.8],
    [13.0, 41.2],
    [11.2, 42.4],
    [10.5, 43.2],
    [10.2, 43.9],
    [8.9, 44.4],
    [7.7, 43.8],
    [6.9, 44.2],
  ],
  SICILY: [
    [12.4, 38.0],
    [15.6, 38.3],
    [15.1, 36.7],
    [12.9, 37.5],
  ],
  SARDINIA: [
    [8.2, 41.0],
    [9.7, 41.1],
    [9.6, 39.2],
    [8.5, 38.9],
  ],
};

interface Outline {
  key: string;
  country: string;
  points: string;
}

/**
 * Vector map of the sovereign data centers (Switzerland and Italy) with one pin per site: the canton or region, the provider,
 * the certifications and the services it hosts appear on focus or click. Every pin is a button, so the map works from the
 * keyboard, and the same facts are listed under the map for screen readers.
 */
@Component({
  selector: 'app-sovereign-map',
  imports: [TranslatePipe, NzTagModule],
  template: `
    <figure class="sovereign-map" data-testid="sovereign-map">
      <svg
        viewBox="0 0 520 600"
        role="group"
        [attr.aria-label]="'DATA_SOVEREIGNTY.MAP_LABEL' | translate"
      >
        @for (outline of outlines; track outline.key) {
          <polygon
            [attr.points]="outline.points"
            [class]="'land land-' + outline.country.toLowerCase()"
          />
        }
        @for (pin of pins(); track pin.site.key) {
          <g
            class="pin"
            tabindex="0"
            role="button"
            [attr.data-testid]="'pin-' + pin.site.key"
            [attr.aria-label]="pin.site.city + ', ' + pin.site.region"
            [attr.aria-pressed]="selectedKey() === pin.site.key"
            [class.selected]="selectedKey() === pin.site.key"
            [class.degraded]="!pin.site.healthy"
            (click)="select(pin.site.key)"
            (keydown.enter)="select(pin.site.key)"
            (keydown.space)="select(pin.site.key); $event.preventDefault()"
          >
            <circle
              [attr.cx]="pin.x"
              [attr.cy]="pin.y"
              r="9"
              [class]="'dot dot-' + pin.site.country.toLowerCase()"
            />
            <text [attr.x]="pin.x + 13" [attr.y]="pin.y + 4" class="label">
              {{ pin.site.city }}
            </text>
          </g>
        }
      </svg>
      @if (selected(); as site) {
        <figcaption class="site-detail" data-testid="site-detail">
          <strong>{{ site.city }}</strong> · {{ site.region }} ({{ site.country }}) ·
          {{ site.provider }}
          <div>
            @for (cert of site.certifications; track cert) {
              <nz-tag nzColor="geekblue">{{ cert }}</nz-tag>
            }
          </div>
          <div class="services">
            @for (service of site.services; track service) {
              <nz-tag>{{ serviceLabel(service) | translate }}</nz-tag>
            }
          </div>
        </figcaption>
      }
    </figure>
    <ul class="site-list" data-testid="site-list">
      @for (site of sites(); track site.key) {
        <li>
          <strong>{{ site.city }}</strong> {{ site.region }} ({{ site.country }}) —
          {{ site.certifications.join(', ') }}
        </li>
      }
    </ul>
  `,
  styles: `
    .sovereign-map {
      margin: 0;
    }
    svg {
      width: 100%;
      max-height: 480px;
    }
    .land {
      fill: var(--ant-color-fill-tertiary, #f0f0f0);
      stroke: var(--ant-color-border, #bfbfbf);
      stroke-width: 1;
    }
    .land-ch {
      fill: rgba(245, 34, 45, 0.12);
    }
    .land-it {
      fill: rgba(82, 196, 26, 0.12);
    }
    .pin {
      cursor: pointer;
      outline: none;
    }
    .pin:focus-visible .dot,
    .pin.selected .dot {
      stroke: var(--ant-color-primary, #1677ff);
      stroke-width: 3;
    }
    .dot-ch {
      fill: #cf1322;
    }
    .dot-it {
      fill: #237804;
    }
    .degraded .dot {
      fill: #d48806;
    }
    .label {
      font-size: 14px;
      fill: var(--ant-color-text, #262626);
    }
    .site-detail {
      padding: 8px 0;
    }
    .site-list {
      margin: 8px 0 0;
      padding-left: 20px;
    }
  `,
})
export class SovereignMapComponent {
  readonly sites = input.required<MapSite[]>();

  readonly selectedKey = signal<string | null>(null);
  readonly outlines: Outline[] = Object.entries(OUTLINES).map(([key, points]) => ({
    key,
    country: key === 'CH' ? 'CH' : 'IT',
    points: points
      .map(([longitude, latitude]) => {
        const { x, y } = project(latitude, longitude);

        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' '),
  }));

  readonly pins = computed(() =>
    this.sites().map((site) => ({ site, ...project(site.latitude, site.longitude) })),
  );
  readonly selected = computed(
    () => this.sites().find((site) => site.key === this.selectedKey()) ?? null,
  );

  select(key: string): void {
    this.selectedKey.update((current) => (current === key ? null : key));
  }

  serviceLabel(service: string): string {
    return serviceKey(service);
  }
}
