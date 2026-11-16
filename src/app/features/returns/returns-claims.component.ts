import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RETURNS_CLAIM_STATUSES, ReturnsApiService, ReturnsClaimStatus, ReturnsRma, ReturnsWarranty, ReturnsWarrantyClaim, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, CLAIM_STATUS_COLORS, todayIso } from './returns.util';

type ClaimDialog = 'accept' | 'reject';

/** Warranty claims: raised on a warranty (its validity is frozen on the claim), accepted or rejected, then resolved. */
@Component({
  selector: 'app-returns-claims',
  styleUrl: './returns.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS.CLAIMS_TITLE' | translate" [subtitle]="'RETURNS.CLAIMS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCreate()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" [nzPlaceHolder]="'RETURNS.STATUS' | translate">
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="('RETURNS.CLAIM_STATUS_' + status.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="claims()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'RETURNS.CLAIM_NUMBER' | translate }}</th>
            <th>{{ 'RETURNS.SERIAL_OR_LOT' | translate }}</th>
            <th>{{ 'RETURNS.CLAIM_DATE' | translate }}</th>
            <th>{{ 'RETURNS.DESCRIPTION' | translate }}</th>
            <th>{{ 'RETURNS.WARRANTY_COVERAGE' | translate }}</th>
            <th>{{ 'RETURNS.RMA_NUMBER' | translate }}</th>
            <th>{{ 'RETURNS.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.claim_number }}</td>
              <td>{{ row.serial_number || row.lot_number }}</td>
              <td>{{ row.claim_date }}</td>
              <td>{{ row.description }}</td>
              <td>
                <nz-tag [nzColor]="row.is_valid ? 'green' : 'red'">
                  {{ (row.is_valid ? 'RETURNS.WARRANTY_VALID' : 'RETURNS.WARRANTY_' + (row.validity_note ?? 'void').toUpperCase()) | translate }}
                </nz-tag>
              </td>
              <td>{{ row.rma_number || '-' }}</td>
              <td><nz-tag [nzColor]="statusColor(row.status)">{{ ('RETURNS.CLAIM_STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>
                @if (row.status === 'open') {
                  <button nz-button nzType="text" (click)="openDialog('accept', row)">{{ 'RETURNS.ACCEPT' | translate }}</button>
                  <button nz-button nzType="text" nzDanger (click)="openDialog('reject', row)">{{ 'RETURNS.REJECT' | translate }}</button>
                }
                @if (row.status === 'accepted') {
                  <button nz-button nzType="text" (click)="resolve(row)">{{ 'RETURNS.RESOLVE' | translate }}</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && claims().length === 0) {
        <nz-empty [nzNotFoundContent]="'RETURNS.NO_CLAIMS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal
      [(nzVisible)]="createVisible"
      [nzTitle]="'RETURNS.NEW_CLAIM' | translate"
      (nzOnCancel)="createVisible.set(false)"
      (nzOnOk)="save()"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="640px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS.WARRANTY' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="warranty_id" nzShowSearch>
                @for (warranty of warranties(); track warranty.id) {
                  <nz-option [nzValue]="warranty.id" [nzLabel]="warrantyLabel(warranty)"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'RETURNS.LINKED_RMA' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="rma_id" nzAllowClear>
                  @for (rma of rmas(); track rma.id) {
                    <nz-option [nzValue]="rma.id" [nzLabel]="rma.rma_number"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.CLAIM_DATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="claim_date" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="3" formControlName="description" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="dialog() !== null"
      [nzTitle]="(dialog() === 'accept' ? 'RETURNS.ACCEPT_CLAIM' : 'RETURNS.REJECT_CLAIM') | translate"
      (nzOnCancel)="dialog.set(null)"
      (nzOnOk)="submitDialog()"
      okAction="confirm"
      [nzOkDisabled]="dialog() === 'reject' && notes().trim() === ''"
    >
      <ng-container *nzModalContent>
        @if (dialog() === 'accept' && deciding()?.is_valid === false) {
          <p class="muted">{{ 'RETURNS.CLAIM_NOT_COVERED_HINT' | translate }}</p>
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-checkbox [ngModel]="override()" (ngModelChange)="override.set($event)">{{ 'RETURNS.OVERRIDE_VALIDITY' | translate }}</label>
        }
        <nz-form-item>
          <nz-form-label [nzRequired]="dialog() === 'reject'">{{ (dialog() === 'reject' ? 'RETURNS.REJECTION_REASON' : 'RETURNS.NOTES') | translate }}</nz-form-label>
          <nz-form-control><textarea nz-input rows="3" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea></nz-form-control>
        </nz-form-item>
      </ng-container>
    </nz-modal>
  `,
})
export class ReturnsClaimsComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = RETURNS_CLAIM_STATUSES;
  readonly claims = signal<ReturnsWarrantyClaim[]>([]);
  readonly loading = signal(false);
  readonly statusFilter = signal<ReturnsClaimStatus | null>(null);
  readonly createVisible = signal(false);
  readonly warranties = signal<ReturnsWarranty[]>([]);
  readonly rmas = signal<ReturnsRma[]>([]);
  readonly dialog = signal<ClaimDialog | null>(null);
  readonly deciding = signal<ReturnsWarrantyClaim | null>(null);
  readonly notes = signal('');
  readonly override = signal(false);

  readonly form = this.fb.group({
    warranty_id: ['', [Validators.required]],
    rma_id: [''],
    claim_date: [todayIso(), [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(4000)]],
  });

  constructor() {
    this.form.controls.warranty_id.valueChanges.subscribe((warrantyId) => this.loadRmas(warrantyId));
  }

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: ReturnsClaimStatus): string {
    return CLAIM_STATUS_COLORS[status];
  }

  warrantyLabel(warranty: ReturnsWarranty): string {
    return `${warranty.serial_number ?? warranty.lot_number} - ${warranty.product_name ?? ''} (${warranty.customer_name})`;
  }

  load(): void {
    this.loading.set(true);
    this.api.getClaims({ status: this.statusFilter() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.claims.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('RETURNS.ACTION_ERROR'));
      },
    });
  }

  openCreate(): void {
    this.form.reset({ warranty_id: '', rma_id: '', claim_date: todayIso(), description: '' });
    this.rmas.set([]);
    this.api.getWarranties({ per_page: 100 }).subscribe({ next: (response) => this.warranties.set(response.data) });
    this.createVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    this.api
      .createClaim({ warranty_id: value.warranty_id, rma_id: value.rma_id || null, claim_date: value.claim_date, description: value.description })
      .subscribe({
        next: (response) => {
          this.message.success(this.translate.instant('RETURNS.CLAIM_SAVED'));
          if (!response.data.is_valid) {
            this.message.warning(this.translate.instant('RETURNS.CLAIM_NOT_COVERED'));
          }
          this.createVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
      });
  }

  openDialog(dialog: ClaimDialog, claim: ReturnsWarrantyClaim): void {
    this.deciding.set(claim);
    this.notes.set('');
    this.override.set(false);
    this.dialog.set(dialog);
  }

  submitDialog(): void {
    const claim = this.deciding();
    const dialog = this.dialog();
    if (claim === null || dialog === null) {
      return;
    }

    if (dialog === 'accept') {
      this.run(this.api.acceptClaim(claim.id, { notes: this.notes() || null, override_validity: this.override() }), 'RETURNS.CLAIM_ACCEPTED');
    } else {
      this.run(this.api.rejectClaim(claim.id, this.notes()), 'RETURNS.CLAIM_REJECTED');
    }
  }

  resolve(claim: ReturnsWarrantyClaim): void {
    this.run(this.api.resolveClaim(claim.id), 'RETURNS.CLAIM_RESOLVED');
  }

  private loadRmas(warrantyId: string): void {
    this.rmas.set([]);
    const warranty = this.warranties().find((candidate) => candidate.id === warrantyId);
    if (warranty === undefined) {
      return;
    }

    this.api.getRmas({ contact_id: warranty.contact_id, per_page: 100 }).subscribe({ next: (response) => this.rmas.set(response.data) });
  }

  private run(request: ReturnType<ReturnsApiService['resolveClaim']>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant(successKey));
        this.dialog.set(null);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }
}
