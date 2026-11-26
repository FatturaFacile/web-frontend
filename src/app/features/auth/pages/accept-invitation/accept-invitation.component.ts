import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { AccessApiService, applyServerErrors, AuthStore, InvitationPreview, isValidationError } from '@core';
import { TranslatePipe } from '@shared';
import { AuthFooterComponent } from '../../components/auth-footer.component';
import { AuthToolbarComponent } from '../../components/auth-toolbar.component';
import { passwordsMatch } from '../../password-rules';
import { PasswordStrengthComponent } from '../../components/password-strength/password-strength.component';


type InvitationState = 'loading' | 'ready' | 'invalid' | 'accepted' | 'failed';

/**
 * Public page of the link in the invitation email (it is outside the authentication guard). A new person sets name and
 * password; whoever already has an account signs in first and accepts with that session.
 */
@Component({
  selector: 'app-accept-invitation',
  styleUrl: './accept-invitation.component.scss',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSpinModule,
    AuthFooterComponent,
    AuthToolbarComponent,
    PasswordStrengthComponent,
    TranslatePipe,
  ],
  template: `
    <main class="login-wrapper">
      <div class="login-box">
        <app-auth-toolbar />

        <header class="login-header text-center">
          <h1>Fattura <span class="facile-color">Facile</span></h1>
          <p>{{ 'access.accept.title' | translate }}</p>
        </header>
        <nz-card [nzBordered]="false" class="login-card">
          <div aria-live="polite">
            @switch (state()) {
              @case ('loading') {
                <p class="text-center"><nz-spin nzSimple /> {{ 'access.accept.checking' | translate }}</p>
              }
              @case ('invalid') {
                <nz-alert
                  class="login-alert"
                  data-test="invitation-invalid"
                  nzType="error"
                  nzShowIcon
                  [nzMessage]="'access.accept.invalidTitle' | translate"
                  [nzDescription]="'access.accept.invalidBody' | translate"
                />
              }
              @case ('failed') {
                <nz-alert
                  class="login-alert"
                  nzType="error"
                  nzShowIcon
                  [nzMessage]="errorMessage() ?? ('access.accept.failed' | translate)"
                />
              }
              @case ('accepted') {
                <nz-alert
                  class="login-alert"
                  data-test="invitation-accepted"
                  nzType="success"
                  nzShowIcon
                  [nzMessage]="'access.accept.doneTitle' | translate"
                  [nzDescription]="'access.accept.doneBody' | translate: { company: result()?.tenant_name ?? '' }"
                />
                <a nz-button nzType="primary" nzBlock routerLink="/login">{{ 'AUTH.GO_TO_LOGIN' | translate }}</a>
              }
            }
          </div>

          @if (state() === 'ready' && invitation(); as preview) {
            <p data-test="invitation-summary">
              {{ 'access.accept.summary' | translate: { company: preview.tenant_name, email: preview.email } }}
            </p>

            @if (errorMessage(); as message) {
              <nz-alert class="login-alert" nzType="error" nzShowIcon [nzMessage]="message" />
            }

            @if (preview.has_account) {
              @if (signedIn()) {
                <button
                  nz-button
                  nzType="primary"
                  nzSize="large"
                  nzBlock
                  type="button"
                  data-test="accept-with-session"
                  [nzLoading]="isSubmitting()"
                  (click)="acceptWithSession()"
                >
                  {{ 'access.accept.accept' | translate }}
                </button>
              } @else {
                <nz-alert
                  class="login-alert"
                  data-test="sign-in-first"
                  nzType="info"
                  nzShowIcon
                  [nzMessage]="'access.accept.signInFirst' | translate"
                />
                <a nz-button nzType="primary" nzBlock data-test="sign-in" routerLink="/login" [queryParams]="loginQuery()">{{
                  'AUTH.GO_TO_LOGIN' | translate
                }}</a>
              }
            } @else {
              <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="onSubmit()">
                <nz-form-item>
                  <nz-form-label nzRequired nzFor="name">{{ 'access.accept.name' | translate }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="nameError">
                    <input nz-input id="name" formControlName="name" autocomplete="name" maxlength="255" />
                  </nz-form-control>
                  <ng-template #nameError let-control>
                    @if (control.hasError('serverError')) {
                      {{ control.getError('serverError') }}
                    } @else {
                      {{ 'COMMON.VALIDATION.REQUIRED' | translate }}
                    }
                  </ng-template>
                </nz-form-item>

                <nz-form-item>
                  <nz-form-label nzRequired nzFor="password">{{ 'AUTH.NEW_PASSWORD' | translate }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="passwordError">
                    <input
                      nz-input
                      id="password"
                      type="password"
                      formControlName="password"
                      autocomplete="new-password"
                      aria-describedby="password-requirements"
                    />
                    <app-password-strength id="password-requirements" [password]="password()" [email]="invitation()?.email ?? null" />
                  </nz-form-control>
                  <ng-template #passwordError let-control>
                    @if (control.hasError('serverError')) {
                      {{ control.getError('serverError') }}
                    } @else {
                      {{ 'COMMON.VALIDATION.REQUIRED' | translate }}
                    }
                  </ng-template>
                </nz-form-item>

                <nz-form-item>
                  <nz-form-label nzRequired nzFor="password_confirmation">{{
                    'AUTH.PASSWORD_CONFIRMATION' | translate
                  }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="confirmationError">
                    <input
                      nz-input
                      id="password_confirmation"
                      type="password"
                      formControlName="password_confirmation"
                      autocomplete="new-password"
                    />
                  </nz-form-control>
                  <ng-template #confirmationError let-control>
                    @if (control.hasError('mismatch')) {
                      {{ 'AUTH.PASSWORD_MISMATCH' | translate }}
                    } @else {
                      {{ 'COMMON.VALIDATION.REQUIRED' | translate }}
                    }
                  </ng-template>
                </nz-form-item>

                <button
                  nz-button
                  nzType="primary"
                  nzSize="large"
                  nzBlock
                  type="submit"
                  data-test="create-account"
                  [nzLoading]="isSubmitting()"
                  [disabled]="form.invalid"
                >
                  {{ 'access.accept.createAccount' | translate }}
                </button>
              </form>
            }
          }

          <p class="text-center">
            <a routerLink="/login">{{ 'AUTH.BACK_TO_LOGIN' | translate }}</a>
          </p>
        </nz-card>
        <app-auth-footer />
      </div>
    </main>
  `,
})
export class AcceptInvitationComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(AccessApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);

  private token = '';

  protected readonly state = signal<InvitationState>('loading');
  protected readonly invitation = signal<InvitationPreview | null>(null);
  protected readonly result = signal<{ tenant_name: string } | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly signedIn = computed(() => this.authStore.isAuthenticated());
  /** After signing in the person comes back here to accept (the link of the email carries the token). */
  protected readonly loginQuery = computed(() => ({ returnUrl: `/accept-invitation?token=${encodeURIComponent(this.token)}` }));

  protected readonly form = this.fb.group(
    {
      name: this.fb.control('', [Validators.required]),
      password: this.fb.control('', [Validators.required]),
      password_confirmation: this.fb.control('', [Validators.required]),
    },
    { validators: passwordsMatch },
  );

  protected readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('invalid');
      return;
    }

    this.token = token;
    this.api.previewInvitation(token).subscribe({
      next: (res) => {
        this.invitation.set(res.data);
        this.state.set('ready');
      },
      error: (err: unknown) => this.state.set(err instanceof HttpErrorResponse && err.status === 404 ? 'invalid' : 'failed'),
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.updateValueAndValidity();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);
    this.api.acceptInvitation(this.token, this.form.getRawValue()).subscribe({
      next: (res) => this.done(res.data.tenant_name),
      error: (err: unknown) => this.fail(err, true),
    });
  }

  protected acceptWithSession(): void {
    this.errorMessage.set(null);
    this.isSubmitting.set(true);
    this.api.acceptInvitation(this.token).subscribe({
      next: (res) => this.done(res.data.tenant_name),
      error: (err: unknown) => this.fail(err, false),
    });
  }

  private done(tenantName: string): void {
    this.isSubmitting.set(false);
    this.result.set({ tenant_name: tenantName });
    this.state.set('accepted');
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  private fail(err: unknown, mapToForm: boolean): void {
    this.isSubmitting.set(false);
    if (mapToForm && isValidationError(err)) {
      this.errorMessage.set(applyServerErrors(this.form, err)[0] ?? null);
      return;
    }
    const body = err instanceof HttpErrorResponse ? (err.error as { detail?: string } | null) : null;
    if (err instanceof HttpErrorResponse && err.status === 404) {
      this.state.set('invalid');
      return;
    }
    // 409 (already a member, plan limit reached, invitation no longer valid): the server says why.
    this.errorMessage.set(body?.detail ?? null);
    this.state.set(body?.detail ? 'ready' : 'failed');
  }
}
