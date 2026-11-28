import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import {
  PermissionsService,
  TranslateService,
  WR_ACTIVITY_TYPES,
  WR_CU_CAUSALS,
  WR_ENASARCO_MANDATES,
  WR_REGIMES,
} from '@core';
import { TranslatePipe } from '@shared';
import { CertificatesPanelComponent } from './certificates-panel.component';
import { birthDateFromFiscalCode } from './fiscal-code.util';
import { InlPanelComponent } from './inl-panel.component';
import { RecipientsStore } from './recipients.store';
import { ThresholdBarsComponent } from './threshold-bars.component';
import {
  DEFAULT_RECIPIENT_FORM,
  declaresThirdPartyIncome,
  isAgentRegime,
  isOccasionalRegime,
  isRecipientFormValid,
  isSwissRegime,
  recipientFormOf,
  RecipientFormValue,
  recipientPayloadOf,
  regimeCurrency,
  WITHHOLDING_RECIPIENTS_MODULE,
  WrOutcome,
} from './withholding-recipients.util';

/**
 * Profile and declarations of a recipient (Mod 356): the identifiers of the country, the Codice Fiscale with the birth date
 * read from it, the Enasarco mandate and FIRR of an agent, the Swiss AVS data, the income declared by third parties, the
 * threshold progress, the 20% declarations of an agent and the INL communications of an occasional worker.
 */
@Component({
  selector: 'app-wr-recipient-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CertificatesPanelComponent,
    InlPanelComponent,
    ThresholdBarsComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTabsModule,
  ],
  providers: [RecipientsStore],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="760"
      [nzTitle]="
        (editing()
          ? 'withholdingRecipients.recipient.formTitleEdit'
          : 'withholdingRecipients.recipient.formTitleNew'
        ) | translate
      "
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="store.loading()">
          @if (store.error(); as loadError) {
            <nz-alert
              class="feedback"
              nzType="error"
              nzShowIcon
              [nzMessage]="loadError | translate"
            ></nz-alert>
          }

          <nz-tabs>
            <nz-tab [nzTitle]="'withholdingRecipients.tab.profile' | translate">
              @if (error(); as failure) {
                <nz-alert
                  class="feedback"
                  nzType="error"
                  nzShowIcon
                  [nzMessage]="failure.errorKey ?? '' | translate"
                  [nzDescription]="failure.detail ?? ''"
                ></nz-alert>
              }

              @if (editing() && store.thresholds().length > 0) {
                <section class="section">
                  <h4>{{ 'withholdingRecipients.recipient.thresholds' | translate }}</h4>
                  <app-wr-threshold-bars
                    [thresholds]="store.thresholds()"
                    [currency]="currency()"
                  ></app-wr-threshold-bars>
                </section>
              }

              <div class="grid">
                <label class="field wide" for="wr-rec-name">
                  <span>{{ 'withholdingRecipients.field.name' | translate }}</span>
                  <input
                    nz-input
                    id="wr-rec-name"
                    [ngModel]="form().display_name"
                    (ngModelChange)="patch({ display_name: $event })"
                  />
                </label>

                <label class="field" for="wr-rec-regime">
                  <span>{{ 'withholdingRecipients.field.regime' | translate }}</span>
                  <nz-select
                    nzId="wr-rec-regime"
                    [ngModel]="form().regime"
                    (ngModelChange)="patch({ regime: $event })"
                  >
                    @for (regime of regimes; track regime) {
                      <nz-option
                        [nzValue]="regime"
                        [nzLabel]="'withholdingRecipients.regime.' + regime | translate"
                      ></nz-option>
                    }
                  </nz-select>
                </label>

                @if (!swiss()) {
                  <label class="field" for="wr-rec-causal">
                    <span>{{ 'withholdingRecipients.field.cuCausal' | translate }}</span>
                    <nz-select
                      nzId="wr-rec-causal"
                      nzAllowClear
                      [nzPlaceHolder]="'withholdingRecipients.recipient.causalDefault' | translate"
                      [ngModel]="form().cu_causal"
                      (ngModelChange)="patch({ cu_causal: $event ?? null })"
                    >
                      @for (causal of causals; track causal) {
                        <nz-option
                          [nzValue]="causal"
                          [nzLabel]="'withholdingRecipients.causal.' + causal | translate"
                        ></nz-option>
                      }
                    </nz-select>
                  </label>

                  <label class="field" for="wr-rec-tax-code">
                    <span>{{ 'withholdingRecipients.field.taxCode' | translate }}</span>
                    <input
                      nz-input
                      id="wr-rec-tax-code"
                      maxlength="20"
                      [ngModel]="form().tax_code"
                      (ngModelChange)="changeTaxCode($event)"
                    />
                  </label>
                } @else {
                  <label class="field" for="wr-rec-avs">
                    <span>{{ 'withholdingRecipients.field.avsNumber' | translate }}</span>
                    <input
                      nz-input
                      id="wr-rec-avs"
                      maxlength="20"
                      [ngModel]="form().avs_number"
                      (ngModelChange)="patch({ avs_number: $event })"
                    />
                  </label>
                  <label class="field" for="wr-rec-canton">
                    <span>{{ 'withholdingRecipients.field.canton' | translate }}</span>
                    <input
                      nz-input
                      id="wr-rec-canton"
                      maxlength="2"
                      [ngModel]="form().canton"
                      (ngModelChange)="patch({ canton: $event })"
                    />
                  </label>
                }

                <label class="field" for="wr-rec-vat">
                  <span>{{ 'withholdingRecipients.field.vatNumber' | translate }}</span>
                  <input
                    nz-input
                    id="wr-rec-vat"
                    [ngModel]="form().vat_number"
                    (ngModelChange)="patch({ vat_number: $event })"
                  />
                </label>

                <label class="field" for="wr-rec-birth">
                  <span>{{ 'withholdingRecipients.field.birthDate' | translate }}</span>
                  <input
                    nz-input
                    id="wr-rec-birth"
                    type="date"
                    [ngModel]="form().birth_date"
                    (ngModelChange)="patch({ birth_date: $event })"
                  />
                </label>

                @if (fiscalCodeBirthDate(); as decoded) {
                  <p class="hint wide">
                    {{
                      'withholdingRecipients.hint.birthFromFiscalCode'
                        | translate: { date: decoded }
                    }}
                    @if (form().birth_date !== decoded) {
                      <button
                        nz-button
                        nzSize="small"
                        nzType="link"
                        type="button"
                        (click)="patch({ birth_date: decoded })"
                      >
                        {{ 'withholdingRecipients.hint.useBirthDate' | translate }}
                      </button>
                    }
                  </p>
                }

                <label class="field" for="wr-rec-country">
                  <span>{{ 'withholdingRecipients.field.country' | translate }}</span>
                  <input
                    nz-input
                    id="wr-rec-country"
                    maxlength="2"
                    [ngModel]="form().country_of_residence"
                    (ngModelChange)="patch({ country_of_residence: $event })"
                  />
                </label>

                @if (agent()) {
                  <label class="field" for="wr-rec-mandate">
                    <span>{{ 'withholdingRecipients.field.enasarcoMandate' | translate }}</span>
                    <nz-select
                      nzId="wr-rec-mandate"
                      nzAllowClear
                      [ngModel]="form().enasarco_mandate"
                      (ngModelChange)="patch({ enasarco_mandate: $event ?? null })"
                    >
                      @for (mandate of mandates; track mandate) {
                        <nz-option
                          [nzValue]="mandate"
                          [nzLabel]="'withholdingRecipients.enasarcoMandate.' + mandate | translate"
                        ></nz-option>
                      }
                    </nz-select>
                  </label>
                }

                @if (form().regime === 'swiss_foreign_artist') {
                  <label class="field" for="wr-rec-activity">
                    <span>{{ 'withholdingRecipients.field.activityType' | translate }}</span>
                    <nz-select
                      nzId="wr-rec-activity"
                      nzAllowClear
                      [ngModel]="form().activity_type"
                      (ngModelChange)="patch({ activity_type: $event ?? null })"
                    >
                      @for (type of activityTypes; track type) {
                        <nz-option
                          [nzValue]="type"
                          [nzLabel]="'withholdingRecipients.activityType.' + type | translate"
                        ></nz-option>
                      }
                    </nz-select>
                  </label>
                }

                <div class="checks wide">
                  @if (agent()) {
                    <label
                      for="wr-rec-firr"
                      nzId="wr-rec-firr"
                      nz-checkbox
                      [ngModel]="form().firr_enabled"
                      (ngModelChange)="patch({ firr_enabled: $event })"
                      >{{ 'withholdingRecipients.field.firrEnabled' | translate }}</label
                    >
                  }
                  @if (form().regime === 'swiss_de_minimis') {
                    <label
                      for="wr-rec-cultural"
                      nzId="wr-rec-cultural"
                      nz-checkbox
                      [ngModel]="form().is_cultural_sector"
                      (ngModelChange)="patch({ is_cultural_sector: $event })"
                      >{{ 'withholdingRecipients.field.culturalSector' | translate }}</label
                    >
                  }
                  <label
                    for="wr-rec-active"
                    nzId="wr-rec-active"
                    nz-checkbox
                    [ngModel]="form().is_active"
                    (ngModelChange)="patch({ is_active: $event })"
                    >{{ 'withholdingRecipients.field.active' | translate }}</label
                  >
                </div>

                @if (declaresIncome()) {
                  <p class="hint wide">
                    {{ 'withholdingRecipients.hint.thirdPartyIncome' | translate }}
                  </p>
                  <label class="field" for="wr-rec-third">
                    <span>{{ 'withholdingRecipients.field.thirdPartyIncome' | translate }}</span>
                    <nz-input-number
                      nzId="wr-rec-third"
                      [nzMin]="0"
                      [nzStep]="100"
                      [ngModel]="form().third_party_ytd_income"
                      (ngModelChange)="patch({ third_party_ytd_income: $event })"
                    ></nz-input-number>
                  </label>
                  <label class="field" for="wr-rec-third-year">
                    <span>{{ 'withholdingRecipients.field.thirdPartyYear' | translate }}</span>
                    <nz-input-number
                      nzId="wr-rec-third-year"
                      [nzMin]="2000"
                      [nzMax]="2100"
                      [ngModel]="form().third_party_income_year"
                      (ngModelChange)="patch({ third_party_income_year: $event })"
                    ></nz-input-number>
                  </label>
                  <label class="field" for="wr-rec-third-date">
                    <span>{{
                      'withholdingRecipients.field.thirdPartyDeclaredOn' | translate
                    }}</span>
                    <input
                      nz-input
                      id="wr-rec-third-date"
                      type="date"
                      [ngModel]="form().third_party_declared_on"
                      (ngModelChange)="patch({ third_party_declared_on: $event })"
                    />
                  </label>
                }

                <label class="field wide" for="wr-rec-notes">
                  <span>{{ 'withholdingRecipients.field.notes' | translate }}</span>
                  <textarea
                    nz-input
                    id="wr-rec-notes"
                    rows="3"
                    [ngModel]="form().notes"
                    (ngModelChange)="patch({ notes: $event })"
                  ></textarea>
                </label>
              </div>

              <div class="footer">
                @if (editing() && canWrite) {
                  <button
                    nz-button
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'withholdingRecipients.action.confirmDelete' | translate"
                    [nzOkText]="'withholdingRecipients.action.delete' | translate"
                    [nzCancelText]="'withholdingRecipients.action.cancel' | translate"
                    (nzOnConfirm)="remove()"
                  >
                    {{ 'withholdingRecipients.action.delete' | translate }}
                  </button>
                }
                <span class="spacer"></span>
                <button nz-button type="button" (click)="closed.emit()">
                  {{ 'withholdingRecipients.action.close' | translate }}
                </button>
                @if (canWrite) {
                  <button
                    nz-button
                    nzType="primary"
                    type="button"
                    [nzLoading]="store.saving()"
                    [disabled]="!valid()"
                    (click)="save()"
                  >
                    {{ 'withholdingRecipients.action.save' | translate }}
                  </button>
                }
              </div>
            </nz-tab>

            @if (currentId(); as id) {
              @if (agent()) {
                <nz-tab [nzTitle]="'withholdingRecipients.tab.certificates' | translate">
                  <app-wr-certificates-panel
                    [recipientId]="id"
                    [canWrite]="canWrite"
                  ></app-wr-certificates-panel>
                </nz-tab>
              }
              @if (occasional()) {
                <nz-tab [nzTitle]="'withholdingRecipients.tab.inl' | translate">
                  <app-wr-inl-panel [recipientId]="id" [canWrite]="canWrite"></app-wr-inl-panel>
                </nz-tab>
              }
            }
          </nz-tabs>
        </nz-spin>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .wide {
      grid-column: 1 / -1;
    }

    .hint {
      margin: 0;
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .section {
      margin-bottom: 16px;
    }

    .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .feedback {
      margin-bottom: 16px;
    }

    .footer {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 24px;
    }

    .spacer {
      flex: 1;
    }

    @media (max-width: 640px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class RecipientDrawerComponent {
  readonly store = inject(RecipientsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly canWrite = inject(PermissionsService).canWrite(WITHHOLDING_RECIPIENTS_MODULE);

  readonly visible = input.required<boolean>();
  /** The recipient to edit; null registers a new one. */
  readonly recipientId = input<string | null>(null);
  readonly closed = output<void>();
  /** The registry changed (saved or deleted): the host reads its list again. */
  readonly changed = output<void>();

  readonly regimes = WR_REGIMES;
  readonly causals = WR_CU_CAUSALS;
  readonly mandates = WR_ENASARCO_MANDATES;
  readonly activityTypes = WR_ACTIVITY_TYPES;

  readonly form = signal<RecipientFormValue>({ ...DEFAULT_RECIPIENT_FORM });
  readonly error = signal<WrOutcome | null>(null);
  /** The id the drawer works on: the input, or the id of the recipient it just created. */
  readonly currentId = signal<string | null>(null);

  readonly editing = computed(() => this.currentId() !== null);
  readonly swiss = computed(() => isSwissRegime(this.form().regime));
  readonly agent = computed(() => isAgentRegime(this.form().regime));
  readonly occasional = computed(() => isOccasionalRegime(this.form().regime));
  readonly declaresIncome = computed(() => declaresThirdPartyIncome(this.form().regime));
  readonly currency = computed(() => regimeCurrency(this.form().regime));
  readonly valid = computed(() => isRecipientFormValid(this.form()));
  /** The birth date the Codice Fiscale encodes, shown as a hint under the fields. */
  readonly fiscalCodeBirthDate = computed(() =>
    this.swiss() ? null : birthDateFromFiscalCode(this.form().tax_code),
  );

  constructor() {
    // Every time the drawer opens it starts from the recipient (or from the defaults of a new one).
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const id = this.recipientId();
      untracked(() => {
        this.error.set(null);
        this.currentId.set(id);
        this.form.set({ ...DEFAULT_RECIPIENT_FORM });
        if (id) {
          void this.load(id);
        } else {
          this.store.reset();
        }
      });
    });
  }

  private async load(id: string): Promise<void> {
    await this.store.open(id);
    const recipient = this.store.recipient();
    if (recipient && recipient.id === this.currentId()) {
      this.form.set(recipientFormOf(recipient));
    }
  }

  patch(change: Partial<RecipientFormValue>): void {
    this.form.update((current) => ({ ...current, ...change }));
  }

  /** Types the Codice Fiscale and proposes the birth date it encodes while the birth date is empty or was proposed. */
  changeTaxCode(value: string): void {
    const previous = this.fiscalCodeBirthDate();
    const decoded = birthDateFromFiscalCode(value);
    const current = this.form().birth_date;
    this.patch({
      tax_code: value,
      ...(decoded && (current === '' || current === previous) ? { birth_date: decoded } : {}),
    });
  }

  async save(): Promise<void> {
    if (!this.valid() || !this.canWrite) {
      return;
    }
    this.error.set(null);
    const outcome = await this.store.save(this.currentId(), recipientPayloadOf(this.form()));
    if (outcome.ok) {
      const saved = this.store.recipient();
      if (saved) {
        this.currentId.set(saved.id);
        this.form.set(recipientFormOf(saved));
      }
      this.message.success(this.translate.instant('withholdingRecipients.message.saved'));
      this.changed.emit();
    } else {
      this.error.set(outcome);
    }
  }

  async remove(): Promise<void> {
    const id = this.currentId();
    if (!id) {
      return;
    }
    this.error.set(null);
    const outcome = await this.store.remove(id);
    if (outcome.ok) {
      this.message.success(this.translate.instant('withholdingRecipients.message.deleted'));
      this.changed.emit();
      this.closed.emit();
    } else {
      this.error.set(outcome);
    }
  }
}
