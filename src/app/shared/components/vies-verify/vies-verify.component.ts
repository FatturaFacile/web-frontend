import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ViesApiService } from '@core/api/vies-api.service';
import { parseEuVat, ViesValidationResult } from '@core/models/vies.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * "Verify VIES" button with its result badge, placed next to an EU VAT number input.
 * Syntax errors are caught in the browser (no request); a VIES outage shows a warning badge and never blocks the form.
 */
@Component({
  selector: 'app-vies-verify',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzButtonModule, NzTagModule, NzTooltipModule, TranslatePipe],
  template: `
    <button
      nz-button
      nzSize="small"
      type="button"
      [nzLoading]="loading()"
      [disabled]="!vatNumber()"
      (click)="verify()"
    >
      {{ 'VIES.VERIFY' | translate }}
    </button>
    @if (formatError()) {
      <nz-tag nzColor="error">{{ 'VIES.FORMAT_ERROR' | translate }}</nz-tag>
    }
    @if (result(); as r) {
      @switch (r.status) {
        @case ('valid') {
          <nz-tag
            nzColor="success"
            nz-tooltip
            [nzTooltipTitle]="detail()"
          >
            {{ 'VIES.VALID' | translate }}
            @if (r.request_identifier) {
              · {{ 'VIES.CONSULTATION_ID' | translate }}: {{ r.request_identifier }}
            }
          </nz-tag>
          @if (r.trader_name) {
            <span class="vies-trader">{{ r.trader_name }}</span>
          }
        }
        @case ('invalid') {
          <nz-tag nzColor="error">{{ 'VIES.INVALID' | translate }}</nz-tag>
        }
        @default {
          <nz-tag nzColor="warning" nz-tooltip [nzTooltipTitle]="'VIES.UNAVAILABLE_HINT' | translate">
            {{ 'VIES.UNAVAILABLE' | translate }}
          </nz-tag>
        }
      }
    }
  `,
})
export class ViesVerifyComponent {
  private readonly api = inject(ViesApiService);

  readonly vatNumber = input<string | null>('');
  readonly country = input<string | null>(null);
  /** When set, the backend stamps the verification on this CRM counterparty. */
  readonly contactId = input<string | null>(null);

  readonly verified = output<ViesValidationResult>();

  protected readonly loading = signal(false);
  protected readonly formatError = signal(false);
  protected readonly result = signal<ViesValidationResult | null>(null);

  protected readonly detail = computed(() => {
    const r = this.result();
    return [r?.trader_name, r?.trader_address, r?.validated_at].filter(Boolean).join(' — ');
  });

  verify(): void {
    const value = this.vatNumber() ?? '';
    this.result.set(null);
    this.formatError.set(false);
    if (!parseEuVat(value, this.country())) {
      this.formatError.set(true);
      return;
    }
    this.loading.set(true);
    this.api
      .validate({
        vat_number: value,
        country_code: this.country(),
        contact_id: this.contactId(),
      })
      .subscribe({
        next: (res) => {
          this.result.set(res.data);
          this.verified.emit(res.data);
          this.loading.set(false);
        },
        error: () => {
          // Network or server error: treated like a VIES outage, the form stays usable.
          this.result.set({
            status: 'unavailable',
            is_valid: null,
            country_code: this.country() ?? '',
            vat_number: value,
            trader_name: null,
            trader_address: null,
            request_identifier: null,
            validated_at: new Date().toISOString(),
            error_code: 'SERVICE_UNAVAILABLE',
            from_cache: false,
          });
          this.loading.set(false);
        },
      });
  }
}
