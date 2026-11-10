import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  PrivacyApiService,
  PrivacyBreachIncident,
  PrivacyDataSubjectRequest,
  PrivacyProcessingActivity,
  PrivacySensitiveAccessLog,
  PrivacySubprocessor,
} from '@core';
import { PageHeaderComponent } from '@shared';
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

@Component({
  selector: 'app-privacy-center',
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
  ],
  template: `
    <app-page-header
      title="Privacy Center (GDPR & Swiss nLPD)"
      subtitle="Registro dei trattamenti (Art. 30 GDPR / Art. 12 nLPD), Sub-responsabili (Art. 16 nLPD), Diritti degli interessati, Data Breach (72h) e Log accessi sensibili (DPOOP Art. 4)"
    />

    <nz-card>
      <nz-tabs>
        <!-- TAB 1: GDPR / nLPD Data Subject Requests & Portability -->
        <nz-tab nzTitle="Diritti Interessati (GDPR / nLPD)">
          <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center;">
            <button nz-button nzType="primary" type="button" (click)="dsrModalOpen.set(true)">
              Nuova Richiesta (DSR)
            </button>
            <select class="ant-input" style="width: 140px;" [(ngModel)]="portabilitySubjectType">
              <option value="contact">Contatto</option>
              <option value="employee">Dipendente</option>
              <option value="user">Utente</option>
            </select>
            <input
              nz-input
              style="width: 260px;"
              placeholder="UUID Soggetto per export portabilità"
              [(ngModel)]="portabilitySubjectId"
            />
            <button
              nz-button
              type="button"
              [disabled]="!portabilitySubjectId"
              (click)="exportDossier()"
            >
              Esporta Dossier (Art. 20 GDPR / Art. 28 nLPD)
            </button>
          </div>

          <nz-table #dsrTable [nzData]="requests()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>Normativa</th>
                <th>Tipo Richiesta</th>
                <th>Soggetto</th>
                <th>Scadenza</th>
                <th>Stato / Blocco Legale CO 958f</th>
                <th>Azioni</th>
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
                        Esegui Cancellazione / Anonimizzazione
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          @if (exportedDossier(); as dossier) {
            <nz-card nzTitle="Dossier Portabilità Esportato" style="margin-top: 16px;">
              <pre style="max-height: 240px; overflow: auto; font-size: 12px;">{{ dossier | json }}</pre>
            </nz-card>
          }
        </nz-tab>

        <!-- TAB 2: RoPA (Processing Activities) -->
        <nz-tab nzTitle="Registro Trattamenti (RoPA)">
          <div style="margin-bottom: 16px;">
            <button nz-button nzType="primary" type="button" (click)="ropaModalOpen.set(true)">
              Nuova Attività di Trattamento
            </button>
          </div>
          <nz-table #ropaTable [nzData]="activities()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>Titolo</th>
                <th>Finalità</th>
                <th>Base Giuridica</th>
                <th>Conservazione</th>
                <th>Stato</th>
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
        <nz-tab nzTitle="Sub-responsabili Estero (nLPD Art. 16)">
          <div style="margin-bottom: 16px;">
            <button nz-button nzType="primary" type="button" (click)="subModalOpen.set(true)">
              Aggiungi Sub-responsabile
            </button>
          </div>
          <nz-table #subTable [nzData]="subprocessors()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>Fornitore</th>
                <th>Servizio</th>
                <th>Paese</th>
                <th>Adeguatezza Consiglio Federale</th>
                <th>Garanzia (SCC / FDPIC)</th>
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
                      {{ sub.is_adequate_country_nlpd ? 'Adeguato (Allegato 1 OPDo)' : 'Richiede SCC / FDPIC' }}
                    </nz-tag>
                  </td>
                  <td><code>{{ sub.safeguard_mechanism }}</code></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <!-- TAB 4: Data Breach Register (72h) -->
        <nz-tab nzTitle="Registro Data Breach (72h)">
          <div style="margin-bottom: 16px;">
            <button nz-button nzType="primary" nzDanger type="button" (click)="breachModalOpen.set(true)">
              Segnala Violazione Dati (Data Breach)
            </button>
          </div>
          <nz-table #breachTable [nzData]="breaches()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>Titolo</th>
                <th>Gravità</th>
                <th>Scoperta</th>
                <th>Scadenza 72h (IFPDT / Garante)</th>
                <th>Record Coinvolti</th>
                <th>Notifica Autorità</th>
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
                      {{ b.requires_authority_notification ? 'Obbligatoria (72h)' : 'Interna' }}
                    </nz-tag>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <!-- TAB 5: Sensitive Access Logs (DPOOP Art. 4) -->
        <nz-tab nzTitle="Log Accessi Dati Sensibili (OPDo Art. 4)">
          <div style="margin-bottom: 16px;">
            <button nz-button type="button" (click)="loadAll()">Aggiorna Log</button>
          </div>
          <nz-table #logTable [nzData]="accessLogs()" [nzLoading]="loading()" nzSize="small">
            <thead>
              <tr>
                <th>Data / Ora</th>
                <th>Utente (Actor)</th>
                <th>Azione</th>
                <th>Soggetto</th>
                <th>Risorsa</th>
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
      nzTitle="Nuova Richiesta Interessato (GDPR / nLPD)"
      (nzOnCancel)="dsrModalOpen.set(false)"
      (nzOnOk)="submitDsr()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="dsrForm">
          <nz-form-item>
            <nz-form-label nzRequired>Normativa</nz-form-label>
            <nz-form-control>
              <select class="ant-input" formControlName="regulation">
                <option value="nLPD">nLPD (Svizzera)</option>
                <option value="GDPR">GDPR (UE)</option>
              </select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Tipo Richiesta</nz-form-label>
            <nz-form-control>
              <select class="ant-input" formControlName="request_type">
                <option value="access">Accesso (Art. 15 GDPR / Art. 25 nLPD)</option>
                <option value="portability">Portabilità (Art. 20 GDPR / Art. 28 nLPD)</option>
                <option value="erasure">Cancellazione / Oblio (Art. 17 GDPR / Art. 32 nLPD)</option>
                <option value="rectification">Rettifica</option>
              </select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Tipo Soggetto</nz-form-label>
            <nz-form-control>
              <select class="ant-input" formControlName="subject_type">
                <option value="contact">Contatto (Cliente/Fornitore)</option>
                <option value="employee">Dipendente</option>
                <option value="user">Utente</option>
              </select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>UUID Soggetto</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="subject_id" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal: Create RoPA -->
    <nz-modal
      [nzVisible]="ropaModalOpen()"
      nzTitle="Nuova Attività di Trattamento (RoPA)"
      (nzOnCancel)="ropaModalOpen.set(false)"
      (nzOnOk)="submitRopa()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="ropaForm">
          <nz-form-item>
            <nz-form-label nzRequired>Titolo</nz-form-label>
            <nz-form-control><input nz-input formControlName="title" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Finalità</nz-form-label>
            <nz-form-control><input nz-input formControlName="purpose" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Periodo di Conservazione</nz-form-label>
            <nz-form-control><input nz-input formControlName="retention_period" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal: Create Subprocessor -->
    <nz-modal
      [nzVisible]="subModalOpen()"
      nzTitle="Nuovo Sub-responsabile (nLPD Art. 16)"
      (nzOnCancel)="subModalOpen.set(false)"
      (nzOnOk)="submitSubprocessor()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="subForm">
          <nz-form-item>
            <nz-form-label nzRequired>Ragione Sociale</nz-form-label>
            <nz-form-control><input nz-input formControlName="name" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Tipo Servizio</nz-form-label>
            <nz-form-control><input nz-input formControlName="service_type" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Codice Paese ISO-2 (es. CH, DE, US)</nz-form-label>
            <nz-form-control><input nz-input formControlName="country_code" maxlength="2" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <!-- Modal: Create Breach -->
    <nz-modal
      [nzVisible]="breachModalOpen()"
      nzTitle="Segnala Data Breach (Art. 33 GDPR / Art. 24 nLPD)"
      (nzOnCancel)="breachModalOpen.set(false)"
      (nzOnOk)="submitBreach()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="breachForm">
          <nz-form-item>
            <nz-form-label nzRequired>Titolo Incidente</nz-form-label>
            <nz-form-control><input nz-input formControlName="title" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Gravità</nz-form-label>
            <nz-form-control>
              <select class="ant-input" formControlName="severity">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Numero Record Coinvolti</nz-form-label>
            <nz-form-control><input nz-input type="number" formControlName="affected_records_count" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PrivacyCenterComponent implements OnInit {
  private readonly api = inject(PrivacyApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);

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
    subject_id: this.fb.control('', Validators.required),
  });

  protected readonly ropaForm = this.fb.group({
    title: this.fb.control('', Validators.required),
    purpose: this.fb.control('', Validators.required),
    legal_basis: this.fb.control('legal_obligation', Validators.required),
    retention_period: this.fb.control('10 years (Swiss CO Art. 958f)', Validators.required),
  });

  protected readonly subForm = this.fb.group({
    name: this.fb.control('', Validators.required),
    service_type: this.fb.control('Infrastructure', Validators.required),
    country_code: this.fb.control('CH', [Validators.required, Validators.maxLength(2)]),
  });

  protected readonly breachForm = this.fb.group({
    title: this.fb.control('', Validators.required),
    severity: this.fb.control<'low' | 'medium' | 'high' | 'critical'>('high', Validators.required),
    affected_records_count: this.fb.control(1, Validators.required),
  });

  ngOnInit(): void {
    this.loadAll();
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
    if (this.dsrForm.invalid) return;
    this.api.createDataSubjectRequest(this.dsrForm.getRawValue()).subscribe({
      next: () => {
        this.dsrModalOpen.set(false);
        this.message.success('Richiesta registrata');
        this.loadAll();
      },
    });
  }

  protected executeErasure(req: PrivacyDataSubjectRequest): void {
    this.api.executeErasure(req.id).subscribe({
      next: (res) => {
        this.message.success(`Esito cancellazione: ${res.data.status}`);
        this.loadAll();
      },
    });
  }

  protected exportDossier(): void {
    if (!this.portabilitySubjectId) return;
    this.api.exportPortabilityDossier(this.portabilitySubjectType, this.portabilitySubjectId).subscribe({
      next: (res) => {
        this.exportedDossier.set(res.data);
        this.message.success('Dossier di portabilità generato');
        this.loadAll();
      },
    });
  }

  protected submitRopa(): void {
    if (this.ropaForm.invalid) return;
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
          this.message.success('Attività di trattamento registrata');
          this.loadAll();
        },
      });
  }

  protected submitSubprocessor(): void {
    if (this.subForm.invalid) return;
    this.api.createSubprocessor(this.subForm.getRawValue()).subscribe({
      next: () => {
        this.subModalOpen.set(false);
        this.message.success('Sub-responsabile registrato');
        this.loadAll();
      },
    });
  }

  protected submitBreach(): void {
    if (this.breachForm.invalid) return;
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
          this.message.success('Incidente Data Breach registrato');
          this.loadAll();
        },
      });
  }
}
