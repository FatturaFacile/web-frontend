import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { PortalAreaApiService } from '@core/api/portal-area-api.service';
import { TranslatePipe } from '@shared';
import { PortalSessionService } from './portal-session.service';

type LoginState = 'idle' | 'sending' | 'sent' | 'failed';

/** `/portal/login`: asks for the e-mail and sends the magic link. The answer never tells whether the address is known. */
@Component({
  selector: 'app-portal-login',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzInputModule,
    TranslatePipe,
  ],
  template: `
    <section class="login-card">
      @if (session.branding()?.logo_url; as logo) {
        <img class="login-logo" [src]="logo" [alt]="session.branding()?.company_name ?? ''" />
      }
      <h1>{{ 'PORTAL_AREA.LOGIN_TITLE' | translate }}</h1>
      <p>{{ 'PORTAL_AREA.LOGIN_INTRO' | translate }}</p>

      @if (state() === 'sent') {
        <nz-alert nzType="success" [nzMessage]="'PORTAL_AREA.LINK_SENT' | translate" nzShowIcon />
      } @else {
        <form (submit)="submit($event)" novalidate>
          <label for="portal-email">{{ 'PORTAL_AREA.EMAIL' | translate }}</label>
          <input
            nz-input
            id="portal-email"
            type="email"
            autocomplete="email"
            inputmode="email"
            [formControl]="email"
          />
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-checkbox [formControl]="consent">
            {{ 'PORTAL_AREA.PRIVACY_CONSENT' | translate }}
            @if (session.branding()?.privacy_policy_url; as policy) {
              <a [href]="policy" target="_blank" rel="noopener noreferrer">{{
                'PORTAL_AREA.PRIVACY_POLICY' | translate
              }}</a>
            }
          </label>
          @if (state() === 'failed') {
            <nz-alert
              nzType="error"
              [nzMessage]="'PORTAL_AREA.LOADING_ERROR' | translate"
              nzShowIcon
            />
          }
          <button
            nz-button
            nzType="primary"
            nzBlock
            type="submit"
            [nzLoading]="state() === 'sending'"
            [disabled]="email.invalid || !consent.value"
          >
            {{ 'PORTAL_AREA.SEND_LINK' | translate }}
          </button>
        </form>
      }
    </section>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 16px;
      background: #f5f6f8;
    }
    .login-card {
      width: 100%;
      max-width: 420px;
      background: #fff;
      padding: 24px;
      border-radius: 8px;
      display: grid;
      gap: 12px;
    }
    .login-logo {
      max-height: 48px;
      max-width: 200px;
      justify-self: center;
    }
    form {
      display: grid;
      gap: 12px;
    }
    h1 {
      margin: 0;
      font-size: 20px;
    }
  `,
})
export class PortalLoginComponent implements OnInit {
  protected readonly session = inject(PortalSessionService);
  private readonly api = inject(PortalAreaApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  protected readonly consent = new FormControl(false, { nonNullable: true });
  protected readonly state = signal<LoginState>('idle');

  ngOnInit(): void {
    this.session.useSlug(this.route.snapshot.queryParamMap.get('portal'));
    this.api.getBranding(this.session.slug()).subscribe({
      next: (response) => this.session.applyBranding(response.data),
      error: () => undefined,
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.email.invalid || !this.consent.value || this.state() === 'sending') {
      return;
    }
    this.state.set('sending');
    this.api.requestLink(this.email.value.trim(), this.session.slug()).subscribe({
      next: () => this.state.set('sent'),
      error: () => this.state.set('failed'),
    });
  }
}
