import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  COMPLAINT_CHANNELS,
  COMPLAINT_SEVERITIES,
  ComplaintAction,
  ComplaintChannel,
  ComplaintSeverity,
  ComplaintStatus,
  QualityApiService,
  QualityExtraApiService,
  QualityComplaint,
  QualityComplaintRequest,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, todayIso } from '../fleet/fleet.util';

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  received: 'blue',
  investigating: 'orange',
  replied: 'cyan',
  closed: 'green',
  rejected: 'default',
};

/** Actions that need a text, with the payload field the API expects. */
const TEXT_ACTIONS: Partial<Record<ComplaintAction, string>> = {
  'root-cause': 'root_cause',
  reply: 'reply_text',
  reject: 'reason',
  close: 'closure_notes',
};

/** Customer complaints: intake, investigation, link to non-conformity, customer reply and closure. */
@Component({
  selector: 'app-quality-complaints',
  styleUrl: './quality.scss',
  imports: [
    ReactiveFormsModule,
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
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'QUALITY.COMPLAINTS_TITLE' | translate" [subtitle]="'QUALITY.COMPLAINTS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCreateModal()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card">
      <nz-table #table [nzData]="complaints()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'QUALITY.NUMBER' | translate }}</th>
            <th>{{ 'QUALITY.CUSTOMER' | translate }}</th>
            <th>{{ 'QUALITY.RECEIVED_AT' | translate }}</th>
            <th>{{ 'QUALITY.SEVERITY' | translate }}</th>
            <th>{{ 'QUALITY.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.number }}</td>
              <td>{{ row.customer_name }}<br /><span class="muted">{{ row.description }}</span></td>
              <td>{{ row.received_at }}</td>
              <td>{{ ('QUALITY.SEVERITY_' + row.severity.toUpperCase()) | translate }}</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ ('QUALITY.COMPLAINT_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>
                <div class="row-actions">
                  @if (row.status !== 'closed' && row.status !== 'rejected') {
                    <button nz-button nzType="text" (click)="openEditModal(row)">{{ 'QUALITY.ACTION_EDIT' | translate }}</button>
                    @if (!row.nonconformity_id) {
                      <button nz-button nzType="text" (click)="openLinkModal(row)">{{ 'QUALITY.ACTION_LINK_NC' | translate }}</button>
                    }
                  }
                  @if (row.status === 'received') {
                    <button nz-button nzType="text" (click)="run(row, 'investigate')">{{ 'QUALITY.ACTION_INVESTIGATE' | translate }}</button>
                  }
                  @if (row.status === 'investigating' || row.status === 'replied') {
                    <button nz-button nzType="text" (click)="openTextModal(row, 'root-cause')">{{ 'QUALITY.ACTION_ROOT_CAUSE' | translate }}</button>
                    @if (!row.nonconformity_id) {
                      <button nz-button nzType="text" (click)="run(row, 'raise-nonconformity')">{{ 'QUALITY.ACTION_RAISE_NC' | translate }}</button>
                    }
                  }
                  @if (row.status === 'investigating' || row.status === 'replied') {
                    <button nz-button nzType="text" (click)="openTextModal(row, 'reply')">{{ 'QUALITY.ACTION_REPLY' | translate }}</button>
                  }
                  @if (row.status === 'replied') {
                    <button nz-button nzType="text" (click)="openTextModal(row, 'close')">{{ 'QUALITY.ACTION_CLOSE' | translate }}</button>
                  }
                  @if (row.status === 'received' || row.status === 'investigating') {
                    <button nz-button nzType="text" nzDanger (click)="openTextModal(row, 'reject')">{{ 'QUALITY.ACTION_REJECT' | translate }}</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && complaints().length === 0) {
        <nz-empty [nzNotFoundContent]="'QUALITY.NO_COMPLAINTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="createVisible" [nzTitle]="(editingId() ? 'QUALITY.ACTION_EDIT' : 'QUALITY.NEW_COMPLAINT') | translate" (nzOnCancel)="createVisible.set(false)" (nzOnOk)="create()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cmp-customer">{{ 'QUALITY.CUSTOMER' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="cmp-customer" formControlName="customer_name" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cmp-date">{{ 'QUALITY.RECEIVED_AT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cmp-date" type="date" formControlName="received_at" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'QUALITY.CHANNEL' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="channel">
                  @for (channel of channels; track channel) {
                    <nz-option [nzValue]="channel" [nzLabel]="('QUALITY.CHANNEL_' + channel.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'QUALITY.SEVERITY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="severity">
                  @for (severity of severities; track severity) {
                    <nz-option [nzValue]="severity" [nzLabel]="('QUALITY.SEVERITY_' + severity.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cmp-reference">{{ 'QUALITY.REFERENCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cmp-reference" formControlName="reference" maxlength="120" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cmp-product">{{ 'QUALITY.PRODUCT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cmp-product" formControlName="product_description" maxlength="190" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cmp-description">{{ 'QUALITY.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="cmp-description" rows="4" formControlName="description" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="linkVisible" [nzTitle]="'QUALITY.ACTION_LINK_NC' | translate" (nzOnCancel)="linkVisible.set(false)" (nzOnOk)="submitLink()" okAction="save" [nzOkDisabled]="linkForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="linkForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzFor="cmp-nc">{{ 'QUALITY.NONCONFORMITY_ID' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="cmp-nc" formControlName="nonconformity_id" maxlength="36" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="cmp-capa">{{ 'QUALITY.CAPA_ACTION_ID' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="cmp-capa" formControlName="capa_action_id" maxlength="36" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="textVisible" [nzTitle]="('QUALITY.ACTION_' + textActionKey()) | translate" (nzOnCancel)="textVisible.set(false)" (nzOnOk)="submitText()" okAction="save" [nzOkDisabled]="requiresText() && textForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="textForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-control><textarea nz-input rows="5" formControlName="text" maxlength="8000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class QualityComplaintsComponent implements OnInit {
  private readonly api = inject(QualityApiService);
  private readonly extraApi = inject(QualityExtraApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly channels = COMPLAINT_CHANNELS;
  readonly severities = COMPLAINT_SEVERITIES;
  readonly complaints = signal<QualityComplaint[]>([]);
  readonly loading = signal(false);
  readonly createVisible = signal(false);
  readonly textVisible = signal(false);
  readonly linkVisible = signal(false);
  readonly editingId = signal<string | null>(null);
  private linkTarget: QualityComplaint | null = null;
  readonly textTarget = signal<{ complaint: QualityComplaint; action: ComplaintAction } | null>(null);

  readonly form = this.fb.group({
    customer_name: ['', [Validators.required]],
    received_at: [todayIso(), [Validators.required]],
    channel: ['email' as ComplaintChannel],
    severity: ['minor' as ComplaintSeverity],
    reference: [''],
    product_description: [''],
    description: ['', [Validators.required]],
  });

  readonly linkForm = this.fb.group(
    { nonconformity_id: [''], capa_action_id: [''] },
    { validators: (group) => (group.value.nonconformity_id?.trim() || group.value.capa_action_id?.trim() ? null : { target: true }) },
  );

  readonly textForm = this.fb.group({ text: [''] });

  ngOnInit(): void {
    this.load();
  }

  color(status: ComplaintStatus): string {
    return STATUS_COLORS[status];
  }

  textActionKey(): string {
    return (this.textTarget()?.action ?? 'close').replace('-', '_').toUpperCase();
  }

  /** Closing notes are optional, every other text action needs a text. */
  requiresText(): boolean {
    return this.textTarget()?.action !== 'close';
  }

  load(): void {
    this.loading.set(true);
    this.api.getComplaints().subscribe({
      next: (response) => {
        this.complaints.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('QUALITY.ACTION_ERROR'));
      },
    });
  }

  openCreateModal(): void {
    this.editingId.set(null);
    this.form.reset({ customer_name: '', received_at: todayIso(), channel: 'email', severity: 'minor', reference: '', product_description: '', description: '' });
    this.createVisible.set(true);
  }

  create(): void {
    const value = this.form.getRawValue();
    const payload: QualityComplaintRequest = {
      customer_name: value.customer_name.trim(),
      received_at: value.received_at,
      channel: value.channel,
      reference: blankToNull(value.reference),
      product_description: blankToNull(value.product_description),
      description: value.description.trim(),
      severity: value.severity,
    };
    const id = this.editingId();
    const request$ = id ? this.extraApi.updateComplaint(id, payload) : this.api.createComplaint(payload);
    request$.subscribe({
      next: () => {
        this.message.success(this.translate.instant('QUALITY.SAVED'));
        this.createVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  openEditModal(complaint: QualityComplaint): void {
    this.editingId.set(complaint.id);
    this.form.reset({
      customer_name: complaint.customer_name,
      received_at: complaint.received_at.slice(0, 10),
      channel: complaint.channel,
      severity: complaint.severity,
      reference: complaint.reference ?? '',
      product_description: complaint.product_description ?? '',
      description: complaint.description,
    });
    this.createVisible.set(true);
  }

  openLinkModal(complaint: QualityComplaint): void {
    this.linkTarget = complaint;
    this.linkForm.reset({ nonconformity_id: '', capa_action_id: '' });
    this.linkVisible.set(true);
  }

  submitLink(): void {
    if (!this.linkTarget || this.linkForm.invalid) {
      return;
    }
    const value = this.linkForm.getRawValue();
    this.extraApi
      .linkComplaint(this.linkTarget.id, {
        nonconformity_id: blankToNull(value.nonconformity_id),
        capa_action_id: blankToNull(value.capa_action_id),
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('QUALITY.SAVED'));
          this.linkVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
      });
  }

  run(complaint: QualityComplaint, action: ComplaintAction, payload: Record<string, string | null> = {}): void {
    this.api.complaintAction(complaint.id, action, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('QUALITY.SAVED'));
        this.textVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  openTextModal(complaint: QualityComplaint, action: ComplaintAction): void {
    this.textTarget.set({ complaint, action });
    this.textForm.reset({ text: '' });
    this.textForm.controls.text.setValidators(action === 'close' ? [] : [Validators.required]);
    this.textForm.controls.text.updateValueAndValidity();
    this.textVisible.set(true);
  }

  submitText(): void {
    const target = this.textTarget();
    const field = target ? TEXT_ACTIONS[target.action] : undefined;
    if (!target || !field) {
      return;
    }
    this.run(target.complaint, target.action, { [field]: blankToNull(this.textForm.getRawValue().text) });
  }
}
