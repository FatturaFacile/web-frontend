import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { SCT_DIRECTIONS, SCT_TYPES, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { OrdersStore } from './orders.store';
import { SctLookupName, SctOption, SubcontractingLookupService } from './subcontracting-lookup.service';
import {
  buildOrderPayload,
  emptyOrderForm,
  plannedFor,
  regimesFor,
  SctOrderForm,
  SctOutcome,
  stepIsValid,
} from './subcontracting.util';

/**
 * The creation wizard of a subcontracting order: direction and type, the partner and the product, the BOM or routing step and the
 * customs regime (TPP for passive, TPA for active), the component lines (exploded from the BOM or typed in) and the review.
 */
@Component({
  selector: 'app-sct-order-form',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [OrdersStore],
  styleUrl: './subcontracting.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.SUBCONTRACTING_ORDER_NEW' | translate"
      [subtitle]="'subcontracting.wizard.subtitle' | translate"
    ></app-page-header>

    <div class="wizard">
      <nz-steps [nzCurrent]="step()" nzSize="small">
        <nz-step [nzTitle]="'subcontracting.step.basics' | translate"></nz-step>
        <nz-step [nzTitle]="'subcontracting.step.source' | translate"></nz-step>
        <nz-step [nzTitle]="'subcontracting.step.components' | translate"></nz-step>
        <nz-step [nzTitle]="'subcontracting.step.review' | translate"></nz-step>
      </nz-steps>

      @if (feedback(); as failure) {
        <nz-alert
          class="feedback"
          nzType="error"
          nzShowIcon
          nzCloseable
          [nzMessage]="failure.errorKey ?? 'subcontracting.error.generic' | translate: failure.params"
          [nzDescription]="failure.detail ?? null"
          (nzOnClose)="feedback.set(null)"
        ></nz-alert>
      }

      @switch (step()) {
        @case (0) {
          <h3 class="section-title">{{ 'subcontracting.section.wizardBasics' | translate }}</h3>
          <div class="form-grid">
            <div class="field">
              <span>{{ 'subcontracting.field.direction' | translate }}</span>
              <nz-radio-group [(ngModel)]="form.direction" (ngModelChange)="directionChanged()" data-test="direction">
                @for (item of directions; track item) {
                  <label nz-radio [nzValue]="item">{{ 'subcontracting.direction.' + item | translate }}</label>
                }
              </nz-radio-group>
              @if (form.direction === 'active') {
                <nz-tag class="zero-value" nzColor="purple">{{ 'subcontracting.badge.zeroValue' | translate }}</nz-tag>
              }
            </div>
            <div class="field">
              <span>{{ 'subcontracting.field.type' | translate }}</span>
              <nz-radio-group [(ngModel)]="form.subcontracting_type" data-test="type">
                @for (item of types; track item) {
                  <label nz-radio [nzValue]="item">{{ 'subcontracting.type.' + item | translate }}</label>
                }
              </nz-radio-group>
            </div>
            <label class="field" for="sct-f-partner">
              <span>{{
                (form.direction === 'passive' ? 'subcontracting.field.supplier' : 'subcontracting.field.customer') | translate
              }}</span>
              <nz-select nzId="sct-f-partner" nzShowSearch [(ngModel)]="form.partner_id" data-test="partner">
                @for (item of partnerOptions(); track item.value) {
                  <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="sct-f-product">
              <span>{{ 'subcontracting.field.outputProduct' | translate }}</span>
              <nz-select nzId="sct-f-product" nzShowSearch [(ngModel)]="form.output_product_id" data-test="product">
                @for (item of options().products; track item.value) {
                  <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="sct-f-qty">
              <span>{{ 'subcontracting.field.plannedQuantity' | translate }}</span>
              <nz-input-number nzId="sct-f-qty" [nzMin]="0" [nzStep]="1" [(ngModel)]="form.planned_quantity" data-test="quantity"></nz-input-number>
            </label>
            <label class="field" for="sct-f-cost">
              <span>{{ 'subcontracting.field.unitServiceCost' | translate }}</span>
              <nz-input-number nzId="sct-f-cost" [nzMin]="0" [nzStep]="0.5" [(ngModel)]="form.unit_service_cost"></nz-input-number>
            </label>
            <label class="field" for="sct-f-currency">
              <span>{{ 'subcontracting.field.currency' | translate }}</span>
              <input nz-input id="sct-f-currency" maxlength="3" [(ngModel)]="form.currency" />
            </label>
            <label class="field" for="sct-f-return">
              <span>{{ 'subcontracting.field.expectedReturnDate' | translate }}</span>
              <nz-date-picker nzId="sct-f-return" [(ngModel)]="form.expected_return_date"></nz-date-picker>
            </label>
          </div>
        }
        @case (1) {
          <h3 class="section-title">{{ 'subcontracting.section.wizardSource' | translate }}</h3>
          <div class="form-grid">
            <label class="field" for="sct-f-bom">
              <span>{{ 'subcontracting.field.bom' | translate }}</span>
              <nz-select nzId="sct-f-bom" nzAllowClear nzShowSearch [(ngModel)]="form.bom_id" data-test="bom">
                @for (item of options().boms; track item.value) {
                  <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="sct-f-po">
              <span>{{ 'subcontracting.field.productionOrder' | translate }}</span>
              <nz-select nzId="sct-f-po" nzAllowClear nzShowSearch [(ngModel)]="form.linked_production_order_id">
                @for (item of options().productionOrders; track item.value) {
                  <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
                }
              </nz-select>
            </label>
            @if (form.subcontracting_type === 'single_operation') {
              <label class="field" for="sct-f-op">
                <span>{{ 'subcontracting.field.routingOperation' | translate }}</span>
                <input nz-input id="sct-f-op" maxlength="200" [(ngModel)]="form.routing_operation_label" />
              </label>
            }
            <label class="field" for="sct-f-wh">
              <span>{{ 'subcontracting.field.sourceWarehouse' | translate }}</span>
              <nz-select nzId="sct-f-wh" nzAllowClear [(ngModel)]="form.source_warehouse_id">
                @for (item of options().warehouses; track item.value) {
                  <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="sct-f-customs">
              <span>{{ 'subcontracting.field.customsRegime' | translate }}</span>
              <nz-select nzId="sct-f-customs" [(ngModel)]="form.customs_regime" data-test="customs">
                @for (item of regimes(); track item) {
                  <nz-option [nzValue]="item" [nzLabel]="'subcontracting.customsRegime.' + item | translate"></nz-option>
                }
              </nz-select>
            </label>
            @if (form.direction === 'passive') {
              <label nz-checkbox [(ngModel)]="form.generate_service_purchase_order" data-test="generate-po">
                {{ 'subcontracting.field.generatePurchaseOrder' | translate }}
              </label>
            }
          </div>
          <p class="muted">{{ 'subcontracting.hint.virtualWarehouse' | translate }}</p>
        }
        @case (2) {
          <h3 class="section-title">{{ 'subcontracting.section.wizardComponents' | translate }}</h3>
          @if (form.bom_id !== null) {
            <nz-alert nzType="info" nzShowIcon [nzMessage]="'subcontracting.hint.componentsFromBom' | translate"></nz-alert>
          } @else {
            <p class="muted">{{ 'subcontracting.hint.componentsManual' | translate }}</p>
            @for (row of form.components; track $index; let i = $index) {
              <div class="line-row" [attr.data-test]="'line-' + i">
                <nz-select nzShowSearch [(ngModel)]="row.component_product_id" [nzPlaceHolder]="'subcontracting.field.component' | translate">
                  @for (item of options().products; track item.value) {
                    <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
                  }
                </nz-select>
                <nz-input-number [nzMin]="0" [nzStep]="0.1" [(ngModel)]="row.required_qty_per_unit"></nz-input-number>
                <input nz-input maxlength="20" [(ngModel)]="row.unit_of_measure" />
                <button nz-button nzDanger type="button" (click)="removeLine(i)">
                  {{ 'subcontracting.action.removeLine' | translate }}
                </button>
              </div>
            }
            <button nz-button type="button" data-test="add-line" (click)="addLine()">
              {{ 'subcontracting.action.addLine' | translate }}
            </button>
          }
        }
        @default {
          <h3 class="section-title">{{ 'subcontracting.section.summary' | translate }}</h3>
          <div class="preview-box">
            <dl>
              <dt>{{ 'subcontracting.field.direction' | translate }}</dt>
              <dd>{{ 'subcontracting.direction.' + form.direction | translate }}</dd>
              <dt>{{ 'subcontracting.field.type' | translate }}</dt>
              <dd>{{ 'subcontracting.type.' + form.subcontracting_type | translate }}</dd>
              <dt>{{ 'subcontracting.field.plannedQuantity' | translate }}</dt>
              <dd>{{ form.planned_quantity }}</dd>
              <dt>{{ 'subcontracting.field.customsRegime' | translate }}</dt>
              <dd>{{ 'subcontracting.customsRegime.' + form.customs_regime | translate }}</dd>
            </dl>
          </div>
          @if (form.bom_id === null) {
            <nz-table nzSize="small" [nzData]="form.components" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'subcontracting.field.component' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.perUnit' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.planned' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of form.components; track $index) {
                  <tr>
                    <td>{{ labelOf('products', row.component_product_id) }}</td>
                    <td class="num">{{ row.required_qty_per_unit }} {{ row.unit_of_measure }}</td>
                    <td class="num">{{ planned(row.required_qty_per_unit) }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
          @if (form.direction === 'active') {
            <nz-alert nzType="info" nzShowIcon [nzMessage]="'subcontracting.hint.zeroValue' | translate"></nz-alert>
          }
        }
      }

      <div class="wizard-actions">
        <a nz-button routerLink="/subcontracting/orders">{{ 'subcontracting.action.cancel' | translate }}</a>
        @if (step() > 0) {
          <button nz-button type="button" data-test="back" (click)="back()">
            {{ 'subcontracting.action.back' | translate }}
          </button>
        }
        @if (step() < 3) {
          <button nz-button nzType="primary" type="button" data-test="next" [disabled]="!valid()" (click)="next()">
            {{ 'subcontracting.action.next' | translate }}
          </button>
        } @else {
          <button
            nz-button
            nzType="primary"
            type="button"
            data-test="save"
            [nzLoading]="store.saving()"
            [disabled]="!valid()"
            (click)="save()"
          >
            {{ 'subcontracting.action.save' | translate }}
          </button>
        }
      </div>
    </div>
  `,
})
export class OrderFormComponent implements OnInit {
  protected readonly store = inject(OrdersStore);
  private readonly lookups = inject(SubcontractingLookupService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly directions = SCT_DIRECTIONS;
  protected readonly types = SCT_TYPES;

  protected form: SctOrderForm = emptyOrderForm();
  protected readonly step = signal(0);
  protected readonly feedback = signal<SctOutcome | null>(null);
  protected readonly options = signal<Record<SctLookupName, SctOption[]>>({
    suppliers: [],
    customers: [],
    products: [],
    warehouses: [],
    boms: [],
    productionOrders: [],
  });

  async ngOnInit(): Promise<void> {
    const names: SctLookupName[] = ['suppliers', 'customers', 'products', 'warehouses', 'boms', 'productionOrders'];
    const lists = await Promise.all(names.map((name) => firstValueFrom(this.lookups.options(name))));
    this.options.set(Object.fromEntries(names.map((name, index) => [name, lists[index]])) as Record<SctLookupName, SctOption[]>);
  }

  protected partnerOptions(): SctOption[] {
    return this.form.direction === 'passive' ? this.options().suppliers : this.options().customers;
  }

  protected regimes() {
    return regimesFor(this.form.direction);
  }

  /** A new direction brings another kind of partner and another customs regime: what was picked no longer fits. */
  protected directionChanged(): void {
    this.form.partner_id = null;
    this.form.customs_regime = 'none';
    this.form.generate_service_purchase_order = false;
  }

  protected valid(): boolean {
    return stepIsValid(this.step(), this.form);
  }

  protected next(): void {
    if (this.valid()) {
      this.step.update((current) => Math.min(3, current + 1));
    }
  }

  protected back(): void {
    this.step.update((current) => Math.max(0, current - 1));
  }

  protected addLine(): void {
    this.form.components = [...this.form.components, { component_product_id: null, required_qty_per_unit: null, unit_of_measure: 'PCS' }];
  }

  protected removeLine(index: number): void {
    this.form.components = this.form.components.filter((_, position) => position !== index);
  }

  protected planned(perUnit: number | null): number {
    return plannedFor(perUnit, this.form.planned_quantity);
  }

  protected labelOf(name: SctLookupName, id: string | null): string {
    return this.options()[name].find((item) => item.value === id)?.label ?? id ?? '—';
  }

  protected async save(): Promise<void> {
    const outcome = await this.store.create(buildOrderPayload(this.form));
    if (outcome.ok && outcome.order !== null) {
      this.message.success(this.i18n.instant('subcontracting.message.saved'));
      await this.router.navigate(['/subcontracting/orders', outcome.order.id]);
    } else {
      this.feedback.set(outcome);
    }
  }
}

