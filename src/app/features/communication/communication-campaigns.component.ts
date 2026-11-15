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
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CommunicationApiService,
  CommunicationCampaign,
  CommunicationCampaignPreview,
  CommunicationChannelType,
  CrmApiService,
  CrmSegment,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, CAMPAIGN_STATUS_COLORS, isCampaignOpen, localDateTimeToIso } from './communication-inbox.util';

const CHANNELS: readonly CommunicationChannelType[] = ['email', 'whatsapp', 'telegram', 'sms'];

/** Campaigns to the audience of a CRM segment: audience preview, scheduling, immediate send and the counters of the send log. */
@Component({
  selector: 'app-communication-campaigns',
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
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'COMMUNICATION.CAMPAIGNS_TITLE' | translate" [subtitle]="'COMMUNICATION.CAMPAIGNS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCreate()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card">
      <nz-table #table [nzData]="campaigns()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'COMMUNICATION.NAME' | translate }}</th>
            <th>{{ 'COMMUNICATION.CHANNEL' | translate }}</th>
            <th>{{ 'COMMUNICATION.STATUS' | translate }}</th>
            <th>{{ 'COMMUNICATION.SCHEDULED_AT' | translate }}</th>
            <th>{{ 'COMMUNICATION.SENT' | translate }}</th>
            <th>{{ 'COMMUNICATION.FAILED' | translate }}</th>
            <th>{{ 'COMMUNICATION.SUPPRESSED' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.name }}</td>
              <td>{{ row.channel }}</td>
              <td>
                <nz-tag [nzColor]="statusColors[row.status]">{{ ('COMMUNICATION.CAMPAIGN_STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td>{{ row.scheduled_at | date: 'short' }}</td>
              <td>{{ row.sent_count }}</td>
              <td>{{ row.failed_count }}</td>
              <td>{{ row.suppressed_count }}</td>
              <td class="actions">
                @if (isOpen(row)) {
                  <button nz-button nzSize="small" (click)="showPreview(row)">{{ 'COMMUNICATION.PREVIEW_AUDIENCE' | translate }}</button>
                  <button nz-button nzSize="small" (click)="openSchedule(row)">{{ 'COMMUNICATION.SCHEDULE' | translate }}</button>
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'COMMUNICATION.CONFIRM_SEND' | translate"
                    (nzOnConfirm)="send(row)"
                  >
                    {{ 'COMMUNICATION.SEND_NOW' | translate }}
                  </button>
                  <button nz-button nzSize="small" nzDanger nz-popconfirm [nzPopconfirmTitle]="'COMMUNICATION.CONFIRM_CANCEL' | translate" (nzOnConfirm)="cancel(row)">
                    {{ 'COMMUNICATION.CANCEL_CAMPAIGN' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8"><nz-empty></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal [nzVisible]="createVisible()" [nzTitle]="'COMMUNICATION.NEW_CAMPAIGN' | translate" [nzFooter]="createFooter" (nzOnCancel)="createVisible.set(false)">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="campaign-name">{{ 'COMMUNICATION.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="campaign-name" formControlName="name" maxlength="160" /></nz-form-control>
          </nz-form-item>
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
            <nz-form-label>{{ 'COMMUNICATION.SEGMENT' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="segment_id" nzAllowClear nzShowSearch>
                @for (segment of segments(); track segment.id) {
                  <nz-option [nzValue]="segment.id" [nzLabel]="segment.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="campaign-subject">{{ 'COMMUNICATION.SUBJECT' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="campaign-subject" formControlName="subject" maxlength="255" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="campaign-body">{{ 'COMMUNICATION.BODY' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'COMMUNICATION.NAME_PLACEHOLDER_HINT' | translate"><textarea nz-input id="campaign-body" rows="5" formControlName="body"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
    <ng-template #createFooter>
      <button nz-button appModalAction="cancel" (click)="createVisible.set(false)"></button>
      <button nz-button nzType="primary" appModalAction="save" [disabled]="form.invalid" (click)="create()"></button>
    </ng-template>

    <nz-modal [nzVisible]="scheduleTarget() !== null" [nzTitle]="'COMMUNICATION.SCHEDULE' | translate" [nzFooter]="scheduleFooter" (nzOnCancel)="scheduleTarget.set(null)">
      <ng-container *nzModalContent>
        <label for="campaign-schedule">{{ 'COMMUNICATION.SCHEDULED_AT' | translate }}</label>
        <input nz-input id="campaign-schedule" type="datetime-local" [ngModel]="scheduleAt()" (ngModelChange)="scheduleAt.set($event)" />
      </ng-container>
    </nz-modal>
    <ng-template #scheduleFooter>
      <button nz-button appModalAction="cancel" (click)="scheduleTarget.set(null)"></button>
      <button nz-button nzType="primary" appModalAction="save" [disabled]="!scheduleAt()" (click)="schedule()"></button>
    </ng-template>

    <nz-modal [nzVisible]="preview() !== null" [nzTitle]="'COMMUNICATION.PREVIEW_AUDIENCE' | translate" [nzFooter]="null" (nzOnCancel)="preview.set(null)">
      <ng-container *nzModalContent>
        @if (preview(); as audience) {
          <p>{{ 'COMMUNICATION.AUDIENCE_TOTAL' | translate }}: {{ audience.total }}</p>
          <p>{{ 'COMMUNICATION.AUDIENCE_DELIVERABLE' | translate }}: {{ audience.deliverable }}</p>
          @for (reason of suppressionReasons(audience); track reason) {
            <p>{{ ('COMMUNICATION.SUPPRESSION_' + reason.toUpperCase()) | translate }}: {{ audience.suppressed[reason] }}</p>
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class CommunicationCampaignsComponent implements OnInit {
  private readonly api = inject(CommunicationApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly channels = CHANNELS;
  readonly statusColors = CAMPAIGN_STATUS_COLORS;

  readonly campaigns = signal<CommunicationCampaign[]>([]);
  readonly segments = signal<CrmSegment[]>([]);
  readonly loading = signal(false);
  readonly createVisible = signal(false);
  readonly scheduleTarget = signal<CommunicationCampaign | null>(null);
  readonly scheduleAt = signal('');
  readonly preview = signal<CommunicationCampaignPreview | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    channel: ['email' as CommunicationChannelType, [Validators.required]],
    segment_id: this.fb.control<string | null>(null),
    subject: [''],
    body: ['', [Validators.required, Validators.maxLength(50000)]],
  });

  ngOnInit(): void {
    this.load();
    this.crm.getSegments().subscribe({ next: (response) => this.segments.set(response.data), error: () => this.segments.set([]) });
  }

  isOpen(campaign: CommunicationCampaign): boolean {
    return isCampaignOpen(campaign.status);
  }

  suppressionReasons(audience: CommunicationCampaignPreview): string[] {
    return Object.keys(audience.suppressed);
  }

  openCreate(): void {
    this.form.reset({ name: '', channel: 'email', segment_id: null, subject: '', body: '' });
    this.createVisible.set(true);
  }

  create(): void {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    this.api.createCampaign({ name: value.name.trim(), channel: value.channel, segment_id: value.segment_id, subject: value.subject.trim() || null, body: value.body }).subscribe({
      next: () => {
        this.createVisible.set(false);
        this.message.success(this.translate.instant('COMMUNICATION.CAMPAIGN_SAVED'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  showPreview(campaign: CommunicationCampaign): void {
    this.api.previewCampaign(campaign.id).subscribe({ next: (response) => this.preview.set(response.data), error: (error: unknown) => this.fail(error) });
  }

  openSchedule(campaign: CommunicationCampaign): void {
    this.scheduleAt.set('');
    this.scheduleTarget.set(campaign);
  }

  schedule(): void {
    const campaign = this.scheduleTarget();
    if (!campaign || !this.scheduleAt()) {
      return;
    }
    this.api.scheduleCampaign(campaign.id, localDateTimeToIso(this.scheduleAt())).subscribe({
      next: () => {
        this.scheduleTarget.set(null);
        this.message.success(this.translate.instant('COMMUNICATION.CAMPAIGN_SCHEDULED'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  send(campaign: CommunicationCampaign): void {
    this.api.sendCampaign(campaign.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('COMMUNICATION.CAMPAIGN_SENT'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  cancel(campaign: CommunicationCampaign): void {
    this.api.cancelCampaign(campaign.id).subscribe({ next: () => this.load(), error: (error: unknown) => this.fail(error) });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getCampaigns({ per_page: 100 }).subscribe({
      next: (response) => {
        this.campaigns.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('COMMUNICATION.ACTION_ERROR'));
      },
    });
  }

  private fail(error: unknown): void {
    this.message.error(apiErrorText(error) ?? this.translate.instant('COMMUNICATION.ACTION_ERROR'));
  }
}
