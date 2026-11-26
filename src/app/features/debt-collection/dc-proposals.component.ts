import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DC_CURRENCIES,
  DC_JURISDICTIONS,
  DC_LEVELS,
  DC_LOCALES,
  DcChannel,
  DcCurrency,
  DcJurisdiction,
  DcLevel,
  DcLocale,
  DcProposalFilters,
  PermissionsService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ArCustomerSelectComponent } from '../receivables/ar-customer-select.component';
import { DcFeedback } from './dc-feedback.service';
import {
  DEBT_COLLECTION_MODULE,
  exclusionReasonColor,
  isSelectable,
  levelColor,
  orUndefined,
  proposalStatusColor,
  reachableChannels,
} from './debt-collection.util';
import { DcLookupsStore } from './lookups.store';
import { WorkbenchStore } from './workbench.store';

/**
 * The proposal queue: the open items the policy puts at a dunning level, with the groups (one notice per customer,
 * currency and level), the exclusion reasons, the calculation drawer and the bulk generation (with or without dispatch).
 */
@Component({
  selector: 'app-dc-proposals',
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    ArCustomerSelectComponent,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './debt-collection.scss',
  template: `
    <div class="toolbar">
      <label class="field" for="dc-asof">
        <span>{{ 'debtCollection.field.asOf' | translate }}</span>
        <input
          nz-input
          id="dc-asof"
          type="date"
          [ngModel]="store.filters().as_of ?? ''"
          (ngModelChange)="setFilter({ as_of: $event || undefined })"
        />
      </label>
      <label class="field" for="dc-jurisdiction">
        <span>{{ 'debtCollection.field.jurisdiction' | translate }}</span>
        <nz-select
          nzId="dc-jurisdiction"
          nzAllowClear
          [nzPlaceHolder]="'debtCollection.action.all' | translate"
          [ngModel]="store.filters().jurisdiction ?? null"
          (ngModelChange)="setFilter({ jurisdiction: orUndef($event) })"
        >
          @for (value of jurisdictions; track value) {
            <nz-option
              [nzValue]="value"
              [nzLabel]="'debtCollection.jurisdiction.' + value | translate"
            />
          }
        </nz-select>
      </label>
      <label class="field" for="dc-currency">
        <span>{{ 'debtCollection.field.currency' | translate }}</span>
        <nz-select
          nzId="dc-currency"
          nzAllowClear
          [nzPlaceHolder]="'debtCollection.action.all' | translate"
          [ngModel]="store.filters().currency ?? null"
          (ngModelChange)="setFilter({ currency: orUndef($event) })"
        >
          @for (value of currencies; track value) {
            <nz-option [nzValue]="value" [nzLabel]="value" />
          }
        </nz-select>
      </label>
      <label class="field" for="dc-level">
        <span>{{ 'debtCollection.field.level' | translate }}</span>
        <nz-select
          nzId="dc-level"
          nzAllowClear
          [nzPlaceHolder]="'debtCollection.action.all' | translate"
          [ngModel]="store.filters().level ?? null"
          (ngModelChange)="setFilter({ level: $event ?? undefined })"
        >
          @for (value of levels; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'debtCollection.level.' + value | translate" />
          }
        </nz-select>
      </label>
      <div class="field wide">
        <span>{{ 'debtCollection.field.customer' | translate }}</span>
        <app-ar-customer-select
          [customerId]="store.filters().customer_id ?? null"
          (customerChange)="setFilter({ customer_id: $event?.id })"
        />
      </div>
      <label class="field" for="dc-search">
        <span>{{ 'debtCollection.field.search' | translate }}</span>
        <input
          nz-input
          id="dc-search"
          maxlength="60"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keydown.enter)="applySearch()"
          (blur)="applySearch()"
        />
      </label>
      <label
        nz-checkbox
        for="dc-prop-show-excluded"
        nzId="dc-prop-show-excluded"
        [ngModel]="store.filters().include_excluded === 1"
        (ngModelChange)="setFilter({ include_excluded: $event ? 1 : 0 })"
      >
        {{ 'debtCollection.field.showExcluded' | translate }}
      </label>
      <button nz-button type="button" (click)="store.loadProposals()">
        {{ 'debtCollection.action.refresh' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate" />
    }

    @if (canWrite) {
      <div class="selection-bar" role="status">
        <label
          nz-checkbox
          for="dc-prop-select-all"
          nzId="dc-prop-select-all"
          [ngModel]="allSelected()"
          [nzIndeterminate]="store.selectedCount() > 0 && !allSelected()"
          [attr.aria-label]="'debtCollection.action.selectAll' | translate"
          (ngModelChange)="store.selectAll($event)"
        ></label>
        <span>
          {{
            'debtCollection.proposals.selected'
              | translate: { groups: store.selectedCount(), items: store.selectedItemCount() }
          }}
        </span>
        @for (total of store.selectedTotals(); track total.currency) {
          <strong>{{ total.amount | money: total.currency }}</strong>
        }
        <button
          nz-button
          type="button"
          [disabled]="store.selectedCount() === 0"
          (click)="openGenerate(false)"
        >
          {{ 'debtCollection.action.generate' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="store.selectedCount() === 0"
          (click)="openGenerate(true)"
        >
          {{ 'debtCollection.action.generateDispatch' | translate }}
        </button>
      </div>
    }

    <nz-spin [nzSpinning]="store.loadingProposals()">
      <h3 class="section-title">{{ 'debtCollection.proposals.groups' | translate }}</h3>
      <nz-table #groupTable nzSize="small" [nzData]="store.groups()" [nzShowPagination]="false">
        <thead>
          <tr>
            @if (canWrite) {
              <th scope="col"></th>
            }
            <th scope="col">{{ 'debtCollection.field.customer' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.level' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.jurisdiction' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.items' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.principal' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.interest' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.fee' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.newDueDate' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.channels' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (group of groupTable.data; track group.key) {
            <tr>
              @if (canWrite) {
                <td>
                  <label
                    nz-checkbox
                    [attr.for]="'dc-prop-grp-' + group.key"
                    [nzId]="'dc-prop-grp-' + group.key"
                    [ngModel]="store.selected().includes(group.key)"
                    [attr.aria-label]="group.customer_name"
                    (ngModelChange)="store.toggleGroup(group.key, $event)"
                  ></label>
                </td>
              }
              <th scope="row">{{ group.customer_name }}</th>
              <td>
                <nz-tag [nzColor]="color(group.level)">{{
                  'debtCollection.level.' + group.level | translate
                }}</nz-tag>
              </td>
              <td>{{ 'debtCollection.jurisdiction.' + group.jurisdiction | translate }}</td>
              <td class="num">{{ group.receivable_item_ids.length }}</td>
              <td class="num">{{ group.principal | money: group.currency }}</td>
              <td class="num">{{ group.interest | money: group.currency }}</td>
              <td class="num">{{ group.fee | money: group.currency }}</td>
              <td class="num">
                <strong>{{ group.total | money: group.currency }}</strong>
              </td>
              <td>{{ group.new_due_date }}</td>
              <td>
                <div class="inline-tags">
                  @for (channel of reachable(group); track channel) {
                    <nz-tag>{{ 'debtCollection.channel.' + channel | translate }}</nz-tag>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loadingProposals() && store.groups().length === 0) {
        <nz-empty [nzNotFoundContent]="'debtCollection.proposals.emptyGroups' | translate" />
      }

      <h3 class="section-title">{{ 'debtCollection.proposals.items' | translate }}</h3>
      <nz-table #itemTable nzSize="small" [nzData]="store.items()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'debtCollection.field.document' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.customer' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.dueDate' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.daysOverdue' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.openAmount' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.currentLevel' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.proposedLevel' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.interest' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.fee' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (item of itemTable.data; track item.receivable_item_id) {
            <tr [class.muted]="!selectable(item)">
              <th scope="row">{{ item.document_number }}</th>
              <td>{{ item.customer_name }}</td>
              <td>{{ item.due_date }}</td>
              <td class="num">{{ item.days_overdue }}</td>
              <td class="num">{{ item.open_amount | money: item.currency }}</td>
              <td>
                @if (item.current_level !== null) {
                  <nz-tag [nzColor]="color(item.current_level)">{{
                    'debtCollection.level.' + item.current_level | translate
                  }}</nz-tag>
                } @else {
                  <span class="muted">{{ 'debtCollection.level.none' | translate }}</span>
                }
              </td>
              <td>
                @if (item.proposed_level !== null) {
                  <nz-tag [nzColor]="color(item.proposed_level)">{{
                    'debtCollection.level.' + item.proposed_level | translate
                  }}</nz-tag>
                }
              </td>
              <td class="num">
                {{ item.interest_amount | money: item.currency }}
                <small class="muted">
                  {{
                    'debtCollection.proposals.interestHint'
                      | translate: { days: item.interest_days, rate: item.interest_rate_percent }
                  }}
                </small>
              </td>
              <td class="num">{{ item.fee_amount | money: item.currency }}</td>
              <td class="num">{{ item.total | money: item.currency }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(item.status)">{{
                  'debtCollection.proposalStatus.' + item.status | translate
                }}</nz-tag>
                @if (item.exclusion_reason; as reason) {
                  <nz-tag [nzColor]="reasonColor(reason)">{{
                    'debtCollection.exclusionReason.' + reason | translate
                  }}</nz-tag>
                }
                @if (item.waiting_until; as until) {
                  <small class="muted">
                    {{ 'debtCollection.proposals.waitingUntil' | translate: { date: until } }}
                  </small>
                }
              </td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  (click)="store.openCalculation(item)"
                >
                  {{ 'debtCollection.action.calculation' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loadingProposals() && store.items().length === 0) {
        <nz-empty [nzNotFoundContent]="'debtCollection.proposals.emptyItems' | translate" />
      }
    </nz-spin>

    <nz-drawer
      [nzVisible]="store.calculationItem() !== null"
      [nzWidth]="560"
      [nzTitle]="'debtCollection.calculation.title' | translate"
      (nzOnClose)="store.closeCalculation()"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="store.calculating()">
          @if (store.calculationItem(); as item) {
            <p>
              <strong>{{ item.document_number }}</strong> · {{ item.customer_name }}
            </p>
          }
          @if (store.calculation(); as calc) {
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
              <nz-descriptions-item [nzTitle]="'debtCollection.field.principal' | translate">
                {{ calc.principal | money: currencyOfCalc() }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.interest' | translate">
                {{ calc.interest | money: currencyOfCalc() }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.fee' | translate">
                {{ calc.fee | money: currencyOfCalc() }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.total' | translate">
                <strong>{{ calc.total | money: currencyOfCalc() }}</strong>
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.interestDays' | translate">
                {{ calc.interest_days }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.rate' | translate">
                {{ calc.rate_percent }} %
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.interestBasis' | translate">
                {{ 'debtCollection.interestBasis.' + calc.basis | translate }}
              </nz-descriptions-item>
            </nz-descriptions>
            <h4 class="section-title">{{ 'debtCollection.calculation.segments' | translate }}</h4>
            <nz-table nzSize="small" [nzData]="calc.segments" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'debtCollection.field.from' | translate }}</th>
                  <th scope="col">{{ 'debtCollection.field.to' | translate }}</th>
                  <th scope="col" class="num">{{ 'debtCollection.field.days' | translate }}</th>
                  <th scope="col" class="num">{{ 'debtCollection.field.rate' | translate }}</th>
                  <th scope="col" class="num">{{ 'debtCollection.field.interest' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (segment of calc.segments; track segment.from) {
                  <tr>
                    <td>{{ segment.from }}</td>
                    <td>{{ segment.to }}</td>
                    <td class="num">{{ segment.days }}</td>
                    <td class="num">{{ segment.rate_percent }} %</td>
                    <td class="num">{{ segment.interest | money: currencyOfCalc() }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-spin>
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="generateOpen()"
      [nzTitle]="
        (dispatch() ? 'debtCollection.generate.titleDispatch' : 'debtCollection.generate.title')
          | translate
      "
      [nzOkText]="'debtCollection.action.confirm' | translate"
      [nzCancelText]="'debtCollection.action.cancel' | translate"
      [nzOkLoading]="store.generating()"
      [nzOkDisabled]="!canConfirm()"
      (nzOnOk)="confirmGenerate()"
      (nzOnCancel)="generateOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <div class="stack">
          <p>
            {{
              'debtCollection.generate.summary'
                | translate: { groups: store.selectedCount(), items: store.selectedItemCount() }
            }}
          </p>
          <label class="field" for="dc-gen-channel">
            <span>{{ 'debtCollection.field.channel' | translate }}</span>
            <nz-select
              nzId="dc-gen-channel"
              [ngModel]="channel()"
              (ngModelChange)="channel.set($event)"
            >
              @for (value of lookups.lookups().channels; track value) {
                <nz-option
                  [nzValue]="value"
                  [nzLabel]="'debtCollection.channel.' + value | translate"
                />
              }
            </nz-select>
          </label>
          <label class="field" for="dc-gen-locale">
            <span>{{ 'debtCollection.field.locale' | translate }}</span>
            <nz-select
              nzId="dc-gen-locale"
              nzAllowClear
              [nzPlaceHolder]="'debtCollection.generate.customerLocale' | translate"
              [ngModel]="locale()"
              (ngModelChange)="locale.set($event)"
            >
              @for (value of locales; track value) {
                <nz-option
                  [nzValue]="value"
                  [nzLabel]="'debtCollection.locale.' + value | translate"
                />
              }
            </nz-select>
          </label>
          <label class="field" for="dc-gen-charges">
            <span>{{ 'debtCollection.generate.postCharges' | translate }}</span>
            <nz-switch
              nzId="dc-gen-charges"
              [ngModel]="postCharges()"
              (ngModelChange)="postCharges.set($event)"
            />
            <small class="hint">{{ 'debtCollection.generate.postChargesHint' | translate }}</small>
          </label>
          @if (unreachable() > 0) {
            <nz-alert
              nzType="warning"
              nzShowIcon
              [nzMessage]="
                'debtCollection.generate.unreachable' | translate: { count: unreachable() }
              "
            />
          }
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class DcProposalsComponent implements OnInit {
  protected readonly store = inject(WorkbenchStore);
  protected readonly lookups = inject(DcLookupsStore);
  private readonly feedback = inject(DcFeedback);

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly jurisdictions: readonly DcJurisdiction[] = DC_JURISDICTIONS;
  protected readonly currencies: readonly DcCurrency[] = DC_CURRENCIES;
  protected readonly levels: readonly DcLevel[] = DC_LEVELS;
  protected readonly locales: readonly DcLocale[] = DC_LOCALES;

  protected readonly search = signal('');
  protected readonly generateOpen = signal(false);
  protected readonly dispatch = signal(false);
  protected readonly channel = signal<DcChannel>('email');
  protected readonly locale = signal<DcLocale | null>(null);
  protected readonly postCharges = signal(true);

  protected readonly allSelected = computed(
    () =>
      this.store.groups().length > 0 && this.store.selectedCount() === this.store.groups().length,
  );

  /** Selected groups the customer cannot be reached on through the chosen channel. */
  protected readonly unreachable = computed(
    () =>
      this.store
        .selectedGroups()
        .filter((group) => !reachableChannels(group).includes(this.channel())).length,
  );

  /** A dispatch needs a reachable address for every group; a plain generation still creates the drafts. */
  protected readonly canConfirm = computed(
    () => this.store.selectedCount() > 0 && !(this.dispatch() && this.unreachable() > 0),
  );

  protected readonly orUndef = orUndefined;
  protected readonly color = levelColor;
  protected readonly statusColor = proposalStatusColor;
  protected readonly reasonColor = exclusionReasonColor;
  protected readonly selectable = isSelectable;
  protected readonly reachable = reachableChannels;

  ngOnInit(): void {
    void this.lookups.ensureLoaded();
    void this.store.loadProposals();
  }

  protected currencyOfCalc(): string {
    return this.store.calculationItem()?.currency ?? 'CHF';
  }

  protected setFilter(patch: Partial<DcProposalFilters>): void {
    void this.store.setFilters(patch);
  }

  protected applySearch(): void {
    const term = this.search().trim();
    if (term !== (this.store.filters().search ?? '')) {
      void this.store.setFilters({ search: term || undefined });
    }
  }

  protected openGenerate(dispatch: boolean): void {
    this.dispatch.set(dispatch);
    const groups = this.store.selectedGroups();
    // Prefer the first channel every selected group can be reached on.
    const common = this.lookups
      .lookups()
      .channels.find((channel) =>
        groups.every((group) => reachableChannels(group).includes(channel)),
      );
    this.channel.set(common ?? groups[0]?.channels[0] ?? 'email');
    this.generateOpen.set(true);
  }

  protected async confirmGenerate(): Promise<void> {
    const locale = this.locale();
    const { outcome, result } = await this.store.generate({
      channel: this.channel(),
      ...(locale ? { locale } : {}),
      post_charges: this.postCharges(),
      dispatch: this.dispatch(),
    });
    if (
      this.feedback.report(outcome, 'debtCollection.msg.generated', {
        count: result?.notices.length ?? 0,
      })
    ) {
      this.generateOpen.set(false);
    }
  }
}
