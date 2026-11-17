import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import {
  ApplicationStage,
  BoardStageColumn,
  CandidateApplicationCard,
  I18nService,
  JobOpening,
  MoveApplicationPayload,
  RecruitingApiService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { recruitingErrorKey } from '../shared/recruiting-errors';
import { stageLabelKey } from '../shared/recruiting-labels';
import { BoardCardComponent } from './board-card.component';
import {
  BoardColumns,
  canMoveTo,
  columnsFromBoard,
  emptyColumns,
  findCard,
  moveCard,
  moveTargets,
  replaceCard,
} from './board-state';
import { RejectDecision, RejectDialogComponent } from './reject-dialog.component';

interface PendingReject {
  card: CandidateApplicationCard;
  toIndex: number;
}

@Component({
  selector: 'app-recruiting-board',
  imports: [
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    BoardCardComponent,
    RejectDialogComponent,
  ],
  templateUrl: './recruiting-board.component.html',
  styleUrl: './recruiting-board.component.scss',
})
export class RecruitingBoardComponent {
  private readonly api = inject(RecruitingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  /** Job opening id (route param `:id`). */
  readonly id = signal('');

  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly opening = signal<JobOpening | null>(null);
  readonly stageMeta = signal<BoardStageColumn[]>([]);
  readonly columns = signal<BoardColumns>(emptyColumns());
  /** Card ids with an in-flight move request. */
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly search = signal('');
  readonly rejectOpen = signal(false);
  readonly rejectTarget = signal<PendingReject | null>(null);
  readonly now = new Date();

  private readonly search$ = new Subject<string>();
  private boardRequest?: Subscription;

  readonly enabledStages = computed<ReadonlySet<ApplicationStage>>(
    () =>
      new Set(
        this.stageMeta()
          .filter((s) => s.enabled)
          .map((s) => s.stage),
      ),
  );

  /**
   * Columns shown on the board, in pipeline order: enabled stages plus any
   * disabled stage that still holds cards (so no candidate disappears).
   */
  readonly visibleColumns = computed(() =>
    this.stageMeta()
      .filter((s) => s.enabled || this.columns()[s.stage].length > 0)
      .map((s) => ({
        stage: s.stage,
        label: s.label,
        cards: this.columns()[s.stage],
        count: this.columns()[s.stage].length,
        listId: `board-col-${s.stage}`,
      })),
  );

  readonly stageLabel = stageLabelKey;

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.load());
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id.set(params.get('id') ?? '');
      this.load();
    });
  }

  load(): void {
    // Only the latest board request may update the view (search typing, param changes).
    this.boardRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(false);
    this.boardRequest = this.api
      .getBoard(this.id(), this.search().trim() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.opening.set(res.data.job_opening);
          this.stageMeta.set(res.data.stages);
          this.columns.set(columnsFromBoard(res.data.stages));
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  onSearchInput(event: Event): void {
    this.onSearch((event.target as HTMLInputElement).value);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.search$.next(value.trim());
  }

  targetsFor(card: CandidateApplicationCard): ApplicationStage[] {
    return moveTargets(card.stage, this.enabledStages());
  }

  isPending(id: string): boolean {
    return this.pending().has(id);
  }

  /** cdk predicate: whether a dragged card may enter the given column. */
  readonly canEnter = (stage: ApplicationStage) => (drag: CdkDrag<CandidateApplicationCard>) => {
    const card = drag.data;
    return card.stage === stage || canMoveTo(card.stage, stage, this.enabledStages());
  };

  onDrop(event: CdkDragDrop<ApplicationStage, ApplicationStage, CandidateApplicationCard>): void {
    const card = event.item.data;
    const toStage = event.container.data;
    if (event.previousContainer === event.container) {
      // Reordering inside a column is not part of the contract; keep server order.
      return;
    }
    this.requestMove(card, toStage, event.currentIndex, false);
  }

  /** Keyboard alternative to drag-and-drop ("Move to..." menu). */
  onMoveRequested(card: CandidateApplicationCard, toStage: ApplicationStage): void {
    this.requestMove(card, toStage, this.columns()[toStage].length, true);
  }

  private requestMove(
    card: CandidateApplicationCard,
    toStage: ApplicationStage,
    toIndex: number,
    restoreFocus: boolean,
  ): void {
    if (card.is_anonymized || this.isPending(card.id)) {
      return;
    }
    if (!canMoveTo(card.stage, toStage, this.enabledStages())) {
      if (toStage === 'hired') {
        this.message.info(this.i18n.translate('hr.recruiting.board.hiredHint'));
      }
      return;
    }
    if (toStage === 'rejected') {
      this.rejectTarget.set({ card, toIndex });
      this.rejectOpen.set(true);
      return;
    }
    this.executeMove(
      card,
      { stage: toStage as MoveApplicationPayload['stage'] },
      toIndex,
      restoreFocus,
    );
  }

  onRejectConfirmed(decision: RejectDecision): void {
    const target = this.rejectTarget();
    this.rejectTarget.set(null);
    if (!target) {
      return;
    }
    this.executeMove(target.card, { stage: 'rejected', ...decision }, target.toIndex, true);
  }

  onRejectCancelled(): void {
    const target = this.rejectTarget();
    this.rejectTarget.set(null);
    if (target) {
      this.focusCard(target.card.id);
    }
  }

  /** Optimistic move: update the board, call the API, roll back on error. */
  private executeMove(
    card: CandidateApplicationCard,
    payload: MoveApplicationPayload,
    toIndex: number,
    restoreFocus: boolean,
  ): void {
    const snapshot = this.columns();
    const moved = moveCard(snapshot, card.id, payload.stage, toIndex);
    const position = findCard(moved, card.id)?.index ?? toIndex;
    this.columns.set(moved);
    this.setPending(card.id, true);
    if (restoreFocus) {
      this.focusCard(card.id);
    }

    this.api.moveApplication(card.id, { ...payload, board_position: position }).subscribe({
      next: (res) => {
        this.setPending(card.id, false);
        this.columns.update((cols) => replaceCard(cols, res.data));
      },
      error: (err: unknown) => {
        this.setPending(card.id, false);
        this.columns.set(snapshot);
        this.message.error(
          this.i18n.translate(recruitingErrorKey(err, 'hr.recruiting.errors.moveFailed')),
        );
        if (restoreFocus) {
          this.focusCard(card.id);
        }
      },
    });
  }

  private setPending(id: string, on: boolean): void {
    this.pending.update((set) => {
      const next = new Set(set);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  /** Moves focus back to the card's "Move to..." trigger after it re-renders in its new column. */
  private focusCard(id: string): void {
    afterNextRender(
      () => {
        const root = this.host.nativeElement as HTMLElement;
        const trigger = root.querySelector<HTMLElement>(`[data-move-trigger="${id}"]`);
        const fallback = root.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
        (trigger ?? fallback)?.focus();
      },
      { injector: this.injector },
    );
  }
}
