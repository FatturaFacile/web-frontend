import { Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import {
  BookingType,
  CandidateBlocker,
  CandidateSearchPayload,
  PROFICIENCY_LEVELS,
  ResourceCandidate,
  ResourcePlanningApiService,
  Skill,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';
import { ProjectWbsPickerComponent } from './project-wbs-picker.component';
import { ResourcePlannerStore } from './resource-planning.store';
import {
  blockerKey,
  buildCandidateAllocation,
  buildCandidateSearch,
  formatHours,
  formatPercent,
  issueParams,
  problemDetail,
  warningKey,
} from './resource-planning.util';

interface RequirementRow {
  skill_id: string;
  min_level: number;
}

/**
 * Compatible-resource suggestions: the planner states the skills (with a minimum proficiency), the window and the hours
 * per day; the API answers the ranked candidates with the skills they match, what blocks them (missing or expired skill
 * or Mod 099 certificate, no availability) and what they have left. One click books a candidate on the chosen project.
 */
@Component({
  selector: 'app-candidate-drawer',
  imports: [
    FormsModule,
    ProjectWbsPickerComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzWidth]="560"
      [nzTitle]="'resourcePlanning.candidates.title' | translate"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <div class="search">
          <h3>{{ 'resourcePlanning.candidates.requirements' | translate }}</h3>
          @for (requirement of requirements(); track $index) {
            <div class="requirement">
              <nz-select
                class="skill"
                nzShowSearch
                [attr.aria-label]="'resourcePlanning.candidates.skill' | translate"
                [nzPlaceHolder]="'resourcePlanning.candidates.skill' | translate"
                [ngModel]="requirement.skill_id || null"
                (ngModelChange)="setSkill($index, $event)"
                [ngModelOptions]="{ standalone: true }"
              >
                @for (skill of skills(); track skill.id) {
                  <nz-option
                    [nzValue]="skill.id"
                    [nzLabel]="skill.category + ' · ' + skill.skill_name"
                  ></nz-option>
                }
              </nz-select>
              <nz-select
                class="level"
                [attr.aria-label]="'resourcePlanning.candidates.minLevel' | translate"
                [ngModel]="requirement.min_level"
                (ngModelChange)="setLevel($index, $event)"
                [ngModelOptions]="{ standalone: true }"
              >
                @for (level of levels; track level) {
                  <nz-option
                    [nzValue]="level"
                    [nzLabel]="'resourcePlanning.candidates.levelOption' | translate: { level }"
                  ></nz-option>
                }
              </nz-select>
              <button
                nz-button
                type="button"
                nzType="text"
                nzDanger
                [attr.aria-label]="'resourcePlanning.candidates.removeRequirement' | translate"
                (click)="removeRequirement($index)"
              >
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
          }
          <button nz-button type="button" nzSize="small" (click)="addRequirement()">
            {{ 'resourcePlanning.candidates.addRequirement' | translate }}
          </button>

          <div class="row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rp-cand-start">{{
                'resourcePlanning.candidates.startDate' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="rp-cand-start"
                  type="date"
                  name="start"
                  [ngModel]="startDate()"
                  (ngModelChange)="startDate.set($event)"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rp-cand-end">{{
                'resourcePlanning.candidates.endDate' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="rp-cand-end"
                  type="date"
                  name="end"
                  [ngModel]="endDate()"
                  (ngModelChange)="endDate.set($event)"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rp-cand-hours">{{
                'resourcePlanning.candidates.hoursPerDay' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="rp-cand-hours"
                  type="number"
                  name="hours"
                  min="0.25"
                  max="24"
                  step="0.25"
                  [ngModel]="hoursPerDay()"
                  (ngModelChange)="hoursPerDay.set(+$event)"
              /></nz-form-control>
            </nz-form-item>
          </div>

          <nz-form-item>
            <nz-form-label nzFor="rp-cand-department">{{
              'resourcePlanning.department' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select
                nzId="rp-cand-department"
                nzAllowClear
                [nzPlaceHolder]="'resourcePlanning.allDepartments' | translate"
                [ngModel]="departmentId()"
                (ngModelChange)="departmentId.set($event ?? null)"
                [ngModelOptions]="{ standalone: true }"
              >
                @for (department of store.departments(); track department.id) {
                  <nz-option [nzValue]="department.id" [nzLabel]="department.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <app-project-wbs-picker
            idPrefix="rp-cand"
            [(projectId)]="projectId"
            [(wbsNodeId)]="wbsNodeId"
          />

          <div class="flags">
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label
              nz-checkbox
              [ngModel]="requireCertificates()"
              (ngModelChange)="requireCertificates.set($event)"
              [ngModelOptions]="{ standalone: true }"
              >{{ 'resourcePlanning.candidates.requireCertificates' | translate }}</label
            >
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label
              nz-checkbox
              [ngModel]="includeIneligible()"
              (ngModelChange)="includeIneligible.set($event)"
              [ngModelOptions]="{ standalone: true }"
              >{{ 'resourcePlanning.candidates.includeIneligible' | translate }}</label
            >
          </div>

          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="searching()"
            [disabled]="!canSearch()"
            (click)="search()"
          >
            {{ 'resourcePlanning.candidates.search' | translate }}
          </button>
        </div>

        @if (searchError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
        }

        @if (store.lastResult(); as result) {
          @if (result.warnings.length > 0) {
            <nz-alert
              class="feedback"
              nzType="warning"
              nzShowIcon
              [nzMessage]="'resourcePlanning.result.warnings' | translate"
              [nzDescription]="allocationWarnings"
            ></nz-alert>
            <ng-template #allocationWarnings>
              <ul class="plain">
                @for (warning of result.warnings; track $index) {
                  <li>{{ warningText(warning) }}</li>
                }
              </ul>
            </ng-template>
          }
        }

        <nz-spin [nzSpinning]="searching()">
          @if (candidates(); as list) {
            @if (list.length === 0) {
              <nz-empty [nzNotFoundContent]="'resourcePlanning.candidates.none' | translate"></nz-empty>
            } @else {
              <h3 class="results-title">{{ 'resourcePlanning.candidates.results' | translate }}</h3>
              <ol class="candidates">
                @for (candidate of list; track candidate.employee_id) {
                  <li class="candidate" [class.ineligible]="!candidate.eligible">
                    <div class="candidate-head">
                      <div>
                        <strong>{{ candidate.employee_name }}</strong>
                        @if (candidate.department_name) {
                          <span class="muted"> · {{ candidate.department_name }}</span>
                        }
                      </div>
                      <nz-tag [nzColor]="candidate.eligible ? 'green' : 'red'">{{
                        (candidate.eligible
                          ? 'resourcePlanning.candidates.eligible'
                          : 'resourcePlanning.candidates.notEligible'
                        ) | translate
                      }}</nz-tag>
                    </div>
                    <div class="score">
                      <span class="muted">{{ 'resourcePlanning.candidates.score' | translate }}</span>
                      <nz-progress
                        [nzPercent]="candidate.score"
                        nzSize="small"
                        [nzStrokeColor]="candidate.eligible ? '#52c41a' : '#faad14'"
                      ></nz-progress>
                    </div>
                    <div class="matched">
                      @for (matched of candidate.matched_skills; track matched.skill_id) {
                        <nz-tag>
                          {{ matched.skill_name }}
                          {{
                            'resourcePlanning.candidates.levelOf'
                              | translate: { level: matched.level, min: matched.min_level }
                          }}
                          @if (matched.certification_status !== 'not_required') {
                            ·
                            {{
                              'resourcePlanning.certification.' + matched.certification_status
                                | translate
                            }}
                          }
                        </nz-tag>
                      }
                    </div>
                    @if (candidate.blockers.length > 0) {
                      <ul class="blockers" role="list">
                        @for (blocker of candidate.blockers; track $index) {
                          <li>
                            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                            {{ blockerText(blocker) }}
                          </li>
                        }
                      </ul>
                    }
                    <dl class="facts">
                      <div>
                        <dt>{{ 'resourcePlanning.candidates.available' | translate }}</dt>
                        <dd>{{ hours(candidate.available_hours) }} / {{ hours(candidate.requested_hours) }}</dd>
                      </div>
                      <div>
                        <dt>{{ 'resourcePlanning.candidates.residual' | translate }}</dt>
                        <dd>{{ hours(candidate.residual_hours_per_day) }}</dd>
                      </div>
                      <div>
                        <dt>{{ 'resourcePlanning.candidates.peakAfter' | translate }}</dt>
                        <dd [class.over]="candidate.peak_load_after_percent > 100">
                          {{ percent(candidate.peak_load_after_percent) }}
                        </dd>
                      </div>
                      <div>
                        <dt>{{ 'resourcePlanning.candidates.hourlyCost' | translate }}</dt>
                        <dd>{{ candidate.hourly_cost.toFixed(2) }}</dd>
                      </div>
                    </dl>
                    <div class="actions">
                      <button
                        nz-button
                        nzType="primary"
                        nzSize="small"
                        type="button"
                        [disabled]="!projectId() || store.saving()"
                        (click)="allocate(candidate, 'HardCommitted')"
                      >
                        {{ 'resourcePlanning.candidates.allocateHard' | translate }}
                      </button>
                      <button
                        nz-button
                        nzSize="small"
                        type="button"
                        [disabled]="!projectId() || store.saving()"
                        (click)="allocate(candidate, 'SoftTentative')"
                      >
                        {{ 'resourcePlanning.candidates.allocateSoft' | translate }}
                      </button>
                    </div>
                  </li>
                }
              </ol>
              @if (!projectId()) {
                <p class="muted">{{ 'resourcePlanning.candidates.pickProject' | translate }}</p>
              }
            }
          }
        </nz-spin>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .requirement {
      display: grid;
      grid-template-columns: 1fr 120px auto;
      gap: 8px;
      margin-bottom: 8px;
    }

    .row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 12px;
    }

    .flags {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 16px;
    }

    .feedback {
      margin: 12px 0;
    }

    .plain,
    .candidates,
    .blockers {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .results-title {
      margin: 16px 0 8px;
    }

    .candidate {
      padding: 12px;
      margin-bottom: 12px;
      border: 1px solid var(--ant-border-color-split, #f0f0f0);
      border-radius: 8px;
    }

    .candidate.ineligible {
      border-color: var(--ant-warning-color, #faad14);
    }

    .candidate-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .muted {
      color: var(--ant-text-color-secondary, #595959);
    }

    .matched {
      margin: 4px 0;
    }

    .blockers {
      color: var(--ant-error-color, #cf1322);
      margin-bottom: 8px;
    }

    .facts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 8px 0;
    }

    .facts dt {
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .facts dd {
      margin: 0;
      font-weight: 600;
    }

    .facts dd.over {
      color: var(--ant-error-color, #cf1322);
    }

    .actions {
      display: flex;
      gap: 8px;
    }
  `,
})
export class CandidateDrawerComponent {
  readonly store = inject(ResourcePlannerStore);
  private readonly api = inject(ResourcePlanningApiService);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  readonly open = model(false);
  readonly levels = PROFICIENCY_LEVELS;

  readonly skills = signal<Skill[]>([]);
  readonly requirements = signal<RequirementRow[]>([{ skill_id: '', min_level: 3 }]);
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly hoursPerDay = signal(4);
  readonly departmentId = signal<string | null>(null);
  readonly projectId = signal<string | null>(null);
  readonly wbsNodeId = signal<string | null>(null);
  readonly requireCertificates = signal(true);
  readonly includeIneligible = signal(false);

  readonly candidates = signal<ResourceCandidate[] | null>(null);
  readonly searching = signal(false);
  readonly searchError = signal<string | null>(null);
  /** The request behind the list on screen: a booking uses its window and hours. */
  private lastSearch: CandidateSearchPayload | null = null;

  readonly canSearch = computed(
    () =>
      this.requirements().some((requirement) => requirement.skill_id !== '') &&
      this.startDate() !== '' &&
      this.endDate() >= this.startDate() &&
      this.hoursPerDay() > 0,
  );

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      untracked(() => {
        if (this.startDate() === '') {
          const { from, to } = this.store.window();
          this.startDate.set(from);
          this.endDate.set(to);
        }
        void this.loadSkills();
      });
    });
  }

  addRequirement(): void {
    this.requirements.update((rows) => [...rows, { skill_id: '', min_level: 3 }]);
  }

  removeRequirement(index: number): void {
    this.requirements.update((rows) =>
      rows.length > 1 ? rows.filter((_, position) => position !== index) : rows,
    );
  }

  setSkill(index: number, skillId: string | null): void {
    this.requirements.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, skill_id: skillId ?? '' } : row)),
    );
  }

  setLevel(index: number, level: number): void {
    this.requirements.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, min_level: level } : row)),
    );
  }

  async search(): Promise<void> {
    if (!this.canSearch()) {
      return;
    }
    const payload = buildCandidateSearch({
      startDate: this.startDate(),
      endDate: this.endDate(),
      hoursPerDay: this.hoursPerDay(),
      requirements: this.requirements(),
      projectId: this.projectId(),
      wbsNodeId: this.wbsNodeId(),
      departmentId: this.departmentId(),
      requireValidCertificates: this.requireCertificates(),
      includeIneligible: this.includeIneligible(),
    });
    this.searching.set(true);
    this.searchError.set(null);
    try {
      const response = await firstValueFrom(this.api.searchCandidates(payload));
      this.lastSearch = payload;
      this.candidates.set(response.data);
    } catch (error) {
      this.searchError.set(problemDetail(error) ?? 'resourcePlanning.candidates.searchError');
    } finally {
      this.searching.set(false);
    }
  }

  /** One-click booking of a candidate on the chosen project and WBS node, hard or soft. */
  async allocate(candidate: ResourceCandidate, bookingType: BookingType): Promise<void> {
    const projectId = this.projectId();
    if (projectId === null || this.lastSearch === null) {
      return;
    }
    const outcome = await this.store.create(
      buildCandidateAllocation(candidate, this.lastSearch, bookingType, projectId, this.wbsNodeId()),
    );
    if (outcome.ok) {
      this.message.success(this.translate.instant('resourcePlanning.created'));
      // The residual availability of everybody changed.
      await this.search();
    } else {
      const first = outcome.issues[0];
      this.message.error(
        first
          ? this.translate.instant(`resourcePlanning.error.${first.code}`, issueParams(first))
          : this.translate.instant(outcome.message ?? 'resourcePlanning.saveError'),
      );
    }
  }

  blockerText(blocker: CandidateBlocker): string {
    return this.translate.instant(blockerKey(blocker.code), issueParams(blocker));
  }

  warningText(warning: { code: string; params?: Record<string, string | number | boolean | null> }): string {
    return this.translate.instant(warningKey(warning.code), issueParams(warning));
  }

  hours(value: number): string {
    return formatHours(value);
  }

  percent(value: number): string {
    return formatPercent(value);
  }

  private async loadSkills(): Promise<void> {
    if (this.skills().length > 0) {
      return;
    }
    const response = await firstValueFrom(this.api.getSkills()).catch(() => null);
    this.skills.set(response?.data ?? []);
  }
}
