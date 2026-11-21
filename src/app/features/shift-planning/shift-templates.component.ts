import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ShiftPlanningApiService,
  ShiftTemplate,
  ShiftTemplatePayload,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { problemDetail, templateLabel } from './shift-planning.util';

/** The reusable shift templates (morning, afternoon, night, on call) with a name in the four languages. */
@Component({
  selector: 'app-shift-templates',
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'SHIFT_PLANNING.TEMPLATES_TITLE' | translate"
      [subtitle]="'SHIFT_PLANNING.TEMPLATES_SUBTITLE' | translate"
    >
      <button nz-button nzType="primary" (click)="openForm(null)">
        {{ 'SHIFT_PLANNING.NEW_TEMPLATE' | translate }}
      </button>
    </app-page-header>

    <nz-card>
      <nz-table
        #table
        [nzData]="templates()"
        [nzLoading]="loading()"
        nzSize="small"
        [nzShowPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'SHIFT_PLANNING.CODE' | translate }}</th>
            <th>{{ 'SHIFT_PLANNING.NAME' | translate }}</th>
            <th>{{ 'SHIFT_PLANNING.TIME' | translate }}</th>
            <th>{{ 'SHIFT_PLANNING.BREAK' | translate }}</th>
            <th>{{ 'SHIFT_PLANNING.FLAGS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>
                <nz-tag [style.border-left]="'4px solid ' + row.color_hex">{{ row.code }}</nz-tag>
              </td>
              <td>{{ label(row) }}</td>
              <td>{{ row.start_time }}-{{ row.end_time }}</td>
              <td>{{ row.break_minutes }} min</td>
              <td>
                @if (row.night_surcharge_applicable) {
                  <nz-tag>{{ 'SHIFT_PLANNING.TAG_NIGHT' | translate }}</nz-tag>
                }
                @if (row.is_on_call) {
                  <nz-tag>{{ 'SHIFT_PLANNING.TAG_ON_CALL' | translate }}</nz-tag>
                }
                @if (!row.is_active) {
                  <nz-tag nzColor="default">{{ 'SHIFT_PLANNING.INACTIVE' | translate }}</nz-tag>
                }
              </td>
              <td>
                <button nz-button nzSize="small" (click)="openForm(row)">
                  {{ 'SHIFT_PLANNING.EDIT' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="formOpen()"
      [nzTitle]="'SHIFT_PLANNING.TEMPLATES_TITLE' | translate"
      [nzOkDisabled]="form.invalid"
      (nzOnCancel)="formOpen.set(false)"
      (nzOnOk)="save()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="tpl-code">{{
              'SHIFT_PLANNING.CODE' | translate
            }}</nz-form-label>
            <nz-form-control
              ><input nz-input id="tpl-code" maxlength="32" formControlName="code"
            /></nz-form-control>
          </nz-form-item>
          <div class="grid" formGroupName="name">
            @for (lang of languages; track lang) {
              <nz-form-item>
                <nz-form-label nzRequired [nzFor]="'tpl-name-' + lang"
                  >{{ 'SHIFT_PLANNING.NAME' | translate }} ({{ lang.toUpperCase() }})</nz-form-label
                >
                <nz-form-control
                  ><input
                    nz-input
                    [id]="'tpl-name-' + lang"
                    maxlength="120"
                    [formControlName]="lang"
                /></nz-form-control>
              </nz-form-item>
            }
          </div>
          <div class="grid">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="tpl-start">{{
                'SHIFT_PLANNING.START_TIME' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="tpl-start" type="time" formControlName="start_time"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="tpl-end">{{
                'SHIFT_PLANNING.END_TIME' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="tpl-end" type="time" formControlName="end_time"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="tpl-break"
                >{{ 'SHIFT_PLANNING.BREAK' | translate }} (min)</nz-form-label
              >
              <nz-form-control
                ><input
                  nz-input
                  id="tpl-break"
                  type="number"
                  min="0"
                  max="240"
                  formControlName="break_minutes"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="tpl-color">{{
                'SHIFT_PLANNING.COLOR' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="tpl-color" type="color" formControlName="color_hex"
              /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-control>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label class="switch-row"
                ><nz-switch formControlName="night_surcharge_applicable"></nz-switch>
                {{ 'SHIFT_PLANNING.NIGHT_SURCHARGE' | translate }}</label
              >
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label class="switch-row"
                ><nz-switch formControlName="is_on_call"></nz-switch>
                {{ 'SHIFT_PLANNING.TAG_ON_CALL' | translate }}</label
              >
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label class="switch-row"
                ><nz-switch formControlName="is_active"></nz-switch>
                {{ 'SHIFT_PLANNING.ACTIVE' | translate }}</label
              >
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .switch-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
  `,
})
export class ShiftTemplatesComponent implements OnInit {
  private readonly api = inject(ShiftPlanningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly languages = ['it', 'de', 'fr', 'en'] as const;
  readonly templates = signal<ShiftTemplate[]>([]);
  readonly loading = signal(false);
  readonly formOpen = signal(false);
  private editing: ShiftTemplate | null = null;

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(32)]],
    name: this.fb.group({
      it: ['', [Validators.required]],
      de: ['', [Validators.required]],
      fr: ['', [Validators.required]],
      en: ['', [Validators.required]],
    }),
    start_time: ['06:00', [Validators.required]],
    end_time: ['14:00', [Validators.required]],
    break_minutes: [0, [Validators.min(0), Validators.max(240)]],
    color_hex: ['#1890ff'],
    night_surcharge_applicable: [true],
    is_on_call: [false],
    is_active: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  label(template: ShiftTemplate): string {
    return templateLabel(template.name, this.translate.currentLanguage());
  }

  load(): void {
    this.loading.set(true);
    this.api.getTemplates().subscribe({
      next: (response) => {
        this.templates.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('SHIFT_PLANNING.LOAD_ERROR'));
      },
    });
  }

  openForm(template: ShiftTemplate | null): void {
    this.editing = template;
    this.form.reset(
      template
        ? {
            code: template.code,
            name: {
              it: template.name['it'] ?? '',
              de: template.name['de'] ?? '',
              fr: template.name['fr'] ?? '',
              en: template.name['en'] ?? '',
            },
            start_time: template.start_time,
            end_time: template.end_time,
            break_minutes: template.break_minutes,
            color_hex: template.color_hex.toLowerCase(),
            night_surcharge_applicable: template.night_surcharge_applicable,
            is_on_call: template.is_on_call,
            is_active: template.is_active,
          }
        : undefined,
    );
    this.formOpen.set(true);
  }

  save(): void {
    const payload: ShiftTemplatePayload = this.form.getRawValue();
    const call = this.editing
      ? this.api.updateTemplate(this.editing.id, payload)
      : this.api.createTemplate(payload);

    call.subscribe({
      next: () => {
        this.message.success(this.translate.instant('SHIFT_PLANNING.TEMPLATE_SAVED'));
        this.formOpen.set(false);
        this.load();
      },
      error: (error: unknown) =>
        this.message.error(
          problemDetail(error) ?? this.translate.instant('SHIFT_PLANNING.SAVE_ERROR'),
        ),
    });
  }
}
