import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  I18nService,
  ITALIAN_VAT_ENTRY_REGISTERS,
  ItalianVatApiService,
  ItalianVatEntryRegisterType,
  ItalianVatPrint,
  ItalianVatPrintVerification,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { downloadBlob, rangeEndsBeforeStart } from '../general-ledger/shared/gl-dates';
import { ItalianVatGoodsPanelComponent } from './italian-vat-goods-panel.component';
import { ItalianVatVentilationPanelComponent } from './italian-vat-ventilation-panel.component';
import { ItalianVatStore } from './italian-vat.store';
import { currentYear, problemIssue, problemKey } from './italian-vat.util';

/** Sales, purchases and daily-receipts registers by sezionale, with pro-rata, nature totals, definitive print, ventilation and third-party goods. */
@Component({
  selector: 'app-italian-vat-registers',
  styleUrl: '../general-ledger/localization/gl-localization.scss',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    ItalianVatGoodsPanelComponent,
    ItalianVatVentilationPanelComponent,
  ],
  template: `
    <app-page-header [title]="'PAGE_TITLE.ITALIAN_VAT_REGISTERS' | translate" />
    <nz-tabs nzLazy>
      <nz-tab [nzTitle]="'italianVat.ui.tabRegisters' | translate">
        <nz-card>
          <div class="filters">
            <nz-select
              class="select-sm"
              data-testid="register-type"
              [attr.aria-label]="'italianVat.ui.register' | translate"
              [ngModel]="registerType()"
              (ngModelChange)="setType($event)"
            >
              @for (type of types; track type) {
                <nz-option
                  [nzValue]="type"
                  [nzLabel]="'italianVat.registerType.' + type | translate"
                />
              }
            </nz-select>
            <nz-select
              class="select-sm"
              data-testid="section"
              [nzPlaceHolder]="'italianVat.ui.section' | translate"
              [ngModel]="sectionId()"
              (ngModelChange)="sectionId.set($event)"
            >
              @for (section of store.sections(); track section.id) {
                <nz-option [nzValue]="section.id" [nzLabel]="section.code + ' - ' + section.name" />
              }
            </nz-select>
            <label for="iv-from">{{ 'GL.FROM' | translate }}</label>
            <input
              class="date-input"
              id="iv-from"
              nz-input
              type="date"
              [ngModel]="from()"
              (ngModelChange)="from.set($event)"
            />
            <label for="iv-to">{{ 'GL.TO' | translate }}</label>
            <input
              class="date-input"
              id="iv-to"
              nz-input
              type="date"
              [ngModel]="to()"
              (ngModelChange)="to.set($event)"
            />
            <button
              nz-button
              nzType="primary"
              type="button"
              data-testid="load"
              [disabled]="!sectionId() || rangeInvalid()"
              [nzLoading]="store.loading()"
              (click)="load()"
            >
              {{ 'GL.RUN_REPORT' | translate }}
            </button>
            @if (rangeInvalid()) {
              <span class="ant-form-item-explain-error" role="alert">{{
                'COMMON.VALIDATION.END_AFTER_START' | translate
              }}</span>
            }
          </div>

          @if (registerType() === 'purchases' && store.proRata(); as proRata) {
            <nz-alert
              nzType="info"
              nzShowIcon
              data-testid="pro-rata"
              [nzMessage]="
                'italianVat.ui.proRataInForce'
                  | translate: { percent: proRata.percentage_in_force ?? 100 }
              "
            />
          }

          @if (store.register(); as register) {
            <div class="filters">
              @if (store.registerLocked()) {
                <nz-tag nzColor="green" data-testid="locked">{{
                  'italianVat.register.locked' | translate
                }}</nz-tag>
              }
              <button nz-button type="button" data-testid="print-view" (click)="printView()">
                {{ 'italianVat.ui.printView' | translate }}
              </button>
              <button
                nz-button
                nzType="primary"
                nzDanger
                type="button"
                data-testid="definitive-print"
                nz-popconfirm
                [nzPopconfirmTitle]="'italianVat.register.printConfirm' | translate"
                [nzLoading]="store.saving()"
                [disabled]="rangeInvalid()"
                (nzOnConfirm)="definitivePrint()"
              >
                {{ 'italianVat.register.print' | translate }}
              </button>
            </div>

            <nz-table nzSize="small" [nzData]="register.entries" [nzPageSize]="50">
              <thead>
                <tr>
                  <th>{{ 'italianVat.register.protocol' | translate }}</th>
                  <th>{{ 'GL.COL_DATE' | translate }}</th>
                  <th>{{ 'GL.COL_DOCUMENT' | translate }}</th>
                  <th>{{ 'italianVat.ui.documentKind' | translate }}</th>
                  <th>{{ 'GL.COL_PARTNER' | translate }}</th>
                  <th nzAlign="right">{{ 'italianVat.register.taxable' | translate }}</th>
                  <th nzAlign="right">{{ 'GL.COL_VAT_RATE' | translate }}</th>
                  <th nzAlign="right">{{ 'italianVat.register.vat' | translate }}</th>
                  <th>{{ 'italianVat.ui.nature' | translate }}</th>
                  @if (registerType() === 'purchases') {
                    <th nzAlign="right">{{ 'italianVat.register.deductibleVat' | translate }}</th>
                    <th nzAlign="right">
                      {{ 'italianVat.register.nonDeductibleVat' | translate }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (entry of register.entries; track entry.id) {
                  <tr>
                    <td>{{ entry.protocol_number }}</td>
                    <td>{{ entry.entry_date }}</td>
                    <td>{{ entry.document_number }}</td>
                    <td>
                      {{
                        entry.document_kind
                          ? ('italianVat.documentKind.' + entry.document_kind | translate)
                          : ''
                      }}
                    </td>
                    <td>{{ entry.counterparty_name }}</td>
                    <td nzAlign="right">{{ entry.taxable_amount | money: currency() }}</td>
                    <td nzAlign="right">{{ entry.vat_rate }}%</td>
                    <td nzAlign="right">{{ entry.vat_amount | money: currency() }}</td>
                    <td>{{ entry.vat_nature }}</td>
                    @if (registerType() === 'purchases') {
                      <td nzAlign="right">{{ entry.deductible_vat | money: currency() }}</td>
                      <td nzAlign="right">{{ entry.non_deductible_vat | money: currency() }}</td>
                    }
                  </tr>
                }
              </tbody>
            </nz-table>

            <p class="totals" data-testid="totals">
              <strong>
                {{ 'italianVat.register.taxable' | translate }}:
                {{ register.totals.taxable | money: currency() }} -
                {{ 'italianVat.register.vat' | translate }}:
                {{ register.totals.vat | money: currency() }}
                @if (registerType() === 'purchases') {
                  - {{ 'italianVat.register.deductibleVat' | translate }}:
                  {{ register.totals.deductible_vat | money: currency() }} -
                  {{ 'italianVat.register.nonDeductibleVat' | translate }}:
                  {{ register.totals.non_deductible_vat | money: currency() }}
                }
              </strong>
            </p>

            <div class="breakdowns">
              <nz-table
                nzSize="small"
                [nzData]="register.by_rate"
                [nzShowPagination]="false"
                data-testid="by-rate"
              >
                <thead>
                  <tr>
                    <th>{{ 'italianVat.register.byRate' | translate }}</th>
                    <th nzAlign="right">{{ 'italianVat.register.taxable' | translate }}</th>
                    <th nzAlign="right">{{ 'italianVat.register.vat' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of register.by_rate; track row.rate) {
                    <tr>
                      <td>{{ row.rate }}%</td>
                      <td nzAlign="right">{{ row.taxable | money: currency() }}</td>
                      <td nzAlign="right">{{ row.vat | money: currency() }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
              <nz-table
                nzSize="small"
                [nzData]="register.by_nature"
                [nzShowPagination]="false"
                data-testid="by-nature"
              >
                <thead>
                  <tr>
                    <th>{{ 'italianVat.register.byNature' | translate }}</th>
                    <th nzAlign="right">{{ 'italianVat.register.taxable' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of register.by_nature; track row.nature) {
                    <tr>
                      <td>{{ row.nature }}</td>
                      <td nzAlign="right">{{ row.taxable | money: currency() }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </div>

            <h3>{{ 'italianVat.ui.prints' | translate }}</h3>
            <nz-table
              nzSize="small"
              [nzData]="store.prints()"
              [nzShowPagination]="false"
              data-testid="prints"
            >
              <thead>
                <tr>
                  <th>{{ 'italianVat.ui.period' | translate }}</th>
                  <th>{{ 'italianVat.register.protocol' | translate }}</th>
                  <th>{{ 'italianVat.register.pages' | translate }}</th>
                  <th>{{ 'italianVat.register.stamp' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (print of store.prints(); track print.id) {
                  <tr>
                    <td>{{ print.period_from }} - {{ print.period_to }}</td>
                    <td>{{ print.first_protocol }} - {{ print.last_protocol }}</td>
                    <td>{{ print.page_from }} - {{ print.page_to }}</td>
                    <td>{{ print.stamp_reference }}</td>
                    <td>
                      <button
                        nz-button
                        nzSize="small"
                        type="button"
                        [attr.data-testid]="'verify-' + print.id"
                        (click)="verify(print)"
                      >
                        {{ 'italianVat.register.verify' | translate }}
                      </button>
                      <button nz-button nzSize="small" type="button" (click)="downloadPdf(print)">
                        {{ 'italianVat.cu.pdf' | translate }}
                      </button>
                      @if (verifications()[print.id]; as result) {
                        <nz-tag
                          [nzColor]="result.intact ? 'green' : 'red'"
                          [attr.data-testid]="'verification-' + print.id"
                        >
                          {{
                            (result.intact
                              ? 'italianVat.register.intact'
                              : 'italianVat.register.altered'
                            ) | translate
                          }}
                        </nz-tag>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-card>
      </nz-tab>
      <nz-tab [nzTitle]="'italianVat.receipts.ventilation' | translate"
        ><app-italian-vat-ventilation-panel
      /></nz-tab>
      <nz-tab [nzTitle]="'italianVat.registerType.third_party_goods' | translate"
        ><app-italian-vat-goods-panel
      /></nz-tab>
    </nz-tabs>
  `,
  styles: `
    .breakdowns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
  `,
})
export class ItalianVatRegistersComponent {
  protected readonly store = inject(ItalianVatStore);
  private readonly api = inject(ItalianVatApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly types = ITALIAN_VAT_ENTRY_REGISTERS;
  protected readonly registerType = signal<ItalianVatEntryRegisterType>('sales');
  protected readonly sectionId = signal<string | null>(null);
  protected readonly from = signal(`${currentYear()}-01-01`);
  protected readonly to = signal(`${currentYear()}-12-31`);
  protected readonly verifications = signal<Record<string, ItalianVatPrintVerification>>({});
  protected readonly rangeInvalid = computed(() => rangeEndsBeforeStart(this.from(), this.to()));

  constructor() {
    void this.store.loadSections('sales');
    effect(() => {
      const sections = this.store.sections();
      if (this.sectionId() === null && sections.length > 0) {
        this.sectionId.set(sections[0]!.id);
      }
    });
  }

  protected setType(type: ItalianVatEntryRegisterType): void {
    this.registerType.set(type);
    this.sectionId.set(null);
    void this.store.loadSections(type);
    if (type === 'purchases') {
      void this.store.loadProRata(currentYear());
    }
  }

  protected async load(): Promise<void> {
    const id = this.sectionId();
    if (id) {
      await this.store.loadRegister(id, { from: this.from(), to: this.to() });
    }
  }

  protected printView(): void {
    window.print();
  }

  protected async definitivePrint(): Promise<void> {
    const id = this.sectionId();
    if (!id) {
      return;
    }
    const year = Number(this.to().slice(0, 4));
    if (await this.store.printRegister(id, year, { from: this.from(), to: this.to() })) {
      this.message.success(this.i18n.translate('italianVat.register.printed'));
    } else {
      this.reportError();
    }
  }

  protected verify(print: ItalianVatPrint): void {
    this.api
      .verifyPrint(print.id)
      .subscribe((response) =>
        this.verifications.update((all) => ({ ...all, [print.id]: response.data })),
      );
  }

  protected downloadPdf(print: ItalianVatPrint): void {
    this.api
      .downloadPrintPdf(print.id)
      .subscribe((blob) =>
        downloadBlob(blob, `vat-register-${print.period_from}-${print.period_to}.pdf`),
      );
  }

  private reportError(): void {
    const issue = problemIssue(this.store.error());
    if (issue) {
      this.message.error(this.i18n.translate(problemKey(issue), issue.params));
    }
  }
}
