import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, pattern } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import {
  ApplicationStage,
  CAREERS_SLUG_PATTERN,
  I18nService,
  LocalizedMap,
  MANDATORY_STAGES,
  PublicCareersApiService,
  RECRUITING_LOCALES,
  RETENTION_MONTHS,
  RecruitingApiService,
  RecruitingLocale,
  RecruitingSettings,
  RetentionMonths,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { fieldErrors, recruitingErrorKey } from '../shared/recruiting-errors';
import { stageLabelKey } from '../shared/recruiting-labels';
import { EmailTemplatesEditorComponent } from './email-templates-editor.component';

type LocaleTexts = Record<RecruitingLocale, string>;

interface StageModel {
  stage: ApplicationStage;
  enabled: boolean;
  auto_email: boolean;
  labels: LocaleTexts;
}

export interface SettingsFormModel {
  enabled: boolean;
  slug: string;
  company_name: string;
  intro: LocaleTexts;
  privacy_notice: LocaleTexts;
  privacy_policy_url: string;
  consent_text_version: string;
  retention_months: RetentionMonths;
  stages: StageModel[];
}

const toTexts = (map: LocalizedMap<string> | undefined): LocaleTexts =>
  RECRUITING_LOCALES.reduce((acc, l) => {
    acc[l] = map?.[l] ?? '';
    return acc;
  }, {} as LocaleTexts);

const fromTexts = (texts: LocaleTexts): LocalizedMap<string> => {
  const map: LocalizedMap<string> = {};
  for (const l of RECRUITING_LOCALES) {
    if (texts[l].trim()) {
      map[l] = texts[l];
    }
  }
  return map;
};

export function settingsToModel(s: RecruitingSettings): SettingsFormModel {
  return {
    enabled: s.careers.enabled,
    slug: s.careers.slug ?? '',
    company_name: s.careers.company_name ?? '',
    intro: toTexts(s.careers.intro),
    privacy_notice: toTexts(s.careers.privacy_notice),
    privacy_policy_url: s.careers.privacy_policy_url ?? '',
    consent_text_version: s.careers.consent_text_version ?? '',
    retention_months: s.retention.default_months,
    stages: s.pipeline.stages.map((st) => ({
      stage: st.stage,
      enabled: st.enabled,
      auto_email: st.auto_email,
      labels: toTexts(st.labels),
    })),
  };
}

export function modelToSettings(m: SettingsFormModel): RecruitingSettings {
  return {
    careers: {
      enabled: m.enabled,
      slug: m.slug.trim() || null,
      company_name: m.company_name.trim(),
      intro: fromTexts(m.intro),
      privacy_notice: fromTexts(m.privacy_notice),
      privacy_policy_url: m.privacy_policy_url.trim() || null,
      consent_text_version: m.consent_text_version.trim(),
    },
    retention: { default_months: m.retention_months },
    pipeline: {
      stages: m.stages.map((st) => ({
        stage: st.stage,
        enabled: MANDATORY_STAGES.includes(st.stage) ? true : st.enabled,
        auto_email: st.auto_email,
        labels: fromTexts(st.labels),
      })),
    },
  };
}

const EMPTY_MODEL: SettingsFormModel = {
  enabled: false,
  slug: '',
  company_name: '',
  intro: toTexts(undefined),
  privacy_notice: toTexts(undefined),
  privacy_policy_url: '',
  consent_text_version: '',
  retention_months: 6,
  stages: [],
};

@Component({
  selector: 'app-recruiting-settings',
  imports: [
    FormField,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    EmailTemplatesEditorComponent,
  ],
  templateUrl: './recruiting-settings.component.html',
  styleUrl: './recruiting-settings.component.scss',
})
export class RecruitingSettingsComponent implements OnInit {
  private readonly api = inject(RecruitingApiService);
  private readonly publicApi = inject(PublicCareersApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly clipboard = inject(Clipboard);
  private readonly document = inject(DOCUMENT);

  readonly locales = RECRUITING_LOCALES;
  readonly retentionOptions = RETENTION_MONTHS;
  readonly mandatory = MANDATORY_STAGES;
  readonly stageLabel = stageLabelKey;

  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly serverErrors = signal<Record<string, string>>({});
  /** Slug as last saved on the server (embed snippet and feeds use the saved value). */
  readonly savedSlug = signal<string | null>(null);

  readonly model = signal<SettingsFormModel>({ ...EMPTY_MODEL });
  readonly settingsForm = form(this.model, (p) => {
    pattern(p.slug, CAREERS_SLUG_PATTERN);
    minLength(p.slug, 3);
    maxLength(p.slug, 60);
  });

  readonly careersUrl = computed(() => {
    const slug = this.savedSlug();
    return slug ? `${this.origin()}/careers/${slug}` : null;
  });
  readonly embedSnippet = computed(() => {
    const url = this.careersUrl();
    return url
      ? `<iframe src="${url}?embed=1" title="Careers" width="100%" height="800" style="border:0" loading="lazy"></iframe>`
      : null;
  });
  readonly feedJsonUrl = computed(() => {
    const slug = this.savedSlug();
    return slug ? this.publicApi.feedJsonUrl(slug) : null;
  });
  readonly feedRssUrl = computed(() => {
    const slug = this.savedSlug();
    return slug ? this.publicApi.feedRssUrl(slug) : null;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.getSettings().subscribe({
      next: (res) => {
        this.apply(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  slugError(): string {
    if (this.submitted() && this.settingsForm.slug().invalid()) {
      return this.i18n.translate('hr.recruiting.settings.slugInvalid');
    }
    return this.serverErrors()['careers.slug'] ?? '';
  }

  isMandatory(stage: ApplicationStage): boolean {
    return this.mandatory.includes(stage);
  }

  save(): void {
    this.submitted.set(true);
    if (this.settingsForm().invalid()) {
      return;
    }
    this.saving.set(true);
    this.serverErrors.set({});
    this.api.updateSettings(modelToSettings(this.model())).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.submitted.set(false);
        this.apply(res.data);
        this.message.success(this.i18n.translate('hr.recruiting.settings.saved'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.serverErrors.set(fieldErrors(err));
        this.message.error(this.i18n.translate(recruitingErrorKey(err)));
      },
    });
  }

  copy(text: string | null): void {
    if (text && this.clipboard.copy(text)) {
      this.message.success(this.i18n.translate('hr.recruiting.settings.copied'));
    }
  }

  private apply(settings: RecruitingSettings): void {
    this.model.set(settingsToModel(settings));
    this.savedSlug.set(settings.careers.slug);
  }

  private origin(): string {
    return this.document.location?.origin ?? '';
  }
}
