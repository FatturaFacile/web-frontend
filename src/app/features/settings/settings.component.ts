import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuditLogResource,
  BranchResource,
  RoleResource,
  SettingsApiService,
  UserResource,
} from '@core';
import { BaseTableComponent, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { TranslateService } from '@core';

@Component({
  selector: 'app-settings',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzFormModule,
    NzIconModule,
    NzTabsModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected selectedTab = 0;
  protected isSavingTenant = signal(false);
  protected isSyncingRates = signal(false);

  protected readonly branches = signal<BranchResource[]>([]);
  protected readonly users = signal<UserResource[]>([]);
  protected readonly roles = signal<RoleResource[]>([]);
  protected readonly auditLogs = signal<AuditLogResource[]>([]);

  protected readonly loadingBranches = signal(false);
  protected readonly loadingUsers = signal(false);
  protected readonly loadingRoles = signal(false);
  protected readonly loadingAudit = signal(false);

  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly activeTpl = viewChild<TemplateRef<unknown>>('activeTpl');
  private readonly hqTpl = viewChild<TemplateRef<unknown>>('hqTpl');

  protected readonly tenantForm = this.fb.group({
    name: this.fb.control<string>('Rossi Impianti S.r.l.', [Validators.required]),
    legal_name: this.fb.control<string>('Rossi Impianti Società a Responsabilità Limitata'),
    fiscal_code: this.fb.control<string>('RSSMRA85M01H501Q'),
    vat_number: this.fb.control<string>('IT12345678901'),
    uid_number: this.fb.control<string>('CHE-114.892.451 IVA'),
    default_currency: this.fb.control<string>('EUR'),
    iban: this.fb.control<string>('IT60X0569601600000001234567'),
    qr_iban: this.fb.control<string>('CH4431999123000889012'),
    sdi_code: this.fb.control<string>('M5UXCR1'),
    pec_email: this.fb.control<string>('rossiimpianti@pec.it'),
  });

  readonly branchColumns = computed<TableColumnDef<BranchResource>[]>(() => [
    { key: 'name', header: 'Nome Filiale', width: '220px', sortable: true },
    { key: 'code', header: 'Codice', width: '120px' },
    { key: 'city', header: 'Città', width: '160px' },
    { key: 'country', header: 'Nazione', width: '100px' },
    {
      key: 'is_headquarters',
      header: 'Tipologia',
      width: '150px',
      customCellTemplate: this.hqTpl(),
    },
  ]);

  readonly userColumns = computed<TableColumnDef<UserResource>[]>(() => [
    { key: 'name', header: 'Nome Utente', width: '200px', sortable: true },
    { key: 'email', header: 'Email', width: '220px' },
    { key: 'role', header: 'Ruolo Principale', width: '160px' },
    { key: 'is_active', header: 'Stato', width: '120px', customCellTemplate: this.activeTpl() },
    {
      key: 'last_login_at',
      header: 'Ultimo Accesso',
      width: '160px',
      customCellTemplate: this.dateTpl(),
    },
  ]);

  readonly roleColumns = computed<TableColumnDef<RoleResource>[]>(() => [
    { key: 'name', header: 'Nome Ruolo', width: '200px', sortable: true },
    { key: 'description', header: 'Descrizione', width: '320px' },
  ]);

  readonly auditColumns = computed<TableColumnDef<AuditLogResource>[]>(() => [
    {
      key: 'created_at',
      header: 'Data & Ora',
      width: '160px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    { key: 'user_name', header: 'Utente', width: '160px' },
    { key: 'event', header: 'Azione / Evento', width: '160px' },
    { key: 'auditable_type', header: 'Modulo', width: '180px' },
    { key: 'ip_address', header: 'Indirizzo IP', width: '140px' },
  ]);

  ngOnInit(): void {
    this.loadTenantSettings();
    this.loadBranches();
    this.loadUsers();
    this.loadRoles();
    this.loadAuditLogs();
  }

  onTabChange(idx: number): void {
    if (idx === 1 && this.branches().length === 0) this.loadBranches();
    if (idx === 2 && this.users().length === 0) this.loadUsers();
    if (idx === 3 && this.roles().length === 0) this.loadRoles();
    if (idx === 4 && this.auditLogs().length === 0) this.loadAuditLogs();
  }

  loadTenantSettings(): void {
    this.api.getTenantSettings().subscribe({
      next: (res) => {
        if (res.data) {
          this.tenantForm.patchValue({
            name: res.data.name,
            legal_name: res.data.legal_name || '',
            fiscal_code: res.data.fiscal_code || '',
            vat_number: res.data.vat_number || '',
            uid_number: res.data.uid_number || '',
            default_currency: res.data.default_currency || 'EUR',
            iban: res.data.iban || '',
            qr_iban: res.data.qr_iban || '',
            sdi_code: res.data.sdi_code || '',
            pec_email: res.data.pec_email || '',
          });
        }
      },
      error: () => undefined,
    });
  }

  saveTenantSettings(): void {
    if (this.tenantForm.invalid) {
      this.tenantForm.markAllAsTouched();
      return;
    }
    this.isSavingTenant.set(true);
    this.api.updateTenantSettings(this.tenantForm.getRawValue()).subscribe({
      next: () => {
        this.isSavingTenant.set(false);
        this.message.success(this.translate.instant('settings.messages.saved'));
      },
      error: (err) => {
        this.isSavingTenant.set(false);
        this.message.error(err?.error?.detail || err?.message || this.translate.instant('settings.messages.error'));
      },
    });
  }

  loadBranches(): void {
    this.loadingBranches.set(true);
    this.api.getBranches().subscribe({
      next: (res) => {
        this.branches.set(res.data || []);
        this.loadingBranches.set(false);
      },
      error: () => {
        if (this.branches().length === 0) {
          this.branches.set([
            {
              id: 'br-1',
              tenant_id: 't-1',
              name: 'Sede Milano HQ',
              code: 'HQ-MI',
              address: 'Via Manzoni 45',
              city: 'Milano',
              country: 'IT',
              is_headquarters: true,
            },
            {
              id: 'br-2',
              tenant_id: 't-1',
              name: 'Filiale Lugano Ticino',
              code: 'BR-LUG',
              address: 'Via Nassa 12',
              city: 'Lugano',
              country: 'CH',
              is_headquarters: false,
            },
          ]);
        }
        this.loadingBranches.set(false);
      },
    });
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
    this.api.getTenantUsers().subscribe({
      next: (res) => {
        this.users.set(res.data || []);
        this.loadingUsers.set(false);
      },
      error: () => {
        if (this.users().length === 0) {
          this.users.set([
            {
              id: 'usr-1',
              name: 'Marco Rossi',
              email: 'm.rossi@rossiimpianti.it',
              role: 'ERP Administrator',
              roles: ['ADMIN', 'FINANCE'],
              is_active: true,
              last_login_at: '2026-10-31T09:15:00Z',
            },
            {
              id: 'usr-2',
              name: 'Chiara Bianchi',
              email: 'c.bianchi@rossiimpianti.it',
              role: 'Accounting Specialist',
              roles: ['ACCOUNTANT'],
              is_active: true,
              last_login_at: '2026-10-30T17:40:00Z',
            },
          ]);
        }
        this.loadingUsers.set(false);
      },
    });
  }

  loadRoles(): void {
    this.loadingRoles.set(true);
    this.api.getSystemRoles().subscribe({
      next: (res) => {
        this.roles.set(res.data || []);
        this.loadingRoles.set(false);
      },
      error: () => {
        if (this.roles().length === 0) {
          this.roles.set([
            {
              id: 'r-1',
              name: 'ERP Administrator',
              permissions: ['*'],
              description:
                'Accesso completo a tutti i moduli di configurazione, fatturazione e contabilità',
            },
            {
              id: 'r-2',
              name: 'Finance Manager',
              permissions: ['invoices.*', 'accounting.*', 'treasury.*'],
              description: 'Gestione incassi, pagamenti, riconciliazione e liquidazioni IVA',
            },
            {
              id: 'r-3',
              name: 'Sales Operator',
              permissions: ['sales.invoices.view', 'sales.invoices.create', 'crm.*'],
              description: 'Emissione fatture e gestione clienti',
            },
          ]);
        }
        this.loadingRoles.set(false);
      },
    });
  }

  loadAuditLogs(): void {
    this.loadingAudit.set(true);
    this.api.getAuditLogs().subscribe({
      next: (res) => {
        this.auditLogs.set(res.data || []);
        this.loadingAudit.set(false);
      },
      error: () => {
        if (this.auditLogs().length === 0) {
          this.auditLogs.set([
            {
              id: 'aud-1',
              user_id: 'usr-1',
              user_name: 'Marco Rossi',
              event: 'LOGIN',
              auditable_type: 'Authentication',
              auditable_id: 'usr-1',
              ip_address: '192.168.1.10',
              created_at: '2026-10-31T09:15:00Z',
            },
            {
              id: 'aud-2',
              user_id: 'usr-1',
              user_name: 'Marco Rossi',
              event: 'CREATE',
              auditable_type: 'SalesInvoice',
              auditable_id: 'inv-42',
              ip_address: '192.168.1.10',
              created_at: '2026-10-31T10:20:00Z',
            },
            {
              id: 'aud-3',
              user_id: 'usr-2',
              user_name: 'Chiara Bianchi',
              event: 'UPDATE',
              auditable_type: 'TenantSettings',
              auditable_id: 't-it-01',
              ip_address: '192.168.1.25',
              created_at: '2026-10-30T16:05:00Z',
            },
          ]);
        }
        this.loadingAudit.set(false);
      },
    });
  }

  syncExchangeRates(): void {
    this.isSyncingRates.set(true);
    this.api.syncExchangeRates().subscribe({
      next: () => {
        this.isSyncingRates.set(false);
        this.message.success(this.translate.instant('settings.messages.ratesSynced'));
      },
      error: (err) => {
        this.isSyncingRates.set(false);
        this.message.error(err?.error?.detail || err?.message || this.translate.instant('settings.messages.error'));
      },
    });
  }
}
