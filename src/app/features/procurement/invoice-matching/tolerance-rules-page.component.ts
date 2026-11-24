import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n';
import {
  INVOICE_MATCH_TYPES,
  InvoiceMatchToleranceRule,
  InvoiceMatchType,
  TOLERANCE_SCOPES,
  ToleranceScope,
} from '@domain/procurement/invoice-matching.models';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  matchTypeKey,
  ruleToFormValue,
  scopeKey,
  scopeUsesCategory,
  scopeUsesSupplier,
  toRulePayload,
} from './invoice-matching.helpers';
import { ToleranceRulesStore } from './tolerance-rules.store';

/** Tolerance rules management: precedence-ordered table plus the create / edit dialog. */
@Component({
  selector: 'app-tolerance-rules-page',
  providers: [ToleranceRulesStore],
  imports: [
    DecimalPipe,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.PROCUREMENT_INVOICE_MATCHING_RULES' | translate"
      [subtitle]="'invoiceMatching.page.rulesSubtitle' | translate"
    >
      <a nz-button routerLink="/procurement/invoice-matching">{{
        'invoiceMatching.page.backToWorkbench' | translate
      }}</a>
      <button
        nz-button
        nzType="primary"
        type="button"
        (click)="openCreate()"
        data-testid="new-rule"
      >
        {{ 'invoiceMatching.button.newRule' | translate }}
      </button>
    </app-page-header>

    <nz-alert
      class="hint"
      nzType="info"
      nzShowIcon
      data-testid="precedence-hint"
      [nzMessage]="'invoiceMatching.form.precedenceHint' | translate"
    />

    @if (store.failed()) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="store.error() || ('invoiceMatching.message.loadError' | translate)"
      />
    }

    <nz-table
      #table
      nzSize="small"
      [nzData]="store.ordered()"
      [nzLoading]="store.loading()"
      [nzShowPagination]="false"
      [nzPageSize]="1000"
      [nzNoResult]="empty"
      data-testid="rules-table"
    >
      <thead>
        <tr>
          <th>{{ 'invoiceMatching.column.name' | translate }}</th>
          <th>{{ 'invoiceMatching.column.scope' | translate }}</th>
          <th>{{ 'invoiceMatching.column.target' | translate }}</th>
          <th>{{ 'invoiceMatching.column.type' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.priority' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.priceTolerance' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.quantityTolerance' | translate }}</th>
          <th>{{ 'invoiceMatching.column.active' | translate }}</th>
          <th>{{ 'invoiceMatching.column.actions' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (rule of table.data; track rule.id) {
          <tr [attr.data-testid]="'rule-row-' + rule.id">
            <td>{{ rule.name }}</td>
            <td>
              <nz-tag>{{ scopeText(rule.scope) | translate }}</nz-tag>
            </td>
            <td>{{ rule.supplier_id ?? rule.item_category ?? '-' }}</td>
            <td>
              @if (rule.match_type) {
                {{ typeText(rule.match_type) | translate }}
              } @else {
                {{ 'invoiceMatching.form.matchTypeAny' | translate }}
              }
            </td>
            <td class="num">{{ rule.priority }}</td>
            <td class="num">
              {{ rule.price_tolerance_percent | number: '1.0-4' }}% /
              {{ rule.price_tolerance_amount | number: '1.0-4' }}
            </td>
            <td class="num">
              {{ rule.quantity_tolerance_percent | number: '1.0-4' }}% /
              {{ rule.quantity_tolerance_amount | number: '1.0-4' }}
            </td>
            <td>
              <nz-tag [nzColor]="rule.is_active ? 'green' : 'default'">{{
                rule.is_active ? ('invoiceMatching.form.isActive' | translate) : '-'
              }}</nz-tag>
            </td>
            <td class="row-actions">
              <button
                nz-button
                nzSize="small"
                type="button"
                (click)="openEdit(rule)"
                data-testid="edit-rule"
              >
                {{ 'invoiceMatching.button.edit' | translate }}
              </button>
              <button
                nz-button
                nzSize="small"
                nzDanger
                type="button"
                nz-popconfirm
                [nzPopconfirmTitle]="'invoiceMatching.message.confirmDelete' | translate"
                (nzOnConfirm)="remove(rule)"
                data-testid="delete-rule"
              >
                {{ 'invoiceMatching.button.delete' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    <ng-template #empty>
      <nz-empty [nzNotFoundContent]="'invoiceMatching.message.noRules' | translate" />
    </ng-template>

    <nz-modal
      [nzVisible]="formVisible()"
      [nzTitle]="
        (editing() ? 'invoiceMatching.form.editRuleTitle' : 'invoiceMatching.form.createRuleTitle')
          | translate
      "
      [nzOkText]="'invoiceMatching.button.save' | translate"
      [nzCancelText]="'invoiceMatching.button.cancel' | translate"
      [nzOkLoading]="store.busy()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="submit()"
      (nzOnCancel)="formVisible.set(false)"
      data-testid="rule-modal"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="rule-name">{{
              'invoiceMatching.form.name' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'invoiceMatching.form.required' | translate">
              <input nz-input id="rule-name" formControlName="name" maxlength="150" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="rule-scope">{{
              'invoiceMatching.form.scope' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="rule-scope" formControlName="scope">
                @for (scope of scopes; track scope) {
                  <nz-option [nzValue]="scope" [nzLabel]="scopeText(scope) | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (usesSupplier()) {
            <nz-form-item>
              <nz-form-label nzFor="rule-supplier">{{
                'invoiceMatching.form.supplierIdRule' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="rule-supplier" formControlName="supplier_id" />
              </nz-form-control>
            </nz-form-item>
          }
          @if (usesCategory()) {
            <nz-form-item>
              <nz-form-label nzFor="rule-category">{{
                'invoiceMatching.form.itemCategory' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="rule-category" formControlName="item_category" />
              </nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <nz-form-label nzFor="rule-type">{{
              'invoiceMatching.form.matchType' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="rule-type" formControlName="match_type">
                <nz-option
                  nzValue="any"
                  [nzLabel]="'invoiceMatching.form.matchTypeAny' | translate"
                />
                @for (type of types; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="typeText(type) | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="rule-priority">{{
              'invoiceMatching.form.priority' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-input-number nzId="rule-priority" formControlName="priority" [nzStep]="1" />
            </nz-form-control>
          </nz-form-item>
          <div class="grid">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rule-price-percent">{{
                'invoiceMatching.form.priceTolerancePercent' | translate
              }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'invoiceMatching.form.required' | translate">
                <nz-input-number
                  nzId="rule-price-percent"
                  formControlName="price_tolerance_percent"
                  [nzMin]="0"
                  [nzStep]="0.1"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rule-price-amount">{{
                'invoiceMatching.form.priceToleranceAmount' | translate
              }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'invoiceMatching.form.required' | translate">
                <nz-input-number
                  nzId="rule-price-amount"
                  formControlName="price_tolerance_amount"
                  [nzMin]="0"
                  [nzStep]="0.01"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="rule-qty-percent">{{
                'invoiceMatching.form.quantityTolerancePercent' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-input-number
                  nzId="rule-qty-percent"
                  formControlName="quantity_tolerance_percent"
                  [nzMin]="0"
                  [nzStep]="0.1"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="rule-qty-amount">{{
                'invoiceMatching.form.quantityToleranceAmount' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-input-number
                  nzId="rule-qty-amount"
                  formControlName="quantity_tolerance_amount"
                  [nzMin]="0"
                  [nzStep]="0.01"
                />
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="rule-currency">{{
              'invoiceMatching.form.currency' | translate
            }}</nz-form-label>
            <nz-form-control>
              <input nz-input id="rule-currency" formControlName="currency" maxlength="3" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="rule-active">{{
              'invoiceMatching.form.isActive' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-switch nzId="rule-active" formControlName="is_active" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="rule-notes">{{
              'invoiceMatching.form.notes' | translate
            }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input id="rule-notes" rows="2" formControlName="notes"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .hint {
      margin-bottom: 16px;
    }
    .num {
      text-align: right;
    }
    .row-actions {
      display: flex;
      gap: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 16px;
    }
  `,
})
export class ToleranceRulesPageComponent implements OnInit {
  protected readonly store = inject(ToleranceRulesStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly scopes = TOLERANCE_SCOPES;
  protected readonly types = INVOICE_MATCH_TYPES;
  protected readonly scopeText = scopeKey;
  protected readonly typeText = matchTypeKey;

  protected readonly formVisible = signal(false);
  protected readonly editing = signal<InvoiceMatchToleranceRule | null>(null);

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    scope: this.fb.control<ToleranceScope>('tenant', Validators.required),
    supplier_id: this.fb.control(''),
    item_category: this.fb.control(''),
    match_type: this.fb.control<InvoiceMatchType | 'any'>('any'),
    priority: this.fb.control(0, Validators.required),
    price_tolerance_percent: this.fb.control(0, [Validators.required, Validators.min(0)]),
    price_tolerance_amount: this.fb.control(0, [Validators.required, Validators.min(0)]),
    quantity_tolerance_percent: this.fb.control<number | null>(null),
    quantity_tolerance_amount: this.fb.control<number | null>(null),
    currency: this.fb.control(''),
    is_active: this.fb.control(true),
    notes: this.fb.control(''),
  });

  private readonly scope = toSignal(this.form.controls.scope.valueChanges, {
    initialValue: this.form.controls.scope.value,
  });
  protected readonly usesSupplier = () => scopeUsesSupplier(this.scope());
  protected readonly usesCategory = () => scopeUsesCategory(this.scope());

  ngOnInit(): void {
    void this.store.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.formVisible.set(true);
  }

  openEdit(rule: InvoiceMatchToleranceRule): void {
    this.editing.set(rule);
    this.form.reset(ruleToFormValue(rule));
    this.formVisible.set(true);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const payload = toRulePayload(this.form.getRawValue());
    const current = this.editing();
    const outcome = current
      ? await this.store.update(current.id, payload)
      : await this.store.create(payload);

    if (outcome.ok) {
      this.message.success(this.i18n.translate('invoiceMatching.message.ruleSaved'));
      this.formVisible.set(false);
    } else {
      this.message.error(
        outcome.message || this.i18n.translate('invoiceMatching.message.genericError'),
      );
    }
  }

  async remove(rule: InvoiceMatchToleranceRule): Promise<void> {
    const outcome = await this.store.remove(rule.id);
    if (outcome.ok) {
      this.message.success(this.i18n.translate('invoiceMatching.message.ruleDeleted'));
    } else {
      this.message.error(
        outcome.message || this.i18n.translate('invoiceMatching.message.genericError'),
      );
    }
  }
}
