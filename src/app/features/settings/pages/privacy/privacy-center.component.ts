import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  I18nService,
  PrivacyApiService,
  PrivacyBreachIncident,
  PrivacyDataSubjectRequest,
  PrivacyProcessingActivity,
  PrivacySensitiveAccessLog,
  PrivacySubprocessor,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-privacy-center',
  styleUrl: './privacy-center.component.scss',
  imports: [
    DatePipe,
    JsonPipe,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'privacyCenter.title' | translate"
      sub[title]="'privacyCenter.subtitle' | translate"
    />

    <nz-card>
      <nz-tabs>
        <!-- TAB 1: GDPR / nLPD Data Subject Requests & Portability -->
        <nz-tab [nzTitle]="'privacyCenter.tabRights' | translate">
          <div class="row mb-4">
            <button nz-button nzType="primary" type="button" (click)="dsrModalOpen.set(true)">
              {{ 'privacyCenter.newRequest' | translate }}
            </button>
            <select class="ant-input w-field-sm" [(ngModel)]="portabilitySubjectType">
              <option value="contact">{{ 'privacyCenter.subjectContact' | translate }}</option>
              <option value="employee">{{ 'privacyCenter.subjectEmployee' | translate }}</option>
              <option value="user">{{ 'privacyCenter.subjectUser' | translate }}</option>
            </select>
            <input
              nz-input
              class="w-field-md"
              [placeholder]="'privacyCenter.portabilityUuidPlaceholder' | translate"
              [(ngModel)]="portabilitySubjectId"
            />
            <button
              nz-button
              type="button"
              [disabled]="!portabilitySubjectId"
              (click)="exportDossier()"
            >
              {{ 'privacyCenter.exportDossier' | translate }}
            </button>
          </div>

          <nz-table #dsrTable [nzData]="requests()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'privacyCenter.regulation' | translate }}</th>
                <th>{{ 'privacyCenter.requestType' | translate }}</th>
                <th>{{ 'privacyCenter.subject' | translate }}</th>
                <th>{{ 'privacyCenter.dueDate' | translate }}</th>
                <th>{{ 'privacyCenter.statusLegalHold' | translate }}</th>
                <th>{{ 'privacyCenter.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (req of dsrTable.data; track req.id) {
                <tr>
                  <td><nz-tag nzColor="blue">{{ req.regulation }}</nz-tag></td>
                  <td>{{ req.request_type }}</td>
                  <td>{{ req.subject_type }}: <code>{{ req.subject_id }}</code></td>
                  <td>{{ req.due_at | date: 'dd.MM.yyyy' }}</td>
                  <td>
                    <nz-tag [nzColor]="req.status === 'completed' ? 'green' : req.status.includes('legal_hold') ? 'orange' : 'processing'">
                      {{ req.status }}
                    </nz-tag>
                  </td>
                  <td>
                    @if (req.request_type === 'erasure' && req.status === 'open') {
                      <button nz-button nzSize="small" nzDanger type="button" (click)="executeErasure(req)">
                        {{ 'privacyCenter.executeErasure' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          @if (exportedDossier(); as dossier) {
            <nz-card [nzTitle]="'privacyCenter.exportedDossier' | translate" class="mt-4">
              <pre class="dossier">{{ dossier | json }}</pre>
            </nz-card>
          }
        </nz-tab>

        <!-- TAB 2: RoPA (Processing Activities) -->
        <nz-tab [nzTitle]="'privacyCenter.tabRopa' | translate">
          <div class="mb-4">
            <button nz-button nzType="primary" type="button" (click)="ropaModalOpen.set(true)">
              {{ 'privacyCenter.newActivity' | translate }}
            </button>
          </div>
          <nz-table #ropaTable [nzData]="activities()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'privacyCenter.titleField' | translate }}</th>
                <th>{{ 'privacyCenter.purpose' | translate }}</th>
                <th>{{ 'privacyCenter.legalBasis' | translate }}</th>
                <th>{{ 'privacyCenter.retention' | translate }}</th>
                <th>{{ 'privacyCenter.status' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (act of ropaTable.data; track act.id) {
                <tr>
                  <td><strong>{{ act.title }}</strong></td>
                  <td>{{ act.purpose }}</td>
                  <td><code>{{ act.legal_basis }}</code></td>
                  <td>{{ act.retention_period }}</td>
                  <td><nz-tag nzColor="green">{{ act.status }}</nz-tag></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <!-- TAB 3: Subprocessors (Swiss nLPD Art. 16) -->
        <nz-tab [nzTitle]="'privacyCenter.tabSubprocessors' | translate">
          <div class="mb-4">
            <button nz-button nzType="primary" type="button" (click)="subModalOpen.set(true)">
              {{ 'privacyCenter.addSubprocessor' | translate }}
            </button>
          </div>
          <nz-table #subTable [nzData]="subprocessors()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'privacyCenter.supplier' | translate }}</th>
                <th>{{ 'privacyCenter.service' | translate }}</th>
                <th>{{ 'privacyCenter.country' | translate }}</th>
                <th>{{ 'privacyCenter.adequacy' | translate }}</th>
                <th>{{ 'privacyCenter.safeguard' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (sub of subTable.data; track sub.id) {
                <tr>
                  <td><strong>{{ sub.name }}</strong></td>
                  <td>{{ sub.service_type }}</td>
                  <td><code>{{ sub.country_code }}</code></td>
                  <td>
                    <nz-tag [nzColor]="sub.is_adequate_country_nlpd ? 'green' : 'volcano'">
                      {{ sub.is_adequate_country_nlpd ? ('privacyCenter.adequate' | translate) : ('privacyCenter.requiresScc' | translate) }}
                    </nz-tag>
                  </td>
                  <td><code>{{ sub.safeguard_mechanism }}</code></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <!-- TAB 4: Data Breach Register (72h) -->
        <nz-tab [nzTitle]="'privacyCenter.tabBreach' | translate">
          <div class="mb-4">
            <button nz-button nzType="primary" nzDanger type="button" (click)="breachModalOpen.set(true)">
              {{ 'privacyCenter.reportBreach' | translate }}
            </button>
          </div>
          <nz-table #breachTable [nzData]="breaches()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'privacyCenter.titleField' | translate }}</th>
                <th>{{ 'privacyCenter.severity' | translate }}</th>
                <th>{{ 'privacyCenter.discovered' | translate }}</th>
                <th>{{ 'privacyCenter.deadline72' | translate }}</th>
                <th>{{ 'privacyCenter.affectedRecords' | translate }}</th>
                <th>{{ 'privacyCenter.authorityNotification' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (b of breachTable.data; track b.id) {
                <tr>
                  <td><strong>{{ b.title }}</strong></td>
                  <td><nz-tag [nzColor]="b.severity === 'critical' || b.severity === 'high' ? 'red' : 'orange'">{{ b.severity }}</nz-tag></td>
                  <td>{{ b.discovered_at | date: 'dd.MM.yyyy HH:mm' }}</td>
                  <td>{{ b.notification_deadline_at | date: 'dd.MM.yyyy HH:mm' }}</td>
                  <td>{{ b.affected_records_count }}</td>
                  <td>
                    <nz-tag [nzColor]="b.requires_authority_notification ? 'volcano' : 'default'">
                      {{ b.requires_authority_notification ? ('privacyCenter.mandatory72' | translate) : ('privacyCenter.internal' | translate) }}
                    </nz-tag>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <!-- TAB 5: Sensitive Access Logs (DPOOP Art. 4) -->
        <nz-tab [nzTitle]="'privacyCenter.tabAccessLog' | translate">
          <div class="mb-4">
            <button nz-button type="button" (click)="loadAll()">{{ 'privacyCenter.refreshLog' | translate }}</button>
          </div>
          <nz-table #logTable [nzData]="accessLogs()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'privacyCenter.dateTime' | translate }}</th>
                <th>{{ 'privacyCenter.actor' | translate }}</th>
                <th>{{ 'privacyCenter.action' | translate }}</th>
                <th>{{ 'privacyCenter.subject' | translate }}</th>
                <th>{{ 'privacyCenter.resource' | translate }}</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              @for (log of logTable.data; track log.id) {
                <tr>
                  <td>{{ log.accessed_at | date: 'dd.MM.yyyy HH:mm:ss' }}</td>
                  <td><code>{{ log.actor_user_id }}</code></td>
                  <td><nz-tag nzColor="purple">{{ log.action }}</nz-tag></td>
                  <td>{{ log.subject_type }} {{ log.subject_id || '' }}</td>
                  <td><code>{{ log.resource }}</code></td>
                  <td>{{ log.ip_address || '-' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <!-- Modal: Create DSR -->
    <nz-modal
      [nzVisible]="dsrModalOpen()"
      [nzTitle]="'privacyCenter.modalDsr' | translate"
      (nzOnCancel)="dsrModalOpen.set(false)"
      (nzOnOk)="submitDsr()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="dsrForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.regulation' | translate }}</nz-form-label>
            <nz-form-control>
              <select class="ant-input" formControlName="regulation">
                <option value="nLPD">{{ 'privacyCenter.regNlpd' | translate }}</option>
                <option value="GDPR">{{ 'privacyCenter.regGdpr' | translate }}</option>
              </select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.requestType' | translate }}</nz-form-label>
            <nz-form-control>
              <select class="ant-input" formControlName="request_type">
                <option value="access">{{ 'privacyCenter.reqAccess' | translate }}</option>
                <option value="portability">{{ 'privacyCenter.reqPortability' | translate }}</option>
                <option value="erasure">{{ 'privacyCenter.reqErasure' | translate }}</option>
                <option value="rectification">{{ 'privacyCenter.reqRectification' | translate }}</option>
              </select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.subjectType' | translate }}</nz-form-label>
            <nz-form-control>
              <select class="ant-input" formControlName="subject_type">
                <option value="contact">{{ 'privacyCenter.subjectContactLong' | translate }}</option>
                <option value="employee">{{ 'privacyCenter.subjectEmployee' | translate }}</option>
                <option value="user">{{ 'privacyCenter.subjectUser' | translate }}</option>
              </select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.subjectUuid' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(dsrForm.controls.subject_id)">
              <input nz-input formControlName="subject_id" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal: Create RoPA -->
    <nz-modal
      [nzVisible]="ropaModalOpen()"
      [nzTitle]="'privacyCenter.modalRopa' | translate"
      (nzOnCancel)="ropaModalOpen.set(false)"
      (nzOnOk)="submitRopa()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="ropaForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.titleField' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(ropaForm.controls.title)"><input nz-input formControlName="title" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.purpose' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(ropaForm.controls.purpose)"><input nz-input formControlName="purpose" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.retentionPeriod' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(ropaForm.controls.retention_period)"><input nz-input formControlName="retention_period" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal: Create Subprocessor -->
    <nz-modal
      [nzVisible]="subModalOpen()"
      [nzTitle]="'privacyCenter.modalSubprocessor' | translate"
      (nzOnCancel)="subModalOpen.set(false)"
      (nzOnOk)="submitSubprocessor()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="subForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.companyName' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(subForm.controls.name)"><input nz-input formControlName="name" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.serviceType' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(subForm.controls.service_type)"><input nz-input formControlName="service_type" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.countryCode' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(subForm.controls.country_code)"><input nz-input formControlName="country_code" maxlength="2" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal: Create Breach -->
    <nz-modal
      [nzVisible]="breachModalOpen()"
      [nzTitle]="'privacyCenter.modalBreach' | translate"
      (nzOnCancel)="breachModalOpen.set(false)"
      (nzOnOk)="submitBreach()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="breachForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.incidentTitle' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(breachForm.controls.title)"><input nz-input formControlName="title" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'privacyCenter.severity' | translate }}</nz-form-label>
            <nz-form-control>
              <select class="ant-input" formControlName="severity">
                <option value="low">{{ 'privacyCenter.severityLow' | translate }}</option>
                <option value="medium">{{ 'privacyCenter.severityMedium' | translate }}</option>
                <option value="high">{{ 'privacyCenter.severityHigh' | translate }}</option>
                <option value="critical">{{ 'privacyCenter.severityCritical' | translate }}</option>
              </select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'privacyCenter.recordCount' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(breachForm.controls.affected_records_count)"><input nz-input type="number" min="0" formControlName="affected_records_count" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PrivacyCenterComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly api = inject(PrivacyApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly loading = signal(false);
  protected readonly activities = signal<PrivacyProcessingActivity[]>([]);
  protected readonly subprocessors = signal<PrivacySubprocessor[]>([]);
  protected readonly requests = signal<PrivacyDataSubjectRequest[]>([]);
  protected readonly breaches = signal<PrivacyBreachIncident[]>([]);
  protected readonly accessLogs = signal<PrivacySensitiveAccessLog[]>([]);
  protected readonly exportedDossier = signal<Record<string, unknown> | null>(null);

  protected portabilitySubjectType: 'contact' | 'employee' | 'user' = 'contact';
  protected portabilitySubjectId = '';

  protected readonly dsrModalOpen = signal(false);
  protected readonly ropaModalOpen = signal(false);
  protected readonly subModalOpen = signal(false);
  protected readonly breachModalOpen = signal(false);

  protected readonly dsrForm = this.fb.group({
    regulation: this.fb.control<'GDPR' | 'nLPD'>('nLPD', Validators.required),
    request_type: this.fb.control<'access' | 'portability' | 'erasure' | 'rectification' | 'restriction'>('erasure', Validators.required),
    subject_type: this.fb.control<'contact' | 'employee' | 'user'>('contact', Validators.required),
    subject_id: this.fb.control('', [Validators.required, Validators.pattern(UUID_PATTERN)]),
  });

  protected readonly ropaForm = this.fb.group({
    title: this.fb.control('', [Validators.required, Validators.maxLength(190)]),
    purpose: this.fb.control('', [Validators.required, Validators.maxLength(2000)]),
    legal_basis: this.fb.control('legal_obligation', [Validators.required, Validators.maxLength(60)]),
    retention_period: this.fb.control('10 years (Swiss CO Art. 958f)', [Validators.required, Validators.maxLength(120)]),
  });

  protected readonly subForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(190)]),
    service_type: this.fb.control('Infrastructure', [Validators.required, Validators.maxLength(120)]),
    country_code: this.fb.control('CH', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]),
  });

  protected readonly breachForm = this.fb.group({
    title: this.fb.control('', [Validators.required, Validators.maxLength(190)]),
    severity: this.fb.control<'low' | 'medium' | 'high' | 'critical'>('high', Validators.required),
    affected_records_count: this.fb.control(1, [Validators.min(0)]),
  });

  ngOnInit(): void {
    this.loadAll();
  }

  protected errorTip(control: AbstractControl): string {
    if (control.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
  }

  protected loadAll(): void {
    this.loading.set(true);
    this.api.getDataSubjectRequests().subscribe({
      next: (res) => this.requests.set(res.data ?? []),
      error: () => this.loading.set(false),
    });
    this.api.getProcessingActivities().subscribe({
      next: (res) => this.activities.set(res.data ?? []),
    });
    this.api.getSubprocessors().subscribe({
      next: (res) => this.subprocessors.set(res.data ?? []),
    });
    this.api.getBreaches().subscribe({
      next: (res) => this.breaches.set(res.data ?? []),
    });
    this.api.getSensitiveAccessLogs().subscribe({
      next: (res) => {
        this.accessLogs.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected submitDsr(): void {
    if (this.dsrForm.invalid) {
      this.dsrForm.markAllAsTouched();
      return;
    }
    this.api.createDataSubjectRequest(this.dsrForm.getRawValue()).subscribe({
      next: () => {
        this.dsrModalOpen.set(false);
        this.message.success(this.translate.instant('privacy.msgRichiestaRegistrata'));
        this.loadAll();
      },
    });
  }

  protected executeErasure(req: PrivacyDataSubjectRequest): void {
    this.api.executeErasure(req.id).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('privacy.msgEsitoCancellazione', { status: res.data.status }));
        this.loadAll();
      },
    });
  }

  protected exportDossier(): void {
    if (!this.portabilitySubjectId) return;
    this.api.exportPortabilityDossier(this.portabilitySubjectType, this.portabilitySubjectId).subscribe({
      next: (res) => {
        this.exportedDossier.set(res.data);
        this.message.success(this.translate.instant('privacy.msgDossierDiPortabilitaGenerato'));
        this.loadAll();
      },
    });
  }

  protected submitRopa(): void {
    if (this.ropaForm.invalid) {
      this.ropaForm.markAllAsTouched();
      return;
    }
    const raw = this.ropaForm.getRawValue();
    this.api
      .createProcessingActivity({
        ...raw,
        data_categories: ['identity', 'financial'],
        subject_categories: ['customers', 'employees'],
      })
      .subscribe({
        next: () => {
          this.ropaModalOpen.set(false);
          this.message.success(this.translate.instant('privacy.msgAttivitaDiTrattamentoRegistrata'));
          this.loadAll();
        },
      });
  }

  protected submitSubprocessor(): void {
    if (this.subForm.invalid) {
      this.subForm.markAllAsTouched();
      return;
    }
    this.api.createSubprocessor(this.subForm.getRawValue()).subscribe({
      next: () => {
        this.subModalOpen.set(false);
        this.message.success(this.translate.instant('privacy.msgSubResponsabileRegistrato'));
        this.loadAll();
      },
    });
  }

  protected submitBreach(): void {
    if (this.breachForm.invalid) {
      this.breachForm.markAllAsTouched();
      return;
    }
    const raw = this.breachForm.getRawValue();
    this.api
      .createBreach({
        ...raw,
        discovered_at: new Date().toISOString(),
        data_categories: ['personal_data'],
      })
      .subscribe({
        next: () => {
          this.breachModalOpen.set(false);
          this.message.success(this.translate.instant('privacy.msgIncidenteDataBreachRegistrato'));
          this.loadAll();
        },
      });
  }
}
