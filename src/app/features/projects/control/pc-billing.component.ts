import { Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, FetchGridModel, I18nService, PermissionsService, ProjectControlApiService, ProjectRevenueRecognition, QueryFilterParams } from '@core';
import { BaseTableComponent, MoneyPipe, TableColumnDef, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../../general-ledger/shared/gl-error-alert.component';

/** Time and materials billing, billing runs and revenue recognition of a project. */
@Component({
  selector: 'app-pc-billing',
  styleUrl: './pc-billing.component.scss',
  imports: [
    BaseTableComponent,
    FormsModule, NzButtonModule, NzCardModule, NzInputModule, NzInputNumberModule, NzTagModule, GlErrorAlertComponent, MoneyPipe, TranslatePipe],
  template: `
    <app-gl-error-alert [error]="error()" />

    @if (canWrite) {
      <nz-card [nzTitle]="'PRJ.BILL_TM' | translate" nzSize="small" class="mb-4">
        <p>{{ 'PRJ.BILL_TM_HINT' | translate }}</p>
        <div class="row">
          <label for="bl-tax">{{ 'PRJ.TAX_RATE' | translate }}</label>
          <nz-input-number id="bl-tax" [(ngModel)]="taxRate" [nzMin]="0" [nzMax]="100" [nzPrecision]="2" />
          <label for="bl-upto">{{ 'PRJ.UP_TO_DATE' | translate }}</label>
          <input id="bl-upto" nz-input type="date" class="w-field-sm" [(ngModel)]="upToDate" />
          <button nz-button nzType="primary" type="button" [disabled]="taxRate === null" (click)="billTimeAndMaterials()">{{ 'PRJ.BILL' | translate }}</button>
        </div>
      </nz-card>

      <nz-card [nzTitle]="'PRJ.REVENUE_RECOGNITION' | translate" nzSize="small" class="mb-4">
        <div class="row">
          <label for="rr-date">{{ 'PRJ.ACCOUNTING_DATE' | translate }}</label>
          <input id="rr-date" nz-input type="date" class="w-field-sm" [(ngModel)]="accountingDate" />
          <label for="rr-override">{{ 'PRJ.OVERRIDE_COMPLETION' | translate }}</label>
          <nz-input-number id="rr-override" [(ngModel)]="overrideCompletion" [nzMin]="0" [nzMax]="100" [nzPrecision]="2" />
          <button nz-button nzType="primary" type="button" [disabled]="!accountingDate" (click)="runRecognition()">{{ 'PRJ.RUN_RECOGNITION' | translate }}</button>
        </div>
      </nz-card>
    }

    <app-base-table [grid]="grid" [columns]="columns()" exportFileName="revenue-recognition" />
    <ng-template #completionTpl let-run>{{ run.completion_percentage }}%</ng-template>
    <ng-template #periodRevenueTpl let-run>{{ run.period_revenue | money: currency() }}</ng-template>
    <ng-template #cumulativeTpl let-run>{{ run.cumulative_recognized_revenue | money: currency() }}</ng-template>
    <ng-template #assetTpl let-run>{{ run.contract_asset_balance | money: currency() }}</ng-template>
    <ng-template #postedTpl let-run>{{ (run.is_posted_to_gl ? 'PRJ.YES' : 'PRJ.NO') | translate }}</ng-template>
  `,
})
export class PcBillingComponent {
  readonly projectId = input.required<string>();

  private readonly api = inject(ProjectControlApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  /** Revenue recognition runs of the project: paging, sorting, filters and grouping run on the API. */
  protected readonly grid = new FetchGridModel<ProjectRevenueRecognition, QueryFilterParams>((query) =>
    this.api.getRevenueRecognitions(this.projectId(), query),
  );

  private readonly completionTpl = viewChild<TemplateRef<{ $implicit: ProjectRevenueRecognition; value: unknown }>>('completionTpl');
  private readonly periodRevenueTpl = viewChild<TemplateRef<{ $implicit: ProjectRevenueRecognition; value: unknown }>>('periodRevenueTpl');
  private readonly cumulativeTpl = viewChild<TemplateRef<{ $implicit: ProjectRevenueRecognition; value: unknown }>>('cumulativeTpl');
  private readonly assetTpl = viewChild<TemplateRef<{ $implicit: ProjectRevenueRecognition; value: unknown }>>('assetTpl');
  private readonly postedTpl = viewChild<TemplateRef<{ $implicit: ProjectRevenueRecognition; value: unknown }>>('postedTpl');

  protected readonly columns = computed<TableColumnDef<ProjectRevenueRecognition>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'accounting_period_date', header: 'PRJ.ACCOUNTING_DATE' },
      { key: 'completion_percentage', header: 'PRJ.COMPLETION', align: 'right', customCellTemplate: this.completionTpl() },
      { key: 'period_revenue', header: 'PRJ.PERIOD_REVENUE', align: 'right', customCellTemplate: this.periodRevenueTpl() },
      { key: 'cumulative_recognized_revenue', header: 'PRJ.CUMULATIVE_REVENUE', align: 'right', customCellTemplate: this.cumulativeTpl() },
      { key: 'contract_asset_balance', header: 'PRJ.CONTRACT_ASSET', align: 'right', customCellTemplate: this.assetTpl() },
      {
        key: 'is_posted_to_gl',
        serverKey: 'posting',
        header: 'PRJ.POSTED_TO_GL',
        valueGetter: (run) => this.i18n.translate(run.is_posted_to_gl ? 'PRJ.YES' : 'PRJ.NO'),
        valueLabel: (value) => this.i18n.translate(value === 'yes' ? 'PRJ.YES' : 'PRJ.NO'),
        customCellTemplate: this.postedTpl(),
      },
    ];
  });
  protected readonly error = signal<unknown>(null);
  protected taxRate: number | null = 22;
  protected upToDate = '';
  protected accountingDate = '';
  protected overrideCompletion: number | null = null;

  protected billTimeAndMaterials(): void {
    if (this.taxRate === null) {
      return;
    }
    this.error.set(null);
    this.api.billTimeAndMaterials(this.projectId(), { tax_rate: this.taxRate, up_to_date: this.upToDate || null }).subscribe({
      next: (res) => this.message.success(`${this.i18n.translate('PRJ.INVOICE_CREATED')} ${res.data.invoice_number ?? ''}`),
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected runRecognition(): void {
    this.error.set(null);
    this.api
      .runRevenueRecognition(this.projectId(), {
        accounting_period_date: this.accountingDate,
        override_completion_percentage: this.overrideCompletion,
      })
      .subscribe({
        next: () => {
          this.message.success(this.i18n.translate('PRJ.RECOGNITION_DONE'));
          this.load();
        },
        error: (err: unknown) => this.error.set(err),
      });
  }

  private load(): void {
    this.grid.reload();
  }
}
