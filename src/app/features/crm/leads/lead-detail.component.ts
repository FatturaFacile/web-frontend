import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, JsonPipe } from '@angular/common';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { map } from 'rxjs';
import {
  applyServerErrors,
  I18nService,
  Lead,
  LEAD_ACTIVITY_EVENT_TYPES,
  LeadActivityEvent,
  LeadActivityEventPayload,
  LeadActivityEventType,
  LeadApiService,
  leadDisplayName,
  serverErrorMessage,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { LeadAssigneeDirectory } from './lead-assignee-directory';
import { LeadConvertWizardComponent } from './lead-convert-wizard.component';
import { apiErrorMessage, httpStatus } from './lead-http.utils';
import { LeadRatingTagComponent } from './lead-rating-tag.component';
import { LeadScoreBadgeComponent } from './lead-score-badge.component';

function jsonObjectValidator(control: AbstractControl<string>): ValidationErrors | null {
  const raw = (control.value ?? '').trim();
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? null
      : { json: true };
  } catch {
    return { json: true };
  }
}

@Component({
  selector: 'app-crm-lead-detail',
  imports: [
    DatePipe,
    JsonPipe,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzFormModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzResultModule,
    NzSelectModule,
    NzSkeletonModule,
    NzTimelineModule,
    PageHeaderComponent,
    TranslatePipe,
    LeadConvertWizardComponent,
    LeadRatingTagComponent,
    LeadScoreBadgeComponent,
  ],
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.scss',
})
export class LeadDetailComponent {
  private readonly api = inject(LeadApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly assignees = inject(LeadAssigneeDirectory);

  readonly lead = signal<Lead | null>(null);
  readonly events = signal<LeadActivityEvent[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly loadError = signal(false);
  readonly busy = signal<'rescore' | 'route' | 'event' | null>(null);
  readonly eventError = signal<string | null>(null);
  readonly wizardOpen = signal(false);

  private leadId = '';

  readonly eventForm = this.fb.group({
    type: this.fb.control<LeadActivityEventType>('email_opened'),
    occurred_at: this.fb.control<Date | null>(null),
    metadata: this.fb.control('', { validators: [jsonObjectValidator] }),
  });

  protected readonly name = computed(() => {
    const l = this.lead();
    return l ? leadDisplayName(l) : '';
  });

  protected readonly breakdown = computed(() => this.lead()?.score_breakdown ?? []);

  protected readonly isConverted = computed(() => {
    const l = this.lead();
    return !!l && (!!l.converted_at || l.status === 'converted');
  });

  protected readonly eventTypeOptions = computed(() => {
    this.i18n.currentLanguage();
    return LEAD_ACTIVITY_EVENT_TYPES.map((t) => ({ value: t, label: this.eventTypeLabel(t) }));
  });

  constructor() {
    this.assignees.load();
    this.route.paramMap
      .pipe(
        map((p) => p.get('id') ?? ''),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.leadId = id;
        this.lead.set(null);
        this.events.set([]);
        this.load();
      });
  }

  load(): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.loadError.set(false);
    this.api.getLead(this.leadId).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (httpStatus(err) === 404) {
          this.notFound.set(true);
        } else {
          this.loadError.set(true);
        }
      },
    });
    this.loadEvents();
  }

  private loadEvents(): void {
    this.api.listEvents(this.leadId).subscribe({
      next: (events) => this.events.set(this.sortEvents(events)),
      error: () => this.events.set([]),
    });
  }

  private sortEvents(events: LeadActivityEvent[]): LeadActivityEvent[] {
    return [...events].sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''));
  }

  protected eventTypeLabel(type: string): string {
    return this.i18n.translate(`CRM.LEADS.EVENTS.TYPES.${type.toUpperCase()}`);
  }

  protected statusLabel(status: string | null | undefined): string {
    return status ? this.i18n.translate(`CRM.LEADS.STATUS.${status.toUpperCase()}`) : '-';
  }

  protected hasMetadata(e: LeadActivityEvent): boolean {
    return !!e.metadata && Object.keys(e.metadata).length > 0;
  }

  addEvent(): void {
    if (this.eventForm.invalid || this.busy()) {
      this.eventForm.markAllAsDirty();
      return;
    }
    const v = this.eventForm.getRawValue();
    const payload: LeadActivityEventPayload = { type: v.type };
    if (v.occurred_at) {
      payload.occurred_at = v.occurred_at.toISOString();
    }
    if (v.metadata.trim()) {
      payload.metadata = JSON.parse(v.metadata) as Record<string, unknown>;
    }
    this.busy.set('event');
    this.eventError.set(null);
    this.api.addEvent(this.leadId, payload).subscribe({
      next: () => {
        this.busy.set(null);
        this.eventForm.reset({ type: v.type, occurred_at: null, metadata: '' });
        this.message.success(this.i18n.translate('CRM.LEADS.EVENTS.ADDED'));
        // The backend rescores on new events: refresh score, rating and timeline.
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(null);
        const unmapped = applyServerErrors(this.eventForm, err);
        this.eventError.set(unmapped.join(' ') || apiErrorMessage(err));
      },
    });
  }

  protected eventFieldError(path: string): string | null {
    if (path === 'metadata' && this.eventForm.controls.metadata.hasError('json')) {
      return this.i18n.translate('CRM.LEADS.EVENTS.METADATA_INVALID');
    }
    return serverErrorMessage(this.eventForm, path);
  }

  rescore(): void {
    this.runAction('rescore', () => this.api.rescore(this.leadId), 'CRM.LEADS.ACTIONS.RESCORED');
  }

  reroute(): void {
    this.runAction('route', () => this.api.route(this.leadId), 'CRM.LEADS.ACTIONS.ROUTED');
  }

  private runAction(
    kind: 'rescore' | 'route',
    call: () => ReturnType<LeadApiService['rescore']>,
    key: string,
  ): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(kind);
    call().subscribe({
      next: (lead) => {
        this.busy.set(null);
        if (lead && typeof lead === 'object' && 'id' in lead) {
          this.lead.set({ ...this.lead(), ...lead });
        } else {
          this.load();
        }
        this.message.success(this.i18n.translate(key));
      },
      error: () => this.busy.set(null),
    });
  }
}
