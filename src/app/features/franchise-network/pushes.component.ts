import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FRN_PUSH_TYPES,
  FrnPush,
  FrnPushCreatePayload,
  FrnPushPayload,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  FRANCHISE_NETWORK_MANAGE_MODULE,
  FrnOutcome,
  pushStatusColor,
  targetStatusColor,
} from './franchise-network.util';
import { PushesStore } from './pushes.store';

/**
 * One-click distribution from the franchisor to its stores: catalogue (items, variants, images, recipes), price lists with
 * recommended or maximum prices (Swiss stores only ever receive recommendations, LCart), promotions and loyalty campaigns. The
 * monitor shows pending, synced, acknowledged and failed deliveries of every store, and retries the failed ones.
 */
@Component({
  selector: 'app-frn-pushes',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [PushesStore],
  styleUrl: './franchise-network.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FRANCHISE_NETWORK_PUSHES' | translate"></app-page-header>

    <div class="toolbar">
      <span class="spacer"></span>
      @if (canManage) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'franchiseNetwork.action.newPush' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #table nzSize="small" [nzData]="store.pushes()" [nzShowPagination]="false" [nzScroll]="{ x: '900px' }">
        <thead>
          <tr>
            <th scope="col">{{ 'franchiseNetwork.field.title' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.pushType' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.status' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.section.deliveries' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.dispatchedAt' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <th scope="row">{{ row.title }}</th>
              <td>{{ 'franchiseNetwork.pushType.' + row.push_type | translate }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{ 'franchiseNetwork.pushStatus.' + row.status | translate }}</nz-tag>
              </td>
              <td class="tags">
                @for (entry of summary(row); track entry.status) {
                  <nz-tag [nzColor]="targetColor(entry.status)">{{ 'franchiseNetwork.targetStatus.' + entry.status | translate }}: {{ entry.count }}</nz-tag>
                }
              </td>
              <td>{{ row.dispatched_at ?? '—' }}</td>
              <td class="row-actions">
                <button nz-button nzSize="small" type="button" (click)="store.openDetail(row.id)">
                  {{ 'franchiseNetwork.action.monitor' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6">
                <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.pushes' | translate"></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="store.detail() !== null"
      [nzWidth]="720"
      [nzTitle]="'franchiseNetwork.section.deliveries' | translate"
      (nzOnClose)="store.closeDetail()"
    >
      <ng-container *nzDrawerContent>
        @if (store.detail(); as detail) {
          <h3>{{ detail.title }}</h3>
          <div class="toolbar">
            @if (canManage && detail.status === 'draft') {
              <button nz-button nzType="primary" type="button" [nzLoading]="store.saving()" (click)="run(store.dispatch(detail.id))">
                {{ 'franchiseNetwork.action.dispatch' | translate }}
              </button>
            }
            @if (canManage && (detail.status === 'partial' || detail.status === 'failed')) {
              <button nz-button type="button" [nzLoading]="store.saving()" (click)="run(store.retry(detail.id))">
                {{ 'franchiseNetwork.action.retryFailed' | translate }}
              </button>
            }
          </div>
          <nz-table #targets nzSize="small" [nzData]="detail.targets ?? []" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'franchiseNetwork.field.store' | translate }}</th>
                <th scope="col">{{ 'franchiseNetwork.field.status' | translate }}</th>
                <th scope="col" class="num">{{ 'franchiseNetwork.field.attempts' | translate }}</th>
                <th scope="col">{{ 'franchiseNetwork.field.lastError' | translate }}</th>
                <th scope="col">{{ 'franchiseNetwork.field.nextRetry' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (target of targets.data; track target.id) {
                <tr>
                  <th scope="row">{{ target.store_code }} <small class="muted">{{ target.store_name }}</small></th>
                  <td><nz-tag [nzColor]="targetColor(target.status)">{{ 'franchiseNetwork.targetStatus.' + target.status | translate }}</nz-tag></td>
                  <td class="num">{{ target.attempts }}</td>
                  <td>
                    @if (target.last_error) {
                      {{ 'franchiseNetwork.error.' + target.last_error | translate }}
                    } @else {
                      —
                    }
                  </td>
                  <td>{{ target.next_retry_at ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="720"
      [nzTitle]="'franchiseNetwork.section.newPush' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
            [nzDescription]="failure.detail ?? undefined"
          ></nz-alert>
        }
        <form [formGroup]="form" class="form" (ngSubmit)="submit(true)">
          <label class="field" for="frn-p-type">
            <span>{{ 'franchiseNetwork.field.pushType' | translate }}</span>
            <nz-select nzId="frn-p-type" formControlName="push_type">
              @for (type of types; track type) {
                <nz-option [nzValue]="type" [nzLabel]="'franchiseNetwork.pushType.' + type | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-p-title">
            <span>{{ 'franchiseNetwork.field.title' | translate }}</span>
            <input nz-input id="frn-p-title" formControlName="title" maxlength="200" />
          </label>
          <label class="field" for="frn-p-mode">
            <span>{{ 'franchiseNetwork.field.targetMode' | translate }}</span>
            <nz-select nzId="frn-p-mode" formControlName="target_mode">
              <nz-option nzValue="all" [nzLabel]="'franchiseNetwork.targetMode.all' | translate"></nz-option>
              <nz-option nzValue="selected" [nzLabel]="'franchiseNetwork.targetMode.selected' | translate"></nz-option>
            </nz-select>
          </label>
          @if (form.controls.target_mode.value === 'selected') {
            <label class="field" for="frn-p-stores">
              <span>{{ 'franchiseNetwork.field.stores' | translate }}</span>
              <nz-select nzId="frn-p-stores" nzMode="multiple" formControlName="store_ids">
                @for (option of store.stores(); track option.id) {
                  <nz-option [nzValue]="option.id" [nzLabel]="option.code + ' ' + option.name"></nz-option>
                }
              </nz-select>
            </label>
          }
          <label class="field" for="frn-p-effective">
            <span>{{ 'franchiseNetwork.field.effectiveFrom' | translate }}</span>
            <input nz-input id="frn-p-effective" type="date" formControlName="effective_from" />
          </label>

          @switch (form.controls.push_type.value) {
            @case ('catalog') {
              <h4>{{ 'franchiseNetwork.section.items' | translate }}</h4>
              <div formArrayName="items">
                @for (item of items.controls; track $index; let i = $index) {
                  <div class="tiers" [formGroupName]="i">
                    <input nz-input formControlName="sku" maxlength="60" [attr.aria-label]="'franchiseNetwork.field.sku' | translate" />
                    <input nz-input formControlName="name" maxlength="200" [attr.aria-label]="'franchiseNetwork.field.name' | translate" />
                    <nz-input-number formControlName="price" [nzMin]="0" [attr.aria-label]="'franchiseNetwork.field.price' | translate"></nz-input-number>
                    <nz-select formControlName="price_type" [attr.aria-label]="'franchiseNetwork.field.priceType' | translate">
                      <nz-option nzValue="recommended" [nzLabel]="'franchiseNetwork.priceType.recommended' | translate"></nz-option>
                      <nz-option nzValue="maximum" [nzLabel]="'franchiseNetwork.priceType.maximum' | translate"></nz-option>
                    </nz-select>
                  </div>
                }
              </div>
              <button nz-button type="button" (click)="addRow(items)">{{ 'franchiseNetwork.action.addRow' | translate }}</button>
            }
            @case ('price_list') {
              <h4>{{ 'franchiseNetwork.section.prices' | translate }}</h4>
              <div formArrayName="prices">
                @for (price of prices.controls; track $index; let i = $index) {
                  <div class="tiers" [formGroupName]="i">
                    <input nz-input formControlName="sku" maxlength="60" [attr.aria-label]="'franchiseNetwork.field.sku' | translate" />
                    <nz-input-number formControlName="price" [nzMin]="0" [attr.aria-label]="'franchiseNetwork.field.price' | translate"></nz-input-number>
                    <nz-select formControlName="price_type" [attr.aria-label]="'franchiseNetwork.field.priceType' | translate">
                      <nz-option nzValue="recommended" [nzLabel]="'franchiseNetwork.priceType.recommended' | translate"></nz-option>
                      <nz-option nzValue="maximum" [nzLabel]="'franchiseNetwork.priceType.maximum' | translate"></nz-option>
                    </nz-select>
                  </div>
                }
              </div>
              <button nz-button type="button" (click)="addRow(prices)">{{ 'franchiseNetwork.action.addRow' | translate }}</button>
              <nz-alert nzType="info" nzShowIcon [nzMessage]="'franchiseNetwork.hint.swissPrices' | translate"></nz-alert>
            }
            @case ('promotion') {
              <label class="field" for="frn-p-promo-name">
                <span>{{ 'franchiseNetwork.field.name' | translate }}</span>
                <input nz-input id="frn-p-promo-name" formControlName="promo_name" maxlength="200" />
              </label>
              <label class="field" for="frn-p-promo-from">
                <span>{{ 'franchiseNetwork.field.validFrom' | translate }}</span>
                <input nz-input id="frn-p-promo-from" type="date" formControlName="valid_from" />
              </label>
              <label class="field" for="frn-p-promo-to">
                <span>{{ 'franchiseNetwork.field.validTo' | translate }}</span>
                <input nz-input id="frn-p-promo-to" type="date" formControlName="valid_to" />
              </label>
              <label class="field" for="frn-p-promo-discount">
                <span>{{ 'franchiseNetwork.field.discountPercent' | translate }}</span>
                <nz-input-number nzId="frn-p-promo-discount" formControlName="discount_percent" [nzMin]="0" [nzMax]="100"></nz-input-number>
              </label>
            }
            @case ('loyalty_campaign') {
              <label class="field" for="frn-p-loy-name">
                <span>{{ 'franchiseNetwork.field.name' | translate }}</span>
                <input nz-input id="frn-p-loy-name" formControlName="promo_name" maxlength="200" />
              </label>
              <label class="field" for="frn-p-loy-mult">
                <span>{{ 'franchiseNetwork.field.pointsMultiplier' | translate }}</span>
                <nz-input-number nzId="frn-p-loy-mult" formControlName="points_multiplier" [nzMin]="0" [nzMax]="100" [nzStep]="0.5"></nz-input-number>
              </label>
              <label class="field" for="frn-p-loy-from">
                <span>{{ 'franchiseNetwork.field.validFrom' | translate }}</span>
                <input nz-input id="frn-p-loy-from" type="date" formControlName="valid_from" />
              </label>
              <label class="field" for="frn-p-loy-to">
                <span>{{ 'franchiseNetwork.field.validTo' | translate }}</span>
                <input nz-input id="frn-p-loy-to" type="date" formControlName="valid_to" />
              </label>
            }
          }

          <div class="actions">
            <button nz-button nzType="primary" type="submit" [nzLoading]="store.saving()" [disabled]="form.invalid">
              {{ 'franchiseNetwork.action.pushNow' | translate }}
            </button>
            <button nz-button type="button" [disabled]="form.invalid" (click)="submit(false)">
              {{ 'franchiseNetwork.action.saveDraft' | translate }}
            </button>
            <button nz-button type="button" (click)="close()">
              {{ 'franchiseNetwork.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class PushesComponent implements OnInit {
  protected readonly store = inject(PushesStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canManage = inject(PermissionsService).canWrite(FRANCHISE_NETWORK_MANAGE_MODULE);
  protected readonly types = FRN_PUSH_TYPES;
  protected readonly statusColor = pushStatusColor;
  protected readonly targetColor = targetStatusColor;

  protected readonly drawerOpen = signal(false);
  protected readonly feedback = signal<FrnOutcome | null>(null);
  protected readonly formError = signal<FrnOutcome | null>(null);

  protected readonly items = new FormArray([this.itemGroup()]);
  protected readonly prices = new FormArray([this.priceGroup()]);

  protected readonly form = this.fb.group({
    push_type: ['catalog' as FrnPushCreatePayload['push_type'], Validators.required],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    target_mode: ['all' as FrnPushCreatePayload['target_mode'], Validators.required],
    store_ids: [[] as string[]],
    effective_from: [''],
    items: this.items,
    prices: this.prices,
    promo_name: [''],
    valid_from: [''],
    valid_to: [''],
    discount_percent: [0],
    points_multiplier: [1],
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected summary(push: FrnPush): { status: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const target of push.targets ?? []) {
      counts.set(target.status, (counts.get(target.status) ?? 0) + 1);
    }
    return [...counts.entries()].map(([status, count]) => ({ status, count }));
  }

  private itemGroup() {
    return this.fb.group({ sku: [''], name: [''], price: [0], price_type: ['recommended'] });
  }

  private priceGroup() {
    return this.fb.group({ sku: [''], price: [0], price_type: ['recommended'] });
  }

  protected addRow(array: FormArray): void {
    array.push(array === this.items ? this.itemGroup() : this.priceGroup());
  }

  protected openCreate(): void {
    this.form.reset({ push_type: 'catalog', target_mode: 'all', store_ids: [], points_multiplier: 1, discount_percent: 0 });
    this.items.clear();
    this.items.push(this.itemGroup());
    this.prices.clear();
    this.prices.push(this.priceGroup());
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected close(): void {
    this.drawerOpen.set(false);
  }

  protected async run(call: Promise<FrnOutcome>): Promise<void> {
    const outcome = await call;
    this.feedback.set(outcome.ok ? null : outcome);
  }

  /** The payload of the pushed content, from the part of the form the push type uses. */
  private payload(): FrnPushPayload {
    const value = this.form.getRawValue();
    switch (value.push_type) {
      case 'catalog':
        return {
          items: value.items
            .filter((item) => item.sku !== '')
            .map((item) => ({ sku: item.sku, name: item.name, price: item.price, price_type: item.price_type as 'recommended' | 'maximum' })),
        };
      case 'price_list':
        return {
          prices: value.prices
            .filter((price) => price.sku !== '')
            .map((price) => ({ sku: price.sku, price: price.price, price_type: price.price_type as 'recommended' | 'maximum' })),
        };
      case 'promotion':
        return {
          promotion: {
            name: value.promo_name,
            valid_from: value.valid_from,
            valid_to: value.valid_to,
            discount_percent: value.discount_percent,
          },
        };
      case 'loyalty_campaign':
        return {
          loyalty: {
            name: value.promo_name,
            points_multiplier: value.points_multiplier,
            ...(value.valid_from ? { valid_from: value.valid_from } : {}),
            ...(value.valid_to ? { valid_to: value.valid_to } : {}),
          },
        };
    }
  }

  protected async submit(dispatch: boolean): Promise<void> {
    const value = this.form.getRawValue();
    const payload: FrnPushCreatePayload = {
      push_type: value.push_type,
      title: value.title,
      target_mode: value.target_mode,
      ...(value.target_mode === 'selected' ? { store_ids: value.store_ids } : {}),
      effective_from: value.effective_from || null,
      payload: this.payload(),
      dispatch,
    };
    const outcome = await this.store.create(payload);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('franchiseNetwork.notification.pushCreated'));
      this.close();
    } else {
      this.formError.set(outcome);
    }
  }
}
