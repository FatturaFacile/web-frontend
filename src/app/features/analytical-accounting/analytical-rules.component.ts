import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AnalyticalAccountingApiService,
  COST_ELEMENT_TYPES,
  DerivationRule,
  DerivationRulePayload,
  DerivationTestResult,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AnalyticalAccountingStore } from './analytical-accounting.store';
import { problemDetail } from './analytical-accounting.util';

type RuleForm = Omit<DerivationRule, 'id'> & { id: string | null };

const emptyRule = (): RuleForm => ({
  id: null,
  name: '',
  priority: 100,
  is_active: true,
  valid_from: null,
  valid_to: null,
  accounting_cause_id: null,
  journal_type: null,
  product_id: null,
  product_category_id: null,
  account_id: null,
  counterparty_type: null,
  counterparty_id: null,
  cost_center_id: null,
  profit_center_id: null,
  project_id: null,
  product_line_id: null,
  cost_element_type: null,
});

const CRITERIA = ['accounting_cause_id', 'journal_type', 'product_id', 'product_category_id', 'account_id', 'counterparty_type', 'counterparty_id'] as const;

/** Derivation rules: prioritized table, rule form and a "what would the rules derive" test panel. */
@Component({
  selector: 'app-analytical-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './analytical-accounting.scss',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'ANALYTICAL.RULES_TITLE' | translate"
      [subtitle]="'ANALYTICAL.RULES_SUBTITLE' | translate"
    >
      <button nz-button nzType="primary" header-actions (click)="openNew()">
        {{ 'ANALYTICAL.NEW_RULE' | translate }}
      </button>
    </app-page-header>

    <nz-table [nzData]="store.sortedRules()" [nzLoading]="store.loading()" nzSize="small" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'ANALYTICAL.PRIORITY' | translate }}</th>
          <th>{{ 'ANALYTICAL.NAME' | translate }}</th>
          <th>{{ 'ANALYTICAL.MATCHES' | translate }}</th>
          <th>{{ 'ANALYTICAL.DERIVES' | translate }}</th>
          <th>{{ 'ANALYTICAL.STATUS' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (rule of store.sortedRules(); track rule.id) {
          <tr>
            <td class="num">{{ rule.priority }}</td>
            <td>{{ rule.name }}</td>
            <td>{{ criteriaOf(rule) }}</td>
            <td>{{ targetsOf(rule) }}</td>
            <td>
              <nz-tag [nzColor]="rule.is_active ? 'green' : 'default'">
                {{ (rule.is_active ? 'ANALYTICAL.ACTIVE' : 'ANALYTICAL.INACTIVE') | translate }}
              </nz-tag>
            </td>
            <td class="actions">
              <button nz-button nzSize="small" (click)="openEdit(rule)">{{ 'ANALYTICAL.EDIT' | translate }}</button>
              <button
                nz-button
                nzSize="small"
                nzDanger
                nz-popconfirm
                [nzPopconfirmTitle]="'ANALYTICAL.CONFIRM_DELETE' | translate"
                (nzOnConfirm)="remove(rule.id)"
              >
                {{ 'ANALYTICAL.DELETE' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-card [nzTitle]="'ANALYTICAL.TEST_RULES' | translate">
      <div class="toolbar">
        <input nz-input style="width: 260px" [placeholder]="'ANALYTICAL.ACCOUNT_ID' | translate" [ngModel]="testAccount()" (ngModelChange)="testAccount.set($event)" />
        <input nz-input style="width: 200px" [placeholder]="'ANALYTICAL.JOURNAL_TYPE' | translate" [ngModel]="testJournal()" (ngModelChange)="testJournal.set($event)" />
        <button nz-button (click)="runTest()">{{ 'ANALYTICAL.RUN_TEST' | translate }}</button>
      </div>
      @if (testResult(); as result) {
        <p>
          <nz-tag>{{ 'ANALYTICAL.SOURCE_' + result.source | translate }}</nz-tag>
          {{ describe(result) }}
        </p>
      }
    </nz-card>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="(form().id ? 'ANALYTICAL.EDIT_RULE' : 'ANALYTICAL.NEW_RULE') | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="!form().name"
      (nzOnOk)="save()"
      (nzOnCancel)="modalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <div class="form-grid">
          <label>{{ 'ANALYTICAL.NAME' | translate }}
            <input nz-input [ngModel]="form().name" (ngModelChange)="patch({ name: $event })" />
          </label>
          <label>{{ 'ANALYTICAL.PRIORITY' | translate }}
            <input nz-input type="number" [ngModel]="form().priority" (ngModelChange)="patch({ priority: +$event })" />
          </label>
          <label>{{ 'ANALYTICAL.ACCOUNT_ID' | translate }}
            <input nz-input [ngModel]="form().account_id" (ngModelChange)="patch({ account_id: $event || null })" />
          </label>
          <label>{{ 'ANALYTICAL.ACCOUNTING_CAUSE_ID' | translate }}
            <input nz-input [ngModel]="form().accounting_cause_id" (ngModelChange)="patch({ accounting_cause_id: $event || null })" />
          </label>
          <label>{{ 'ANALYTICAL.PRODUCT_ID' | translate }}
            <input nz-input [ngModel]="form().product_id" (ngModelChange)="patch({ product_id: $event || null })" />
          </label>
          <label>{{ 'ANALYTICAL.JOURNAL_TYPE' | translate }}
            <input nz-input [ngModel]="form().journal_type" (ngModelChange)="patch({ journal_type: $event || null })" />
          </label>
          <label for="analytical-rules-ctl-1">{{ 'ANALYTICAL.COST_CENTER' | translate }}
            <nz-select nzId="analytical-rules-ctl-1" nzAllowClear [ngModel]="form().cost_center_id" (ngModelChange)="patch({ cost_center_id: $event ?? null })">
              @for (center of costCenters(); track center.id) {
                <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name"></nz-option>
              }
            </nz-select>
          </label>
          <label for="analytical-rules-ctl-2">{{ 'ANALYTICAL.PROFIT_CENTER' | translate }}
            <nz-select nzId="analytical-rules-ctl-2" nzAllowClear [ngModel]="form().profit_center_id" (ngModelChange)="patch({ profit_center_id: $event ?? null })">
              @for (center of profitCenters(); track center.id) {
                <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name"></nz-option>
              }
            </nz-select>
          </label>
          <label for="analytical-rules-ctl-3">{{ 'ANALYTICAL.COST_ELEMENT' | translate }}
            <nz-select nzId="analytical-rules-ctl-3" nzAllowClear [ngModel]="form().cost_element_type" (ngModelChange)="patch({ cost_element_type: $event ?? null })">
              @for (element of elements; track element) {
                <nz-option [nzValue]="element" [nzLabel]="'ANALYTICAL.ELEMENT_' + element | translate"></nz-option>
              }
            </nz-select>
          </label>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class AnalyticalRulesComponent implements OnInit {
  protected readonly store = inject(AnalyticalAccountingStore);
  private readonly api = inject(AnalyticalAccountingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly elements = COST_ELEMENT_TYPES;
  protected readonly modalOpen = signal(false);
  protected readonly form = signal<RuleForm>(emptyRule());
  protected readonly testAccount = signal('');
  protected readonly testJournal = signal('');
  protected readonly testResult = signal<DerivationTestResult | null>(null);

  protected readonly costCenters = computed(() => this.store.activeCenters().filter((c) => c.center_type === 'COST_CENTER'));
  protected readonly profitCenters = computed(() => this.store.activeCenters().filter((c) => c.center_type === 'PROFIT_CENTER'));

  ngOnInit(): void {
    void this.store.loadRules();
    void this.store.loadCenters();
  }

  protected criteriaOf(rule: DerivationRule): string {
    return CRITERIA.filter((key) => rule[key]).map((key) => `${key}=${rule[key]}`).join(', ') || '—';
  }

  protected targetsOf(rule: DerivationRule): string {
    return (['cost_center_id', 'profit_center_id', 'project_id', 'product_line_id', 'cost_element_type'] as const)
      .filter((key) => rule[key])
      .map((key) => this.label(rule[key] as string))
      .join(', ') || '—';
  }

  protected describe(result: DerivationTestResult): string {
    return Object.entries(result.dimensions)
      .filter(([, value]) => value)
      .map(([key, value]) => `${this.label(String(value))} (${result.provenance[key as keyof typeof result.provenance] ?? '—'})`)
      .join(', ') || this.translate.instant('ANALYTICAL.NOTHING_DERIVED');
  }

  protected openNew(): void {
    this.form.set(emptyRule());
    this.modalOpen.set(true);
  }

  protected openEdit(rule: DerivationRule): void {
    this.form.set({ ...rule });
    this.modalOpen.set(true);
  }

  protected patch(change: Partial<RuleForm>): void {
    this.form.update((current) => ({ ...current, ...change }));
  }

  protected async save(): Promise<void> {
    const { id, ...rest } = this.form();
    const outcome = await this.store.saveRule(id, rest as DerivationRulePayload);
    if (outcome.ok) {
      this.modalOpen.set(false);
      this.message.success(this.translate.instant('ANALYTICAL.SAVED'));
    } else {
      this.message.error(this.translate.instant(outcome.message ?? 'ANALYTICAL.SAVE_ERROR'));
    }
  }

  protected async remove(id: string): Promise<void> {
    const outcome = await this.store.deleteRule(id);
    if (!outcome.ok) {
      this.message.error(this.translate.instant(outcome.message ?? 'ANALYTICAL.SAVE_ERROR'));
    }
  }

  protected runTest(): void {
    this.api
      .testRules({
        ...(this.testAccount() ? { account_id: this.testAccount() } : {}),
        ...(this.testJournal() ? { journal_type: this.testJournal() } : {}),
      })
      .subscribe({
        next: (response) => this.testResult.set(response.data),
        error: (error: unknown) => this.message.error(problemDetail(error) ?? this.translate.instant('ANALYTICAL.SAVE_ERROR')),
      });
  }

  private label(value: string): string {
    const center = this.store.centers().find((c) => c.id === value);
    return center ? `${center.code}` : value;
  }
}
