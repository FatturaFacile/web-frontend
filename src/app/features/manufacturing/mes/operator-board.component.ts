import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManufacturingApiService, MfgWorkCenterResource } from '@core';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n/i18n.service';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MesBoardStore, MesDeclarationInput, MesLotInput } from './mes-board.store';
import { MesDeclarationDialogComponent } from './mes-declaration-dialog.component';
import { MesLotDialogComponent } from './mes-lot-dialog.component';
import { MesSuspendDialogComponent } from './mes-suspend-dialog.component';
import { formatDuration, rowKey } from './mes-time.utils';
import { MesAction, MesPhase, MesPhaseStatus, MesSuspensionReason } from './mes.models';

const STATUS_COLORS: Record<MesPhaseStatus, string> = {
  available: 'default',
  assigned: 'blue',
  setup: 'gold',
  running: 'green',
  suspended: 'red',
  closed: 'default',
};

/**
 * Touch-screen operator board of a work centre (Italian: board operatore MES). The left column lists the phases being
 * worked and the operations ready to be taken over; the right side shows the selected phase with live man time, machine
 * time, setup, run and downtime counters, the good and scrapped pieces, and an action bar that enables only the transitions
 * the server allows in the current state. Declarations and lots open in large touch dialogs.
 */
@Component({
  selector: 'app-operator-board',
  providers: [MesBoardStore],
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTagModule,
    MesSuspendDialogComponent,
    MesDeclarationDialogComponent,
    MesLotDialogComponent,
  ],
  styles: `
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    .toolbar nz-select {
      min-width: 280px;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) minmax(0, 2fr);
      gap: 16px;
    }
    @media (max-width: 960px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .row {
      display: block;
      width: 100%;
      min-height: 88px;
      padding: 10px 14px;
      text-align: left;
      border: 3px solid #0b1f33;
      border-radius: 14px;
      background: #ffffff;
      color: #0b1f33;
      touch-action: manipulation;
      cursor: pointer;
    }
    .row[aria-pressed='true'] {
      background: #0b1f33;
      color: #ffffff;
    }
    .row:focus-visible {
      outline: 4px solid #ffb000;
      outline-offset: 2px;
    }
    .row strong {
      font-size: 1.15rem;
    }
    .row small {
      display: block;
      opacity: 0.9;
    }
    .banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .banner h2 {
      margin: 0;
      font-size: 1.5rem;
    }
    .counters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .counter {
      padding: 10px 14px;
      border: 2px solid #0b1f33;
      border-radius: 12px;
      background: #f4f8fc;
    }
    .counter.live {
      border-color: #0a7d2c;
    }
    .counter.down {
      border-color: #8c1d18;
    }
    .counter span {
      display: block;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .counter output {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .pieces {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }
    .actions button {
      min-height: 76px;
      font-size: 1.15rem;
      font-weight: 700;
      white-space: normal;
    }
  `,
  template: `
    <app-page-header
      [title]="'MFG_MES.TITLE' | translate"
      [subtitle]="'MFG_MES.SUBTITLE' | translate"
    ></app-page-header>

    <div class="toolbar">
      <nz-select
        data-testid="work-center"
        nzSize="large"
        [ngModel]="store.workCenterId()"
        [nzPlaceHolder]="'MFG_MES.SELECT_WORK_CENTER' | translate"
        [attr.aria-label]="'MFG_MES.SELECT_WORK_CENTER' | translate"
        (ngModelChange)="selectWorkCenter($event)"
      >
        @for (center of workCenters(); track center.id) {
          <nz-option
            [nzValue]="center.id"
            [nzLabel]="center.work_center_code + ' · ' + center.name"
          ></nz-option>
        }
      </nz-select>
      <button
        nz-button
        nzSize="large"
        type="button"
        data-testid="refresh"
        [disabled]="!store.workCenterId() || store.loading()"
        (click)="reload()"
      >
        {{ 'MFG_MES.REFRESH' | translate }}
      </button>
    </div>

    @if (store.failure(); as failure) {
      <nz-alert
        class="alert"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.message"
        (nzOnClose)="store.clearFailure()"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (!store.workCenterId()) {
        <nz-empty [nzNotFoundContent]="'MFG_MES.PICK_WORK_CENTER' | translate"></nz-empty>
      } @else if (store.rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'MFG_MES.NOTHING_TO_DO' | translate"></nz-empty>
      } @else {
        <div class="layout">
          <div class="rows" role="list">
            @for (row of store.rows(); track key(row)) {
              <button
                type="button"
                class="row"
                role="listitem"
                [attr.data-testid]="'row-' + row.operation.id"
                [attr.aria-pressed]="key(row) === selectedKey()"
                (click)="store.select(key(row))"
              >
                <strong
                  >{{ row.production_order.order_number }} · {{ row.operation.sequence }}
                  {{ row.operation.name }}</strong
                >
                <small
                  >{{ row.production_order.item_code }} {{ row.production_order.item_name }}</small
                >
                <nz-tag [nzColor]="color(row.status)">{{
                  'RES.V.' + row.status | translate
                }}</nz-tag>
              </button>
            }
          </div>

          @if (store.selected(); as phase) {
            <div>
              <div class="banner" data-testid="status-banner">
                <h2>
                  {{ phase.production_order.order_number }} · {{ phase.operation.sequence }}
                  {{ phase.operation.name }}
                </h2>
                <span>
                  <nz-tag [nzColor]="color(phase.status)" data-testid="status-tag">{{
                    'RES.V.' + phase.status | translate
                  }}</nz-tag>
                  @if (phase.status === 'running') {
                    <nz-tag nzColor="geekblue">{{
                      'RES.V.' + phase.machine_mode | translate
                    }}</nz-tag>
                  }
                  @if (phase.open_interval?.suspension_reason; as reason) {
                    <nz-tag nzColor="red">{{ 'RES.V.' + reason | translate }}</nz-tag>
                  }
                </span>
              </div>

              @if (store.live(); as live) {
                <div class="counters">
                  <div
                    class="counter"
                    [class.live]="phase.status === 'running' || phase.status === 'setup'"
                  >
                    <span>{{ 'MFG_MES.MAN_TIME' | translate }}</span><output
                      data-testid="man-time"
                      >{{ duration(live.man) }}</output
                    >
                  </div>
                  <div
                    class="counter"
                    [class.live]="phase.status === 'running' || phase.status === 'setup'"
                  >
                    <span>{{ 'MFG_MES.MACHINE_TIME' | translate }}</span><output
                      data-testid="machine-time"
                      >{{ duration(live.machine) }}</output
                    >
                  </div>
                  <div class="counter">
                    <span>{{ 'MFG_MES.SETUP_TIME' | translate }}</span
                    ><output data-testid="setup-time">{{ duration(live.setup) }}</output>
                  </div>
                  <div class="counter">
                    <span>{{ 'MFG_MES.RUN_TIME' | translate }}</span
                    ><output data-testid="run-time">{{ duration(live.run) }}</output>
                  </div>
                  <div class="counter down">
                    <span>{{ 'MFG_MES.DOWNTIME' | translate }}</span
                    ><output data-testid="downtime">{{ duration(live.downtime) }}</output>
                  </div>
                </div>
              }

              <div class="pieces">
                <nz-statistic
                  [nzTitle]="'MFG_MES.GOOD_PIECES' | translate"
                  [nzValue]="phase.declared.good_quantity"
                ></nz-statistic>
                <nz-statistic
                  [nzTitle]="'MFG_MES.SCRAP_PIECES' | translate"
                  [nzValue]="phase.declared.scrap_quantity"
                ></nz-statistic>
                <nz-statistic
                  [nzTitle]="'MFG_MES.TARGET' | translate"
                  [nzValue]="phase.production_order.target_quantity ?? '-'"
                ></nz-statistic>
              </div>

              @if (phase.engineering_drawing; as drawing) {
                <nz-alert
                  data-testid="mes-engineering-drawing"
                  [nzType]="drawing.is_obsolete ? 'error' : 'info'"
                  nzShowIcon
                  [nzMessage]="drawing.is_obsolete ? ('PLM.WATERMARK_OBSOLETE' | translate) : ('PLM.MES_DRAWING_TITLE' | translate)"
                  [nzDescription]="(drawing.is_obsolete ? ('PLM.WATERMARK_WARNING' | translate) + ' — ' : '') + 'Rev. ' + drawing.revision_code + (drawing.technical_file_ref ? ' · ' + drawing.technical_file_ref : '')"
                  style="margin-bottom: 16px"
                ></nz-alert>
              }

              <div class="actions" role="toolbar" [attr.aria-label]="'MFG_MES.ACTIONS' | translate">
                <button
                  nz-button
                  nzType="primary"
                  nzSize="large"
                  type="button"
                  data-testid="take-over"
                  [disabled]="!can('take_over') || !operatorId()"
                  (click)="takeOver()"
                >
                  {{ 'MFG_MES.TAKE_OVER' | translate }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  nzSize="large"
                  type="button"
                  data-testid="start-setup"
                  [disabled]="!can('start_setup')"
                  (click)="run(store.startSetup(), 'MFG_MES.DONE_SETUP')"
                >
                  {{ 'MFG_MES.START_SETUP' | translate }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  nzSize="large"
                  type="button"
                  data-testid="start-run"
                  [disabled]="
                    !can('start_production') ||
                    (phase.status === 'running' && phase.machine_mode === 'attended')
                  "
                  (click)="run(store.startProduction('attended'), 'MFG_MES.DONE_RUN')"
                >
                  {{ 'MFG_MES.START_RUN' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="large"
                  type="button"
                  data-testid="start-run-unattended"
                  [disabled]="
                    !can('start_production') ||
                    (phase.status === 'running' && phase.machine_mode === 'unattended')
                  "
                  (click)="run(store.startProduction('unattended'), 'MFG_MES.DONE_RUN')"
                >
                  {{ 'MFG_MES.START_RUN_UNATTENDED' | translate }}
                </button>
                <button
                  nz-button
                  nzDanger
                  nzSize="large"
                  type="button"
                  data-testid="suspend"
                  [disabled]="!can('suspend')"
                  (click)="suspendOpen.set(true)"
                >
                  {{ 'MFG_MES.SUSPEND' | translate }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  nzSize="large"
                  type="button"
                  data-testid="resume"
                  [disabled]="!can('resume')"
                  (click)="run(store.resume(), 'MFG_MES.DONE_RESUME')"
                >
                  {{ 'MFG_MES.RESUME' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="large"
                  type="button"
                  data-testid="declare"
                  [disabled]="!can('declare_production')"
                  (click)="declareOpen.set(true)"
                >
                  {{ 'MFG_MES.DECLARE' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="large"
                  type="button"
                  data-testid="lot"
                  [disabled]="!can('consume_material')"
                  (click)="lotOpen.set(true)"
                >
                  {{ 'MFG_MES.REGISTER_LOT' | translate }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  nzDanger
                  nzSize="large"
                  type="button"
                  data-testid="close"
                  [disabled]="!can('close')"
                  (click)="confirmClose()"
                >
                  {{ 'MFG_MES.CLOSE_PHASE' | translate }}
                </button>
              </div>

              <app-mes-suspend-dialog
                [(visible)]="suspendOpen"
                [busy]="store.busy()"
                (confirmed)="suspend($event)"
              ></app-mes-suspend-dialog>
              <app-mes-declaration-dialog
                [(visible)]="declareOpen"
                [busy]="store.busy()"
                (confirmed)="declare($event)"
              ></app-mes-declaration-dialog>
              <app-mes-lot-dialog
                [(visible)]="lotOpen"
                [busy]="store.busy()"
                [components]="phase.components ?? []"
                (confirmed)="consume($event)"
              ></app-mes-lot-dialog>
            </div>
          }
        </div>
      }
    </nz-spin>
  `,
})
export class OperatorBoardComponent implements OnInit {
  protected readonly store = inject(MesBoardStore);
  private readonly api = inject(ManufacturingApiService);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  protected readonly workCenters = signal<MfgWorkCenterResource[]>([]);
  protected readonly suspendOpen = signal(false);
  protected readonly declareOpen = signal(false);
  protected readonly lotOpen = signal(false);
  protected readonly selectedKey = computed(() => {
    const selected = this.store.selected();

    return selected ? rowKey(selected) : null;
  });
  protected readonly operatorId = computed(() => this.auth.user()?.id ?? null);
  private readonly lotDialog = viewChild(MesLotDialogComponent);

  ngOnInit(): void {
    this.store.setOperator(this.operatorId());
    this.store.start();
    this.api
      .getWorkCenters({ per_page: 100 })
      .subscribe({ next: (res) => this.workCenters.set(res.data) });
  }

  protected selectWorkCenter(id: string | null): void {
    if (id) {
      this.store.load(id).subscribe({ error: () => undefined });
    }
  }

  protected reload(): void {
    this.store.refresh().subscribe({ error: () => undefined });
  }

  protected color(status: MesPhaseStatus): string {
    return STATUS_COLORS[status];
  }

  protected key(phase: MesPhase): string {
    return rowKey(phase);
  }

  protected duration(seconds: number): string {
    return formatDuration(seconds);
  }

  protected can(action: MesAction): boolean {
    return this.store.allowed().has(action) && !this.store.busy();
  }

  protected takeOver(): void {
    this.run(this.store.takeOver(), 'MFG_MES.DONE_TAKE_OVER');
  }

  protected suspend(reason: MesSuspensionReason): void {
    this.run(this.store.suspend(reason), 'MFG_MES.DONE_SUSPEND', () => this.suspendOpen.set(false));
  }

  protected declare(input: MesDeclarationInput): void {
    this.run(this.store.declare(input), 'MFG_MES.DONE_DECLARE', () => this.declareOpen.set(false));
  }

  protected consume(input: MesLotInput): void {
    this.run(this.store.consume(input), 'MFG_MES.DONE_LOT', () => {
      this.lotDialog()?.reset();
      this.lotOpen.set(false);
    });
  }

  protected confirmClose(): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('MFG_MES.CLOSE_CONFIRM_TITLE'),
      nzContent: this.i18n.translate('MFG_MES.CLOSE_CONFIRM_BODY'),
      nzOkText: this.i18n.translate('MFG_MES.CLOSE_PHASE'),
      nzCancelText: this.i18n.translate('MFG_MES.CANCEL'),
      nzOkDanger: true,
      nzOnOk: () => this.run(this.store.close(), 'MFG_MES.DONE_CLOSE'),
    });
  }

  /** Runs a store command, if it is allowed, and shows its outcome. */
  protected run(
    command: ReturnType<MesBoardStore['startSetup']>,
    doneKey: string,
    onDone?: () => void,
  ): void {
    if (command === null) {
      return;
    }
    command.subscribe({
      next: () => {
        this.message.success(this.i18n.translate(doneKey));
        onDone?.();
      },
      error: () => undefined,
    });
  }
}
