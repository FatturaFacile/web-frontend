import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FRN_STARTUP_MODES,
  FrnFormula,
  FrnFormulaPayload,
  FrnTier,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { FormulasStore } from './formulas.store';
import {
  defaultPeriod,
  FRANCHISE_NETWORK_MANAGE_MODULE,
  FrnOutcome,
  toNumber,
} from './franchise-network.util';

const LOCALES = ['it', 'en', 'de', 'fr'] as const;

/**
 * Royalty and national marketing fund formulas: progressive brackets (aliquote a scaglioni), the monthly minimum guarantee and the
 * start-up exemption (full, reduced rate or ramp-up). The presets are read-only: copy one and tune the copy. The simulator shows
 * what a formula would charge on a hypothetical month.
 */
@Component({
  selector: 'app-frn-formulas',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [FormulasStore],
  styleUrl: './franchise-network.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FRANCHISE_NETWORK_FORMULAS' | translate"></app-page-header>

    <div class="toolbar">
      <span class="spacer"></span>
      @if (canManage) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'franchiseNetwork.action.newFormula' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #table nzSize="small" [nzData]="store.formulas()" [nzShowPagination]="false" [nzScroll]="{ x: '1000px' }">
        <thead>
          <tr>
            <th scope="col">{{ 'franchiseNetwork.field.formula' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.royaltyTiers' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.marketingTiers' | translate }}</th>
            <th scope="col" class="num">{{ 'franchiseNetwork.field.minimumGuarantee' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.startup' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <th scope="row">
                {{ row.label }}
                @if (row.is_preset) {
                  <nz-tag nzColor="blue">{{ 'franchiseNetwork.field.preset' | translate }}</nz-tag>
                }
                <small class="muted">{{ row.description }}</small>
              </th>
              <td>{{ tiersText(row.royalty_tiers) }}</td>
              <td>{{ tiersText(row.marketing_tiers) }}</td>
              <td class="num">{{ row.minimum_guarantee }} {{ row.currency }}</td>
              <td>
                {{ 'franchiseNetwork.startupMode.' + row.startup_mode | translate }}
                @if (row.startup_mode !== 'none') {
                  <small class="muted">{{ row.startup_months }} {{ 'franchiseNetwork.field.months' | translate }}</small>
                }
              </td>
              <td class="row-actions">
                <button nz-button nzSize="small" type="button" (click)="openSimulate(row)">
                  {{ 'franchiseNetwork.action.simulate' | translate }}
                </button>
                @if (canManage) {
                  <button nz-button nzSize="small" type="button" (click)="clone(row)">
                    {{ 'franchiseNetwork.action.duplicate' | translate }}
                  </button>
                  @if (!row.is_preset) {
                    <button nz-button nzSize="small" type="button" (click)="openEdit(row)">
                      {{ 'franchiseNetwork.action.edit' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'franchiseNetwork.confirm.deleteFormula' | translate"
                      (nzOnConfirm)="run(store.remove(row.id))"
                    >
                      {{ 'franchiseNetwork.action.delete' | translate }}
                    </button>
                  }
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6">
                <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.formulas' | translate"></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="simulating() !== null"
      [nzWidth]="560"
      [nzTitle]="'franchiseNetwork.section.simulator' | translate"
      (nzOnClose)="closeSimulate()"
    >
      <ng-container *nzDrawerContent>
        <form [formGroup]="simForm" class="form" (ngSubmit)="runSimulation()">
          <label class="field" for="frn-f-sales">
            <span>{{ 'franchiseNetwork.field.netSales' | translate }}</span>
            <nz-input-number nzId="frn-f-sales" formControlName="net_sales" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-f-opened">
            <span>{{ 'franchiseNetwork.field.openedOn' | translate }}</span>
            <input nz-input id="frn-f-opened" type="date" formControlName="opened_on" />
          </label>
          <label class="field" for="frn-f-period">
            <span>{{ 'franchiseNetwork.field.period' | translate }}</span>
            <input nz-input id="frn-f-period" type="month" formControlName="period" />
          </label>
          <div class="actions">
            <button nz-button nzType="primary" type="submit" [disabled]="simForm.invalid">
              {{ 'franchiseNetwork.action.simulate' | translate }}
            </button>
          </div>
        </form>
        @if (simError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
          ></nz-alert>
        }
        @if (store.simulation(); as sim) {
          <nz-table nzSize="small" [nzData]="[sim]" [nzShowPagination]="false">
            <tbody>
              <tr><th scope="row">{{ 'franchiseNetwork.field.royaltyGross' | translate }}</th><td class="num">{{ sim.royalty_gross }}</td></tr>
              <tr>
                <th scope="row">{{ 'franchiseNetwork.field.startupFactor' | translate }}</th>
                <td class="num">{{ sim.startup_factor }}</td>
              </tr>
              <tr><th scope="row">{{ 'franchiseNetwork.field.royaltyAfterStartup' | translate }}</th><td class="num">{{ sim.royalty_after_startup }}</td></tr>
              <tr><th scope="row">{{ 'franchiseNetwork.field.minimumGuaranteeApplied' | translate }}</th><td class="num">{{ sim.minimum_guarantee_applied }}</td></tr>
              <tr><th scope="row">{{ 'franchiseNetwork.field.minimumAdjustment' | translate }}</th><td class="num">{{ sim.minimum_adjustment }}</td></tr>
              <tr><th scope="row">{{ 'franchiseNetwork.field.royaltyCharged' | translate }}</th><td class="num">{{ sim.royalty_charged }}</td></tr>
              <tr><th scope="row">{{ 'franchiseNetwork.field.marketingFund' | translate }}</th><td class="num">{{ sim.marketing_fund }}</td></tr>
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="680"
      [nzTitle]="'franchiseNetwork.section.formula' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
            [nzDescription]="failure.detail ?? undefined"
          ></nz-alert>
        }
        <form [formGroup]="form" class="form" (ngSubmit)="submit()">
          <label class="field" for="frn-f-code">
            <span>{{ 'franchiseNetwork.field.code' | translate }}</span>
            <input nz-input id="frn-f-code" formControlName="code" maxlength="40" />
          </label>
          @for (locale of locales; track locale) {
            <label class="field" [for]="'frn-f-label-' + locale">
              <span>{{ 'franchiseNetwork.field.label' | translate }} ({{ locale }})</span>
              <input nz-input [id]="'frn-f-label-' + locale" [formControlName]="'label_' + locale" maxlength="160" />
            </label>
          }

          <h4>{{ 'franchiseNetwork.field.royaltyTiers' | translate }}</h4>
          <div formArrayName="royalty_tiers">
            @for (tier of royaltyTiers.controls; track $index; let i = $index) {
              <div class="tiers" [formGroupName]="i">
                <nz-input-number formControlName="from" [nzMin]="0" [attr.aria-label]="'franchiseNetwork.field.tierFrom' | translate"></nz-input-number>
                <nz-input-number formControlName="to" [nzMin]="0" [attr.aria-label]="'franchiseNetwork.field.tierTo' | translate"></nz-input-number>
                <nz-input-number formControlName="rate" [nzMin]="0" [nzMax]="100" [nzStep]="0.1" [attr.aria-label]="'franchiseNetwork.field.tierRate' | translate"></nz-input-number>
                <button nz-button nzSize="small" nzDanger type="button" (click)="removeTier(royaltyTiers, i)">
                  {{ 'franchiseNetwork.action.remove' | translate }}
                </button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addTier(royaltyTiers)">{{ 'franchiseNetwork.action.addTier' | translate }}</button>

          <h4>{{ 'franchiseNetwork.field.marketingTiers' | translate }}</h4>
          <div formArrayName="marketing_tiers">
            @for (tier of marketingTiers.controls; track $index; let i = $index) {
              <div class="tiers" [formGroupName]="i">
                <nz-input-number formControlName="from" [nzMin]="0" [attr.aria-label]="'franchiseNetwork.field.tierFrom' | translate"></nz-input-number>
                <nz-input-number formControlName="to" [nzMin]="0" [attr.aria-label]="'franchiseNetwork.field.tierTo' | translate"></nz-input-number>
                <nz-input-number formControlName="rate" [nzMin]="0" [nzMax]="100" [nzStep]="0.1" [attr.aria-label]="'franchiseNetwork.field.tierRate' | translate"></nz-input-number>
                <button nz-button nzSize="small" nzDanger type="button" (click)="removeTier(marketingTiers, i)">
                  {{ 'franchiseNetwork.action.remove' | translate }}
                </button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addTier(marketingTiers)">{{ 'franchiseNetwork.action.addTier' | translate }}</button>

          <label class="field" for="frn-f-min">
            <span>{{ 'franchiseNetwork.field.minimumGuarantee' | translate }}</span>
            <nz-input-number nzId="frn-f-min" formControlName="minimum_guarantee" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-f-mode">
            <span>{{ 'franchiseNetwork.field.startup' | translate }}</span>
            <nz-select nzId="frn-f-mode" formControlName="startup_mode">
              @for (mode of modes; track mode) {
                <nz-option [nzValue]="mode" [nzLabel]="'franchiseNetwork.startupMode.' + mode | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-f-months">
            <span>{{ 'franchiseNetwork.field.startupMonths' | translate }}</span>
            <nz-input-number nzId="frn-f-months" formControlName="startup_months" [nzMin]="0" [nzMax]="36"></nz-input-number>
          </label>
          <label class="field" for="frn-f-reduction">
            <span>{{ 'franchiseNetwork.field.startupReductionPercent' | translate }}</span>
            <nz-input-number nzId="frn-f-reduction" formControlName="startup_reduction_percent" [nzMin]="0" [nzMax]="100"></nz-input-number>
          </label>
          <label class="field" for="frn-f-ramp">
            <span>{{ 'franchiseNetwork.field.rampStartPercent' | translate }}</span>
            <nz-input-number nzId="frn-f-ramp" formControlName="ramp_start_percent" [nzMin]="0" [nzMax]="100"></nz-input-number>
          </label>
          <label nz-checkbox for="frn-f-appl" nzId="frn-f-appl" formControlName="startup_applies_to_marketing">{{
            'franchiseNetwork.field.startupAppliesToMarketing' | translate
          }}</label>
          <label class="field" for="frn-f-currency">
            <span>{{ 'franchiseNetwork.field.currency' | translate }}</span>
            <nz-select nzId="frn-f-currency" formControlName="currency">
              <nz-option nzValue="EUR" nzLabel="EUR"></nz-option>
              <nz-option nzValue="CHF" nzLabel="CHF"></nz-option>
            </nz-select>
          </label>
          <div class="actions">
            <button nz-button nzType="primary" type="submit" [nzLoading]="store.saving()" [disabled]="form.invalid">
              {{ 'franchiseNetwork.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="close()">
              {{ 'franchiseNetwork.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class FormulasComponent implements OnInit {
  protected readonly store = inject(FormulasStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canManage = inject(PermissionsService).canWrite(FRANCHISE_NETWORK_MANAGE_MODULE);
  protected readonly modes = FRN_STARTUP_MODES;
  protected readonly locales = LOCALES;

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<FrnFormula | null>(null);
  protected readonly simulating = signal<FrnFormula | null>(null);
  protected readonly feedback = signal<FrnOutcome | null>(null);
  protected readonly formError = signal<FrnOutcome | null>(null);
  protected readonly simError = signal<FrnOutcome | null>(null);

  protected readonly royaltyTiers = new FormArray([this.tierGroup(0, null, 0)]);
  protected readonly marketingTiers = new FormArray([this.tierGroup(0, null, 0)]);

  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    label_it: ['', Validators.required],
    label_en: ['', Validators.required],
    label_de: ['', Validators.required],
    label_fr: ['', Validators.required],
    royalty_tiers: this.royaltyTiers,
    marketing_tiers: this.marketingTiers,
    minimum_guarantee: [0],
    startup_mode: ['none' as FrnFormulaPayload['startup_mode']],
    startup_months: [0],
    startup_reduction_percent: [0],
    ramp_start_percent: [0],
    startup_applies_to_marketing: [false],
    currency: ['EUR'],
  });

  protected readonly simForm = this.fb.group({
    net_sales: [0, Validators.required],
    opened_on: [''],
    period: [defaultPeriod(), Validators.required],
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected tiersText(tiers: FrnTier[]): string {
    return tiers
      .map((tier) => `${tier.from}${tier.to === null ? '+' : '–' + tier.to}: ${tier.rate}%`)
      .join(' · ');
  }

  private tierGroup(from: number, to: number | null, rate: number) {
    return this.fb.group({ from: [from], to: [to as number | null], rate: [rate] });
  }

  protected addTier(array: FormArray): void {
    const last = array.length > 0 ? array.at(array.length - 1).getRawValue() : null;
    if (last !== null && last.to === null) {
      array.at(array.length - 1).patchValue({ to: toNumber(last.from) + 50000 });
    }
    array.push(this.tierGroup(last === null ? 0 : toNumber(last.to ?? toNumber(last.from) + 50000), null, 0));
  }

  protected removeTier(array: FormArray, index: number): void {
    if (array.length > 1) {
      array.removeAt(index);
      array.at(array.length - 1).patchValue({ to: null });
    }
  }

  private fillTiers(array: FormArray, tiers: FrnTier[]): void {
    array.clear();
    for (const tier of tiers) {
      array.push(this.tierGroup(toNumber(tier.from), tier.to === null ? null : toNumber(tier.to), toNumber(tier.rate)));
    }
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ startup_mode: 'none', currency: 'EUR' });
    this.fillTiers(this.royaltyTiers, [{ from: 0, to: null, rate: 0 }]);
    this.fillTiers(this.marketingTiers, [{ from: 0, to: null, rate: 0 }]);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected openEdit(row: FrnFormula): void {
    this.editing.set(row);
    this.form.reset({
      code: row.code,
      label_it: row.labels['it'] ?? '',
      label_en: row.labels['en'] ?? '',
      label_de: row.labels['de'] ?? '',
      label_fr: row.labels['fr'] ?? '',
      minimum_guarantee: toNumber(row.minimum_guarantee),
      startup_mode: row.startup_mode,
      startup_months: row.startup_months,
      startup_reduction_percent: toNumber(row.startup_reduction_percent),
      ramp_start_percent: toNumber(row.ramp_start_percent),
      startup_applies_to_marketing: row.startup_applies_to_marketing,
      currency: row.currency,
    });
    this.fillTiers(this.royaltyTiers, row.royalty_tiers);
    this.fillTiers(this.marketingTiers, row.marketing_tiers);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected close(): void {
    this.drawerOpen.set(false);
  }

  protected openSimulate(row: FrnFormula): void {
    this.simulating.set(row);
    this.store.clearSimulation();
    this.simError.set(null);
  }

  protected closeSimulate(): void {
    this.simulating.set(null);
  }

  protected async runSimulation(): Promise<void> {
    const formula = this.simulating();
    if (formula === null) {
      return;
    }
    const value = this.simForm.getRawValue();
    const outcome = await this.store.simulate(formula.id, {
      net_sales: value.net_sales,
      opened_on: value.opened_on || null,
      period: value.period,
    });
    this.simError.set(outcome.ok ? null : outcome);
  }

  protected async run(call: Promise<FrnOutcome>): Promise<void> {
    const outcome = await call;
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async clone(row: FrnFormula): Promise<void> {
    await this.run(this.store.clone(row.id, `${row.code}-COPY`.slice(0, 40)));
  }

  protected async submit(): Promise<void> {
    const value = this.form.getRawValue();
    const tiers = (items: typeof value.royalty_tiers): FrnTier[] =>
      items.map((tier) => ({ from: tier.from, to: tier.to, rate: tier.rate }));
    const payload: FrnFormulaPayload = {
      code: value.code,
      labels: { it: value.label_it, en: value.label_en, de: value.label_de, fr: value.label_fr },
      royalty_tiers: tiers(value.royalty_tiers),
      marketing_tiers: tiers(value.marketing_tiers),
      minimum_guarantee: value.minimum_guarantee,
      startup_months: value.startup_months,
      startup_mode: value.startup_mode,
      startup_reduction_percent: value.startup_reduction_percent,
      ramp_start_percent: value.ramp_start_percent,
      startup_applies_to_marketing: value.startup_applies_to_marketing,
      currency: value.currency,
    };
    const outcome = await this.store.save(payload, this.editing()?.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('franchiseNetwork.notification.saved'));
      this.close();
    } else {
      this.formError.set(outcome);
    }
  }
}
