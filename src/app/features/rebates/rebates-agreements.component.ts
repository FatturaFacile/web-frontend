import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ContactResource,
  CrmApiService,
  REBATE_AGREEMENT_STATUSES,
  REBATE_DIRECTIONS,
  REBATE_TIER_MODES,
  RebateAgreement,
  RebateAgreementRequest,
  RebateAgreementStatus,
  RebateDirection,
  RebatesApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { AGREEMENT_STATUS_COLORS, apiErrorText, blankToNull, contactLabel, loadContacts, todayIso } from './rebates.util';

/** Volume rebate agreements with customers (sales) and suppliers (purchases) and the scale of their tiers. */
@Component({
  selector: 'app-rebates-agreements',
  styleUrl: './rebates.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'REBATES.AGREEMENTS_TITLE' | translate" [subtitle]="'REBATES.AGREEMENTS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="directionFilter()" (ngModelChange)="directionFilter.set($event); load()" [nzPlaceHolder]="'REBATES.DIRECTION' | translate">
        @for (direction of directions; track direction) {
          <nz-option [nzValue]="direction" [nzLabel]="('REBATES.DIRECTION_' + direction.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 200px" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" [nzPlaceHolder]="'REBATES.STATUS' | translate">
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="('REBATES.STATUS_' + status.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="agreements()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'REBATES.CODE' | translate }}</th>
            <th>{{ 'REBATES.NAME' | translate }}</th>
            <th>{{ 'REBATES.DIRECTION' | translate }}</th>
            <th>{{ 'REBATES.CONTACT' | translate }}</th>
            <th>{{ 'REBATES.PERIOD' | translate }}</th>
            <th>{{ 'REBATES.STATUS' | translate }}</th>
            <th class="num">{{ 'REBATES.OPEN_REBATE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>
                <a [routerLink]="['/rebates/agreements', row.id]">{{ row.code }}</a>
              </td>
              <td>{{ row.name }}</td>
              <td>{{ ('REBATES.DIRECTION_' + row.direction.toUpperCase()) | translate }}</td>
              <td>{{ row.contact_name }}</td>
              <td>{{ row.starts_on }} - {{ row.ends_on }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{ ('REBATES.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td class="num">{{ row.open_rebate ?? '0' | number: '1.2-2' }} {{ row.currency }}</td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'draft') {
                    <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                    <button nz-button nzType="text" nz-popconfirm [nzPopconfirmTitle]="'REBATES.ACTIVATE_CONFIRM' | translate" (nzOnConfirm)="activate(row)">{{ 'REBATES.ACTIVATE' | translate }}</button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'REBATES.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && agreements().length === 0) {
        <nz-empty [nzNotFoundContent]="'REBATES.NO_AGREEMENTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'REBATES.EDIT_AGREEMENT' : 'REBATES.NEW_AGREEMENT') | translate" nzWidth="720px" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rb-code">{{ 'REBATES.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rb-name">{{ 'REBATES.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-name" formControlName="name" maxlength="160" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'REBATES.DIRECTION' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="direction">
                  @for (direction of directions; track direction) {
                    <nz-option [nzValue]="direction" [nzLabel]="('REBATES.DIRECTION_' + direction.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'REBATES.CONTACT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="contact_id" nzShowSearch>
                  @for (contact of contacts(); track contact.id) {
                    <nz-option [nzValue]="contact.id" [nzLabel]="label(contact)"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'REBATES.TIER_MODE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="tier_mode">
                  @for (mode of tierModes; track mode) {
                    <nz-option [nzValue]="mode" [nzLabel]="('REBATES.MODE_' + mode.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rb-start">{{ 'REBATES.STARTS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-start" type="date" formControlName="starts_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rb-end">{{ 'REBATES.ENDS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-end" type="date" formControlName="ends_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="rb-currency">{{ 'REBATES.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-currency" formControlName="currency" maxlength="3" /></nz-form-control>
            </nz-form-item>
          </div>

          <h4>{{ 'REBATES.TIERS' | translate }}</h4>
          <div formArrayName="tiers">
            @for (tier of tiers.controls; track $index; let index = $index) {
              <div class="tier-row" [formGroupName]="index">
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'REBATES.THRESHOLD' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="threshold_amount" /></nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'REBATES.RATE_PERCENT' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input type="number" min="0" max="100" step="any" formControlName="rate_percent" /></nz-form-control>
                </nz-form-item>
                <button nz-button nzType="text" nzDanger type="button" appIconAction="delete" [disabled]="tiers.length === 1" (click)="removeTier(index)"></button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addTier()">{{ 'REBATES.ADD_TIER' | translate }}</button>

          <nz-form-item>
            <nz-form-label nzFor="rb-notes">{{ 'REBATES.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="rb-notes" rows="2" formControlName="notes" maxlength="2000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class RebatesAgreementsComponent implements OnInit {
  private readonly api = inject(RebatesApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly directions = REBATE_DIRECTIONS;
  readonly statuses = REBATE_AGREEMENT_STATUSES;
  readonly tierModes = REBATE_TIER_MODES;

  readonly agreements = signal<RebateAgreement[]>([]);
  readonly contacts = signal<ContactResource[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editing = signal<RebateAgreement | null>(null);
  readonly directionFilter = signal<RebateDirection | null>(null);
  readonly statusFilter = signal<RebateAgreementStatus | null>(null);

  readonly form = this.fb.group({
    code: ['', [Validators.required]],
    name: ['', [Validators.required]],
    direction: ['sales' as RebateDirection, [Validators.required]],
    contact_id: ['', [Validators.required]],
    tier_mode: ['retroactive' as RebateAgreementRequest['tier_mode'], [Validators.required]],
    starts_on: [todayIso(), [Validators.required]],
    ends_on: [todayIso(), [Validators.required]],
    currency: ['EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    notes: [''],
    tiers: this.fb.array([this.newTier()]),
  });

  get tiers() {
    return this.form.controls.tiers;
  }

  constructor() {
    this.form.controls.direction.valueChanges.pipe(takeUntilDestroyed()).subscribe((direction) => {
      this.form.controls.contact_id.setValue('');
      this.loadContactList(direction);
    });
  }

  ngOnInit(): void {
    this.load();
    this.loadContactList('sales');
  }

  load(): void {
    this.loading.set(true);
    this.api.getAgreements({ direction: this.directionFilter() ?? undefined, status: this.statusFilter() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.agreements.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('REBATES.ACTION_ERROR'));
      },
    });
  }

  statusColor(status: string): string {
    return AGREEMENT_STATUS_COLORS[status] ?? 'default';
  }

  label(contact: ContactResource): string {
    return contactLabel(contact);
  }

  addTier(): void {
    this.tiers.push(this.newTier());
  }

  removeTier(index: number): void {
    this.tiers.removeAt(index);
  }

  openModal(agreement: RebateAgreement | null = null): void {
    this.editing.set(agreement);
    this.tiers.clear();
    for (const tier of agreement?.tiers ?? [{ threshold_amount: '', rate_percent: '' }]) {
      this.tiers.push(this.newTier(tier.threshold_amount, tier.rate_percent));
    }
    this.form.patchValue({
      code: agreement?.code ?? '',
      name: agreement?.name ?? '',
      direction: agreement?.direction ?? 'sales',
      contact_id: agreement?.contact_id ?? '',
      tier_mode: agreement?.tier_mode ?? 'retroactive',
      starts_on: agreement?.starts_on ?? todayIso(),
      ends_on: agreement?.ends_on ?? todayIso(),
      currency: agreement?.currency ?? 'EUR',
      notes: agreement?.notes ?? '',
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: RebateAgreementRequest = {
      code: value.code,
      name: value.name,
      direction: value.direction,
      contact_id: value.contact_id,
      tier_mode: value.tier_mode,
      starts_on: value.starts_on,
      ends_on: value.ends_on,
      currency: value.currency.toUpperCase(),
      notes: blankToNull(value.notes),
      tiers: value.tiers.map((tier) => ({ threshold_amount: String(tier.threshold_amount), rate_percent: String(tier.rate_percent) })),
    };
    const current = this.editing();
    const request = current ? this.api.updateAgreement(current.id, payload) : this.api.createAgreement(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('REBATES.AGREEMENT_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR')),
    });
  }

  activate(agreement: RebateAgreement): void {
    this.api.activateAgreement(agreement.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('REBATES.AGREEMENT_ACTIVATED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR')),
    });
  }

  remove(agreement: RebateAgreement): void {
    this.api.deleteAgreement(agreement.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('REBATES.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR')),
    });
  }

  private loadContactList(direction: RebateDirection): void {
    loadContacts(this.crm, direction).subscribe((contacts) => this.contacts.set(contacts));
  }

  private newTier(threshold = '', rate = '') {
    return this.fb.group({
      threshold_amount: [threshold, [Validators.required]],
      rate_percent: [rate, [Validators.required]],
    });
  }
}
