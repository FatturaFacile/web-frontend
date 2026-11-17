import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { form, FormField, required } from '@angular/forms/signals';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ApplicationStage,
  EMAIL_TEMPLATE_PLACEHOLDERS,
  EmailTemplate,
  I18nService,
  RECRUITING_LOCALES,
  RECRUITING_STAGES,
  RecruitingApiService,
  RecruitingLocale,
} from '@core';
import { TranslatePipe } from '@shared';
import { fieldErrors, recruitingErrorKey } from '../shared/recruiting-errors';
import { stageLabelKey } from '../shared/recruiting-labels';

interface TemplateModel {
  subject: string;
  body: string;
  is_enabled: boolean;
}

/** Replaces the supported `{{placeholder}}` tokens with sample values. */
export function renderTemplatePreview(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
}

/** Stage x locale email template editor with placeholder chips and preview. */
@Component({
  selector: 'app-email-templates-editor',
  imports: [
    FormsModule,
    FormField,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (loadError()) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="'hr.recruiting.errors.loadTemplates' | translate"
      />
    }
    <div class="selectors">
      <nz-select
        class="selectors__item"
        [ngModel]="stage()"
        (ngModelChange)="select($event, locale())"
        [attr.aria-label]="'hr.recruiting.settings.stage' | translate"
      >
        @for (s of stages; track s) {
          <nz-option [nzValue]="s" [nzLabel]="stageLabel(s) | translate" />
        }
      </nz-select>
      <nz-select
        class="selectors__item"
        [ngModel]="locale()"
        (ngModelChange)="select(stage(), $event)"
        [attr.aria-label]="'hr.recruiting.settings.locale' | translate"
      >
        @for (l of locales; track l) {
          <nz-option [nzValue]="l" [nzLabel]="'hr.recruiting.locales.' + l | translate" />
        }
      </nz-select>
      @if (current()?.is_default) {
        <nz-tag>{{ 'hr.recruiting.settings.defaultTemplate' | translate }}</nz-tag>
      }
    </div>

    <form nz-form nzLayout="vertical" (submit)="$event.preventDefault(); save()">
      <nz-form-item>
        <span class="switch-label">
          <nz-switch nzId="template-enabled" [formField]="templateForm.is_enabled" />
          <label for="template-enabled">{{
            'hr.recruiting.settings.templateEnabled' | translate
          }}</label>
        </span>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label nzFor="template-subject" nzRequired>{{
          'hr.recruiting.settings.subject' | translate
        }}</nz-form-label>
        <nz-form-control
          [nzValidateStatus]="subjectError() ? 'error' : ''"
          [nzErrorTip]="subjectError()"
        >
          <input id="template-subject" nz-input [formField]="templateForm.subject" />
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label nzFor="template-body" nzRequired>{{
          'hr.recruiting.settings.body' | translate
        }}</nz-form-label>
        <nz-form-control [nzValidateStatus]="bodyError() ? 'error' : ''" [nzErrorTip]="bodyError()">
          <textarea
            #bodyArea
            id="template-body"
            nz-input
            rows="8"
            [formField]="templateForm.body"
          ></textarea>
        </nz-form-control>
      </nz-form-item>
      <div
        class="placeholders"
        role="group"
        [attr.aria-label]="'hr.recruiting.settings.placeholders' | translate"
      >
        <span>{{ 'hr.recruiting.settings.placeholders' | translate }}:</span>
        @for (p of placeholders; track p) {
          <button nz-button nzSize="small" type="button" (click)="insertPlaceholder(p)">
            {{ p }}
          </button>
        }
      </div>

      <section class="preview" [attr.aria-label]="'hr.recruiting.settings.preview' | translate">
        <h4>{{ 'hr.recruiting.settings.preview' | translate }}</h4>
        <p>
          <strong>{{ previewSubject() }}</strong>
        </p>
        <p class="preview__body">{{ previewBody() }}</p>
      </section>

      <button nz-button nzType="primary" type="submit" [nzLoading]="saving()">
        {{ 'hr.recruiting.settings.saveTemplate' | translate }}
      </button>
    </form>
  `,
  styles: `
    .selectors {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
    }
    .selectors__item {
      min-width: 200px;
    }
    .switch-label {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }
    .placeholders {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      margin-bottom: 16px;
    }
    .preview {
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .preview__body {
      white-space: pre-line;
    }
  `,
})
export class EmailTemplatesEditorComponent implements OnInit {
  private readonly api = inject(RecruitingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly companyName = input('');

  readonly stages = RECRUITING_STAGES;
  readonly locales = RECRUITING_LOCALES;
  readonly placeholders = EMAIL_TEMPLATE_PLACEHOLDERS;
  readonly stageLabel = stageLabelKey;

  readonly templates = signal<EmailTemplate[]>([]);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly serverErrors = signal<Record<string, string>>({});
  readonly stage = signal<ApplicationStage>('applied');
  readonly locale = signal<RecruitingLocale>('it-CH');

  readonly model = signal<TemplateModel>({ subject: '', body: '', is_enabled: true });
  readonly templateForm = form(this.model, (p) => {
    required(p.subject);
    required(p.body);
  });

  private readonly bodyArea = viewChild<ElementRef<HTMLTextAreaElement>>('bodyArea');

  readonly current = computed(
    () =>
      this.templates().find((t) => t.stage === this.stage() && t.locale === this.locale()) ?? null,
  );

  private readonly sampleValues = computed<Record<string, string>>(() => ({
    candidate_name: this.i18n.translate('hr.recruiting.settings.sampleCandidate'),
    job_title: this.i18n.translate('hr.recruiting.settings.sampleJob'),
    company_name: this.companyName() || this.i18n.translate('hr.recruiting.settings.sampleCompany'),
    stage_label: this.i18n.translate(stageLabelKey(this.stage())),
  }));

  readonly previewSubject = computed(() =>
    renderTemplatePreview(this.model().subject, this.sampleValues()),
  );
  readonly previewBody = computed(() =>
    renderTemplatePreview(this.model().body, this.sampleValues()),
  );

  ngOnInit(): void {
    this.api.listEmailTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.data);
        this.select(this.stage(), this.locale());
      },
      error: () => this.loadError.set(true),
    });
  }

  select(stage: ApplicationStage, locale: RecruitingLocale): void {
    this.stage.set(stage);
    this.locale.set(locale);
    const t = this.current();
    this.model.set({
      subject: t?.subject ?? '',
      body: t?.body ?? '',
      is_enabled: t?.is_enabled ?? true,
    });
    this.submitted.set(false);
    this.serverErrors.set({});
  }

  subjectError(): string {
    if (this.submitted() && this.templateForm.subject().invalid()) {
      return this.i18n.translate('hr.recruiting.validation.required');
    }
    return this.serverErrors()['subject'] ?? '';
  }

  bodyError(): string {
    if (this.submitted() && this.templateForm.body().invalid()) {
      return this.i18n.translate('hr.recruiting.validation.required');
    }
    return this.serverErrors()['body'] ?? '';
  }

  /** Inserts a placeholder at the caret of the body textarea (or appends it). */
  insertPlaceholder(token: string): void {
    const area = this.bodyArea()?.nativeElement;
    const body = this.model().body;
    const start = area?.selectionStart ?? body.length;
    const end = area?.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    this.model.update((m) => ({ ...m, body: next }));
    if (area) {
      const caret = start + token.length;
      queueMicrotask(() => {
        area.focus();
        area.setSelectionRange(caret, caret);
      });
    }
  }

  save(): void {
    this.submitted.set(true);
    if (this.templateForm().invalid() || this.saving()) {
      return;
    }
    const stage = this.stage();
    const locale = this.locale();
    this.saving.set(true);
    this.serverErrors.set({});
    this.api.updateEmailTemplate(stage, locale, this.model()).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.templates.update((list) => [
          ...list.filter((t) => !(t.stage === stage && t.locale === locale)),
          res.data,
        ]);
        this.message.success(this.i18n.translate('hr.recruiting.settings.templateSaved'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.serverErrors.set(fieldErrors(err));
        this.message.error(this.i18n.translate(recruitingErrorKey(err)));
      },
    });
  }
}
