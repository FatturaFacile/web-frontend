import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  EmployeeSkillProfile,
  PROFICIENCY_LEVELS,
  Skill,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { MatrixCell, MatrixEmployeeRow, SkillMatrixStore, SkillOutcome } from './skill-matrix.store';
import {
  certificationColor,
  errorKey,
  issueParams,
  levelColor,
  skillPayload,
} from './resource-planning.util';

interface ProfileDraft {
  employeeId: string;
  employeeName: string;
  skill: Skill;
  profile: EmployeeSkillProfile | null;
}

/**
 * Skill management (Mod 079): the matrix of employees by skills with the proficiency (1 to 5), the validity and the
 * certificate status of each cell, and the CRUD of the skill taxonomy behind it.
 */
@Component({
  selector: 'app-skill-matrix',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTooltipModule,
  ],
  providers: [SkillMatrixStore],
  template: `
    <app-page-header
      [title]="'resourcePlanning.skills.title' | translate"
      [subtitle]="'resourcePlanning.skills.subtitle' | translate"
    >
      <button nz-button nzType="primary" (click)="openSkill(null)">
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        {{ 'resourcePlanning.skills.add' | translate }}
      </button>
    </app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (store.attentionCount() > 0) {
      <nz-alert
        class="feedback"
        nzType="warning"
        nzShowIcon
        [nzMessage]="
          'resourcePlanning.skills.attention' | translate: { count: store.attentionCount() }
        "
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading() || store.saving()">
      <nz-tabs>
        <nz-tab [nzTitle]="'resourcePlanning.skills.matrix' | translate">
          <div class="toolbar">
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label class="field">
              <span>{{ 'resourcePlanning.skills.category' | translate }}</span>
              <nz-select
                nzAllowClear
                class="category"
                [nzPlaceHolder]="'resourcePlanning.skills.allCategories' | translate"
                [ngModel]="store.category()"
                (ngModelChange)="store.setCategory($event ?? null)"
              >
                @for (category of store.categories(); track category) {
                  <nz-option [nzValue]="category" [nzLabel]="category"></nz-option>
                }
              </nz-select>
            </label>
            <span class="muted">{{ 'resourcePlanning.skills.legend' | translate }}</span>
          </div>

          @if (store.visibleSkills().length === 0 || store.matrix().length === 0) {
            <nz-empty [nzNotFoundContent]="'resourcePlanning.skills.emptyMatrix' | translate"></nz-empty>
          } @else {
            <div class="table-wrap">
              <table class="matrix">
                <thead>
                  <tr>
                    <th class="row-head" scope="col">
                      {{ 'resourcePlanning.skills.employee' | translate }}
                    </th>
                    @for (skill of store.visibleSkills(); track skill.id) {
                      <th scope="col" class="skill-head">
                        <span class="muted">{{ skill.category }}</span>
                        <span>{{ skill.skill_name }}</span>
                        @if (skill.requires_certification) {
                          <i
                            class="fa-solid fa-certificate"
                            aria-hidden="true"
                            nz-tooltip
                            [nzTooltipTitle]="skill.certification_code"
                          ></i>
                        }
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of store.matrix(); track row.employeeId) {
                    <tr>
                      <th class="row-head" scope="row">{{ row.employeeName }}</th>
                      @for (cell of row.cells; track cell.skill.id) {
                        <td>
                          <button
                            type="button"
                            class="cell"
                            [class.cell-empty]="cell.profile === null"
                            [class.cell-invalid]="cell.profile !== null && !cell.profile.is_valid"
                            nz-tooltip
                            [nzTooltipTitle]="cellTip"
                            [nzTooltipTitleContext]="{ $implicit: cell }"
                            [attr.aria-label]="cellLabel(row, cell)"
                            (click)="openProfile(row, cell)"
                          >
                            @if (cell.profile; as profile) {
                              <nz-tag [nzColor]="levelColor(profile.proficiency_level)">{{
                                profile.proficiency_level
                              }}</nz-tag>
                              @if (profile.requires_certification) {
                                <i
                                  class="fa-solid fa-certificate cert cert-{{ profile.certification_status }}"
                                  aria-hidden="true"
                                ></i>
                              }
                              @if (!profile.is_valid) {
                                <i class="fa-solid fa-clock-rotate-left expired" aria-hidden="true"></i>
                              }
                            } @else {
                              <span aria-hidden="true">+</span>
                            }
                          </button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'resourcePlanning.skills.taxonomy' | translate">
          <nz-table
            #table
            nzSize="small"
            [nzData]="store.skills()"
            [nzFrontPagination]="false"
            [nzShowPagination]="false"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'resourcePlanning.skills.category' | translate }}</th>
                <th scope="col">{{ 'resourcePlanning.skills.name' | translate }}</th>
                <th scope="col">{{ 'resourcePlanning.skills.certification' | translate }}</th>
                <th scope="col"><span class="sr-only">{{ 'resourcePlanning.skills.actions' | translate }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (skill of table.data; track skill.id) {
                <tr>
                  <td>{{ skill.category }}</td>
                  <th scope="row">{{ skill.skill_name }}</th>
                  <td>
                    @if (skill.requires_certification) {
                      <nz-tag nzColor="blue">{{ skill.certification_code }}</nz-tag>
                    } @else {
                      <span class="muted">{{ 'resourcePlanning.certification.not_required' | translate }}</span>
                    }
                  </td>
                  <td class="actions">
                    <button nz-button nzSize="small" (click)="openSkill(skill)">
                      {{ 'resourcePlanning.skills.edit' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      nz-popconfirm
                      [nzPopconfirmTitle]="'resourcePlanning.skills.deleteConfirm' | translate"
                      (nzOnConfirm)="deleteSkill(skill)"
                    >
                      {{ 'resourcePlanning.skills.delete' | translate }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-spin>

    <ng-template #cellTip let-cell>
      @if (cell.profile; as profile) {
        <div>{{ profile.skill_name }}: {{ 'resourcePlanning.skills.levelOption' | translate: { level: profile.proficiency_level } }}</div>
        <div>
          {{
            profile.valid_until_date
              ? ('resourcePlanning.skills.validUntilOn' | translate: { date: profile.valid_until_date })
              : ('resourcePlanning.skills.noExpiry' | translate)
          }}
        </div>
        @if (profile.requires_certification) {
          <div>
            {{ profile.certification_code }}:
            {{ 'resourcePlanning.certification.' + profile.certification_status | translate }}
          </div>
        }
      } @else {
        <div>{{ 'resourcePlanning.skills.noProfile' | translate }}</div>
      }
    </ng-template>

    <nz-modal
      [nzVisible]="skillDialog() !== null"
      [nzTitle]="
        (skillDialog()?.id ? 'resourcePlanning.skills.editTitle' : 'resourcePlanning.skills.addTitle')
          | translate
      "
      [nzOkDisabled]="skillInput() === null"
      [nzOkLoading]="store.saving()"
      (nzOnCancel)="skillDialog.set(null)"
      (nzOnOk)="saveSkill()"
    >
      <ng-container *nzModalContent>
        <nz-form-item>
          <nz-form-label nzRequired nzFor="rp-skill-category">{{
            'resourcePlanning.skills.category' | translate
          }}</nz-form-label>
          <nz-form-control
            ><input
              nz-input
              id="rp-skill-category"
              [ngModel]="skillCategory()"
              (ngModelChange)="skillCategory.set($event)"
          /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired nzFor="rp-skill-name">{{
            'resourcePlanning.skills.name' | translate
          }}</nz-form-label>
          <nz-form-control
            ><input
              nz-input
              id="rp-skill-name"
              [ngModel]="skillName()"
              (ngModelChange)="skillName.set($event)"
          /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-control>
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label
              nz-checkbox
              [ngModel]="skillRequiresCertification()"
              (ngModelChange)="skillRequiresCertification.set($event)"
              >{{ 'resourcePlanning.skills.requiresCertification' | translate }}</label
            >
          </nz-form-control>
        </nz-form-item>
        @if (skillRequiresCertification()) {
          <nz-form-item>
            <nz-form-label nzRequired nzFor="rp-skill-code">{{
              'resourcePlanning.skills.certificationCode' | translate
            }}</nz-form-label>
            <nz-form-control
              ><input
                nz-input
                id="rp-skill-code"
                [ngModel]="skillCode()"
                (ngModelChange)="skillCode.set($event)"
            /></nz-form-control>
          </nz-form-item>
        }
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="profileDraft() !== null"
      [nzTitle]="'resourcePlanning.skills.profileTitle' | translate"
      [nzOkLoading]="store.saving()"
      (nzOnCancel)="profileDraft.set(null)"
      (nzOnOk)="saveProfile()"
    >
      <ng-container *nzModalContent>
        @if (profileDraft(); as draft) {
          <p>
            <strong>{{ draft.employeeName }}</strong> · {{ draft.skill.category }} /
            {{ draft.skill.skill_name }}
          </p>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="rp-profile-level">{{
              'resourcePlanning.skills.level' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select
                nzId="rp-profile-level"
                [ngModel]="profileLevel()"
                (ngModelChange)="profileLevel.set($event)"
              >
                @for (level of levels; track level) {
                  <nz-option
                    [nzValue]="level"
                    [nzLabel]="'resourcePlanning.skills.levelOption' | translate: { level }"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="rp-profile-valid">{{
              'resourcePlanning.skills.validUntil' | translate
            }}</nz-form-label>
            <nz-form-control
              ><input
                nz-input
                id="rp-profile-valid"
                type="date"
                [ngModel]="profileValidUntil()"
                (ngModelChange)="profileValidUntil.set($event)"
            /></nz-form-control>
          </nz-form-item>
          @if (draft.profile; as profile) {
            @if (profile.requires_certification) {
              <p>
                <nz-tag [nzColor]="certificationColor(profile.certification_status)">{{
                  'resourcePlanning.certification.' + profile.certification_status | translate
                }}</nz-tag>
                @if (profile.certification_valid_until) {
                  <span class="muted">{{
                    'resourcePlanning.skills.validUntilOn'
                      | translate: { date: profile.certification_valid_until }
                  }}</span>
                }
              </p>
            }
            <button
              nz-button
              nzDanger
              nz-popconfirm
              [nzPopconfirmTitle]="'resourcePlanning.skills.removeProfileConfirm' | translate"
              (nzOnConfirm)="removeProfile(profile)"
            >
              {{ 'resourcePlanning.skills.removeProfile' | translate }}
            </button>
          }
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .feedback {
      margin-bottom: 12px;
    }

    .toolbar {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 12px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .category {
      min-width: 220px;
    }

    .muted {
      color: var(--ant-text-color-secondary, #595959);
    }

    .table-wrap {
      overflow-x: auto;
    }

    .matrix {
      border-collapse: collapse;
    }

    .matrix th,
    .matrix td {
      border: 1px solid var(--ant-border-color-split, #f0f0f0);
      padding: 4px 8px;
      text-align: center;
    }

    .row-head {
      text-align: left !important;
      min-width: 180px;
      position: sticky;
      left: 0;
      background: var(--ant-component-background, #fff);
    }

    .skill-head {
      min-width: 110px;
      font-size: 12px;
      vertical-align: bottom;
    }

    .skill-head span {
      display: block;
    }

    .cell {
      min-width: 56px;
      min-height: 32px;
      border: 0;
      background: transparent;
      cursor: pointer;
      border-radius: 4px;
    }

    .cell:hover,
    .cell:focus-visible {
      background: var(--ant-primary-1, #e6f4ff);
      outline: 2px solid var(--ant-primary-color, #1677ff);
    }

    .cell-empty {
      color: var(--ant-text-color-secondary, #8c8c8c);
    }

    .cell-invalid {
      opacity: 0.7;
    }

    .cert-valid {
      color: #389e0d;
    }

    .cert-missing,
    .cert-expired,
    .expired {
      color: #cf1322;
    }

    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
})
export class SkillMatrixComponent implements OnInit {
  readonly store = inject(SkillMatrixStore);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  readonly levels = PROFICIENCY_LEVELS;
  readonly levelColor = levelColor;
  readonly certificationColor = certificationColor;

  // Taxonomy dialog: `id` is null for a new skill.
  readonly skillDialog = signal<{ id: string | null } | null>(null);
  readonly skillCategory = signal('');
  readonly skillName = signal('');
  readonly skillRequiresCertification = signal(false);
  readonly skillCode = signal('');
  readonly skillInput = computed(() =>
    skillPayload({
      category: this.skillCategory(),
      skillName: this.skillName(),
      requiresCertification: this.skillRequiresCertification(),
      certificationCode: this.skillCode(),
    }),
  );

  // Profile dialog of one matrix cell.
  readonly profileDraft = signal<ProfileDraft | null>(null);
  readonly profileLevel = signal(3);
  readonly profileValidUntil = signal('');

  ngOnInit(): void {
    void this.store.init();
  }

  openSkill(skill: Skill | null): void {
    this.skillCategory.set(skill?.category ?? '');
    this.skillName.set(skill?.skill_name ?? '');
    this.skillRequiresCertification.set(skill?.requires_certification ?? false);
    this.skillCode.set(skill?.certification_code ?? '');
    this.skillDialog.set({ id: skill?.id ?? null });
  }

  async saveSkill(): Promise<void> {
    const dialog = this.skillDialog();
    const payload = this.skillInput();
    if (dialog === null || payload === null) {
      return;
    }
    const outcome = await this.store.saveSkill(dialog.id, payload);
    if (outcome.ok) {
      this.skillDialog.set(null);
    }
    this.report(outcome, 'resourcePlanning.skills.saved');
  }

  async deleteSkill(skill: Skill): Promise<void> {
    this.report(await this.store.deleteSkill(skill), 'resourcePlanning.skills.deleted');
  }

  openProfile(row: MatrixEmployeeRow, cell: MatrixCell): void {
    this.profileLevel.set(cell.profile?.proficiency_level ?? 3);
    this.profileValidUntil.set(cell.profile?.valid_until_date ?? '');
    this.profileDraft.set({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      skill: cell.skill,
      profile: cell.profile,
    });
  }

  async saveProfile(): Promise<void> {
    const draft = this.profileDraft();
    if (draft === null) {
      return;
    }
    const validUntil = this.profileValidUntil();
    const outcome = await this.store.saveProfile({
      employee_id: draft.employeeId,
      skill_id: draft.skill.id,
      proficiency_level: this.profileLevel(),
      valid_until_date: validUntil === '' ? null : validUntil,
    });
    if (outcome.ok) {
      this.profileDraft.set(null);
    }
    this.report(outcome, 'resourcePlanning.skills.profileSaved');
  }

  async removeProfile(profile: EmployeeSkillProfile): Promise<void> {
    const outcome = await this.store.deleteProfile(profile);
    if (outcome.ok) {
      this.profileDraft.set(null);
    }
    this.report(outcome, 'resourcePlanning.skills.profileDeleted');
  }

  cellLabel(row: MatrixEmployeeRow, cell: MatrixCell): string {
    const level = cell.profile
      ? this.translate.instant('resourcePlanning.skills.levelOption', {
          level: cell.profile.proficiency_level,
        })
      : this.translate.instant('resourcePlanning.skills.noProfile');
    return `${row.employeeName}, ${cell.skill.skill_name}: ${level}`;
  }

  private report(outcome: SkillOutcome, successKey: string): void {
    if (outcome.ok) {
      this.message.success(this.translate.instant(successKey));
      return;
    }
    const first = outcome.issues[0];
    this.message.error(
      first
        ? this.translate.instant(errorKey(first.code), issueParams(first))
        : this.translate.instant(outcome.message ?? 'resourcePlanning.saveError'),
    );
  }
}
