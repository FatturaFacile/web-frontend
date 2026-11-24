import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PermissionsService } from '@core';
import { TranslatePipe, RadioControlDirective } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { EditorLine, LineSelectionMode, QuoteLineType } from './cpq-quotes.models';
import { isPriced } from './cpq-quotes.utils';
import { QuoteEditorStore } from './quote-editor.store';

/**
 * Back-office CPQ quote builder (`/cpq-quotes/:id`, `/cpq-quotes/new`). Signals recompute the totals, the VAT breakdown and the
 * margin on every keystroke; sections and lines are reordered by drag and drop (also across sections); each line is mandatory,
 * optional or part of an alternative group; unit costs and margins live in a drawer only the authorized roles see. A revision
 * that left the draft states is read-only: it offers a new revision, or the conversion once accepted.
 */
@Component({
  selector: 'app-quote-editor',
  providers: [QuoteEditorStore],
  imports: [
    RadioControlDirective,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-spin [nzSpinning]="store.loading()">
      <nz-card [nzTitle]="title()">
        <div class="bar" data-test="bar">
          <nz-tag data-test="status">{{
            'CPQ_QUOTES.STATUS_' + store.status().toUpperCase() | translate
          }}</nz-tag>
          @if (store.quote(); as q) {
            <a [routerLink]="['/cpq-quotes', q.id, 'compare']" data-test="history">{{
              'CPQ_QUOTES.HISTORY' | translate
            }}</a>
          }
          <span class="spacer"></span>
          @if (canSeeCosts()) {
            <button nz-button type="button" data-test="margin" (click)="marginOpen.set(true)">
              {{ 'CPQ_QUOTES.MARGIN_DRAWER' | translate }}
            </button>
          }
          @if (store.editable()) {
            <button
              nz-button
              type="button"
              data-test="save"
              [nzLoading]="store.saving()"
              [disabled]="!store.dirty()"
              (click)="save()"
            >
              {{ 'CPQ_QUOTES.SAVE' | translate }}
            </button>
            @if (store.quote()) {
              <button
                nz-button
                nzType="primary"
                type="button"
                data-test="issue"
                [disabled]="store.dirty() || store.saving()"
                (click)="store.issue({ use_pin: usePin() })"
              >
                {{ 'CPQ_QUOTES.ISSUE' | translate }}
              </button>
              @if (store.belowMarginGuardrail() && canApprove()) {
                <button
                  nz-button
                  type="button"
                  data-test="approve"
                  [disabled]="store.dirty() || store.saving()"
                  (click)="store.issue({ use_pin: usePin(), approve: true })"
                >
                  {{ 'CPQ_QUOTES.APPROVE_AND_ISSUE' | translate }}
                </button>
              }
              <nz-switch
                [ngModel]="usePin()"
                (ngModelChange)="usePin.set($event)"
                data-test="use-pin"
                [attr.aria-label]="'CPQ_QUOTES.USE_PIN' | translate"
              />
              <span>{{ 'CPQ_QUOTES.USE_PIN' | translate }}</span>
            }
          }
          @if (store.canRevise()) {
            <button
              nz-button
              type="button"
              data-test="revise"
              [nzLoading]="store.saving()"
              (click)="revise()"
            >
              {{ 'CPQ_QUOTES.NEW_REVISION' | translate }}
            </button>
          }
          @if (store.canConvert()) {
            <button
              nz-button
              nzType="primary"
              type="button"
              data-test="to-order"
              (click)="convert('order')"
            >
              {{ 'CPQ_QUOTES.CONVERT_ORDER' | translate }}
            </button>
            <button nz-button type="button" data-test="to-invoice" (click)="convert('invoice')">
              {{ 'CPQ_QUOTES.CONVERT_INVOICE' | translate }}
            </button>
            <input
              nz-input
              type="number"
              class="small"
              min="1"
              max="100"
              data-test="deposit"
              [ngModel]="deposit()"
              (ngModelChange)="deposit.set($event)"
              [placeholder]="'CPQ_QUOTES.DEPOSIT_PERCENT' | translate"
              [attr.aria-label]="'CPQ_QUOTES.DEPOSIT_PERCENT' | translate"
            />
          }
        </div>

        @if (store.error(); as error) {
          <nz-alert
            nzType="error"
            nzShowIcon
            data-test="error"
            [nzMessage]="error === 'error' ? ('CPQ_QUOTES.ERROR' | translate) : error"
          />
        }
        @if (store.belowMarginGuardrail()) {
          <nz-alert
            nzType="warning"
            nzShowIcon
            data-test="guardrail"
            [nzMessage]="'CPQ_QUOTES.GUARDRAIL' | translate"
          />
        }
        @if (store.issued(); as issued) {
          @if (issued.portal_url) {
            <nz-alert
              nzType="success"
              nzShowIcon
              data-test="issued"
              [nzMessage]="'CPQ_QUOTES.ISSUED' | translate"
              [nzDescription]="issued.portal_url + (issued.pin ? ' PIN ' + issued.pin : '')"
            />
          } @else {
            <nz-alert
              nzType="info"
              nzShowIcon
              data-test="pending"
              [nzMessage]="'CPQ_QUOTES.PENDING_APPROVAL' | translate"
            />
          }
        }

        <fieldset class="header" [disabled]="!store.editable()">
          <label for="q-customer">{{ 'CPQ_QUOTES.CUSTOMER' | translate }}</label>
          <input
            nz-input
            id="q-customer"
            [ngModel]="store.header().customer_name"
            (ngModelChange)="store.patchHeader({ customer_name: $event })"
          />
          <label for="q-email">{{ 'CPQ_QUOTES.CUSTOMER_EMAIL' | translate }}</label>
          <input
            nz-input
            id="q-email"
            type="email"
            [ngModel]="store.header().customer_email"
            (ngModelChange)="store.patchHeader({ customer_email: $event })"
          />
          <label for="q-currency">{{ 'CPQ_QUOTES.CURRENCY' | translate }}</label>
          <nz-select
            id="q-currency"
            [ngModel]="store.header().currency"
            (ngModelChange)="store.patchHeader({ currency: $event })"
          >
            <nz-option nzValue="EUR" nzLabel="EUR" />
            <nz-option nzValue="CHF" nzLabel="CHF" />
          </nz-select>
          <label for="q-jurisdiction">{{ 'CPQ_QUOTES.JURISDICTION' | translate }}</label>
          <nz-select
            id="q-jurisdiction"
            [ngModel]="store.header().jurisdiction"
            (ngModelChange)="store.patchHeader({ jurisdiction: $event })"
          >
            <nz-option nzValue="IT" nzLabel="IT" />
            <nz-option nzValue="CH" nzLabel="CH" />
            <nz-option nzValue="EU" nzLabel="EU" />
          </nz-select>
          <label for="q-discount">{{ 'CPQ_QUOTES.HEADER_DISCOUNT' | translate }}</label>
          <input
            nz-input
            id="q-discount"
            type="number"
            min="0"
            max="100"
            [ngModel]="store.header().header_discount_percent"
            (ngModelChange)="store.patchHeader({ header_discount_percent: num($event) })"
          />
          <label for="q-min-margin">{{ 'CPQ_QUOTES.MIN_MARGIN' | translate }}</label>
          <input
            nz-input
            id="q-min-margin"
            type="number"
            [ngModel]="store.header().min_margin_percent"
            (ngModelChange)="
              store.patchHeader({
                min_margin_percent: $event === null || $event === '' ? null : num($event),
              })
            "
          />
          <label for="q-cover">{{ 'CPQ_QUOTES.COVER_LETTER' | translate }}</label>
          <textarea
            nz-input
            id="q-cover"
            rows="3"
            [ngModel]="store.header().cover_letter"
            (ngModelChange)="store.patchHeader({ cover_letter: $event })"
          ></textarea>
        </fieldset>

        <div
          cdkDropList
          [cdkDropListDisabled]="!store.editable()"
          (cdkDropListDropped)="dropSection($event)"
          data-test="sections"
        >
          @for (section of store.sections(); track section.key) {
            <section
              class="section"
              cdkDrag
              [cdkDragData]="section.key"
              [attr.data-section]="section.key"
            >
              <header class="section-head">
                @if (store.editable()) {
                  <span
                    cdkDragHandle
                    class="handle"
                    role="img"
                    [attr.aria-label]="'CPQ_QUOTES.DRAG_SECTION' | translate"
                    >⠿</span
                  >
                }
                <input
                  nz-input
                  class="grow"
                  [disabled]="!store.editable()"
                  [ngModel]="section.title"
                  (ngModelChange)="store.patchSection(section.key, { title: $event })"
                  [attr.aria-label]="'CPQ_QUOTES.SECTION_TITLE' | translate"
                />
                <input
                  nz-input
                  class="small"
                  type="number"
                  min="0"
                  max="100"
                  [disabled]="!store.editable()"
                  [ngModel]="section.discount_percent"
                  (ngModelChange)="
                    store.patchSection(section.key, { discount_percent: num($event) })
                  "
                  [attr.aria-label]="'CPQ_QUOTES.SECTION_DISCOUNT' | translate"
                />
                <strong data-test="section-subtotal">{{
                  money(store.totals().sectionSubtotals[section.key] ?? 0)
                }}</strong>
                @if (store.editable()) {
                  <button
                    nz-button
                    nzDanger
                    nzSize="small"
                    type="button"
                    (click)="store.removeSection(section.key)"
                  >
                    {{ 'CPQ_QUOTES.REMOVE' | translate }}
                  </button>
                }
              </header>

              <div
                cdkDropList
                class="lines"
                [id]="listId(section.key)"
                [cdkDropListData]="section.key"
                [cdkDropListConnectedTo]="listIds()"
                [cdkDropListDisabled]="!store.editable()"
                (cdkDropListDropped)="dropLine($event)"
              >
                @for (line of store.linesOf(section.key); track line.key) {
                  <div
                    class="line"
                    cdkDrag
                    [cdkDragData]="line.key"
                    [attr.data-line]="line.key"
                    [class.off]="isOff(line)"
                  >
                    @if (store.editable()) {
                      <span
                        cdkDragHandle
                        class="handle"
                        role="img"
                        [attr.aria-label]="'CPQ_QUOTES.DRAG_LINE' | translate"
                        >⠿</span
                      >
                    }
                    <input
                      nz-input
                      class="grow"
                      data-test="description"
                      [disabled]="!store.editable()"
                      [ngModel]="line.description"
                      (ngModelChange)="store.patchLine(line.key, { description: $event })"
                      [attr.aria-label]="'CPQ_QUOTES.DESCRIPTION' | translate"
                    />
                    @if (priced(line.line_type)) {
                      <input
                        nz-input
                        class="small"
                        type="number"
                        min="0"
                        data-test="quantity"
                        [disabled]="!store.editable()"
                        [ngModel]="line.quantity"
                        (ngModelChange)="store.patchLine(line.key, { quantity: num($event) })"
                        [attr.aria-label]="'CPQ_QUOTES.QUANTITY' | translate"
                      />
                      <input
                        nz-input
                        class="small"
                        type="number"
                        min="0"
                        data-test="unit-price"
                        [disabled]="!store.editable()"
                        [ngModel]="line.unit_price"
                        (ngModelChange)="store.patchLine(line.key, { unit_price: num($event) })"
                        [attr.aria-label]="'CPQ_QUOTES.UNIT_PRICE' | translate"
                      />
                      <input
                        nz-input
                        class="small"
                        type="number"
                        min="0"
                        max="100"
                        [disabled]="!store.editable()"
                        [ngModel]="line.discount_percent"
                        (ngModelChange)="
                          store.patchLine(line.key, { discount_percent: num($event) })
                        "
                        [attr.aria-label]="'CPQ_QUOTES.DISCOUNT' | translate"
                      />
                      <input
                        nz-input
                        class="small"
                        type="number"
                        min="0"
                        max="100"
                        [disabled]="!store.editable()"
                        [ngModel]="line.tax_rate"
                        (ngModelChange)="store.patchLine(line.key, { tax_rate: num($event) })"
                        [attr.aria-label]="'CPQ_QUOTES.TAX_RATE' | translate"
                      />
                      <nz-radio-group
                        class="mode"
                        [nzDisabled]="!store.editable()"
                        [ngModel]="line.selection_mode"
                        (ngModelChange)="setMode(line, $event)"
                        [attr.aria-label]="'CPQ_QUOTES.MODE' | translate"
                        nzSize="small"
                      >
                        <label [attr.for]="'quote-mode-mandatory-' + line.key" appRadioControl nz-radio-button nzValue="mandatory" data-test="mode-mandatory">{{
                          'CPQ_QUOTES.MODE_MANDATORY' | translate
                        }}</label>
                        <label [attr.for]="'quote-mode-optional-' + line.key" appRadioControl nz-radio-button nzValue="optional" data-test="mode-optional">{{
                          'CPQ_QUOTES.MODE_OPTIONAL' | translate
                        }}</label>
                        <label [attr.for]="'quote-mode-alternative-' + line.key" appRadioControl
                          nz-radio-button
                          nzValue="alternative_group"
                          data-test="mode-alternative"
                          >{{ 'CPQ_QUOTES.MODE_ALTERNATIVE' | translate }}</label
                        >
                      </nz-radio-group>
                      @if (line.selection_mode === 'optional') {
                        <nz-switch
                          nzSize="small"
                          [nzDisabled]="!store.editable()"
                          [ngModel]="line.is_default_selected"
                          (ngModelChange)="
                            store.patchLine(line.key, { is_default_selected: $event })
                          "
                          [attr.aria-label]="'CPQ_QUOTES.DEFAULT_ON' | translate"
                        />
                      }
                      @if (line.selection_mode === 'alternative_group') {
                        <input
                          nz-input
                          class="small"
                          [disabled]="!store.editable()"
                          [ngModel]="line.alternative_group"
                          (ngModelChange)="store.patchLine(line.key, { alternative_group: $event })"
                          [attr.aria-label]="'CPQ_QUOTES.ALTERNATIVE_GROUP' | translate"
                        />
                        <nz-switch
                          nzSize="small"
                          [nzDisabled]="!store.editable()"
                          [ngModel]="line.is_default_selected"
                          (ngModelChange)="$event && store.chooseDefaultAlternative(line.key)"
                          [attr.aria-label]="'CPQ_QUOTES.DEFAULT_ON' | translate"
                        />
                      }
                      <strong class="net" data-test="line-net">{{
                        money(store.totals().lineNet[line.key] ?? 0)
                      }}</strong>
                    } @else if (line.line_type === 'subtotal') {
                      <strong class="net" data-test="running">{{
                        money(store.totals().runningSubtotal[line.key] ?? 0)
                      }}</strong>
                    }
                    @if (store.editable()) {
                      <button
                        nz-button
                        nzDanger
                        nzSize="small"
                        type="button"
                        (click)="store.removeLine(line.key)"
                      >
                        {{ 'CPQ_QUOTES.REMOVE' | translate }}
                      </button>
                    }
                  </div>
                }
              </div>

              @if (store.editable()) {
                <div class="quick-add" data-test="quick-add">
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    data-test="add-product"
                    (click)="store.addLine('product', section.key)"
                  >
                    {{ 'CPQ_QUOTES.ADD_PRODUCT' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    data-test="add-service"
                    (click)="store.addLine('service_fixed', section.key)"
                  >
                    {{ 'CPQ_QUOTES.ADD_SERVICE' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    data-test="add-hours"
                    (click)="store.addLine('service_time_and_material', section.key)"
                  >
                    {{ 'CPQ_QUOTES.ADD_HOURLY' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    data-test="add-text"
                    (click)="store.addLine('text_note', section.key)"
                  >
                    {{ 'CPQ_QUOTES.ADD_TEXT' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    data-test="add-subtotal"
                    (click)="store.addLine('subtotal', section.key)"
                  >
                    {{ 'CPQ_QUOTES.ADD_SUBTOTAL' | translate }}
                  </button>
                </div>
              }
            </section>
          }
        </div>

        @if (store.editable()) {
          <button nz-button type="button" data-test="add-section" (click)="store.addSection()">
            {{ 'CPQ_QUOTES.ADD_SECTION' | translate }}
          </button>
        }

        <aside class="summary" data-test="summary">
          <div>
            {{ 'CPQ_QUOTES.TOTAL_NET' | translate }}:
            <strong data-test="total-net">{{ money(store.totals().net) }}</strong>
          </div>
          @for (row of store.totals().taxBreakdown; track row.rate) {
            <div data-test="tax-row">
              {{ 'CPQ_QUOTES.TAX_AT' | translate: { rate: row.rate } }}: {{ money(row.tax) }}
            </div>
          }
          @if (store.totals().rounding !== 0) {
            <div>{{ 'CPQ_QUOTES.ROUNDING' | translate }}: {{ money(store.totals().rounding) }}</div>
          }
          <div class="payable">
            {{ 'CPQ_QUOTES.TOTAL_PAYABLE' | translate }}:
            <strong data-test="total-payable">{{ money(store.totals().payable) }}</strong>
            {{ store.header().currency }}
          </div>
        </aside>
      </nz-card>
    </nz-spin>

    <nz-drawer
      [nzVisible]="marginOpen()"
      [nzTitle]="'CPQ_QUOTES.MARGIN_DRAWER' | translate"
      nzPlacement="right"
      [nzWidth]="520"
      (nzOnClose)="marginOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <p data-test="total-margin">
          {{ 'CPQ_QUOTES.TOTAL_COST' | translate }}: {{ money(store.totals().cost) }} ·
          {{ 'CPQ_QUOTES.MARGIN' | translate }}: {{ money(store.totals().margin) }} ({{
            store.totals().marginPercent ?? '-'
          }}%)
        </p>
        @for (line of pricedLines(); track line.key) {
          <div class="margin-row" [attr.data-margin-line]="line.key">
            <span class="grow">{{ line.description }}</span>
            <input
              nz-input
              class="small"
              type="number"
              min="0"
              data-test="unit-cost"
              [disabled]="!store.editable()"
              [ngModel]="line.unit_cost"
              (ngModelChange)="store.patchLine(line.key, { unit_cost: num($event) })"
              [attr.aria-label]="'CPQ_QUOTES.UNIT_COST' | translate"
            />
            <strong data-test="line-margin">{{ lineMargin(line) }}%</strong>
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .bar,
    .section-head,
    .line,
    .quick-add,
    .margin-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .spacer,
    .grow {
      flex: 1 1 200px;
    }
    .small {
      width: 96px;
    }
    .header {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 8px;
      border: 0;
      padding: 0;
      margin-bottom: 16px;
    }
    .section {
      border: 1px solid var(--ant-color-border-secondary, #eee);
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 12px;
      background: var(--ant-color-bg-container, #fff);
    }
    .line.off {
      opacity: 0.6;
    }
    .handle {
      cursor: grab;
      user-select: none;
    }
    .net {
      min-width: 90px;
      text-align: right;
    }
    .summary {
      margin-top: 16px;
      text-align: right;
    }
    .payable {
      font-size: 1.25rem;
    }
    .cdk-drag-preview {
      box-shadow: 0 4px 12px rgb(0 0 0 / 20%);
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
  `,
})
export class QuoteEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionsService);
  protected readonly store = inject(QuoteEditorStore);

  protected readonly marginOpen = signal(false);
  protected readonly usePin = signal(false);
  protected readonly deposit = signal<number | null>(null);

  protected readonly canSeeCosts = computed(() => this.permissions.canRead('cpq_quotes_admin'));
  protected readonly canApprove = computed(() => this.permissions.canWrite('cpq_quotes_admin'));
  protected readonly title = computed(() => this.store.quote()?.quote_number ?? 'CPQ_QUOTES.NEW');
  protected readonly listIds = computed(() => this.store.sections().map((s) => this.listId(s.key)));
  protected readonly pricedLines = computed(() =>
    this.store.lines().filter((l) => isPriced(l.line_type)),
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id === null || id === 'new') {
      this.store.startNew();
    } else {
      this.store.load(id);
    }
  }

  protected listId(sectionKey: string): string {
    return `lines-${sectionKey}`;
  }

  protected priced(type: QuoteLineType): boolean {
    return isPriced(type);
  }

  protected num(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  protected money(value: number): string {
    return value.toFixed(2);
  }

  protected isOff(line: EditorLine): boolean {
    return line.selection_mode !== 'mandatory' && !line.is_default_selected;
  }

  protected lineMargin(line: EditorLine): string {
    const net = this.store.totals().lineNet[line.key] ?? 0;
    if (net === 0) {
      return '-';
    }
    return (((net - line.quantity * line.unit_cost) / net) * 100).toFixed(1);
  }

  protected setMode(line: EditorLine, mode: LineSelectionMode): void {
    this.store.patchLine(line.key, {
      selection_mode: mode,
      alternative_group:
        mode === 'alternative_group' ? (line.alternative_group ?? 'group-1') : null,
      is_default_selected: mode === 'optional' ? false : true,
    });
  }

  protected dropLine(event: CdkDragDrop<string>): void {
    this.store.dropLine(String(event.item.data), event.container.data, event.currentIndex);
  }

  protected dropSection(event: CdkDragDrop<string>): void {
    this.store.dropSection(event.previousIndex, event.currentIndex);
  }

  protected save(): void {
    this.store.save((quote) => {
      if (this.route.snapshot.paramMap.get('id') !== quote.id) {
        void this.router.navigate(['/cpq-quotes', quote.id], { replaceUrl: true });
      }
    });
  }

  protected revise(): void {
    this.store.createRevision((quote) => {
      void this.router.navigate(['/cpq-quotes', quote.id]).then(() => this.store.load(quote.id));
    });
  }

  protected convert(target: 'order' | 'invoice'): void {
    const percent = this.deposit();
    this.store.convert(
      target,
      target === 'invoice' && percent !== null && percent > 0 ? percent : undefined,
      () => this.deposit.set(null),
    );
  }
}
