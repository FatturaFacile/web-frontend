import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { MesApiService } from './mes-api.service';
import { liveTimes, rowKey } from './mes-time.utils';
import {
  MesAction,
  MesBoard,
  MesCommandMeta,
  MesDefectReason,
  MesLiveTimes,
  MesMachineMode,
  MesPhase,
  MesSuspensionReason,
} from './mes.models';

/** A failure of a command: the first validation message of the API and the field it names. */
export interface MesFailure {
  field: string | null;
  message: string;
  /** `true` when the phase changed elsewhere and the board was reloaded. */
  stale: boolean;
}

export interface MesLotInput {
  mfgItemId: string;
  lotCode: string | null;
  quantity: string;
  overConsumptionConfirmed: boolean;
}

export interface MesDeclarationInput {
  goodQuantity: string;
  scrapQuantity: string;
  defectReason: MesDefectReason | null;
  note: string | null;
}

const REFRESH_MS = 15_000;

/**
 * State of the operator board of one work centre (CQRS read side) and the commands it sends (write side).
 *
 * The board is the server's read model; counters advance locally from `receivedAtMs` only to look alive, and every refresh
 * replaces them with the server numbers. A command carries a key created once per operator action and kept while the action
 * is retried, plus the phase version the operator saw, so a double tap or a flaky network never acts twice and a phase changed
 * on another tablet is refused and reloaded.
 */
@Service()
export class MesBoardStore {
  private readonly api = inject(MesApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly workCenterId = signal<string | null>(null);
  readonly operatorId = signal<string | null>(null);
  readonly board = signal<MesBoard | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly failure = signal<MesFailure | null>(null);
  readonly selectedKey = signal<string | null>(null);
  /** Milliseconds of the device clock when the board was received. */
  readonly receivedAtMs = signal(0);
  /** Current device time, ticked every second. */
  readonly nowMs = signal(Date.now());

  /** Key of the operator action in flight, kept for retries of the very same action. */
  private pendingKey: { signature: string; key: string } | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];

  readonly phases = computed<MesPhase[]>(() => this.board()?.phases ?? []);
  readonly available = computed<MesPhase[]>(() => this.board()?.available ?? []);
  readonly rows = computed<MesPhase[]>(() => [...this.phases(), ...this.available()]);
  readonly selected = computed<MesPhase | null>(() => {
    const key = this.selectedKey();
    const rows = this.rows();

    return rows.find((row) => rowKey(row) === key) ?? rows[0] ?? null;
  });
  readonly allowed = computed<ReadonlySet<MesAction>>(
    () => new Set(this.selected()?.allowed_actions ?? []),
  );
  readonly elapsedSeconds = computed(() =>
    Math.max(0, (this.nowMs() - this.receivedAtMs()) / 1000),
  );
  readonly live = computed<MesLiveTimes | null>(() => {
    const phase = this.selected();

    return phase ? liveTimes(phase, this.elapsedSeconds()) : null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Starts the one-second tick and the periodic refresh of the board. */
  start(): void {
    this.stop();
    this.timers = [
      setInterval(() => this.nowMs.set(Date.now()), 1000),
      setInterval(() => {
        if (!this.busy()) {
          this.refresh().subscribe({ error: () => undefined });
        }
      }, REFRESH_MS),
    ];
  }

  /** Stops the timers. */
  stop(): void {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];
  }

  select(key: string): void {
    this.selectedKey.set(key);
  }

  setOperator(operatorId: string | null): void {
    this.operatorId.set(operatorId);
  }

  /** Loads the board of a work centre. */
  load(workCenterId: string): Observable<unknown> {
    this.workCenterId.set(workCenterId);
    this.loading.set(true);

    return this.fetch().pipe(finalize(() => this.loading.set(false)));
  }

  /** Reloads the board of the current work centre without the loading state. */
  refresh(): Observable<unknown> {
    return this.fetch();
  }

  takeOver(machineId?: string | null): Observable<unknown> | null {
    const phase = this.selected();
    const operatorId = this.operatorId();
    if (!phase || !operatorId || !this.allowed().has('take_over')) {
      return null;
    }
    const meta = this.meta('take_over', phase);

    return this.run(
      this.api.takeOver(meta, {
        production_order_operation_id: phase.operation.id,
        operator_id: operatorId,
        machine_id: machineId ?? null,
      }),
      phase,
    );
  }

  startSetup(): Observable<unknown> | null {
    return this.simple('start_setup', 'start-setup');
  }

  startProduction(mode: MesMachineMode = 'attended'): Observable<unknown> | null {
    return this.simple('start_production', 'start-production', { machine_mode: mode }, mode);
  }

  suspend(reason: MesSuspensionReason): Observable<unknown> | null {
    return this.simple('suspend', 'suspend', { reason }, reason);
  }

  resume(): Observable<unknown> | null {
    return this.simple('resume', 'resume');
  }

  close(): Observable<unknown> | null {
    return this.simple('close', 'close');
  }

  declare(input: MesDeclarationInput): Observable<unknown> | null {
    const body: Record<string, unknown> = {
      good_quantity: input.goodQuantity,
      scrap_quantity: input.scrapQuantity,
    };
    if (input.defectReason) {
      body['defect_reason'] = input.defectReason;
    }
    if (input.note) {
      body['note'] = input.note;
    }

    return this.simple('declare_production', 'declarations', body, JSON.stringify(body));
  }

  consume(input: MesLotInput): Observable<unknown> | null {
    const body: Record<string, unknown> = {
      mfg_item_id: input.mfgItemId,
      quantity: input.quantity,
      over_consumption_confirmed: input.overConsumptionConfirmed,
    };
    if (input.lotCode) {
      body['lot_code'] = input.lotCode;
    }

    return this.simple('consume_material', 'material-consumptions', body, JSON.stringify(body));
  }

  clearFailure(): void {
    this.failure.set(null);
  }

  private simple(
    action: MesAction,
    path:
      | 'start-setup'
      | 'start-production'
      | 'suspend'
      | 'resume'
      | 'declarations'
      | 'material-consumptions'
      | 'close',
    body: Record<string, unknown> = {},
    discriminator = '',
  ): Observable<unknown> | null {
    const phase = this.selected();
    if (!phase?.id || !this.allowed().has(action)) {
      return null;
    }
    const meta = this.meta(`${action}:${discriminator}`, phase);

    return this.run(this.api.command(phase.id, path, meta, body), phase);
  }

  /**
   * The command meta: a key created for this action on this phase version and kept until the action succeeds, so retries
   * reuse it, and the version the operator saw.
   */
  private meta(signature: string, phase: MesPhase): MesCommandMeta {
    const full = `${rowKey(phase)}:${phase.version}:${signature}`;
    if (this.pendingKey?.signature !== full) {
      this.pendingKey = { signature: full, key: crypto.randomUUID() };
    }

    return {
      idempotency_key: this.pendingKey.key,
      ...(phase.id ? { expected_version: phase.version } : {}),
    };
  }

  private run(call: Observable<{ data: MesPhase }>, phase: MesPhase): Observable<unknown> {
    this.busy.set(true);
    this.failure.set(null);

    return new Observable<unknown>((subscriber) => {
      const subscription = call
        .pipe(
          tap(() => {
            this.pendingKey = null;
          }),
          finalize(() => this.busy.set(false)),
        )
        .subscribe({
          next: () => {
            this.fetch().subscribe({
              next: (value) => {
                this.keepSelection(phase);
                subscriber.next(value);
                subscriber.complete();
              },
              error: (error: unknown) => subscriber.error(error),
            });
          },
          error: (error: unknown) => {
            const failure = this.toFailure(error);
            this.failure.set(failure);
            if (failure.stale) {
              this.fetch().subscribe({ error: () => undefined });
            }
            subscriber.error(error);
          },
        });

      return () => subscription.unsubscribe();
    });
  }

  /** After a command the selection follows the phase, which may now have an id. */
  private keepSelection(previous: MesPhase): void {
    const rows = this.rows();
    const next = rows.find((row) => row.operation.id === previous.operation.id);
    this.selectedKey.set(next ? rowKey(next) : null);
  }

  private fetch(): Observable<unknown> {
    const workCenterId = this.workCenterId();
    if (!workCenterId) {
      return new Observable((subscriber) => subscriber.complete());
    }

    return this.api.getBoard(workCenterId, this.operatorId() ?? undefined).pipe(
      tap((response) => {
        this.board.set(response.data);
        this.receivedAtMs.set(Date.now());
        this.nowMs.set(Date.now());
      }),
    );
  }

  private toFailure(error: unknown): MesFailure {
    if (error instanceof HttpErrorResponse && error.status === 422) {
      const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
      const [field] = Object.keys(errors);

      return {
        field: field ?? null,
        message: (field ? errors[field]?.[0] : undefined) ?? String(error.error?.message ?? ''),
        stale: field === 'version' || field === 'status',
      };
    }

    return {
      field: null,
      message:
        error instanceof HttpErrorResponse
          ? String(error.error?.message ?? error.message)
          : String(error),
      stale: false,
    };
  }
}
