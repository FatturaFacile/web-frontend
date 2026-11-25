import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GdtAccrualRun, PermissionsService, TranslateService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { AccrualsStore } from './accruals.store';
import { GDO_TRADE_TERMS_FINANCE_MODULE, GdtOutcome, num, percentText } from './gdo-trade-terms.util';

/**
 * Monthly accruals (ratei mensili): what a month would add to the provision, the closing that posts it
 * (Dr rebates expense / Cr credit notes to be issued), the ledger of every run and the reversal of the latest one.
 */
@Component({
  selector: 'app-gdt-accruals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [AccrualsStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_ACCRUALS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="gdt-a-period">
        <span>{{ 'gdoTradeTerms.field.month' | translate }}</span>
        <input nz-input id="gdt-a-period" type="month" [ngModel]="store.period()" (ngModelChange)="store.setPeriod($event)" />
      </label>
      <button nz-button type="button" [nzLoading]="store.working()" (click)="preview()">
        {{ 'gdoTradeTerms.action.preview' | translate }}
      </button>
      @if (canSettle) {
        <button
          nz-button
          nzType="primary"
          type="button"
          nz-popconfirm
          [nzPopconfirmTitle]="'gdoTradeTerms.confirm.accrue' | translate"
          [nzOkText]="'gdoTradeTerms.action.confirm' | translate"
          [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
          (nzOnConfirm)="run(false)"
        >
          {{ 'gdoTradeTerms.action.accrue' | translate }}
        </button>
        <button
          nz-button
          type="button"
          nz-popconfirm
          [nzPopconfirmTitle]="'gdoTradeTerms.confirm.recalculate' | translate"
          [nzOkText]="'gdoTradeTerms.action.confirm' | translate"
          [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
          (nzOnConfirm)="run(true)"
        >
          {{ 'gdoTradeTerms.action.recalculate' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="(failure.errorKey ?? 'gdoTradeTerms.error.generic') | translate: failure.params"
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    @if (store.preview(); as preview) {
      <nz-card class="main-card" [nzTitle]="('gdoTradeTerms.section.preview' | translate) + ' ' + preview.period_key">
        <nz-table #previewTable nzSize="small" [nzData]="store.previewLines()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'gdoTradeTerms.field.contract' | translate }}</th>
              <th scope="col">{{ 'gdoTradeTerms.field.source' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.base' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.earnedCumulative' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.previouslyAccrued' | translate }}</th>
              <th scope="col" class="num">{{ 'gdoTradeTerms.field.delta' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of previewTable.data; track line.source_id) {
              <tr>
                <td>{{ line.contract_code }}</td>
                <td>
                  <nz-tag>{{ 'gdoTradeTerms.sourceType.' + line.source_type | translate }}</nz-tag>
                  {{ line.source_label }}
                </td>
                <td class="num">{{ line.base_value | money: line.currency }}</td>
                <td class="num">{{ line.earned_cumulative | money: line.currency }}</td>
                <td class="num">{{ line.previously_accrued | money: line.currency }}</td>
                <td class="num" [class.negative]="isNegative(line.delta_amount)">{{ line.delta_amount | money: line.currency }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6"><nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.preview' | translate"></nz-empty></td>
              </tr>
            }
          </tbody>
        </nz-table>
        <p><strong>{{ 'gdoTradeTerms.field.totalAccrued' | translate }}: {{ preview.total_accrued | money }}</strong></p>
      </nz-card>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #table nzSize="small" [nzData]="store.runs()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'gdoTradeTerms.field.month' | translate }}</th>
            <th scope="col" class="num">{{ 'gdoTradeTerms.field.totalAccrued' | translate }}</th>
            <th scope="col" class="num">{{ 'gdoTradeTerms.field.contracts' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.status' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.postedAt' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (run of table.data; track run.id) {
            <tr>
              <th scope="row">{{ run.period_key }}</th>
              <td class="num">{{ run.total_accrued | money }}</td>
              <td class="num">{{ run.contracts_count }}</td>
              <td>
                <nz-tag [nzColor]="run.status === 'posted' ? 'green' : 'default'">{{ 'gdoTradeTerms.runStatus.' + run.status | translate }}</nz-tag>
              </td>
              <td>{{ run.posted_at?.slice(0, 10) }}</td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="store.open(run.id)">
                  {{ 'gdoTradeTerms.action.ledger' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6"><nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.runs' | translate"></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      nzPlacement="right"
      nzWidth="900"
      [nzVisible]="store.selected() !== null"
      [nzTitle]="('gdoTradeTerms.section.ledger' | translate) + ' ' + (store.selected()?.period_key ?? '')"
      (nzOnClose)="store.close()"
    >
      <ng-container *nzDrawerContent>
        @if (store.selected(); as run) {
          <p>
            <nz-tag [nzColor]="run.status === 'posted' ? 'green' : 'default'">{{ 'gdoTradeTerms.runStatus.' + run.status | translate }}</nz-tag>
            {{ 'gdoTradeTerms.field.totalAccrued' | translate }}: <strong>{{ run.total_accrued | money }}</strong>
          </p>
          @if (run.reversal_reason) {
            <p class="muted">{{ 'gdoTradeTerms.field.reversalReason' | translate }}: {{ run.reversal_reason }}</p>
          }
          <nz-table #ledger nzSize="small" [nzData]="run.lines ?? []" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'gdoTradeTerms.field.contract' | translate }}</th>
                <th scope="col">{{ 'gdoTradeTerms.field.source' | translate }}</th>
                <th scope="col" class="num">{{ 'gdoTradeTerms.field.earnedCumulative' | translate }}</th>
                <th scope="col" class="num">{{ 'gdoTradeTerms.field.previouslyAccrued' | translate }}</th>
                <th scope="col" class="num">{{ 'gdoTradeTerms.field.delta' | translate }}</th>
                <th scope="col">{{ 'gdoTradeTerms.field.rate' | translate }}</th>
                <th scope="col">{{ 'gdoTradeTerms.field.status' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of ledger.data; track line.id) {
                <tr>
                  <td>{{ line.contract_code }}</td>
                  <td>
                    <nz-tag>{{ 'gdoTradeTerms.sourceType.' + line.source_type | translate }}</nz-tag>
                    {{ line.source_label }}
                  </td>
                  <td class="num">{{ line.earned_cumulative | money: line.currency }}</td>
                  <td class="num">{{ line.previously_accrued | money: line.currency }}</td>
                  <td class="num" [class.negative]="isNegative(line.delta_amount)">{{ line.delta_amount | money: line.currency }}</td>
                  <td>{{ line.applied_rate_percent ? pct(line.applied_rate_percent) : '' }}</td>
                  <td>{{ line.status ? ('gdoTradeTerms.lineStatus.' + line.status | translate) : '' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>

          @if (canSettle && run.id === store.latestPostedId()) {
            <div class="section-title">{{ 'gdoTradeTerms.action.reverse' | translate }}</div>
            <label class="field" for="gdt-a-reason">
              <span>{{ 'gdoTradeTerms.field.reason' | translate }}</span>
              <input nz-input id="gdt-a-reason" maxlength="500" [ngModel]="reason()" (ngModelChange)="reason.set($event)" />
            </label>
            <div class="actions">
              <button
                nz-button
                nzDanger
                type="button"
                nz-popconfirm
                [disabled]="reason().trim() === ''"
                [nzPopconfirmTitle]="'gdoTradeTerms.confirm.reverse' | translate"
                [nzOkText]="'gdoTradeTerms.action.confirm' | translate"
                [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
                (nzOnConfirm)="reverse(run)"
              >
                {{ 'gdoTradeTerms.action.reverse' | translate }}
              </button>
            </div>
          }
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class AccrualsComponent implements OnInit {
  protected readonly store = inject(AccrualsStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canSettle = inject(PermissionsService).canWrite(GDO_TRADE_TERMS_FINANCE_MODULE);
  protected readonly feedback = signal<GdtOutcome | null>(null);
  protected readonly reason = signal('');
  protected pct = percentText;

  ngOnInit(): void {
    void this.store.load();
  }

  protected isNegative(value: string): boolean {
    return num(value) < 0;
  }

  protected async preview(): Promise<void> {
    const outcome = await this.store.runPreview();
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async run(recalculate: boolean): Promise<void> {
    const outcome = await this.store.run(recalculate);
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('gdoTradeTerms.message.accrued'));
    }
  }

  protected async reverse(run: GdtAccrualRun): Promise<void> {
    const outcome = await this.store.reverse(run.id, this.reason().trim());
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.reason.set('');
      this.message.success(this.i18n.instant('gdoTradeTerms.message.reversed'));
    }
  }
}
