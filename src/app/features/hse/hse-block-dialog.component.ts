import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ClearanceResult } from './hse.models';
import { certificateKey, reasonKey } from './hse.utils';

/**
 * Hard-block dialog shared by the dispatch screens of the MES (Mod 064), field service (Mod 084) and construction sites
 * (Mod 108): it says why a worker may not be assigned and which HSE requirement must be resolved first. It opens only for a
 * verdict that is not cleared; the prescriptions of a cleared worker are shown as warnings by the host screen.
 *
 * The requirement brief asks for `<ff-hse-block-dialog>`; the project lint rule fixes the `app` selector prefix, so it is
 * `<app-hse-block-dialog>`.
 */
@Component({
  selector: 'app-hse-block-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzModalModule, NzButtonModule, NzTagModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="isOpen()"
      [nzTitle]="'HSE.BLOCK_TITLE' | translate"
      [nzFooter]="footer"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <p data-testid="block-intro">{{ 'HSE.BLOCK_INTRO' | translate: { name: employeeName() } }}</p>
        <ul class="reason-list" data-testid="block-reasons">
          @for (reason of reasons(); track $index) {
            <li>
              <nz-tag nzColor="error">{{ reasonLabel(reason) | translate }}</nz-tag>
              <strong>{{ subjectLabel(reason.subject) | translate }}</strong>
              @if (reason.expires_at) {
                <span class="muted">{{ 'HSE.EXPIRES_ON' | translate: { date: reason.expires_at } }}</span>
              }
            </li>
          }
        </ul>
        @if (result()?.warnings?.length) {
          <h4>{{ 'HSE.BLOCK_WARNINGS' | translate }}</h4>
          <ul data-testid="block-warnings">
            @for (warning of result()?.warnings; track $index) {
              <li>{{ warning }}</li>
            }
          </ul>
        }
      </ng-container>
      <ng-template #footer>
        <button nz-button nzType="primary" type="button" data-testid="block-close" (click)="closed.emit()">
          {{ 'HSE.BLOCK_CLOSE' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class HseBlockDialogComponent {
  /** The verdict of the gatekeeper, or null while nothing was checked. */
  readonly result = input<ClearanceResult | null>(null);
  readonly employeeName = input<string>('');
  readonly closed = output<void>();

  protected isOpen(): boolean {
    const result = this.result();

    return result !== null && !result.is_cleared;
  }

  protected reasons(): ClearanceResult['blocking_reasons'] {
    return this.result()?.blocking_reasons ?? [];
  }

  protected reasonLabel = reasonKey;
  protected subjectLabel = certificateKey;
}
