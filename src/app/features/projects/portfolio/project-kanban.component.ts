import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { I18nService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ProjectPortfolioApiService } from './portfolio-api.service';
import { KANBAN_COLUMNS, KanbanColumn, WBS_NODE_TYPES, WbsNode, WbsNodeType } from './portfolio.models';
import { kanbanCards, kanbanColumn, KANBAN_KEYS, NODE_TYPE_KEYS, percentForColumn } from './portfolio.utils';

/**
 * Kanban board of the WBS work items (Mod 078): three columns (to do, in progress, done) derived from the completion
 * of each task. Dropping a card in another column (or using its move buttons, for keyboard users) sets the completion
 * through the WBS API, which then recalculates the roll-ups. Filters narrow the cards by text, type and criticality.
 */
@Component({
  selector: 'app-project-kanban',
  styleUrl: './project-kanban.component.scss',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'PORTFOLIO.KANBAN_TITLE' | translate" [subtitle]="'PORTFOLIO.KANBAN_SUBTITLE' | translate" />
    <p class="kb-links">
      <a routerLink="/projects/portfolio">{{ 'PORTFOLIO.BACK_TO_PORTFOLIO' | translate }}</a>
      <a [routerLink]="['/projects', projectId, 'wbs']">{{ 'PORTFOLIO.OPEN_WBS' | translate }}</a>
    </p>

    @if (error()) {
      <nz-alert class="mb-4" nzType="error" nzShowIcon [nzMessage]="'PORTFOLIO.LOAD_ERROR' | translate" />
    }

    <div class="kb-filters">
      <input nz-input data-testid="kb-search" [placeholder]="'PORTFOLIO.SEARCH_TASKS' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" />
      <nz-select data-testid="kb-type" nzAllowClear [nzPlaceHolder]="'PORTFOLIO.FILTER_NODE_TYPE' | translate" [ngModel]="nodeType()" (ngModelChange)="nodeType.set($event ?? null)">
        @for (type of nodeTypes; track type) {
          <nz-option [nzValue]="type" [nzLabel]="typeKeys[type] | translate" />
        }
      </nz-select>
      <label class="kb-switch">
        <nz-switch data-testid="kb-critical" [ngModel]="criticalOnly()" (ngModelChange)="criticalOnly.set($event)" />
        {{ 'PORTFOLIO.CRITICAL_ONLY' | translate }}
      </label>
    </div>

    <nz-spin [nzSpinning]="loading()">
      <div class="kb-board" data-testid="kb-board">
        @for (column of columns; track column) {
          <section
            class="kb-column"
            [class.over]="overColumn() === column"
            [attr.data-testid]="'kb-column-' + column"
            [attr.aria-label]="columnKeys[column] | translate"
            (dragover)="allowDrop($event, column)"
            (dragleave)="overColumn.set(null)"
            (drop)="drop($event, column)"
          >
            <h3>
              {{ columnKeys[column] | translate }}
              <nz-tag [attr.data-testid]="'kb-count-' + column">{{ grouped()[column].length }}</nz-tag>
            </h3>
            @for (card of grouped()[column]; track card.id) {
              <article
                class="kb-card"
                [class.critical]="card.isCritical"
                [attr.draggable]="canWrite"
                [attr.data-testid]="'kb-card-' + card.id"
                (dragstart)="dragStart($event, card.id)"
                (dragend)="overColumn.set(null)"
              >
                <header>
                  <strong>{{ card.wbsCode }}</strong>
                  <span>{{ card.title }}</span>
                </header>
                <div class="kb-meta">
                  <nz-tag>{{ typeKeys[card.nodeType] | translate }}</nz-tag>
                  @if (card.isCritical) {
                    <nz-tag nzColor="red">{{ 'PORTFOLIO.CRITICAL' | translate }}</nz-tag>
                  }
                  <span>{{ card.startDate }} → {{ card.endDate }}</span>
                </div>
                <nz-progress [nzPercent]="card.percentComplete" nzSize="small" />
                @if (canWrite) {
                  <div class="kb-move">
                    @if (previous(column); as target) {
                      <button nz-button nzSize="small" type="button" [attr.data-testid]="'kb-prev-' + card.id" (click)="move(card, target)">← {{ columnKeys[target] | translate }}</button>
                    }
                    @if (next(column); as target) {
                      <button nz-button nzSize="small" type="button" [attr.data-testid]="'kb-next-' + card.id" (click)="move(card, target)">{{ columnKeys[target] | translate }} →</button>
                    }
                  </div>
                }
              </article>
            } @empty {
              <nz-empty nzNotFoundImage="simple" [nzNotFoundContent]="'PORTFOLIO.KANBAN_EMPTY' | translate" />
            }
          </section>
        }
      </div>
    </nz-spin>
  `,
})
export class ProjectKanbanComponent implements OnInit {
  private readonly api = inject(ProjectPortfolioApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly canWrite = inject(PermissionsService).canWrite('projects');
  protected readonly projectId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly columns = KANBAN_COLUMNS;
  protected readonly columnKeys = KANBAN_KEYS;
  protected readonly typeKeys = NODE_TYPE_KEYS;
  protected readonly nodeTypes = WBS_NODE_TYPES;

  readonly nodes = signal<WbsNode[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly search = signal('');
  readonly nodeType = signal<WbsNodeType | null>(null);
  readonly criticalOnly = signal(false);
  protected readonly overColumn = signal<KanbanColumn | null>(null);

  /** The filtered cards split by column. */
  readonly grouped = computed<Record<KanbanColumn, WbsNode[]>>(() => {
    const groups: Record<KanbanColumn, WbsNode[]> = { todo: [], inProgress: [], done: [] };

    for (const card of kanbanCards(this.nodes(), { search: this.search(), nodeType: this.nodeType(), criticalOnly: this.criticalOnly() })) {
      groups[kanbanColumn(card)].push(card);
    }

    return groups;
  });

  ngOnInit(): void {
    void this.load();
  }

  previous(column: KanbanColumn): KanbanColumn | null {
    return KANBAN_COLUMNS[KANBAN_COLUMNS.indexOf(column) - 1] ?? null;
  }

  next(column: KanbanColumn): KanbanColumn | null {
    return KANBAN_COLUMNS[KANBAN_COLUMNS.indexOf(column) + 1] ?? null;
  }

  protected dragStart(event: DragEvent, id: string): void {
    event.dataTransfer?.setData('text/plain', id);

    if (event.dataTransfer !== null) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  protected allowDrop(event: DragEvent, column: KanbanColumn): void {
    if (this.canWrite) {
      event.preventDefault();
      this.overColumn.set(column);
    }
  }

  protected async drop(event: DragEvent, column: KanbanColumn): Promise<void> {
    event.preventDefault();
    this.overColumn.set(null);

    const id = event.dataTransfer?.getData('text/plain');
    const card = this.nodes().find((node) => node.id === id);

    if (card !== undefined) {
      await this.move(card, column);
    }
  }

  /** Sets the completion that matches the column; the card moves at once and goes back if the API refuses. */
  async move(card: WbsNode, column: KanbanColumn): Promise<void> {
    if (!this.canWrite || kanbanColumn(card) === column) {
      return;
    }

    const previous = this.nodes();
    const percentComplete = percentForColumn(card, column);
    this.nodes.set(previous.map((node) => (node.id === card.id ? { ...node, percentComplete } : node)));

    try {
      await firstValueFrom(this.api.updateNode(this.projectId, card.id, { percentComplete }));
      await this.load(false);
    } catch {
      this.nodes.set(previous);
      this.message.error(this.i18n.translate('PORTFOLIO.SAVE_ERROR'));
    }
  }

  private async load(showSpinner = true): Promise<void> {
    this.loading.set(showSpinner);
    this.error.set(false);

    try {
      this.nodes.set((await firstValueFrom(this.api.kanban(this.projectId))).data);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
