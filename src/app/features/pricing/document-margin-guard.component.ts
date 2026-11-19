import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { MarginDocumentCheck, MarginDocumentType, PricingApiService } from '@core';
import { TranslatePipe } from '@shared';
import { MarginBadgeComponent } from './margin-badge.component';
import { MarginOverrideModalComponent } from './margin-override-modal.component';
import { canConfirmDocument } from './pricing.util';

/**
 * Margin guardrail of a stored sales document: the badge of its weakest line, and for a document below the minimum
 * margin the "Authorize margin override" action. `blockedChange` tells the host to keep the confirmation disabled.
 */
@Component({
  selector: 'app-document-margin-guard',
  imports: [MarginBadgeComponent, MarginOverrideModalComponent, NzButtonModule, TranslatePipe],
  template: `
    @if (check(); as current) {
      <div class="margin-guard" data-testid="margin-guard">
        <app-margin-badge [status]="current.status" [percent]="current.margin_percent" />
        @if (blocked()) {
          <button
            nz-button
            nzType="default"
            nzDanger
            type="button"
            (click)="overrideOpen.set(true)"
          >
            {{ 'PRICING.OVERRIDE_REQUEST' | translate }}
          </button>
        }
        <app-margin-override-modal
          [(visible)]="overrideOpen"
          [documentType]="documentType()"
          [documentId]="documentId()"
          [status]="current.status"
          [marginPercent]="current.margin_percent"
          [thresholdPercent]="current.threshold_percent"
          (approved)="load()"
        />
      </div>
    }
  `,
  styles: `
    .margin-guard {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 12px 0;
    }
  `,
})
export class DocumentMarginGuardComponent {
  private readonly api = inject(PricingApiService);

  readonly documentType = input.required<MarginDocumentType>();
  readonly documentId = input.required<string>();
  readonly blockedChange = output<boolean>();

  readonly check = signal<MarginDocumentCheck | null>(null);
  readonly overrideOpen = signal(false);
  readonly blocked = signal(false);

  constructor() {
    effect(() => {
      this.documentId();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.api.checkDocumentMargin(this.documentType(), this.documentId()).subscribe({
      next: (response) => {
        this.check.set(response.data);
        const blocked = !canConfirmDocument(response.data.status, response.data.has_approval);
        this.blocked.set(blocked);
        this.blockedChange.emit(blocked);
      },
      // Without the pricing module (or the right to read it) the document is not guarded here; the API still decides.
      error: () => {
        this.check.set(null);
        this.blocked.set(false);
        this.blockedChange.emit(false);
      },
    });
  }
}
