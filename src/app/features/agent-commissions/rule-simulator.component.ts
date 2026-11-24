import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AgcResolveParams } from '@core';
import { TranslatePipe } from '@shared';
import { formatRate, todayParam } from './agent-commissions.util';
import { NamedOption, RulesStore } from './rules.store';

/** The request of the simulator, or null while no agent is picked. */
export function resolveParamsOf(input: {
  agentId: string | null;
  customerId: string | null;
  categoryId: string | null;
  date: string;
}): AgcResolveParams | null {
  if (input.agentId === null) {
    return null;
  }
  return {
    agent_profile_id: input.agentId,
    ...(input.customerId ? { customer_id: input.customerId } : {}),
    ...(input.categoryId ? { product_category_id: input.categoryId } : {}),
    ...(input.date ? { date: input.date } : {}),
  };
}

/**
 * Precedence simulator: asks the API which commission rule would win for an agent, a customer and a product line on a
 * date, so the effect of the priorities can be checked before an invoice is accrued.
 */
@Component({
  selector: 'app-rule-simulator',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
  ],
  template: `
    <nz-card [nzTitle]="'agentCommissions.rules.simulatorTitle' | translate">
      <div class="editor">
        <label class="field" for="agc-sim-agent">
          <span>{{ 'agentCommissions.field.agent' | translate }}</span>
          <nz-select
            nzId="agc-sim-agent"
            [ngModel]="agentId()"
            (ngModelChange)="agentId.set($event ?? null)"
          >
            @for (option of store.agentOptions(); track option.id) {
              <nz-option [nzValue]="option.id" [nzLabel]="option.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="agc-sim-customer">
          <span>{{ 'agentCommissions.field.customer' | translate }}</span>
          <nz-select
            nzId="agc-sim-customer"
            nzAllowClear
            nzShowSearch
            nzServerSearch
            [nzPlaceHolder]="'agentCommissions.rules.anyValue' | translate"
            [ngModel]="customerId()"
            (ngModelChange)="customerId.set($event ?? null)"
            (nzOnSearch)="store.searchCustomers($event)"
          >
            @for (option of customerChoices(); track option.id) {
              <nz-option [nzValue]="option.id" [nzLabel]="option.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="agc-sim-category">
          <span>{{ 'agentCommissions.field.productCategory' | translate }}</span>
          <nz-select
            nzId="agc-sim-category"
            nzAllowClear
            nzShowSearch
            [nzPlaceHolder]="'agentCommissions.rules.anyValue' | translate"
            [ngModel]="categoryId()"
            (ngModelChange)="categoryId.set($event ?? null)"
          >
            @for (category of store.categories(); track category.id) {
              <nz-option [nzValue]="category.id" [nzLabel]="category.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="agc-sim-date">
          <span>{{ 'agentCommissions.field.date' | translate }}</span>
          <input
            nz-input
            id="agc-sim-date"
            type="date"
            [ngModel]="date()"
            (ngModelChange)="date.set($event)"
          />
        </label>
        <button
          nz-button
          nzType="primary"
          type="button"
          [nzLoading]="store.resolving()"
          [disabled]="params() === null"
          (click)="simulate()"
        >
          {{ 'agentCommissions.action.simulate' | translate }}
        </button>
      </div>

      @if (store.resolveError(); as error) {
        <nz-alert
          class="result"
          nzType="error"
          nzShowIcon
          [nzMessage]="error | translate"
        ></nz-alert>
      }

      @if (store.resolved(); as result) {
        <div class="result" role="status">
          @if (result.rule; as rule) {
            <strong>{{ 'agentCommissions.rules.simulatorWinner' | translate }}:</strong>
            {{ rule.name }}
            <nz-tag>{{ 'agentCommissions.field.priority' | translate }} {{ rule.priority }}</nz-tag>
            @if (rule.rate_type === 'fixed') {
              <nz-tag nzColor="blue">{{ rule.fixed_amount }}</nz-tag>
            } @else if ((rule.tiers ?? []).length > 0) {
              @for (tier of rule.tiers; track $index) {
                <nz-tag nzColor="blue"
                  >{{ tier.threshold_from }} – {{ tier.threshold_to ?? '∞' }}:
                  {{ rate(tier.rate) }}</nz-tag
                >
              }
            } @else {
              <nz-tag nzColor="blue">{{ rate(rule.rate) }}</nz-tag>
            }
          } @else {
            <strong>{{ 'agentCommissions.rules.simulatorFallback' | translate }}:</strong>
            {{ rate(result.fallback_rate) }}
          }
        </div>
      }
    </nz-card>
  `,
  styles: `
    .editor {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 200px;
      font-size: 12px;
    }

    .result {
      margin-top: 16px;
    }
  `,
})
export class RuleSimulatorComponent {
  readonly store = inject(RulesStore);

  readonly agentId = signal<string | null>(null);
  readonly customerId = signal<string | null>(null);
  readonly categoryId = signal<string | null>(null);
  readonly date = signal(todayParam());

  readonly rate = formatRate;

  readonly params = computed(() =>
    resolveParamsOf({
      agentId: this.agentId(),
      customerId: this.customerId(),
      categoryId: this.categoryId(),
      date: this.date(),
    }),
  );

  readonly customerChoices = computed<NamedOption[]>(() => {
    const options = [...this.store.customerOptions()];
    const picked = this.customerId();
    if (picked && !options.some((option) => option.id === picked)) {
      options.unshift({ id: picked, name: this.store.customerNames().get(picked) ?? picked });
    }
    return options;
  });

  async simulate(): Promise<void> {
    const params = this.params();
    if (params !== null) {
      await this.store.resolve(params);
    }
  }
}
