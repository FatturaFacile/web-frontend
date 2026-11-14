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
  FetchGridModel,
  RoleResource,
  SettingsApiService,
  UserResource,
} from '@core';
import { BaseTableComponent, IconActionDirective, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { TranslateService } from '@core';

@Component({
  selector: 'app-settings',
  styleUrl: './settings.component.scss',
  imports: [
    IconActionDirective,
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
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected selectedTab = 0;
  protected isSavingTenant = signal(false);
  protected isSyncingRates = signal(false);

  protected readonly branchGrid = new FetchGridModel<BranchResource>((query) => this.api.getBranches(query));
  protected readonly auditGrid = new FetchGridModel<AuditLogResource>((query) => this.api.getAuditLogs(query));
  protected readonly users = signal<UserResource[]>([]);
  protected readonly roles = signal<RoleResource[]>([]);

  protected readonly loadingUsers = signal(false);
  protected readonly loadingRoles = signal(false);

  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly activeTpl = viewChild<TemplateRef<unknown>>('activeTpl');
  private readonly primaryTpl = viewChild<TemplateRef<unknown>>('primaryTpl');
  private readonly auditUserTpl = viewChild<TemplateRef<unknown>>('auditUserTpl');

  protected readonly tenantForm = this.fb.group({
    name: this.fb.control<string>('Rossi Impianti S.r.l.', [Validators.required, Validators.maxLength(255)]),
    legal_name: this.fb.control<string>('Rossi Impianti Società a Responsabilità Limitata', [Validators.maxLength(255)]),
    fiscal_code: this.fb.control<string>('RSSMRA85M01H501Q', [Validators.maxLength(16)]),
    vat_number: this.fb.control<string>('IT12345678901', [Validators.maxLength(30)]),
    uid_number: this.fb.control<string>('CHE-114.892.451 IVA', [Validators.maxLength(20)]),
    default_currency: this.fb.control<string>('EUR', [Validators.minLength(3), Validators.maxLength(3)]),
    iban: this.fb.control<string>('IT60X0569601600000001234567', [Validators.maxLength(34)]),
    qr_iban: this.fb.control<string>('CH4431999123000889012', [Validators.maxLength(34)]),
    sdi_code: this.fb.control<string>('M5UXCR1', [Validators.minLength(7), Validators.maxLength(7)]),
    pec_email: this.fb.control<string>('rossiimpianti@pec.it', [Validators.email]),
  });

  readonly branchColumns = computed<TableColumnDef<BranchResource>[]>(() => [
    { key: 'name', header: 'COLUMNS.NOME_FILIALE', width: '220px' },
    { key: 'code', header: 'COLUMNS.CODICE', width: '120px' },
    { key: 'address', header: 'COLUMNS.INDIRIZZO', width: '240px' },
    {
      key: 'is_primary',
      serverKey: 'primary_state',
      header: 'COLUMNS.TIPOLOGIA',
      width: '150px',
      valueLabel: (value) => this.translate.instant(value === 'primary' ? 'COLUMNS.SEDE_CENTRALE' : 'COLUMNS.FILIALE'),
      customCellTemplate: this.primaryTpl(),
    },
  ]);

  readonly userColumns = computed<TableColumnDef<UserResource>[]>(() => [
    { key: 'name', header: 'COLUMNS.NOME_UTENTE', width: '200px', sortable: true },
    { key: 'email', header: 'COLUMNS.EMAIL', width: '220px' },
    { key: 'role', header: 'COLUMNS.RUOLO_PRINCIPALE', width: '160px' },
    { key: 'is_active', header: 'COLUMNS.STATO', width: '120px', customCellTemplate: this.activeTpl() },
    {
      key: 'last_login_at',
      header: 'COLUMNS.ULTIMO_ACCESSO',
      width: '160px',
      customCellTemplate: this.dateTpl(),
    },
  ]);

  readonly roleColumns = computed<TableColumnDef<RoleResource>[]>(() => [
    { key: 'name', header: 'COLUMNS.NOME_RUOLO', width: '200px', sortable: true },
    { key: 'description', header: 'COLUMNS.DESCRIZIONE', width: '320px' },
  ]);

  readonly auditColumns = computed<TableColumnDef<AuditLogResource>[]>(() => [
    {
      key: 'event_timestamp',
      header: 'COLUMNS.DATA_AND_ORA',
      width: '160px',
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'user',
      serverKey: 'user.name',
      header: 'COLUMNS.UTENTE',
      width: '160px',
      valueGetter: (row) => row.user?.name,
      customCellTemplate: this.auditUserTpl(),
    },
    { key: 'action', header: 'COLUMNS.AZIONE_EVENTO', width: '160px' },
    { key: 'module_code', header: 'COLUMNS.MODULO', width: '180px' },
    { key: 'ip_address', header: 'COLUMNS.INDIRIZZO_IP', width: '140px' },
  ]);

  ngOnInit(): void {
    this.loadTenantSettings();
    this.loadUsers();
    this.loadRoles();
  }

  onTabChange(idx: number): void {
    if (idx === 2 && this.users().length === 0) this.loadUsers();
    if (idx === 3 && this.roles().length === 0) this.loadRoles();
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
