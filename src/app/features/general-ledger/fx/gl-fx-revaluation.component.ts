import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  FetchGridModel,
  FxRevaluation,
  GeneralLedgerApiService,
  I18nService,
  PermissionsService,
  QueryFilterParams,
} from '@core';
import { BaseTableComponent, MoneyPipe, TableColumnDef, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlLookupStore } from '../shared/gl-lookup.store';

interface FxGridFilter extends QueryFilterParams {
  revaluation_date?: string;
}

@Component({
  selector: 'app-gl-fx-revaluation',
  styleUrl: './gl-fx-revaluation.component.scss',
  imports: [
    BaseTableComponent,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzTagModule,
    GlErrorAlertComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './gl-fx-revaluation.component.html',
})
export class GlFxRevaluationComponent {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(GlLookupStore);
  protected readonly accountingCurrency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly grid = new FetchGridModel<FxRevaluation, FxGridFilter>((query) => this.api.getFxRevaluations(query));
  protected readonly running = signal(false);
  protected readonly error = signal<unknown>(null);

  protected revaluationDate = '';
  protected currency = '';

  private readonly sideTpl = viewChild<TemplateRef<{ $implicit: FxRevaluation; value: unknown }>>('sideTpl');
  private readonly accountTpl = viewChild<TemplateRef<{ $implicit: FxRevaluation; value: unknown }>>('accountTpl');
  private readonly openAmountTpl = viewChild<TemplateRef<{ $implicit: FxRevaluation; value: unknown }>>('openAmountTpl');
  private readonly bookValueTpl = viewChild<TemplateRef<{ $implicit: FxRevaluation; value: unknown }>>('bookValueTpl');
  private readonly revaluedTpl = viewChild<TemplateRef<{ $implicit: FxRevaluation; value: unknown }>>('revaluedTpl');
  private readonly differenceTpl = viewChild<TemplateRef<{ $implicit: FxRevaluation; value: unknown }>>('differenceTpl');

  protected readonly columns = computed<TableColumnDef<FxRevaluation>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'revaluation_date', header: 'GL.COL_DATE' },
      {
        key: 'side',
        header: 'GL.FX_SIDE',
        valueLabel: (value) => this.i18n.translate('GL.FX_SIDE_' + value.toUpperCase()),
        customCellTemplate: this.sideTpl(),
      },
      {
        key: 'account_id',
        header: 'GL.COL_ACCOUNT',
        valueLabel: (value) => this.lookups.accountLabel(value),
        customCellTemplate: this.accountTpl(),
      },
      { key: 'currency', header: 'GL.FX_CURRENCY' },
      { key: 'closing_rate', header: 'GL.FX_CLOSING_RATE', align: 'right' },
      { key: 'open_amount', header: 'GL.FX_OPEN_AMOUNT', align: 'right', customCellTemplate: this.openAmountTpl() },
      { key: 'book_value', header: 'GL.FX_BOOK_VALUE', align: 'right', customCellTemplate: this.bookValueTpl() },
      { key: 'revalued_value', header: 'GL.FX_REVALUED_VALUE', align: 'right', customCellTemplate: this.revaluedTpl() },
      { key: 'difference', header: 'GL.FX_DIFFERENCE', align: 'right', customCellTemplate: this.differenceTpl() },
      { key: 'open_items', header: 'GL.FX_ITEMS', align: 'right' },
    ];
  });

  constructor() {
    this.lookups.load();
  }

  protected load(): void {
    this.grid.setFilter({ revaluation_date: this.revaluationDate || undefined });
  }

  protected run(): void {
    if (!this.revaluationDate) {
      return;
    }
    this.error.set(null);
    this.running.set(true);
    this.api
      .runFxRevaluation({
        revaluation_date: this.revaluationDate,
        currency: this.currency.trim().toUpperCase() || null,
      })
      .subscribe({
        next: () => {
          this.running.set(false);
          this.message.success(this.i18n.translate('GL.FX_DONE'));
          this.grid.reload();
        },
        error: (err: unknown) => {
          this.running.set(false);
          this.error.set(err);
        },
      });
  }
}
