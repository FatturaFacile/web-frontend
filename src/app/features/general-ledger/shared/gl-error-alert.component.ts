import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { TranslatePipe } from '@shared';

/**
 * Shows the message of a 422 response (missing accounts, rounding account, exchange rate, retained earnings...)
 * with a link to the ledger settings where those accounts are configured.
 */
@Component({
  selector: 'app-gl-error-alert',
  styleUrl: './gl-error-alert.component.scss',
  imports: [NzAlertModule, RouterLink, TranslatePipe],
  template: `
    @if (message(); as text) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="text" [nzDescription]="description" />
      <ng-template #description>
        <a routerLink="/general-ledger/settings">{{ 'GL.OPEN_SETTINGS' | translate }}</a>
      </ng-template>
    }
  `,
})
export class GlErrorAlertComponent {
  readonly error = input<unknown>(null);

  protected readonly message = computed<string | null>(() => {
    const err = this.error();
    if (!(err instanceof HttpErrorResponse) || err.status !== 422) {
      return null;
    }
    const body = err.error as { message?: string; errors?: Record<string, string[]> } | null;
    const first = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    return first ?? body?.message ?? err.message;
  });
}
