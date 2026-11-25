import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  BudgetAvailability,
  BudgetCommitment,
  BudgetingApiService,
  BudgetSettings,
  CommitmentStatus,
  PermissionsService,
  SPEND_DOCUMENT_TYPES,
  SPEND_STAGES,
  SpendCheckLog,
  SpendDecision,
  SpendDocumentType,
  SpendStage,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BudgetingDimensionsComponent } from './budgeting-dimensions.component';
import { BudgetingSpendRulesComponent } from './budgeting-spend-rules.component';
import { apiErrorText, blankToNull, OPTIONAL_UUID_PATTERN, SPEND_OUTCOME_COLORS } from './budgeting.util';

/**
 * The spend lock: the available budget of a scope (budget - actual - open commitments) with a what-if check, the spend
 * rules, the open commitments of requisitions and purchase orders, the log of controls that did not pass cleanly and the
 * traffic light thresholds.
 */
@Component({
  selector: 'app-budgeting-spend-control',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    BudgetingDimensionsComponent,
    BudgetingSpendRulesComponent,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'PAGE_TITLE.BUDGETING_SPEND_CONTROL' | translate" [subtitle]="'BUDGETING_CONTROL.SPEND_CONTROL_SUBTITLE' | translate"></app-page-header>

    <nz-tabs>
      <nz-tab [nzTitle]="'BUDGETING_CONTROL.TAB_AVAILABILITY' | translate">
        <nz-card class="main-card" [nzTitle]="'BUDGETING_CONTROL.AVAILABLE_BUDGET' | translate">
          <form nz-form [formGroup]="scopeForm" nzLayout="vertical">
            <div class="form-row">
              <app-budgeting-dimensions [group]="scopeForm" />
              <nz-form-item>
                <nz-form-label nzFor="scope-date">{{ 'BUDGETING_CONTROL.DATE' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="scope-date" type="date" formControlName="date" /></nz-form-control>
              </nz-form-item>
            </div>
            <button nz-button nzType="primary" type="button" (click)="loadAvailability()" [disabled]="scopeForm.invalid">{{ 'BUDGETING_CONTROL.SHOW_AVAILABILITY' | translate }}</button>
          </form>
          @if (availability(); as data) {
            @if (!data.has_budget) {
              <p class="muted">{{ 'BUDGETING_CONTROL.NO_BUDGET_IN_SCOPE' | translate }}</p>
            }
            <div class="stats-grid">
              <nz-card>{{ 'BUDGETING.BUDGET' | translate }}: <strong>{{ data.budget | number: '1.2-2' }} {{ data.currency }}</strong></nz-card>
              <nz-card>{{ 'BUDGETING.ACTUAL' | translate }}: <strong>{{ data.actual | number: '1.2-2' }}</strong></nz-card>
              <nz-card>{{ 'BUDGETING_CONTROL.COMMITTED' | translate }}: <strong>{{ data.committed | number: '1.2-2' }}</strong></nz-card>
              <nz-card>{{ 'BUDGETING_CONTROL.AVAILABLE' | translate }}: <strong [class.row-overdue]="isNegative(data.available)" [class.row-ok]="!isNegative(data.available)">{{ data.available | number: '1.2-2' }}</strong></nz-card>
            </div>
            @if (data.utilization_percent !== null) {
              <nz-progress [nzPercent]="progress(data)" [nzStatus]="progress(data) >= 100 ? 'exception' : 'active'"></nz-progress>
            }
          }
        </nz-card>

        <nz-card class="main-card" [nzTitle]="'BUDGETING_CONTROL.WHAT_IF' | translate">
          <form nz-form [formGroup]="checkForm" nzLayout="vertical">
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'BUDGETING_CONTROL.DOCUMENT_TYPE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="source_type">
                    @for (type of documentTypes; track type) {
                      <nz-option [nzValue]="type" [nzLabel]="('BUDGETING_CONTROL.DOCUMENT_' + type.toUpperCase()) | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'BUDGETING_CONTROL.STAGE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="stage">
                    @for (stage of stages; track stage) {
                      <nz-option [nzValue]="stage" [nzLabel]="('BUDGETING_CONTROL.STAGE_' + stage.toUpperCase()) | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="check-amount">{{ 'BUDGETING.AMOUNT' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="check-amount" type="number" min="0" step="any" formControlName="amount" /></nz-form-control>
              </nz-form-item>
            </div>
            <app-budgeting-dimensions [group]="checkForm" />
            <button nz-button nzType="primary" type="button" (click)="runCheck()" [disabled]="checkForm.invalid">{{ 'BUDGETING_CONTROL.RUN_CHECK' | translate }}</button>
          </form>
          @if (decision(); as result) {
            <p>
              <nz-tag [nzColor]="outcomeColor(result.outcome)">{{ ('BUDGETING_CONTROL.OUTCOME_' + result.outcome.toUpperCase()) | translate }}</nz-tag>
              @if (result.outcome !== 'ok') {
                <span>{{ 'BUDGETING_CONTROL.SHORTFALL' | translate }}: <strong>{{ result.shortfall | number: '1.2-2' }}</strong></span>
              }
              <span class="muted">{{ 'BUDGETING_CONTROL.AVAILABLE' | translate }}: {{ result.availability.available | number: '1.2-2' }}</span>
            </p>
            @if (result.outcome === 'blocked') {
              <a nz-button routerLink="/budgeting/overrides">{{ 'BUDGETING_CONTROL.REQUEST_OVERRIDE' | translate }}</a>
            }
          }
        </nz-card>
      </nz-tab>

      <nz-tab [nzTitle]="'BUDGETING_CONTROL.TAB_RULES' | translate">
        <ng-template nzTabContent><app-budgeting-spend-rules></app-budgeting-spend-rules></ng-template>
      </nz-tab>

      <nz-tab [nzTitle]="'BUDGETING_CONTROL.TAB_COMMITMENTS' | translate" (nzClick)="loadCommitments()">
        <ng-template nzTabContent>
          <div class="toolbar">
            <nz-select style="width: 200px" nzAllowClear [nzPlaceHolder]="'BUDGETING.STATUS' | translate" [ngModel]="commitmentStatus()" (ngModelChange)="commitmentStatus.set($event); loadCommitments()">
              @for (status of commitmentStatuses; track status) {
                <nz-option [nzValue]="status" [nzLabel]="('BUDGETING_CONTROL.COMMITMENT_' + status.toUpperCase()) | translate"></nz-option>
              }
            </nz-select>
          </div>
          <nz-card class="main-card">
            <nz-table #commitmentTable [nzData]="commitments()" nzSize="small" [nzPageSize]="25">
              <thead>
                <tr>
                  <th>{{ 'BUDGETING_CONTROL.DOCUMENT_TYPE' | translate }}</th>
                  <th>{{ 'BUDGETING_CONTROL.NUMBER' | translate }}</th>
                  <th>{{ 'BUDGETING_CONTROL.DATE' | translate }}</th>
                  <th class="num">{{ 'BUDGETING.AMOUNT' | translate }}</th>
                  <th class="num">{{ 'BUDGETING_CONTROL.CONSUMED' | translate }}</th>
                  <th class="num">{{ 'BUDGETING_CONTROL.RELEASED' | translate }}</th>
                  <th class="num">{{ 'BUDGETING_CONTROL.OPEN_AMOUNT' | translate }}</th>
                  <th>{{ 'BUDGETING.STATUS' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of commitmentTable.data; track row.id) {
                  <tr>
                    <td>{{ ('BUDGETING_CONTROL.DOCUMENT_' + row.source_type.toUpperCase()) | translate }}</td>
                    <td>{{ row.source_number }}</td>
                    <td>{{ row.commitment_date }}</td>
                    <td class="num">{{ row.amount | number: '1.2-2' }} {{ row.currency }}</td>
                    <td class="num">{{ row.consumed_amount | number: '1.2-2' }}</td>
                    <td class="num">{{ row.released_amount | number: '1.2-2' }}</td>
                    <td class="num">{{ row.open_amount | number: '1.2-2' }}</td>
                    <td>{{ ('BUDGETING_CONTROL.COMMITMENT_' + row.status.toUpperCase()) | translate }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if (commitments().length === 0) {
              <nz-empty [nzNotFoundContent]="'BUDGETING_CONTROL.NO_COMMITMENTS' | translate"></nz-empty>
            }
          </nz-card>
        </ng-template>
      </nz-tab>

      <nz-tab [nzTitle]="'BUDGETING_CONTROL.TAB_CHECKS' | translate" (nzClick)="loadChecks()">
        <ng-template nzTabContent>
          <nz-card class="main-card">
            <nz-table #checkTable [nzData]="checks()" nzSize="small" [nzPageSize]="25">
              <thead>
                <tr>
                  <th>{{ 'BUDGETING.DATE' | translate }}</th>
                  <th>{{ 'BUDGETING_CONTROL.NUMBER' | translate }}</th>
                  <th>{{ 'BUDGETING_CONTROL.STAGE' | translate }}</th>
                  <th>{{ 'BUDGETING_CONTROL.OUTCOME' | translate }}</th>
                  <th class="num">{{ 'BUDGETING_CONTROL.REQUESTED' | translate }}</th>
                  <th class="num">{{ 'BUDGETING_CONTROL.AVAILABLE' | translate }}</th>
                  <th class="num">{{ 'BUDGETING_CONTROL.PROJECTED_PERCENT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of checkTable.data; track row.id) {
                  <tr>
                    <td>{{ row.created_at }}</td>
                    <td>{{ row.source_number }}</td>
                    <td>{{ ('BUDGETING_CONTROL.STAGE_' + row.stage.toUpperCase()) | translate }}</td>
                    <td><nz-tag [nzColor]="outcomeColor(row.outcome)">{{ ('BUDGETING_CONTROL.OUTCOME_' + row.outcome.toUpperCase()) | translate }}</nz-tag></td>
                    <td class="num">{{ row.requested_amount | number: '1.2-2' }}</td>
                    <td class="num">{{ row.available_amount | number: '1.2-2' }}</td>
                    <td class="num">{{ row.projected_percent !== null ? (row.projected_percent | number: '1.0-1') + '%' : '' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if (checks().length === 0) {
              <nz-empty [nzNotFoundContent]="'BUDGETING_CONTROL.NO_CHECKS' | translate"></nz-empty>
            }
          </nz-card>
        </ng-template>
      </nz-tab>

      <nz-tab [nzTitle]="'BUDGETING_CONTROL.TAB_SETTINGS' | translate" (nzClick)="loadSettings()">
        <ng-template nzTabContent>
          <nz-card class="main-card">
            <form nz-form [formGroup]="settingsForm" nzLayout="vertical">
              <div class="form-row">
                <nz-form-item>
                  <nz-form-label nzFor="set-amber">{{ 'BUDGETING_CONTROL.AMBER_THRESHOLD' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input id="set-amber" type="number" min="0" step="any" formControlName="amber_threshold_percent" /></nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzFor="set-red">{{ 'BUDGETING_CONTROL.RED_THRESHOLD' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input id="set-red" type="number" min="0" step="any" formControlName="red_threshold_percent" /></nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzFor="set-days">{{ 'BUDGETING_CONTROL.OVERRIDE_VALIDITY_DAYS' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input id="set-days" type="number" min="1" max="366" formControlName="override_validity_days" /></nz-form-control>
                </nz-form-item>
              </div>
              @if (canManage) {
                <button nz-button nzType="primary" type="button" (click)="saveSettings()" [disabled]="settingsForm.invalid">{{ 'BUDGETING_CONTROL.SAVE_SETTINGS' | translate }}</button>
              }
            </form>
          </nz-card>
        </ng-template>
      </nz-tab>
    </nz-tabs>
  `,
})
export class BudgetingSpendControlComponent implements OnInit {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly canManage = inject(PermissionsService).canWrite('budgeting_control');
  readonly documentTypes = SPEND_DOCUMENT_TYPES;
  readonly stages = SPEND_STAGES;
  readonly commitmentStatuses: readonly CommitmentStatus[] = ['open', 'closed', 'released'];

  readonly availability = signal<BudgetAvailability | null>(null);
  readonly decision = signal<SpendDecision | null>(null);
  readonly commitments = signal<BudgetCommitment[]>([]);
  readonly commitmentStatus = signal<CommitmentStatus | null>('open');
  readonly checks = signal<SpendCheckLog[]>([]);

  readonly scopeForm = this.fb.group({
    account_id: this.fb.control<string | null>(null),
    cost_center_id: this.fb.control<string | null>(null),
    project_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]],
    date: [''],
  });

  readonly checkForm = this.fb.group({
    source_type: ['purchase_order' as SpendDocumentType, [Validators.required]],
    stage: ['submit' as SpendStage, [Validators.required]],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    account_id: this.fb.control<string | null>(null),
    cost_center_id: this.fb.control<string | null>(null),
    project_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]],
  });

  readonly settingsForm = this.fb.group({
    amber_threshold_percent: [5, [Validators.required, Validators.min(0)]],
    red_threshold_percent: [10, [Validators.required, Validators.min(0)]],
    override_validity_days: [30, [Validators.required, Validators.min(1), Validators.max(366)]],
  });

  ngOnInit(): void {
    this.loadAvailability();
    this.loadSettings();
    this.loadCommitments();
    this.loadChecks();
  }

  outcomeColor(outcome: string): string {
    return SPEND_OUTCOME_COLORS[outcome] ?? 'default';
  }

  isNegative(amount: string): boolean {
    return Number(amount) < 0;
  }

  progress(data: BudgetAvailability): number {
    return Math.min(100, Math.round(Number(data.utilization_percent ?? 0)));
  }

  loadAvailability(): void {
    const value = this.scopeForm.getRawValue();
    this.api.getAvailability({ account_id: value.account_id, cost_center_id: value.cost_center_id, project_id: blankToNull(value.project_id), date: blankToNull(value.date) }).subscribe({
      next: (response) => this.availability.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  runCheck(): void {
    const value = this.checkForm.getRawValue();
    this.api
      .checkSpend({ source_type: value.source_type, stage: value.stage, amount: String(value.amount), account_id: value.account_id, cost_center_id: value.cost_center_id, project_id: blankToNull(value.project_id) })
      .subscribe({
        next: (response) => this.decision.set(response.data),
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
      });
  }

  loadCommitments(): void {
    this.api.getCommitments({ status: this.commitmentStatus() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => this.commitments.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  loadChecks(): void {
    this.api.getSpendChecks({ per_page: 100 }).subscribe({
      next: (response) => this.checks.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  loadSettings(): void {
    this.api.getSettings().subscribe({
      next: (response) => this.fillSettings(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  saveSettings(): void {
    this.api.updateSettings(this.settingsForm.getRawValue() as unknown as Partial<BudgetSettings>).subscribe({
      next: (response) => {
        this.fillSettings(response.data);
        this.message.success(this.translate.instant('BUDGETING_CONTROL.SETTINGS_SAVED'));
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  private fillSettings(settings: BudgetSettings): void {
    this.settingsForm.reset({
      amber_threshold_percent: Number(settings.amber_threshold_percent),
      red_threshold_percent: Number(settings.red_threshold_percent),
      override_validity_days: settings.override_validity_days,
    });
  }
}
