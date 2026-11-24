import {
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
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  AGC_ACCRUAL_BASES,
  AGC_AGENT_TYPES,
  AGC_ENASARCO_MANDATES,
  AGC_FISCAL_REGIMES,
  AGC_SETTLEMENT_CHANNELS,
  AGC_SPLIT_MODES,
  AgcAgentProfile,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';
import {
  AgcOutcome,
  agentFormOf,
  AgentFormValue,
  agentPayloadOf,
  DEFAULT_AGENT_FORM,
  isAgentFormValid,
  isItalianRegime,
  isSubAgentType,
  parentCandidates,
} from './agent-commissions.util';
import { AgentsStore } from './agents.store';

/**
 * Create or edit the agent profile of a sales representative: type, regime, accrual basis, rates, settlement channel,
 * sub-agent split and the contract data. Uses the `AgentsStore` of the page that hosts it.
 */
@Component({
  selector: 'app-agent-form-drawer',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="600"
      [nzTitle]="
        (editing()
          ? 'agentCommissions.agents.formTitleEdit'
          : 'agentCommissions.agents.formTitleNew'
        ) | translate
      "
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        @if (error(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? '' | translate"
            [nzDescription]="failure.detail ?? ''"
          ></nz-alert>
        }

        <div class="grid">
          @if (!editing()) {
            <label class="field wide" for="agc-agent-representative">
              <span>{{ 'agentCommissions.field.representative' | translate }}</span>
              <nz-select
                nzId="agc-agent-representative"
                nzShowSearch
                [ngModel]="form().sales_representative_id"
                (ngModelChange)="pickRepresentative($event)"
              >
                @for (rep of store.representatives(); track rep.id) {
                  <nz-option
                    [nzValue]="rep.id"
                    [nzLabel]="rep.rep_code ? rep.rep_code + ' · ' + rep.name : rep.name"
                  ></nz-option>
                }
              </nz-select>
            </label>
          } @else {
            <p class="field wide representative">
              <strong>{{ agent()?.representative?.name }}</strong>
            </p>
          }

          <label class="field" for="agc-agent-type">
            <span>{{ 'agentCommissions.field.agentType' | translate }}</span>
            <nz-select
              nzId="agc-agent-type"
              [ngModel]="form().agent_type"
              (ngModelChange)="patch({ agent_type: $event })"
            >
              @for (type of agentTypes; track type) {
                <nz-option
                  [nzValue]="type"
                  [nzLabel]="'agentCommissions.agentType.' + type | translate"
                ></nz-option>
              }
            </nz-select>
          </label>

          <label class="field" for="agc-agent-regime">
            <span>{{ 'agentCommissions.field.fiscalRegime' | translate }}</span>
            <nz-select
              nzId="agc-agent-regime"
              [ngModel]="form().fiscal_regime"
              (ngModelChange)="patch({ fiscal_regime: $event })"
            >
              @for (regime of fiscalRegimes; track regime) {
                <nz-option
                  [nzValue]="regime"
                  [nzLabel]="'agentCommissions.fiscalRegime.' + regime | translate"
                ></nz-option>
              }
            </nz-select>
          </label>

          @if (italian()) {
            <label class="field" for="agc-agent-mandate">
              <span>{{ 'agentCommissions.field.enasarcoMandate' | translate }}</span>
              <nz-select
                nzId="agc-agent-mandate"
                [ngModel]="form().enasarco_mandate"
                (ngModelChange)="patch({ enasarco_mandate: $event })"
              >
                @for (mandate of mandates; track mandate) {
                  <nz-option
                    [nzValue]="mandate"
                    [nzLabel]="'agentCommissions.enasarcoMandate.' + mandate | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="agc-agent-registration">
              <span>{{ 'agentCommissions.field.registration' | translate }}</span>
              <input
                nz-input
                id="agc-agent-registration"
                [ngModel]="form().enasarco_registration_number"
                (ngModelChange)="patch({ enasarco_registration_number: $event })"
              />
            </label>
          } @else {
            <p class="hint wide">{{ 'agentCommissions.agents.swissHint' | translate }}</p>
          }

          @if (subAgent()) {
            <p class="hint wide">{{ 'agentCommissions.agents.subAgentHint' | translate }}</p>
            <label class="field" for="agc-agent-parent">
              <span>{{ 'agentCommissions.field.parentAgent' | translate }}</span>
              <nz-select
                nzId="agc-agent-parent"
                nzAllowClear
                [ngModel]="form().parent_agent_profile_id"
                (ngModelChange)="patch({ parent_agent_profile_id: $event ?? null })"
              >
                @for (parent of parents(); track parent.id) {
                  <nz-option
                    [nzValue]="parent.id"
                    [nzLabel]="parent.representative?.name ?? parent.id"
                  ></nz-option>
                }
              </nz-select>
            </label>
            @if (form().parent_agent_profile_id) {
              <label class="field" for="agc-agent-split-mode">
                <span>{{ 'agentCommissions.field.splitMode' | translate }}</span>
                <nz-select
                  nzId="agc-agent-split-mode"
                  [ngModel]="form().parent_split_mode"
                  (ngModelChange)="patch({ parent_split_mode: $event ?? null })"
                >
                  @for (mode of splitModes; track mode) {
                    <nz-option
                      [nzValue]="mode"
                      [nzLabel]="'agentCommissions.splitMode.' + mode | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="agc-agent-split-value">
                <span>{{ 'agentCommissions.field.splitValue' | translate }}</span>
                <nz-input-number
                  nzId="agc-agent-split-value"
                  [nzMin]="0"
                  [nzMax]="100"
                  [nzStep]="0.5"
                  [ngModel]="form().parent_split_value"
                  (ngModelChange)="patch({ parent_split_value: $event })"
                ></nz-input-number>
              </label>
            }
          }

          <label class="field" for="agc-agent-accrual">
            <span>{{ 'agentCommissions.field.accrualBasis' | translate }}</span>
            <nz-select
              nzId="agc-agent-accrual"
              [ngModel]="form().accrual_basis"
              (ngModelChange)="patch({ accrual_basis: $event })"
            >
              @for (basis of accrualBases; track basis) {
                <nz-option
                  [nzValue]="basis"
                  [nzLabel]="'agentCommissions.accrualBasis.' + basis | translate"
                ></nz-option>
              }
            </nz-select>
          </label>

          <label class="field" for="agc-agent-rate">
            <span>{{ 'agentCommissions.field.defaultRate' | translate }}</span>
            <nz-input-number
              nzId="agc-agent-rate"
              [nzMin]="0"
              [nzMax]="100"
              [nzStep]="0.5"
              [ngModel]="form().default_rate"
              (ngModelChange)="patch({ default_rate: $event })"
            ></nz-input-number>
          </label>

          <label class="field" for="agc-agent-channel">
            <span>{{ 'agentCommissions.field.settlementChannel' | translate }}</span>
            <nz-select
              nzId="agc-agent-channel"
              [ngModel]="form().settlement_channel"
              (ngModelChange)="patch({ settlement_channel: $event })"
            >
              @for (channel of channels; track channel) {
                <nz-option
                  [nzValue]="channel"
                  [nzLabel]="'agentCommissions.settlementChannel.' + channel | translate"
                ></nz-option>
              }
            </nz-select>
          </label>

          <label class="field" for="agc-agent-tax-code">
            <span>{{ 'agentCommissions.field.taxCode' | translate }}</span>
            <input
              nz-input
              id="agc-agent-tax-code"
              [ngModel]="form().tax_code"
              (ngModelChange)="patch({ tax_code: $event })"
            />
          </label>

          <label class="field" for="agc-agent-vat-number">
            <span>{{ 'agentCommissions.field.vatNumber' | translate }}</span>
            <input
              nz-input
              id="agc-agent-vat-number"
              [ngModel]="form().vat_number"
              (ngModelChange)="patch({ vat_number: $event })"
            />
          </label>

          <label class="field" for="agc-agent-start">
            <span>{{ 'agentCommissions.field.contractStart' | translate }}</span>
            <input
              nz-input
              id="agc-agent-start"
              type="date"
              [ngModel]="form().contract_start"
              (ngModelChange)="patch({ contract_start: $event })"
            />
          </label>

          <label class="field" for="agc-agent-end">
            <span>{{ 'agentCommissions.field.contractEnd' | translate }}</span>
            <input
              nz-input
              id="agc-agent-end"
              type="date"
              [ngModel]="form().contract_end"
              (ngModelChange)="patch({ contract_end: $event })"
            />
          </label>

          <div class="checks wide">
            <label
              for="agc-agent-own-organization"
              nzId="agc-agent-own-organization"
              nz-checkbox
              [ngModel]="form().has_own_organization"
              (ngModelChange)="patch({ has_own_organization: $event })"
              >{{ 'agentCommissions.field.ownOrganization' | translate }}</label
            >
            <label
              for="agc-agent-vat-applies"
              nzId="agc-agent-vat-applies"
              nz-checkbox
              [ngModel]="form().vat_applies"
              (ngModelChange)="patch({ vat_applies: $event })"
              >{{ 'agentCommissions.field.vatApplies' | translate }}</label
            >
            @if (italian()) {
              <label
                for="agc-agent-firr"
                nzId="agc-agent-firr"
                nz-checkbox
                [ngModel]="form().firr_enabled"
                (ngModelChange)="patch({ firr_enabled: $event })"
                >{{ 'agentCommissions.field.firrEnabled' | translate }}</label
              >
            }
            <label
              for="agc-agent-active"
              nzId="agc-agent-active"
              nz-checkbox
              [ngModel]="form().is_active"
              (ngModelChange)="patch({ is_active: $event })"
              >{{ 'agentCommissions.field.active' | translate }}</label
            >
          </div>

          <label class="field wide" for="agc-agent-notes">
            <span>{{ 'agentCommissions.field.notes' | translate }}</span>
            <textarea
              nz-input
              id="agc-agent-notes"
              rows="3"
              [ngModel]="form().notes"
              (ngModelChange)="patch({ notes: $event })"
            ></textarea>
          </label>
        </div>

        <div class="footer">
          <button nz-button type="button" (click)="closed.emit()">
            {{ 'agentCommissions.action.cancel' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.saving()"
            [disabled]="!valid()"
            (click)="save()"
          >
            {{ 'agentCommissions.action.save' | translate }}
          </button>
        </div>
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
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
    }
  `,
})
export class AgentFormDrawerComponent {
  readonly store = inject(AgentsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly visible = input.required<boolean>();
  /** The profile to edit; null creates the profile of a representative. */
  readonly agent = input<AgcAgentProfile | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly agentTypes = AGC_AGENT_TYPES;
  readonly fiscalRegimes = AGC_FISCAL_REGIMES;
  readonly mandates = AGC_ENASARCO_MANDATES;
  readonly accrualBases = AGC_ACCRUAL_BASES;
  readonly channels = AGC_SETTLEMENT_CHANNELS;
  readonly splitModes = AGC_SPLIT_MODES;

  readonly form = signal<AgentFormValue>({ ...DEFAULT_AGENT_FORM });
  readonly error = signal<AgcOutcome | null>(null);

  readonly editing = computed(() => this.agent() !== null);
  readonly italian = computed(() => isItalianRegime(this.form().fiscal_regime));
  readonly subAgent = computed(() => isSubAgentType(this.form().agent_type));
  readonly valid = computed(() => isAgentFormValid(this.form(), !this.editing()));
  readonly parents = computed(() =>
    parentCandidates(this.store.agents(), this.agent()?.id ?? null),
  );

  constructor() {
    // Every time the drawer opens it starts from the profile (or from the defaults of a new agent).
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const agent = this.agent();
      untracked(() => {
        this.error.set(null);
        this.form.set(agent ? agentFormOf(agent) : { ...DEFAULT_AGENT_FORM });
        if (!agent) {
          void this.store.loadRepresentatives();
        }
      });
    });
  }

  patch(change: Partial<AgentFormValue>): void {
    this.form.update((current) => ({ ...current, ...change }));
  }

  /** Picks the representative and proposes its default rate as the starting point of the agent rate. */
  pickRepresentative(id: string | null): void {
    const representative = this.store.representatives().find((rep) => rep.id === id);
    const rate = representative ? Number(representative.default_commission_rate) : null;
    this.patch({
      sales_representative_id: id,
      ...(this.form().default_rate === null && rate !== null && Number.isFinite(rate)
        ? { default_rate: rate }
        : {}),
    });
  }

  async save(): Promise<void> {
    if (!this.valid()) {
      return;
    }
    this.error.set(null);
    const outcome = await this.store.save(
      this.agent()?.id ?? null,
      agentPayloadOf(this.form(), !this.editing()),
    );
    if (outcome.ok) {
      this.message.success(this.translate.instant('agentCommissions.message.saved'));
      this.saved.emit();
    } else {
      this.error.set(outcome);
    }
  }
}
