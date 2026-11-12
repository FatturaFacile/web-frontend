import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, I18nService, PermissionsService, ProjectControlApiService, ProjectRevenueRecognition } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../../general-ledger/shared/gl-error-alert.component';

/** Time and materials billing, billing runs and revenue recognition of a project. */
@Component({
  selector: 'app-pc-billing',
  styleUrl: './pc-billing.component.scss',
  imports: [FormsModule, NzButtonModule, NzCardModule, NzInputModule, NzInputNumberModule, NzTableModule, NzTagModule, GlErrorAlertComponent, MoneyPipe, TranslatePipe],
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

    <nz-table #recognitionTable nzSize="small" [nzData]="recognitions()" [nzPageSize]="10">
      <thead>
        <tr>
          <th>{{ 'PRJ.ACCOUNTING_DATE' | translate }}</th>
          <th nzAlign="right">{{ 'PRJ.COMPLETION' | translate }}</th>
          <th nzAlign="right">{{ 'PRJ.PERIOD_REVENUE' | translate }}</th>
          <th nzAlign="right">{{ 'PRJ.CUMULATIVE_REVENUE' | translate }}</th>
          <th nzAlign="right">{{ 'PRJ.CONTRACT_ASSET' | translate }}</th>
          <th>{{ 'PRJ.POSTED_TO_GL' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (run of recognitionTable.data; track run.id) {
          <tr>
            <td>{{ run.accounting_period_date }}</td>
            <td nzAlign="right">{{ run.completion_percentage }}%</td>
            <td nzAlign="right">{{ run.period_revenue | money: currency() }}</td>
            <td nzAlign="right">{{ run.cumulative_recognized_revenue | money: currency() }}</td>
            <td nzAlign="right">{{ run.contract_asset_balance | money: currency() }}</td>
            <td>{{ (run.is_posted_to_gl ? 'PRJ.YES' : 'PRJ.NO') | translate }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class PcBillingComponent implements OnInit {
  readonly projectId = input.required<string>();

  private readonly api = inject(ProjectControlApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly recognitions = signal<ProjectRevenueRecognition[]>([]);
  protected readonly error = signal<unknown>(null);
  protected taxRate: number | null = 22;
  protected upToDate = '';
  protected accountingDate = '';
  protected overrideCompletion: number | null = null;

  ngOnInit(): void {
    this.load();
  }

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
    this.api.getRevenueRecognitions(this.projectId()).subscribe({ next: (res) => this.recognitions.set(res.data ?? []) });
  }
}
