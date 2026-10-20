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
  ],
  template: `
    <div class="login-wrapper">
      <div class="login-box">
        <div class="login-header">
          <i class="fa-solid fa-receipt brand-icon"></i>
          <h1>Fattura Facile ERP</h1>
          <p class="subtitle">Piattaforma Enterprise Cross-Border Italia / Svizzera</p>
        </div>

        <nz-card [nzBordered]="false" class="login-card">
          <form nz-form [formGroup]="loginForm" (ngSubmit)="onSubmit()" nzLayout="vertical">
            <nz-form-item>
              <nz-form-label nzRequired>Azienda / Tenant Preset</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="tenantId" nzSize="large">
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
              <nz-form-label nzRequired>Email Aziendale</nz-form-label>
              <nz-form-control nzErrorTip="Inserisci un indirizzo email valido">
                <nz-input-group nzPrefixIcon="user" nzSize="large">
                  <input type="email" nz-input formControlName="email" placeholder="m.rossi@rossiimpianti.it" />
                </nz-input-group>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired>Password</nz-form-label>
              <nz-form-control nzErrorTip="Password richiesta">
                <nz-input-group nzPrefixIcon="lock" nzSize="large">
                  <input type="password" nz-input formControlName="password" placeholder="••••••••" />
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
              <i class="fa-solid fa-right-to-bracket fa-icon-spaced"></i> Accedi a Fattura Facile
            </button>
          </form>

          <nz-divider nzText="Modalità Demo Attiva" />
          <div class="demo-info">
            <p><i class="fa-solid fa-circle-check" style="color: #52c41a;"></i> Mock Data Engine attivo (nessun server richiesto)</p>
            <p>Seleziona un tenant per simulare il regime fiscale <strong>Italia (SDI)</strong> o <strong>Svizzera (QR-Bill / ArG)</strong>.</p>
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
      font-size: 42px;
      color: #38bdf8;
      margin-bottom: 12px;
    }

    .login-header h1 {
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 6px;
    }

    .login-card {
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
    }

    .login-btn {
      margin-top: 8px;
      border-radius: 6px;
      font-weight: 600;
    }

    .demo-info {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }

    .demo-info p {
      margin: 4px 0;
    }
  `,
})
export class LoginComponent {
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  isLoading = false;

  readonly loginForm = new FormGroup({
    tenantId: new FormControl('t-it-01', { nonNullable: true }),
    email: new FormControl('m.rossi@rossiimpianti.it', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('demo-password', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const tenantId = this.loginForm.controls.tenantId.value;
      setTimeout(() => {
        this.authStore.login(tenantId);
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      }, 300);
    }
  }
}
