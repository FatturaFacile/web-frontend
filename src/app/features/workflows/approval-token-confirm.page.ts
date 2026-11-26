import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStore, I18nService, SupportedLanguage, WorkflowApiService, WorkflowRemoteApprovalPreview } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';

/** States of the public confirmation page. */
export type TokenPageState = 'loading' | 'confirm' | 'login_required' | 'done' | 'expired' | 'forbidden' | 'invalid' | 'error';

/**
 * Public page of an emailed approval link (`/approve/:token?action=approve|reject`, Mod 006). The link only opens a
 * preview: nothing is decided until the approver confirms here. When the document needs a fresh proof of identity
 * (`requires_reauth`) the approver must be signed in and enter the password or a one-time code.
 */
@Component({
  selector: 'app-approval-token-confirm-page',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzInputModule,
    NzResultModule,
    NzSelectModule,
    NzSpinModule,
    TranslatePipe,
  ],
  template: `
    <main class="page">
      <header class="top">
        <h1>{{ 'workflows.token.title' | translate }}</h1>
        <nz-select [ngModel]="language()" (ngModelChange)="switchLanguage($event)" [attr.aria-label]="'workflows.token.language' | translate">
          @for (lang of languages; track lang) {
            <nz-option [nzValue]="lang" [nzLabel]="lang.toUpperCase()"></nz-option>
          }
        </nz-select>
      </header>

      @switch (state()) {
        @case ('loading') {
          <nz-spin nzSimple></nz-spin>
        }
        @case ('confirm') {
          @if (preview(); as data) {
            <nz-card>
              <p class="lead">
                {{ (data.action === 'approve' ? 'workflows.token.leadApprove' : 'workflows.token.leadReject') | translate }}
              </p>
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
                <nz-descriptions-item [nzTitle]="'workflows.token.document' | translate">{{ data.subject_label }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'workflows.token.type' | translate">
                  {{ 'workflows.subject_types.' + data.subject_type | translate }}
                </nz-descriptions-item>
                @if (data.amount !== null) {
                  <nz-descriptions-item [nzTitle]="'workflows.token.amount' | translate">
                    {{ data.amount | number: '1.2-2' }} {{ data.currency }}
                  </nz-descriptions-item>
                }
                @if (data.requester_name) {
                  <nz-descriptions-item [nzTitle]="'workflows.token.requester' | translate">{{ data.requester_name }}</nz-descriptions-item>
                }
                @if (data.expires_at) {
                  <nz-descriptions-item [nzTitle]="'workflows.token.expiresAt' | translate">{{ data.expires_at | date: 'medium' }}</nz-descriptions-item>
                }
              </nz-descriptions>

              <label for="token-comment">
                {{ 'workflows.token.comment' | translate }}
                @if (data.action === 'reject') {
                  <span class="required" aria-hidden="true">*</span>
                }
              </label>
              <textarea id="token-comment" nz-input rows="3" maxlength="2000" [ngModel]="comment()" (ngModelChange)="comment.set($event)" [attr.aria-required]="data.action === 'reject'"></textarea>

              @if (data.requires_reauth) {
                <nz-alert class="gap" nzType="info" nzShowIcon [nzMessage]="'workflows.token.reauthHint' | translate"></nz-alert>
                <label for="token-password">{{ 'workflows.token.password' | translate }}</label>
                <input id="token-password" nz-input type="password" autocomplete="current-password" [ngModel]="password()" (ngModelChange)="password.set($event)" />
                <label for="token-otp">{{ 'workflows.token.otp' | translate }}</label>
                <input id="token-otp" nz-input inputmode="numeric" autocomplete="one-time-code" maxlength="8" [ngModel]="otp()" (ngModelChange)="otp.set($event)" />
              }

              @if (formError(); as error) {
                <p class="error" role="alert">{{ error | translate }}</p>
              }

              <button
                nz-button
                nzBlock
                nzSize="large"
                class="gap"
                [nzType]="data.action === 'approve' ? 'primary' : 'default'"
                [nzDanger]="data.action === 'reject'"
                [nzLoading]="submitting()"
                data-testid="confirm"
                (click)="confirm()"
              >
                {{ (data.action === 'approve' ? 'workflows.token.confirmApprove' : 'workflows.token.confirmReject') | translate }}
              </button>
            </nz-card>
          }
        }
        @case ('login_required') {
          <nz-result nzStatus="info" [nzTitle]="'workflows.token.loginRequired' | translate" [nzSubTitle]="'workflows.token.loginRequiredHint' | translate">
            <div nz-result-extra>
              <button nz-button nzType="primary" data-testid="login" (click)="goToLogin()">
                {{ 'workflows.token.login' | translate }}
              </button>
            </div>
          </nz-result>
        }
        @case ('done') {
          <nz-result nzStatus="success" [nzTitle]="'workflows.token.done.' + (preview()?.action ?? 'approve') | translate" [nzSubTitle]="'workflows.token.doneHint' | translate"></nz-result>
        }
        @case ('expired') {
          <nz-result nzStatus="warning" [nzTitle]="'workflows.token.expired' | translate" [nzSubTitle]="'workflows.token.expiredHint' | translate"></nz-result>
        }
        @case ('forbidden') {
          <nz-result nzStatus="403" [nzTitle]="'workflows.token.forbidden' | translate" [nzSubTitle]="'workflows.token.forbiddenHint' | translate"></nz-result>
        }
        @case ('invalid') {
          <nz-result nzStatus="error" [nzTitle]="'workflows.token.invalid' | translate" [nzSubTitle]="'workflows.token.invalidHint' | translate"></nz-result>
        }
        @default {
          <nz-result nzStatus="error" [nzTitle]="'workflows.token.failed' | translate" [nzSubTitle]="'workflows.token.failedHint' | translate"></nz-result>
        }
      }
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: #f5f7fa;
    }
    .page {
      max-width: 560px;
      margin: 0 auto;
      padding: 16px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      margin: 0;
    }
    .lead {
      font-size: 16px;
      font-weight: 500;
    }
    label {
      display: block;
      margin: 12px 0 4px;
      font-weight: 500;
    }
    .gap {
      margin-top: 16px;
    }
    .required,
    .error {
      color: var(--error-color, #cf1322);
    }
  `,
})
export class ApprovalTokenConfirmPageComponent implements OnInit {
  private readonly api = inject(WorkflowApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18nService);

  readonly languages: readonly SupportedLanguage[] = ['it', 'de', 'fr', 'en'];
  readonly language = computed(() => this.i18n.currentLanguage());

  readonly state = signal<TokenPageState>('loading');
  readonly preview = signal<WorkflowRemoteApprovalPreview | null>(null);
  readonly comment = signal('');
  readonly password = signal('');
  readonly otp = signal('');
  readonly formError = signal<string | null>(null);
  readonly submitting = signal(false);

  private token = '';
  private action: 'approve' | 'reject' = 'approve';

  /** Where the login sends the approver back to. */
  returnUrl(): string {
    return `/approve/${encodeURIComponent(this.token)}?action=${this.action}`;
  }

  goToLogin(): void {
    void this.router.navigate(['/login'], { queryParams: { returnUrl: this.returnUrl() } });
  }

  ngOnInit(): void {
    this.token = (this.route.snapshot.paramMap.get('token') ?? '').trim();
    const rawAction = (this.route.snapshot.queryParamMap.get('action') ?? '').trim().toLowerCase();
    if (this.token === '' || (rawAction !== 'approve' && rawAction !== 'reject')) {
      this.state.set('invalid');
      return;
    }
    this.action = rawAction;
    this.api.getRemoteApprovalPreview(this.token, this.action).subscribe({
      next: (res) => {
        this.preview.set(res.data);
        // A re-authenticated approval is made by a signed-in approver, so the email link first goes through the login.
        this.state.set(res.data.requires_reauth && !this.auth.isAuthenticated() ? 'login_required' : 'confirm');
      },
      error: (error: unknown) => this.state.set(this.stateOfError(error)),
    });
  }

  switchLanguage(language: SupportedLanguage): void {
    void this.i18n.setLanguage(language);
  }

  /** Validation of the form before anything is sent: the translation key of the problem, or null. */
  private inputProblem(data: WorkflowRemoteApprovalPreview): string | null {
    if (data.action === 'reject' && this.comment().trim() === '') {
      return 'workflows.token.error.commentRequired';
    }
    if (data.requires_reauth && this.password().trim() === '' && this.otp().trim() === '') {
      return 'workflows.token.error.proofRequired';
    }
    return null;
  }

  confirm(): void {
    const data = this.preview();
    if (!data || this.submitting()) {
      return;
    }
    const problem = this.inputProblem(data);
    this.formError.set(problem);
    if (problem) {
      return;
    }
    const comment = this.comment().trim();
    this.submitting.set(true);
    this.api
      .confirmRemoteApproval(this.token, {
        action: data.action,
        confirm: true,
        ...(comment !== '' ? { comment } : {}),
        ...(data.requires_reauth && this.password() !== '' ? { password: this.password() } : {}),
        ...(data.requires_reauth && this.otp().trim() !== '' ? { otp: this.otp().trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.password.set('');
          this.otp.set('');
          this.state.set('done');
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.password.set('');
          this.otp.set('');
          // A failed re-authentication (403) or a validation error (422) leaves the form open to try again.
          if (data.requires_reauth && error instanceof HttpErrorResponse && (error.status === 403 || error.status === 422)) {
            this.formError.set('workflows.token.error.reauthFailed');
            return;
          }
          if (error instanceof HttpErrorResponse && error.status === 422) {
            this.formError.set('workflows.token.error.validation');
            return;
          }
          this.state.set(this.stateOfError(error));
        },
      });
  }

  private stateOfError(error: unknown): TokenPageState {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 410) {
        return 'expired';
      }
      if (error.status === 403) {
        return 'forbidden';
      }
      if (error.status === 404) {
        return 'invalid';
      }
    }
    return 'error';
  }
}
