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
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ReturnsApiService, ReturnsReasonCode, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './returns.util';

/** The return window and the reason codes of the company. */
@Component({
  selector: 'app-returns-settings',
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
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS.SETTINGS_TITLE' | translate" [subtitle]="'RETURNS.SETTINGS_SUBTITLE' | translate"></app-page-header>

    <nz-card class="main-card" [nzTitle]="'RETURNS.RETURN_WINDOW' | translate">
      <form nz-form [formGroup]="windowForm" nzLayout="vertical" (ngSubmit)="saveWindow()">
        <nz-form-item>
          <nz-form-label nzRequired>{{ 'RETURNS.RETURN_WINDOW_DAYS' | translate }}</nz-form-label>
          <nz-form-control>
            <input nz-input type="number" min="0" max="3650" formControlName="return_window_days" style="width: 160px" />
            <div class="muted">{{ 'RETURNS.RETURN_WINDOW_HINT' | translate }}</div>
          </nz-form-control>
        </nz-form-item>
        <button nz-button nzType="primary" type="submit" appIconAction="save" [disabled]="windowForm.invalid"></button>
      </form>
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'RETURNS.REASON_CODES' | translate" [nzExtra]="extra">
      <ng-template #extra>
        <button nz-button nzType="primary" (click)="openCreate()" appIconAction="create"></button>
      </ng-template>
      <nz-table #table [nzData]="reasons()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'RETURNS.CODE' | translate }}</th>
            <th>{{ 'RETURNS.LABEL' | translate }}</th>
            <th>{{ 'RETURNS.IS_DEFECT' | translate }}</th>
            <th>{{ 'RETURNS.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.code }}</td>
              <td>{{ row.label }}</td>
              <td>{{ (row.is_defect ? 'COMMON.YES' : 'COMMON.NO') | translate }}</td>
              <td><nz-tag [nzColor]="row.is_active ? 'green' : 'default'">{{ (row.is_active ? 'RETURNS.ACTIVE' : 'RETURNS.INACTIVE') | translate }}</nz-tag></td>
              <td>
                <button nz-button nzType="text" appIconAction="edit" (click)="openEdit(row)"></button>
                <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'RETURNS.DELETE_REASON_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (reasons().length === 0) {
        <nz-empty [nzNotFoundContent]="'RETURNS.NO_REASONS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions
      [(nzVisible)]="modalVisible"
      [nzTitle]="(editing() ? 'RETURNS.EDIT_REASON' : 'RETURNS.NEW_REASON') | translate"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="saveReason()"
      okAction="save"
      [nzOkDisabled]="reasonForm.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="reasonForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS.CODE' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="code" maxlength="40" />
              <div class="muted">{{ 'RETURNS.CODE_HINT' | translate }}</div>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS.LABEL' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="label" maxlength="120" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <label for="returns-settings-is-defect" nzId="returns-settings-is-defect" nz-checkbox formControlName="is_defect">{{ 'RETURNS.IS_DEFECT' | translate }}</label>
              <label for="returns-settings-is-active" nzId="returns-settings-is-active" nz-checkbox formControlName="is_active">{{ 'RETURNS.ACTIVE' | translate }}</label>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ReturnsSettingsComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly reasons = signal<ReturnsReasonCode[]>([]);
  readonly modalVisible = signal(false);
  readonly editing = signal<ReturnsReasonCode | null>(null);

  readonly windowForm = this.fb.group({
    return_window_days: [30, [Validators.required, Validators.min(0), Validators.max(3650)]],
  });

  readonly reasonForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(/^[a-z0-9_]+$/)]],
    label: ['', [Validators.required, Validators.maxLength(120)]],
    is_defect: [false],
    is_active: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getSettings().subscribe({
      next: (response) => {
        this.windowForm.patchValue({ return_window_days: response.data.return_window_days });
        this.reasons.set(response.data.reason_codes);
      },
      error: () => this.message.error(this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  saveWindow(): void {
    this.api.updateSettings(Number(this.windowForm.getRawValue().return_window_days)).subscribe({
      next: () => this.message.success(this.translate.instant('RETURNS.SETTINGS_SAVED')),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.reasonForm.reset({ code: '', label: '', is_defect: false, is_active: true });
    this.reasonForm.controls.code.enable();
    this.modalVisible.set(true);
  }

  openEdit(reason: ReturnsReasonCode): void {
    this.editing.set(reason);
    this.reasonForm.reset({ code: reason.code, label: reason.label, is_defect: reason.is_defect, is_active: reason.is_active });
    this.reasonForm.controls.code.disable();
    this.modalVisible.set(true);
  }

  saveReason(): void {
    const value = this.reasonForm.getRawValue();
    const editing = this.editing();
    const request =
      editing === null
        ? this.api.createReasonCode({ code: value.code, label: value.label, is_defect: value.is_defect, is_active: value.is_active })
        : this.api.updateReasonCode(editing.id, { label: value.label, is_defect: value.is_defect, is_active: value.is_active });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('RETURNS.REASON_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  remove(reason: ReturnsReasonCode): void {
    this.api.deleteReasonCode(reason.id).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant(response.deleted ? 'RETURNS.REASON_DELETED' : 'RETURNS.REASON_DEACTIVATED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }
}
