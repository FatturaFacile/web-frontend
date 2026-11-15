import { Component, computed, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, LeadApiService, LeadRoutingRule } from '@core';
import { PageHeaderComponent } from '@shared';
import { LeadAssigneeDirectory } from '../leads/lead-assignee-directory';
import { apiErrorMessage, httpStatus, humanize, translateOr, TranslateOrPipe } from '../leads/lead-i18n';
import { LeadRoutingRuleModalComponent } from './lead-routing-rule-modal.component';

/** Returns a reordered copy (the input array is never mutated). */
export function moveRule<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  if (from === to || from < 0 || to < 0 || from >= copy.length || to >= copy.length) {
    return copy;
  }
  moveItemInArray(copy, from, to);
  return copy;
}

function sortByPriority(rules: LeadRoutingRule[]): LeadRoutingRule[] {
  return [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

@Component({
  selector: 'app-crm-lead-routing',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzIconModule,
    NzPopconfirmModule,
    NzSkeletonModule,
    NzTagModule,
    PageHeaderComponent,
    TranslateOrPipe,
    LeadRoutingRuleModalComponent,
  ],
  templateUrl: './lead-routing.component.html',
  styleUrl: './lead-routing.component.scss',
})
export class LeadRoutingComponent {
  private readonly api = inject(LeadApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly assignees = inject(LeadAssigneeDirectory);

  readonly rules = signal<LeadRoutingRule[]>([]);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly loadError = signal(false);
  readonly reordering = signal(false);
  readonly reorderError = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly modalOpen = signal(false);
  readonly editing = signal<LeadRoutingRule | null>(null);
  /** Screen-reader announcement after a keyboard move. */
  readonly announcement = signal('');

  protected readonly nextPriority = computed(
    () => this.rules().reduce((max, r) => Math.max(max, r.priority ?? 0), 0) + 1,
  );

  constructor() {
    this.assignees.load();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listRoutingRules().subscribe({
      next: (rules) => {
        this.rules.set(sortByPriority(rules));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.forbidden.set(httpStatus(err) === 403);
        this.loadError.set(httpStatus(err) !== 403);
      },
    });
  }

  protected strategyLabel(s: string): string {
    return translateOr(this.i18n, `CRM.LEAD_ROUTING.${s.toUpperCase()}`, humanize(s));
  }

  protected conditionsSummary(r: LeadRoutingRule): string {
    const c = r.conditions ?? {};
    const parts: string[] = [];
    if (c.countries?.length) parts.push(c.countries.join(', '));
    if (c.regions?.length) parts.push(c.regions.join(', '));
    if (c.product_lines?.length) parts.push(c.product_lines.join(', '));
    if (c.employee_min != null || c.employee_max != null) {
      parts.push(`${c.employee_min ?? 0}-${c.employee_max ?? '∞'}`);
    }
    if (c.ratings?.length) {
      parts.push(
        c.ratings.map((x) => translateOr(this.i18n, `CRM.LEADS.RATING.${x.toUpperCase()}`, humanize(x))).join(', '),
      );
    }
    return parts.join(' · ') || translateOr(this.i18n, 'CRM.LEAD_ROUTING.ANY_LEAD', 'Any lead');
  }

  protected assigneeNames(r: LeadRoutingRule): string {
    return (r.assignee_user_ids ?? []).map((id) => this.assignees.nameOf(id)).join(', ') || '-';
  }

  onDrop(event: CdkDragDrop<LeadRoutingRule[]>): void {
    this.reorder(event.previousIndex, event.currentIndex);
  }

  move(index: number, delta: -1 | 1): void {
    this.reorder(index, index + delta);
  }

  /** Optimistic reorder: posts the full ordered id list, restores the previous order on failure. */
  reorder(from: number, to: number): void {
    const previous = this.rules();
    const next = moveRule(previous, from, to);
    if (this.reordering() || next.every((r, i) => r === previous[i])) {
      return;
    }
    this.rules.set(next.map((r, i) => ({ ...r, priority: i + 1 })));
    this.reordering.set(true);
    this.reorderError.set(null);
    const moved = next[to];
    this.announcement.set(
      translateOr(this.i18n, 'CRM.LEAD_ROUTING.MOVED', '{name} moved to position {position}', {
        name: moved.name,
        position: to + 1,
      }),
    );
    this.api.reorderRoutingRules(next.map((r) => r.id)).subscribe({
      next: () => this.reordering.set(false),
      error: (err: unknown) => {
        this.reordering.set(false);
        this.rules.set(previous);
        const msg =
          apiErrorMessage(err) ??
          translateOr(this.i18n, 'CRM.LEAD_ROUTING.REORDER_FAILED', 'The new order could not be saved; it was restored.');
        this.reorderError.set(msg);
        this.announcement.set(msg);
      },
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.modalOpen.set(true);
  }

  openEdit(r: LeadRoutingRule): void {
    this.editing.set(r);
    this.modalOpen.set(true);
  }

  onSaved(saved: LeadRoutingRule): void {
    const editing = this.editing();
    if (saved && typeof saved === 'object' && 'id' in saved) {
      this.rules.update((list) =>
        sortByPriority(editing ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved]),
      );
      if (saved.is_default) {
        // Only one default rule makes sense: reload to reflect the server's view.
        this.load();
      }
    } else {
      this.load();
    }
    this.message.success(translateOr(this.i18n, 'CRM.LEAD_ROUTING.SAVED', 'Routing rule saved'));
  }

  remove(r: LeadRoutingRule): void {
    if (this.busyId()) {
      return;
    }
    this.busyId.set(r.id);
    this.api.deleteRoutingRule(r.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.rules.update((list) => list.filter((x) => x.id !== r.id));
        this.message.success(translateOr(this.i18n, 'CRM.LEAD_ROUTING.DELETED', 'Routing rule deleted'));
      },
      error: () => this.busyId.set(null),
    });
  }
}
