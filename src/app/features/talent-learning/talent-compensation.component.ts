import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TalentBudgetPool, TalentCompCycle, TalentCycleSummary, TalentEmployee, TalentLearningApiService, TalentMeritProposal, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { blankToNull, keyOf, mutationObserver, tagColor, todayIso } from './talent-learning.util';

/** Compensation planning cycles with guidelines per rating, budget pools and merit proposals. */
@Component({
  selector: 'app-talent-compensation',
  styleUrl: './talent-learning.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'TALENT_LEARNING.COMPENSATION_TITLE' | translate" [subtitle]="'TALENT_LEARNING.COMPENSATION_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCycleModal()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.CYCLES' | translate">
      <nz-table #cycleTable [nzData]="cycles()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'TALENT_LEARNING.NAME' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.FISCAL_YEAR' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.STARTS_ON' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.EFFECTIVE_ON' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of cycleTable.data; track row.id) {
            <tr>
              <td>{{ row.name }}</td>
              <td>{{ row.fiscal_year }}</td>
              <td>{{ row.starts_on }} - {{ row.ends_on }}</td>
              <td>{{ row.effective_on }}</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ 'TALENT_LEARNING.STATUS_' + key(row.status) | translate }}</nz-tag></td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" (click)="select(row)">{{ 'TALENT_LEARNING.PROPOSALS' | translate }}</button>
                  @if (row.status === 'draft') {
                    <button nz-button nzType="text" appIconAction="edit" (click)="openCycleModal(row)"></button>
                    <button nz-button nzType="text" (click)="openGuidelines(row)">{{ 'TALENT_LEARNING.GUIDELINES' | translate }}</button>
                    <button nz-button nzType="text" (click)="transition(row, 'open')">{{ 'TALENT_LEARNING.OPEN_ACTION' | translate }}</button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeCycle(row)"></button>
                  }
                  @if (row.status === 'open') {
                    <button nz-button nzType="text" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.CLOSE_CONFIRM' | translate" (nzOnConfirm)="transition(row, 'close')">{{ 'TALENT_LEARNING.CLOSE_ACTION' | translate }}</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && cycles().length === 0) {
        <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_CYCLES' | translate"></nz-empty>
      }
    </nz-card>

    @if (selected(); as cycle) {
      @if (summary(); as figures) {
        <nz-card class="main-card" [nzTitle]="('TALENT_LEARNING.BUDGET_POOLS' | translate) + ': ' + cycle.name">
          <div class="toolbar">
            <span class="muted">{{ 'TALENT_LEARNING.BUDGET_TOTAL' | translate }} {{ figures.budget_amount | number: '1.2-2' }} {{ figures.currency }} - {{ 'TALENT_LEARNING.BUDGET_COMMITTED' | translate }} {{ figures.committed_amount | number: '1.2-2' }} - {{ 'TALENT_LEARNING.BUDGET_REMAINING' | translate }} {{ figures.remaining_amount | number: '1.2-2' }}</span>
            <span class="spacer"></span>
            @if (cycle.status !== 'closed') {
              <button nz-button nzType="primary" (click)="openPoolModal()" appIconAction="create"></button>
            }
          </div>
          <nz-table #poolTable [nzData]="figures.pools" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'TALENT_LEARNING.NAME' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.BUDGET_TOTAL' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.BUDGET_COMMITTED' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.BUDGET_REMAINING' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.UTILIZATION' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (pool of poolTable.data; track pool.pool_id) {
                <tr>
                  <td>{{ pool.name }}</td>
                  <td class="num">{{ pool.budget_amount | number: '1.2-2' }}</td>
                  <td class="num">{{ pool.committed_amount | number: '1.2-2' }}</td>
                  <td class="num">{{ pool.remaining_amount | number: '1.2-2' }}</td>
                  <td class="num">{{ pool.utilization_percent | number: '1.0-1' }} %</td>
                  <td>
                    @if (cycle.status === 'draft') {
                      <button nz-button nzType="text" appIconAction="edit" (click)="openPoolModal(pool)"></button>
                      <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removePool(pool.pool_id)"></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      }

      <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.MERIT_PROPOSALS' | translate">
        @if (cycle.status === 'open') {
          <div class="toolbar"><span class="spacer"></span><button nz-button nzType="primary" (click)="openProposalModal()" appIconAction="create"></button></div>
        }
        <nz-table #proposalTable [nzData]="proposals()" nzSize="small" [nzPageSize]="25">
          <thead>
            <tr>
              <th>{{ 'TALENT_LEARNING.EMPLOYEE' | translate }}</th>
              <th>{{ 'TALENT_LEARNING.BUDGET_POOL' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.PERFORMANCE_RATING' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.CURRENT_SALARY' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.INCREASE_PERCENT' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.NEW_SALARY' | translate }}</th>
              <th>{{ 'TALENT_LEARNING.STATUS' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (proposal of proposalTable.data; track proposal.id) {
              <tr>
                <td>{{ proposal.employee?.full_name }}</td>
                <td>{{ proposal.pool?.name }}</td>
                <td class="num">{{ proposal.performance_rating }}</td>
                <td class="num">{{ proposal.current_salary | number: '1.2-2' }}</td>
                <td class="num" [class.row-overdue]="proposal.is_exception">
                  {{ proposal.increase_percent | number: '1.0-2' }} %
                  @if (proposal.is_exception) { <nz-tag nzColor="orange">{{ 'TALENT_LEARNING.EXCEPTION' | translate }}</nz-tag> }
                </td>
                <td class="num">{{ proposal.new_salary | number: '1.2-2' }}</td>
                <td><nz-tag [nzColor]="color(proposal.status)">{{ 'TALENT_LEARNING.PROPOSAL_' + key(proposal.status) | translate }}</nz-tag></td>
                <td>
                  <div class="row-actions">
                    @if (proposal.status === 'draft') {
                      <button nz-button nzType="text" appIconAction="edit" (click)="openProposalModal(proposal)"></button>
                      <button nz-button nzType="text" (click)="submitProposal(proposal)">{{ 'TALENT_LEARNING.SUBMIT' | translate }}</button>
                      <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeProposal(proposal)"></button>
                    }
                    @if (proposal.status === 'submitted') {
                      <button nz-button nzType="text" (click)="openDecision(proposal, 'approve')">{{ 'TALENT_LEARNING.APPROVE' | translate }}</button>
                      <button nz-button nzType="text" nzDanger (click)="openDecision(proposal, 'reject')">{{ 'TALENT_LEARNING.REJECT' | translate }}</button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (proposals().length === 0) {
          <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_PROPOSALS' | translate"></nz-empty>
        }
      </nz-card>
    }

    <nz-modal [(nzVisible)]="cycleModalVisible" [nzTitle]="(editingCycle() ? 'TALENT_LEARNING.EDIT_CYCLE' : 'TALENT_LEARNING.NEW_CYCLE') | translate" (nzOnCancel)="cycleModalVisible.set(false)" (nzOnOk)="saveCycle()" okAction="save" [nzOkDisabled]="cycleForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="cycleForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cycle-name">{{ 'TALENT_LEARNING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="cycle-name" formControlName="name" maxlength="150" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cycle-year">{{ 'TALENT_LEARNING.FISCAL_YEAR' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cycle-year" type="number" formControlName="fiscal_year" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cycle-currency">{{ 'TALENT_LEARNING.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cycle-currency" formControlName="currency" maxlength="3" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cycle-start">{{ 'TALENT_LEARNING.STARTS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cycle-start" type="date" formControlName="starts_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cycle-end">{{ 'TALENT_LEARNING.ENDS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cycle-end" type="date" formControlName="ends_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cycle-effective">{{ 'TALENT_LEARNING.EFFECTIVE_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cycle-effective" type="date" formControlName="effective_on" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="cycle-notes">{{ 'TALENT_LEARNING.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="cycle-notes" rows="2" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="guidelineModalVisible" [nzTitle]="'TALENT_LEARNING.GUIDELINES' | translate" (nzOnCancel)="guidelineModalVisible.set(false)" (nzOnOk)="saveGuidelines()" okAction="save" [nzOkDisabled]="guidelineForm.invalid">
      <ng-container *nzModalContent>
        <p class="muted">{{ 'TALENT_LEARNING.GUIDELINES_HINT' | translate }}</p>
        <form nz-form [formGroup]="guidelineForm" nzLayout="vertical">
          <div formArrayName="rows">
            @for (row of guidelineRows.controls; track $index; let i = $index) {
              <div [formGroupName]="i" class="guideline-row">
                <span>{{ 'TALENT_LEARNING.PERFORMANCE_RATING' | translate }} {{ row.controls.performance_rating.value }}</span>
                <input nz-input type="number" min="0" max="100" step="any" formControlName="min_percent" [attr.aria-label]="'TALENT_LEARNING.GUIDELINE_MIN' | translate" />
                <input nz-input type="number" min="0" max="100" step="any" formControlName="max_percent" [attr.aria-label]="'TALENT_LEARNING.GUIDELINE_MAX' | translate" />
              </div>
            }
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="poolModalVisible" [nzTitle]="(editingPool() ? 'TALENT_LEARNING.EDIT_POOL' : 'TALENT_LEARNING.NEW_POOL') | translate" (nzOnCancel)="poolModalVisible.set(false)" (nzOnOk)="savePool()" okAction="save" [nzOkDisabled]="poolForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="poolForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="pool-name">{{ 'TALENT_LEARNING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="pool-name" formControlName="name" maxlength="150" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="pool-amount">{{ 'TALENT_LEARNING.BUDGET_TOTAL' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="pool-amount" type="number" min="0" step="any" formControlName="budget_amount" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="proposalModalVisible" [nzTitle]="(editingProposal() ? 'TALENT_LEARNING.EDIT_PROPOSAL' : 'TALENT_LEARNING.NEW_PROPOSAL') | translate" (nzOnCancel)="proposalModalVisible.set(false)" (nzOnOk)="saveProposal()" okAction="save" [nzOkDisabled]="proposalForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="proposalForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TALENT_LEARNING.EMPLOYEE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="employee_id" nzShowSearch [nzDisabled]="editingProposal() !== null">
                @for (employee of employees(); track employee.id) {
                  <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TALENT_LEARNING.BUDGET_POOL' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="budget_pool_id">
                @for (pool of pools(); track pool.id) {
                  <nz-option [nzValue]="pool.id" [nzLabel]="pool.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="proposal-rating">{{ 'TALENT_LEARNING.PERFORMANCE_RATING' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="proposal-rating" type="number" min="1" max="5" formControlName="performance_rating" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="proposal-percent">{{ 'TALENT_LEARNING.INCREASE_PERCENT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="proposal-percent" type="number" min="0" max="100" step="any" formControlName="increase_percent" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="proposal-justification">{{ 'TALENT_LEARNING.JUSTIFICATION' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'TALENT_LEARNING.JUSTIFICATION_HINT' | translate"><textarea nz-input id="proposal-justification" rows="3" formControlName="justification"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="decisionModalVisible" [nzTitle]="(decision() === 'approve' ? 'TALENT_LEARNING.APPROVE' : 'TALENT_LEARNING.REJECT') | translate" (nzOnCancel)="decisionModalVisible.set(false)" (nzOnOk)="saveDecision()" okAction="save" [nzOkDisabled]="decision() === 'reject' && decisionNote.trim() === ''">
      <ng-container *nzModalContent>
        <nz-form-item>
          <nz-form-label [nzRequired]="decision() === 'reject'" nzFor="decision-note">{{ 'TALENT_LEARNING.DECISION_NOTE' | translate }}</nz-form-label>
          <nz-form-control><textarea nz-input id="decision-note" rows="3" [(ngModel)]="decisionNote"></textarea></nz-form-control>
        </nz-form-item>
      </ng-container>
    </nz-modal>
  `,
})
export class TalentCompensationComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly color = tagColor;
  readonly key = keyOf;
  readonly cycles = signal<TalentCompCycle[]>([]);
  readonly pools = signal<TalentBudgetPool[]>([]);
  readonly summary = signal<TalentCycleSummary | null>(null);
  readonly proposals = signal<TalentMeritProposal[]>([]);
  readonly employees = signal<TalentEmployee[]>([]);
  readonly selected = signal<TalentCompCycle | null>(null);
  readonly loading = signal(false);
  readonly cycleModalVisible = signal(false);
  readonly editingCycle = signal<TalentCompCycle | null>(null);
  readonly editingPool = signal<{ pool_id: string; name: string; budget_amount: string | number } | null>(null);
  readonly editingProposal = signal<TalentMeritProposal | null>(null);
  readonly guidelineModalVisible = signal(false);
  readonly poolModalVisible = signal(false);
  readonly proposalModalVisible = signal(false);
  readonly decisionModalVisible = signal(false);
  readonly decision = signal<'approve' | 'reject'>('approve');
  readonly decisionTarget = signal<TalentMeritProposal | null>(null);
  decisionNote = '';

  readonly cycleForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    fiscal_year: [new Date().getFullYear(), Validators.required],
    currency: ['EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    starts_on: [todayIso(), Validators.required],
    ends_on: ['', Validators.required],
    effective_on: ['', Validators.required],
    notes: [''],
  });

  readonly guidelineForm = this.fb.group({
    rows: this.fb.array([1, 2, 3, 4, 5].map((rating) => this.guidelineRow(rating))),
  });

  readonly poolForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    budget_amount: this.fb.control<number | null>(null, Validators.required),
  });

  readonly proposalForm = this.fb.group({
    employee_id: ['', Validators.required],
    budget_pool_id: ['', Validators.required],
    performance_rating: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    increase_percent: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    justification: [''],
  });

  get guidelineRows() {
    return this.guidelineForm.controls.rows;
  }

  ngOnInit(): void {
    this.api.getEmployeeLookup().subscribe((response) => this.employees.set(response.data));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getCycles({ per_page: 100 }).subscribe({
      next: (response) => {
        this.cycles.set(response.data);
        this.loading.set(false);
        const current = this.selected();
        if (current) {
          this.select(response.data.find((cycle) => cycle.id === current.id) ?? null);
        }
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
      },
    });
  }

  select(cycle: TalentCompCycle | null): void {
    this.selected.set(cycle);
    this.summary.set(null);
    this.pools.set([]);
    this.proposals.set([]);
    if (!cycle) {
      return;
    }
    this.api.getCycleSummary(cycle.id).subscribe((response) => this.summary.set(response.data));
    this.api.getBudgetPools({ cycle_id: cycle.id, per_page: 100 }).subscribe((response) => this.pools.set(response.data));
    this.api.getMeritProposals({ cycle_id: cycle.id, per_page: 100 }).subscribe((response) => this.proposals.set(response.data));
  }

  openCycleModal(cycle: TalentCompCycle | null = null): void {
    this.editingCycle.set(cycle);
    this.cycleForm.reset(
      cycle
        ? { name: cycle.name, fiscal_year: cycle.fiscal_year, currency: cycle.currency, starts_on: cycle.starts_on, ends_on: cycle.ends_on, effective_on: cycle.effective_on, notes: cycle.notes ?? '' }
        : { name: '', fiscal_year: new Date().getFullYear(), currency: 'EUR', starts_on: todayIso(), ends_on: '', effective_on: '', notes: '' },
    );
    this.cycleModalVisible.set(true);
  }

  saveCycle(): void {
    const value = this.cycleForm.getRawValue();
    const current = this.editingCycle();
    (current
      ? this.api.updateCycle(current.id, this.cyclePayload(value))
      : this.api.createCycle(this.cyclePayload(value))
    ).subscribe(this.observer(() => this.cycleModalVisible.set(false)));
  }

  private cyclePayload(value: ReturnType<typeof this.cycleForm.getRawValue>) {
    return {
        name: value.name.trim(),
        fiscal_year: value.fiscal_year,
        currency: value.currency.toUpperCase(),
        starts_on: value.starts_on,
        ends_on: value.ends_on,
        effective_on: value.effective_on,
        notes: blankToNull(value.notes),
    };
  }

  transition(cycle: TalentCompCycle, action: 'open' | 'close'): void {
    (action === 'open' ? this.api.openCycle(cycle.id) : this.api.closeCycle(cycle.id)).subscribe(this.observer());
  }

  removeCycle(cycle: TalentCompCycle): void {
    if (this.selected()?.id === cycle.id) {
      this.selected.set(null);
    }
    this.api.deleteCycle(cycle.id).subscribe(this.observer());
  }

  openGuidelines(cycle: TalentCompCycle): void {
    this.selected.set(cycle);
    this.api.getCycle(cycle.id).subscribe((response) => {
      for (const row of this.guidelineRows.controls) {
        const saved = response.data.guidelines?.find((guideline) => guideline.performance_rating === row.controls.performance_rating.value);
        row.patchValue({ min_percent: saved ? Number(saved.min_percent) : 0, max_percent: saved ? Number(saved.max_percent) : 0 });
      }
      this.guidelineModalVisible.set(true);
    });
  }

  saveGuidelines(): void {
    const cycle = this.selected();
    if (!cycle) {
      return;
    }
    const guidelines = this.guidelineRows.getRawValue().map((row) => ({
      performance_rating: row.performance_rating,
      min_percent: String(row.min_percent),
      max_percent: String(row.max_percent),
    }));
    this.api.replaceGuidelines(cycle.id, guidelines).subscribe(this.observer(() => this.guidelineModalVisible.set(false)));
  }

  openPoolModal(pool: { pool_id: string; name: string; budget_amount: string | number } | null = null): void {
    this.editingPool.set(pool);
    this.poolForm.reset({ name: pool?.name ?? '', budget_amount: pool ? Number(pool.budget_amount) : null });
    this.poolModalVisible.set(true);
  }

  savePool(): void {
    const cycle = this.selected();
    if (!cycle) {
      return;
    }
    const value = this.poolForm.getRawValue();
    const current = this.editingPool();
    const request = current
      ? this.api.updateBudgetPool(current.pool_id, { name: value.name.trim(), budget_amount: String(value.budget_amount) })
      : this.api.createBudgetPool({ cycle_id: cycle.id, name: value.name.trim(), budget_amount: String(value.budget_amount) });
    request.subscribe(this.observer(() => this.poolModalVisible.set(false)));
  }

  removePool(id: string): void {
    this.api.deleteBudgetPool(id).subscribe(this.observer());
  }

  openProposalModal(proposal: TalentMeritProposal | null = null): void {
    this.editingProposal.set(proposal);
    this.proposalForm.reset(
      proposal
        ? { employee_id: proposal.employee_id, budget_pool_id: proposal.budget_pool_id, performance_rating: proposal.performance_rating, increase_percent: Number(proposal.increase_percent), justification: proposal.justification ?? '' }
        : { employee_id: '', budget_pool_id: '', performance_rating: 3, increase_percent: null, justification: '' },
    );
    this.proposalModalVisible.set(true);
  }

  saveProposal(): void {
    const cycle = this.selected();
    if (!cycle) {
      return;
    }
    const value = this.proposalForm.getRawValue();
    const current = this.editingProposal();
    if (current) {
      this.api
        .updateMeritProposal(current.id, {
          budget_pool_id: value.budget_pool_id,
          performance_rating: value.performance_rating,
          increase_percent: String(value.increase_percent),
          justification: blankToNull(value.justification),
        })
        .subscribe(this.observer(() => this.proposalModalVisible.set(false)));
      return;
    }
    this.api
      .createMeritProposal({
        cycle_id: cycle.id,
        employee_id: value.employee_id,
        budget_pool_id: value.budget_pool_id,
        performance_rating: value.performance_rating,
        increase_percent: String(value.increase_percent),
        justification: blankToNull(value.justification),
      })
      .subscribe(this.observer(() => this.proposalModalVisible.set(false)));
  }

  submitProposal(proposal: TalentMeritProposal): void {
    this.api.submitMeritProposal(proposal.id).subscribe(this.observer());
  }

  openDecision(proposal: TalentMeritProposal, decision: 'approve' | 'reject'): void {
    this.decisionTarget.set(proposal);
    this.decision.set(decision);
    this.decisionNote = '';
    this.decisionModalVisible.set(true);
  }

  saveDecision(): void {
    const target = this.decisionTarget();
    if (!target) {
      return;
    }
    this.api.decideMeritProposal(target.id, this.decision(), blankToNull(this.decisionNote)).subscribe(this.observer(() => this.decisionModalVisible.set(false)));
  }

  removeProposal(proposal: TalentMeritProposal): void {
    this.api.deleteMeritProposal(proposal.id).subscribe(this.observer());
  }

  private guidelineRow(rating: number) {
    return this.fb.group({
      performance_rating: [rating],
      min_percent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      max_percent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    });
  }

  private observer(onSuccess?: () => void): { next: () => void; error: (error: unknown) => void } {
    return mutationObserver(this.message, this.translate, () => {
      onSuccess?.();
      this.load();
    });
  }
}
