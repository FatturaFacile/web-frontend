import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { filter, map } from 'rxjs';
// Deep imports keep the `@core` and `@shared` barrels out of the initial bundle.
import { AuthStore } from '@core/auth/auth.store';
import { PermissionsService } from '@core/auth/permissions.service';
import { TranslateService } from '@core/i18n/i18n.service';
import { AppStore } from '@core/state/app.store';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { isMenuRouteTested, normalizeMenuSearch } from './menu-availability';
import { MENU_SECTIONS, MenuItem, MenuSection } from './menu-sections';

@Component({
  selector: 'app-sidebar',
  styleUrl: './sidebar.component.scss',
  imports: [RouterLink, NzIconModule, NzInputModule, NzMenuModule, NzTooltipModule, TranslatePipe],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  readonly appStore = inject(AppStore);
  readonly authStore = inject(AuthStore);
  readonly permissions = inject(PermissionsService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslateService);

  /** Text typed in the quick search box of the menu */
  protected readonly searchTerm = signal('');
  protected readonly isSearching = computed(() => normalizeMenuSearch(this.searchTerm()) !== '');

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Accordion: only one group is open, reset to the group of the current page on every navigation */
  protected readonly openGroup = linkedSignal<string | null>(() => this.groupOf(this.currentUrl()));

  protected onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
  }

  /** An entry is enabled once its route is in TESTED_MENU_ROUTES; the others are greyed out */
  protected isEnabled(route: string | undefined): boolean {
    return isMenuRouteTested(route);
  }

  /** A group is enabled as soon as one of its entries is */
  protected isGroupEnabled(item: MenuItem): boolean {
    return (
      item.children?.some((child) => isMenuRouteTested(child.route)) ??
      isMenuRouteTested(item.route)
    );
  }

  protected onGroupOpenChange(key: string, open: boolean): void {
    // In the collapsed sidebar groups open as hover popups, which must not change the accordion state
    if (this.appStore.isCollapsed()) {
      return;
    }
    this.openGroup.update((current) => (open ? key : current === key ? null : current));
  }

  private groupOf(url: string): string | null {
    const path = url.split(/[?#]/)[0];
    for (const section of this.filteredSections()) {
      for (const item of section.items) {
        if (
          item.children?.some((child) => path === child.route || path.startsWith(`${child.route}/`))
        ) {
          return item.key;
        }
      }
    }
    return null;
  }

  readonly allMenuSections: readonly MenuSection[] = MENU_SECTIONS;

  /** Menu sections filtered reactively based on the active tenant role and module permissions */
  private readonly permittedSections = computed<MenuSection[]>(() => {
    // Read the active role signal to trigger reactivity on tenant/role change
    this.authStore.activeRole();

    return this.allMenuSections
      .map((section) => {
        const filteredItems = section.items
          .map((item) => {
            if (item.module && !this.permissions.canRead(item.module)) {
              return null;
            }

            if (item.children) {
              const filteredChildren = item.children.filter((child) => {
                const childModule = child.module ?? item.module;
                return !childModule || this.permissions.canRead(childModule);
              });

              if (filteredChildren.length === 0 && !item.route) {
                return null;
              }

              return { ...item, children: filteredChildren };
            }

            return item;
          })
          .filter((item): item is MenuItem => item !== null);

        return { ...section, items: filteredItems };
      })
      .filter((section) => section.items.length > 0);
  });

  /**
   * The permitted sections, narrowed by the quick search: an entry stays when its own label matches, a group whose
   * own label matches keeps all its entries, otherwise only the entries that match.
   */
  readonly filteredSections = computed<MenuSection[]>(() => {
    const sections = this.permittedSections();
    const term = normalizeMenuSearch(this.searchTerm());
    if (term === '') {
      return sections;
    }

    const matches = (key: string): boolean =>
      normalizeMenuSearch(this.i18n.translate(key)).includes(term);

    return sections
      .map((section) => ({
        ...section,
        items: section.items
          .map((item) => {
            if (!item.children) {
              return matches(item.key) ? item : null;
            }
            if (matches(item.key)) {
              return item;
            }
            const children = item.children.filter((child) => matches(child.key));
            return children.length > 0 ? { ...item, children } : null;
          })
          .filter((item): item is MenuItem => item !== null),
      }))
      .filter((section) => section.items.length > 0);
  });
}
