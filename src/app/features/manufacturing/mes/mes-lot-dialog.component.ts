import { Component, computed, effect, ElementRef, input, model, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { MesKeypadComponent } from './mes-keypad.component';
import { isPositiveQuantity } from './mes-keypad.utils';
import { MesLotInput } from './mes-board.store';
import { MesComponent } from './mes.models';

/**
 * Touch dialog of the material lot registration (Italian: materia prima utilizzata, lotto). The lot field takes the focus
 * as soon as the dialog opens, so a barcode scanner (a keyboard that ends with Enter) fills it and Enter moves on to the
 * quantity, or confirms when the quantity is already typed. Components of the order are large tiles.
 */
@Component({
  selector: 'app-mes-lot-dialog',
  imports: [FormsModule, TranslatePipe, NzButtonModule, NzInputModule, NzModalModule, MesKeypadComponent],
  styles: `
    .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 16px }
    .tile {
      min-height: 72px; padding: 6px 10px; border: 3px solid #0b1f33; border-radius: 12px; background: #ffffff;
      color: #0b1f33; font-weight: 600; text-align: left; touch-action: manipulation; cursor: pointer;
    }
    .tile small { display: block; font-weight: 400 }
    .tile[aria-pressed='true'] { background: #0b1f33; color: #ffffff }
    .tile:focus-visible { outline: 4px solid #ffb000; outline-offset: 2px }
    .lot { font-size: 1.5rem; height: 64px; margin-bottom: 16px }
    .over { display: flex; align-items: center; gap: 10px; margin-top: 16px; font-size: 1.1rem }
    .over input { width: 28px; height: 28px }
  `,
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'MFG_MES.LOT_TITLE' | translate"
      [nzContent]="content"
      [nzFooter]="footer"
      [nzWidth]="720"
      (nzOnCancel)="close()"
    >
      <ng-template #content>
        <div class="tiles" role="group" [attr.aria-label]="'MFG_MES.COMPONENT' | translate">
          @for (component of components(); track component.mfg_item_id) {
            <button type="button" class="tile" [attr.data-testid]="'component-' + component.item_code" [attr.aria-pressed]="itemId() === component.mfg_item_id" (click)="itemId.set(component.mfg_item_id)">
              {{ component.item_code }}
              <small>{{ component.item_name }}</small>
              <small>{{ component.consumed_quantity }} / {{ component.required_quantity }}</small>
            </button>
          }
        </div>

        <input
          #lotInput
          nz-input
          class="lot"
          data-testid="lot-input"
          autocomplete="off"
          autocapitalize="characters"
          inputmode="text"
          [placeholder]="'MFG_MES.SCAN_LOT' | translate"
          [attr.aria-label]="'MFG_MES.LOT' | translate"
          [ngModel]="lot()"
          (ngModelChange)="lot.set($event)"
          (keydown.enter)="onEnter($event)"
        />

        <app-mes-keypad label="MFG_MES.QUANTITY" [value]="quantity()" (valueChange)="quantity.set($event)"></app-mes-keypad>

        <label class="over">
          <input type="checkbox" data-testid="over-consumption" [ngModel]="overConsumption()" (ngModelChange)="overConsumption.set($event)" />
          {{ 'MFG_MES.CONFIRM_OVER_CONSUMPTION' | translate }}
        </label>
      </ng-template>
      <ng-template #footer>
        <button nz-button nzSize="large" type="button" (click)="close()">{{ 'MFG_MES.CANCEL' | translate }}</button>
        <button nz-button nzSize="large" nzType="primary" type="button" data-testid="confirm-lot" [disabled]="!canConfirm() || busy()" [nzLoading]="busy()" (click)="confirm()">
          {{ 'MFG_MES.REGISTER_LOT' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class MesLotDialogComponent {
  readonly visible = model(false);
  readonly busy = input(false);
  readonly components = input<MesComponent[]>([]);
  readonly confirmed = output<MesLotInput>();

  protected readonly itemId = signal<string | null>(null);
  protected readonly lot = signal('');
  protected readonly quantity = signal('0');
  protected readonly overConsumption = signal(false);
  private readonly lotInput = viewChild<ElementRef<HTMLInputElement>>('lotInput');

  private readonly selectedComponent = computed(() => this.components().find((component) => component.mfg_item_id === this.itemId()) ?? null);
  /** An item, a positive quantity and, for a lot-tracked item, the scanned lot. */
  protected readonly canConfirm = computed(() => {
    const component = this.selectedComponent();

    return component !== null && isPositiveQuantity(this.quantity()) && (!component.lot_tracked || this.lot().trim() !== '');
  });

  constructor() {
    effect(() => {
      if (this.visible() && this.components().length === 1 && this.itemId() === null) {
        this.itemId.set(this.components()[0]?.mfg_item_id ?? null);
      }
    });
    effect(() => {
      const input = this.lotInput();
      if (this.visible() && input) {
        queueMicrotask(() => input.nativeElement.focus());
      }
    });
  }

  /** A scanner ends the code with Enter: confirm when everything is typed, else move on to the quantity. */
  protected onEnter(event: Event): void {
    event.preventDefault();
    if (this.canConfirm()) {
      this.confirm();
    }
  }

  protected close(): void {
    this.reset();
    this.visible.set(false);
  }

  protected confirm(): void {
    const itemId = this.itemId();
    if (!itemId || !this.canConfirm()) {
      return;
    }
    const lot = this.lot().trim();
    this.confirmed.emit({ mfgItemId: itemId, lotCode: lot === '' ? null : lot, quantity: this.quantity(), overConsumptionConfirmed: this.overConsumption() });
  }

  /** Clears the form once a registration succeeded (the parent calls it) or the dialog closes. */
  reset(): void {
    this.itemId.set(null);
    this.lot.set('');
    this.quantity.set('0');
    this.overConsumption.set(false);
  }
}
