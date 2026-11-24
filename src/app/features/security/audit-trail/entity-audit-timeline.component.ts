import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { AuditLogEntry, AuditTrailApiService, PermissionsService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { AuditDetailDrawerComponent } from './audit-detail-drawer.component';
import { eventColor, eventLabelKey, formatMicroTimestamp } from './audit-presentation';

/**
 * The full lifecycle of one business record, from the audit trail: `<app-entity-audit-timeline entityType="Invoice"
 * [entityId]="invoice.id" />`. It renders nothing for a member who may not read the trail, so a detail view can embed it
 * without checking the permission itself. Each event opens the forensic detail drawer.
 */
@Component({
  selector: 'app-entity-audit-timeline',
  styleUrl: './audit-trail.scss',
  imports: [
    NzAlertModule,
    NzEmptyModule,
    NzSpinModule,
    NzTagModule,
    NzTimelineModule,
    TranslatePipe,
    AuditDetailDrawerComponent,
  ],
  template: `
    @if (allowed()) {
      <section [attr.aria-label]="'AUDIT.TIMELINE.TITLE' | translate">
        <h4>{{ 'AUDIT.TIMELINE.TITLE' | translate }}</h4>
        <nz-spin [nzSpinning]="loading()">
          @if (error()) {
            <nz-alert nzType="error" nzShowIcon [nzMessage]="error()"></nz-alert>
          } @else if (!loading() && events().length === 0) {
            <nz-empty [nzNotFoundContent]="'AUDIT.TIMELINE.EMPTY' | translate"></nz-empty>
          } @else {
            <nz-timeline>
              @for (event of events(); track event.id) {
                <nz-timeline-item [nzColor]="color(event.event_type)">
                  <div class="timeline-event">
                    <nz-tag [nzColor]="color(event.event_type)">{{
                      label(event.event_type) | translate
                    }}</nz-tag>
                    <span>{{ event.actor.email ?? event.actor.type }}</span>
                    @if (event.actor.role) {
                      <nz-tag>{{ event.actor.role }}</nz-tag>
                    }
                    <button type="button" class="link-button" (click)="show(event)">
                      {{ 'AUDIT.TIMELINE.OPEN' | translate }}
                    </button>
                  </div>
                  <div class="timeline-meta">
                    <span class="mono">{{ timestamp(event.occurred_at) }} UTC</span>
                    @if (event.ip_address) {
                      · {{ event.ip_address }}
                    }
                  </div>
                  @if (event.changed_fields.length && event.event_type !== 'CREATED') {
                    <div class="tags">
                      @for (field of event.changed_fields; track field) {
                        <nz-tag>{{ field }}</nz-tag>
                      }
                    </div>
                  }
                </nz-timeline-item>
              }
            </nz-timeline>
          }
        </nz-spin>
        <app-audit-detail-drawer
          [logId]="selectedId()"
          [(open)]="drawerOpen"
        ></app-audit-detail-drawer>
      </section>
    }
  `,
})
export class EntityAuditTimelineComponent {
  private readonly api = inject(AuditTrailApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly i18n = inject(TranslateService);

  /** The audit entity name: Invoice, Contact, User, Employee... */
  readonly entityType = input.required<string>();
  readonly entityId = input.required<string | null | undefined>();

  readonly events = signal<AuditLogEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly drawerOpen = signal(false);

  readonly allowed = computed(() => this.permissions.canRead('audit_trail'));

  protected readonly color = eventColor;
  protected readonly label = eventLabelKey;
  protected readonly timestamp = formatMicroTimestamp;

  constructor() {
    effect(() => {
      const type = this.entityType();
      const id = this.entityId();
      if (this.allowed() && id) {
        untracked(() => this.load(type, id));
      }
    });
  }

  show(event: AuditLogEntry): void {
    this.selectedId.set(event.id);
    this.drawerOpen.set(true);
  }

  private load(type: string, id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.entityTimeline(type, id).subscribe({
      next: (response) => {
        this.events.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.i18n.instant('AUDIT.ERROR.LOAD'));
        this.loading.set(false);
      },
    });
  }
}
