import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { GoalCheckInRecord, GoalRecord, HrWorkforceApiService, I18nService } from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import { reportHttpError } from '../shared/hr-http.util';

/** Signed decimal string (up to 4 fraction digits): key result values travel as strings. */
export function signedDecimalValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  return value === '' || /^-?\d+(\.\d{1,4})?$/.test(value) ? null : { decimal: true };
}

/** A goal with its key results, the check-ins history, and the forms to check in and add a key result. */
@Component({
  selector: 'app-goal-detail',
  styleUrl: './goal-detail.component.scss',
  imports: [
    ModalActionsDirective,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal appModalActions
      [nzVisible]="goalId() !== null"
      [nzWidth]="800"
      [nzFooter]="null"
      [nzTitle]="goal()?.title ?? ('hrmGoals.detail' | translate)"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        @if (goal(); as current) {
          <div class="goal-detail__head">
            <nz-tag>{{ 'hrmGoals.level.' + current.level | translate }}</nz-tag>
            <nz-tag>{{ 'hrmGoals.status.' + current.status | translate }}</nz-tag>
            <nz-progress class="goal-detail__progress" [nzPercent]="percent(current.progress)" nzSize="small" />
          </div>

          <h4>{{ 'hrmGoals.keyResults' | translate }}</h4>
          <nz-table [nzData]="current.key_results ?? []" [nzFrontPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'hrmGoals.metric' | translate }}</th>
                <th>{{ 'hrmGoals.startTarget' | translate }}</th>
                <th>{{ 'hrmGoals.currentValue' | translate }}</th>
                <th>{{ 'hrmGoals.progress' | translate }}</th>
                @if (canWrite()) {
                  <th>{{ 'hrmCommon.actions' | translate }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (kr of current.key_results ?? []; track kr.id) {
                <tr>
                  <td>{{ kr.metric }}</td>
                  <td>{{ kr.start_value }} &rarr; {{ kr.target_value }} {{ kr.unit }}</td>
                  <td>{{ kr.current_value }}</td>
                  <td><nz-progress [nzPercent]="percent(kr.progress)" nzSize="small" /></td>
                  @if (canWrite()) {
                    <td class="goal-detail__actions">
                      <input
                        nz-input
                        nzSize="small"
                        inputmode="decimal"
                        [attr.aria-label]="'hrmGoals.currentValue' | translate"
                        [value]="draft(kr.id, kr.current_value)"
                        (input)="setDraft(kr.id, $event)"
                      />
                      <button nz-button nzSize="small" nzType="primary" type="button" [nzLoading]="busy()" (click)="updateValue(kr.id, kr.current_value)">
                        {{ 'hrmGoals.checkIn' | translate }}
                      </button>
                      <button nz-button nzSize="small" nzDanger type="button" [nzLoading]="busy()" (click)="removeKeyResult(kr.id)">
                        {{ 'hrmGoals.remove' | translate }}
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </nz-table>

          @if (canWrite()) {
            <h4 class="goal-detail__section">{{ 'hrmGoals.addKeyResult' | translate }}</h4>
            <form nz-form nzLayout="inline" [formGroup]="keyResultForm" (ngSubmit)="addKeyResult()">
              <nz-form-item>
                <nz-form-control [nzErrorTip]="'hrmCommon.required' | translate">
                  <input nz-input formControlName="metric" maxlength="180" [placeholder]="'hrmGoals.metric' | translate" [attr.aria-label]="'hrmGoals.metric' | translate" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-control>
                  <input nz-input formControlName="unit" maxlength="30" [placeholder]="'hrmGoals.unit' | translate" [attr.aria-label]="'hrmGoals.unit' | translate" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-control [nzErrorTip]="'hrmCommon.invalidDecimal' | translate">
                  <input nz-input inputmode="decimal" formControlName="start_value" [placeholder]="'hrmGoals.startValue' | translate" [attr.aria-label]="'hrmGoals.startValue' | translate" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-control [nzErrorTip]="'hrmCommon.invalidDecimal' | translate">
                  <input nz-input inputmode="decimal" formControlName="target_value" [placeholder]="'hrmGoals.targetValue' | translate" [attr.aria-label]="'hrmGoals.targetValue' | translate" />
                </nz-form-control>
              </nz-form-item>
              <button nz-button nzType="primary" type="submit" [disabled]="keyResultForm.invalid" [nzLoading]="busy()">
                {{ 'hrmGoals.add' | translate }}
              </button>
            </form>

            @if ((current.key_results ?? []).length === 0 && (current.children ?? []).length === 0) {
              <h4 class="goal-detail__section">{{ 'hrmGoals.progressCheckIn' | translate }}</h4>
              <form nz-form nzLayout="inline" [formGroup]="progressForm" (ngSubmit)="checkInProgress()">
                <nz-form-item>
                  <nz-form-control [nzErrorTip]="'hrmGoals.invalidProgress' | translate">
                    <input nz-input inputmode="decimal" formControlName="progress" [placeholder]="'hrmGoals.progressPercent' | translate" [attr.aria-label]="'hrmGoals.progressPercent' | translate" />
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-control>
                    <input nz-input formControlName="comment" maxlength="2000" [placeholder]="'hrmGoals.comment' | translate" [attr.aria-label]="'hrmGoals.comment' | translate" />
                  </nz-form-control>
                </nz-form-item>
                <button nz-button nzType="primary" type="submit" [disabled]="progressForm.invalid" [nzLoading]="busy()">
                  {{ 'hrmGoals.checkIn' | translate }}
                </button>
              </form>
            }
          }

          <h4 class="goal-detail__section">{{ 'hrmGoals.history' | translate }}</h4>
          <nz-table [nzData]="checkIns()" [nzFrontPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'hrmGoals.checkedInAt' | translate }}</th>
                <th>{{ 'hrmGoals.progress' | translate }}</th>
                <th>{{ 'hrmGoals.value' | translate }}</th>
                <th>{{ 'hrmGoals.comment' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of checkIns(); track item.id) {
                <tr>
                  <td>{{ item.checked_in_at }}</td>
                  <td>{{ item.progress }}%</td>
                  <td>{{ item.value }}</td>
                  <td>{{ item.comment }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class GoalDetailComponent {
  /** Goal to show; null keeps the modal closed. */
  readonly goalId = input<string | null>(null);
  readonly canWrite = input(false);
  readonly closed = output<void>();
  /** Something of the goal changed: the list behind the modal must reload. */
  readonly changed = output<void>();

  private readonly api = inject(HrWorkforceApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly goal = signal<GoalRecord | null>(null);
  protected readonly checkIns = signal<GoalCheckInRecord[]>([]);
  protected readonly busy = signal(false);
  private readonly drafts = signal<Record<string, string>>({});

  protected readonly keyResultForm = this.fb.group({
    metric: ['', [Validators.required, Validators.maxLength(180)]],
    unit: ['', Validators.maxLength(30)],
    start_value: ['', signedDecimalValidator],
    target_value: ['', [Validators.required, signedDecimalValidator]],
  });
  protected readonly progressForm = this.fb.group({
    progress: ['', [Validators.required, signedDecimalValidator, Validators.min(0), Validators.max(100)]],
    comment: ['', Validators.maxLength(2000)],
  });

  constructor() {
    effect(() => {
      const id = this.goalId();
      untracked(() => {
        this.drafts.set({});
        if (id) {
          this.load(id);
        } else {
          this.goal.set(null);
          this.checkIns.set([]);
        }
      });
    });
  }

  protected percent(progress: string): number {
    return Math.round(Number(progress) || 0);
  }

  protected draft(id: string, current: string): string {
    return this.drafts()[id] ?? current;
  }

  protected setDraft(id: string, event: Event): void {
    this.drafts.update((drafts) => ({ ...drafts, [id]: (event.target as HTMLInputElement).value }));
  }

  protected updateValue(keyResultId: string, current: string): void {
    const value = this.draft(keyResultId, current).trim();
    if (!/^-?\d+(\.\d{1,4})?$/.test(value)) {
      this.message.error(this.i18n.translate('hrmCommon.invalidDecimal'));
      return;
    }
    this.run(this.api.checkInGoal(this.requireGoalId(), { key_result_id: keyResultId, value }));
  }

  protected removeKeyResult(keyResultId: string): void {
    this.run(this.api.deleteKeyResult(keyResultId));
  }

  protected addKeyResult(): void {
    if (this.keyResultForm.invalid) {
      this.keyResultForm.markAllAsTouched();
      return;
    }
    const value = this.keyResultForm.getRawValue();
    this.run(
      this.api.addKeyResult(this.requireGoalId(), {
        metric: value.metric.trim(),
        unit: value.unit.trim() || null,
        start_value: value.start_value.trim() || null,
        target_value: value.target_value.trim(),
      }),
      () => this.keyResultForm.reset(),
    );
  }

  protected checkInProgress(): void {
    if (this.progressForm.invalid) {
      this.progressForm.markAllAsTouched();
      return;
    }
    const value = this.progressForm.getRawValue();
    this.run(
      this.api.checkInGoal(this.requireGoalId(), { progress: value.progress.trim(), comment: value.comment.trim() || null }),
      () => this.progressForm.reset(),
    );
  }

  private requireGoalId(): string {
    return this.goalId() ?? '';
  }

  private run(request: Observable<unknown>, onDone?: () => void): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        onDone?.();
        this.drafts.set({});
        this.load(this.requireGoalId());
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  private load(id: string): void {
    this.api.getGoal(id).subscribe({
      next: (res) => {
        this.goal.set(res.data);
        this.checkIns.set(res.data.check_ins ?? []);
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
