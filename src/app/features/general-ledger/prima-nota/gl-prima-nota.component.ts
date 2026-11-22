import { Component, ElementRef, inject, Injector, afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  I18nService,
  LEDGER_BOOK_CODES,
  LedgerBookCode,
  PermissionsService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { PrimaNotaStore } from './prima-nota.store';
import { accountLabel, PrimaNotaIssue, resolveShortcut } from './prima-nota.util';

/**
 * Prima Nota fast-entry workbench: a keyboard driven journal grid with a live Dare / Avere / Differenza indicator,
 * account autocomplete, ledger book selection with propagation, and guided entry from an accounting template (causale).
 */
@Component({
  selector: 'app-gl-prima-nota',
  styleUrl: './gl-prima-nota.component.scss',
  templateUrl: './gl-prima-nota.component.html',
  providers: [PrimaNotaStore],
  imports: [
    FormsModule,
    RouterLink,
    NzAutocompleteModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
    GlErrorAlertComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class GlPrimaNotaComponent {
  protected readonly store = inject(PrimaNotaStore);
  protected readonly lookups = inject(GlLookupStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly books: readonly LedgerBookCode[] = LEDGER_BOOK_CODES;
  protected readonly accountLabel = accountLabel;

  constructor() {
    this.lookups.load();
    void this.store.loadTemplates();
  }

  protected issueKey(issue: PrimaNotaIssue): string {
    return 'GL.PN_ISSUE_' + issue.toUpperCase();
  }

  protected bookLabelKey(code: LedgerBookCode): string {
    return 'GL.PN_BOOK_' + code;
  }

  protected onAccountInput(key: number, value: string): void {
    if (this.store.postableAccounts().some((account) => account.id === value)) {
      this.store.selectAccount(key, value);
      return;
    }
    this.store.setAccountQuery(key, value);
  }

  protected addLine(): void {
    const key = this.store.addLine();
    this.focusAccount(key);
  }

  protected balance(): void {
    this.store.autofill(this.focusedLineKey());
  }

  protected focusTemplate(): void {
    this.host.nativeElement.querySelector<HTMLElement>('#pn-template input')?.focus();
  }

  protected async submit(status: 'draft' | 'posted'): Promise<void> {
    if (!this.canWrite) {
      return;
    }
    const outcome = await this.store.submit(status);
    if (outcome.ok) {
      this.message.success(
        this.i18n.translate(status === 'posted' ? 'GL.PN_POSTED' : 'GL.PN_DRAFT_SAVED') +
          ` ${outcome.entry.entry_number}`,
      );
      this.store.reset();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const action = resolveShortcut(event);
    if (action === null) {
      return;
    }
    event.preventDefault();
    switch (action) {
      case 'add_line':
        this.addLine();
        break;
      case 'balance':
        this.balance();
        break;
      case 'save_draft':
        void this.submit('draft');
        break;
      case 'post':
        void this.submit('posted');
        break;
      case 'next_ledger':
        this.store.cycleLedger();
        break;
      case 'focus_template':
        this.focusTemplate();
        break;
    }
  }

  /** The line whose field has the focus, when the focus is inside the grid. */
  private focusedLineKey(): number | null {
    const active = document.activeElement;
    const row =
      active instanceof HTMLElement ? active.closest<HTMLElement>('[data-line-key]') : null;
    return row ? Number(row.dataset['lineKey']) : null;
  }

  private focusAccount(key: number): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLInputElement>(`#pn-account-${key}`)?.focus(),
      { injector: this.injector },
    );
  }
}
