import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CCV_RELATIONSHIPS, CcvRelationship, CorporateConventionsApiService } from '@core';
import { TranslatePipe } from '@shared';
import { ConventionLandingStore } from './convention-landing.store';
import { CcvOutcome } from './corporate-conventions.util';

/**
 * Public, branded, mobile-first landing page of a convention (/convenzioni/:slug). The employee proves the eligibility with the
 * work e-mail (one-time code) or a card / matricola / promo code, and gets the digital pass at once: QR code, Apple Wallet and Google
 * Wallet buttons (shown when the company configured them), and the form to add first-degree family members.
 */
@Component({
  selector: 'app-ccv-convention-landing',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    TranslatePipe,
  ],
  providers: [ConventionLandingStore],
  styleUrl: './corporate-conventions.scss',
  template: `
    <main class="landing" [style.--ccv-accent]="store.convention()?.primary_color || '#1f4e79'">
      @switch (store.step()) {
        @case ('loading') {
          <nz-spin nzSimple></nz-spin>
        }
        @case ('unavailable') {
          <section class="landing-card">
            <h1>{{ 'corporateConventions.landing.unavailableTitle' | translate }}</h1>
            <p>{{ 'corporateConventions.landing.unavailableText' | translate }}</p>
          </section>
        }
        @default {
          @if (store.convention(); as convention) {
            <header class="landing-header">
              @if (logo(); as src) {
                <img class="landing-logo" [src]="src" [alt]="convention.partner_company_name" />
              }
              <h1>{{ convention.name }}</h1>
              <p>
                {{
                  convention.welcome_message_key ?? 'corporateConventions.landing.welcome'
                    | translate: { partner: convention.partner_company_name }
                }}
              </p>
            </header>

            @if (feedback(); as failure) {
              <nz-alert
                nzType="error"
                nzShowIcon
                class="form-alert"
                [nzMessage]="failure.errorKey ?? '' | translate: failure.params"
                [nzDescription]="failure.detail"
              ></nz-alert>
            }

            @if (store.step() === 'choose') {
              <section class="landing-card">
                <label class="field" for="ccv-l-name">
                  <span>{{ 'corporateConventions.landing.fullName' | translate }}</span>
                  <input
                    nz-input
                    id="ccv-l-name"
                    autocomplete="name"
                    [ngModel]="fullName()"
                    (ngModelChange)="fullName.set($event)"
                    maxlength="160"
                  />
                </label>

                @if (convention.verification.work_email_otp) {
                  <label class="field" for="ccv-l-email">
                    <span>{{ 'corporateConventions.landing.workEmail' | translate }}</span>
                    <input
                      nz-input
                      id="ccv-l-email"
                      type="email"
                      inputmode="email"
                      autocomplete="email"
                      [ngModel]="email()"
                      (ngModelChange)="email.set($event)"
                      [placeholder]="domainHint()"
                    />
                  </label>
                  <button
                    nz-button
                    nzType="primary"
                    nzBlock
                    nzSize="large"
                    type="button"
                    [nzLoading]="store.busy()"
                    [disabled]="!canRequestOtp()"
                    (click)="requestOtp()"
                  >
                    {{ 'corporateConventions.landing.sendCode' | translate }}
                  </button>
                }

                @if (convention.verification.identifier) {
                  @if (convention.verification.work_email_otp) {
                    <p class="landing-or">{{ 'corporateConventions.landing.or' | translate }}</p>
                  }
                  <label class="field" for="ccv-l-identifier">
                    <span>{{ identifierLabelKey() | translate }}</span>
                    <input
                      nz-input
                      id="ccv-l-identifier"
                      autocomplete="off"
                      [ngModel]="identifier()"
                      (ngModelChange)="identifier.set($event)"
                      maxlength="120"
                    />
                  </label>
                  <button
                    nz-button
                    nzBlock
                    nzSize="large"
                    type="button"
                    [nzLoading]="store.busy()"
                    [disabled]="!canVerifyIdentifier()"
                    (click)="verifyIdentifier()"
                  >
                    {{ 'corporateConventions.landing.verifyIdentifier' | translate }}
                  </button>
                }
                <p class="muted privacy">
                  {{ 'corporateConventions.landing.privacy' | translate }}
                </p>
              </section>
            }

            @if (store.step() === 'otp') {
              <section class="landing-card">
                <p>
                  {{
                    'corporateConventions.landing.codeSent' | translate: { email: store.email() }
                  }}
                </p>
                <label class="field" for="ccv-l-code">
                  <span>{{ 'corporateConventions.landing.code' | translate }}</span>
                  <input
                    nz-input
                    id="ccv-l-code"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    class="otp-input"
                    [ngModel]="code()"
                    (ngModelChange)="code.set($event)"
                  />
                </label>
                <button
                  nz-button
                  nzType="primary"
                  nzBlock
                  nzSize="large"
                  type="button"
                  [nzLoading]="store.busy()"
                  [disabled]="code().length !== 6"
                  (click)="verifyOtp()"
                >
                  {{ 'corporateConventions.landing.activate' | translate }}
                </button>
                <button nz-button nzType="link" type="button" (click)="store.backToChoice()">
                  {{ 'corporateConventions.landing.back' | translate }}
                </button>
              </section>
            }

            @if (store.step() === 'pass' && store.pass(); as pass) {
              <section
                class="landing-card pass"
                [style.border-color]="pass.convention.primary_color || '#1f4e79'"
              >
                <h2>{{ pass.full_name }}</h2>
                <p class="muted">{{ pass.convention.partner_company_name }}</p>
                <img
                  class="pass-qr"
                  [src]="assetUrl(pass.wallet_pass_id, 'qr.svg')"
                  [alt]="'corporateConventions.landing.qrAlt' | translate"
                  width="240"
                  height="240"
                />
                <p class="mono">{{ pass.qr_payload }}</p>
                @if (pass.expires_at) {
                  <p class="muted">
                    {{ 'corporateConventions.landing.validUntil' | translate }}:
                    {{ pass.expires_at.slice(0, 10) }}
                  </p>
                }
                <div class="wallets">
                  @if (pass.apple_wallet_url) {
                    <a
                      nz-button
                      nzSize="large"
                      [href]="assetUrl(pass.wallet_pass_id, 'apple.pkpass')"
                      >{{ 'corporateConventions.landing.addApple' | translate }}</a
                    >
                  }
                  @if (pass.google_wallet_url) {
                    <a
                      nz-button
                      nzSize="large"
                      [href]="pass.google_wallet_url"
                      target="_blank"
                      rel="noopener"
                      >{{ 'corporateConventions.landing.addGoogle' | translate }}</a
                    >
                  }
                  <a
                    nz-button
                    nzSize="large"
                    [href]="assetUrl(pass.wallet_pass_id, 'qr.png')"
                    download="convention-pass.png"
                    >{{ 'corporateConventions.landing.downloadQr' | translate }}</a
                  >
                </div>
              </section>

              @if (
                pass.convention.allow_family_members && pass.beneficiary_type === 'PRIMARY_EMPLOYEE'
              ) {
                <section class="landing-card">
                  <h3>{{ 'corporateConventions.landing.familyTitle' | translate }}</h3>
                  @for (member of pass.family_members; track member.wallet_pass_id) {
                    <p>
                      <nz-tag nzColor="blue">{{
                        'corporateConventions.relationship.' + member.relationship | translate
                      }}</nz-tag>
                      {{ member.full_name }}
                    </p>
                  }
                  @if (store.canAddFamily()) {
                    <label class="field" for="ccv-l-fname">
                      <span>{{ 'corporateConventions.landing.fullName' | translate }}</span>
                      <input
                        nz-input
                        id="ccv-l-fname"
                        [ngModel]="familyName()"
                        (ngModelChange)="familyName.set($event)"
                        maxlength="160"
                      />
                    </label>
                    <label class="field" for="ccv-l-frel">
                      <span>{{ 'corporateConventions.field.relationship' | translate }}</span>
                      <nz-select
                        nzId="ccv-l-frel"
                        [ngModel]="familyRelationship()"
                        (ngModelChange)="familyRelationship.set($event)"
                      >
                        @for (relationship of relationships; track relationship) {
                          <nz-option
                            [nzValue]="relationship"
                            [nzLabel]="
                              'corporateConventions.relationship.' + relationship | translate
                            "
                          ></nz-option>
                        }
                      </nz-select>
                    </label>
                    <button
                      nz-button
                      nzBlock
                      type="button"
                      [nzLoading]="store.busy()"
                      [disabled]="familyName().trim().length < 2"
                      (click)="addFamilyMember()"
                    >
                      {{ 'corporateConventions.landing.addFamily' | translate }}
                    </button>
                  } @else {
                    <p class="muted">
                      {{
                        'corporateConventions.landing.familyLimit'
                          | translate: { max: pass.convention.max_family_members }
                      }}
                    </p>
                  }
                </section>
              }
            }
          }
        }
      }
    </main>
  `,
})
export class ConventionLandingComponent implements OnInit {
  protected readonly store = inject(ConventionLandingStore);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CorporateConventionsApiService);

  protected readonly relationships = CCV_RELATIONSHIPS;

  protected readonly feedback = signal<CcvOutcome | null>(null);
  protected readonly fullName = signal('');
  protected readonly email = signal('');
  protected readonly identifier = signal('');
  protected readonly code = signal('');
  protected readonly familyName = signal('');
  protected readonly familyRelationship = signal<CcvRelationship>('SPOUSE');

  protected readonly logo = computed(() => this.store.logoUrl());
  protected readonly domainHint = computed(() => {
    const domains = this.store.verification()?.email_domains ?? [];
    return domains.length > 0 ? `name${domains[0]}` : 'name@company.com';
  });
  protected readonly identifierLabelKey = computed(() => {
    const verification = this.store.verification();
    if (verification?.promo_code && !verification.card && !verification.hashed_list) {
      return 'corporateConventions.landing.promoCode';
    }
    return verification?.card
      ? 'corporateConventions.landing.cardNumber'
      : 'corporateConventions.landing.matricola';
  });
  protected readonly canRequestOtp = computed(
    () =>
      this.fullName().trim().length >= 2 &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(this.email().trim()) &&
      !this.store.busy(),
  );
  protected readonly canVerifyIdentifier = computed(
    () =>
      this.fullName().trim().length >= 2 &&
      this.identifier().trim().length >= 3 &&
      !this.store.busy(),
  );

  ngOnInit(): void {
    void this.store.load(this.route.snapshot.paramMap.get('slug') ?? '');
  }

  protected assetUrl(walletPassId: string, file: 'qr.svg' | 'qr.png' | 'apple.pkpass'): string {
    return this.api.passAssetUrl(walletPassId, file);
  }

  protected async requestOtp(): Promise<void> {
    const outcome = await this.store.requestOtp(this.email().trim());
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async verifyOtp(): Promise<void> {
    const outcome = await this.store.verifyOtp(this.code().trim(), this.fullName().trim());
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async verifyIdentifier(): Promise<void> {
    const email = this.email().trim();
    const outcome = await this.store.verifyIdentifier(
      this.identifier().trim(),
      this.fullName().trim(),
      email === '' ? undefined : email,
    );
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async addFamilyMember(): Promise<void> {
    const outcome = await this.store.addFamilyMember(
      this.familyName().trim(),
      this.familyRelationship(),
    );
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.familyName.set('');
    }
  }
}
