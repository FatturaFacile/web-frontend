import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  I18nService,
  PgBreach,
  PgBreachJurisdiction,
  PgBreachPayload,
  PgBreachRisk,
  PgBreachSeverity,
  PgBreachStatus,
  PgNotificationDossier,
  PrivacyGovernanceApiService,
} from '@core';
import { downloadBlob, PageHeaderComponent, TranslatePipe } from '@shared';
import {
  BreachField,
  breachRequiredFields,
  createBreachCountdown,
  pgErrorMessage,
  severityColor,
  uniqueTags,
} from './privacy-governance.helpers';

export const PG_JURISDICTIONS: readonly PgBreachJurisdiction[] = [
  'it_gdpr_garante',
  'ch_nlpd_fdpic',
  'both_ch_it',
];
export const PG_SEVERITIES: readonly PgBreachSeverity[] = ['low', 'medium', 'high', 'critical'];
export const PG_RISKS: readonly PgBreachRisk[] = ['unlikely', 'possible', 'likely', 'high_risk'];
export const PG_BREACH_STATUSES: readonly PgBreachStatus[] = [
  'investigating',
  'contained',
  'notified_authority',
  'notified_subjects',
  'closed',
];

/** Local `datetime-local` value (yyyy-MM-ddTHH:mm) of an ISO instant. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

/** Data breach wizard (Art. 33-34 GDPR, Art. 24 nLPD): live 72 hours countdown, incident record and notification dossier. */
@Component({
  selector: 'app-data-breach-assistant',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzStepsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(240px, 300px) 1fr;
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 1000px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    .incident {
      display: block;
      width: 100%;
      text-align: left;
      margin-bottom: 8px;
    }
    .clock {
      font-variant-numeric: tabular-nums;
      font-size: 28px;
      font-weight: 700;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }
    pre {
      max-height: 320px;
      overflow: auto;
    }
  `,
  template: `
    <app-page-header
      [title]="'PRIVACY.BREACH.TITLE' | translate"
      [subtitle]="'PRIVACY.BREACH.SUBTITLE' | translate"
    >
      <button nz-button nzType="primary" (click)="startNew()">
        {{ 'PRIVACY.BREACH.NEW' | translate }}
      </button>
    </app-page-header>

    @if (selected(); as incident) {
      @if (!incident.authority_notified_at) {
        <nz-alert
          nzShowIcon
          [nzType]="countdown.overdue() ? 'error' : 'warning'"
          [nzMessage]="
            (countdown.overdue() ? 'PRIVACY.BREACH.OVERDUE' : 'PRIVACY.BREACH.COUNTDOWN')
              | translate
          "
          [nzDescription]="clock"
        />
        <ng-template #clock>
          <span class="clock" data-testid="breach-clock">{{ countdown.label() }}</span>
          <div>
            {{ 'PRIVACY.BREACH.DEADLINE' | translate }}:
            {{ incident.notification_deadline_72h | date: 'medium' }}
          </div>
        </ng-template>
      } @else {
        <nz-alert
          nzType="success"
          nzShowIcon
          [nzMessage]="
            'PRIVACY.BREACH.NOTIFIED'
              | translate: { date: (incident.authority_notified_at | date: 'medium') ?? '' }
          "
        />
      }
    }

    <div class="layout">
      <nz-card [nzTitle]="'PRIVACY.BREACH.INCIDENTS' | translate" nzSize="small">
        @for (item of incidents(); track item.id) {
          <button
            nz-button
            class="incident"
            [nzType]="item.id === selected()?.id ? 'primary' : 'default'"
            (click)="select(item)"
          >
            <strong>{{ item.incident_code }}</strong> {{ item.title }}
            <nz-tag [nzColor]="severityColor(item.severity)">{{
              'PRIVACY.SEVERITY.' + item.severity | translate
            }}</nz-tag>
          </button>
        } @empty {
          <p>{{ 'PRIVACY.BREACH.EMPTY' | translate }}</p>
        }
      </nz-card>

      <nz-card>
        <nz-steps [nzCurrent]="step()" nzSize="small">
          <nz-step [nzTitle]="'PRIVACY.BREACH.STEP_FACTS' | translate" />
          <nz-step [nzTitle]="'PRIVACY.BREACH.STEP_IMPACT' | translate" />
          <nz-step [nzTitle]="'PRIVACY.BREACH.STEP_NOTIFY' | translate" />
          <nz-step [nzTitle]="'PRIVACY.BREACH.STEP_DOSSIER' | translate" />
        </nz-steps>

        <form nz-form nzLayout="vertical" [formGroup]="form" style="margin-top: 16px">
          @switch (step()) {
            @case (0) {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="b-title">{{
                  'PRIVACY.BREACH.NAME' | translate
                }}</nz-form-label>
                <nz-form-control [nzErrorTip]="form.controls.title.errors?.['serverError']">
                  <input nz-input id="b-title" formControlName="title" maxlength="190" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="b-juris">{{
                  'PRIVACY.BREACH.JURISDICTION' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-select nzId="b-juris" formControlName="jurisdiction">
                    @for (j of jurisdictions; track j) {
                      <nz-option
                        [nzValue]="j"
                        [nzLabel]="'PRIVACY.JURISDICTION.' + j | translate"
                      />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-alert
                nzType="info"
                nzShowIcon
                [nzMessage]="'PRIVACY.JURISDICTION_HINT.' + jurisdiction() | translate"
              />
              <nz-form-item>
                <nz-form-label nzFor="b-detected">{{
                  'PRIVACY.BREACH.DETECTED_AT' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    id="b-detected"
                    type="datetime-local"
                    formControlName="detected_at"
                  />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="b-sev">{{
                  'PRIVACY.BREACH.SEVERITY' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-select nzId="b-sev" formControlName="severity">
                    @for (s of severities; track s) {
                      <nz-option [nzValue]="s" [nzLabel]="'PRIVACY.SEVERITY.' + s | translate" />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="b-risk">{{
                  'PRIVACY.BREACH.RISK' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-select nzId="b-risk" formControlName="risk_to_rights_and_freedoms">
                    @for (r of risks; track r) {
                      <nz-option [nzValue]="r" [nzLabel]="'PRIVACY.RISK.' + r | translate" />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzRequired]="isRequired('description')" nzFor="b-desc">
                  {{ 'PRIVACY.BREACH.DESCRIPTION' | translate }}
                </nz-form-label>
                <nz-form-control>
                  <textarea nz-input id="b-desc" rows="4" formControlName="description"></textarea>
                </nz-form-control>
              </nz-form-item>
            }
            @case (1) {
              <nz-form-item>
                <nz-form-label [nzRequired]="isRequired('affected_subjects_count')" nzFor="b-count">
                  {{ 'PRIVACY.BREACH.AFFECTED_COUNT' | translate }}
                </nz-form-label>
                <nz-form-control>
                  <nz-input-number
                    nzId="b-count"
                    formControlName="affected_subjects_count"
                    [nzMin]="0"
                  />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzRequired]="isRequired('affected_data_categories')">
                  {{ 'PRIVACY.BREACH.AFFECTED_CATEGORIES' | translate }}
                </nz-form-label>
                <nz-form-control>
                  <nz-select
                    nzMode="tags"
                    formControlName="affected_data_categories"
                    [nzPlaceHolder]="'PRIVACY.ROPA.TAG_PLACEHOLDER' | translate"
                    [nzTokenSeparators]="[',']"
                  />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzRequired]="isRequired('containment_measures')" nzFor="b-contain">
                  {{ 'PRIVACY.BREACH.CONTAINMENT' | translate }}
                </nz-form-label>
                <nz-form-control>
                  <textarea
                    nz-input
                    id="b-contain"
                    rows="3"
                    formControlName="containment_measures"
                  ></textarea>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzRequired]="isRequired('remediation_plan')" nzFor="b-remed">
                  {{ 'PRIVACY.BREACH.REMEDIATION' | translate }}
                </nz-form-label>
                <nz-form-control>
                  <textarea
                    nz-input
                    id="b-remed"
                    rows="3"
                    formControlName="remediation_plan"
                  ></textarea>
                </nz-form-control>
              </nz-form-item>
              @if (missing().length > 0) {
                <nz-alert
                  nzType="warning"
                  nzShowIcon
                  data-testid="missing-fields"
                  [nzMessage]="'PRIVACY.BREACH.MISSING' | translate"
                  [nzDescription]="missingLabels()"
                />
              }
            }
            @case (2) {
              @if (selected(); as incident) {
                <nz-form-item>
                  <nz-form-label nzFor="b-status">{{
                    'PRIVACY.BREACH.STATUS' | translate
                  }}</nz-form-label>
                  <nz-form-control>
                    <nz-select nzId="b-status" formControlName="status">
                      @for (s of statuses; track s) {
                        <nz-option
                          [nzValue]="s"
                          [nzLabel]="'PRIVACY.BREACH_STATUS.' + s | translate"
                        />
                      }
                    </nz-select>
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzFor="b-ref">{{
                    'PRIVACY.BREACH.REFERENCE' | translate
                  }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      id="b-ref"
                      formControlName="authority_reference_number"
                      maxlength="100"
                    />
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzFor="b-auth">{{
                    'PRIVACY.BREACH.AUTHORITY_NOTIFIED_AT' | translate
                  }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      id="b-auth"
                      type="datetime-local"
                      formControlName="authority_notified_at"
                    />
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzFor="b-subj">{{
                    'PRIVACY.BREACH.SUBJECTS_NOTIFIED_AT' | translate
                  }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      id="b-subj"
                      type="datetime-local"
                      formControlName="subjects_notified_at"
                    />
                  </nz-form-control>
                </nz-form-item>
                <p>{{ incident.incident_code }}</p>
              } @else {
                <nz-alert
                  nzType="info"
                  nzShowIcon
                  [nzMessage]="'PRIVACY.BREACH.SAVE_FIRST' | translate"
                />
              }
            }
            @case (3) {
              @if (selected()) {
                <button
                  nz-button
                  type="button"
                  [nzLoading]="loadingDossier()"
                  (click)="loadDossier()"
                >
                  {{ 'PRIVACY.BREACH.SHOW_DOSSIER' | translate }}
                </button>
                @if (dossier(); as d) {
                  <button nz-button type="button" (click)="exportDossier()">
                    {{ 'PRIVACY.BREACH.EXPORT_DOSSIER' | translate }}
                  </button>
                  @for (authority of d.authorities; track authority.code) {
                    <nz-card nzSize="small" [nzTitle]="authority.name" style="margin-top: 12px">
                      <p>{{ authority.legal_basis }} - {{ authority.channel }}</p>
                      <p>{{ 'PRIVACY.BREACH.MANDATORY_FIELDS' | translate }}:</p>
                      <ul>
                        @for (field of authority.mandatory_fields; track field) {
                          <li>{{ field }}</li>
                        }
                      </ul>
                    </nz-card>
                  }
                  <pre data-testid="dossier-json">{{ dossierJson() }}</pre>
                }
              } @else {
                <nz-alert
                  nzType="info"
                  nzShowIcon
                  [nzMessage]="'PRIVACY.BREACH.SAVE_FIRST' | translate"
                />
              }
            }
          }
        </form>

        <div class="actions">
          <button nz-button type="button" [disabled]="step() === 0" (click)="step.set(step() - 1)">
            {{ 'PRIVACY.COMMON.BACK' | translate }}
          </button>
          @if (step() < 3) {
            <button nz-button type="button" (click)="step.set(step() + 1)">
              {{ 'PRIVACY.COMMON.NEXT' | translate }}
            </button>
          }
          @if (step() === 1 || step() === 2) {
            <button
              nz-button
              nzType="primary"
              type="button"
              [nzLoading]="saving()"
              [disabled]="form.invalid || (step() === 1 && missing().length > 0)"
              (click)="save()"
            >
              {{ (selected() ? 'PRIVACY.BREACH.UPDATE' : 'PRIVACY.BREACH.CREATE') | translate }}
            </button>
          }
        </div>
      </nz-card>
    </div>
  `,
})
export class DataBreachAssistantComponent implements OnInit {
  private readonly api = inject(PrivacyGovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly jurisdictions = PG_JURISDICTIONS;
  readonly severities = PG_SEVERITIES;
  readonly risks = PG_RISKS;
  readonly statuses = PG_BREACH_STATUSES;
  readonly severityColor = severityColor;

  readonly incidents = signal<PgBreach[]>([]);
  readonly selected = signal<PgBreach | null>(null);
  readonly step = signal(0);
  readonly saving = signal(false);
  readonly loadingDossier = signal(false);
  readonly dossier = signal<PgNotificationDossier | null>(null);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(190)]],
    description: [''],
    detected_at: [''],
    jurisdiction: ['both_ch_it' as PgBreachJurisdiction, Validators.required],
    severity: ['medium' as PgBreachSeverity, Validators.required],
    risk_to_rights_and_freedoms: ['possible' as PgBreachRisk, Validators.required],
    affected_subjects_count: [null as number | null],
    affected_data_categories: [[] as string[]],
    containment_measures: [''],
    remediation_plan: [''],
    authority_reference_number: [''],
    authority_notified_at: [''],
    subjects_notified_at: [''],
    status: ['investigating' as PgBreachStatus],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    {
      initialValue: this.form.getRawValue(),
    },
  );

  readonly jurisdiction = computed(() => this.formValue().jurisdiction ?? 'both_ch_it');
  readonly required = computed<BreachField[]>(() => breachRequiredFields(this.jurisdiction()));
  /** The fields the chosen authority requires and that are still empty. */
  readonly missing = computed<BreachField[]>(() => {
    const value = this.formValue();
    return this.required().filter((field) => {
      const current = value[field];
      if (Array.isArray(current)) {
        return current.length === 0;
      }
      return current === null || current === undefined || String(current).trim() === '';
    });
  });
  readonly missingLabels = computed(() =>
    this.missing()
      .map((field) => this.i18n.translate(`PRIVACY.BREACH_FIELD.${field}`))
      .join(', '),
  );
  readonly dossierJson = computed(() => JSON.stringify(this.dossier(), null, 2));

  readonly countdown = createBreachCountdown(
    computed(() => this.selected()?.notification_deadline_72h ?? null),
  );

  isRequired(field: BreachField): boolean {
    return this.required().includes(field);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getBreaches({ per_page: 100 }).subscribe({
      next: (response) => {
        this.incidents.set(response.data);
        const current = this.selected();
        const first =
          response.data.find((item) => item.id === current?.id) ?? response.data[0] ?? null;
        if (first) {
          this.select(first, false);
        }
      },
      error: (err: unknown) =>
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.LOAD_FAILED'))),
    });
  }

  startNew(): void {
    this.selected.set(null);
    this.dossier.set(null);
    this.step.set(0);
    this.form.reset();
  }

  select(incident: PgBreach, resetStep = true): void {
    this.selected.set(incident);
    this.dossier.set(null);
    if (resetStep) {
      this.step.set(0);
    }
    this.form.reset({
      title: incident.title,
      description: incident.description ?? '',
      detected_at: toLocalInput(incident.detected_at),
      jurisdiction: incident.jurisdiction,
      severity: incident.severity,
      risk_to_rights_and_freedoms: incident.risk_to_rights_and_freedoms ?? 'possible',
      affected_subjects_count: incident.affected_subjects_count ?? null,
      affected_data_categories: incident.affected_data_categories ?? [],
      containment_measures: incident.containment_measures ?? '',
      remediation_plan: incident.remediation_plan ?? '',
      authority_reference_number: incident.authority_reference_number ?? '',
      authority_notified_at: toLocalInput(incident.authority_notified_at),
      subjects_notified_at: toLocalInput(incident.subjects_notified_at),
      status: incident.status,
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload: PgBreachPayload = {
      title: raw.title.trim(),
      description: raw.description.trim() || null,
      detected_at: toIso(raw.detected_at),
      jurisdiction: raw.jurisdiction,
      severity: raw.severity,
      risk_to_rights_and_freedoms: raw.risk_to_rights_and_freedoms,
      affected_subjects_count: raw.affected_subjects_count,
      affected_data_categories: uniqueTags(raw.affected_data_categories),
      containment_measures: raw.containment_measures.trim() || null,
      remediation_plan: raw.remediation_plan.trim() || null,
    };
    const current = this.selected();
    this.saving.set(true);
    const request = current
      ? this.api.updateBreach(current.id, {
          ...payload,
          authority_reference_number: raw.authority_reference_number.trim() || null,
          authority_notified_at: toIso(raw.authority_notified_at),
          subjects_notified_at: toIso(raw.subjects_notified_at),
          status: raw.status,
        })
      : this.api.createBreach(payload);
    request.subscribe({
      next: ({ data }) => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('PRIVACY.COMMON.SAVED'));
        this.selected.set(data);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        applyServerErrors(this.form, err);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }

  loadDossier(): void {
    const current = this.selected();
    if (!current) {
      return;
    }
    this.loadingDossier.set(true);
    this.api.getNotificationDossier(current.id).subscribe({
      next: ({ data }) => {
        this.loadingDossier.set(false);
        this.dossier.set(data);
      },
      error: (err: unknown) => {
        this.loadingDossier.set(false);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.LOAD_FAILED')));
      },
    });
  }

  exportDossier(): void {
    const current = this.selected();
    if (!current || !this.dossier()) {
      return;
    }
    downloadBlob(
      new Blob([this.dossierJson()], { type: 'application/json' }),
      `${current.incident_code}-notification-dossier.json`,
    );
  }
}
