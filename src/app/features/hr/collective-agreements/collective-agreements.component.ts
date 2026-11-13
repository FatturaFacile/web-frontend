import { Component, computed, inject, signal } from '@angular/core';
import { CollectiveAgreementResource, PayrollAgreementApiService, PermissionsService } from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { map } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, crudPage } from '../shared/crud/crud.types';

type Row = { id: string } & Record<string, unknown>;

/** Collective agreements (CCNL) with their levels. Generic agreements are read-only. */
@Component({
  selector: 'app-collective-agreements',
  styleUrl: './collective-agreements.component.scss',
  imports: [
    ModalActionsDirective,
    NzCardModule,
    NzModalModule,
    PageHeaderComponent,
    TranslatePipe,
    CrudTableComponent,
  ],
  template: `
    <app-page-header
      [title]="'hrmCcnl.title' | translate"
      [subtitle]="'hrmCcnl.subtitle' | translate"
    />
    <nz-card>
      <app-crud-table [config]="agreementsConfig()" />
    </nz-card>
    <nz-modal
      [nzVisible]="selected() !== null"
      [nzTitle]="selectedTitle()"
      [nzWidth]="640"
      [nzFooter]="null"
      (nzOnCancel)="selected.set(null)"
    >
      <ng-container *nzModalContent>
        @if (levelsConfig(); as config) {
          <app-crud-table [config]="config" />
        }
      </ng-container>
    </nz-modal>
  `,
})
export class CollectiveAgreementsComponent {
  private readonly api = inject(PayrollAgreementApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly selected = signal<CollectiveAgreementResource | null>(null);
  protected readonly selectedTitle = computed(() => {
    const agreement = this.selected();
    return agreement ? `${agreement.code} - ${agreement.name}` : '';
  });

  private readonly canWrite = computed(() => this.permissions.canWrite('payroll'));

  protected readonly agreementsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmCcnl.agreements',
    canWrite: this.canWrite(),
    gridList: (query) => crudPage(this.api.getAgreements(query)),
    create: (payload) => this.api.createAgreement(payload as never),
    update: (id, payload) => this.api.updateAgreement(id, payload as never),
    remove: (id) => this.api.deleteAgreement(id),
    isReadonly: (row) => row['is_generic'] === true,
    rowActions: [{ labelKey: 'hrmCcnl.levels', run: (row) => this.selected.set(row as never) }],
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 30 },
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 255 },
      { key: 'weekly_hours', labelKey: 'hrmCcnl.weeklyHours', type: 'decimal' },
      { key: 'installments', labelKey: 'hrmCcnl.installments', type: 'integer' },
      { key: 'fourteenth_month', labelKey: 'hrmCcnl.fourteenthMonth', type: 'integer' },
      { key: 'employer_inps_rate_percent', labelKey: 'hrmCcnl.employerInpsRate', type: 'decimal', nullable: true },
      { key: 'notes', labelKey: 'hrmCommon.notes', type: 'textarea', column: false, nullable: true },
      { key: 'is_generic', labelKey: 'hrmCcnl.generic', type: 'boolean', noForm: true },
    ],
  }));

  protected readonly levelsConfig = computed<CrudConfig<Row> | null>(() => {
    const agreement = this.selected();
    if (!agreement) {
      return null;
    }
    return {
      titleKey: 'hrmCcnl.levels',
      canWrite: this.canWrite() && !agreement.is_generic,
      list: () => this.api.getAgreement(agreement.id).pipe(map((res) => (res.data.levels ?? []) as unknown as Row[])),
      create: (payload) => this.api.addLevel(agreement.id, payload as never),
      update: (levelId, payload) => this.api.updateLevel(agreement.id, levelId, payload as never),
      remove: (levelId) => this.api.deleteLevel(agreement.id, levelId),
      fields: [
        { key: 'level', labelKey: 'hrmCcnl.level', type: 'text', required: true, maxLength: 30 },
        { key: 'description', labelKey: 'hrmCommon.description', type: 'text', nullable: true, maxLength: 255 },
        { key: 'monthly_minimum', labelKey: 'hrmCcnl.monthlyMinimum', type: 'decimal', required: true },
      ],
    };
  });
}
