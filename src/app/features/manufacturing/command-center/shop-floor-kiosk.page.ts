import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MfgOrderOperation, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { apiMessage, ConfirmationInput, ManufacturingFacadeService } from './manufacturing.facade';
import {
  clock,
  elapsedMs,
  IDLE_TIMER,
  minutesOf,
  pauseTimer,
  startTimer,
  TimerState,
  toQuantity,
} from './command-center.utils';

export const SCRAP_REASONS: readonly string[] = ['defect', 'material', 'setup', 'other'];

/**
 * Operator kiosk: large touch targets, high contrast. The operator picks an order and an operation, runs the timer
 * (start / pause) and counts good and scrap pieces; "Book" posts a confirmation with an `operation_posting_uuid` that is
 * generated per booking and reused when the same booking is retried after a failure.
 */
@Component({
  selector: 'app-shop-floor-kiosk',
  providers: [ManufacturingFacadeService],
  imports: [TranslatePipe],
  styles: `
    :host { display: block; background: #000; color: #fff; min-height: 100%; padding: 16px; font-size: 20px }
    h1 { color: #fff; font-size: 28px; margin: 0 0 16px }
    .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px }
    button { min-height: 64px; min-width: 64px; font-size: 22px; font-weight: 700; border-radius: 12px; border: 3px solid #fff; background: #1a1a1a; color: #fff; cursor: pointer; padding: 8px 16px }
    button:focus-visible { outline: 4px solid #ffd000; outline-offset: 3px }
    button:disabled { opacity: .45; cursor: not-allowed }
    .primary { background: #00c853; color: #000; border-color: #00c853 }
    .danger { background: #ff5252; color: #000; border-color: #ff5252 }
    .warn { background: #ffd000; color: #000; border-color: #ffd000 }
    .timer { font-size: 88px; font-weight: 800; font-variant-numeric: tabular-nums; text-align: center; margin: 8px 0 }
    .controls { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap }
    .counters { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin: 20px 0 }
    .counter { border: 3px solid #fff; border-radius: 12px; padding: 12px; text-align: center }
    .counter output { display: block; font-size: 64px; font-weight: 800; font-variant-numeric: tabular-nums }
    .steps { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap }
    .banner { border: 3px solid #ffd000; border-radius: 12px; padding: 12px; margin: 12px 0 }
    .banner.ok { border-color: #00c853 }
    .banner.err { border-color: #ff5252 }
    .meta { color: #d0d0d0 }
    label { display: flex; gap: 12px; align-items: center }
    input[type='checkbox'] { width: 32px; height: 32px }
  `,
  template: `
    <h1>{{ 'MFG_CC.KIOSK_TITLE' | translate }}</h1>

    @if (facade.kioskOrder() === null) {
      <h2>{{ 'MFG_CC.KIOSK_PICK_ORDER' | translate }}</h2>
      @if (facade.kioskOrders().length === 0 && !facade.kioskLoading()) {
        <p class="meta">{{ 'MFG_CC.KIOSK_NO_ORDERS' | translate }}</p>
      }
      <div class="list" role="list">
        @for (order of facade.kioskOrders(); track order.id) {
          <button type="button" role="listitem" [attr.data-testid]="'order-' + order.order_number" (click)="facade.selectKioskOrder(order.id)">
            {{ order.order_number }}<br /><span class="meta">{{ order.item_code }} {{ order.item_name }}</span>
          </button>
        }
      </div>
    } @else if (operation() === null) {
      <h2>{{ facade.kioskOrder()!.order_number }} — {{ 'MFG_CC.KIOSK_PICK_OPERATION' | translate }}</h2>
      <div class="list" role="list">
        @for (op of facade.kioskOperations(); track op.id) {
          <button type="button" role="listitem" [attr.data-testid]="'op-' + op.sequence" (click)="chooseOperation(op)">
            {{ op.sequence }} · {{ op.name }}
          </button>
        }
      </div>
      <p><button type="button" (click)="backToOrders()">{{ 'MFG_CC.KIOSK_BACK' | translate }}</button></p>
    } @else {
      <p class="meta">{{ facade.kioskOrder()!.order_number }} · {{ operation()!.sequence }} {{ operation()!.name }}</p>

      <div class="timer" role="timer" aria-live="off" [attr.aria-label]="'MFG_CC.KIOSK_TIMER' | translate" data-testid="timer">{{ display() }}</div>
      <div class="controls">
        <button type="button" class="primary" data-testid="start" [disabled]="running()" (click)="start()">
          {{ 'MFG_CC.KIOSK_START' | translate }}
        </button>
        <button type="button" class="warn" data-testid="pause" [disabled]="!running()" (click)="pause()">
          {{ 'MFG_CC.KIOSK_PAUSE' | translate }}
        </button>
      </div>

      <div class="counters">
        <div class="counter" role="group" [attr.aria-labelledby]="'good-label'">
          <div id="good-label">{{ 'MFG_CC.KIOSK_GOOD' | translate }}</div>
          <output data-testid="good" aria-live="polite">{{ good() }}</output>
          <div class="controls">
            <button type="button" data-testid="good-minus" [attr.aria-label]="'MFG_CC.KIOSK_MINUS_ONE' | translate" (click)="bump('good', -1)">−1</button>
            <button type="button" class="primary" data-testid="good-plus" [attr.aria-label]="'MFG_CC.KIOSK_PLUS_ONE' | translate" (click)="bump('good', 1)">+1</button>
            <button type="button" class="primary" data-testid="good-plus10" [attr.aria-label]="'MFG_CC.KIOSK_PLUS_TEN' | translate" (click)="bump('good', 10)">+10</button>
          </div>
        </div>
        <div class="counter" role="group" [attr.aria-labelledby]="'scrap-label'">
          <div id="scrap-label">{{ 'MFG_CC.KIOSK_SCRAP' | translate }}</div>
          <output data-testid="scrap" aria-live="polite">{{ scrap() }}</output>
          <div class="controls">
            <button type="button" data-testid="scrap-minus" [attr.aria-label]="'MFG_CC.KIOSK_MINUS_ONE' | translate" (click)="bump('scrap', -1)">−1</button>
            <button type="button" class="danger" data-testid="scrap-plus" [attr.aria-label]="'MFG_CC.KIOSK_PLUS_ONE' | translate" (click)="bump('scrap', 1)">+1</button>
          </div>
        </div>
      </div>

      @if (scrap() > 0) {
        <div class="controls" role="radiogroup" [attr.aria-label]="'MFG_CC.KIOSK_SCRAP_REASON' | translate">
          @for (reason of scrapReasons; track reason) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="scrapReason() === reason"
              [class.warn]="scrapReason() === reason"
              [attr.data-testid]="'reason-' + reason"
              (click)="scrapReason.set(reason)"
            >
              {{ 'MFG_CC.KIOSK_REASON_' + reason.toUpperCase() | translate }}
            </button>
          }
        </div>
      }

      <p>
        <label><input type="checkbox" data-testid="final" [checked]="isFinal()" (change)="isFinal.set(asChecked($event))" /> {{ 'MFG_CC.KIOSK_FINAL' | translate }}</label>
      </p>

      @if (banner(); as b) {
        <div class="banner" [class.ok]="b.kind === 'ok'" [class.err]="b.kind === 'err'" role="status" aria-live="assertive" data-testid="banner">{{ b.text }}</div>
      }

      <div class="controls">
        <button type="button" class="primary" data-testid="book" [disabled]="!canBook() || facade.posting()" (click)="book()">
          {{ (retrying() ? 'MFG_CC.KIOSK_RETRY' : 'MFG_CC.KIOSK_BOOK') | translate }}
        </button>
        <button type="button" (click)="backToOperations()">{{ 'MFG_CC.KIOSK_BACK' | translate }}</button>
      </div>
    }
  `,
})
export class ShopFloorKioskComponent implements OnInit {
  protected readonly facade = inject(ManufacturingFacadeService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly scrapReasons = SCRAP_REASONS;
  protected readonly operation = signal<MfgOrderOperation | null>(null);
  protected readonly good = signal(0);
  protected readonly scrap = signal(0);
  protected readonly scrapReason = signal<string | null>(null);
  protected readonly isFinal = signal(false);
  protected readonly timer = signal<TimerState>(IDLE_TIMER);
  protected readonly now = signal(Date.now());
  protected readonly retrying = signal(false);
  protected readonly banner = signal<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  protected readonly running = computed(() => this.timer().runningSince !== null);
  protected readonly display = computed(() => clock(elapsedMs(this.timer(), this.now())));
  protected readonly canBook = computed(
    () => (this.good() > 0 || this.scrap() > 0) && (this.scrap() === 0 || this.scrapReason() !== null),
  );

  private ticker: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.facade.loadKioskOrders();
    this.destroyRef.onDestroy(() => this.stopTicker());
  }

  protected asChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected chooseOperation(operation: MfgOrderOperation): void {
    this.resetCounters();
    this.operation.set(operation);
  }

  protected backToOrders(): void {
    this.facade.kioskOrder.set(null);
    this.operation.set(null);
  }

  protected backToOperations(): void {
    this.stopTicker();
    this.operation.set(null);
    this.resetCounters();
  }

  protected start(): void {
    const operation = this.operation();
    if (operation === null) {
      return;
    }
    const firstStart = this.timer().accumulatedMs === 0 && this.timer().runningSince === null;
    this.timer.set(startTimer(this.timer(), Date.now()));
    this.startTicker();
    if (firstStart) {
      this.facade.startOperation(operation.id).subscribe({
        error: () => this.banner.set({ kind: 'info', text: this.i18n.instant('MFG_CC.KIOSK_START_NOT_RECORDED') }),
      });
    }
  }

  protected pause(): void {
    this.timer.set(pauseTimer(this.timer(), Date.now()));
    this.stopTicker();
    this.now.set(Date.now());
  }

  protected bump(which: 'good' | 'scrap', delta: number): void {
    const target = which === 'good' ? this.good : this.scrap;
    target.set(Math.max(0, target() + delta));
    if (which === 'scrap' && this.scrap() === 0) {
      this.scrapReason.set(null);
    }
    this.retrying.set(false);
  }

  protected book(): void {
    const order = this.facade.kioskOrder();
    const operation = this.operation();
    if (order === null || operation === null || !this.canBook()) {
      return;
    }
    this.timer.set(pauseTimer(this.timer(), Date.now()));
    this.stopTicker();

    const input: ConfirmationInput = {
      runMinutes: minutesOf(elapsedMs(this.timer(), Date.now())),
      goodQuantity: toQuantity(this.good()),
      scrapQuantity: toQuantity(this.scrap()),
      ...(this.scrap() > 0 && this.scrapReason() ? { scrapReason: this.scrapReason() as string } : {}),
      isFinal: this.isFinal(),
    };

    this.facade.confirmOperation(order.id, operation.id, input).subscribe({
      next: (result) => {
        this.retrying.set(false);
        this.banner.set({
          kind: 'ok',
          text: this.i18n.instant(result.replayed ? 'MFG_CC.KIOSK_REPLAYED' : 'MFG_CC.KIOSK_BOOKED'),
        });
        this.message.success(this.i18n.instant(result.replayed ? 'MFG_CC.KIOSK_REPLAYED' : 'MFG_CC.KIOSK_BOOKED'));
        this.resetCounters();
        this.facade.selectKioskOrder(order.id);
      },
      error: (error: unknown) => {
        // The same booking pressed again keeps its posting uuid, so a request that did reach the server is not booked twice.
        this.retrying.set(true);
        this.banner.set({ kind: 'err', text: `${this.i18n.instant('MFG_CC.KIOSK_BOOK_FAILED')}: ${apiMessage(error)}` });
      },
    });
  }

  private resetCounters(): void {
    this.stopTicker();
    this.timer.set(IDLE_TIMER);
    this.good.set(0);
    this.scrap.set(0);
    this.scrapReason.set(null);
    this.isFinal.set(false);
    this.retrying.set(false);
  }

  private startTicker(): void {
    this.stopTicker();
    this.ticker = setInterval(() => this.now.set(Date.now()), 1000);
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}
