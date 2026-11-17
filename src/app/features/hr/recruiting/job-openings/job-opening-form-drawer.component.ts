import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { form, FormField, min, required, validate } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import {
  EMPLOYMENT_TYPES,
  RecruitingEmploymentType,
  I18nService,
  JobOpening,
  JobOpeningPayload,
  JobOpeningTranslation,
  RECRUITING_LOCALES,
  RecruitingApiService,
  RecruitingLocale,
  RecruitingPositionOption,
} from '@core';
import { TranslatePipe } from '@shared';
import { fieldErrors, recruitingErrorKey } from '../shared/recruiting-errors';

type TranslationsModel = Record<RecruitingLocale, JobOpeningTranslation>;

export interface JobOpeningFormModel {
  position_id: string;
  location_site: string;
  employment_type: RecruitingEmploymentType | null;
  openings_count: number;
  salary_enabled: boolean;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  published_languages: RecruitingLocale[];
  translations: TranslationsModel;
  closes_at: string;
}

const emptyTranslation = (): JobOpeningTranslation => ({
  title: '',
  description: '',
  requirements: '',
  benefits: '',
});

const emptyTranslations = (): TranslationsModel =>
  RECRUITING_LOCALES.reduce((acc, locale) => {
    acc[locale] = emptyTranslation();
    return acc;
  }, {} as TranslationsModel);

export function emptyOpeningModel(): JobOpeningFormModel {
  return {
    position_id: '',
    location_site: '',
    employment_type: null,
    openings_count: 1,
    salary_enabled: false,
    salary_min: null,
    salary_max: null,
    salary_currency: 'CHF',
    published_languages: ['it-CH'],
    translations: emptyTranslations(),
    closes_at: '',
  };
}

export function openingToModel(o: JobOpening): JobOpeningFormModel {
  const translations = emptyTranslations();
  for (const locale of RECRUITING_LOCALES) {
    const t = o.translations[locale];
    if (t) {
      translations[locale] = {
        title: t.title ?? '',
        description: t.description ?? '',
        requirements: t.requirements ?? '',
        benefits: t.benefits ?? '',
      };
    }
  }
  return {
    position_id: o.position_id,
    location_site: o.location_site,
    employment_type: o.employment_type,
    openings_count: o.openings_count,
    salary_enabled: !!o.salary_range_public,
    salary_min: o.salary_range_public?.min ?? null,
    salary_max: o.salary_range_public?.max ?? null,
    salary_currency: o.salary_range_public?.currency ?? 'CHF',
    published_languages: [...o.published_languages],
    translations,
    closes_at: o.closes_at ?? '',
  };
}

export function modelToPayload(m: JobOpeningFormModel): JobOpeningPayload {
  const translations: JobOpeningPayload['translations'] = {};
  for (const locale of m.published_languages) {
    translations[locale] = { ...m.translations[locale] };
  }
  return {
    position_id: m.position_id,
    location_site: m.location_site.trim(),
    employment_type: m.employment_type as RecruitingEmploymentType,
    openings_count: m.openings_count,
    salary_range_public:
      m.salary_enabled && m.salary_min !== null && m.salary_max !== null
        ? { min: m.salary_min, max: m.salary_max, currency: m.salary_currency, period: 'year' }
        : null,
    published_languages: [...m.published_languages],
    translations,
    closes_at: m.closes_at || null,
  };
}

/** Create / edit drawer for a job opening (draft). */
@Component({
  selector: 'app-job-opening-form-drawer',
  imports: [
    FormField,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTabsModule,
    TranslatePipe,
  ],
  templateUrl: './job-opening-form-drawer.component.html',
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      column-gap: 16px;
    }
    .fieldset {
      border: 0;
      padding: 0;
      margin: 0 0 16px;
    }
    .fieldset legend {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      border: 0;
    }
    .hint {
      font-size: 12px;
      color: rgb(0 0 0 / 65%);
    }
    .hint--error {
      color: #a8071a;
    }
    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    nz-input-number {
      width: 100%;
    }
  `,
})
export class JobOpeningFormDrawerComponent {
  private readonly api = inject(RecruitingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly open = model(false);
  readonly opening = input<JobOpening | null>(null);
  readonly saved = output<JobOpening>();

  readonly locales = RECRUITING_LOCALES;
  readonly employmentTypes = EMPLOYMENT_TYPES;
  readonly currencies = ['CHF', 'EUR'];

  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly serverErrors = signal<Record<string, string>>({});
  readonly positions = signal<RecruitingPositionOption[]>([]);
  readonly positionsError = signal(false);

  readonly model = signal<JobOpeningFormModel>(emptyOpeningModel());
  readonly openingForm = form(this.model, (p) => {
    required(p.position_id);
    required(p.location_site);
    required(p.employment_type);
    min(p.openings_count, 1);
    validate(p.published_languages, ({ value }) => (value().length ? null : { kind: 'required' }));
    for (const locale of RECRUITING_LOCALES) {
      required(p.translations[locale].title, {
        when: ({ valueOf }) => valueOf(p.published_languages).includes(locale),
      });
      required(p.translations[locale].description, {
        when: ({ valueOf }) => valueOf(p.published_languages).includes(locale),
      });
    }
    validate(p.salary_max, ({ value, valueOf }) => {
      const minValue = valueOf(p.salary_min);
      const maxValue = value();
      if (
        valueOf(p.salary_enabled) &&
        minValue !== null &&
        maxValue !== null &&
        maxValue < minValue
      ) {
        return { kind: 'salaryRange' };
      }
      return null;
    });
  });

  readonly isEdit = computed(() => !!this.opening());

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const current = this.opening();
      untracked(() => {
        this.model.set(current ? openingToModel(current) : emptyOpeningModel());
        this.submitted.set(false);
        this.serverErrors.set({});
        if (!this.positions().length) {
          this.loadPositions();
        }
      });
    });
  }

  loadPositions(): void {
    this.positionsError.set(false);
    this.api.listPositions().subscribe({
      next: (res) => this.positions.set(res.data),
      error: () => this.positionsError.set(true),
    });
  }

  /** Error tip for a field: client validation first, then server (422) message. */
  errorTip(path: string, invalid: boolean, key = 'hr.recruiting.validation.required'): string {
    if (invalid && this.submitted()) {
      return this.i18n.translate(key);
    }
    return this.serverErrors()[path] ?? '';
  }

  status(path: string, invalid: boolean): 'error' | '' {
    return (invalid && this.submitted()) || this.serverErrors()[path] ? 'error' : '';
  }

  close(): void {
    this.open.set(false);
  }

  submit(): void {
    this.submitted.set(true);
    if (this.openingForm().invalid()) {
      this.message.warning(this.i18n.translate('hr.recruiting.validation.fixErrors'));
      return;
    }
    const payload = modelToPayload(this.model());
    const current = this.opening();
    const request$ = current
      ? this.api.updateJobOpening(current.id, payload)
      : this.api.createJobOpening(payload);
    this.saving.set(true);
    this.serverErrors.set({});
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.message.success(
          this.i18n.translate(
            current ? 'hr.recruiting.openings.updated' : 'hr.recruiting.openings.created',
          ),
        );
        this.open.set(false);
        this.saved.emit(res.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.serverErrors.set(fieldErrors(err));
        this.message.error(this.i18n.translate(recruitingErrorKey(err)));
      },
    });
  }
}
