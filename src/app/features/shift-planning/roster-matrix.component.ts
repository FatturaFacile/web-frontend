import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  ComplianceIssue,
  GenerateRosterPayload,
  RosterMatrixRow,
  RosterPeriodType,
  ShiftAssignment,
  ShiftSwapRequest,
  ShiftTemplate,
  SurchargeTag,
  SwapDecisionPayload,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { MutationOutcome, RosterStore } from './roster.store';
import { RosterGenerateModalComponent } from './roster-generate-modal.component';
import { SwapApprovalDrawerComponent } from './swap-approval-drawer.component';
import {
  blockingIssues,
  formatMinutes,
  shiftRange,
  templateLabel,
  warningIssues,
} from './shift-planning.util';

/** What a card is dropped on: an employee (or role) row at a day. */
export interface DropCell {
  rowKey: string;
  employeeId: string | null;
  skillId: string | null;
  date: string;
}

/** Palette marker: cards dragged from it are copies of a template, not shifts. */
export const PALETTE = 'palette';

function isTemplate(item: unknown): item is ShiftTemplate {
  return typeof item === 'object' && item !== null && 'start_time' in item && 'code' in item;
}

/**
 * The roster scheduler (Mod 073): weekly or monthly matrix by employee or by role, drag and drop of shifts with the
 * real-time compliance answer of the API, coverage heatmap, labour cost estimator and the swap inbox.
 */
@Component({
  selector: 'app-roster-matrix',
  templateUrl: './roster-matrix.component.html',
  styleUrl: './roster-matrix.component.scss',
  providers: [RosterStore],
  imports: [
    DragDropModule,
    FormsModule,
    NgTemplateOutlet,
    PageHeaderComponent,
    RosterGenerateModalComponent,
    SwapApprovalDrawerComponent,
    TranslatePipe,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzDropdownModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzRadioModule,
    NzSpinModule,
    NzTagModule,
    NzTooltipModule,
  ],
})
export class RosterMatrixComponent implements OnInit {
  readonly store = inject(RosterStore);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  readonly palette = PALETTE;
  readonly generateOpen = signal(false);
  readonly swapsOpen = signal(false);
  readonly isCompact = computed(() => this.store.days().length > 7);
  readonly language = computed(() => this.translate.currentLanguage());
  readonly employeeNames = computed(() =>
    Object.fromEntries(
      this.store
        .rows()
        .filter((row) => row.employee_id)
        .map((row) => [row.employee_id as string, row.employee_name ?? '']),
    ),
  );
  /** The rows a shift can be moved to with the keyboard menu. */
  readonly employeeRows = computed(() =>
    this.store.matrix()?.group_by === 'employee'
      ? this.store.rows().filter((row) => row.employee_id)
      : [],
  );

  ngOnInit(): void {
    void this.store.init();
    void this.store.loadSwaps();
  }

  setPeriodType(type: RosterPeriodType): void {
    void this.store.setPeriodType(type);
  }

  cellShifts(row: RosterMatrixRow, day: string): ShiftAssignment[] {
    return row.cells[day] ?? [];
  }

  openShiftsOf(day: string): ShiftAssignment[] {
    return this.store.openShifts().filter((shift) => shift.shift_date === day);
  }

  dropCell(row: RosterMatrixRow | null, day: string): DropCell {
    return row === null
      ? { rowKey: 'open', employeeId: null, skillId: null, date: day }
      : {
          rowKey: row.key,
          employeeId: row.employee_id ?? null,
          skillId: row.role_or_skill_id ?? null,
          date: day,
        };
  }

  /** Drag and drop: a template from the palette creates a shift, a shift card moves it; the API answers every drop. */
  async drop(event: CdkDragDrop<DropCell>): Promise<void> {
    const target = event.container.data;
    const item: unknown = event.item.data;

    if (event.previousContainer === event.container && !isTemplate(item)) {
      return;
    }

    let outcome: MutationOutcome;

    if (isTemplate(item)) {
      outcome = await this.store.createShift({
        date: target.date,
        employeeId: target.employeeId,
        templateId: item.id,
        skillId: target.skillId,
      });
    } else {
      const shift = item as ShiftAssignment;
      // By role the employee stays on the shift: the drop changes the day (and the role of an open shift).
      const employeeId =
        this.store.matrix()?.group_by === 'role' ? shift.employee_id : target.employeeId;
      outcome = await this.store.moveShift(shift, {
        date: target.date,
        employeeId,
        templateId: shift.shift_template_id,
        skillId: target.skillId,
      });
    }

    this.report(outcome);
  }

  /** Keyboard alternative to the drag: the menu of a card assigns the shift to a row of the same view. */
  async assignTo(shift: ShiftAssignment, row: RosterMatrixRow | null): Promise<void> {
    this.report(
      await this.store.moveShift(shift, {
        date: shift.shift_date,
        employeeId: row?.employee_id ?? null,
        templateId: shift.shift_template_id,
      }),
    );
  }

  async publish(): Promise<void> {
    const outcome = await this.store.publish();
    if (outcome.ok) {
      this.message.success(this.translate.instant('SHIFT_PLANNING.PUBLISHED'));
    } else {
      this.report(outcome);
    }
  }

  async lock(): Promise<void> {
    const outcome = await this.store.lock();
    if (outcome.ok) {
      this.message.success(this.translate.instant('SHIFT_PLANNING.LOCKED'));
    } else {
      this.report(outcome);
    }
  }

  async generate(payload: GenerateRosterPayload): Promise<void> {
    const outcome = await this.store.generate(payload);
    if (outcome.ok) {
      this.generateOpen.set(false);
      this.message.success(this.translate.instant('SHIFT_PLANNING.GENERATED'));
    } else {
      this.report(outcome);
    }
  }

  async decide(event: { swap: ShiftSwapRequest; decision: SwapDecisionPayload }): Promise<void> {
    const outcome = await this.store.decideSwap(event.swap, event.decision);
    if (outcome.ok) {
      this.message.success(this.translate.instant('SHIFT_PLANNING.SWAP_DECIDED'));
    } else {
      this.report(outcome);
    }
  }

  openSwaps(): void {
    void this.store.loadSwaps();
    this.swapsOpen.set(true);
  }

  private report(outcome: MutationOutcome): void {
    if (outcome.ok) {
      return;
    }
    const first = blockingIssues(outcome.issues)[0] ?? outcome.issues[0];
    this.message.error(
      first
        ? this.describe(first)
        : this.translate.instant(outcome.message ?? 'SHIFT_PLANNING.SAVE_ERROR'),
    );
  }

  describe(issue: ComplianceIssue): string {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(issue.params)) {
      params[key] = value === null ? '' : typeof value === 'boolean' ? String(value) : value;
    }
    return this.translate.instant(issue.translation_key, params);
  }

  blocking(shift: ShiftAssignment): ComplianceIssue[] {
    return blockingIssues(shift.compliance_warnings);
  }

  warnings(shift: ShiftAssignment): ComplianceIssue[] {
    return warningIssues(shift.compliance_warnings);
  }

  tags(shift: ShiftAssignment): SurchargeTag[] {
    return shift.surcharge_breakdown?.tags ?? [];
  }

  range(shift: ShiftAssignment): string {
    return shiftRange(shift, this.store.period()?.jurisdiction ?? 'CH');
  }

  templateName(template: ShiftTemplate): string {
    return templateLabel(template.name, this.language());
  }

  hours(minutes: number | undefined): string {
    return formatMinutes(minutes ?? 0);
  }

  /** Utilisation bar of an employee row, capped at 100 (a longer plan shows the overrun in the number). */
  utilisation(row: RosterMatrixRow): number {
    return Math.min(100, Math.round(row.utilisation_percent ?? 0));
  }

  dayLabel(day: string): string {
    return new Intl.DateTimeFormat(this.language(), {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`));
  }

  rangeLabel(): string {
    const period = this.store.period();
    return period ? `${period.start_date} – ${period.end_date}` : this.store.viewStart();
  }
}
