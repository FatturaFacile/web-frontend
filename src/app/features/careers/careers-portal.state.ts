import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import {
  I18nService,
  PublicCareersApiService,
  PublicCareersPage,
  RECRUITING_LOCALES,
  RecruitingLocale,
} from '@core';
import { appLanguageFor, isEmbed, isRecruitingLocale, portalLocaleFor } from './careers-locale';

/**
 * Per-page state of the public careers portal: slug, publication locale,
 * embed mode and the careers page meta. Provided at component level.
 * Does not depend on authentication or tenant state.
 */
@Injectable()
export class CareersPortalState {
  private readonly api = inject(PublicCareersApiService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = signal('');
  readonly locale = signal<RecruitingLocale>(portalLocaleFor(this.i18n.currentLanguage()));
  readonly embed = signal(false);

  readonly page = signal<PublicCareersPage | null>(null);
  readonly pageLoading = signal(false);
  readonly pageNotFound = signal(false);
  readonly pageError = signal(false);

  readonly availableLocales = computed<readonly RecruitingLocale[]>(() => {
    const available = this.page()?.available_locales;
    return available?.length ? available : RECRUITING_LOCALES;
  });

  private pageRequest?: Subscription;

  /** Subscribes to route changes; `onChange` runs after slug/locale are resolved. */
  connect(
    onChange: (params: { slug: string; locale: RecruitingLocale; routeParams: ParamMap }) => void,
  ): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => {
        const slug = params.get('slug') ?? '';
        const requested = query.get('locale');
        const locale = isRecruitingLocale(requested) ? requested : this.locale();
        this.embed.set(isEmbed(query.get('embed')));
        const slugChanged = slug !== this.slug();
        const localeChanged = locale !== this.locale();
        this.slug.set(slug);
        this.locale.set(locale);
        this.syncChromeLanguage(locale);
        if (slugChanged || localeChanged || !this.page()) {
          this.loadPage();
        }
        onChange({ slug, locale, routeParams: params });
      });
  }

  loadPage(): void {
    this.pageRequest?.unsubscribe();
    this.pageLoading.set(true);
    this.pageNotFound.set(false);
    this.pageError.set(false);
    this.pageRequest = this.api.getPage(this.slug(), this.locale()).subscribe({
      next: (res) => {
        this.page.set(res.data);
        this.pageLoading.set(false);
      },
      error: (err: unknown) => {
        this.page.set(null);
        this.pageLoading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.pageNotFound.set(true);
        } else {
          this.pageError.set(true);
        }
      },
    });
  }

  /** Switches publication locale (kept in the URL so it survives navigation and iframes). */
  setLocale(locale: RecruitingLocale): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { locale },
      queryParamsHandling: 'merge',
    });
  }

  /** Query params to carry across portal links (locale, embed). */
  linkParams(): Record<string, string> {
    const params: Record<string, string> = { locale: this.locale() };
    if (this.embed()) {
      params['embed'] = '1';
    }
    return params;
  }

  private syncChromeLanguage(locale: RecruitingLocale): void {
    const language = appLanguageFor(locale);
    if (this.i18n.currentLanguage() !== language) {
      void this.i18n.setLanguage(language);
    }
  }
}
