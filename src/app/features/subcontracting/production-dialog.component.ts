import { Component, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { SctOrder, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { OrderDetailStore } from './order-detail.store';
import { SctOption, SubcontractingLookupService } from './subcontracting-lookup.service';
import { isoDay, SctOutcome } from './subcontracting.util';

/**
 * The production on the customer's material of an active order: good and scrapped units and the Mod 064 production order that ran.
 * The components are consumed from the customer-goods warehouse, the processed goods enter it, both still owned by the customer.
 */
@Component({
  selector: 'app-sct-production-dialog',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="520"
      [nzTitle]="'subcontracting.modal.produce' | translate"
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

        <p class="muted">{{ 'subcontracting.hint.produce' | translate: { open: order().open_quantity } }}</p>
        <nz-tag class="zero-value" nzColor="purple">{{ 'subcontracting.badge.zeroValue' | translate }}</nz-tag>

        <div class="form-grid">
          <label class="field" for="sct-p-good">
            <span>{{ 'subcontracting.field.goodQuantity' | translate }}</span>
            <nz-input-number nzId="sct-p-good" [nzMin]="0" [(ngModel)]="good" data-test="good"></nz-input-number>
          </label>
          <label class="field" for="sct-p-scrap">
            <span>{{ 'subcontracting.field.scrapUnits' | translate }}</span>
            <nz-input-number nzId="sct-p-scrap" [nzMin]="0" [(ngModel)]="scrapUnits"></nz-input-number>
          </label>
          <label class="field" for="sct-p-date">
            <span>{{ 'subcontracting.field.date' | translate }}</span>
            <nz-date-picker nzId="sct-p-date" [(ngModel)]="date"></nz-date-picker>
          </label>
          <label class="field" for="sct-p-order">
            <span>{{ 'subcontracting.field.productionOrder' | translate }}</span>
            <nz-select nzId="sct-p-order" nzAllowClear nzShowSearch [(ngModel)]="productionOrderId">
              @for (item of productionOrders(); track item.value) {
                <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
              }
            </nz-select>
          </label>
        </div>

        <p class="actions-bar">
          <button nz-button nzType="primary" type="button" data-test="submit" [nzLoading]="store.saving()" (click)="submit()">
            {{ 'subcontracting.action.produce' | translate }}
          </button>
          <button nz-button type="button" (click)="closed.emit()">{{ 'subcontracting.action.close' | translate }}</button>
        </p>
      </ng-container>
    </nz-drawer>
  `,
})
export class ProductionDialogComponent implements OnInit {
  readonly order = input.required<SctOrder>();
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly store = inject(OrderDetailStore);
  private readonly lookups = inject(SubcontractingLookupService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly feedback = signal<SctOutcome | null>(null);
  protected readonly productionOrders = signal<SctOption[]>([]);

  protected good: number | null = null;
  protected scrapUnits: number | null = null;
  protected date: Date | null = null;
  protected productionOrderId: string | null = null;

  constructor() {
    effect(() => {
      if (this.visible()) {
        const order = this.order();
        this.feedback.set(null);
        this.good = Number(order.open_quantity);
        this.scrapUnits = null;
        this.date = null;
        this.productionOrderId = order.linked_production_order_id;
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.productionOrders.set(await firstValueFrom(this.lookups.options('productionOrders')));
  }

  protected async submit(): Promise<void> {
    const outcome = await this.store.produce({
      good_quantity: String(this.good ?? 0),
      scrap_quantity: String(this.scrapUnits ?? 0),
      ...(isoDay(this.date) ? { date: isoDay(this.date) } : {}),
      ...(this.productionOrderId ? { production_order_id: this.productionOrderId } : {}),
    });
    if (outcome.ok) {
      this.message.success(this.i18n.instant('subcontracting.message.produce'));
      this.closed.emit();
    } else {
      this.feedback.set(outcome);
    }
  }
}
