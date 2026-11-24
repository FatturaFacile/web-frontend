import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AgcFiscalParameter, AgcZone, PermissionsService, TranslateService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import {
  AGENT_COMMISSIONS_MODULE,
  AGENT_COMMISSIONS_SETTLE_MODULE,
  AgcOutcome,
  bracketRowsOf,
  DEFAULT_ZONE_FORM,
  emptyTierRow,
  fiscalCodeKey,
  fiscalOverrideOf,
  formatRate,
  isBracketParameter,
  isFiscalFormValid,
  isPercentParameter,
  isZoneFormValid,
  TierRow,
  toNumber,
  ZoneFormValue,
  zoneFormOf,
  zonePayloadOf,
} from './agent-commissions.util';
import { SettingsStore } from './settings.store';

/** The currency of the fiscal amounts (massimale, minimale): the Italian regime is in euro. */
const FISCAL_CURRENCY = 'EUR';

/**
 * Zones and fiscal parameters (Mod 041). The zones group provinces or cantons for the commission rules. The fiscal
 * parameters (Enasarco rates, ceiling and floor, FIRR brackets, withholding, VAT) show the statutory value and the
 * override of the company, which administration can set or remove.
 */
@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [SettingsStore],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.AGENT_COMMISSIONS_SETTINGS' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (actionError(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <section class="section" [attr.aria-label]="'agentCommissions.zones.title' | translate">
        <div class="section-head">
          <h3>{{ 'agentCommissions.zones.title' | translate }}</h3>
          @if (canWrite) {
            <button nz-button nzType="primary" type="button" (click)="openZone(null)">
              {{ 'agentCommissions.action.new' | translate }}
            </button>
          }
        </div>
        <nz-table
          #zoneTable
          nzSize="small"
          [nzData]="store.zones()"
          [nzFrontPagination]="false"
          [nzShowPagination]="false"
        >
          <thead>
            <tr>
              <th scope="col">{{ 'agentCommissions.field.code' | translate }}</th>
              <th scope="col">{{ 'agentCommissions.field.name' | translate }}</th>
              <th scope="col">{{ 'agentCommissions.field.country' | translate }}</th>
              <th scope="col">{{ 'agentCommissions.field.regions' | translate }}</th>
              <th scope="col">{{ 'agentCommissions.field.active' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (zone of zoneTable.data; track zone.id) {
              <tr>
                <th scope="row">{{ zone.code }}</th>
                <td>{{ zone.name }}</td>
                <td>{{ zone.country }}</td>
                <td>{{ zone.regions.join(', ') }}</td>
                <td>
                  <nz-tag [nzColor]="zone.is_active ? 'green' : 'default'">{{
                    (zone.is_active ? 'agentCommissions.action.yes' : 'agentCommissions.action.no')
                      | translate
                  }}</nz-tag>
                </td>
                <td class="actions">
                  @if (canWrite) {
                    <button nz-button nzSize="small" type="button" (click)="openZone(zone)">
                      {{ 'agentCommissions.action.edit' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'agentCommissions.action.confirmDelete' | translate"
                      [nzOkText]="'agentCommissions.action.delete' | translate"
                      [nzCancelText]="'agentCommissions.action.cancel' | translate"
                      (nzOnConfirm)="removeZone(zone)"
                    >
                      {{ 'agentCommissions.action.delete' | translate }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (!store.loading() && store.zones().length === 0) {
          <nz-empty [nzNotFoundContent]="'agentCommissions.zones.empty' | translate"></nz-empty>
        }
      </section>

      <section
        class="section"
        [attr.aria-label]="'agentCommissions.enasarco.parametersTitle' | translate"
      >
        <div class="section-head">
          <h3>{{ 'agentCommissions.enasarco.parametersTitle' | translate }}</h3>
        </div>
        <nz-table
          #parameterTable
          nzSize="small"
          [nzData]="store.sortedParameters()"
          [nzFrontPagination]="false"
          [nzShowPagination]="false"
        >
          <thead>
            <tr>
              <th scope="col">{{ 'agentCommissions.field.name' | translate }}</th>
              <th scope="col">{{ 'agentCommissions.field.mandate' | translate }}</th>
              <th scope="col">{{ 'agentCommissions.field.year' | translate }}</th>
              <th scope="col">{{ 'agentCommissions.field.value' | translate }}</th>
              <th scope="col">{{ 'agentCommissions.field.status' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (parameter of parameterTable.data; track parameter.id) {
              <tr>
                <th scope="row">{{ codeKey(parameter.code) | translate }}</th>
                <td>
                  @if (parameter.mandate_type) {
                    {{ 'agentCommissions.enasarcoMandate.' + parameter.mandate_type | translate }}
                  }
                </td>
                <td>{{ parameter.year }}</td>
                <td>
                  @if (isBrackets(parameter.code)) {
                    @for (bracket of parameter.payload ?? []; track $index) {
                      <nz-tag>{{ bracket.up_to ?? '∞' }}: {{ rate(bracket.rate) }}</nz-tag>
                    }
                  } @else if (isPercent(parameter.code)) {
                    {{ rate(parameter.value) }}
                  } @else if (parameter.value !== null) {
                    {{ parameter.value | money: currency }}
                  }
                </td>
                <td>
                  <nz-tag [nzColor]="parameter.is_override ? 'blue' : 'default'">{{
                    (parameter.is_override
                      ? 'agentCommissions.enasarco.override'
                      : 'agentCommissions.enasarco.statutory'
                    ) | translate
                  }}</nz-tag>
                </td>
                <td class="actions">
                  @if (canSettle) {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      (click)="openParameter(parameter)"
                    >
                      {{ 'agentCommissions.action.saveOverride' | translate }}
                    </button>
                    @if (parameter.is_override) {
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        nz-popconfirm
                        [nzPopconfirmTitle]="'agentCommissions.action.removeOverride' | translate"
                        [nzOkText]="'agentCommissions.action.removeOverride' | translate"
                        [nzCancelText]="'agentCommissions.action.cancel' | translate"
                        (nzOnConfirm)="removeOverride(parameter)"
                      >
                        {{ 'agentCommissions.action.removeOverride' | translate }}
                      </button>
                    }
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </section>
    </nz-spin>

    <nz-modal
      [nzVisible]="zoneOpen()"
      [nzTitle]="
        (editingZone() ? 'agentCommissions.action.edit' : 'agentCommissions.action.new') | translate
      "
      [nzOkText]="'agentCommissions.action.save' | translate"
      [nzCancelText]="'agentCommissions.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="!zoneValid()"
      (nzOnOk)="saveZone()"
      (nzOnCancel)="zoneOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (modalError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? '' | translate"
            [nzDescription]="failure.detail ?? ''"
          ></nz-alert>
        }
        <div class="editor">
          <label class="field" for="agc-zone-code">
            <span>{{ 'agentCommissions.field.code' | translate }}</span>
            <input
              nz-input
              id="agc-zone-code"
              maxlength="40"
              [ngModel]="zone().code"
              (ngModelChange)="patchZone({ code: $event })"
            />
          </label>
          <label class="field" for="agc-zone-name">
            <span>{{ 'agentCommissions.field.name' | translate }}</span>
            <input
              nz-input
              id="agc-zone-name"
              maxlength="160"
              [ngModel]="zone().name"
              (ngModelChange)="patchZone({ name: $event })"
            />
          </label>
          <label class="field" for="agc-zone-country">
            <span>{{ 'agentCommissions.field.country' | translate }}</span>
            <input
              nz-input
              id="agc-zone-country"
              maxlength="2"
              [ngModel]="zone().country"
              (ngModelChange)="patchZone({ country: $event })"
            />
          </label>
          <label class="field wide" for="agc-zone-regions">
            <span>{{ 'agentCommissions.field.regions' | translate }}</span>
            <input
              nz-input
              id="agc-zone-regions"
              [ngModel]="zone().regions"
              (ngModelChange)="patchZone({ regions: $event })"
            />
            <small class="hint">{{ 'agentCommissions.zones.regionsHint' | translate }}</small>
          </label>
          <label
            for="agc-zone-active"
            nzId="agc-zone-active"
            nz-checkbox
            [ngModel]="zone().is_active"
            (ngModelChange)="patchZone({ is_active: $event })"
            >{{ 'agentCommissions.field.active' | translate }}</label
          >
        </div>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="parameter() !== null"
      [nzWidth]="560"
      [nzTitle]="parameterTitle() | translate"
      [nzOkText]="'agentCommissions.action.saveOverride' | translate"
      [nzCancelText]="'agentCommissions.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="!parameterValid()"
      (nzOnOk)="saveParameter()"
      (nzOnCancel)="parameter.set(null)"
    >
      <ng-container *nzModalContent>
        @if (modalError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? '' | translate"
            [nzDescription]="failure.detail ?? ''"
          ></nz-alert>
        }
        @if (parameter(); as current) {
          @if (isBrackets(current.code)) {
            @for (row of brackets(); track $index) {
              <div class="bracket-row">
                <label class="field" [attr.for]="'agc-bracket-to-' + $index">
                  <span>{{ 'agentCommissions.field.thresholdTo' | translate }}</span>
                  <nz-input-number
                    [nzId]="'agc-bracket-to-' + $index"
                    [nzMin]="0"
                    [ngModel]="row.to"
                    (ngModelChange)="patchBracket($index, { to: $event })"
                  ></nz-input-number>
                </label>
                <label class="field" [attr.for]="'agc-bracket-rate-' + $index">
                  <span>{{ 'agentCommissions.field.rate' | translate }}</span>
                  <nz-input-number
                    [nzId]="'agc-bracket-rate-' + $index"
                    [nzMin]="0"
                    [nzMax]="100"
                    [nzStep]="0.5"
                    [ngModel]="row.rate"
                    (ngModelChange)="patchBracket($index, { rate: $event })"
                  ></nz-input-number>
                </label>
                <button
                  nz-button
                  nzDanger
                  nzSize="small"
                  type="button"
                  (click)="removeBracket($index)"
                >
                  {{ 'agentCommissions.action.removeTier' | translate }}
                </button>
              </div>
            }
            <button nz-button type="button" (click)="addBracket()">
              {{ 'agentCommissions.action.addTier' | translate }}
            </button>
          } @else {
            <label class="field" for="agc-parameter-value">
              <span>{{ codeKey(current.code) | translate }}</span>
              <nz-input-number
                nzId="agc-parameter-value"
                [nzMin]="0"
                [nzMax]="isPercent(current.code) ? 100 : 100000000"
                [nzStep]="isPercent(current.code) ? 0.1 : 1"
                [ngModel]="parameterValue()"
                (ngModelChange)="parameterValue.set($event)"
              ></nz-input-number>
            </label>
          }
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .feedback {
      margin-bottom: 12px;
    }

    .section {
      margin-bottom: 32px;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .section-head h3 {
      margin: 0;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .editor {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .bracket-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
      align-items: end;
      gap: 12px;
      margin-bottom: 12px;
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
      color: var(--ant-text-color-secondary, #595959);
    }
  `,
})
export class SettingsComponent implements OnInit {
  readonly store = inject(SettingsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);

  /** Zones are maintained like the other conditions; the fiscal parameters are the `settle` ability. */
  readonly canWrite = this.permissions.canWrite(AGENT_COMMISSIONS_MODULE);
  readonly canSettle = this.permissions.canWrite(AGENT_COMMISSIONS_SETTLE_MODULE);

  readonly currency = FISCAL_CURRENCY;
  readonly codeKey = fiscalCodeKey;
  readonly isBrackets = isBracketParameter;
  readonly isPercent = isPercentParameter;
  readonly rate = formatRate;

  readonly actionError = signal<string | null>(null);
  readonly modalError = signal<AgcOutcome | null>(null);

  // --- Zone dialog ---
  readonly zoneOpen = signal(false);
  readonly editingZone = signal<AgcZone | null>(null);
  readonly zone = signal<ZoneFormValue>({ ...DEFAULT_ZONE_FORM });
  readonly zoneValid = computed(() => isZoneFormValid(this.zone()));

  // --- Parameter dialog ---
  /** The row whose override is being edited; null when the dialog is closed. */
  readonly parameter = signal<AgcFiscalParameter | null>(null);
  readonly parameterValue = signal<number | null>(null);
  readonly brackets = signal<TierRow[]>([]);
  readonly parameterValid = computed(() => {
    const current = this.parameter();
    return current !== null && isFiscalFormValid(current, this.parameterValue(), this.brackets());
  });
  readonly parameterTitle = computed(() => {
    const current = this.parameter();
    return current ? fiscalCodeKey(current.code) : 'agentCommissions.action.saveOverride';
  });

  ngOnInit(): void {
    void this.store.init();
  }

  // --- Zones ---

  openZone(zone: AgcZone | null): void {
    this.modalError.set(null);
    this.editingZone.set(zone);
    this.zone.set(zone ? zoneFormOf(zone) : { ...DEFAULT_ZONE_FORM });
    this.zoneOpen.set(true);
  }

  patchZone(change: Partial<ZoneFormValue>): void {
    this.zone.update((current) => ({ ...current, ...change }));
  }

  async saveZone(): Promise<void> {
    if (!this.zoneValid()) {
      return;
    }
    this.modalError.set(null);
    const outcome = await this.store.saveZone(
      this.editingZone()?.id ?? null,
      zonePayloadOf(this.zone()),
    );
    if (outcome.ok) {
      this.zoneOpen.set(false);
      this.message.success(this.translate.instant('agentCommissions.message.saved'));
    } else {
      this.modalError.set(outcome);
    }
  }

  async removeZone(zone: AgcZone): Promise<void> {
    this.actionError.set(null);
    const outcome = await this.store.removeZone(zone.id);
    if (outcome.ok) {
      this.message.success(this.translate.instant('agentCommissions.message.deleted'));
    } else {
      this.actionError.set(outcome.errorKey);
    }
  }

  // --- Fiscal parameters ---

  openParameter(parameter: AgcFiscalParameter): void {
    this.modalError.set(null);
    this.parameterValue.set(toNumber(parameter.value));
    this.brackets.set(bracketRowsOf(parameter.payload));
    this.parameter.set(parameter);
  }

  addBracket(): void {
    this.brackets.update((rows) => [...rows, emptyTierRow()]);
  }

  removeBracket(index: number): void {
    this.brackets.update((rows) => rows.filter((_, position) => position !== index));
  }

  patchBracket(index: number, change: Partial<TierRow>): void {
    this.brackets.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, ...change } : row)),
    );
  }

  async saveParameter(): Promise<void> {
    const current = this.parameter();
    if (current === null || !this.parameterValid()) {
      return;
    }
    this.modalError.set(null);
    const outcome = await this.store.saveOverride(
      fiscalOverrideOf(current, this.parameterValue(), this.brackets()),
    );
    if (outcome.ok) {
      this.parameter.set(null);
      this.message.success(this.translate.instant('agentCommissions.message.saved'));
    } else {
      this.modalError.set(outcome);
    }
  }

  async removeOverride(parameter: AgcFiscalParameter): Promise<void> {
    this.actionError.set(null);
    const outcome = await this.store.removeOverride(parameter.id);
    if (outcome.ok) {
      this.message.success(this.translate.instant('agentCommissions.message.deleted'));
    } else {
      this.actionError.set(outcome.errorKey);
    }
  }
}
