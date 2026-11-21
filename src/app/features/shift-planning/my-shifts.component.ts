import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ComplianceIssue,
  EligibleSwapPeer,
  ShiftAssignment,
  ShiftPlanningApiService,
  ShiftSwapRequest,
  SwapStatus,
  TeamShift,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  buildIcs,
  canRespond,
  groupByDate,
  localClock,
  swapRole,
  SwapRole,
} from './my-shifts.util';
import { issuesOfError, problemDetail, templateLabel } from './shift-planning.util';

const WINDOW_DAYS = 28;
const STATUS_KEYS: Readonly<Record<SwapStatus, string>> = {
  pending_peer_acceptance: 'SHIFT_PLANNING.SWAP_WAITING_PEER',
  pending_manager_approval: 'SHIFT_PLANNING.SWAP_WAITING_MANAGER',
  approved: 'SHIFT_PLANNING.SWAP_APPROVED',
  rejected: 'SHIFT_PLANNING.SWAP_REJECTED',
};
const ROLE_KEYS: Readonly<Record<SwapRole, string>> = {
  outgoing: 'SHIFT_PLANNING.SWAP_OUTGOING',
  incoming: 'SHIFT_PLANNING.SWAP_INCOMING',
  broadcast: 'SHIFT_PLANNING.SWAP_BROADCAST',
};
const BROADCAST = '__broadcast__';

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * Employee self-service of the shift planning: the own agenda (and the team's) with an iCal export, the open shifts an
 * employee can claim, and the swaps with colleagues. The API answers with the compliance findings of every claim.
 */
@Component({
  selector: 'app-my-shifts',
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
    NzSwitchModule,
    NzTabsModule,
    NzTagModule,
  ],
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .day {
      margin-bottom: 16px;
    }
    .day h4 {
      margin: 0 0 8px;
      text-transform: capitalize;
    }
    .shift {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      margin-bottom: 8px;
      border: 1px solid var(--ant-border-color-split, #f0f0f0);
      border-left-width: 4px;
      border-radius: 6px;
    }
    .shift .grow {
      flex: 1;
      min-width: 160px;
    }
    .field {
      display: block;
      margin-bottom: 16px;
    }
    .field span {
      display: block;
      margin-bottom: 4px;
    }
  `,
  template: `
    <app-page-header
      [title]="'SHIFT_PLANNING.MY_TITLE' | translate"
      [subtitle]="'SHIFT_PLANNING.MY_SUBTITLE' | translate"
    >
      <button nz-button (click)="exportIcs()" [disabled]="shifts().length === 0">
        {{ 'SHIFT_PLANNING.EXPORT_ICS' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        (click)="openSwapModal()"
        [disabled]="shifts().length === 0"
      >
        {{ 'SHIFT_PLANNING.ASK_SWAP' | translate }}
      </button>
    </app-page-header>

    <nz-card>
      <div class="toolbar">
        <button nz-button nzSize="small" (click)="move(-1)">
          {{ 'SHIFT_PLANNING.PREVIOUS' | translate }}
        </button>
        <strong>{{ from() }} - {{ to() }}</strong>
        <button nz-button nzSize="small" (click)="move(1)">
          {{ 'SHIFT_PLANNING.NEXT' | translate }}
        </button>
      </div>

      <nz-spin [nzSpinning]="loading()">
        <nz-tabs [(nzSelectedIndex)]="tab">
          <nz-tab [nzTitle]="'SHIFT_PLANNING.TAB_AGENDA' | translate">
            <div class="toolbar">
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label
                ><nz-switch [ngModel]="showTeam()" (ngModelChange)="toggleTeam($event)"></nz-switch>
                {{ 'SHIFT_PLANNING.TEAM_VIEW' | translate }}</label
              >
            </div>
            @for (day of agenda(); track day[0]) {
              <section class="day">
                <h4>{{ dayLabel(day[0]) }}</h4>
                @for (shift of day[1]; track shift.id) {
                  <div class="shift" [style.border-left-color]="shift.color">
                    <span class="grow">
                      <strong>{{ shift.range }}</strong> · {{ shift.label }}
                      @if (shift.who) {
                        · {{ shift.who }}
                      }
                    </span>
                    @for (tag of shift.tags; track tag) {
                      <nz-tag>{{ tag }}</nz-tag>
                    }
                  </div>
                }
              </section>
            } @empty {
              <nz-empty [nzNotFoundContent]="'SHIFT_PLANNING.NO_SHIFTS' | translate"></nz-empty>
            }
          </nz-tab>

          <nz-tab [nzTitle]="'SHIFT_PLANNING.TAB_OPEN' | translate">
            @for (shift of openShifts(); track shift.id) {
              <div class="shift" [style.border-left-color]="shift.template?.color_hex ?? '#d9d9d9'">
                <span class="grow">
                  <strong>{{ shift.shift_date }}</strong> · {{ range(shift) }} · {{ label(shift) }}
                </span>
                <button
                  nz-button
                  nzType="primary"
                  nzSize="small"
                  [disabled]="claiming() === shift.id"
                  (click)="claim(shift)"
                >
                  {{ 'SHIFT_PLANNING.CLAIM' | translate }}
                </button>
              </div>
            } @empty {
              <nz-empty
                [nzNotFoundContent]="'SHIFT_PLANNING.NO_OPEN_SHIFTS' | translate"
              ></nz-empty>
            }
          </nz-tab>

          <nz-tab [nzTitle]="'SHIFT_PLANNING.TAB_SWAPS' | translate">
            @for (swap of swaps(); track swap.id) {
              <div
                class="shift"
                [style.border-left-color]="swap.assignment?.template?.color_hex ?? '#d9d9d9'"
              >
                <span class="grow">
                  <nz-tag>{{ roleKey(swap) | translate }}</nz-tag>
                  @if (swap.assignment; as assignment) {
                    <strong>{{ assignment.shift_date }}</strong> · {{ range(assignment) }} ·
                    {{ label(assignment) }}
                  }
                  @if (swap.target_assignment; as counter) {
                    ⇄ {{ counter.shift_date }} · {{ range(counter) }}
                  }
                </span>
                <nz-tag>{{ statusKey(swap) | translate }}</nz-tag>
                @if (swap.rejection_reason) {
                  <span>{{ swap.rejection_reason }}</span>
                }
                @if (respondable(swap)) {
                  <button
                    nz-button
                    nzType="primary"
                    nzSize="small"
                    (click)="respond(swap, 'approve')"
                  >
                    {{ 'SHIFT_PLANNING.SWAP_ACCEPT' | translate }}
                  </button>
                  <button nz-button nzDanger nzSize="small" (click)="respond(swap, 'reject')">
                    {{ 'SHIFT_PLANNING.SWAP_DECLINE' | translate }}
                  </button>
                }
              </div>
            } @empty {
              <nz-empty [nzNotFoundContent]="'SHIFT_PLANNING.NO_SWAPS' | translate"></nz-empty>
            }
          </nz-tab>
        </nz-tabs>
      </nz-spin>
    </nz-card>

    <nz-modal
      [nzVisible]="swapOpen()"
      [nzTitle]="'SHIFT_PLANNING.SWAP_REQUEST' | translate"
      [nzOkText]="'SHIFT_PLANNING.SEND_REQUEST' | translate"
      [nzOkDisabled]="!swapShiftId || !swapPeer || sending()"
      (nzOnCancel)="swapOpen.set(false)"
      (nzOnOk)="sendSwap()"
    >
      <ng-container *nzModalContent>
        <div class="field">
          <span>{{ 'SHIFT_PLANNING.SWAP_MY_SHIFT' | translate }}</span>
          <nz-select
            style="width: 100%"
            [ngModel]="swapShiftId"
            (ngModelChange)="pickShift($event)"
            [nzPlaceHolder]="'SHIFT_PLANNING.SWAP_MY_SHIFT' | translate"
          >
            @for (shift of shifts(); track shift.id) {
              <nz-option
                [nzValue]="shift.id"
                [nzLabel]="shift.shift_date + ' · ' + range(shift) + ' · ' + label(shift)"
              ></nz-option>
            }
          </nz-select>
        </div>
        @if (swapShiftId) {
          <div class="field">
            <span>{{ 'SHIFT_PLANNING.SWAP_PEER' | translate }}</span>
            <nz-select
              style="width: 100%"
              [ngModel]="swapPeer"
              (ngModelChange)="pickPeer($event)"
              [nzLoading]="peersLoading()"
            >
              <nz-option
                [nzValue]="broadcast"
                [nzLabel]="'SHIFT_PLANNING.SWAP_ANY' | translate"
              ></nz-option>
              @for (peer of peers(); track peer.employee_id) {
                <nz-option [nzValue]="peer.employee_id" [nzLabel]="peer.name"></nz-option>
              }
            </nz-select>
          </div>
          @for (issue of peerWarnings(); track issue.rule_code + issue.translation_key) {
            <nz-alert
              nzType="warning"
              nzShowIcon
              [nzMessage]="describe(issue)"
              style="margin-bottom: 8px"
            ></nz-alert>
          }
          @if (counterOptions().length > 0) {
            <div class="field">
              <span>{{ 'SHIFT_PLANNING.SWAP_COUNTER' | translate }}</span>
              <nz-select
                style="width: 100%"
                nzAllowClear
                [(ngModel)]="counterShiftId"
                [nzPlaceHolder]="'SHIFT_PLANNING.SWAP_NO_COUNTER' | translate"
              >
                @for (shift of counterOptions(); track shift.id) {
                  <nz-option
                    [nzValue]="shift.id"
                    [nzLabel]="shift.shift_date + ' · ' + (shift.template_code ?? '')"
                  ></nz-option>
                }
              </nz-select>
            </div>
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class MyShiftsComponent implements OnInit {
  private readonly api = inject(ShiftPlanningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly broadcast = BROADCAST;
  tab = 0;
  readonly from = signal(new Date().toISOString().slice(0, 10));
  readonly to = computed(() => addDays(this.from(), WINDOW_DAYS - 1));
  readonly loading = signal(false);
  readonly shifts = signal<ShiftAssignment[]>([]);
  readonly team = signal<TeamShift[]>([]);
  readonly openShifts = signal<ShiftAssignment[]>([]);
  readonly swaps = signal<ShiftSwapRequest[]>([]);
  readonly showTeam = signal(false);
  readonly claiming = signal<string | null>(null);

  readonly swapOpen = signal(false);
  readonly sending = signal(false);
  readonly peersLoading = signal(false);
  readonly peers = signal<EligibleSwapPeer[]>([]);
  swapShiftId: string | null = null;
  swapPeer: string | null = null;
  counterShiftId: string | null = null;

  /** Taken from the own shifts: the swap list says who asked, not who is reading. */
  readonly employeeId = computed(
    () => this.shifts().find((s) => s.employee_id)?.employee_id ?? null,
  );

  readonly agenda = computed(() => {
    const own = this.shifts().map((shift) => ({
      id: shift.id,
      shift_date: shift.shift_date,
      range: this.range(shift),
      label: this.label(shift),
      color: shift.template?.color_hex ?? '#d9d9d9',
      who: '',
      tags: this.tagLabels(shift),
    }));
    const mine = new Set(this.shifts().map((s) => s.id));
    const others = this.showTeam()
      ? this.team()
          .filter((shift) => !mine.has(shift.id))
          .map((shift) => ({
            id: shift.id,
            shift_date: shift.shift_date,
            range: `${localClock(shift.start_at)}-${localClock(shift.end_at)}`,
            label: shift.template
              ? templateLabel(shift.template.name, this.translate.currentLanguage())
              : '',
            color: shift.template?.color_hex ?? '#d9d9d9',
            who: shift.employee_name ?? '',
            tags: [] as string[],
          }))
      : [];
    return groupByDate([...own, ...others]).map(
      ([day, items]) =>
        [day, items.sort((a, b) => a.range.localeCompare(b.range))] as [string, typeof items],
    );
  });

  readonly peerWarnings = computed<ComplianceIssue[]>(() => this.selectedPeer()?.warnings ?? []);
  readonly counterOptions = computed(() => this.selectedPeer()?.shifts ?? []);

  ngOnInit(): void {
    this.load();
  }

  move(direction: -1 | 1): void {
    this.from.set(addDays(this.from(), direction * WINDOW_DAYS));
    this.load();
  }

  toggleTeam(value: boolean): void {
    this.showTeam.set(value);
    if (value) {
      this.api.getTeamShifts(this.from(), this.to()).subscribe({
        next: (response) => this.team.set(response.data),
        error: () => this.message.error(this.translate.instant('SHIFT_PLANNING.LOAD_ERROR')),
      });
    }
  }

  load(): void {
    this.loading.set(true);
    let pending = 3;
    const done = (): void => {
      pending -= 1;
      if (pending === 0) {
        this.loading.set(false);
      }
    };
    const failed = (): void => {
      this.message.error(this.translate.instant('SHIFT_PLANNING.LOAD_ERROR'));
      done();
    };
    this.api.getMyShifts(this.from(), this.to()).subscribe({
      next: (response) => {
        this.shifts.set(response.data);
        done();
      },
      error: failed,
    });
    this.api.getOpenShifts(this.from(), this.to()).subscribe({
      next: (response) => {
        this.openShifts.set(response.data);
        done();
      },
      error: failed,
    });
    this.api.getMySwaps().subscribe({
      next: (response) => {
        this.swaps.set(response.data);
        done();
      },
      error: failed,
    });
    if (this.showTeam()) {
      this.toggleTeam(true);
    }
  }

  range(shift: Pick<ShiftAssignment, 'start_at' | 'end_at'>): string {
    return `${localClock(shift.start_at)}-${localClock(shift.end_at)}`;
  }

  label(shift: ShiftAssignment): string {
    return shift.template
      ? templateLabel(shift.template.name, this.translate.currentLanguage())
      : '';
  }

  dayLabel(date: string): string {
    return new Intl.DateTimeFormat(this.translate.currentLanguage(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  }

  describe(issue: ComplianceIssue): string {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(issue.params)) {
      params[key] = value === null ? '' : typeof value === 'boolean' ? String(value) : value;
    }
    return this.translate.instant(issue.translation_key, params);
  }

  exportIcs(): void {
    const content = buildIcs(
      this.shifts().map((shift) => ({
        id: shift.id,
        start_at: shift.start_at,
        end_at: shift.end_at,
        summary: this.label(shift) || this.translate.instant('SHIFT_PLANNING.MY_TITLE'),
      })),
    );
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shifts.ics';
    link.click();
    URL.revokeObjectURL(url);
  }

  claim(shift: ShiftAssignment): void {
    this.claiming.set(shift.id);
    this.api.claimOpenShift(shift.id).subscribe({
      next: (response) => {
        this.claiming.set(null);
        this.message.success(this.translate.instant('SHIFT_PLANNING.CLAIMED'));
        const warning = response.data.warnings[0];
        if (warning) {
          this.message.warning(this.describe(warning));
        }
        this.load();
      },
      error: (error: unknown) => {
        this.claiming.set(null);
        this.refused(error);
      },
    });
  }

  roleKey(swap: ShiftSwapRequest): string {
    return ROLE_KEYS[swapRole(swap, this.employeeId())];
  }

  statusKey(swap: ShiftSwapRequest): string {
    return STATUS_KEYS[swap.status];
  }

  respondable(swap: ShiftSwapRequest): boolean {
    return canRespond(swap, this.employeeId());
  }

  respond(swap: ShiftSwapRequest, decision: 'approve' | 'reject'): void {
    this.api.respondToSwap(swap.id, decision).subscribe({
      next: () => {
        this.message.success(this.translate.instant('SHIFT_PLANNING.SWAP_ANSWERED'));
        this.load();
      },
      error: (error: unknown) => this.refused(error),
    });
  }

  openSwapModal(): void {
    this.swapShiftId = null;
    this.swapPeer = null;
    this.counterShiftId = null;
    this.peers.set([]);
    this.swapOpen.set(true);
  }

  pickShift(id: string | null): void {
    this.swapShiftId = id;
    this.swapPeer = null;
    this.counterShiftId = null;
    this.peers.set([]);
    if (!id) {
      return;
    }
    this.peersLoading.set(true);
    this.api.getEligiblePeers(id).subscribe({
      next: (response) => {
        this.peers.set(response.data);
        this.peersLoading.set(false);
      },
      error: () => {
        this.peersLoading.set(false);
        this.message.error(this.translate.instant('SHIFT_PLANNING.LOAD_ERROR'));
      },
    });
  }

  pickPeer(id: string | null): void {
    this.swapPeer = id;
    this.counterShiftId = null;
    this.selectedId.set(id);
  }

  sendSwap(): void {
    if (!this.swapShiftId || !this.swapPeer) {
      return;
    }
    this.sending.set(true);
    this.api
      .requestSwap({
        shift_assignment_id: this.swapShiftId,
        target_peer_employee_id: this.swapPeer === BROADCAST ? null : this.swapPeer,
        target_shift_assignment_id: this.counterShiftId,
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.swapOpen.set(false);
          this.message.success(this.translate.instant('SHIFT_PLANNING.SWAP_SENT'));
          this.tab = 2;
          this.load();
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.refused(error);
        },
      });
  }

  private readonly selectedId = signal<string | null>(null);

  private selectedPeer(): EligibleSwapPeer | null {
    const id = this.selectedId();
    return id ? (this.peers().find((peer) => peer.employee_id === id) ?? null) : null;
  }

  private tagLabels(shift: ShiftAssignment): string[] {
    return (shift.surcharge_breakdown?.tags ?? []).map((tag) =>
      this.translate.instant(`SHIFT_PLANNING.TAG_${tag.toUpperCase()}`),
    );
  }

  private refused(error: unknown): void {
    const first = issuesOfError(error)[0];
    this.message.error(
      first
        ? this.describe(first)
        : (problemDetail(error) ?? this.translate.instant('SHIFT_PLANNING.CHANGE_REFUSED')),
    );
  }
}
