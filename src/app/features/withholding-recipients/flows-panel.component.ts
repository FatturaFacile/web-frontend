import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { downloadBlob, MoneyPipe, TranslatePipe } from '@shared';
import { FlowFile, SettlementsStore } from './settlements.store';
import { f24CodeLabel, groupF24Lines, isMonthParam } from './withholding-recipients.util';

/**
 * F24 and UniEmens flows of a month (settle ability): the F24 lines grouped by section and tax code (1040 withholdings on
 * self-employment, royalties, occasional work and sport fees; 1038 agent commissions; C10 INPS separate management) with the
 * due date and a CSV export, and the UniEmens XML of the month.
 */
@Component({
  selector: 'app-wr-flows-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSpinModule,
    NzTableModule,
  ],
  template: `
    <div class="toolbar">
      <label class="field" for="wr-flow-month">
        <span>{{ 'withholdingRecipients.field.accrualMonth' | translate }}</span>
        <input
          nz-input
          id="wr-flow-month"
          type="month"
          [ngModel]="store.flowMonth()"
          (ngModelChange)="store.setFlowMonth($event)"
        />
      </label>
      <button
        nz-button
        nzType="primary"
        type="button"
        [disabled]="!monthValid()"
        [nzLoading]="store.f24Loading()"
        (click)="store.loadF24()"
      >
        {{ 'withholdingRecipients.flows.preview' | translate }}
      </button>
      <button
        nz-button
        type="button"
        [disabled]="!monthValid()"
        [nzLoading]="store.exporting() === 'f24'"
        (click)="download(store.exportF24())"
      >
        {{ 'withholdingRecipients.flows.exportF24' | translate }}
      </button>
      <button
        nz-button
        type="button"
        [disabled]="!monthValid()"
        [nzLoading]="store.exporting() === 'uniemens'"
        (click)="download(store.exportUniEmens())"
      >
        {{ 'withholdingRecipients.flows.exportUniEmens' | translate }}
      </button>
    </div>

    <p class="hint">{{ 'withholdingRecipients.flows.hint' | translate }}</p>

    <nz-spin [nzSpinning]="store.f24Loading()">
      @if (store.f24(); as f24) {
        <p class="due">
          {{ 'withholdingRecipients.flows.dueDate' | translate }}:
          <strong>{{ f24.due_date ?? '' }}</strong>
        </p>
        @for (group of groups(); track group.section) {
          <h4 class="title">
            {{ 'withholdingRecipients.f24.section.' + group.section | translate }}
          </h4>
          <nz-table nzSize="small" [nzData]="group.lines" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'withholdingRecipients.flows.taxCode' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'withholdingRecipients.flows.settlements' | translate }}
                </th>
                <th scope="col" class="num">
                  {{ 'withholdingRecipients.flows.amount' | translate }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (line of group.lines; track line.tax_code + line.reference_month) {
                <tr>
                  <th scope="row">
                    {{ codeLabel(line.tax_code, line.reference_month, line.reference_year) }}
                    <small class="muted">{{
                      'withholdingRecipients.f24.code.' + line.tax_code | translate
                    }}</small>
                  </th>
                  <td class="num">{{ line.settlements }}</td>
                  <td class="num">{{ line.amount | money: 'EUR' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
        @if (f24.lines.length === 0) {
          <nz-empty
            [nzNotFoundContent]="'withholdingRecipients.flows.empty' | translate"
          ></nz-empty>
        } @else {
          <p class="total">
            {{ 'withholdingRecipients.flows.total' | translate }}:
            <strong>{{ f24.total | money: 'EUR' }}</strong>
          </p>
        }
      }
    </nz-spin>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 12px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .hint {
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .title {
      margin: 16px 0 8px;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .muted {
      display: block;
      font-weight: normal;
      color: var(--ant-text-color-secondary, #595959);
    }

    .total {
      margin-top: 12px;
      text-align: right;
      font-size: 15px;
    }
  `,
})
export class FlowsPanelComponent implements OnInit {
  readonly store = inject(SettlementsStore);

  readonly monthValid = computed(() => isMonthParam(this.store.flowMonth()));
  readonly groups = computed(() => groupF24Lines(this.store.f24()?.lines ?? []));
  readonly codeLabel = f24CodeLabel;

  ngOnInit(): void {
    void this.store.loadF24();
  }

  /** Hands the file to the browser; a refusal is already in the store (`error`). */
  async download(request: Promise<FlowFile>): Promise<void> {
    const file = await request;
    if (file.ok && file.blob) {
      downloadBlob(file.blob, file.filename);
    }
  }
}
