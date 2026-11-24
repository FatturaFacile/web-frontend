import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateService } from '@core';
import { CreateContactPayload, contactDisplayName } from '../../core/models/client.model';
import { CrmApiService } from '../../core/api/crm-api.service';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, merge, Subject, Subscription, switchMap } from 'rxjs';
import {
  DocumentCategory,
  ExtractedLine,
  LookupOption,
  ReviewedLine,
  ReviewedPayload,
  VendorMatch,
  Workbench,
} from './ocr-inbox.models';
import { OcrInboxStore } from './ocr-inbox.store';
import {
  confidenceBand,
  lineKey,
  parseDecimal,
  providerKey,
  reconcileTotals,
  trustKind,
} from './ocr-inbox.utils';

type LineGroup = FormGroup<{
  description: FormControl<string>;
  quantity: FormControl<string>;
  unitPrice: FormControl<string>;
  netAmount: FormControl<string>;
  vatRate: FormControl<number | null>;
  glAccountId: FormControl<string | null>;
  vatCodeId: FormControl<string | null>;
  costCenterId: FormControl<string | null>;
  purchaseOrderLineId: FormControl<string | null>;
  sourceLineIndex: FormControl<number>;
}>;

const CATEGORIES: DocumentCategory[] = [
  'vendor_invoice',
  'expense_receipt',
  'transport_ddt',
  'vendor_quote',
];

/**
 * Right pane of the review workbench: the extraction as a form the accountant checks and corrects. Every field reports its
 * key to the store when it gets the focus (so the viewer shows its region) and takes the focus when the store says another
 * part of the workbench chose it (a box clicked on the document). Fields carry the confidence band of the extraction as a
 * coloured and patterned left edge, so colour is not the only cue.
 */
@Component({
  selector: 'app-extraction-review-form',
  styleUrl: './ocr-inbox.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    TranslatePipe,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
  ],
  template: `
    <div
      class="trust-banner"
      [class]="'trust-banner ' + trust()"
      role="status"
      data-testid="trust-banner"
    >
      <strong data-testid="trust-label">
        @switch (trust()) {
          @case ('qr') {
            {{ 'OCR_INBOX.BANNER_QR' | translate }}
          }
          @case ('xml') {
            {{ 'OCR_INBOX.BANNER_XML' | translate }}
          }
          @default {
            {{ 'OCR_INBOX.BANNER_OCR' | translate: { provider: providerName() } }}
          }
        }
      </strong>
      <span class="pill" data-testid="trust-confidence">{{
        'OCR_INBOX.BANNER_CONFIDENCE'
          | translate: { score: (workbench().overall_confidence_score | number: '1.0-0') ?? '' }
      }}</span>
      @if (ocrUnavailable()) {
        <span data-testid="ocr-warning">{{ 'OCR_INBOX.BANNER_QR_WARNING' | translate }}</span>
      }
    </div>

    <form [formGroup]="form" (ngSubmit)="confirm()" novalidate>
      <h3>{{ 'OCR_INBOX.SECTION_HEADER' | translate }}</h3>
      <div class="form-grid">
        <div class="field">
          <label for="category">{{ 'OCR_INBOX.CATEGORY' | translate }}</label>
          <nz-select
            id="category"
            formControlName="category"
            data-testid="category"
            style="width: 100%"
          >
            @for (category of categories; track category) {
              <nz-option
                [nzValue]="category"
                [nzLabel]="'OCR_INBOX.CATEGORY_' + category.toUpperCase() | translate"
              ></nz-option>
            }
          </nz-select>
        </div>
        <div class="field" [class]="fieldClass('vendor.name')">
          <label for="vendor">{{ 'OCR_INBOX.VENDOR' | translate }}</label>
          <nz-select
            id="vendor"
            formControlName="vendorId"
            nzShowSearch
            nzAllowClear
            nzServerSearch
            data-testid="vendor"
            data-field="vendor.name"
            style="width: 100%"
            [nzPlaceHolder]="'OCR_INBOX.VENDOR_SEARCH' | translate"
            (nzOnSearch)="vendorSearch.next($event)"
            (nzFocus)="focus('vendor.name')"
          >
            @for (vendor of vendorOptions(); track vendor.id) {
              <nz-option [nzValue]="vendor.id" [nzLabel]="vendor.label"></nz-option>
            }
          </nz-select>
          @if (form.controls.vendorId.value === null) {
            <button
              nz-button
              nzType="link"
              nzSize="small"
              type="button"
              data-testid="create-vendor"
              (click)="drawer.set(true)"
            >
              {{ 'OCR_INBOX.VENDOR_CREATE' | translate }}
            </button>
          }
        </div>
        <div class="field" [class]="fieldClass('vendor.uid')">
          <label for="uid">{{ 'OCR_INBOX.UID' | translate }}</label>
          <input
            nz-input
            id="uid"
            formControlName="uid"
            data-field="vendor.uid"
            (focus)="focus('vendor.uid')"
          />
        </div>
        <div class="field" [class]="fieldClass('vendor.vat_number')">
          <label for="vat-number">{{ 'OCR_INBOX.VAT_NUMBER' | translate }}</label>
          <input
            nz-input
            id="vat-number"
            formControlName="vatNumber"
            data-field="vendor.vat_number"
            (focus)="focus('vendor.vat_number')"
          />
        </div>
        <div class="field" [class]="fieldClass(ibanKey())">
          <label for="iban">{{ 'OCR_INBOX.IBAN' | translate }}</label>
          <input
            nz-input
            id="iban"
            formControlName="iban"
            [attr.data-field]="ibanKey()"
            (focus)="focus(ibanKey())"
          />
        </div>
        <div class="field" [class]="fieldClass('header.document_number')">
          <label for="number">{{ 'OCR_INBOX.DOCUMENT_NUMBER' | translate }}</label>
          <input
            nz-input
            id="number"
            formControlName="number"
            data-testid="document-number"
            data-field="header.document_number"
            (focus)="focus('header.document_number')"
          />
        </div>
        <div class="field" [class]="fieldClass('header.issue_date')">
          <label for="issue-date">{{ 'OCR_INBOX.ISSUE_DATE' | translate }}</label>
          <input
            nz-input
            id="issue-date"
            type="date"
            formControlName="issueDate"
            data-field="header.issue_date"
            (focus)="focus('header.issue_date')"
          />
        </div>
        <div class="field" [class]="fieldClass('header.due_date')">
          <label for="due-date">{{ 'OCR_INBOX.DUE_DATE' | translate }}</label>
          <input
            nz-input
            id="due-date"
            type="date"
            formControlName="dueDate"
            data-field="header.due_date"
            (focus)="focus('header.due_date')"
          />
        </div>
        <div class="field" [class]="fieldClass('header.currency')">
          <label for="currency">{{ 'OCR_INBOX.CURRENCY' | translate }}</label>
          <input
            nz-input
            id="currency"
            maxlength="3"
            formControlName="currency"
            data-field="header.currency"
            (focus)="focus('header.currency')"
          />
        </div>
        <div class="field" [class]="fieldClass('header.qr_reference')">
          <label for="qr-reference">{{ 'OCR_INBOX.QR_REFERENCE' | translate }}</label>
          <input
            nz-input
            id="qr-reference"
            formControlName="qrReference"
            data-field="header.qr_reference"
            (focus)="focus('header.qr_reference')"
          />
        </div>
        @if (category() === 'expense_receipt') {
          <p class="muted">{{ 'OCR_INBOX.EXPENSE_CATEGORY' | translate }}</p>
        }
      </div>

      <h3>{{ 'OCR_INBOX.MATCH_TITLE' | translate }}</h3>
      <section data-testid="match-panel">
        @if (orders().length === 0) {
          <p class="muted" data-testid="match-none">{{ 'OCR_INBOX.MATCH_NONE' | translate }}</p>
        }
        @for (order of orders(); track order.id) {
          <div class="match-order" [attr.data-testid]="'match-' + order.id">
            <label>
              <input
                type="checkbox"
                [checked]="linkedOrders().includes(order.id)"
                (change)="toggleOrder(order.id)"
              />
              <strong>{{
                'OCR_INBOX.MATCH_PURCHASE_ORDER' | translate: { number: order.number }
              }}</strong>
            </label>
            @if (order.evaluation; as evaluation) {
              <nz-tag
                [nzColor]="
                  evaluation.status === 'matched'
                    ? 'green'
                    : evaluation.status === 'variance'
                      ? 'orange'
                      : 'default'
                "
                [attr.data-testid]="'match-status-' + order.id"
                >{{ matchStatusKey(evaluation.status) | translate }}</nz-tag
              >
            }
            @if (order.goods_receipts.length > 0) {
              <span class="muted">
                {{ 'OCR_INBOX.MATCH_GOODS_RECEIPTS' | translate }}:
                @for (receipt of order.goods_receipts; track receipt.id) {
                  {{ receipt.receipt_number }}
                }
              </span>
            }
            @if (order.evaluation; as evaluation) {
              <ul class="match-lines">
                @for (match of evaluation.lines; track match.invoice_line_index) {
                  <li [attr.data-testid]="'match-line-' + match.invoice_line_index">
                    #{{ match.invoice_line_index + 1 }}
                    <nz-tag
                      [nzColor]="
                        Math.abs(match.price_variance_percent) > 0 && !match.within_tolerance
                          ? 'red'
                          : 'green'
                      "
                      >{{
                        'OCR_INBOX.MATCH_PRICE_VARIANCE'
                          | translate
                            : { value: (match.price_variance_percent | number: '1.0-2') ?? '' }
                      }}</nz-tag
                    >
                    <nz-tag [nzColor]="match.quantity_variance === 0 ? 'green' : 'orange'">{{
                      'OCR_INBOX.MATCH_QUANTITY_VARIANCE'
                        | translate: { value: (match.quantity_variance | number: '1.0-2') ?? '' }
                    }}</nz-tag>
                    @if (match.received_variance > 0) {
                      <nz-tag nzColor="red">{{
                        'OCR_INBOX.MATCH_RECEIVED_VARIANCE'
                          | translate: { value: (match.received_variance | number: '1.0-2') ?? '' }
                      }}</nz-tag>
                    }
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [attr.data-testid]="'link-line-' + match.invoice_line_index"
                      [disabled]="
                        linkedLine(match.invoice_line_index) === match.purchase_order_line_id
                      "
                      (click)="
                        linkLine(match.invoice_line_index, match.purchase_order_line_id, order.id)
                      "
                    >
                      {{
                        (linkedLine(match.invoice_line_index) === match.purchase_order_line_id
                          ? 'OCR_INBOX.MATCH_LINKED'
                          : 'OCR_INBOX.MATCH_LINK_LINE'
                        ) | translate
                      }}
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        }
        @if (needsOverride()) {
          <div class="field">
            <label for="override">{{ 'OCR_INBOX.MATCH_OVERRIDE_REASON' | translate }}</label>
            <input
              nz-input
              id="override"
              formControlName="matchOverrideReason"
              data-testid="override-reason"
            />
          </div>
        }
      </section>

      <h3>{{ 'OCR_INBOX.LINES' | translate }}</h3>
      <nz-table
        #grid
        nzTemplateMode
        nzSize="small"
        [nzShowPagination]="false"
        data-testid="lines-grid"
      >
        <thead>
          <tr>
            <th>{{ 'OCR_INBOX.LINE_DESCRIPTION' | translate }}</th>
            <th nzWidth="80px">{{ 'OCR_INBOX.LINE_QUANTITY' | translate }}</th>
            <th nzWidth="100px">{{ 'OCR_INBOX.LINE_UNIT_PRICE' | translate }}</th>
            <th nzWidth="100px">{{ 'OCR_INBOX.LINE_NET_AMOUNT' | translate }}</th>
            <th nzWidth="150px">{{ 'OCR_INBOX.LINE_VAT_CODE' | translate }}</th>
            <th nzWidth="170px">{{ 'OCR_INBOX.LINE_GL_ACCOUNT' | translate }}</th>
            <th nzWidth="150px">{{ 'OCR_INBOX.LINE_COST_CENTER' | translate }}</th>
            <th nzWidth="90px">{{ 'OCR_INBOX.LINE_AI_CONFIDENCE' | translate }}</th>
            <th nzWidth="44px"></th>
          </tr>
        </thead>
        <tbody formArrayName="lines">
          @for (line of lines.controls; track $index; let i = $index) {
            <tr [formGroupName]="i" [attr.data-testid]="'line-' + i">
              <td class="field" [class]="fieldClass(key(i, 'description'))">
                <input
                  nz-input
                  formControlName="description"
                  [attr.data-field]="key(i, 'description')"
                  [attr.aria-label]="'OCR_INBOX.LINE_DESCRIPTION' | translate"
                  (focus)="focus(key(i, 'description'))"
                />
              </td>
              <td class="field" [class]="fieldClass(key(i, 'quantity'))">
                <input
                  nz-input
                  class="right"
                  inputmode="decimal"
                  formControlName="quantity"
                  [attr.data-field]="key(i, 'quantity')"
                  [attr.aria-label]="'OCR_INBOX.LINE_QUANTITY' | translate"
                  (focus)="focus(key(i, 'quantity'))"
                />
              </td>
              <td class="field" [class]="fieldClass(key(i, 'unit_price'))">
                <input
                  nz-input
                  class="right"
                  inputmode="decimal"
                  formControlName="unitPrice"
                  [attr.data-field]="key(i, 'unit_price')"
                  [attr.aria-label]="'OCR_INBOX.LINE_UNIT_PRICE' | translate"
                  (focus)="focus(key(i, 'unit_price'))"
                />
              </td>
              <td class="field" [class]="fieldClass(key(i, 'net_amount'))">
                <input
                  nz-input
                  class="right"
                  inputmode="decimal"
                  formControlName="netAmount"
                  [attr.data-field]="key(i, 'net_amount')"
                  [attr.aria-label]="'OCR_INBOX.LINE_NET_AMOUNT' | translate"
                  (focus)="focus(key(i, 'net_amount'))"
                />
              </td>
              <td>
                <nz-select
                  formControlName="vatCodeId"
                  nzShowSearch
                  nzAllowClear
                  style="width: 100%"
                  [attr.data-testid]="'vat-code-' + i"
                  [nzPlaceHolder]="'OCR_INBOX.LINE_VAT_CODE' | translate"
                >
                  @for (code of workbench().lookups.vat_codes; track code.id) {
                    <nz-option [nzValue]="code.id" [nzLabel]="optionLabel(code)"></nz-option>
                  }
                </nz-select>
              </td>
              <td>
                <nz-select
                  formControlName="glAccountId"
                  nzShowSearch
                  nzAllowClear
                  style="width: 100%"
                  [attr.data-testid]="'gl-account-' + i"
                  [nzPlaceHolder]="'OCR_INBOX.LINE_GL_ACCOUNT' | translate"
                >
                  @for (account of workbench().lookups.gl_accounts; track account.id) {
                    <nz-option [nzValue]="account.id" [nzLabel]="optionLabel(account)"></nz-option>
                  }
                </nz-select>
              </td>
              <td>
                <nz-select
                  formControlName="costCenterId"
                  nzShowSearch
                  nzAllowClear
                  style="width: 100%"
                  [attr.data-testid]="'cost-center-' + i"
                  [nzPlaceHolder]="'OCR_INBOX.LINE_COST_CENTER' | translate"
                >
                  @for (center of workbench().lookups.cost_centers; track center.id) {
                    <nz-option [nzValue]="center.id" [nzLabel]="optionLabel(center)"></nz-option>
                  }
                </nz-select>
              </td>
              <td>
                @if (suggestion(i); as suggested) {
                  <span
                    class="pill"
                    nz-tooltip
                    [attr.data-testid]="'coding-confidence-' + i"
                    [attr.data-band]="suggested.band"
                    [nzTooltipTitle]="sourceKey(suggested.source) | translate"
                    >{{ suggested.score | number: '1.0-0' }}%</span
                  >
                }
              </td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  nzType="text"
                  type="button"
                  [attr.data-testid]="'remove-line-' + i"
                  [attr.aria-label]="'OCR_INBOX.REMOVE_LINE' | translate"
                  (click)="removeLine(i)"
                >
                  <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      <button nz-button nzSize="small" type="button" data-testid="add-line" (click)="addLine()">
        {{ 'OCR_INBOX.ADD_LINE' | translate }}
      </button>

      <div class="totals-footer" data-testid="totals-footer">
        <span
          >{{ 'OCR_INBOX.TOTAL_NET' | translate }}:
          <strong data-testid="total-net">{{ totals().net | number: '1.2-2' }}</strong></span
        >
        <span
          >{{ 'OCR_INBOX.TOTAL_VAT' | translate }}:
          <strong data-testid="total-vat">{{ totals().vat | number: '1.2-2' }}</strong></span
        >
        <label class="field" [class]="fieldClass('totals.gross')">
          {{ 'OCR_INBOX.TOTAL_GROSS' | translate }}:
          <input
            nz-input
            class="right"
            style="width: 130px"
            inputmode="decimal"
            formControlName="gross"
            data-testid="total-gross"
            data-field="totals.gross"
            (focus)="focus('totals.gross')"
          />
        </label>
        @if (totals().reconciled) {
          <nz-tag nzColor="green" data-testid="totals-ok">{{
            'OCR_INBOX.TOTALS_RECONCILED' | translate
          }}</nz-tag>
        } @else {
          <nz-tag nzColor="red" data-testid="totals-difference" role="alert">{{
            'OCR_INBOX.TOTALS_DIFFERENCE'
              | translate
                : {
                    difference: (totals().difference | number: '1.2-2') ?? '',
                    currency: currency(),
                    tolerance: (totals().tolerance | number: '1.2-2') ?? '',
                  }
          }}</nz-tag>
        }
      </div>

      @if (vatBreakdown().length > 0) {
        <table
          class="vat-breakdown"
          data-testid="vat-breakdown"
          [attr.aria-label]="'OCR_INBOX.VAT_BREAKDOWN' | translate"
        >
          <caption class="muted">
            {{
              'OCR_INBOX.VAT_BREAKDOWN' | translate
            }}
          </caption>
          @for (row of vatBreakdown(); track row.rate) {
            <tr>
              <th scope="row">{{ row.rate | number: '1.0-2' }}%</th>
              <td class="right">{{ row.net | number: '1.2-2' }}</td>
              <td class="right">{{ row.vat | number: '1.2-2' }}</td>
            </tr>
          }
        </table>
      }

      <div class="actions">
        <button
          nz-button
          nzType="primary"
          type="submit"
          data-testid="confirm"
          [nzLoading]="store.busy()"
          [disabled]="!store.canReview() || store.busy()"
        >
          {{ 'OCR_INBOX.CONFIRM' | translate }}
        </button>
        <button
          nz-button
          type="button"
          data-testid="save-draft"
          [disabled]="!store.canReview() || store.busy()"
          (click)="saveDraft()"
        >
          {{ 'OCR_INBOX.SAVE_DRAFT' | translate }}
        </button>
        <button
          nz-button
          type="button"
          data-testid="rerun"
          [disabled]="!canRerun() || store.busy()"
          (click)="rerun()"
        >
          {{ 'OCR_INBOX.RERUN' | translate }}
        </button>
        <button
          nz-button
          nzDanger
          type="button"
          data-testid="reject"
          [disabled]="!canRerun() || store.busy()"
          (click)="rejecting.set(!rejecting())"
        >
          {{ 'OCR_INBOX.REJECT' | translate }}
        </button>
      </div>
      @if (rejecting()) {
        <div class="reject-box" data-testid="reject-box">
          <p>{{ 'OCR_INBOX.REJECT_CONFIRM' | translate }}</p>
          <input
            nz-input
            [attr.aria-label]="'OCR_INBOX.REJECT_REASON' | translate"
            [placeholder]="'OCR_INBOX.REJECT_REASON' | translate"
            [value]="rejectReason()"
            (input)="rejectReason.set($any($event.target).value)"
            data-testid="reject-reason"
          />
          <button
            nz-button
            nzDanger
            type="button"
            data-testid="reject-confirm"
            [disabled]="rejectReason().trim() === ''"
            (click)="reject()"
          >
            {{ 'OCR_INBOX.REJECT' | translate }}
          </button>
        </div>
      }
    </form>

    <nz-drawer
      [nzVisible]="drawer()"
      [nzTitle]="'OCR_INBOX.VENDOR_CREATE' | translate"
      nzPlacement="right"
      [nzWidth]="400"
      (nzOnClose)="drawer.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form
          [formGroup]="vendorForm"
          (ngSubmit)="createVendor()"
          novalidate
          data-testid="vendor-drawer"
        >
          <div class="field">
            <label for="new-name">{{ 'OCR_INBOX.VENDOR_NAME' | translate }}</label><input
              nz-input
              id="new-name"
              formControlName="name"
            />
          </div>
          <div class="field">
            <label for="new-vat">{{ 'OCR_INBOX.VAT_NUMBER' | translate }}</label><input
              nz-input
              id="new-vat"
              formControlName="vatNumber"
            />
          </div>
          <div class="field">
            <label for="new-uid">{{ 'OCR_INBOX.UID' | translate }}</label><input
              nz-input
              id="new-uid"
              formControlName="uid"
            />
          </div>
          <div class="field">
            <label for="new-iban">{{ 'OCR_INBOX.IBAN' | translate }}</label><input
              nz-input
              id="new-iban"
              formControlName="iban"
            />
          </div>
          <button
            nz-button
            nzType="primary"
            type="submit"
            data-testid="create-vendor-submit"
            [disabled]="vendorForm.invalid || store.busy()"
          >
            {{ 'OCR_INBOX.VENDOR_CREATE' | translate }}
          </button>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class ExtractionReviewFormComponent {
  protected readonly store = inject(OcrInboxStore);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly workbench = input.required<Workbench>();

  protected readonly Math = Math;
  protected readonly categories = CATEGORIES;
  protected readonly drawer = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly rejectReason = signal('');
  protected readonly vendorSearch = new Subject<string>();
  protected readonly vendorOptions = signal<{ id: string; label: string }[]>([]);
  protected readonly linkedOrders = signal<string[]>([]);

  protected readonly form = this.fb.group({
    category: this.fb.control<DocumentCategory>('vendor_invoice'),
    vendorId: this.fb.control<string | null>(null),
    uid: this.fb.control(''),
    vatNumber: this.fb.control(''),
    iban: this.fb.control(''),
    number: this.fb.control(''),
    issueDate: this.fb.control('', Validators.required),
    dueDate: this.fb.control(''),
    currency: this.fb.control('EUR', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(3),
    ]),
    qrReference: this.fb.control(''),
    gross: this.fb.control(''),
    matchOverrideReason: this.fb.control(''),
    lines: this.fb.array<LineGroup>([]),
  });

  protected readonly vendorForm = this.fb.group({
    name: this.fb.control('', Validators.required),
    vatNumber: this.fb.control(''),
    uid: this.fb.control(''),
    iban: this.fb.control(''),
  });

  /** Bumped on every change of the form, so the totals are computed from its current values. */
  private readonly revision = signal(0);
  private lineSubscription = new Subscription();
  private focusing = false;

  protected readonly trust = computed(() =>
    trustKind(this.workbench().extraction_method, this.workbench().payload?.meta?.source_format),
  );
  protected readonly providerName = computed(() => {
    const key = providerKey(this.workbench().ocr_provider_used);

    return key === null ? '' : this.i18n.instant(key);
  });
  protected readonly ocrUnavailable = computed(
    () => this.workbench().payload?.meta?.warnings?.includes('ocr_unavailable') === true,
  );
  protected readonly category = computed(() => {
    this.revision();

    return this.form.controls.category.value;
  });
  protected readonly currency = computed(() => {
    this.revision();

    return this.form.controls.currency.value.toUpperCase();
  });
  protected readonly orders = computed(() => this.workbench().three_way_match.purchase_orders);
  protected readonly vatBreakdown = computed(() => this.workbench().payload?.vat_breakdown ?? []);
  protected readonly needsOverride = computed(() =>
    this.orders().some(
      (order) =>
        this.linkedOrders().includes(order.id) &&
        order.evaluation !== null &&
        order.evaluation.status !== 'matched',
    ),
  );
  protected readonly canRerun = computed(() =>
    ['ready_for_review', 'failed'].includes(this.workbench().status),
  );
  protected readonly totals = computed(() => {
    this.revision();
    const rows = this.lines.getRawValue();

    return reconcileTotals({
      netAmounts: rows.map((row) => parseDecimal(row.netAmount)),
      vatRates: rows.map((row) => row.vatRate),
      vat: this.workbench().payload?.totals.vat ?? null,
      gross: parseDecimal(this.form.controls.gross.value),
      currency: this.currency(),
    });
  });

  constructor() {
    effect(() => {
      const workbench = this.workbench();

      untracked(() => this.reset(workbench));
    });

    // A box chosen on the document (or any other part of the workbench) takes the focus in the form.
    effect(() => {
      const key = this.store.activeFieldKey();
      this.store.focusTick();

      if (key !== null) {
        untracked(() => this.focusElement(key));
      }
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.bump());
    this.vendorSearch
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.crm.getSuppliers({ search: term, per_page: 20 })),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (res) =>
          this.vendorOptions.set(
            res.data.map((contact) => ({ id: contact.id, label: contactDisplayName(contact) })),
          ),
        error: () => undefined,
      });
    this.destroyRef.onDestroy(() => this.lineSubscription.unsubscribe());
  }

  protected get lines(): FormArray<LineGroup> {
    return this.form.controls.lines;
  }

  protected key(index: number, field: string): string {
    return lineKey(index, field);
  }

  /** Where the IBAN of the document was read: the QR-IBAN of a QR-bill when there is no plain IBAN. */
  protected ibanKey(): string {
    const vendor = this.workbench().payload?.vendor;

    return vendor?.qr_iban != null && vendor.iban == null ? 'vendor.qr_iban' : 'vendor.iban';
  }

  /** Confidence band of the extraction for a field, and whether it is the active one. */
  protected fieldClass(key: string): string {
    const score = this.store.confidence()[key];
    const band = score === undefined ? '' : `band-${confidenceBand(score)}`;

    return `${band}${this.store.activeFieldKey() === key ? ' active' : ''}`.trim();
  }

  protected focus(key: string): void {
    if (!this.focusing) {
      this.store.focusField(key);
    }
  }

  protected optionLabel(option: LookupOption): string {
    const name = option.name ?? option.description ?? '';

    return name === '' ? option.code : `${option.code} · ${name}`;
  }

  protected matchStatusKey(status: 'matched' | 'variance' | 'unmatched'): string {
    return `OCR_INBOX.MATCH_${status.toUpperCase()}`;
  }

  protected sourceKey(source: string): string {
    return `OCR_INBOX.LINE_CODING_SOURCE_${source.toUpperCase()}`;
  }

  /** The suggestion of the vendor coding model for a line of the grid, when there is one. */
  protected suggestion(index: number): { score: number; band: string; source: string } | null {
    const sourceIndex = this.lines.at(index)?.controls.sourceLineIndex.value ?? -1;
    const line = this.workbench().payload?.lines[sourceIndex];

    if (line?.coding_source === undefined || line.coding_source === 'none') {
      return null;
    }

    const score = line.coding_confidence ?? 0;

    return { score, band: confidenceBand(score), source: line.coding_source };
  }

  protected toggleOrder(orderId: string): void {
    this.linkedOrders.update((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  }

  protected linkedLine(index: number): string | null {
    this.revision();

    return this.lines.at(index)?.controls.purchaseOrderLineId.value ?? null;
  }

  /** One click links an invoice line to the order line the match found for it (and the order to the document). */
  protected linkLine(index: number, purchaseOrderLineId: string, orderId: string): void {
    this.lines.at(index)?.controls.purchaseOrderLineId.setValue(purchaseOrderLineId);

    if (!this.linkedOrders().includes(orderId)) {
      this.toggleOrder(orderId);
    }
  }

  protected addLine(): void {
    this.lines.push(
      this.lineGroup(
        { description: '', quantity: null, unit_price: null, net_amount: null, vat_rate: null },
        this.lines.length,
      ),
    );
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  protected confirm(): void {
    if (!this.store.canReview()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.message.error(this.i18n.instant('OCR_INBOX.FIELD_REQUIRED'));

      return;
    }

    this.store.confirm(this.payload()).subscribe({
      next: () => this.message.success(this.i18n.instant('OCR_INBOX.CONFIRMED_OK')),
      error: (error: unknown) =>
        this.message.error(this.errorText(error, 'OCR_INBOX.CONFIRM_ERROR')),
    });
  }

  protected saveDraft(): void {
    this.store.saveDraft(this.payload()).subscribe({
      next: () => this.message.success(this.i18n.instant('OCR_INBOX.DRAFT_SAVED')),
      error: (error: unknown) => this.message.error(this.errorText(error, 'OCR_INBOX.DRAFT_ERROR')),
    });
  }

  protected rerun(): void {
    this.store.rerun().subscribe({
      next: () => this.message.success(this.i18n.instant('OCR_INBOX.RERUN_OK')),
      error: (error: unknown) => this.message.error(this.errorText(error, 'OCR_INBOX.RERUN_ERROR')),
    });
  }

  protected reject(): void {
    this.store.reject(this.rejectReason().trim()).subscribe({
      next: () => {
        this.rejecting.set(false);
        this.rejectReason.set('');
        this.message.success(this.i18n.instant('OCR_INBOX.REJECTED_OK'));
      },
      error: (error: unknown) =>
        this.message.error(this.errorText(error, 'OCR_INBOX.REJECT_ERROR')),
    });
  }

  /** Creates the vendor from the extracted identifiers and selects it. */
  protected createVendor(): void {
    const value = this.vendorForm.getRawValue();
    const country = this.workbench().payload?.vendor.vat_number?.slice(0, 2).toUpperCase() ?? 'CH';
    const payload: CreateContactPayload = {
      type: 'supplier',
      legal_type: 'company',
      country: /^[A-Z]{2}$/.test(country) ? country : 'CH',
      company_name: value.name.trim(),
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      vat_number: value.vatNumber.trim() || null,
      fiscal_code: this.workbench().payload?.vendor.fiscal_code ?? null,
      uid_number: value.uid.trim() || null,
      sdi_code: null,
      pec: null,
      iban: value.iban.trim() || null,
      qr_iban: this.workbench().payload?.vendor.qr_iban ?? null,
      payment_terms_days: null,
    };

    this.crm.createContact(payload).subscribe({
      next: (res) => {
        this.vendorOptions.update((options) => [
          ...options,
          { id: res.data.id, label: contactDisplayName(res.data) },
        ]);
        this.form.controls.vendorId.setValue(res.data.id);
        this.drawer.set(false);
      },
      error: (error: unknown) =>
        this.message.error(this.errorText(error, 'OCR_INBOX.CONFIRM_ERROR')),
    });
  }

  /** Builds the form from the saved draft when there is one, else from the extraction and its coding suggestions. */
  private reset(workbench: Workbench): void {
    const payload = workbench.payload;
    const draft = workbench.review_draft;

    this.lineSubscription.unsubscribe();
    this.lineSubscription = new Subscription();
    this.rejecting.set(false);
    this.rejectReason.set('');

    this.form.reset({
      category: workbench.document_category,
      vendorId: draft?.vendor_id ?? workbench.vendor?.id ?? null,
      uid: payload?.vendor.uid ?? '',
      vatNumber: payload?.vendor.vat_number ?? '',
      iban: payload?.vendor.iban ?? payload?.vendor.qr_iban ?? '',
      number: draft?.header.number ?? payload?.document.number ?? '',
      issueDate: draft?.header.issue_date ?? payload?.document.issue_date ?? '',
      dueDate: draft?.header.due_date ?? payload?.document.due_date ?? '',
      currency: draft?.header.currency ?? payload?.document.currency ?? 'EUR',
      qrReference: draft?.header.qr_reference ?? payload?.document.qr_reference ?? '',
      gross: this.text(draft?.totals.gross ?? payload?.totals.gross ?? null),
      matchOverrideReason: draft?.match_override_reason ?? '',
    });

    this.lines.clear();
    const lines: (ExtractedLine | ReviewedLine)[] = draft?.lines ?? payload?.lines ?? [];
    lines.forEach((line, index) => this.lines.push(this.lineGroup(line, index)));

    this.linkedOrders.set(
      draft?.purchase_order_ids ??
        workbench.three_way_match.purchase_orders.map((order) => order.id),
    );
    this.vendorOptions.set(
      workbench.vendor === null
        ? []
        : [{ id: workbench.vendor.id, label: this.vendorLabel(workbench.vendor) }],
    );
    this.vendorForm.reset({
      name: payload?.vendor.name ?? '',
      vatNumber: payload?.vendor.vat_number ?? '',
      uid: payload?.vendor.uid ?? '',
      iban: payload?.vendor.iban ?? payload?.vendor.qr_iban ?? '',
    });
    this.bump();
  }

  private lineGroup(line: ExtractedLine | ReviewedLine, index: number): LineGroup {
    const lookups = this.workbench().lookups;
    const reviewed = 'gl_account_id' in line;
    const sourceIndex = reviewed ? (line.source_line_index ?? index) : index;
    const rate = line.vat_rate;
    const suggestedVat = reviewed ? line.vat_code_id : (line.suggested_vat_code_id ?? null);
    const vatCode =
      suggestedVat ??
      lookups.vat_codes.find(
        (code) => rate !== null && Number(code.tax_rate_percent ?? code.rate) === rate,
      )?.id ??
      null;

    const group = this.fb.group({
      description: this.fb.control(line.description),
      quantity: this.fb.control(this.text(line.quantity)),
      unitPrice: this.fb.control(this.text(line.unit_price)),
      netAmount: this.fb.control(this.text(line.net_amount)),
      vatRate: this.fb.control<number | null>(rate),
      glAccountId: this.fb.control<string | null>(
        reviewed ? line.gl_account_id : (line.suggested_gl_account_id ?? null),
      ),
      vatCodeId: this.fb.control<string | null>(vatCode),
      costCenterId: this.fb.control<string | null>(
        reviewed ? line.cost_center_id : (line.suggested_cost_center_id ?? null),
      ),
      purchaseOrderLineId: this.fb.control<string | null>(
        reviewed ? (line.purchase_order_line_id ?? null) : null,
      ),
      sourceLineIndex: this.fb.control(sourceIndex),
    });

    this.lineSubscription.add(
      group.controls.vatCodeId.valueChanges.subscribe((id) => {
        const code = lookups.vat_codes.find((candidate) => candidate.id === id);
        const percent =
          code === undefined
            ? null
            : parseDecimal(String(code.tax_rate_percent ?? code.rate ?? ''));

        if (percent !== null) {
          group.controls.vatRate.setValue(percent);
        }
      }),
    );
    this.lineSubscription.add(
      merge(group.controls.quantity.valueChanges, group.controls.unitPrice.valueChanges).subscribe(
        () => {
          const quantity = parseDecimal(group.controls.quantity.value);
          const price = parseDecimal(group.controls.unitPrice.value);

          if (quantity !== null && price !== null) {
            group.controls.netAmount.setValue(
              this.text(Math.round((quantity * price + Number.EPSILON) * 100) / 100),
            );
          }
        },
      ),
    );

    return group;
  }

  /** The reviewed document the API converts: header, lines with their coding, linked orders and receipts. */
  private payload(): ReviewedPayload {
    const value = this.form.getRawValue();
    const totals = this.totals();
    const linked = this.linkedOrders();
    const receipts = this.orders()
      .filter((order) => linked.includes(order.id))
      .flatMap((order) => order.goods_receipts.map((receipt) => receipt.id));

    return {
      category: value.category,
      vendor_id: value.vendorId,
      header: {
        number: value.number.trim() || null,
        issue_date: value.issueDate || null,
        due_date: value.dueDate || null,
        currency: value.currency.toUpperCase(),
        qr_reference: value.qrReference.trim() || null,
      },
      totals: { net: totals.net, vat: totals.vat, gross: totals.gross },
      lines: value.lines.map((row) => ({
        description: row.description.trim(),
        quantity: parseDecimal(row.quantity),
        unit_price: parseDecimal(row.unitPrice),
        net_amount: parseDecimal(row.netAmount),
        vat_rate: row.vatRate,
        gl_account_id: row.glAccountId,
        vat_code_id: row.vatCodeId,
        cost_center_id: row.costCenterId,
        purchase_order_line_id: row.purchaseOrderLineId,
        source_line_index: row.sourceLineIndex,
      })),
      purchase_order_ids: linked,
      goods_receipt_ids: receipts,
      match_override_reason: this.needsOverride() ? value.matchOverrideReason.trim() || null : null,
    };
  }

  private focusElement(key: string): void {
    const element = this.host.nativeElement.querySelector<HTMLElement>(`[data-field="${key}"]`);
    const target =
      element === null
        ? null
        : element.matches('input, textarea, select')
          ? element
          : (element.querySelector<HTMLElement>('input') ?? element);

    if (target === null || document.activeElement === target) {
      return;
    }

    this.focusing = true;

    try {
      target.focus();
      target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    } finally {
      this.focusing = false;
    }
  }

  private bump(): void {
    this.revision.update((value) => value + 1);
  }

  private text(value: number | null): string {
    return value === null ? '' : String(value);
  }

  private vendorLabel(vendor: VendorMatch): string {
    return vendor.company_name ?? vendor.vat_number ?? vendor.id;
  }

  private errorText(error: unknown, fallbackKey: string): string {
    if (error instanceof HttpErrorResponse) {
      const body: unknown = error.error;

      if (typeof body === 'object' && body !== null) {
        const detail =
          (body as { detail?: unknown; message?: unknown }).detail ??
          (body as { message?: unknown }).message;

        if (typeof detail === 'string' && detail !== '') {
          return detail;
        }
      }
    }

    return this.i18n.instant(fallbackKey);
  }
}
