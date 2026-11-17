import { Component, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { MarginDocumentType, MarginStatus, PricingApiService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { apiErrorText } from '../rebates/rebates.util';
import { MarginBadgeComponent } from './margin-badge.component';

/**
 * "Request / authorize margin override" modal of a sales document. An authorized role confirms the below-threshold
 * margin with a note; the API refuses anyone else (403) and the document can then be confirmed.
 */
@Component({
  selector: 'app-margin-override-modal',
  imports: [
    FormsModule,
    MarginBadgeComponent,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [(nzVisible)]="visible"
      [nzTitle]="'PRICING.OVERRIDE_TITLE' | translate"
      [nzOkLoading]="saving()"
      [nzOkText]="'PRICING.OVERRIDE_APPROVE' | translate"
      (nzOnCancel)="visible.set(false)"
      (nzOnOk)="approve()"
    >
      <ng-container *nzModalContent>
        <p>{{ 'PRICING.OVERRIDE_INTRO' | translate }}</p>
        <p class="override-margin">
          <app-margin-badge [status]="status()" [percent]="marginPercent()" />
          <span>{{ 'PRICING.OVERRIDE_THRESHOLD' | translate }}: {{ thresholdPercent() }} %</span>
        </p>
        <label for="override-notes">{{ 'PRICING.OVERRIDE_NOTES' | translate }}</label>
        <textarea
          nz-input
          id="override-notes"
          rows="3"
          maxlength="2000"
          [(ngModel)]="notes"
        ></textarea>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .override-margin {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  `,
})
export class MarginOverrideModalComponent {
  private readonly api = inject(PricingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly documentType = input.required<MarginDocumentType>();
  readonly documentId = input.required<string>();
  readonly status = input<MarginStatus>('BLOCKED');
  readonly marginPercent = input<string | null>(null);
  readonly thresholdPercent = input<string | null>(null);
  readonly approved = output<void>();

  readonly saving = signal(false);
  notes = '';

  approve(): void {
    this.saving.set(true);
    this.api.approveMarginOverride(this.documentType(), this.documentId(), this.notes).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this.notes = '';
        this.message.success(this.translate.instant('PRICING.OVERRIDE_APPROVED'));
        this.approved.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('PRICING.ACTION_ERROR'));
      },
    });
  }
}
