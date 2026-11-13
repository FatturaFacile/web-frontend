import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HrTalentApiService, I18nService, OnboardingChecklistRecord } from '@core';
import { IconActionDirective, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../shared/hr-http.util';

/** Candidate data retention, onboarding templates and the onboarding checklists in progress. */
@Component({
  selector: 'app-recruiting-settings',
  styleUrl: './recruiting-settings.component.scss',
  imports: [
    IconActionDirective,
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    @if (canWrite()) {
      <h3>{{ 'hrmRecruiting.retention' | translate }}</h3>
      <div class="filter-bar">
        <div>
          <label for="retention-days">{{ 'hrmRecruiting.retentionDays' | translate }}</label>
          <input nz-input id="retention-days" type="number" min="1" max="3650" [ngModel]="retentionDays()" (ngModelChange)="retentionDays.set($event)" />
        </div>
        <button nz-button nzType="primary" type="button" [disabled]="!retentionValid()" (click)="saveRetention()" appIconAction="save"></button>
      </div>

      <h3>{{ 'hrmRecruiting.newTemplate' | translate }}</h3>
      <div class="mb-4">
        <label for="tpl-name">{{ 'hrmCommon.name' | translate }}</label>
        <input nz-input id="tpl-name" maxlength="120" [ngModel]="templateName()" (ngModelChange)="templateName.set($event)" />
        <label for="tpl-tasks">{{ 'hrmRecruiting.templateTasks' | translate }}</label>
        <textarea nz-input id="tpl-tasks" rows="4" [ngModel]="templateTasks()" (ngModelChange)="templateTasks.set($event)"></textarea>
        <button nz-button type="button" class="mt-2" [disabled]="!templateName().trim() || !templateTasks().trim()" (click)="saveTemplate()" appIconAction="create"></button>
      </div>
    }

    <h3>{{ 'hrmRecruiting.onboarding' | translate }}</h3>
    <nz-table #table [nzData]="checklists()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="small">
      <thead>
        <tr>
          <th>{{ 'hrmCommon.employee' | translate }}</th>
          <th>{{ 'hrmRecruiting.tasks' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (list of table.data; track list.id) {
          <tr>
            <td>{{ list.employee_id.slice(0, 8) }}</td>
            <td>
              <ul class="task-list">
                @for (task of list.tasks ?? []; track task.id) {
                  <li>
                    {{ task.title }}
                    @if (task.due_on) {
                      ({{ task.due_on | date: 'mediumDate' }})
                    }
                    @if (task.completed_at) {
                      <span>- {{ 'hrmCommon.status.completed' | translate }}</span>
                    } @else if (canWrite()) {
                      <button nz-button nzSize="small" type="button" (click)="completeTask(task.id)">
                        {{ 'hrmRecruiting.completeTask' | translate }}
                      </button>
                    }
                  </li>
                }
              </ul>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class RecruitingSettingsComponent implements OnInit {
  readonly canWrite = input(false);

  private readonly api = inject(HrTalentApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly retentionDays = signal<number | null>(null);
  protected readonly retentionValid = computed(() => {
    const days = this.retentionDays();
    return days !== null && Number.isInteger(days) && days >= 1 && days <= 3650;
  });
  protected readonly templateName = signal('');
  protected readonly templateTasks = signal('');
  protected readonly checklists = signal<OnboardingChecklistRecord[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.getOnboardingChecklists().subscribe({
      next: (res) => {
        this.checklists.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }

  protected saveRetention(): void {
    this.api.setRecruitingRetention(this.retentionDays() ?? 0).subscribe({
      next: () => this.message.success(this.i18n.translate('hrmCommon.saved')),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  /** One task per line: `Title` or `Title; days after hire`. */
  protected saveTemplate(): void {
    const tasks = this.templateTasks()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((line) => {
        const [title, days] = line.split(';').map((part) => part.trim());
        return days && /^\d+$/.test(days) ? { title, due_after_days: Number(days) } : { title };
      });
    this.api.createOnboardingTemplate({ name: this.templateName().trim(), tasks }).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('hrmCommon.saved'));
        this.templateName.set('');
        this.templateTasks.set('');
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected completeTask(id: string): void {
    this.api.completeOnboardingTask(id).subscribe({
      next: () => this.reload(),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
