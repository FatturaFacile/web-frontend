import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { IlrGarment } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { IlrOutcome, lifecycleColor, wearPercent } from './industrial-laundry.util';
import { LockersStore } from './lockers.store';

/** Garment -> employee -> locker: who wears each nominal garment and where it is handed over. */
@Component({
  selector: 'app-ilr-lockers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [LockersStore],
  styleUrl: './industrial-laundry.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.INDUSTRIAL_LAUNDRY_LOCKERS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field wide" for="ilr-lock-customer">
        <span>{{ 'industrialLaundry.field.customer' | translate }}</span>
        <nz-select
          id="ilr-lock-customer"
          nzAllowClear
          nzShowSearch
          [ngModel]="store.customerId()"
          (ngModelChange)="store.setFilters({ customerId: $event })"
          [nzPlaceHolder]="'industrialLaundry.field.allCustomers' | translate"
        >
          @for (customer of store.customers(); track customer.id) {
            <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="ilr-lock-search">
        <span>{{ 'industrialLaundry.field.search' | translate }}</span>
        <input
          nz-input
          id="ilr-lock-search"
          maxlength="80"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="store.setFilters({ search: search() })"
        />
      </label>
      <button nz-button type="button" (click)="store.setFilters({ search: search() })">{{ 'industrialLaundry.action.search' | translate }}</button>
      <span class="spacer"></span>
      <button nz-button nzType="primary" type="button" (click)="openAssign()">{{ 'industrialLaundry.action.assign' | translate }}</button>
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
        [nzMessage]="(failure.errorKey ?? 'industrialLaundry.error.generic') | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table nzSize="small" [nzData]="store.groups()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'industrialLaundry.field.employee' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.locker' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.customer' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.garments' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (group of store.groups(); track group.customer_id + group.employee + group.locker_code) {
            <tr>
              <th scope="row">{{ group.employee }}</th>
              <td>{{ group.locker_code }}</td>
              <td>{{ store.customerName()(group.customer_id) }}</td>
              <td>
                @for (garment of group.garments; track garment.id) {
                  <div class="chips">
                    <span class="mono">{{ garment.epc_uid_rfid_hex }}</span>
                    <nz-tag>{{ 'industrialLaundry.articleType.' + garment.article_type | translate }}</nz-tag>
                    <nz-tag [nzColor]="stateColor(garment.current_lifecycle_state)">
                      {{ 'industrialLaundry.lifecycleState.' + garment.current_lifecycle_state | translate }}
                    </nz-tag>
                    @if (garment.max_certified_wash_cycles_limit !== null) {
                      <nz-tag [nzColor]="garment.is_reissue_blocked ? 'red' : 'default'">
                        {{ garment.wash_cycles_count }} / {{ garment.max_certified_wash_cycles_limit }}
                        ({{ wear(garment.wash_cycles_count, garment.max_certified_wash_cycles_limit) }}%)
                      </nz-tag>
                    } @else {
                      <nz-tag>{{ garment.wash_cycles_count }}</nz-tag>
                    }
                    <a
                      nz-popconfirm
                      [nzPopconfirmTitle]="'industrialLaundry.confirm.release' | translate"
                      (nzOnConfirm)="release(garment.id)"
                    >{{ 'industrialLaundry.action.release' | translate }}</a>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (store.groups().length === 0 && !store.loading()) {
        <nz-empty [nzNotFoundContent]="'industrialLaundry.empty.lockers' | translate"></nz-empty>
      }
    </nz-spin>

    <nz-modal
      [nzVisible]="assignOpen()"
      [nzTitle]="'industrialLaundry.section.assignLocker' | translate"
      [nzOkText]="'industrialLaundry.action.save' | translate"
      [nzCancelText]="'industrialLaundry.action.cancel' | translate"
      [nzOkDisabled]="!canAssign()"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="assign()"
      (nzOnCancel)="assignOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (modalFailure(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="(failure.errorKey ?? 'industrialLaundry.error.generic') | translate: failure.params"
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="ilr-lock-garment">
            <span>{{ 'industrialLaundry.field.garment' | translate }}</span>
            <nz-select id="ilr-lock-garment" nzShowSearch [ngModel]="garmentId()" (ngModelChange)="garmentId.set($event)">
              @for (garment of store.candidates(); track garment.id) {
                <nz-option [nzValue]="garment.id" [nzLabel]="candidateLabel(garment)"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="ilr-lock-employee">
            <span>{{ 'industrialLaundry.field.employee' | translate }}</span>
            <input nz-input id="ilr-lock-employee" maxlength="160" [ngModel]="employee()" (ngModelChange)="employee.set($event)" />
          </label>
          <label class="field" for="ilr-lock-code">
            <span>{{ 'industrialLaundry.field.locker' | translate }}</span>
            <input nz-input id="ilr-lock-code" maxlength="40" [ngModel]="locker()" (ngModelChange)="locker.set($event)" />
          </label>
          <label class="field" for="ilr-lock-assign-customer">
            <span>{{ 'industrialLaundry.field.customer' | translate }}</span>
            <nz-select id="ilr-lock-assign-customer" nzAllowClear nzShowSearch [ngModel]="customerId()" (ngModelChange)="customerId.set($event)">
              @for (customer of store.customers(); track customer.id) {
                <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
              }
            </nz-select>
          </label>
        </div>
        <p class="hint">{{ 'industrialLaundry.hint.assignLocker' | translate }}</p>
      </ng-container>
    </nz-modal>
  `,
})
export class LockersComponent implements OnInit {
  protected readonly store = inject(LockersStore);
  protected readonly search = signal('');
  protected readonly feedback = signal<IlrOutcome | null>(null);
  protected readonly modalFailure = signal<IlrOutcome | null>(null);
  protected readonly assignOpen = signal(false);
  protected readonly garmentId = signal<string | null>(null);
  protected readonly employee = signal('');
  protected readonly locker = signal('');
  protected readonly customerId = signal<string | null>(null);
  protected readonly stateColor = lifecycleColor;
  protected readonly wear = wearPercent;
  protected readonly canAssign = computed(
    () => this.garmentId() !== null && this.employee().trim() !== '' && this.locker().trim() !== '',
  );

  ngOnInit(): void {
    void this.store.init();
  }

  protected candidateLabel(garment: IlrGarment): string {
    return `${garment.epc_uid_rfid_hex}${garment.customer ? ' · ' + garment.customer.name : ''}`;
  }

  protected openAssign(): void {
    this.garmentId.set(null);
    this.employee.set('');
    this.locker.set('');
    this.customerId.set(this.store.customerId());
    this.modalFailure.set(null);
    this.assignOpen.set(true);
  }

  protected async assign(): Promise<void> {
    const garmentId = this.garmentId();
    if (garmentId === null || !this.canAssign()) {
      return;
    }
    const outcome = await this.store.assign(garmentId, {
      employee_name: this.employee().trim(),
      locker_code: this.locker().trim(),
      customer_id: this.customerId(),
    });
    if (outcome.ok) {
      this.assignOpen.set(false);
      this.feedback.set(null);
    } else {
      this.modalFailure.set(outcome);
    }
  }

  protected async release(garmentId: string): Promise<void> {
    const outcome = await this.store.release(garmentId);
    this.feedback.set(outcome.ok ? null : outcome);
  }
}
