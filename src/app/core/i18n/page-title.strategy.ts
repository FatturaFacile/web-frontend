import { effect, inject, Injectable, Injector } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from './i18n.service';

const APP_NAME = 'Fattura Facile';

/**
 * Sets the browser tab title from the `title` of the route data. The value is a translation key served by the API
 * (for example PAGE_TITLE.TICKET_HELPDESK): it is translated again when the language or the dictionary changes.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  // Resolved lazily: the router builds this strategy, and I18nService needs HttpClient, whose interceptors need the router.
  private readonly injector = inject(Injector);
  private i18nService?: I18nService;
  private titleKey = '';

  constructor() {
    super();
    effect(() => {
      this.i18n().currentDictionary();
      this.apply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.titleKey = this.deepestTitleKey(snapshot.root);
    this.apply();
  }

  private i18n(): I18nService {
    return (this.i18nService ??= this.injector.get(I18nService));
  }

  private deepestTitleKey(route: ActivatedRouteSnapshot): string {
    let key = '';
    let current: ActivatedRouteSnapshot | null = route;
    while (current) {
      const value: unknown = current.data['title'];
      if (typeof value === 'string' && value) {
        key = value;
      }
      current = current.firstChild;
    }
    return key;
  }

  private apply(): void {
    if (!this.titleKey) {
      return;
    }
    const text = this.i18n().translate(this.titleKey);
    this.title.setTitle(text && text !== this.titleKey ? `${text} · ${APP_NAME}` : APP_NAME);
  }
}
