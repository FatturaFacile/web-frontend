import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ATS_LOCALES,
  ATS_STAGES,
  AtsEmailTemplate,
  AtsLocale,
  AtsPipelineStageSetting,
  AtsSettings,
  AtsSettingsPayload,
  HrExtraApiService,
  I18nService,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { reportHttpError } from '../shared/hr-http.util';

/** Payload of the settings form: pipeline stages keep only the editable flags. */
export function buildSettingsPayload(
  careers: { enabled: boolean; slug: string; company_name: string; privacy_policy_url: string },
  retentionMonths: number,
  stages: AtsPipelineStageSetting[],
): AtsSettingsPayload {
  return {
    careers: {
      enabled: careers.enabled,
      slug: careers.slug.trim() || null,
      company_name: careers.company_name.trim() || null,
      privacy_policy_url: careers.privacy_policy_url.trim() || null,
    },
    retention: { default_months: retentionMonths },
    pipeline: { stages: stages.map((s) => ({ stage: s.stage, enabled: s.enabled, auto_email: s.auto_email })) },
  };
}

/** Careers page, retention, pipeline stages and the candidate e-mail templates of the ATS. */
@Component({
  selector: 'app-ats-settings',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzSelectModule, NzSwitchModule, TranslatePipe],
  template: `
    <h3>{{ 'hrmAts.careersPage' | translate }}</h3>
    <div class="grid">
      <label for="cs-en">{{ 'hrmAts.careersEnabled' | translate }}</label>
      <nz-switch id="cs-en" [nzDisabled]="!canWrite()" [ngModel]="careersEnabled()" (ngModelChange)="careersEnabled.set($event)" />
      <label for="cs-slug">{{ 'hrmAts.slug' | translate }}</label>
      <input nz-input id="cs-slug" maxlength="60" [disabled]="!canWrite()" [ngModel]="slug()" (ngModelChange)="slug.set($event)" />
      <label for="cs-name">{{ 'hrmAts.companyName' | translate }}</label>
      <input nz-input id="cs-name" maxlength="150" [disabled]="!canWrite()" [ngModel]="companyName()" (ngModelChange)="companyName.set($event)" />
      <label for="cs-url">{{ 'hrmAts.privacyPolicyUrl' | translate }}</label>
      <input nz-input id="cs-url" type="url" maxlength="255" [disabled]="!canWrite()" [ngModel]="privacyUrl()" (ngModelChange)="privacyUrl.set($event)" />
      <label for="cs-ret">{{ 'hrmAts.retentionMonths' | translate }}</label>
      <nz-select id="cs-ret" [nzDisabled]="!canWrite()" [ngModel]="retention()" (ngModelChange)="retention.set($event)">
        <nz-option [nzValue]="6" [nzLabel]="'6 ' + ('hrmAts.months' | translate)" />
        <nz-option [nzValue]="12" [nzLabel]="'12 ' + ('hrmAts.months' | translate)" />
      </nz-select>
    </div>

    <h3>{{ 'hrmAts.pipelineStages' | translate }}</h3>
    @for (s of stages(); track s.stage) {
      <div class="stage">
        <strong>{{ 'hrmAts.stage.' + s.stage | translate }}</strong>
        <label><input type="checkbox" [disabled]="!canWrite()" [checked]="s.enabled !== false" (change)="toggle(s.stage, 'enabled', $any($event.target).checked)" /> {{ 'hrmAts.stageEnabled' | translate }}</label>
        <label><input type="checkbox" [disabled]="!canWrite()" [checked]="s.auto_email === true" (change)="toggle(s.stage, 'auto_email', $any($event.target).checked)" /> {{ 'hrmAts.autoEmail' | translate }}</label>
      </div>
    }
    @if (canWrite()) {
      <button nz-button nzType="primary" type="button" class="mt-2" (click)="save()">{{ 'COMMON.SAVE' | translate }}</button>
    }

    <h3>{{ 'hrmAts.emailTemplates' | translate }}</h3>
    <div class="filter-bar">
      <nz-select class="w-field-md" [ngModel]="tplStage()" (ngModelChange)="tplStage.set($event); pickTemplate()">
        @for (s of templateStages; track s) {
          <nz-option [nzValue]="s" [nzLabel]="('hrmAts.stage.' + s) | translate" />
        }
      </nz-select>
      <nz-select class="w-field-md" [ngModel]="tplLocale()" (ngModelChange)="tplLocale.set($event); pickTemplate()">
        @for (l of locales; track l) {
          <nz-option [nzValue]="l" [nzLabel]="l" />
        }
      </nz-select>
    </div>
    <label for="tp-sub">{{ 'hrmAts.subject' | translate }}</label>
    <input nz-input id="tp-sub" maxlength="255" [disabled]="!canWrite()" [ngModel]="tplSubject()" (ngModelChange)="tplSubject.set($event)" />
    <label for="tp-body">{{ 'hrmAts.body' | translate }}</label>
    <textarea nz-input id="tp-body" rows="8" maxlength="20000" [disabled]="!canWrite()" [ngModel]="tplBody()" (ngModelChange)="tplBody.set($event)"></textarea>
    <label><input type="checkbox" [disabled]="!canWrite()" [ngModel]="tplEnabled()" (ngModelChange)="tplEnabled.set($event)" /> {{ 'hrmAts.stageEnabled' | translate }}</label>
    @if (canWrite()) {
      <button nz-button nzType="primary" type="button" class="mt-2" [disabled]="!tplValid()" (click)="saveTemplate()">{{ 'hrmAts.saveTemplate' | translate }}</button>
    }
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: 220px minmax(0, 420px);
      gap: 8px 12px;
      align-items: center;
    }
    .stage {
      display: flex;
      gap: 16px;
      align-items: center;
      margin: 4px 0;
    }
    .stage strong {
      min-width: 200px;
    }
    label {
      display: block;
      margin-top: 8px;
    }
    .stage label {
      display: inline;
      margin: 0;
    }
  `,
})
export class AtsSettingsComponent implements OnInit {
  readonly canWrite = input(false);

  private readonly api = inject(HrExtraApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly locales = ATS_LOCALES;
  protected readonly templateStages = ATS_STAGES;
  protected readonly careersEnabled = signal(false);
  protected readonly slug = signal('');
  protected readonly companyName = signal('');
  protected readonly privacyUrl = signal('');
  protected readonly retention = signal(12);
  protected readonly stages = signal<AtsPipelineStageSetting[]>([]);
  private readonly templates = signal<AtsEmailTemplate[]>([]);
  protected readonly tplStage = signal<string>('applied');
  protected readonly tplLocale = signal<AtsLocale>('it-CH');
  protected readonly tplSubject = signal('');
  protected readonly tplBody = signal('');
  protected readonly tplEnabled = signal(true);
  protected readonly tplValid = computed(() => this.tplSubject().trim() !== '' && this.tplBody().trim() !== '');

  ngOnInit(): void {
    this.api.getRecruitingSettings().subscribe({
      next: (res) => this.apply(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
    this.api.listRecruitingEmailTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.data);
        this.pickTemplate();
      },
    });
  }

  private apply(settings: AtsSettings): void {
    this.careersEnabled.set(settings.careers.enabled);
    this.slug.set(settings.careers.slug ?? '');
    this.companyName.set(settings.careers.company_name ?? '');
    this.privacyUrl.set(settings.careers.privacy_policy_url ?? '');
    this.retention.set(settings.retention.default_months);
    this.stages.set(settings.pipeline.stages);
  }

  protected toggle(stage: string, field: 'enabled' | 'auto_email', value: boolean): void {
    this.stages.update((list) => list.map((s) => (s.stage === stage ? { ...s, [field]: value } : s)));
  }

  protected save(): void {
    const payload = buildSettingsPayload(
      { enabled: this.careersEnabled(), slug: this.slug(), company_name: this.companyName(), privacy_policy_url: this.privacyUrl() },
      this.retention(),
      this.stages(),
    );
    this.api.saveRecruitingSettings(payload).subscribe({
      next: (res) => {
        this.apply(res.data);
        this.message.success(this.i18n.translate('hrmCommon.saved'));
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected pickTemplate(): void {
    const found = this.templates().find((t) => t.stage === this.tplStage() && t.locale === this.tplLocale());
    this.tplSubject.set(found?.subject ?? '');
    this.tplBody.set(found?.body ?? '');
    this.tplEnabled.set(found?.is_enabled ?? true);
  }

  protected saveTemplate(): void {
    this.api
      .updateRecruitingEmailTemplate(this.tplStage(), this.tplLocale(), {
        subject: this.tplSubject().trim(),
        body: this.tplBody().trim(),
        is_enabled: this.tplEnabled(),
      })
      .subscribe({
        next: (res) => {
          this.templates.update((list) => [...list.filter((t) => !(t.stage === res.data.stage && t.locale === res.data.locale)), res.data]);
          this.message.success(this.i18n.translate('hrmCommon.saved'));
        },
        error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
      });
  }
}
