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
import { TranslatePipe } from '@shared';

interface Option {
  value: string;
  label: string;
}

/** Agent tools of a ticket: macros, canned responses, watchers, auto-assignment, merge, split and knowledge links. */
@Component({
  selector: 'app-ticket-agent-tools',
  imports: [
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
    this.helpdesk.getCannedResponses().subscribe({ next: (res) => this.canned.set(res.data ?? []), error: () => undefined });
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

  protected searchArticles(term: string): void {
    this.helpdesk.getKnowledgeArticles({ q: term.trim() || undefined }).subscribe({
      next: (res) =>
        this.articleOptions.set((res.data ?? []).map((item) => ({ value: item.id, label: `${item.article_number} ${item.title}` }))),
      error: () => this.articleOptions.set([]),
    });
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
