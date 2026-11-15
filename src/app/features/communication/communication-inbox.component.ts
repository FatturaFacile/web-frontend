import { DatePipe } from '@angular/common';
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
  CommunicationApiService,
  CommunicationAssignee,
  CommunicationChannelType,
  CommunicationConversation,
  CommunicationConversationStatus,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, CONVERSATION_STATUS_COLORS, CONVERSATION_STATUSES } from './communication-inbox.util';

const CHANNELS: readonly CommunicationChannelType[] = ['email', 'whatsapp', 'telegram', 'sms'];

/** Unified inbox: conversations that aggregate the messages of every channel, with reply, status and recording of inbound messages. */
@Component({
  selector: 'app-communication-inbox',
  imports: [
    DatePipe,
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
    <app-page-header [title]="'COMMUNICATION.INBOX_TITLE' | translate" [subtitle]="'COMMUNICATION.INBOX_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openInbound()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card">
      <div class="inbox-filters">
        <nz-select [ngModel]="statusFilter()" (ngModelChange)="setStatusFilter($event)" nzAllowClear [nzPlaceHolder]="'COMMUNICATION.STATUS' | translate">
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="('COMMUNICATION.CONVERSATION_STATUS_' + status.toUpperCase()) | translate"></nz-option>
          }
        </nz-select>
        <nz-select [ngModel]="assigneeFilter()" (ngModelChange)="setAssigneeFilter($event)" nzAllowClear [nzPlaceHolder]="'COMMUNICATION.ASSIGNEE' | translate">
          <nz-option nzValue="none" [nzLabel]="'COMMUNICATION.UNASSIGNED' | translate"></nz-option>
          @for (assignee of assignees(); track assignee.id) {
            <nz-option [nzValue]="assignee.id" [nzLabel]="assignee.name"></nz-option>
          }
        </nz-select>
      </div>

      <nz-table #table [nzData]="conversations()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'COMMUNICATION.CHANNEL' | translate }}</th>
            <th>{{ 'COMMUNICATION.COUNTERPARTY' | translate }}</th>
            <th>{{ 'COMMUNICATION.SUBJECT' | translate }}</th>
            <th>{{ 'COMMUNICATION.STATUS' | translate }}</th>
            <th>{{ 'COMMUNICATION.ASSIGNEE' | translate }}</th>
            <th>{{ 'COMMUNICATION.UNREAD' | translate }}</th>
            <th>{{ 'COMMUNICATION.LAST_MESSAGE' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr class="clickable" (click)="open(row)">
              <td>{{ row.channel }}</td>
              <td>{{ row.counterparty_name || row.counterparty_address }}</td>
              <td>{{ row.subject }}</td>
              <td>
                <nz-tag [nzColor]="statusColors[row.status]">{{ ('COMMUNICATION.CONVERSATION_STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td>{{ assigneeName(row.assigned_to) }}</td>
              <td>{{ row.unread_count }}</td>
              <td>{{ row.last_message_at | date: 'short' }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7"><nz-empty></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal [nzVisible]="detailVisible()" [nzTitle]="detail()?.counterparty_name || detail()?.counterparty_address || ''" [nzFooter]="null" nzWidth="720px" (nzOnCancel)="detailVisible.set(false)">
      <ng-container *nzModalContent>
        @if (detail(); as conversation) {
          <div class="conversation-toolbar">
            <nz-select [ngModel]="conversation.status" (ngModelChange)="changeStatus($event)">
              @for (status of statuses; track status) {
                <nz-option [nzValue]="status" [nzLabel]="('COMMUNICATION.CONVERSATION_STATUS_' + status.toUpperCase()) | translate"></nz-option>
              }
            </nz-select>
            <nz-select class="assignee-select" [ngModel]="conversation.assigned_to" (ngModelChange)="assign($event)" nzAllowClear [nzPlaceHolder]="'COMMUNICATION.UNASSIGNED' | translate">
              @for (assignee of assignees(); track assignee.id) {
                <nz-option [nzValue]="assignee.id" [nzLabel]="assignee.name"></nz-option>
              }
            </nz-select>
          </div>
          <div class="conversation-thread">
            @for (message of conversation.messages ?? []; track message.id) {
              <div class="message" [class.outbound]="message.direction === 'outbound'">
                <small>{{ message.occurred_at | date: 'short' }} · {{ ('COMMUNICATION.DIRECTION_' + message.direction.toUpperCase()) | translate }}</small>
                <p>{{ message.body }}</p>
              </div>
            }
          </div>
          @if (conversation.status !== 'closed') {
            <textarea nz-input rows="3" [placeholder]="'COMMUNICATION.REPLY_PLACEHOLDER' | translate" [ngModel]="replyText()" (ngModelChange)="replyText.set($event)"></textarea>
            <button nz-button nzType="primary" class="reply-button" [disabled]="!replyText().trim()" (click)="reply()">{{ 'COMMUNICATION.REPLY' | translate }}</button>
          }
        }
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="inboundVisible()" [nzTitle]="'COMMUNICATION.RECORD_INBOUND' | translate" [nzFooter]="inboundFooter" (nzOnCancel)="inboundVisible.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="inboundForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'COMMUNICATION.CHANNEL' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="channel">
                @for (channel of channels; track channel) {
                  <nz-option [nzValue]="channel" [nzLabel]="channel"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="inbound-address">{{ 'COMMUNICATION.ADDRESS' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="inbound-address" formControlName="address" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="inbound-name">{{ 'COMMUNICATION.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="inbound-name" formControlName="name" maxlength="160" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="inbound-subject">{{ 'COMMUNICATION.SUBJECT' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="inbound-subject" formControlName="subject" maxlength="255" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="inbound-body">{{ 'COMMUNICATION.BODY' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="inbound-body" rows="4" formControlName="body"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
    <ng-template #inboundFooter>
      <button nz-button appModalAction="cancel" (click)="inboundVisible.set(false)"></button>
      <button nz-button nzType="primary" appModalAction="save" [disabled]="inboundForm.invalid" (click)="saveInbound()"></button>
    </ng-template>
  `,
})
export class CommunicationInboxComponent implements OnInit {
  private readonly api = inject(CommunicationApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = CONVERSATION_STATUSES;
  readonly statusColors = CONVERSATION_STATUS_COLORS;
  readonly channels = CHANNELS;

  readonly conversations = signal<CommunicationConversation[]>([]);
  readonly loading = signal(false);
  readonly statusFilter = signal<CommunicationConversationStatus | null>(null);
  readonly detail = signal<CommunicationConversation | null>(null);
  readonly detailVisible = signal(false);
  readonly replyText = signal('');
  readonly inboundVisible = signal(false);
  readonly assignees = signal<CommunicationAssignee[]>([]);
  readonly assigneeFilter = signal<string | null>(null);

  readonly inboundForm = this.fb.group({
    channel: ['email' as CommunicationChannelType, [Validators.required]],
    address: ['', [Validators.required, Validators.maxLength(190)]],
    name: [''],
    subject: [''],
    body: ['', [Validators.required, Validators.maxLength(20000)]],
  });

  ngOnInit(): void {
    this.load();
    this.api.getAssignees().subscribe({ next: (response) => this.assignees.set(response.data), error: () => this.assignees.set([]) });
  }

  assigneeName(userId: string | null): string {
    if (userId === null) {
      return '';
    }

    return this.assignees().find((assignee) => assignee.id === userId)?.name ?? '';
  }

  setAssigneeFilter(value: string | null): void {
    this.assigneeFilter.set(value);
    this.load();
  }

  /** Assigns the open conversation to a member, or unassigns it when the select is cleared. */
  assign(userId: string | null): void {
    const conversation = this.detail();
    if (!conversation) {
      return;
    }
    this.api.assignConversation(conversation.id, userId ?? null).subscribe({
      next: (response) => {
        this.detail.set({ ...conversation, ...response.data, messages: conversation.messages });
        this.message.success(this.translate.instant('COMMUNICATION.ASSIGNMENT_SAVED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('COMMUNICATION.ACTION_ERROR')),
    });
  }

  setStatusFilter(status: CommunicationConversationStatus | null): void {
    this.statusFilter.set(status);
    this.load();
  }

  open(row: CommunicationConversation): void {
    this.api.getConversation(row.id).subscribe({
      next: (response) => {
        this.detail.set(response.data);
        this.replyText.set('');
        this.detailVisible.set(true);
        if (row.unread_count > 0) {
          this.api.markConversationRead(row.id).subscribe({ next: () => this.load() });
        }
      },
      error: () => this.message.error(this.translate.instant('COMMUNICATION.ACTION_ERROR')),
    });
  }

  reply(): void {
    const conversation = this.detail();
    if (!conversation || !this.replyText().trim()) {
      return;
    }
    this.api.replyToConversation(conversation.id, this.replyText().trim()).subscribe({
      next: () => {
        this.message.success(this.translate.instant('COMMUNICATION.REPLY_SENT'));
        this.open(conversation);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('COMMUNICATION.ACTION_ERROR')),
    });
  }

  changeStatus(status: CommunicationConversationStatus): void {
    const conversation = this.detail();
    if (!conversation) {
      return;
    }
    this.api.changeConversationStatus(conversation.id, status).subscribe({
      next: (response) => {
        this.detail.set({ ...conversation, ...response.data, messages: conversation.messages });
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('COMMUNICATION.ACTION_ERROR')),
    });
  }

  openInbound(): void {
    this.inboundForm.reset({ channel: 'email', address: '', name: '', subject: '', body: '' });
    this.inboundVisible.set(true);
  }

  saveInbound(): void {
    if (this.inboundForm.invalid) {
      return;
    }
    const value = this.inboundForm.getRawValue();
    this.api
      .receiveInboundMessage({
        channel: value.channel,
        address: value.address.trim(),
        name: value.name.trim() || null,
        subject: value.subject.trim() || null,
        body: value.body,
      })
      .subscribe({
        next: () => {
          this.inboundVisible.set(false);
          this.message.success(this.translate.instant('COMMUNICATION.INBOUND_SAVED'));
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('COMMUNICATION.ACTION_ERROR')),
      });
  }

  private load(): void {
    this.loading.set(true);
    const status = this.statusFilter();
    const assignedTo = this.assigneeFilter();
    this.api.getConversations({ per_page: 100, ...(status ? { status } : {}), ...(assignedTo ? { assigned_to: assignedTo } : {}) }).subscribe({
      next: (response) => {
        this.conversations.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('COMMUNICATION.ACTION_ERROR'));
      },
    });
  }
}
