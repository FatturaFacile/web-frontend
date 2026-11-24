import { Component, computed, input, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import type { FsmBoardLane, FsmBoardUnassigned } from '@core';
import { TranslatePipe } from '@shared';
import {
  buildTechnicianRoutes,
  formatKm,
  formatMinutes,
  GeoPoint,
  projectPoints,
  TechnicianRoute,
} from './dispatcher.utils';

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 380;

/** Colour per technician route (dark enough for AA contrast against the white map background). */
export const ROUTE_PALETTE: readonly string[] = ['#0958d9', '#237804', '#ad4e00', '#531dab', '#08979c', '#a8071a', '#614700', '#c41d7f'];

type RouteMode = 'optimised' | 'current';

interface PinView {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  queued: boolean;
}

interface PathView {
  technicianId: string;
  color: string;
  points: string;
}

/**
 * Map of the customer sites and route-optimisation panel. It renders an SVG scatter map (no tile server is needed):
 * pins are projected from their coordinates, and each technician route follows a nearest-neighbour order whose
 * distance and travel time are estimated client-side (see `dispatcher.utils`).
 */
@Component({
  selector: 'app-dispatcher-map',
  imports: [NzButtonModule, NzTableModule, TranslatePipe],
  styleUrl: './dispatcher-map.component.scss',
  template: `
    <div class="map-toolbar" role="group" [attr.aria-label]="'FSM.DISPATCH.ROUTE_MODE' | translate">
      <button nz-button type="button" [nzType]="mode() === 'optimised' ? 'primary' : 'default'" [attr.aria-pressed]="mode() === 'optimised'" (click)="mode.set('optimised')">
        {{ 'FSM.DISPATCH.ROUTE_OPTIMISED' | translate }}
      </button>
      <button nz-button type="button" [nzType]="mode() === 'current' ? 'primary' : 'default'" [attr.aria-pressed]="mode() === 'current'" (click)="mode.set('current')">
        {{ 'FSM.DISPATCH.ROUTE_CURRENT' | translate }}
      </button>
    </div>

    @if (pins().length === 0) {
      <p class="map-empty" data-testid="map-empty">{{ 'FSM.DISPATCH.MAP_EMPTY' | translate }}</p>
    } @else {
      <svg
        class="map-svg"
        role="img"
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        [attr.aria-label]="'FSM.DISPATCH.MAP_LABEL' | translate: { count: pins().length }"
      >
        <rect x="0" y="0" [attr.width]="width" [attr.height]="height" class="map-bg" />
        @for (path of paths(); track path.technicianId) {
          <polyline [attr.points]="path.points" fill="none" [attr.stroke]="path.color" stroke-width="2.5" stroke-dasharray="6 4" />
        }
        @for (pin of pins(); track pin.id) {
          <g [attr.data-testid]="'pin-' + pin.id">
            <circle [attr.cx]="pin.x" [attr.cy]="pin.y" r="7" [attr.fill]="pin.queued ? '#ffffff' : pin.color" [attr.stroke]="pin.color" stroke-width="2.5" />
            <text [attr.x]="pin.x + 10" [attr.y]="pin.y + 4" class="map-label">{{ pin.label }}</text>
            <title>{{ pin.label }}</title>
          </g>
        }
      </svg>
      <ul class="map-legend">
        <li><span class="pin queued" aria-hidden="true"></span> {{ 'FSM.DISPATCH.PIN_UNASSIGNED' | translate }}</li>
        @for (route of routes(); track route.technicianId; let i = $index) {
          <li><span class="pin" [style.background-color]="color(i)" aria-hidden="true"></span> {{ route.name }}</li>
        }
      </ul>
    }

    <h3 class="route-title">{{ 'FSM.DISPATCH.ROUTE_PANEL' | translate }}</h3>
    <nz-table nzSize="small" [nzData]="routes()" [nzShowPagination]="false" data-testid="route-table">
      <thead>
        <tr>
          <th>{{ 'FSM.DISPATCH.TECHNICIAN' | translate }}</th>
          <th>{{ 'FSM.DISPATCH.ROUTE_ORDER' | translate }}</th>
          <th>{{ 'FSM.DISPATCH.ROUTE_DISTANCE' | translate }}</th>
          <th>{{ 'FSM.DISPATCH.ROUTE_TRAVEL' | translate }}</th>
          <th>{{ 'FSM.DISPATCH.ROUTE_SAVED' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (route of routes(); track route.technicianId) {
          <tr>
            <td>{{ route.name }}</td>
            <td>{{ orderOf(route) }}</td>
            <td>{{ km(shown(route).totalKm) }}</td>
            <td>{{ minutes(shown(route).totalMinutes) }}</td>
            <td>{{ km(route.savedKm) }}</td>
          </tr>
        } @empty {
          <tr>
            <td colspan="5">{{ 'FSM.DISPATCH.ROUTE_EMPTY' | translate }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
    <p class="route-note">{{ 'FSM.DISPATCH.ROUTE_NOTE' | translate }}</p>
  `,
})
export class DispatcherMapComponent {
  readonly lanes = input.required<readonly FsmBoardLane[]>();
  readonly unassigned = input<readonly FsmBoardUnassigned[]>([]);

  protected readonly width = VIEW_WIDTH;
  protected readonly height = VIEW_HEIGHT;
  protected readonly mode = signal<RouteMode>('optimised');

  protected readonly routes = computed<TechnicianRoute[]>(() => buildTechnicianRoutes(this.lanes()));

  private readonly projected = computed(() => {
    const queued = this.unassigned()
      .filter((wo) => wo.site.latitude !== null && wo.site.longitude !== null)
      .map((wo) => ({ id: wo.work_order_id, label: wo.work_order_number, lat: wo.site.latitude as number, lng: wo.site.longitude as number }));
    const routed = this.routes().flatMap((route, routeIndex) =>
      route.optimised.legs.map((leg) => ({ ...leg.stop, routeIndex })),
    );
    const points: GeoPoint[] = [...queued, ...routed];
    const xy = projectPoints(points, VIEW_WIDTH, VIEW_HEIGHT);
    return { queued, routed, xy };
  });

  protected readonly pins = computed<PinView[]>(() => {
    const { queued, routed, xy } = this.projected();
    return [
      ...queued.map((q, i) => ({ id: q.id, label: q.label, x: xy[i].x, y: xy[i].y, color: '#595959', queued: true })),
      ...routed.map((r, i) => ({
        id: r.id,
        label: r.label,
        x: xy[queued.length + i].x,
        y: xy[queued.length + i].y,
        color: this.color(r.routeIndex),
        queued: false,
      })),
    ];
  });

  protected readonly paths = computed<PathView[]>(() => {
    const { queued, routed, xy } = this.projected();
    const byId = new Map<string, { x: number; y: number }>();
    routed.forEach((r, i) => byId.set(`${r.routeIndex}:${r.id}`, xy[queued.length + i]));
    return this.routes().map((route, routeIndex) => ({
      technicianId: route.technicianId,
      color: this.color(routeIndex),
      points: this.shown(route)
        .legs.map((leg) => byId.get(`${routeIndex}:${leg.stop.id}`))
        .filter((p): p is { x: number; y: number } => !!p)
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' '),
    }));
  });

  protected color(index: number): string {
    return ROUTE_PALETTE[index % ROUTE_PALETTE.length];
  }

  protected shown(route: TechnicianRoute) {
    return this.mode() === 'optimised' ? route.optimised : route.current;
  }

  protected orderOf(route: TechnicianRoute): string {
    return this.shown(route)
      .legs.map((leg) => leg.stop.label)
      .join(' → ');
  }

  protected km(value: number): string {
    return formatKm(value);
  }

  protected minutes(value: number): string {
    return formatMinutes(value);
  }
}
