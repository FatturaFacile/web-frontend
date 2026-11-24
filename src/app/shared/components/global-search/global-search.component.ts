import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subject, switchMap, tap } from 'rxjs';
import { CollaborationApiService } from '@core/api/collaboration-api.service';
import type { CollaborationSearchResult } from '@core/models/collaboration.model';
import { AutofocusDirective } from '../../directives/autofocus.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { GlobalSearchService } from './global-search.service';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Command palette that searches the key entities of the company (contacts, invoices, quotes, products, projects,
 * suppliers, employees). Opens with Ctrl+K (Cmd+K on macOS) or from the header, closes with Escape, and moves
 * between hits with the arrow keys.
 */
@Component({
  selector: 'app-global-search',
  imports: [AutofocusDirective, TranslatePipe],
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
  styles: `
    .gs-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 12vh;
      background: var(--ff-color-overlay);
    }
    .gs-panel {
      width: min(640px, 92vw);
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 8px;
      background: var(--ff-color-surface-raised);
      color: var(--ff-color-text);
      box-shadow: var(--ff-shadow-elevated);
    }
    .gs-input {
      width: 100%;
      padding: 14px 16px;
      border: 0;
      border-bottom: 1px solid var(--ff-color-border-subtle);
      font-size: 16px;
      background: transparent;
      color: inherit;
      outline: none;
    }
    .gs-list {
      margin: 0;
      padding: 4px 0;
      list-style: none;
      overflow-y: auto;
    }
    .gs-item {
      display: flex;
      align-items: baseline;
      gap: 10px;
      width: 100%;
      padding: 8px 16px;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .gs-item.active,
    .gs-item:hover {
      background: var(--ff-color-primary-subtle);
    }
    .gs-type {
      flex: none;
      min-width: 84px;
      font-size: 12px;
      text-transform: uppercase;
      opacity: 0.65;
    }
    .gs-title {
      font-weight: 500;
    }
    .gs-subtitle {
      margin-left: auto;
      font-size: 12px;
      opacity: 0.65;
    }
    .gs-hint {
      padding: 16px;
      text-align: center;
      opacity: 0.65;
    }
  `,
  template: `
    @if (search.isOpen()) {
      <div class="gs-backdrop" (click)="close()" (keydown.escape)="close()" role="presentation">
        <div
          class="gs-panel"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="'COLLAB.SEARCH_TITLE' | translate"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
        >
          <input
            appAutofocus
            class="gs-input"
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls="global-search-results"
            autocomplete="off"
            [attr.aria-label]="'COLLAB.SEARCH_TITLE' | translate"
            [attr.aria-activedescendant]="activeIndex() >= 0 ? 'global-search-hit-' + activeIndex() : null"
            [placeholder]="'COLLAB.SEARCH_PLACEHOLDER' | translate"
            [value]="query()"
            (input)="onInput($any($event.target).value)"
            (keydown)="onInputKeydown($event)"
          />
          @if (query().trim().length < minQueryLength) {
            <div class="gs-hint">{{ 'COLLAB.SEARCH_HINT' | translate }}</div>
          } @else if (isLoading()) {
            <div class="gs-hint" role="status">{{ 'COLLAB.LOADING' | translate }}</div>
          } @else if (hasError()) {
            <div class="gs-hint" role="alert">{{ 'COLLAB.LOAD_ERROR' | translate }}</div>
          } @else if (results().length === 0) {
            <div class="gs-hint" role="status">{{ 'COLLAB.SEARCH_NO_RESULTS' | translate }}</div>
          } @else {
            <ul class="gs-list" id="global-search-results" role="listbox">
              @for (hit of results(); track hit.type + hit.id; let index = $index) {
                <li role="presentation">
                  <button
                    type="button"
                    role="option"
                    class="gs-item"
                    [id]="'global-search-hit-' + index"
                    [class.active]="index === activeIndex()"
                    [attr.aria-selected]="index === activeIndex()"
                    (click)="select(hit)"
                    (mouseenter)="activeIndex.set(index)"
                  >
                    <span class="gs-type">{{ hit.type_label }}</span>
                    <span class="gs-title">{{ hit.title }}</span>
                    @if (hit.subtitle) {
                      <span class="gs-subtitle">{{ hit.subtitle }}</span>
                    }
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      </div>
    }
  `,
})
export class GlobalSearchComponent {
  readonly search = inject(GlobalSearchService);
  private readonly api = inject(CollaborationApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queries = new Subject<string>();

  readonly minQueryLength = MIN_QUERY_LENGTH;
  readonly query = signal('');
  readonly results = signal<CollaborationSearchResult[]>([]);
  readonly activeIndex = signal(-1);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  constructor() {
    this.queries
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((text) => {
          this.hasError.set(false);
          this.isLoading.set(text.length >= MIN_QUERY_LENGTH);
        }),
        switchMap((text) =>
          text.length < MIN_QUERY_LENGTH
            ? of<CollaborationSearchResult[]>([])
            : this.api.search({ q: text }).pipe(
                map((response) => response.data),
                catchError(() => {
                  this.hasError.set(true);
                  return of<CollaborationSearchResult[]>([]);
                }),
              ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((hits) => {
        this.results.set(hits);
        this.activeIndex.set(hits.length > 0 ? 0 : -1);
        this.isLoading.set(false);
      });
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    // Ctrl/Cmd + K belongs to the Copilot drawer; the command palette moved to Ctrl/Cmd + Shift + K.
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.toggle();
    } else if (event.key === 'Escape' && this.search.isOpen()) {
      this.close();
    }
  }

  onInput(value: string): void {
    this.query.set(value);
    this.queries.next(value.trim());
  }

  onInputKeydown(event: KeyboardEvent): void {
    const count = this.results().length;

    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.activeIndex.update((index) => (index + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.activeIndex.update((index) => (index <= 0 ? count - 1 : index - 1));
    } else if (event.key === 'Enter') {
      const hit = this.results()[this.activeIndex()];

      if (hit) {
        event.preventDefault();
        this.select(hit);
      }
    }
  }

  select(hit: CollaborationSearchResult): void {
    this.close();
    void this.router.navigateByUrl(hit.path);
  }

  private toggle(): void {
    if (this.search.isOpen()) {
      this.close();
    } else {
      this.search.open();
    }
  }

  close(): void {
    this.search.close();
    this.query.set('');
    this.results.set([]);
    this.activeIndex.set(-1);
    this.isLoading.set(false);
    this.hasError.set(false);
    this.queries.next('');
  }
}
