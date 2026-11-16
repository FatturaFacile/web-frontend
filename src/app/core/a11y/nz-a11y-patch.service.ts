import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Fills two accessibility gaps NG-ZORRO leaves in the DOM it renders (WCAG 2.2: 1.3.1, 4.1.2, 2.1.1):
 * - the hidden search input of every `nz-select` has no accessible name: it takes the `aria-label` of the select,
 *   then its placeholder, then the label that points at it;
 * - a table body that scrolls but holds nothing focusable cannot be scrolled with the keyboard: it becomes a
 *   focusable, labelled region.
 * A single observer keeps this correct for content added later (routes, dialogs, lazy tables).
 */
@Injectable({ providedIn: 'root' })
export class NzA11yPatchService {
  private readonly document = inject(DOCUMENT);
  private started = false;
  private scheduled = false;

  start(): void {
    const root = this.document.body;
    if (this.started || !root || typeof MutationObserver === 'undefined') {
      return;
    }
    this.started = true;
    this.patch(root);
    new MutationObserver(() => {
      if (this.scheduled) {
        return;
      }
      this.scheduled = true;
      requestAnimationFrame(() => {
        this.scheduled = false;
        this.patch(root);
      });
    }).observe(root, { childList: true, subtree: true });
  }

  patch(root: ParentNode): void {
    root.querySelectorAll('nz-select').forEach((select) => {
      const input = select.querySelector<HTMLInputElement>('.ant-select-selection-search-input');
      if (!input || input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby')) {
        return;
      }
      const name =
        select.getAttribute('aria-label') ??
        select.querySelector('.ant-select-selection-placeholder')?.textContent?.trim() ??
        this.labelFor(select);
      if (name) {
        input.setAttribute('aria-label', name);
      }
    });

    root.querySelectorAll<HTMLElement>('.ant-table-content').forEach((region) => {
      if (region.hasAttribute('tabindex')) {
        return;
      }
      const scrolls = getComputedStyle(region).overflowX !== 'visible';
      const hasFocusable = !!region.querySelector('a[href], button, input, select, textarea, [tabindex]');
      if (scrolls && !hasFocusable) {
        region.setAttribute('tabindex', '0');
        region.setAttribute('role', 'region');
        region.setAttribute('aria-label', this.tableName(region));
      }
    });
  }

  private labelFor(select: Element): string | null {
    const id = select.getAttribute('id') ?? select.querySelector('input')?.id;
    const label = id ? this.document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    return label?.textContent?.trim() || null;
  }

  private tableName(region: HTMLElement): string {
    const table = region.closest('nz-table, .ant-table-wrapper');
    return table?.getAttribute('aria-label') ?? this.document.title ?? 'Table';
  }
}
