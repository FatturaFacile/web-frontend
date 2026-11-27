import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { SctComponent, SctComponentOverride, SctOrder, SctReceiptPayload, SctReceiptPlanLine, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { OrderDetailStore } from './order-detail.store';
import { isoDay, SctOutcome } from './subcontracting.util';

interface OverrideRow {
  component: SctComponent;
  consumed: number | null;
  scrap: number | null;
}

/**
 * Receipt of the processed goods of a passive order: the good units and the scrap declared by the subcontractor, the vendor DDT, the
 * automatic backflush of the components (BOM or routing ratio, overridable with the actual quantities) and the preview of the cost the
 * goods are capitalized at, with the external processing fee included (Mod 059 / Mod 067).
 */
@Component({
  selector: 'app-sct-receive-dialog',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="720"
      [nzTitle]="'subcontracting.modal.receive' | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
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

        <p class="muted">{{ 'subcontracting.hint.receive' | translate: { open: order().open_quantity } }}</p>

        <div class="form-grid">
          <label class="field" for="sct-r-good">
            <span>{{ 'subcontracting.field.goodQuantity' | translate }}</span>
            <nz-input-number nzId="sct-r-good" [nzMin]="0" [(ngModel)]="good" (ngModelChange)="changed()" data-test="good"></nz-input-number>
          </label>
          <label class="field" for="sct-r-scrap">
            <span>{{ 'subcontracting.field.scrapUnits' | translate }}</span>
            <nz-input-number nzId="sct-r-scrap" [nzMin]="0" [(ngModel)]="scrapUnits" (ngModelChange)="changed()" data-test="scrap"></nz-input-number>
          </label>
          <label class="field" for="sct-r-date">
            <span>{{ 'subcontracting.field.date' | translate }}</span>
            <nz-date-picker nzId="sct-r-date" [(ngModel)]="date"></nz-date-picker>
          </label>
          <label class="field" for="sct-r-ddt">
            <span>{{ 'subcontracting.field.vendorDdtNumber' | translate }}</span>
            <input nz-input id="sct-r-ddt" maxlength="60" [(ngModel)]="vendorDdtNumber" />
          </label>
          <label class="field" for="sct-r-ddt-date">
            <span>{{ 'subcontracting.field.vendorDdtDate' | translate }}</span>
            <nz-date-picker nzId="sct-r-ddt-date" [(ngModel)]="vendorDdtDate"></nz-date-picker>
          </label>
        </div>

        <h4 class="section-title">{{ 'subcontracting.section.backflush' | translate }}</h4>
        <p class="muted">{{ 'subcontracting.hint.backflush' | translate }}</p>
        <nz-table nzSize="small" [nzData]="overrides()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'subcontracting.field.component' | translate }}</th>
              <th scope="col" class="num">{{ 'subcontracting.field.held' | translate }}</th>
              <th scope="col" class="num">{{ 'subcontracting.field.consumed' | translate }}</th>
              <th scope="col" class="num">{{ 'subcontracting.field.scrap' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of overrides(); track row.component.id) {
              <tr [attr.data-test]="'override-' + row.component.id">
                <td>
                  {{ row.component.product_name ?? row.component.component_product_id }}
                  <small class="muted">{{ row.component.sku }}</small>
                </td>
                <td class="num">{{ row.component.held_qty }} {{ row.component.unit_of_measure }}</td>
                <td class="num">
                  <nz-input-number
                    [nzMin]="0"
                    [nzPlaceHolder]="autoOf(row.component.id, 'consumed')"
                    [(ngModel)]="row.consumed"
                    (ngModelChange)="clearPlan()"
                  ></nz-input-number>
                </td>
                <td class="num">
                  <nz-input-number
                    [nzMin]="0"
                    [nzPlaceHolder]="autoOf(row.component.id, 'scrap')"
                    [(ngModel)]="row.scrap"
                    (ngModelChange)="clearPlan()"
                  ></nz-input-number>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>

        @if (store.plan(); as plan) {
          <div class="preview-box" data-test="plan">
            <h4 class="section-title">{{ 'subcontracting.section.capitalization' | translate }}</h4>
            <dl>
              <dt>{{ 'subcontracting.preview.componentsValue' | translate }}</dt>
              <dd>{{ plan.components_value }} {{ order().currency }}</dd>
              <dt>{{ 'subcontracting.preview.serviceFee' | translate }}</dt>
              <dd>{{ plan.service_amount }} {{ order().currency }}</dd>
              <dt class="total">{{ 'subcontracting.preview.totalCost' | translate }}</dt>
              <dd class="total">{{ plan.total_cost }} {{ order().currency }}</dd>
              <dt class="total">{{ 'subcontracting.preview.unitCost' | translate }}</dt>
              <dd class="total" data-test="unit-cost">{{ plan.unit_cost }} {{ order().currency }}</dd>
            </dl>
          </div>
        }

        <p class="actions-bar">
          <button nz-button type="button" data-test="preview" [nzLoading]="store.previewing()" (click)="preview()">
            {{ 'subcontracting.action.preview' | translate }}
          </button>
          <button nz-button nzType="primary" type="button" data-test="submit" [nzLoading]="store.saving()" (click)="submit()">
            {{ 'subcontracting.action.receive' | translate }}
          </button>
          <button nz-button type="button" (click)="closed.emit()">{{ 'subcontracting.action.close' | translate }}</button>
        </p>
      </ng-container>
    </nz-drawer>
  `,
})
export class ReceiveDialogComponent {
  readonly order = input.required<SctOrder>();
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly store = inject(OrderDetailStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly overrides = signal<OverrideRow[]>([]);
  protected readonly feedback = signal<SctOutcome | null>(null);

  protected good: number | null = null;
  protected scrapUnits: number | null = null;
  protected date: Date | null = null;
  protected vendorDdtNumber = '';
  protected vendorDdtDate: Date | null = null;

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.reset(this.order());
      }
    });
  }

  private reset(order: SctOrder): void {
    this.feedback.set(null);
    this.store.clearPlan();
    this.good = Number(order.open_quantity);
    this.scrapUnits = null;
    this.date = null;
    this.vendorDdtNumber = '';
    this.vendorDdtDate = null;
    this.overrides.set((order.components ?? []).map((component) => ({ component, consumed: null, scrap: null })));
  }

  protected clearPlan(): void {
    this.store.clearPlan();
  }

  protected changed(): void {
    this.store.clearPlan();
  }

  /** The quantity the backflush proposes for a component, shown as the placeholder of the override. */
  protected autoOf(componentId: string, field: 'consumed' | 'scrap'): string {
    const line: SctReceiptPlanLine | undefined = this.store.plan()?.lines.find((item) => item.component_id === componentId);
    return line ? line[field] : '';
  }

  private payload(): SctReceiptPayload {
    const components: SctComponentOverride[] = this.overrides()
      .filter((row) => row.consumed !== null || row.scrap !== null)
      .map((row) => ({
        component_id: row.component.id,
        ...(row.consumed !== null ? { consumed_qty: String(row.consumed) } : {}),
        ...(row.scrap !== null ? { scrap_qty: String(row.scrap) } : {}),
      }));

    return {
      good_quantity: String(this.good ?? 0),
      scrap_quantity: String(this.scrapUnits ?? 0),
      ...(isoDay(this.date) ? { date: isoDay(this.date) } : {}),
      ...(this.vendorDdtNumber.trim() ? { vendor_ddt_number: this.vendorDdtNumber.trim() } : {}),
      ...(isoDay(this.vendorDdtDate) ? { vendor_ddt_date: isoDay(this.vendorDdtDate) } : {}),
      ...(components.length > 0 ? { components } : {}),
    };
  }

  protected async preview(): Promise<void> {
    const outcome = await this.store.preview(this.payload());
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async submit(): Promise<void> {
    const outcome = await this.store.receive(this.payload());
    if (outcome.ok) {
      this.message.success(this.i18n.instant('subcontracting.message.receive'));
      this.closed.emit();
    } else {
      this.feedback.set(outcome);
    }
  }
}
