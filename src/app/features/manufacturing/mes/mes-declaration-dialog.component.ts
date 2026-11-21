import { Component, computed, input, model, output, signal } from '@angular/core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { MesKeypadComponent } from './mes-keypad.component';
import { isPositiveQuantity } from './mes-keypad.utils';
import { MES_DEFECT_REASONS, MesDefectReason } from './mes.models';
import { MesDeclarationInput } from './mes-board.store';

type Field = 'good' | 'scrap';

/**
 * Touch dialog of the production declaration: good pieces (Italian: pezzi buoni) and scrapped pieces (pezzi scartati)
 * on a numeric keypad with quick increments. Scrapped pieces cannot be confirmed without a defect reason tile.
 */
@Component({
  selector: 'app-mes-declaration-dialog',
  imports: [TranslatePipe, NzButtonModule, NzModalModule, MesKeypadComponent],
  styles: `
    .switch { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px }
    .field {
      min-height: 84px; border: 3px solid #0b1f33; border-radius: 14px; background: #ffffff; color: #0b1f33;
      font-size: 1.1rem; font-weight: 600; touch-action: manipulation; cursor: pointer;
    }
    .field strong { display: block; font-size: 2rem; font-variant-numeric: tabular-nums }
    .field[aria-pressed='true'] { background: #0b1f33; color: #ffffff }
    .field.scrap[aria-pressed='true'] { background: #8c1d18; border-color: #8c1d18 }
    .field:focus-visible { outline: 4px solid #ffb000; outline-offset: 2px }
    .reasons { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-top: 16px }
    .tile {
      min-height: 64px; border: 3px solid #8c1d18; border-radius: 12px; background: #ffffff; color: #8c1d18;
      font-size: 1.05rem; font-weight: 600; touch-action: manipulation; cursor: pointer;
    }
    .tile[aria-pressed='true'] { background: #8c1d18; color: #ffffff }
    .tile:focus-visible { outline: 4px solid #ffb000; outline-offset: 2px }
  `,
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'MFG_MES.DECLARE_TITLE' | translate"
      [nzContent]="content"
      [nzFooter]="footer"
      [nzWidth]="720"
      (nzOnCancel)="close()"
    >
      <ng-template #content>
        <div class="switch" role="group" [attr.aria-label]="'MFG_MES.DECLARE_TITLE' | translate">
          <button type="button" class="field" data-testid="field-good" [attr.aria-pressed]="field() === 'good'" (click)="field.set('good')">
            {{ 'MFG_MES.GOOD_PIECES' | translate }}<strong>{{ good() }}</strong>
          </button>
          <button type="button" class="field scrap" data-testid="field-scrap" [attr.aria-pressed]="field() === 'scrap'" (click)="field.set('scrap')">
            {{ 'MFG_MES.SCRAP_PIECES' | translate }}<strong>{{ scrap() }}</strong>
          </button>
        </div>

        @if (field() === 'good') {
          <app-mes-keypad label="MFG_MES.GOOD_PIECES" [value]="good()" (valueChange)="good.set($event)"></app-mes-keypad>
        } @else {
          <app-mes-keypad label="MFG_MES.SCRAP_PIECES" [value]="scrap()" (valueChange)="scrap.set($event)"></app-mes-keypad>
        }

        @if (hasScrap()) {
          <h3>{{ 'MFG_MES.DEFECT_REASON' | translate }}</h3>
          <div class="reasons" role="group" [attr.aria-label]="'MFG_MES.DEFECT_REASON' | translate">
            @for (reason of reasons; track reason) {
              <button type="button" class="tile" [attr.data-testid]="'defect-' + reason" [attr.aria-pressed]="defect() === reason" (click)="defect.set(reason)">
                {{ 'RES.V.' + reason | translate }}
              </button>
            }
          </div>
        }
      </ng-template>
      <ng-template #footer>
        <button nz-button nzSize="large" type="button" (click)="close()">{{ 'MFG_MES.CANCEL' | translate }}</button>
        <button nz-button nzSize="large" nzType="primary" type="button" data-testid="confirm-declare" [disabled]="!canConfirm() || busy()" [nzLoading]="busy()" (click)="confirm()">
          {{ 'MFG_MES.DECLARE' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class MesDeclarationDialogComponent {
  readonly visible = model(false);
  readonly busy = input(false);
  readonly confirmed = output<MesDeclarationInput>();

  protected readonly reasons = MES_DEFECT_REASONS;
  protected readonly field = signal<Field>('good');
  protected readonly good = signal('0');
  protected readonly scrap = signal('0');
  protected readonly defect = signal<MesDefectReason | null>(null);

  protected readonly hasScrap = computed(() => isPositiveQuantity(this.scrap()));
  /** Something declared, and a defect reason whenever pieces are scrapped. */
  protected readonly canConfirm = computed(
    () => (isPositiveQuantity(this.good()) || this.hasScrap()) && (!this.hasScrap() || this.defect() !== null),
  );

  protected close(): void {
    this.reset();
    this.visible.set(false);
  }

  protected confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
    this.confirmed.emit({
      goodQuantity: this.good(),
      scrapQuantity: this.hasScrap() ? this.scrap() : '0',
      defectReason: this.hasScrap() ? this.defect() : null,
      note: null,
    });
    this.reset();
  }

  private reset(): void {
    this.field.set('good');
    this.good.set('0');
    this.scrap.set('0');
    this.defect.set(null);
  }
}
