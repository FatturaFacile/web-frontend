import { Component, inject, OnInit, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AgcAgentProfile, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AgentFormDrawerComponent } from './agent-form-drawer.component';
import { AGENT_COMMISSIONS_MODULE, formatRate, isItalianRegime } from './agent-commissions.util';
import { AgentsStore } from './agents.store';

/**
 * Agents and their contractual conditions (Mod 041): the profile of every sales representative that earns commissions,
 * with a drawer to create the profile of a representative or to change its conditions.
 */
@Component({
  selector: 'app-agents',
  imports: [
    AgentFormDrawerComponent,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [AgentsStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.AGENT_COMMISSIONS_AGENTS' | translate"></app-page-header>

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
      <nz-table #table nzSize="small" [nzData]="store.agents()" [nzPageSize]="20">
        <thead>
          <tr>
            <th scope="col">{{ 'agentCommissions.field.representative' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.agentType' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.fiscalRegime' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.accrualBasis' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.field.defaultRate' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.settlementChannel' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.active' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (agent of table.data; track agent.id) {
            <tr>
              <th scope="row">
                {{ agent.representative?.name }}
                @if (agent.parent_name) {
                  <small class="muted"
                    >{{ 'agentCommissions.field.parentAgent' | translate }}:
                    {{ agent.parent_name }}</small
                  >
                }
              </th>
              <td>{{ 'agentCommissions.agentType.' + agent.agent_type | translate }}</td>
              <td>
                {{ 'agentCommissions.fiscalRegime.' + agent.fiscal_regime | translate }}
                @if (italian(agent) && agent.enasarco_mandate) {
                  <small class="muted">{{
                    'agentCommissions.enasarcoMandate.' + agent.enasarco_mandate | translate
                  }}</small>
                }
              </td>
              <td>{{ 'agentCommissions.accrualBasis.' + agent.accrual_basis | translate }}</td>
              <td class="num">{{ rate(agent.default_rate) }}</td>
              <td>
                {{ 'agentCommissions.settlementChannel.' + agent.settlement_channel | translate }}
              </td>
              <td>
                <nz-tag [nzColor]="agent.is_active ? 'green' : 'default'">{{
                  (agent.is_active ? 'agentCommissions.action.yes' : 'agentCommissions.action.no')
                    | translate
                }}</nz-tag>
              </td>
              <td class="actions">
                @if (canWrite) {
                  <button nz-button nzSize="small" type="button" (click)="openEdit(agent)">
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
                    (nzOnConfirm)="remove(agent)"
                  >
                    {{ 'agentCommissions.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.agents().length === 0) {
        <nz-empty [nzNotFoundContent]="'agentCommissions.agents.empty' | translate"></nz-empty>
      }
    </nz-spin>

    <app-agent-form-drawer
      [visible]="drawerOpen()"
      [agent]="editing()"
      (closed)="closeDrawer()"
      (saved)="closeDrawer()"
    ></app-agent-form-drawer>
  `,
  styles: `
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

    .muted {
      display: block;
      font-weight: normal;
      color: var(--ant-text-color-secondary, #595959);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class AgentsComponent implements OnInit {
  readonly store = inject(AgentsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  /** Conditions are maintained by owners, administrators, accountants and sales managers. */
  readonly canWrite = inject(PermissionsService).canWrite(AGENT_COMMISSIONS_MODULE);

  readonly drawerOpen = signal(false);
  readonly editing = signal<AgcAgentProfile | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly rate = formatRate;

  ngOnInit(): void {
    void this.store.load();
  }

  reload(): void {
    this.actionError.set(null);
    void this.store.load();
  }

  italian(agent: AgcAgentProfile): boolean {
    return isItalianRegime(agent.fiscal_regime);
  }

  openNew(): void {
    this.editing.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(agent: AgcAgentProfile): void {
    this.editing.set(agent);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async remove(agent: AgcAgentProfile): Promise<void> {
    this.actionError.set(null);
    const outcome = await this.store.remove(agent.id);
    if (outcome.ok) {
      this.message.success(this.translate.instant('agentCommissions.message.deleted'));
    } else {
      this.actionError.set(outcome.errorKey);
    }
  }
}
