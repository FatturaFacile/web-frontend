import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  DepartmentResource,
  EmployeeResource,
  HrApiService,
  HrEmployeeApiService,
  PermissionsService,
  ShortTimeApiService,
  ShortTimeCaseRecord,
  ShortTimeClaim,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { map } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption } from '../shared/crud/crud.types';
import { ConstructionPanelComponent } from './construction-panel.component';
import { ShortTimeClaimModalComponent } from './short-time-claim-modal.component';
import { ShortTimeClaimsDrawerComponent } from './short-time-claims-drawer.component';

type Row = { id: string } & Record<string, unknown>;

const KINDS = ['short_time', 'bad_weather'];

/** Short-time work and bad weather cases with their monthly claims, and the construction wage (Swiss companies). */
@Component({
  selector: 'app-short-time',
  styleUrl: './short-time.component.scss',
  imports: [
    NzAlertModule,
    NzCardModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    CrudTableComponent,
    ConstructionPanelComponent,
    ShortTimeClaimModalComponent,
    ShortTimeClaimsDrawerComponent,
  ],
  template: `
    <app-page-header
      [title]="'hrmShortTime.title' | translate"
      [subtitle]="'hrmShortTime.subtitle' | translate"
    />
    <nz-card>
      <nz-alert
        nzType="info"
        nzShowIcon
        class="mb-3"
        [nzMessage]="'hrmShortTime.swissOnly' | translate"
      />
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmShortTime.cases' | translate">
          <app-crud-table [config]="casesConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmShortTime.constructionTab' | translate">
          <app-construction-panel [canWrite]="canWrite()" [employees]="employeeOptions()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
    <app-short-time-claim-modal
      [(open)]="claimModalOpen"
      [caseId]="selected()?.id ?? null"
      [employees]="employeeOptions()"
      (calculated)="onCalculated($event)"
    />
    <app-short-time-claims-drawer
      [(open)]="claimsOpen"
      [caseRecord]="selected()"
      [canWrite]="canWrite()"
      [focusClaim]="focusClaim()"
    />
  `,
})
export class ShortTimeComponent implements OnInit {
  private readonly api = inject(ShortTimeApiService);
  private readonly hrApi = inject(HrApiService);
  private readonly orgApi = inject(HrEmployeeApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('payroll'));
  protected readonly claimModalOpen = signal(false);
  protected readonly claimsOpen = signal(false);
  protected readonly selected = signal<ShortTimeCaseRecord | null>(null);
  protected readonly focusClaim = signal<ShortTimeClaim | null>(null);
  private readonly employees = signal<EmployeeResource[]>([]);
  private readonly departments = signal<DepartmentResource[]>([]);
  private readonly cases = signal<ShortTimeCaseRecord[]>([]);

  protected readonly employeeOptions = computed<CrudOption[]>(() =>
    this.employees().map((e) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name}` })),
  );

  protected readonly casesConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmShortTime.cases',
    canWrite: this.canWrite(),
    list: () =>
      this.api.getCases().pipe(
        map((res) => {
          this.cases.set(res.data);
          return res.data.map(
            (c) => ({ ...c, claims_count: c.claims?.length ?? 0 }) as unknown as Row,
          );
        }),
      ),
    create: (payload) => this.api.createCase(payload as never),
    rowActions: [
      {
        labelKey: 'hrmShortTime.claim.calculateTitle',
        writeOnly: true,
        run: (row) => this.openClaim(row.id, false),
      },
      { labelKey: 'hrmShortTime.claims.title', run: (row) => this.openClaim(row.id, true) },
    ],
    fields: [
      {
        key: 'kind',
        labelKey: 'hrmShortTime.kind',
        type: 'select',
        required: true,
        options: () => KINDS.map((value) => ({ value, labelKey: `hrmShortTime.kinds.${value}` })),
      },
      {
        key: 'cause',
        labelKey: 'hrmShortTime.cause',
        type: 'textarea',
        required: true,
        maxLength: 2000,
        column: false,
      },
      { key: 'starts_on', labelKey: 'hrmShortTime.startsOn', type: 'date', required: true },
      { key: 'ends_on', labelKey: 'hrmShortTime.endsOn', type: 'date', nullable: true, notBefore: 'starts_on' },
      {
        key: 'notified_on',
        labelKey: 'hrmShortTime.notifiedOn',
        type: 'date',
        nullable: true,
        column: false,
      },
      { key: 'is_urgent', labelKey: 'hrmShortTime.urgent', type: 'boolean', column: false },
      {
        key: 'department_id',
        labelKey: 'hrmOrg.department',
        type: 'select',
        nullable: true,
        column: false,
        options: () =>
          this.departments().map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` })),
      },
      {
        key: 'authority_reference',
        labelKey: 'hrmShortTime.authorityReference',
        type: 'text',
        nullable: true,
        maxLength: 120,
      },
      { key: 'claims_count', labelKey: 'hrmShortTime.claimsCount', type: 'text', noForm: true },
    ],
  }));

  ngOnInit(): void {
    this.hrApi
      .getEmployees({ per_page: 100 })
      .subscribe({ next: (res) => this.employees.set(res.data) });
    this.orgApi.getDepartments().subscribe({ next: (res) => this.departments.set(res.data) });
  }

  private openClaim(caseId: string, showClaims: boolean): void {
    this.selected.set(this.cases().find((c) => c.id === caseId) ?? null);
    this.focusClaim.set(null);
    if (showClaims) {
      this.claimsOpen.set(true);
    } else {
      this.claimModalOpen.set(true);
    }
  }

  protected onCalculated(claim: ShortTimeClaim): void {
    const current = this.selected();
    if (current) {
      const summary = {
        id: claim.id,
        status: claim.status,
        total_compensation: claim.total_compensation,
      };
      this.selected.set({
        ...current,
        claims: [...(current.claims ?? []).filter((c) => c.id !== claim.id), summary],
      });
    }
    this.focusClaim.set(claim);
    this.claimsOpen.set(true);
  }
}
