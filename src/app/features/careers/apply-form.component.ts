import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { email, form, FormField, required, validate } from '@angular/forms/signals';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzResultModule } from 'ng-zorro-antd/result';
import {
  PublicApplyPayload,
  PublicApplyResult,
  PublicCareersApiService,
  PublicCareersPage,
  PublicJob,
  RecruitingLocale,
} from '@core';
import { TranslatePipe } from '@shared';
import { CV_ACCEPT, CvValidationError, validateCv } from './careers-locale';

export interface ApplyFormModel {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  cover_letter: string;
  consent: boolean;
  /** Honeypot (hidden from humans, must stay empty). */
  website: string;
}

const blank = (): ApplyFormModel => ({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  cover_letter: '',
  consent: false,
  website: '',
});

type SubmitError = 'throttled' | 'duplicate' | 'closed' | 'generic' | 'validation';

/** Public application form (multipart, consent + CV required, honeypot). */
@Component({
  selector: 'app-apply-form',
  imports: [
    FormField,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzResultModule,
    TranslatePipe,
  ],
  templateUrl: './apply-form.component.html',
  styles: `
    :host {
      display: block;
    }
    .apply {
      background: #fff;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 20px 16px;
    }
    .apply__title {
      font-size: 20px;
      margin: 0 0 12px;
    }
    .apply__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      column-gap: 16px;
    }
    .apply__privacy {
      white-space: pre-line;
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 13px;
      max-height: 220px;
      overflow: auto;
    }
    .apply__hint {
      font-size: 12px;
      color: rgb(0 0 0 / 65%);
    }
    .apply__error {
      color: #a8071a;
      font-size: 13px;
      margin: 4px 0 0;
    }
    .apply__alert {
      margin-bottom: 12px;
    }
    .apply__file {
      max-width: 100%;
    }
    .hp {
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }
  `,
})
export class ApplyFormComponent {
  private readonly api = inject(PublicCareersApiService);
  private readonly injector = inject(Injector);

  readonly slug = input.required<string>();
  readonly job = input.required<PublicJob>();
  readonly page = input.required<PublicCareersPage>();
  readonly locale = input.required<RecruitingLocale>();

  readonly cvAccept = CV_ACCEPT;
  readonly model = signal<ApplyFormModel>(blank());
  readonly applyForm = form(this.model, (p) => {
    required(p.first_name);
    required(p.last_name);
    required(p.email);
    email(p.email);
    validate(p.consent, ({ value }) => (value() ? null : { kind: 'consentRequired' }));
  });

  readonly cvFile = signal<File | null>(null);
  readonly cvError = signal<CvValidationError | null>(null);
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly serverErrors = signal<Record<string, string>>({});
  readonly submitError = signal<SubmitError | null>(null);
  readonly result = signal<PublicApplyResult | null>(null);

  private readonly successPanel = viewChild<ElementRef<HTMLElement>>('successPanel');

  showError(field: keyof ApplyFormModel, invalid: boolean): boolean {
    return (this.submitted() && invalid) || !!this.serverErrors()[field];
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.cvFile.set(file);
    this.cvError.set(file ? validateCv(file) : null);
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }
    this.submitted.set(true);
    this.submitError.set(null);
    const cvError = validateCv(this.cvFile());
    this.cvError.set(cvError);
    if (this.applyForm().invalid() || cvError) {
      return;
    }
    const m = this.model();
    const payload: PublicApplyPayload = {
      first_name: m.first_name.trim(),
      last_name: m.last_name.trim(),
      email: m.email.trim(),
      phone: m.phone.trim() || null,
      cover_letter: m.cover_letter.trim() || null,
      locale: this.locale(),
      consent_accepted: m.consent,
      consent_text_version: this.page().consent_text_version,
      cv: this.cvFile() as File,
      website: m.website,
    };
    this.submitting.set(true);
    this.serverErrors.set({});
    this.api.apply(this.slug(), this.job().id, payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.result.set(res.data);
        afterNextRender(() => this.successPanel()?.nativeElement.focus(), {
          injector: this.injector,
        });
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.handleError(err);
      },
    });
  }

  private handleError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      this.submitError.set('generic');
      return;
    }
    switch (err.status) {
      case 422: {
        const errors: Record<string, string> = {};
        const body = err.error as { errors?: Record<string, unknown> } | null;
        for (const [field, messages] of Object.entries(body?.errors ?? {})) {
          const first = Array.isArray(messages) ? messages[0] : messages;
          if (typeof first === 'string') {
            errors[field] = first;
          }
        }
        this.serverErrors.set(errors);
        this.submitError.set('validation');
        break;
      }
      case 429:
        this.submitError.set('throttled');
        break;
      case 409:
        this.submitError.set('duplicate');
        break;
      case 404:
        this.submitError.set('closed');
        break;
      default:
        this.submitError.set('generic');
    }
  }
}
