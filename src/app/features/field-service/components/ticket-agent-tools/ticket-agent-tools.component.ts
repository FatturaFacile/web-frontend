import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import {
  AutoAssignStrategy,
  CannedResponse,
  HelpdeskApiService,
  HELPDESK_LOCALES,
  HelpdeskTicketMessageResource,
  I18nService,
  KnowledgeArticle,
  Macro,
  SettingsApiService,
  TicketApiService,
  TicketResource,
  TicketWatcher,
  UserResource,
} from '@core';
import { TranslatePipe, IconActionDirective } from '@shared';

interface Option {
  value: string;
  label: string;
}

/** Agent tools of a ticket: macros, canned responses, watchers, auto-assignment, merge, split and knowledge links. */
@Component({
  selector: 'app-ticket-agent-tools',
  styleUrl: './ticket-agent-tools.component.scss',
  imports: [
    IconActionDirective,
    FormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDividerModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  templateUrl: './ticket-agent-tools.component.html',
})
export class TicketAgentToolsComponent implements OnInit {
  private readonly tickets = inject(TicketApiService);
  private readonly helpdesk = inject(HelpdeskApiService);
  private readonly settings = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  readonly ticket = input.required<TicketResource>();
  readonly messages = input<HelpdeskTicketMessageResource[]>([]);
  readonly changed = output<void>();
  readonly insertReply = output<string>();

  protected readonly macros = signal<Macro[]>([]);
  protected readonly canned = signal<CannedResponse[]>([]);
  protected readonly users = signal<UserResource[]>([]);
  protected readonly watchers = signal<TicketWatcher[]>([]);
  protected readonly links = signal<KnowledgeArticle[]>([]);
  protected readonly ticketOptions = signal<Option[]>([]);
  protected readonly articleOptions = signal<Option[]>([]);
  /** The articles found by the last search, kept whole so one can be inserted in the reply. */
  protected readonly foundArticles = signal<KnowledgeArticle[]>([]);

  /** Language of the canned responses and knowledge base articles on offer; empty means every language. */
  protected readonly locale = signal<string>('');
  protected readonly locales = HELPDESK_LOCALES;

  protected readonly macroId = signal<string | null>(null);
  protected readonly cannedId = signal<string | null>(null);
  protected readonly renderedBody = signal<string | null>(null);
  protected readonly watcherUserId = signal<string | null>(null);
  protected readonly strategy = signal<AutoAssignStrategy>('round_robin');
  protected readonly teamId = signal('');
  protected readonly mergeTargetId = signal<string | null>(null);
  protected readonly splitSubject = signal('');
  protected readonly splitMessageIds = signal<ReadonlySet<string>>(new Set());
  protected readonly articleId = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly canSplit = computed(() => this.splitSubject().trim().length > 0 && this.splitMessageIds().size > 0);

  ngOnInit(): void {
    this.helpdesk.getMacros().subscribe({ next: (res) => this.macros.set(res.data ?? []), error: () => undefined });
    this.loadCanned();
    this.settings.getTenantUsers().subscribe({ next: (res) => this.users.set(res.data ?? []), error: () => undefined });
    this.loadWatchers();
    this.loadLinks();
  }

  protected applyMacro(): void {
    const id = this.macroId();
    if (id) {
      this.run(this.tickets.applyMacro(this.ticket().id, id), 'TICKET_TOOLS.MACRO_APPLIED', true);
    }
  }

  protected renderCanned(): void {
    const id = this.cannedId();
    if (!id) {
      return;
    }
    this.tickets.renderCannedResponse(this.ticket().id, id).subscribe({
      next: (res) => this.renderedBody.set(res.data.body),
      error: () => this.message.error(this.i18n.translate('TICKET_TOOLS.FAILED')),
    });
  }

  protected useRendered(): void {
    const body = this.renderedBody();
    if (body) {
      this.insertReply.emit(body);
      this.renderedBody.set(null);
      this.cannedId.set(null);
    }
  }

  protected addWatcher(): void {
    const userId = this.watcherUserId();
    if (userId) {
      this.tickets.addWatcher(this.ticket().id, userId).subscribe({
        next: () => {
          this.watcherUserId.set(null);
          this.loadWatchers();
        },
        error: () => this.message.error(this.i18n.translate('TICKET_TOOLS.FAILED')),
      });
    }
  }

  protected removeWatcher(watcher: TicketWatcher): void {
    this.tickets.removeWatcher(this.ticket().id, watcher.user_id).subscribe({
      next: () => this.loadWatchers(),
      error: () => this.message.error(this.i18n.translate('TICKET_TOOLS.FAILED')),
    });
  }

  protected autoAssign(): void {
    this.run(
      this.tickets.autoAssignTicket(this.ticket().id, {
        strategy: this.strategy(),
        team_id: this.teamId().trim() || null,
      }),
      'TICKET_TOOLS.ASSIGNED',
      true,
    );
  }

  protected searchTickets(term: string): void {
    if (term.trim().length < 2) {
      return;
    }
    this.tickets.getTickets({ q: term.trim(), per_page: 10 }).subscribe({
      next: (res) =>
        this.ticketOptions.set(
          res.data
            .filter((item) => item.id !== this.ticket().id)
            .map((item) => ({ value: item.id, label: `#${item.ticket_number} ${item.subject}` })),
        ),
      error: () => this.ticketOptions.set([]),
    });
  }

  protected merge(): void {
    const target = this.mergeTargetId();
    if (!target) {
      return;
    }
    this.modal.confirm({
      nzTitle: this.i18n.translate('TICKET_TOOLS.MERGE_CONFIRM'),
      nzContent: this.i18n.translate('TICKET_TOOLS.MERGE_WARNING'),
      nzOkDanger: true,
      nzOkText: this.i18n.translate('TICKET_TOOLS.MERGE'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: () => this.run(this.tickets.mergeTicket(this.ticket().id, { target_ticket_id: target }), 'TICKET_TOOLS.MERGED', true),
    });
  }

  protected toggleMessage(id: string, checked: boolean): void {
    this.splitMessageIds.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  protected split(): void {
    this.run(
      this.tickets.splitTicket(this.ticket().id, {
        subject: this.splitSubject().trim(),
        message_ids: [...this.splitMessageIds()],
      }),
      'TICKET_TOOLS.SPLIT_DONE',
      true,
      () => {
        this.splitSubject.set('');
        this.splitMessageIds.set(new Set());
      },
    );
  }

  /** Changing the language narrows the canned responses and the articles to that language. */
  protected changeLocale(locale: string | null): void {
    this.locale.set(locale ?? '');
    this.cannedId.set(null);
    this.renderedBody.set(null);
    this.articleId.set(null);
    this.loadCanned();
    this.searchArticles('');
  }

  protected searchArticles(term: string): void {
    const locale = this.locale();
    this.helpdesk.getKnowledgeArticles({ q: term.trim() || undefined, locale: locale || undefined }).subscribe({
      next: (res) => {
        this.foundArticles.set(res.data ?? []);
        this.articleOptions.set((res.data ?? []).map((item) => ({ value: item.id, label: `${item.article_number} ${item.title}` })));
      },
      error: () => {
        this.foundArticles.set([]);
        this.articleOptions.set([]);
      },
    });
  }

  /** Puts the summary of the selected article (its text when it has none) in the reply form. */
  protected insertArticle(): void {
    const article = this.foundArticles().find((item) => item.id === this.articleId());
    if (article) {
      this.insertReply.emit(article.summary || article.content);
    }
  }

  protected linkArticle(): void {
    const id = this.articleId();
    if (id) {
      this.tickets.linkKnowledgeArticle(this.ticket().id, id).subscribe({
        next: () => {
          this.articleId.set(null);
          this.loadLinks();
        },
        error: () => this.message.error(this.i18n.translate('TICKET_TOOLS.FAILED')),
      });
    }
  }

  protected unlinkArticle(article: KnowledgeArticle): void {
    this.tickets.unlinkKnowledgeArticle(this.ticket().id, article.id).subscribe({
      next: () => this.loadLinks(),
      error: () => this.message.error(this.i18n.translate('TICKET_TOOLS.FAILED')),
    });
  }

  private loadCanned(): void {
    const locale = this.locale();
    this.helpdesk.getCannedResponses(locale ? { locale } : undefined).subscribe({
      next: (res) => this.canned.set(res.data ?? []),
      error: () => this.canned.set([]),
    });
  }

  private loadWatchers(): void {
    this.tickets.getWatchers(this.ticket().id).subscribe({
      next: (res) => this.watchers.set(res.data ?? []),
      error: () => this.watchers.set([]),
    });
  }

  private loadLinks(): void {
    this.tickets.getKnowledgeLinks(this.ticket().id).subscribe({
      next: (res) => this.links.set(res.data ?? []),
      error: () => this.links.set([]),
    });
  }

  private run(request: Observable<unknown>, successKey: string, notify: boolean, after?: () => void): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.message.success(this.i18n.translate(successKey));
        after?.();
        if (notify) {
          this.changed.emit();
        }
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const detail =
          err instanceof Object && 'error' in err && err.error instanceof Object && 'message' in err.error
            ? String(err.error.message)
            : '';
        this.message.error(detail || this.i18n.translate('TICKET_TOOLS.FAILED'));
      },
    });
  }
}
