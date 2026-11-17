import { RECRUITING_LOCALES, RecruitingLocale, SupportedLanguage } from '@core';

/** Portal chrome language for a publication locale (`it-CH`/`it-IT` -> `it`, ...). */
export function appLanguageFor(locale: RecruitingLocale): SupportedLanguage {
  switch (locale) {
    case 'it-CH':
    case 'it-IT':
      return 'it';
    case 'de-CH':
      return 'de';
    case 'fr-CH':
      return 'fr';
    default:
      return 'en';
  }
}

/** Default publication locale for an app language. */
export function portalLocaleFor(language: SupportedLanguage): RecruitingLocale {
  switch (language) {
    case 'it':
      return 'it-CH';
    case 'de':
      return 'de-CH';
    case 'fr':
      return 'fr-CH';
    default:
      return 'en';
  }
}

export function isRecruitingLocale(value: unknown): value is RecruitingLocale {
  return typeof value === 'string' && (RECRUITING_LOCALES as readonly string[]).includes(value);
}

/** True for `?embed=1` / `?embed=true`. */
export function isEmbed(value: string | null): boolean {
  return value === '1' || value === 'true';
}

/** Accepted CV types and size limit (contract: pdf/doc/docx, max 5 MB). */
export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_EXTENSIONS = ['pdf', 'doc', 'docx'] as const;
export const CV_ACCEPT =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type CvValidationError = 'required' | 'type' | 'size';

export function validateCv(file: File | null): CvValidationError | null {
  if (!file) {
    return 'required';
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(CV_EXTENSIONS as readonly string[]).includes(ext)) {
    return 'type';
  }
  if (file.size > CV_MAX_BYTES) {
    return 'size';
  }
  return null;
}
