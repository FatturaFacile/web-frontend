import { Component, inject, OnInit, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AgcRule, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AGENT_COMMISSIONS_MODULE, dimensionName, formatRate } from './agent-commissions.util';
import { RuleFormDrawerComponent } from './rule-form-drawer.component';
import { RuleSimulatorComponent } from './rule-simulator.component';
import { RulesStore } from './rules.store';

/**
 * Commission rules (Mod 041): by product line, customer, zone and agent, with a percentage or a fixed amount, progressive
 * tiers, a priority and a validity; plus the simulator of the precedence.
 */
@Component({
  selector: 'app-rules',
  imports: [
    PageHeaderComponent,
    RuleFormDrawerComponent,
    RuleSimulatorComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [RulesStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.AGENT_COMMISSIONS_RULES' | translate"></app-page-header>

    <p class="hint">{{ 'agentCommissions.rules.precedenceHint' | translate }}</p>

    <div class="toolbar">
      <button nz-button type="button" (click)="reload()">
        {{ 'agentCommissions.action.refresh' | translate }}
      </button>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openNew()">
          {{ 'agentCommissions.action.new' | translate }}
        </button>
      }
    </div>

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
      <nz-table #table nzSize="small" [nzData]="store.sortedRules()" [nzPageSize]="20">
        <thead>
          <tr>
            <th scope="col" class="num">{{ 'agentCommissions.field.priority' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.name' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.agent' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.productCategory' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.customer' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.zone' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.rateType' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.field.rate' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.accrualBasis' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.validFrom' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.active' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (rule of table.data; track rule.id) {
            <tr>
              <td class="num">{{ rule.priority }}</td>
              <th scope="row">{{ rule.name }}</th>
              <td>{{ agent(rule) ?? ('agentCommissions.rules.generalRule' | translate) }}</td>
              <td>{{ category(rule) ?? ('agentCommissions.rules.anyValue' | translate) }}</td>
              <td>{{ customer(rule) ?? ('agentCommissions.rules.anyValue' | translate) }}</td>
              <td>{{ zone(rule) ?? ('agentCommissions.rules.anyValue' | translate) }}</td>
              <td>{{ 'agentCommissions.rateType.' + rule.rate_type | translate }}</td>
              <td class="num">
                @if (rule.rate_type === 'fixed') {
                  {{ rule.fixed_amount }}
                } @else if ((rule.tiers ?? []).length > 0) {
                  <nz-tag nzColor="blue"
                    >{{ 'agentCommissions.field.tiers' | translate }} ({{
                      rule.tiers?.length
                    }})</nz-tag
                  >
                } @else {
                  {{ rate(rule.rate) }}
                }
              </td>
              <td>
                @if (rule.accrual_basis) {
                  {{ 'agentCommissions.accrualBasis.' + rule.accrual_basis | translate }}
                } @else {
                  {{ 'agentCommissions.rules.anyValue' | translate }}
                }
              </td>
              <td>
                {{ rule.valid_from }}
                @if (rule.valid_to) {
                  – {{ rule.valid_to }}
                }
              </td>
              <td>
                <nz-tag [nzColor]="rule.is_active ? 'green' : 'default'">{{
                  (rule.is_active ? 'agentCommissions.action.yes' : 'agentCommissions.action.no')
                    | translate
                }}</nz-tag>
              </td>
              <td class="actions">
                @if (canWrite) {
                  <button nz-button nzSize="small" type="button" (click)="openEdit(rule)">
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
                    (nzOnConfirm)="remove(rule)"
                  >
                    {{ 'agentCommissions.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.rules().length === 0) {
        <nz-empty [nzNotFoundContent]="'agentCommissions.rules.empty' | translate"></nz-empty>
      }
    </nz-spin>

    <app-rule-simulator class="simulator"></app-rule-simulator>

    <app-rule-form-drawer
      [visible]="drawerOpen()"
      [rule]="editing()"
      (closed)="closeDrawer()"
      (saved)="closeDrawer()"
    ></app-rule-form-drawer>
  `,
  styles: `
    .hint {
      margin: 0 0 12px;
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 16px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .simulator {
      display: block;
      margin-top: 24px;
    }
  `,
})
export class RulesComponent implements OnInit {
  readonly store = inject(RulesStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly canWrite = inject(PermissionsService).canWrite(AGENT_COMMISSIONS_MODULE);

  readonly drawerOpen = signal(false);
  readonly editing = signal<AgcRule | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly rate = formatRate;

  ngOnInit(): void {
    void this.store.init();
  }

  reload(): void {
    this.actionError.set(null);
    void this.store.load();
  }

  agent(rule: AgcRule): string | null {
    return dimensionName(rule.agent_profile_id, this.store.agentNames());
  }

  category(rule: AgcRule): string | null {
    return dimensionName(rule.product_category_id, this.store.categoryNames());
  }

  customer(rule: AgcRule): string | null {
    return dimensionName(rule.customer_id, this.store.customerNames());
  }

  zone(rule: AgcRule): string | null {
    return rule.zone
      ? `${rule.zone.code} ${rule.zone.name}`
      : dimensionName(rule.zone_id, this.store.zoneNames());
  }

  openNew(): void {
    this.editing.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(rule: AgcRule): void {
    this.editing.set(rule);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async remove(rule: AgcRule): Promise<void> {
    this.actionError.set(null);
    const outcome = await this.store.remove(rule.id);
    if (outcome.ok) {
      this.message.success(this.translate.instant('agentCommissions.message.deleted'));
    } else {
      this.actionError.set(outcome.errorKey);
    }
  }
}
