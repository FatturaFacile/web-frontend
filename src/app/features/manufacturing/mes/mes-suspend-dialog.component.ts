import { Component, input, model, output, signal } from '@angular/core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { MES_SUSPENSION_REASONS, MesSuspensionReason } from './mes.models';

/**
 * Touch dialog of the suspension (Italian: sospensione): one large tile per reason code, then confirm. The reason is
 * mandatory, so the confirm button stays disabled until a tile is chosen.
 */
@Component({
  selector: 'app-mes-suspend-dialog',
  imports: [TranslatePipe, NzButtonModule, NzModalModule],
  styles: `
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .tile {
      min-height: 84px;
      padding: 8px 12px;
      border: 3px solid #0b1f33;
      border-radius: 14px;
      background: #ffffff;
      color: #0b1f33;
      font-size: 1.15rem;
      font-weight: 600;
      touch-action: manipulation;
      cursor: pointer;
    }
    .tile[aria-pressed='true'] {
      background: #0b1f33;
      color: #ffffff;
    }
    .tile:focus-visible {
      outline: 4px solid #ffb000;
      outline-offset: 2px;
    }
  `,
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'MFG_MES.SUSPEND_TITLE' | translate"
      [nzContent]="content"
      [nzFooter]="footer"
      [nzWidth]="720"
      (nzOnCancel)="close()"
    >
      <ng-template #content>
        <p>{{ 'MFG_MES.SUSPEND_HINT' | translate }}</p>
        <div class="tiles" role="group" [attr.aria-label]="'MFG_MES.SUSPEND_TITLE' | translate">
          @for (reason of reasons; track reason) {
            <button
              type="button"
              class="tile"
              [attr.data-testid]="'reason-' + reason"
              [attr.aria-pressed]="selected() === reason"
              (click)="selected.set(reason)"
            >
              {{ 'RES.V.' + reason | translate }}
            </button>
          }
        </div>
      </ng-template>
      <ng-template #footer>
        <button nz-button nzSize="large" type="button" (click)="close()">
          {{ 'MFG_MES.CANCEL' | translate }}
        </button>
        <button
          nz-button
          nzSize="large"
          nzType="primary"
          type="button"
          data-testid="confirm-suspend"
          [disabled]="selected() === null || busy()"
          [nzLoading]="busy()"
          (click)="confirm()"
        >
          {{ 'MFG_MES.SUSPEND' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class MesSuspendDialogComponent {
  readonly visible = model(false);
  readonly busy = input(false);
  readonly confirmed = output<MesSuspensionReason>();

  protected readonly reasons = MES_SUSPENSION_REASONS;
  protected readonly selected = signal<MesSuspensionReason | null>(null);

  protected close(): void {
    this.selected.set(null);
    this.visible.set(false);
  }

  protected confirm(): void {
    const reason = this.selected();
    if (reason) {
      this.confirmed.emit(reason);
      this.selected.set(null);
    }
  }
}
