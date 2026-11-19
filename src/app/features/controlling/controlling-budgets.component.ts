import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BudgetPlan, ControllingBudgetLine, ControllingApiService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { ControllingFilters } from './controlling-filters.service';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const monthKey = (month: number): `month_${string}` => `month_${String(month).padStart(2, '0')}`;

function errorText(error: unknown): string | null {
  const body = (error as { error?: { message?: unknown; errors?: Record<string, unknown> } })?.error;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  return typeof body?.message === 'string' ? body.message : null;
}

/** Tab 5 — plan manager (create, clone, seed from prior year, rolling forecast, workflow) and the editable 12-month spread matrix. */
@Component({
  selector: 'app-controlling-budgets',
  styleUrl: './controlling.scss',
  imports: [DecimalPipe, FormsModule, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzInputModule, NzPopconfirmModule, NzTableModule, NzTagModule],
  template: `
    <nz-card [nzTitle]="'CONTROLLING.PLAN_MANAGER' | translate" class="main-card">
      <div class="toolbar">
        <input nz-input style="width: 140px" [(ngModel)]="code" [placeholder]="'CONTROLLING.CODE' | translate" [attr.aria-label]="'CONTROLLING.CODE' | translate" />
        <input nz-input style="width: 220px" [(ngModel)]="name" [placeholder]="'CONTROLLING.NAME' | translate" [attr.aria-label]="'CONTROLLING.NAME' | translate" />
        <input nz-input style="width: 100px" type="number" [(ngModel)]="uplift" [attr.aria-label]="'CONTROLLING.UPLIFT' | translate" />
        <button nz-button nzType="primary" [disabled]="!code || !name" (click)="create()">{{ 'CONTROLLING.CREATE_BUDGET' | translate }}</button>
        <button nz-button [disabled]="!code || !name" (click)="seed()">{{ 'CONTROLLING.SEED_PRIOR_YEAR' | translate }}</button>
      </div>
      <nz-table [nzData]="plans()" nzSize="small" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'CONTROLLING.CODE' | translate }}</th>
            <th>{{ 'CONTROLLING.NAME' | translate }}</th>
            <th>{{ 'CONTROLLING.TYPE' | translate }}</th>
            <th>{{ 'CONTROLLING.STATUS' | translate }}</th>
            <th class="num">{{ 'CONTROLLING.LINES' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (plan of plans(); track plan.id) {
            <tr>
              <td><a (click)="open(plan.id)" (keydown.enter)="open(plan.id)" tabindex="0">{{ plan.code }} v{{ plan.version_number }}</a></td>
              <td>{{ plan.name }}</td>
              <td>{{ plan.plan_type }}</td>
              <td><nz-tag [nzColor]="plan.status === 'locked' ? 'purple' : plan.status === 'approved' ? 'green' : 'default'">{{ plan.status }}</nz-tag></td>
              <td class="num">{{ plan.lines_count }}</td>
              <td>
                @if (plan.status === 'draft') { <button nz-button (click)="transition(plan, 'submit')">{{ 'CONTROLLING.SUBMIT' | translate }}</button> }
                @if (plan.status === 'submitted') { <button nz-button (click)="transition(plan, 'approve')">{{ 'CONTROLLING.APPROVE' | translate }}</button> }
                @if (plan.status === 'approved') { <button nz-button (click)="transition(plan, 'lock')">{{ 'CONTROLLING.LOCK' | translate }}</button> }
                <button nz-button (click)="clone(plan)" [disabled]="!code || !name">{{ 'CONTROLLING.CLONE' | translate }}</button>
                @if (plan.plan_type === 'annual_budget') {
                  <button nz-button nz-popconfirm [nzPopconfirmTitle]="'CONTROLLING.CONFIRM_ROLLING' | translate" (nzOnConfirm)="rolling(plan)">{{ 'CONTROLLING.ROLLING_FORECAST' | translate }}</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    @if (plan(); as p) {
      <nz-card [nzTitle]="p.code + ' — ' + p.name" class="main-card">
        <div class="toolbar">
          <button nz-button (click)="distributeEqually()" [disabled]="!editable()">{{ 'CONTROLLING.DISTRIBUTE_EQUALLY' | translate }}</button>
          <button nz-button (click)="applySeasonality()" [disabled]="!editable()">{{ 'CONTROLLING.APPLY_SEASONALITY' | translate }}</button>
          <input nz-input style="width: 90px" type="number" [(ngModel)]="adjustPercent" [attr.aria-label]="'CONTROLLING.ADJUST_PERCENT' | translate" />
          <button nz-button (click)="adjust()" [disabled]="!editable()">+ % {{ 'CONTROLLING.ADJUSTMENT' | translate }}</button>
          <button nz-button nzType="primary" (click)="save()" [disabled]="!editable() || !dirty().size">{{ 'CONTROLLING.SAVE_GRID' | translate }}</button>
          @if (p.plan_type === 'rolling_forecast') {
            <nz-tag nzColor="gold">{{ 'CONTROLLING.ACTUAL_MONTHS_LOCKED' | translate }}: 1–{{ p.cutoff_month }}</nz-tag>
          }
        </div>
        @if (lines().length) {
          <div style="overflow-x: auto">
            <table class="heat">
              <thead>
                <tr>
                  <th>{{ 'CONTROLLING.LINE' | translate }}</th>
                  @for (m of months; track m) {
                    <th class="num">{{ m }}</th>
                  }
                  <th class="num">{{ 'CONTROLLING.ANNUAL_TOTAL' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of lines(); track line.id) {
                  <tr>
                    <th>{{ line.nature_type }}</th>
                    @for (m of months; track m) {
                      <td [class.locked-month]="isLocked(m)">
                        <input nz-input class="grid-input" type="number" step="0.01" [disabled]="!editable() || isLocked(m)" [ngModel]="cellValue(line, m)" (ngModelChange)="edit(line, m, $event)" [attr.aria-label]="line.nature_type + ' ' + m" />
                      </td>
                    }
                    <td class="num">{{ total(line) | number: '1.0-0' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <nz-empty [nzNotFoundContent]="'CONTROLLING.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class ControllingBudgetsComponent implements OnInit {
  private readonly api = inject(ControllingApiService);
  private readonly filters = inject(ControllingFilters);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly months = MONTHS;
  protected readonly plans = signal<BudgetPlan[]>([]);
  protected readonly plan = signal<BudgetPlan | null>(null);
  protected readonly lines = computed(() => this.plan()?.lines ?? []);
  protected readonly dirty = signal<Map<string, Record<string, string>>>(new Map());
  protected readonly editable = computed(() => this.plan()?.status === 'draft');

  protected code = '';
  protected name = '';
  protected uplift = 0;
  protected adjustPercent = 5;

  ngOnInit(): void {
    this.loadPlans();
  }

  protected isLocked(month: number): boolean {
    const p = this.plan();
    return p?.plan_type === 'rolling_forecast' && p.cutoff_month !== null && month <= p.cutoff_month;
  }

  protected cellValue(line: ControllingBudgetLine, month: number): number {
    return Number(this.dirty().get(line.id)?.[monthKey(month)] ?? line[monthKey(month)]);
  }

  protected total(line: ControllingBudgetLine): number {
    return MONTHS.reduce((sum, month) => sum + this.cellValue(line, month), 0);
  }

  protected edit(line: ControllingBudgetLine, month: number, value: number | string): void {
    this.setCell(line, month, String(value ?? 0));
  }

  protected distributeEqually(): void {
    this.lines().forEach((line) => {
      const open = MONTHS.filter((month) => !this.isLocked(month));
      const locked = MONTHS.filter((month) => this.isLocked(month)).reduce((sum, month) => sum + this.cellValue(line, month), 0);
      const share = (this.total(line) - locked) / open.length;
      open.forEach((month) => this.setCell(line, month, share.toFixed(4)));
    });
  }

  protected applySeasonality(): void {
    const p = this.plan();
    if (!p) return;
    const payload = this.lines().map((line) => ({ id: line.id, annual_total: this.total(line).toFixed(4) as unknown as string, distribution_driver: 'prior_year_seasonality' }));
    this.api.saveBudgetLines(p.id, payload as unknown as Partial<ControllingBudgetLine>[]).subscribe({
      next: (response) => this.afterSave(response.data),
      error: (error) => this.message.error(errorText(error) ?? this.translate.instant('CONTROLLING.ACTION_FAILED')),
    });
  }

  protected adjust(): void {
    const factor = 1 + Number(this.adjustPercent) / 100;
    this.lines().forEach((line) => MONTHS.filter((month) => !this.isLocked(month)).forEach((month) => this.setCell(line, month, (this.cellValue(line, month) * factor).toFixed(4))));
  }

  protected save(): void {
    const p = this.plan();
    if (!p) return;
    const payload = [...this.dirty().entries()].map(([id, months]) => ({ id, ...months }));
    this.api.saveBudgetLines(p.id, payload as unknown as Partial<ControllingBudgetLine>[]).subscribe({
      next: (response) => this.afterSave(response.data),
      error: (error) => this.message.error(errorText(error) ?? this.translate.instant('CONTROLLING.ACTION_FAILED')),
    });
  }

  protected open(id: string): void {
    this.api.getBudget(id).subscribe({ next: (response) => { this.plan.set(response.data); this.dirty.set(new Map()); } });
  }

  protected create(): void {
    this.api.createBudget({ code: this.code, name: this.name, fiscal_year: this.filters.fiscalYear() }).subscribe({ next: (r) => this.created(r.data), error: (e) => this.fail(e) });
  }

  protected seed(): void {
    this.api.seedBudget({ code: this.code, name: this.name, fiscal_year: this.filters.fiscalYear(), uplift_percent: Number(this.uplift) }).subscribe({ next: (r) => this.created(r.data), error: (e) => this.fail(e) });
  }

  protected clone(plan: BudgetPlan): void {
    this.api.cloneBudget(plan.id, { code: this.code, name: this.name, uplift_percent: Number(this.uplift) }).subscribe({ next: (r) => this.created(r.data), error: (e) => this.fail(e) });
  }

  protected rolling(plan: BudgetPlan): void {
    this.api.generateRollingForecast(plan.id, this.filters.lastMonth()).subscribe({ next: (r) => this.created(r.data), error: (e) => this.fail(e) });
  }

  protected transition(plan: BudgetPlan, action: 'submit' | 'approve' | 'lock'): void {
    this.api.transitionBudget(plan.id, action).subscribe({
      next: () => { this.loadPlans(); if (this.plan()?.id === plan.id) this.open(plan.id); },
      error: (e) => this.fail(e),
    });
  }

  private setCell(line: ControllingBudgetLine, month: number, value: string): void {
    this.dirty.update((map) => {
      const next = new Map(map);
      next.set(line.id, { ...(next.get(line.id) ?? {}), [monthKey(month)]: value });
      return next;
    });
  }

  private afterSave(plan: BudgetPlan): void {
    this.plan.set(plan);
    this.dirty.set(new Map());
    this.message.success(this.translate.instant('CONTROLLING.SAVED'));
    this.loadPlans();
  }

  private created(plan: BudgetPlan): void {
    this.code = '';
    this.name = '';
    this.loadPlans();
    this.open(plan.id);
  }

  private fail(error: unknown): void {
    this.message.error(errorText(error) ?? this.translate.instant('CONTROLLING.ACTION_FAILED'));
  }

  private loadPlans(): void {
    this.api.getBudgets(this.filters.fiscalYear()).subscribe({ next: (response) => this.plans.set(response.data) });
  }
}
