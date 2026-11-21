import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { AuthApiService } from '../api/auth-api.service';
import { AuthStore } from '../auth/auth.store';
import { I18nService } from '../i18n';
import { PermissionStore } from './permission.store';

/**
 * A persistent, high-visibility banner while the access is a support impersonation. The impersonated session lasts
 * 30 minutes at most; leaving signs it out. It renders nothing for a normal session.
 */
@Component({
  selector: 'app-impersonation-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NzButtonModule],
  template: `
    @if (impersonation(); as info) {
      <div class="impersonation-banner" role="alert" data-testid="impersonation-banner">
        <strong>{{ title() }}</strong>
        @if (info.expires_at) {
          <span>{{ untilLabel() }} {{ info.expires_at | date: 'HH:mm' }}</span>
        }
        <button nz-button nzSize="small" nzType="default" type="button" (click)="leave()">{{ leaveLabel() }}</button>
      </div>
    }
  `,
  styles: [
    `
      .impersonation-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        background: #b42318;
        color: #fff;
      }
      .impersonation-banner button {
        margin-left: auto;
      }
    `,
  ],
})
export class ImpersonationBannerComponent {
  private readonly store = inject(PermissionStore);
  private readonly i18n = inject(I18nService);
  private readonly authApi = inject(AuthApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly impersonation = this.store.impersonation;
  protected readonly title = computed(() => this.i18n.translate('IAM.IMPERSONATION_BANNER'));
  protected readonly untilLabel = computed(() => this.i18n.translate('IAM.IMPERSONATION_UNTIL'));
  protected readonly leaveLabel = computed(() => this.i18n.translate('IAM.IMPERSONATION_LEAVE'));

  protected leave(): void {
    const done = (): void => {
      this.authStore.logout();
      void this.router.navigate(['/login']);
    };
    this.authApi.logout().subscribe({ next: done, error: done });
  }
}
