import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { AuthStore } from '@core';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzRadioModule,
    NzSelectModule,
    NzDividerModule,
    TranslatePipe,
  ],
  template: `
    <div class="login-wrapper">
      <div class="login-box">
        <div class="login-header">
          <i class="fa-solid fa-receipt brand-icon"></i>
          <h1>{{ 'AUTH.TITLE' | translate }}</h1>
          <p class="subtitle">{{ 'AUTH.SUBTITLE' | translate }}</p>
        </div>

        <nz-card [nzBordered]="false" class="login-card">
          <form nz-form [formGroup]="loginForm" (ngSubmit)="onSubmit()" nzLayout="vertical">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'AUTH.TENANT_PRESET' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="tenantId" nzSize="large" [attr.aria-label]="'AUTH.TENANT_PRESET' | translate">
                  @for (tenant of authStore.tenants(); track tenant.id) {
                    <nz-option
                      [nzValue]="tenant.id"
                      [nzLabel]="tenant.name + ' (' + (tenant.jurisdiction === 'IT' ? '🇮🇹 Italia - EUR' : '🇨🇭 Svizzera - CHF') + ')'"
                    />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired>{{ 'AUTH.EMAIL' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'AUTH.EMAIL_ERROR' | translate">
                <nz-input-group nzPrefixIcon="user" nzSize="large">
                  <input
                    type="email"
                    nz-input
                    formControlName="email"
                    placeholder="m.rossi@rossiimpianti.it"
                    [attr.aria-label]="'AUTH.EMAIL' | translate"
                  />
                </nz-input-group>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired>{{ 'AUTH.PASSWORD' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'AUTH.PASSWORD_ERROR' | translate">
                <nz-input-group nzPrefixIcon="lock" nzSize="large">
                  <input
                    type="password"
                    nz-input
                    formControlName="password"
                    placeholder="••••••••"
                    [attr.aria-label]="'AUTH.PASSWORD' | translate"
                  />
                </nz-input-group>
              </nz-form-control>
            </nz-form-item>

            <button
              nz-button
              nzType="primary"
              nzSize="large"
              nzBlock
              [nzLoading]="isLoading"
              class="login-btn"
            >
              <i class="fa-solid fa-right-to-bracket fa-icon-spaced"></i> {{ 'AUTH.SUBMIT_BTN' | translate }}
            </button>
          </form>

          <nz-divider [nzText]="'AUTH.DEMO_MODE' | translate" />
          <div class="demo-info">
            <p><i class="fa-solid fa-circle-check" style="color: #10b981;"></i> {{ 'AUTH.DEMO_INFO1' | translate }}</p>
            <p>{{ 'AUTH.DEMO_INFO2' | translate }}</p>
          </div>
        </nz-card>
      </div>
    </div>
  `,
  styles: `
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 24px;
    }

    .login-box {
      width: 100%;
      max-width: 440px;
    }

    .login-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .brand-icon {
      font-size: 40px;
      color: var(--primary-color, #0d9488);
      margin-bottom: 12px;
    }

    .login-header h1 {
      color: #ffffff;
      font-size: 26px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }

    .subtitle {
      color: #94a3b8;
      font-size: 13px;
      margin-top: 6px;
      margin-bottom: 0;
    }

    .login-card {
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
      background: var(--bg-card, #ffffff);
    }

    .login-btn {
      height: 44px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 8px;
      margin-top: 8px;
    }

    .demo-info {
      font-size: 12px;
      color: var(--text-secondary, #64748b);
      line-height: 1.5;
    }

    .demo-info p {
      margin-bottom: 6px;
    }
  `,
})
export class LoginComponent {
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  isLoading = false;

  readonly loginForm = new FormGroup({
    tenantId: new FormControl('t-it-01', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('m.rossi@rossiimpianti.it', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('password123', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const { tenantId } = this.loginForm.getRawValue();
      setTimeout(() => {
        this.authStore.login(tenantId);
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      }, 400);
    }
  }
}
