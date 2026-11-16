import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PlanningApiService, PlanningScenario, TranslateService } from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { PlanningBalanceComponent } from './planning-balance.component';
import { PlanningCapacityComponent } from './planning-capacity.component';
import { PlanningLinesComponent } from './planning-lines.component';
import { apiErrorText, blankToNull, SCENARIO_STATUS_COLORS } from './planning.util';

export type PlanningCycleAction = 'submit' | 'approve' | 'reject' | 'lock' | 'publish';

/** One scenario: its plan lines, balance, capacity check and the S&OP cycle with its approval trail. */
@Component({
  selector: 'app-planning-scenario-detail',
  styleUrl: './planning.scss',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ModalActionsDirective,
    PageHeaderComponent,
    PlanningBalanceComponent,
    PlanningCapacityComponent,
    PlanningLinesComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="scenario()?.name ?? ''" [subtitle]="subtitle()">
      <a nz-button routerLink="/planning/scenarios">{{ 'PLANNING.BACK_TO_SCENARIOS' | translate }}</a>
    </app-page-header>

    @if (scenario(); as current) {
      <div class="toolbar">
        <nz-tag [nzColor]="statusColor()">{{ ('PLANNING.STATUS_' + current.status.toUpperCase()) | translate }}</nz-tag>
        <nz-tag>{{ ('PLANNING.TYPE_' + current.scenario_type.toUpperCase()) | translate }}</nz-tag>
        <span class="muted">{{ current.horizon_start }} - {{ current.horizon_end }}</span>
        @if (current.published_version > 0) {
          <nz-tag nzColor="blue">{{ 'PLANNING.PUBLISHED_VERSION' | translate }} v{{ current.published_version }}</nz-tag>
        }
        <span class="spacer"></span>
        @if (current.status === 'draft') {
          <button nz-button nzType="primary" (click)="openAction('submit')">{{ 'PLANNING.ACTION_SUBMIT' | translate }}</button>
        }
        @if (current.status === 'review') {
          <button nz-button nzType="primary" (click)="openAction('approve')">{{ 'PLANNING.ACTION_APPROVE' | translate }}</button>
          <button nz-button nzDanger (click)="openAction('reject')">{{ 'PLANNING.ACTION_REJECT' | translate }}</button>
        }
        @if (current.status === 'approved') {
          <button nz-button (click)="openAction('lock')">{{ 'PLANNING.ACTION_LOCK' | translate }}</button>
          @if (current.published_version === 0) {
            <button nz-button nzDanger (click)="openAction('reject')">{{ 'PLANNING.ACTION_REJECT' | translate }}</button>
          }
        }
        @if (current.status === 'approved' || current.status === 'locked') {
          <button nz-button nzType="primary" (click)="openAction('publish')">{{ 'PLANNING.ACTION_PUBLISH' | translate }}</button>
        }
      </div>

      <nz-tabs>
        <nz-tab [nzTitle]="'PLANNING.TAB_LINES' | translate">
          <ng-template nzTabContent><app-planning-lines [scenarioId]="current.id" [editable]="editable()" (changed)="bump()"></app-planning-lines></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'PLANNING.TAB_BALANCE' | translate">
          <ng-template nzTabContent><app-planning-balance [scenarioId]="current.id" [refresh]="version()"></app-planning-balance></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'PLANNING.TAB_CAPACITY' | translate">
          <ng-template nzTabContent><app-planning-capacity [scenarioId]="current.id" [editable]="editable()" [refresh]="version()"></app-planning-capacity></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'PLANNING.TAB_APPROVALS' | translate">
          <ng-template nzTabContent>
            <nz-card class="main-card">
              <nz-table #trail [nzData]="current.approvals ?? []" nzSize="small" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'PLANNING.DATE' | translate }}</th>
                    <th>{{ 'PLANNING.ACTION' | translate }}</th>
                    <th>{{ 'PLANNING.STATUS' | translate }}</th>
                    <th>{{ 'PLANNING.COMMENT' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of trail.data; track row.id) {
                    <tr>
                      <td>{{ row.created_at }}</td>
                      <td>{{ ('PLANNING.ACTION_' + row.action.toUpperCase()) | translate }}</td>
                      <td>{{ ('PLANNING.STATUS_' + row.from_status.toUpperCase()) | translate }} &rarr; {{ ('PLANNING.STATUS_' + row.to_status.toUpperCase()) | translate }}</td>
                      <td>{{ row.comment }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
              @if ((current.approvals ?? []).length === 0) {
                <nz-empty [nzNotFoundContent]="'PLANNING.NO_APPROVALS' | translate"></nz-empty>
              }
            </nz-card>
          </ng-template>
        </nz-tab>
      </nz-tabs>
    }

    <nz-modal [(nzVisible)]="actionVisible" [nzTitle]="actionTitle() | translate" (nzOnCancel)="actionVisible.set(false)" (nzOnOk)="runAction()" okAction="save" [nzOkDisabled]="actionForm.invalid || (action() === 'reject' && !actionForm.controls.comment.value.trim())">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="actionForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label [nzRequired]="action() === 'reject'" nzFor="cycle-comment">{{ 'PLANNING.COMMENT' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="cycle-comment" rows="3" formControlName="comment" maxlength="1000"></textarea></nz-form-control>
          </nz-form-item>
          @if (action() === 'approve') {
            <nz-form-item>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <nz-form-control [nzExtra]="'PLANNING.ACCEPT_OVERLOAD_HINT' | translate"><label nz-checkbox formControlName="accept_overload">{{ 'PLANNING.ACCEPT_OVERLOAD' | translate }}</label></nz-form-control>
            </nz-form-item>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PlanningScenarioDetailComponent implements OnInit {
  private readonly api = inject(PlanningApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly scenario = signal<PlanningScenario | null>(null);
  readonly version = signal(0);
  readonly actionVisible = signal(false);
  readonly action = signal<PlanningCycleAction>('submit');
  readonly editable = computed(() => this.scenario()?.status === 'draft');
  readonly actionTitle = computed(() => `PLANNING.ACTION_${this.action().toUpperCase()}`);

  readonly actionForm = this.fb.group({
    comment: [''],
    accept_overload: [false],
  });

  ngOnInit(): void {
    this.reload();
  }

  subtitle(): string {
    const scenario = this.scenario();
    return scenario?.description ?? '';
  }

  statusColor(): string {
    return SCENARIO_STATUS_COLORS[this.scenario()?.status ?? 'draft'];
  }

  bump(): void {
    this.version.update((value) => value + 1);
  }

  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.api.getScenario(id).subscribe({
      next: (response) => this.scenario.set(response.data),
      error: () => this.message.error(this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }

  openAction(action: PlanningCycleAction): void {
    this.action.set(action);
    this.actionForm.reset({ comment: '', accept_overload: false });
    this.actionVisible.set(true);
  }

  runAction(): void {
    const scenario = this.scenario();
    if (!scenario) {
      return;
    }

    const value = this.actionForm.getRawValue();
    const comment = blankToNull(value.comment);
    const action = this.action();
    const payload = action === 'approve' ? { comment, accept_overload: value.accept_overload } : { comment };
    const request: Observable<unknown> = {
      submit: () => this.api.submitScenario(scenario.id, payload),
      approve: () => this.api.approveScenario(scenario.id, payload),
      reject: () => this.api.rejectScenario(scenario.id, payload),
      lock: () => this.api.lockScenario(scenario.id, payload),
      publish: () => this.api.publishScenario(scenario.id, payload),
    }[action]();

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLANNING.CYCLE_DONE'));
        this.actionVisible.set(false);
        this.reload();
        this.bump();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }
}
