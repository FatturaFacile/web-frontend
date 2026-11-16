import { Component, computed, DestroyRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, debounceTime, EMPTY, filter, Observable, of, switchMap, tap } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ConfiguratorApiService,
  ConfiguratorConfiguration,
  ConfiguratorConfigurationRequest,
  ConfiguratorEvaluation,
  ConfiguratorGroup,
  ConfiguratorModel,
  ConfiguratorSelection,
  ConfiguratorViolation,
  I18nService,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ResourceLookupService, ResourceOption } from '@shared/ui/resource-panel/resource-lookup.service';
import { configurationStatusColor, formatMoney, trimDecimal, violationKey } from './configurator-format';

/** One shared empty answer: a new array on every change detection would make ngModel write the select again and again. */
const NO_OPTIONS: string[] = [];

@Component({
  selector: 'app-configurator-configure',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'CONFIGURATOR.GUIDED_CONFIGURATION' | translate" [subtitle]="'CONFIGURATOR.GUIDED_SUBTITLE' | translate">
      <div class="header-actions">
        <a nz-button routerLink="/configurator">{{ 'CONFIGURATOR.BACK' | translate }}</a>
      </div>
    </app-page-header>

    @if (!model()) {
      <nz-card>
        <nz-form-item>
          <nz-form-label nzFor="pick-model">{{ 'CONFIGURATOR.CHOOSE_MODEL' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select id="pick-model" nzShowSearch [nzPlaceHolder]="'CONFIGURATOR.CHOOSE_MODEL' | translate" (ngModelChange)="selectModel($event)" [ngModel]="null">
              @for (published of publishedModels(); track published.id) {
                <nz-option [nzValue]="published.id" [nzLabel]="published.code + ' - ' + published.name"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        @if (publishedModels().length === 0) {
          <nz-empty [nzNotFoundContent]="'CONFIGURATOR.NO_PUBLISHED_MODELS' | translate"></nz-empty>
        }
      </nz-card>
    } @else {
      <div class="layout">
        <div class="form-column">
          <nz-card [nzTitle]="model()!.name + ' (' + model()!.code + ')'" [nzExtra]="status">
            <ng-template #status>
              @if (configuration(); as saved) {
                <nz-tag [nzColor]="statusColor(saved.status)">{{ 'CONFIGURATOR.CONFIG_STATUS_' + saved.status.toUpperCase() | translate }}</nz-tag>
                <code>{{ saved.number }}</code>
              }
            </ng-template>
            <div class="terms">
              <nz-form-item>
                <nz-form-label nzFor="cfg-quantity">{{ 'CONFIGURATOR.QUANTITY' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-input-number id="cfg-quantity" [ngModel]="quantity()" (ngModelChange)="setQuantity($event)" [nzMin]="1" [nzDisabled]="locked()"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="cfg-discount">{{ 'CONFIGURATOR.EXTRA_DISCOUNT' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-input-number id="cfg-discount" [ngModel]="discountPercent()" (ngModelChange)="setDiscount($event)" [nzMin]="0" [nzMax]="100" [nzPrecision]="2" [nzDisabled]="locked()"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="wide">
                <nz-form-label nzFor="cfg-contact">{{ 'CONFIGURATOR.CUSTOMER' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select id="cfg-contact" nzAllowClear nzShowSearch [ngModel]="contactId()" (ngModelChange)="setContact($event)" [nzDisabled]="locked()">
                    @for (contact of contacts(); track contact.value) {
                      <nz-option [nzValue]="contact.value" [nzLabel]="contact.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="wide">
                <nz-form-label nzFor="cfg-name">{{ 'CONFIGURATOR.CONFIGURATION_NAME' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="cfg-name" [ngModel]="configurationName()" (ngModelChange)="setName($event)" maxlength="190" [disabled]="locked()" />
                </nz-form-control>
              </nz-form-item>
            </div>
          </nz-card>

          @for (group of model()!.groups ?? []; track group.id) {
            <nz-card class="group" [nzTitle]="groupTitle" [nzExtra]="resetAction">
              <ng-template #groupTitle>
                {{ group.name }}
                @if (group.is_required) {
                  <nz-tag nzColor="blue">{{ 'CONFIGURATOR.REQUIRED' | translate }}</nz-tag>
                }
              </ng-template>
              <ng-template #resetAction>
                @if (isTouched(group) && !locked()) {
                  <button nz-button nzSize="small" nzType="link" (click)="resetGroup(group)">{{ 'CONFIGURATOR.RESET_TO_DEFAULT' | translate }}</button>
                }
              </ng-template>

              @switch (group.type) {
                @case ('single') {
                  <nz-radio-group class="vertical" [ngModel]="singleAnswer(group)" (ngModelChange)="chooseSingle(group, $event)" [nzDisabled]="locked()">
                    @for (option of activeOptions(group); track option.id) {
                      <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                      <label nz-radio [nzValue]="option.code">
                        {{ option.name }}
                        <span class="delta">{{ optionDelta(option.price_delta, option.price_from_product) }}</span>
                      </label>
                    }
                  </nz-radio-group>
                }
                @case ('multi') {
                  <nz-select
                    nzMode="multiple"
                    class="full"
                    [nzPlaceHolder]="'CONFIGURATOR.CHOOSE_OPTIONS' | translate"
                    [ngModel]="multiAnswer(group)"
                    (ngModelChange)="chooseMulti(group, $event)"
                    [nzDisabled]="locked()"
                  >
                    @for (option of activeOptions(group); track option.id) {
                      <nz-option [nzValue]="option.code" [nzLabel]="option.name + ' ' + optionDelta(option.price_delta, option.price_from_product)"></nz-option>
                    }
                  </nz-select>
                }
                @case ('boolean') {
                  @for (option of activeOptions(group); track option.id) {
                    <nz-switch [ngModel]="multiAnswer(group).includes(option.code)" (ngModelChange)="chooseBoolean(group, option.code, $event)" [nzDisabled]="locked()"></nz-switch>
                    <span class="switch-label">{{ option.name }} <span class="delta">{{ optionDelta(option.price_delta, option.price_from_product) }}</span></span>
                  }
                }
                @case ('range') {
                  <nz-input-number
                    [ngModel]="rangeAnswer(group)"
                    (ngModelChange)="chooseRange(group, $event)"
                    [nzMin]="rangeBound(group.range_min, -1e12)"
                    [nzMax]="rangeBound(group.range_max, 1e12)"
                    [nzStep]="rangeBound(group.range_step, 1)"
                    [nzDisabled]="locked()"
                  ></nz-input-number>
                  <span class="switch-label">
                    {{ group.unit }}
                    ({{ trim(group.range_min) }} - {{ trim(group.range_max) }},
                    {{ money(group.unit_price_delta, model()!.currency) }} / {{ group.unit || '1' }})
                  </span>
                }
              }
            </nz-card>
          }
        </div>

        <div class="price-column">
          <nz-card [nzTitle]="'CONFIGURATOR.PRICE' | translate">
            <nz-spin [nzSpinning]="evaluating()">
              @if (evaluation(); as current) {
                @if (current.violations.length > 0) {
                  <nz-alert nzType="error" nzShowIcon [nzMessage]="'CONFIGURATOR.VIOLATIONS' | translate" [nzDescription]="violationList" class="block"></nz-alert>
                  <ng-template #violationList>
                    <ul class="violations">
                      @for (violation of current.violations; track $index) {
                        <li>{{ violationText(violation) }}</li>
                      }
                    </ul>
                  </ng-template>
                } @else {
                  <nz-alert nzType="success" nzShowIcon [nzMessage]="'CONFIGURATOR.VALID' | translate" class="block"></nz-alert>
                }

                <nz-table [nzData]="current.pricing.lines" nzSize="small" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th>{{ 'CONFIGURATOR.COMPONENT' | translate }}</th>
                      <th class="num">{{ 'CONFIGURATOR.UNIT_PRICE_SHORT' | translate }}</th>
                      <th class="num">%</th>
                      <th class="num">{{ 'CONFIGURATOR.LINE_TOTAL' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of current.pricing.lines; track $index) {
                      <tr>
                        <td>{{ line.description }}</td>
                        <td class="num">{{ money(line.unit_price, current.pricing.currency) }}</td>
                        <td class="num">{{ trim(line.discount_percentage) }}</td>
                        <td class="num">{{ money(line.line_total, current.pricing.currency) }}</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>

                <dl class="totals">
                  <dt>{{ 'CONFIGURATOR.UNIT_LIST_PRICE' | translate }}</dt>
                  <dd>{{ money(current.pricing.unit_list_price, current.pricing.currency) }}</dd>
                  @if (current.pricing.volume_discount_percent !== '0.00') {
                    <dt>{{ 'CONFIGURATOR.VOLUME_DISCOUNT' | translate }}</dt>
                    <dd>{{ trim(current.pricing.volume_discount_percent) }} %</dd>
                  }
                  <dt>{{ 'CONFIGURATOR.TOTAL_NET' | translate }}</dt>
                  <dd>
                    <strong>{{ money(current.pricing.total_net, current.pricing.currency) }}</strong>
                  </dd>
                  <dt>{{ 'CONFIGURATOR.TOTAL_TAX' | translate }}</dt>
                  <dd>{{ money(current.pricing.total_tax, current.pricing.currency) }}</dd>
                  <dt>{{ 'CONFIGURATOR.TOTAL_GROSS' | translate }}</dt>
                  <dd>{{ money(current.pricing.total_gross, current.pricing.currency) }}</dd>
                  <dt>{{ 'CONFIGURATOR.MARGIN' | translate }}</dt>
                  <dd>
                    <nz-tag [nzColor]="current.pricing.below_minimum_margin ? 'red' : 'green'">
                      {{ current.pricing.margin_percent ?? '-' }} % ({{ 'CONFIGURATOR.MIN_MARGIN' | translate }} {{ current.pricing.min_margin_percent }} %)
                    </nz-tag>
                  </dd>
                </dl>

                @if (current.pricing.requires_approval) {
                  <nz-alert nzType="warning" nzShowIcon [nzMessage]="'CONFIGURATOR.MARGIN_GUARD' | translate" [nzDescription]="'CONFIGURATOR.MARGIN_GUARD_DESC' | translate" class="block"></nz-alert>
                }
              }
            </nz-spin>

            @if (configuration()?.decision_notes; as notes) {
              <nz-alert nzType="info" nzShowIcon [nzMessage]="'CONFIGURATOR.DECISION_NOTES' | translate" [nzDescription]="notes" class="block"></nz-alert>
            }
            @if (configuration()?.quote_number; as quoteNumber) {
              <nz-alert nzType="success" nzShowIcon [nzMessage]="'CONFIGURATOR.CONVERTED_TO_QUOTE' | translate: { number: quoteNumber }" class="block"></nz-alert>
              <a routerLink="/sales/quotes" class="block">{{ 'CONFIGURATOR.OPEN_QUOTES' | translate }}</a>
            }

            <div class="actions">
              @if (!locked() && canWrite()) {
                <button nz-button nzType="primary" [disabled]="busy()" (click)="save()">{{ 'CONFIGURATOR.SAVE_CONFIGURATION' | translate }}</button>
                <button nz-button [disabled]="busy()" (click)="validate()">{{ 'CONFIGURATOR.VALIDATE' | translate }}</button>
              }
              @if (configuration(); as saved) {
                @if (saved.status === 'validated' && saved.requires_approval && !dirty() && canWrite()) {
                  <button nz-button nzType="primary" [disabled]="busy()" (click)="requestApproval()">{{ 'CONFIGURATOR.REQUEST_APPROVAL' | translate }}</button>
                }
                @if (saved.status === 'pending_approval' && canWrite()) {
                  <button nz-button nzType="primary" [disabled]="busy()" (click)="openDecision('approve')">{{ 'CONFIGURATOR.APPROVE' | translate }}</button>
                  <button nz-button nzDanger [disabled]="busy()" (click)="openDecision('reject')">{{ 'CONFIGURATOR.REJECT' | translate }}</button>
                }
                @if (canConvert() && canWrite()) {
                  <button nz-button nzType="primary" [disabled]="busy() || !contactId()" (click)="convert()">{{ 'CONFIGURATOR.CONVERT_TO_QUOTE' | translate }}</button>
                }
              }
            </div>
          </nz-card>
        </div>
      </div>
    }

    <nz-modal
      [nzVisible]="decisionVisible()"
      [nzTitle]="(decision() === 'reject' ? 'CONFIGURATOR.REJECT' : 'CONFIGURATOR.APPROVE') | translate"
      (nzOnCancel)="decisionVisible.set(false)"
      (nzOnOk)="decide()"
      [nzOkDisabled]="decision() === 'reject' && !decisionNotes.value"
    >
      <ng-container *nzModalContent>
        <nz-form-item>
          <nz-form-label nzFor="decision-notes">{{ 'CONFIGURATOR.DECISION_NOTES' | translate }}</nz-form-label>
          <nz-form-control>
            <textarea nz-input id="decision-notes" rows="3" [formControl]="decisionNotes" maxlength="2000"></textarea>
          </nz-form-control>
        </nz-form-item>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .header-actions { display: flex; gap: 8px; }
    .layout { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; align-items: start; }
    .form-column { display: flex; flex-direction: column; gap: 12px; }
    .price-column { position: sticky; top: 16px; }
    .terms { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0 12px; }
    .terms .wide { grid-column: span 2; }
    .vertical { display: flex; flex-direction: column; gap: 8px; }
    .delta { color: var(--ant-color-text-secondary, #666); margin-left: 8px; }
    .switch-label { margin-left: 12px; }
    .full { width: 100%; }
    .block { margin-bottom: 12px; display: block; }
    .num { text-align: right; }
    .violations { margin: 0; padding-left: 18px; }
    .totals { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 12px 0; }
    .totals dd { margin: 0; text-align: right; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    nz-input-number { width: 100%; }
    @media (max-width: 992px) { .layout { grid-template-columns: 1fr; } .price-column { position: static; } }
  `,
})
export class ConfigureComponent implements OnInit {
  private readonly api = inject(ConfiguratorApiService);
  private readonly lookups = inject(ResourceLookupService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly permissions = inject(PermissionsService);

  readonly statusColor = configurationStatusColor;
  readonly money = formatMoney;
  readonly trim = trimDecimal;

  readonly canWrite = computed(() => this.permissions.canWrite('configurator'));
  readonly publishedModels = signal<ConfiguratorModel[]>([]);
  readonly contacts = signal<ResourceOption[]>([]);
  readonly model = signal<ConfiguratorModel | null>(null);
  readonly configuration = signal<ConfiguratorConfiguration | null>(null);
  readonly evaluation = signal<ConfiguratorEvaluation | null>(null);
  readonly evaluating = signal(false);
  readonly busy = signal(false);
  readonly dirty = signal(true);

  /** What the customer answered; the groups left out show the defaults that the API resolved. */
  readonly answers = signal<Record<string, ConfiguratorSelection>>({});
  readonly quantity = signal(1);
  readonly discountPercent = signal(0);
  readonly contactId = signal<string | null>(null);
  readonly configurationName = signal('');

  readonly locked = computed(() => ['pending_approval', 'converted'].includes(this.configuration()?.status ?? ''));
  readonly canConvert = computed(() => {
    const saved = this.configuration();
    return saved !== null && !this.dirty() && (saved.status === 'approved' || (saved.status === 'validated' && !saved.requires_approval));
  });

  readonly decision = signal<'approve' | 'reject'>('approve');
  readonly decisionVisible = signal(false);
  readonly decisionNotes = new FormControl('', { nonNullable: true });

  private readonly request = computed(() => {
    const model = this.model();
    if (model === null) {
      return null;
    }
    return { modelId: model.id, payload: this.payload() };
  });

  ngOnInit(): void {
    this.api
      .getModels('published')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (response) => this.publishedModels.set(response.data) });
    this.lookups
      .options('contacts')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (options) => this.contacts.set(options) });

    toObservable(this.request, { injector: this.injector })
      .pipe(
        filter((request) => request !== null),
        debounceTime(250),
        tap(() => this.evaluating.set(true)),
        switchMap((request) =>
          this.api.evaluate(request.modelId, request.payload).pipe(
            catchError(() => {
              this.evaluating.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.evaluation.set(response.data);
        this.evaluating.set(false);
      });

    const query = this.route.snapshot.queryParamMap;
    const configurationId = query.get('configuration');
    const modelId = query.get('model');

    if (configurationId) {
      this.loadConfiguration(configurationId);
    } else if (modelId) {
      this.selectModel(modelId);
    }
  }

  selectModel(modelId: string): void {
    this.api.getModel(modelId).subscribe({
      next: (response) => {
        this.model.set(response.data);
        this.answers.set({});
        this.dirty.set(true);
      },
      error: (error) => this.fail(error),
    });
  }

  private loadConfiguration(id: string): void {
    this.api.getConfiguration(id).subscribe({
      next: (response) => this.applyConfiguration(response.data, true),
      error: (error) => this.fail(error),
    });
  }

  private applyConfiguration(configuration: ConfiguratorConfiguration, loadModel: boolean): void {
    this.configuration.set(configuration);
    this.answers.set(Object.fromEntries(configuration.selections.map((selection) => [selection.group, selection])));
    this.quantity.set(Number(configuration.quantity));
    this.discountPercent.set(Number(configuration.discount_percent));
    this.contactId.set(configuration.contact_id);
    this.configurationName.set(configuration.name ?? '');
    this.dirty.set(false);

    if (loadModel) {
      this.api.getModel(configuration.model_id).subscribe({
        next: (response) => this.model.set(response.data),
        error: (error) => this.fail(error),
      });
    }
  }

  activeOptions(group: ConfiguratorGroup) {
    return (group.options ?? []).filter((option) => option.is_active);
  }

  optionDelta(delta: string, fromPriceList: boolean): string {
    if (fromPriceList) {
      return `(${this.i18n.translate('CONFIGURATOR.FROM_PRICE_LIST')})`;
    }
    const value = Number(delta);
    return value === 0 ? '' : `(${value > 0 ? '+' : ''}${formatMoney(delta, this.model()?.currency ?? 'EUR')})`;
  }

  isTouched(group: ConfiguratorGroup): boolean {
    return this.answers()[group.code] !== undefined;
  }

  private answerOf(group: ConfiguratorGroup): ConfiguratorSelection | undefined {
    return this.answers()[group.code] ?? this.evaluation()?.selections.find((selection) => selection.group === group.code);
  }

  singleAnswer(group: ConfiguratorGroup): string | null {
    return this.answerOf(group)?.options?.[0] ?? null;
  }

  multiAnswer(group: ConfiguratorGroup): string[] {
    return this.answerOf(group)?.options ?? NO_OPTIONS;
  }

  /** A bound of a range as a number, or the fallback when the group has none. */
  rangeBound(value: string | null, fallback: number): number {
    return value === null ? fallback : Number(value);
  }

  rangeAnswer(group: ConfiguratorGroup): number | null {
    const value = this.answerOf(group)?.value;
    return value === null || value === undefined ? null : Number(value);
  }

  chooseSingle(group: ConfiguratorGroup, code: string): void {
    this.setAnswer({ group: group.code, options: [code] });
  }

  chooseMulti(group: ConfiguratorGroup, codes: string[]): void {
    this.setAnswer({ group: group.code, options: codes });
  }

  chooseBoolean(group: ConfiguratorGroup, code: string, enabled: boolean): void {
    this.setAnswer({ group: group.code, options: enabled ? [code] : [] });
  }

  chooseRange(group: ConfiguratorGroup, value: number | null): void {
    this.setAnswer({ group: group.code, value });
  }

  resetGroup(group: ConfiguratorGroup): void {
    this.answers.update((answers) => Object.fromEntries(Object.entries(answers).filter(([code]) => code !== group.code)));
    this.dirty.set(true);
  }

  setQuantity(value: number | null): void {
    this.quantity.set(value ?? 1);
    this.dirty.set(true);
  }

  setDiscount(value: number | null): void {
    this.discountPercent.set(value ?? 0);
    this.dirty.set(true);
  }

  setContact(value: string | null): void {
    this.contactId.set(value);
    this.dirty.set(true);
  }

  setName(value: string): void {
    this.configurationName.set(value);
    this.dirty.set(true);
  }

  violationText(violation: ConfiguratorViolation): string {
    const key = violationKey(violation);
    const text = this.i18n.translate(key, violation.params);
    return text === key ? violation.message : text;
  }

  save(): void {
    this.run(this.persist(), (saved) => {
      this.message.success(this.i18n.translate('CONFIGURATOR.CONFIGURATION_SAVED'));
      this.applyConfiguration(saved, false);
    });
  }

  validate(): void {
    this.run(
      this.persist().pipe(
        switchMap((saved) =>
          this.api.validateConfiguration(saved.id).pipe(
            tap((result) => this.evaluation.set(result.data)),
            switchMap(() => this.api.getConfiguration(saved.id)),
          ),
        ),
      ),
      (response) => {
        this.applyConfiguration(response.data, false);
        const valid = response.data.status === 'validated';
        this.message[valid ? 'success' : 'warning'](this.i18n.translate(valid ? 'CONFIGURATOR.CONFIGURATION_VALIDATED' : 'CONFIGURATOR.CONFIGURATION_INVALID'));
      },
    );
  }

  requestApproval(): void {
    const saved = this.configuration();
    if (saved) {
      this.run(this.api.requestApproval(saved.id).pipe(switchMap((response) => of(response.data))), (updated) => {
        this.message.success(this.i18n.translate('CONFIGURATOR.APPROVAL_REQUESTED'));
        this.applyConfiguration(updated, false);
      });
    }
  }

  openDecision(decision: 'approve' | 'reject'): void {
    this.decision.set(decision);
    this.decisionNotes.reset('');
    this.decisionVisible.set(true);
  }

  decide(): void {
    const saved = this.configuration();
    if (!saved) {
      return;
    }

    const notes = this.decisionNotes.value;
    const request =
      this.decision() === 'approve' ? this.api.approveConfiguration(saved.id, notes || undefined) : this.api.rejectConfiguration(saved.id, notes);
    this.run(request.pipe(switchMap((response) => of(response.data))), (updated) => {
      this.decisionVisible.set(false);
      this.message.success(this.i18n.translate(this.decision() === 'approve' ? 'CONFIGURATOR.APPROVED' : 'CONFIGURATOR.REJECTED'));
      this.applyConfiguration(updated, false);
    });
  }

  convert(): void {
    const saved = this.configuration();
    if (saved) {
      this.run(this.api.convertToQuote(saved.id).pipe(switchMap((response) => this.api.getConfiguration(response.data.id))), (response) => {
        this.message.success(this.i18n.translate('CONFIGURATOR.CONVERTED_TO_QUOTE', { number: response.data.quote_number ?? '' }));
        this.applyConfiguration(response.data, false);
      });
    }
  }

  private setAnswer(selection: ConfiguratorSelection): void {
    this.answers.update((answers) => ({ ...answers, [selection.group]: selection }));
    this.dirty.set(true);
  }

  private payload(): ConfiguratorConfigurationRequest {
    return {
      name: this.configurationName() || null,
      selections: Object.values(this.answers()),
      quantity: this.quantity(),
      discount_percent: this.discountPercent(),
      contact_id: this.contactId(),
      apply_defaults: true,
    };
  }

  /** Creates or updates the configuration when something changed; returns the saved one. */
  private persist(): Observable<ConfiguratorConfiguration> {
    const saved = this.configuration();
    const model = this.model();
    if (saved && !this.dirty()) {
      return of(saved);
    }
    if (saved) {
      return this.api.updateConfiguration(saved.id, this.payload()).pipe(switchMap((response) => of(response.data)));
    }
    if (!model) {
      return EMPTY;
    }
    return this.api.createConfiguration({ ...this.payload(), model_id: model.id }).pipe(switchMap((response) => of(response.data)));
  }

  private run<T>(source: Observable<T>, onSuccess: (value: T) => void): void {
    this.busy.set(true);
    source.subscribe({
      next: (value) => {
        this.busy.set(false);
        onSuccess(value);
      },
      error: (error) => {
        this.busy.set(false);
        this.fail(error);
      },
      complete: () => this.busy.set(false),
    });
  }

  private fail(error: { error?: { message?: string } }): void {
    this.message.error(error?.error?.message ?? this.i18n.translate('CONFIGURATOR.ACTION_ERROR'));
  }
}
