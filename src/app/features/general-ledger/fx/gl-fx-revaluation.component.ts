import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, FxRevaluation, GeneralLedgerApiService, I18nService, PermissionsService } from '@core';
import { MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlLookupStore } from '../shared/gl-lookup.store';

@Component({
  selector: 'app-gl-fx-revaluation',
  styleUrl: './gl-fx-revaluation.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzTableModule,
    NzTagModule,
    GlErrorAlertComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './gl-fx-revaluation.component.html',
})
export class GlFxRevaluationComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(GlLookupStore);
  protected readonly accountingCurrency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly items = signal<FxRevaluation[]>([]);
  protected readonly loading = signal(false);
  protected readonly running = signal(false);
  protected readonly error = signal<unknown>(null);

  protected revaluationDate = '';
  protected currency = '';

  ngOnInit(): void {
    this.lookups.load();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getFxRevaluations(this.revaluationDate || undefined).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
          this.load();
        },
        error: (err: unknown) => {
          this.running.set(false);
          this.error.set(err);
        },
      });
  }
}
