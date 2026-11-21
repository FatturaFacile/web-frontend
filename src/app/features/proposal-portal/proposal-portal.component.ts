import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProposalLine } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ProposalPortalStore } from './proposal-portal.store';

/**
 * Public interactive proposal (`/proposal/:token`, no login, no application shell). The customer reviews the proposal, switches
 * optional lines on and off and picks one line per alternative group while the totals and the VAT breakdown follow the server's
 * recalculation, asks questions, then signs with a one-time code (or starts the qualified ceremony of a trust service provider)
 * or rejects with a reason.
 */
@Component({
  selector: 'app-proposal-portal',
  providers: [ProposalPortalStore],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzRadioModule,
    NzSpinModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card class="card" [nzTitle]="'PROPOSAL.TITLE' | translate">
      <nz-spin [nzSpinning]="store.loading()">
        @if (store.invalid()) {
          <nz-alert
            nzType="error"
            nzShowIcon
            data-test="invalid"
            [nzMessage]="'PROPOSAL.LINK_UNAVAILABLE' | translate"
          />
        } @else if (store.pinRequired()) {
          <form [formGroup]="pinForm" (ngSubmit)="unlock()" class="stack" data-test="pin-gate">
            <h3>{{ 'PROPOSAL.PIN_TITLE' | translate }}</h3>
            <label for="proposal-pin">{{ 'PROPOSAL.PIN_LABEL' | translate }}</label>
            <input
              nz-input
              id="proposal-pin"
              formControlName="pin"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="12"
            />
            @if (store.pinInvalid()) {
              <nz-alert
                nzType="error"
                nzShowIcon
                data-test="pin-invalid"
                [nzMessage]="'PROPOSAL.PIN_INVALID' | translate"
              />
            }
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.busy()"
              [disabled]="pinForm.invalid"
            >
              {{ 'PROPOSAL.PIN_SUBMIT' | translate }}
            </button>
          </form>
        } @else if (store.view(); as v) {
          <header class="header">
            <h2 data-test="number">{{ v.quote_number }}</h2>
            <span>{{ v.customer_name }}</span>
            @if (v.valid_until) {
              <nz-tag>{{ 'PROPOSAL.VALID_UNTIL' | translate: { date: v.valid_until } }}</nz-tag>
            }
          </header>

          @if (v.cover_letter) {
            <p class="cover" data-test="cover">{{ v.cover_letter }}</p>
          }

          @for (section of v.sections; track section.id) {
            <section class="section" [class.page-break]="section.page_break_before">
              <h3>{{ section.title }}</h3>
              @if (section.description) {
                <p>{{ section.description }}</p>
              }
              <table class="lines" data-test="lines">
                <thead>
                  <tr>
                    <th>{{ 'PROPOSAL.COL_DESCRIPTION' | translate }}</th>
                    <th>{{ 'PROPOSAL.COL_QUANTITY' | translate }}</th>
                    <th>{{ 'PROPOSAL.COL_UNIT_PRICE' | translate }}</th>
                    <th>{{ 'PROPOSAL.COL_NET' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of store.linesOf(section.id); track line.id) {
                    <tr
                      [class.off]="!line.selected && line.selection_mode !== 'mandatory'"
                      [attr.data-line]="line.id"
                    >
                      <td>
                        @switch (line.selection_mode) {
                          @case ('optional') {
                            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                            <label
                              nz-checkbox
                              [ngModel]="line.selected"
                              [disabled]="!store.open()"
                              (ngModelChange)="store.setOptional(line.id, $event)"
                              [ngModelOptions]="{ standalone: true }"
                              data-test="optional"
                            >
                              {{ line.description }}
                              <nz-tag>{{ 'PROPOSAL.OPTIONAL' | translate }}</nz-tag>
                            </label>
                          }
                          @case ('alternative_group') {
                            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                            <label
                              nz-radio
                              [ngModel]="line.selected"
                              [nzDisabled]="!store.open()"
                              (ngModelChange)="
                                store.chooseAlternative(
                                  line.alternative_group ?? 'default',
                                  line.id
                                )
                              "
                              [ngModelOptions]="{ standalone: true }"
                              data-test="alternative"
                            >
                              {{ line.description }}
                              <nz-tag>{{ 'PROPOSAL.ALTERNATIVE' | translate }}</nz-tag>
                            </label>
                          }
                          @default {
                            {{ line.description }}
                          }
                        }
                        @if (line.long_description) {
                          <div class="spec">{{ line.long_description }}</div>
                        }
                      </td>
                      <td>{{ isPriced(line) ? line.quantity : '' }}</td>
                      <td>{{ isPriced(line) ? line.unit_price : '' }}</td>
                      <td data-test="line-net">{{ isPriced(line) ? line.net : '' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <p class="subtotal">
                {{ 'PROPOSAL.SECTION_SUBTOTAL' | translate }}: {{ section.subtotal }}
                {{ v.currency }}
              </p>
            </section>
          }

          <aside class="summary" data-test="summary" [attr.aria-busy]="store.recalculating()">
            @if (store.recalculating()) {
              <span>{{ 'PROPOSAL.RECALCULATING' | translate }}</span>
            }
            <div>
              {{ 'PROPOSAL.TOTAL_NET' | translate }}:
              <strong data-test="total-net">{{ v.totals.net }}</strong> {{ v.currency }}
            </div>
            @for (row of v.tax_breakdown; track row.rate) {
              <div class="tax" data-test="tax-row">
                {{ 'PROPOSAL.TAX_RATE' | translate: { rate: row.rate } }}: {{ row.tax }}
                {{ v.currency }}
              </div>
            }
            <div>{{ 'PROPOSAL.TOTAL_TAX' | translate }}: {{ v.totals.tax }} {{ v.currency }}</div>
            @if (v.totals.rounding !== '0.00') {
              <div>{{ 'PROPOSAL.TOTAL_ROUNDING' | translate }}: {{ v.totals.rounding }}</div>
            }
            <div class="payable">
              {{ 'PROPOSAL.TOTAL_PAYABLE' | translate }}:
              <strong data-test="total-payable">{{ v.totals.payable }}</strong> {{ v.currency }}
            </div>
          </aside>

          @if (store.error()) {
            <nz-alert
              nzType="error"
              nzShowIcon
              data-test="error"
              [nzMessage]="'PROPOSAL.ERROR' | translate"
            />
          }

          @if (store.accepted()) {
            <nz-alert
              nzType="success"
              nzShowIcon
              data-test="signed"
              [nzMessage]="'PROPOSAL.SIGNED' | translate"
            />
            <div class="actions">
              <button
                nz-button
                type="button"
                data-test="download-proposal"
                (click)="store.download('proposal')"
              >
                {{ 'PROPOSAL.DOWNLOAD_PROPOSAL' | translate }}
              </button>
              <button
                nz-button
                type="button"
                data-test="download-certificate"
                (click)="store.download('certificate')"
              >
                {{ 'PROPOSAL.DOWNLOAD_CERTIFICATE' | translate }}
              </button>
            </div>
          } @else if (store.outcome() === 'rejected') {
            <nz-alert
              nzType="info"
              nzShowIcon
              data-test="rejected"
              [nzMessage]="'PROPOSAL.REJECTED' | translate"
            />
          } @else if (store.open()) {
            <section class="stack" data-test="comments">
              <h3>{{ 'PROPOSAL.COMMENT_TITLE' | translate }}</h3>
              @for (c of v.comments ?? []; track c.created_at) {
                <p class="comment">{{ c.body }}</p>
              }
              <textarea
                nz-input
                rows="2"
                [formControl]="commentControl"
                [placeholder]="'PROPOSAL.COMMENT_PLACEHOLDER' | translate"
              ></textarea>
              <button
                nz-button
                type="button"
                data-test="comment"
                [disabled]="commentControl.invalid"
                (click)="sendComment()"
              >
                {{ 'PROPOSAL.COMMENT_SEND' | translate }}
              </button>
            </section>

            <section class="stack" data-test="signature">
              <h3>{{ 'PROPOSAL.SIGN' | translate }}</h3>
              @if (store.signatureStep(); as step) {
                @if (step.redirect_url) {
                  <a
                    nz-button
                    nzType="primary"
                    [href]="step.redirect_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-test="qualified"
                    >{{ 'PROPOSAL.SIGN_QUALIFIED' | translate }}</a
                  >
                  <span>{{ 'PROPOSAL.SIGN_WAITING' | translate }}</span>
                } @else {
                  <form [formGroup]="codeForm" (ngSubmit)="confirmCode()" class="stack">
                    <label for="proposal-code">{{ 'PROPOSAL.SIGN_CODE' | translate }}</label>
                    <input
                      nz-input
                      id="proposal-code"
                      formControlName="code"
                      inputmode="numeric"
                      autocomplete="one-time-code"
                      maxlength="6"
                      data-test="code"
                    />
                    @if (store.codeInvalid()) {
                      <nz-alert
                        nzType="error"
                        nzShowIcon
                        data-test="code-invalid"
                        [nzMessage]="'PROPOSAL.SIGN_CODE_INVALID' | translate"
                      />
                    }
                    <button
                      nz-button
                      nzType="primary"
                      type="submit"
                      data-test="confirm"
                      [nzLoading]="store.busy()"
                      [disabled]="codeForm.invalid"
                    >
                      {{ 'PROPOSAL.SIGN_CONFIRM' | translate }}
                    </button>
                  </form>
                }
              } @else {
                <form [formGroup]="signerForm" (ngSubmit)="startSignature()" class="stack">
                  <label for="signer-name">{{ 'PROPOSAL.SIGN_NAME' | translate }}</label>
                  <input nz-input id="signer-name" formControlName="signer_name" />
                  <label for="signer-role">{{ 'PROPOSAL.SIGN_ROLE' | translate }}</label>
                  <input nz-input id="signer-role" formControlName="signer_role" />
                  @if (v.signature_level === 'ses_otp') {
                    <nz-radio-group
                      formControlName="otp_channel"
                      [attr.aria-label]="'PROPOSAL.SIGN_CHANNEL' | translate"
                    >
                      <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                      <label nz-radio nzValue="email">{{
                        'PROPOSAL.SIGN_CHANNEL_EMAIL' | translate
                      }}</label>
                      <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                      <label nz-radio nzValue="sms">{{
                        'PROPOSAL.SIGN_CHANNEL_SMS' | translate
                      }}</label>
                    </nz-radio-group>
                    @if (signerForm.controls.otp_channel.value === 'sms') {
                      <input
                        nz-input
                        formControlName="signer_phone"
                        inputmode="tel"
                        [attr.aria-label]="'PROPOSAL.SIGN_CHANNEL_SMS' | translate"
                      />
                    }
                  }
                  <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                  <label nz-checkbox formControlName="consent" data-test="consent">{{
                    'PROPOSAL.SIGN_CONSENT' | translate
                  }}</label>
                  <button
                    nz-button
                    nzType="primary"
                    type="submit"
                    data-test="request-code"
                    [nzLoading]="store.busy()"
                    [disabled]="signerForm.invalid"
                  >
                    {{
                      v.signature_level === 'ses_otp'
                        ? ('PROPOSAL.SIGN_REQUEST_CODE' | translate)
                        : ('PROPOSAL.SIGN_QUALIFIED' | translate)
                    }}
                  </button>
                </form>
              }
            </section>

            <section class="stack" data-test="reject">
              <button
                nz-button
                nzDanger
                type="button"
                data-test="start-reject"
                (click)="rejecting = true"
              >
                {{ 'PROPOSAL.REJECT' | translate }}
              </button>
              @if (rejecting) {
                <label for="reject-reason">{{ 'PROPOSAL.REJECT_REASON' | translate }}</label>
                <textarea
                  nz-input
                  id="reject-reason"
                  rows="2"
                  [formControl]="reasonControl"
                ></textarea>
                <button
                  nz-button
                  nzDanger
                  type="button"
                  data-test="confirm-reject"
                  [nzLoading]="store.busy()"
                  [disabled]="reasonControl.invalid"
                  (click)="store.reject(reasonControl.value)"
                >
                  {{ 'PROPOSAL.REJECT_CONFIRM' | translate }}
                </button>
              }
            </section>
          }
        }
      </nz-spin>
    </nz-card>
  `,
  styles: `
    .card {
      max-width: 960px;
      margin: 16px auto;
    }
    .header,
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }
    .lines {
      width: 100%;
      border-collapse: collapse;
    }
    .lines th,
    .lines td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid var(--ant-color-border-secondary, #eee);
    }
    .lines tr.off td {
      opacity: 0.55;
    }
    .summary {
      margin-top: 16px;
      text-align: right;
    }
    .payable {
      font-size: 1.25rem;
    }
    .spec {
      opacity: 0.75;
    }
    @media print {
      .page-break {
        break-before: page;
      }
    }
    @media (max-width: 640px) {
      .lines th:nth-child(3),
      .lines td:nth-child(3) {
        display: none;
      }
    }
  `,
})
export class ProposalPortalComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  protected readonly store = inject(ProposalPortalStore);

  protected rejecting = false;
  protected readonly pinForm = this.fb.nonNullable.group({
    pin: ['', [Validators.required, Validators.maxLength(12)]],
  });
  protected readonly commentControl = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.maxLength(5000),
  ]);
  protected readonly reasonControl = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(2000),
  ]);
  protected readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });
  protected readonly signerForm = this.fb.nonNullable.group({
    signer_name: ['', [Validators.required, Validators.maxLength(190)]],
    signer_role: ['', Validators.maxLength(120)],
    signer_phone: ['', Validators.maxLength(40)],
    otp_channel: this.fb.nonNullable.control<'email' | 'sms'>('email'),
    consent: [false, Validators.requiredTrue],
  });

  ngOnInit(): void {
    this.store.load(this.route.snapshot.paramMap.get('token') ?? '');
  }

  protected isPriced(line: ProposalLine): boolean {
    return line.line_type !== 'text_note' && line.line_type !== 'subtotal';
  }

  protected unlock(): void {
    this.store.unlock(this.pinForm.controls.pin.value);
  }

  protected sendComment(): void {
    this.store.comment(this.commentControl.value);
    this.commentControl.reset('');
  }

  protected startSignature(): void {
    const value = this.signerForm.getRawValue();
    this.store.startSignature({
      signer_name: value.signer_name,
      signer_role: value.signer_role || undefined,
      signer_phone: value.otp_channel === 'sms' ? value.signer_phone || undefined : undefined,
      otp_channel: value.otp_channel,
      consent: value.consent,
    });
  }

  protected confirmCode(): void {
    this.store.confirmCode(this.codeForm.controls.code.value);
  }
}
