import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { AuthApiService } from '@core';
import { TranslatePipe } from '@shared';

type ResendState = 'idle' | 'sending' | 'sent' | 'throttled' | 'failed';

/** Requests a new verification link. The backend answers the same way for unknown addresses. */
@Component({
  selector: 'app-resend-verification',
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzInputModule, TranslatePipe],
  template: `
    @if (state() === 'sent') {
      <nz-alert nzType="success" nzShowIcon [nzMessage]="'AUTH.RESEND_SENT' | translate" />
    } @else {
      <form class="resend" (ngSubmit)="resend()">
        <label for="resend-email">{{ 'AUTH.EMAIL' | translate }}</label>
        <input
          nz-input
          id="resend-email"
          name="email"
          type="email"
          autocomplete="email"
          required
          [ngModel]="address()"
          (ngModelChange)="address.set($event)"
        />
        <button
          nz-button
          nzBlock
          type="submit"
          [disabled]="!address().trim()"
          [nzLoading]="state() === 'sending'"
        >
          {{ 'AUTH.RESEND_BTN' | translate }}
        </button>
      </form>
      @if (state() === 'throttled') {
        <nz-alert nzType="warning" nzShowIcon [nzMessage]="'AUTH.TOO_MANY_ATTEMPTS' | translate" />
      }
      @if (state() === 'failed') {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="'AUTH.RESEND_FAILED' | translate" />
      }
    }
  `,
  styles: `
    .resend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 8px;
    }
  `,
})
export class ResendVerificationComponent {
  private readonly authApi = inject(AuthApiService);

  readonly email = input('');

  protected readonly address = linkedSignal(() => this.email());
  protected readonly state = signal<ResendState>('idle');

  protected resend(): void {
    const email = this.address().trim();
    if (!email) {
      return;
    }
    this.state.set('sending');
    this.authApi.resendVerificationEmail(email).subscribe({
      next: () => this.state.set('sent'),
      error: (err: unknown) =>
        this.state.set(
          err instanceof HttpErrorResponse && err.status === 429 ? 'throttled' : 'failed',
        ),
    });
  }
}
