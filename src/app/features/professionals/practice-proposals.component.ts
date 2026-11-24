import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  ContactResource,
  CrmApiService,
  PracticeApiService,
  PracticeConflictCheck,
  PracticeFeeProposal,
  PracticeFeeProposalRequest,
  PracticeFeeProposalStatus,
  PracticeFeeType,
  TranslateService,
} from '@core';
import { downloadBlob, IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, clientName, CONFLICT_RESULT_COLORS, decimalOrNull, loadClients, PROPOSAL_STATUS_COLORS } from './practice-firm.util';

const STATUSES: readonly PracticeFeeProposalStatus[] = ['draft', 'sent', 'accepted', 'declined', 'expired'];

/** Fee proposals: draft, send, then accept (after a conflicts check, which opens the matter) or decline. */
@Component({
  selector: 'app-practice-proposals',
  styleUrl: './practice-firm.scss',
  imports: [
    DecimalPipe,
    FormsModule,
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
    <app-page-header [title]="'PRACTICEFIRM.PROPOSALS_TITLE' | translate" [subtitle]="'PRACTICEFIRM.PROPOSALS_SUBTITLE' | translate">
      <button nz-button nzType="default" (click)="expireOverdue()">{{ 'PRACTICEFIRM.EXPIRE_OVERDUE' | translate }}</button>
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); load()" [nzPlaceHolder]="'PRACTICEFIRM.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('PRACTICEFIRM.PROPOSAL_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="rows()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'PRACTICEFIRM.NUMBER' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.CLIENT' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.TITLE' | translate }}</th>
            <th class="num">{{ 'PRACTICEFIRM.ESTIMATED_TOTAL' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.VALID_UNTIL' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.number }}</td>
              <td>{{ name(row.client) }}</td>
              <td>{{ row.title }}</td>
              <td class="num">{{ row.estimated_total | number: '1.2-2' }}</td>
              <td>{{ row.valid_until?.substring(0, 10) }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{ ('PRACTICEFIRM.PROPOSAL_' + row.status.toUpperCase()) | translate }}</nz-tag>
                @if (row.legal_case) {
                  <span class="muted">{{ row.legal_case.case_number }}</span>
                }
              </td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="default" (click)="downloadPdf(row)">{{ 'PRACTICEFIRM.PROPOSAL_PDF' | translate }}</button>
                  @if (row.status === 'draft') {
                    <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                    <button nz-button nzType="default" (click)="send(row)">{{ 'PRACTICEFIRM.SEND' | translate }}</button>
                  }
                  @if (row.status === 'sent') {
                    <button nz-button nzType="primary" (click)="startAccept(row)">{{ 'PRACTICEFIRM.ACCEPT' | translate }}</button>
                    <button nz-button nzType="default" nzDanger (click)="decline(row)">{{ 'PRACTICEFIRM.DECLINE' | translate }}</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'PRACTICEFIRM.NO_PROPOSALS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'PRACTICEFIRM.EDIT_PROPOSAL' : 'PRACTICEFIRM.NEW_PROPOSAL') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          @if (!editing()) {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PRACTICEFIRM.CLIENT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="client_id" nzShowSearch>
                  @for (client of clients(); track client.id) {
                    <nz-option [nzValue]="client.id" [nzLabel]="name(client)"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <nz-form-label nzRequired nzFor="prop-title">{{ 'PRACTICEFIRM.TITLE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="prop-title" formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="prop-scope">{{ 'PRACTICEFIRM.SCOPE' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="prop-scope" rows="3" formControlName="scope" maxlength="5000"></textarea></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PRACTICEFIRM.FEE_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="fee_type">
                  <nz-option nzValue="hourly" [nzLabel]="'PRACTICEFIRM.FEE_HOURLY' | translate"></nz-option>
                  <nz-option nzValue="fixed" [nzLabel]="'PRACTICEFIRM.FEE_FIXED' | translate"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            @if (form.controls.fee_type.value === 'hourly') {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="prop-rate">{{ 'PRACTICEFIRM.HOURLY_RATE' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="prop-rate" type="number" min="0.01" step="0.01" formControlName="hourly_rate" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="prop-hours">{{ 'PRACTICEFIRM.ESTIMATED_HOURS' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="prop-hours" type="number" min="0.01" step="0.25" formControlName="estimated_hours" /></nz-form-control>
              </nz-form-item>
            } @else {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="prop-fixed">{{ 'PRACTICEFIRM.FIXED_FEE' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="prop-fixed" type="number" min="0.01" step="0.01" formControlName="fixed_fee" /></nz-form-control>
              </nz-form-item>
            }
            <nz-form-item>
              <nz-form-label nzFor="prop-valid">{{ 'PRACTICEFIRM.VALID_UNTIL' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="prop-valid" type="date" formControlName="valid_until" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="acceptVisible" [nzTitle]="'PRACTICEFIRM.ACCEPT_TITLE' | translate" (nzOnCancel)="acceptVisible.set(false)" (nzOnOk)="confirmAccept()" okAction="save" [nzOkDisabled]="!canConfirm()">
      <ng-container *nzModalContent>
        @if (check(); as result) {
          <p>
            {{ 'PRACTICEFIRM.CONFLICT_RESULT' | translate }}:
            <nz-tag [nzColor]="resultColor(result.result)">{{ ('PRACTICEFIRM.RESULT_' + result.result.toUpperCase()) | translate }}</nz-tag>
          </p>
          @for (match of result.matches; track $index) {
            <p class="muted">{{ match.name }} - {{ ('PRACTICEFIRM.ROLE_' + match.role.toUpperCase()) | translate }} - {{ match.case_number }} {{ match.case_title }}</p>
          }
          @if (result.result === 'conflict') {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="override-reason">{{ 'PRACTICEFIRM.OVERRIDE_REASON' | translate }}</nz-form-label>
              <nz-form-control><textarea nz-input id="override-reason" rows="3" maxlength="500" [ngModel]="overrideReason()" (ngModelChange)="overrideReason.set($event)"></textarea></nz-form-control>
            </nz-form-item>
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class PracticeProposalsComponent implements OnInit {
  private readonly api = inject(PracticeApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = STATUSES;
  readonly rows = signal<PracticeFeeProposal[]>([]);
  readonly clients = signal<ContactResource[]>([]);
  readonly loading = signal(false);
  readonly status = signal<PracticeFeeProposalStatus | null>(null);
  readonly modalVisible = signal(false);
  readonly editing = signal<PracticeFeeProposal | null>(null);

  readonly acceptVisible = signal(false);
  readonly accepting = signal<PracticeFeeProposal | null>(null);
  readonly check = signal<PracticeConflictCheck | null>(null);
  readonly overrideReason = signal('');

  readonly form = this.fb.group({
    client_id: ['', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(190)]],
    scope: [''],
    fee_type: ['hourly' as PracticeFeeType],
    hourly_rate: this.fb.control<number | null>(null, [Validators.min(0.01)]),
    estimated_hours: this.fb.control<number | null>(null, [Validators.min(0.01)]),
    fixed_fee: this.fb.control<number | null>(null, [Validators.min(0.01)]),
    valid_until: [''],
  });

  ngOnInit(): void {
    loadClients(this.crm).subscribe((clients) => this.clients.set(clients));
    this.load();
  }

  name(client: Parameters<typeof clientName>[0]): string {
    return clientName(client);
  }

  statusColor(status: string): string {
    return PROPOSAL_STATUS_COLORS[status] ?? 'default';
  }

  resultColor(result: string): string {
    return CONFLICT_RESULT_COLORS[result] ?? 'default';
  }

  load(): void {
    this.loading.set(true);
    this.api.getFeeProposals({ status: this.status() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.rows.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PRACTICEFIRM.ACTION_ERROR'));
      },
    });
  }

  openModal(proposal: PracticeFeeProposal | null = null): void {
    this.editing.set(proposal);
    this.form.reset({
      client_id: proposal?.client_id ?? '',
      title: proposal?.title ?? '',
      scope: proposal?.scope ?? '',
      fee_type: proposal?.fee_type ?? 'hourly',
      hourly_rate: proposal?.hourly_rate ? Number(proposal.hourly_rate) : null,
      estimated_hours: proposal?.estimated_hours ? Number(proposal.estimated_hours) : null,
      fixed_fee: proposal?.fixed_fee ? Number(proposal.fixed_fee) : null,
      valid_until: proposal?.valid_until?.substring(0, 10) ?? '',
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const hourly = value.fee_type === 'hourly';
    const payload: PracticeFeeProposalRequest = {
      title: value.title,
      scope: blankToNull(value.scope),
      fee_type: value.fee_type,
      hourly_rate: hourly ? decimalOrNull(value.hourly_rate) : null,
      estimated_hours: hourly ? decimalOrNull(value.estimated_hours) : null,
      fixed_fee: hourly ? null : decimalOrNull(value.fixed_fee),
      valid_until: blankToNull(value.valid_until),
    };
    const current = this.editing();
    const request = current ? this.api.updateFeeProposal(current.id, payload) : this.api.createFeeProposal({ ...payload, client_id: value.client_id });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICEFIRM.PROPOSAL_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  downloadPdf(proposal: PracticeFeeProposal): void {
    this.api.downloadFeeProposalPdf(proposal.id).subscribe({
      next: (blob) => downloadBlob(blob, `${proposal.number}.pdf`),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  expireOverdue(): void {
    this.api.expireFeeProposals().subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('PRACTICEFIRM.EXPIRED_COUNT', { count: response.data.expired }));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  send(proposal: PracticeFeeProposal): void {
    this.api.sendFeeProposal(proposal.id).subscribe({
      next: () => this.load(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  decline(proposal: PracticeFeeProposal): void {
    this.api.declineFeeProposal(proposal.id).subscribe({
      next: () => this.load(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  /** Runs the conflicts check of the client, then asks for confirmation (with a reason when a conflict is found). */
  startAccept(proposal: PracticeFeeProposal): void {
    this.api.runConflictCheck({ name: this.name(proposal.client) || proposal.title, role: 'client', contact_id: proposal.client_id }).subscribe({
      next: (response) => {
        this.accepting.set(proposal);
        this.check.set(response.data);
        this.overrideReason.set('');
        this.acceptVisible.set(true);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  canConfirm(): boolean {
    const check = this.check();
    return check !== null && (check.result !== 'conflict' || this.overrideReason().trim() !== '');
  }

  confirmAccept(): void {
    const proposal = this.accepting();
    const check = this.check();
    if (!proposal || !check) {
      return;
    }
    this.api.acceptFeeProposal(proposal.id, { conflict_check_id: check.id, override_reason: blankToNull(this.overrideReason()) }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICEFIRM.PROPOSAL_ACCEPTED'));
        this.acceptVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }
}
