import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CS_DISPATCH_STATUSES,
  CS_SURVEY_TYPES,
  CS_TRIGGER_EVENTS,
  CsDispatchStatus,
  CsListFilters,
  CsResponse,
  CsSurveyType,
  CsTriggerEvent,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  bandColor,
  CUSTOMER_SATISFACTION_MODULE,
  dispatchStatusColor,
  sentimentColor,
} from './customer-satisfaction.util';
import { DispatchesStore } from './dispatches.store';

/**
 * The dispatch monitor (status, scheduled and sent times, the throttle reason of a survey held back by the fatigue rules) and the
 * log of the answers: score, band, text comment, voice note with its transcript and the sentiment.
 */
@Component({
  selector: 'app-cs-dispatches',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [DispatchesStore],
  styleUrl: './customer-satisfaction.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.CUSTOMER_SATISFACTION_DISPATCHES' | translate"
      [subtitle]="'customerSatisfaction.dispatches.subtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-tabs [nzSelectedIndex]="tab()" (nzSelectedIndexChange)="selectTab($event)">
      <nz-tab [nzTitle]="'customerSatisfaction.tab.dispatches' | translate">
        <div class="toolbar">
          <label class="field" for="cs-d-status">
            <span>{{ 'customerSatisfaction.field.status' | translate }}</span>
            <nz-select
              nzId="cs-d-status"
              nzAllowClear
              [(ngModel)]="statusFilter"
              (ngModelChange)="reloadDispatches()"
            >
              @for (status of dispatchStatuses; track status) {
                <nz-option
                  [nzValue]="status"
                  [nzLabel]="'customerSatisfaction.dispatchStatus.' + status | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="cs-d-trigger">
            <span>{{ 'customerSatisfaction.field.triggerEvent' | translate }}</span>
            <nz-select
              nzId="cs-d-trigger"
              nzAllowClear
              [(ngModel)]="triggerFilter"
              (ngModelChange)="reloadDispatches()"
            >
              @for (event of triggerEvents; track event) {
                <nz-option
                  [nzValue]="event"
                  [nzLabel]="'customerSatisfaction.trigger.' + event | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <span class="spacer"></span>
          @if (canWrite) {
            <button
              nz-button
              type="button"
              data-test="process"
              [nzLoading]="store.processing()"
              (click)="processDue()"
            >
              {{ 'customerSatisfaction.action.processDue' | translate }}
            </button>
          }
        </div>

        <nz-spin [nzSpinning]="store.loading()">
          <nz-table
            #dispatches
            nzSize="small"
            [nzData]="store.dispatches()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '1000px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'customerSatisfaction.field.customer' | translate }}</th>
                <th scope="col">{{ 'customerSatisfaction.field.template' | translate }}</th>
                <th scope="col">{{ 'customerSatisfaction.field.triggerEvent' | translate }}</th>
                <th scope="col">{{ 'customerSatisfaction.field.channel' | translate }}</th>
                <th scope="col">{{ 'customerSatisfaction.field.status' | translate }}</th>
                <th scope="col">{{ 'customerSatisfaction.field.scheduledFor' | translate }}</th>
                <th scope="col">{{ 'customerSatisfaction.field.respondedAt' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of dispatches.data; track row.id) {
                <tr [attr.data-test]="'dispatch-' + row.id">
                  <th scope="row">{{ row.customer_name ?? row.customer_id }}</th>
                  <td>{{ row.template_code }}</td>
                  <td>{{ 'customerSatisfaction.trigger.' + row.trigger_event | translate }}</td>
                  <td>
                    {{ 'customerSatisfaction.channel.' + row.channel | translate }}
                    <small class="muted">{{ row.locale }}</small>
                  </td>
                  <td>
                    <nz-tag [nzColor]="dispatchStatusColor(row.status)">{{
                      'customerSatisfaction.dispatchStatus.' + row.status | translate
                    }}</nz-tag>
                    @if (row.throttle_reason) {
                      <small class="muted" data-test="throttle-reason">{{
                        'customerSatisfaction.throttleReason.' + row.throttle_reason | translate
                      }}</small>
                    }
                  </td>
                  <td>{{ row.scheduled_for | date: 'short' }}</td>
                  <td>{{ row.responded_at | date: 'short' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (!store.loading() && store.dispatches().length === 0) {
            <nz-empty
              [nzNotFoundContent]="'customerSatisfaction.empty.dispatches' | translate"
            ></nz-empty>
          }
        </nz-spin>
      </nz-tab>

      <nz-tab [nzTitle]="'customerSatisfaction.tab.responses' | translate">
        <div class="toolbar">
          <label class="field" for="cs-a-type">
            <span>{{ 'customerSatisfaction.field.surveyType' | translate }}</span>
            <nz-select
              nzId="cs-a-type"
              nzAllowClear
              [(ngModel)]="typeFilter"
              (ngModelChange)="reloadResponses()"
            >
              @for (type of surveyTypes; track type) {
                <nz-option
                  [nzValue]="type"
                  [nzLabel]="'customerSatisfaction.surveyType.' + type | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="cs-a-detractor">
            <span>{{ 'customerSatisfaction.field.band' | translate }}</span>
            <nz-select
              nzId="cs-a-detractor"
              nzAllowClear
              [(ngModel)]="detractorFilter"
              (ngModelChange)="reloadResponses()"
            >
              <nz-option
                [nzValue]="true"
                [nzLabel]="'customerSatisfaction.filter.detractorsOnly' | translate"
              ></nz-option>
              <nz-option
                [nzValue]="false"
                [nzLabel]="'customerSatisfaction.filter.othersOnly' | translate"
              ></nz-option>
            </nz-select>
          </label>
        </div>

        <nz-spin [nzSpinning]="store.loading()">
          <nz-table
            #responses
            nzSize="small"
            [nzData]="store.responses()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '1000px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'customerSatisfaction.field.customer' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'customerSatisfaction.field.score' | translate }}
                </th>
                <th scope="col">{{ 'customerSatisfaction.field.comment' | translate }}</th>
                <th scope="col">{{ 'customerSatisfaction.field.sentiment' | translate }}</th>
                <th scope="col">{{ 'customerSatisfaction.field.submittedVia' | translate }}</th>
                <th scope="col">{{ 'customerSatisfaction.field.respondedAt' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of responses.data; track row.id) {
                <tr [attr.data-test]="'response-' + row.id">
                  <th scope="row">{{ row.customer_name ?? row.customer_id }}</th>
                  <td class="num">
                    <nz-tag [nzColor]="bandColor(row.normalized_band)">
                      {{ row.score }} ·
                      {{ 'customerSatisfaction.surveyType.' + row.survey_type | translate }}
                    </nz-tag>
                  </td>
                  <td>
                    @if (row.comment_text) {
                      <span class="comment">{{ row.comment_text }}</span>
                    }
                    @if (row.has_voice) {
                      @if (voiceUrls()[row.id]; as url) {
                        <audio controls [src]="url" data-test="voice-player"></audio>
                      } @else {
                        <button
                          nz-button
                          nzSize="small"
                          type="button"
                          data-test="load-voice"
                          (click)="playVoice(row)"
                        >
                          {{ 'customerSatisfaction.action.playVoice' | translate }}
                        </button>
                      }
                      @if (row.voice_transcript) {
                        <small class="muted comment">{{ row.voice_transcript }}</small>
                      }
                    }
                    @if (!row.comment_text && !row.has_voice) {
                      <small class="muted">{{
                        'customerSatisfaction.field.noComment' | translate
                      }}</small>
                    }
                  </td>
                  <td>
                    @if (row.sentiment_label) {
                      <nz-tag [nzColor]="sentimentColor(row.sentiment_label)">{{
                        'customerSatisfaction.sentiment.' + row.sentiment_label | translate
                      }}</nz-tag>
                    }
                  </td>
                  <td>
                    {{ 'customerSatisfaction.submittedVia.' + row.submitted_via | translate }}
                  </td>
                  <td>{{ row.initial_clicked_at | date: 'short' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (!store.loading() && store.responses().length === 0) {
            <nz-empty
              [nzNotFoundContent]="'customerSatisfaction.empty.responses' | translate"
            ></nz-empty>
          }
        </nz-spin>
      </nz-tab>
    </nz-tabs>
  `,
})
export class DispatchesComponent implements OnInit {
  protected readonly store = inject(DispatchesStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly canWrite = inject(PermissionsService).canWrite(CUSTOMER_SATISFACTION_MODULE);
  protected readonly dispatchStatuses = CS_DISPATCH_STATUSES;
  protected readonly triggerEvents = CS_TRIGGER_EVENTS;
  protected readonly surveyTypes = CS_SURVEY_TYPES;
  protected readonly bandColor = bandColor;
  protected readonly dispatchStatusColor = dispatchStatusColor;
  protected readonly sentimentColor = sentimentColor;

  protected readonly tab = signal(0);
  protected readonly voiceUrls = signal<Record<string, SafeUrl>>({});
  private readonly objectUrls: string[] = [];

  protected statusFilter: CsDispatchStatus | null = null;
  protected triggerFilter: CsTriggerEvent | null = null;
  protected typeFilter: CsSurveyType | null = null;
  protected detractorFilter: boolean | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.objectUrls.forEach((url) => URL.revokeObjectURL(url)));
  }

  ngOnInit(): void {
    void this.store.loadDispatches();
  }

  protected selectTab(index: number): void {
    this.tab.set(index);
    if (index === 1 && this.store.responses().length === 0) {
      this.reloadResponses();
    }
  }

  protected reloadDispatches(): void {
    const filters: CsListFilters = {};
    if (this.statusFilter) filters.dispatch_status = this.statusFilter;
    if (this.triggerFilter) filters.trigger_event = this.triggerFilter;
    void this.store.loadDispatches(filters);
  }

  protected reloadResponses(): void {
    const filters: CsListFilters = {};
    if (this.typeFilter) filters.survey_type = this.typeFilter;
    if (this.detractorFilter !== null) filters.is_detractor = this.detractorFilter;
    void this.store.loadResponses(filters);
  }

  protected async processDue(): Promise<void> {
    const outcome = await this.store.processDue();
    if (outcome.ok) {
      this.message.success(
        this.i18n.instant('customerSatisfaction.message.processed', {
          sent: outcome.sent ?? 0,
          failed: outcome.failed ?? 0,
        }),
      );
      this.reloadDispatches();
    } else {
      this.message.error(
        this.i18n.instant(outcome.errorKey ?? 'customerSatisfaction.error.generic'),
      );
    }
  }

  protected async playVoice(row: CsResponse): Promise<void> {
    const blob = await this.store.loadVoice(row.id);
    if (blob === null) {
      return;
    }
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);
    this.voiceUrls.update((urls) => ({
      ...urls,
      [row.id]: this.sanitizer.bypassSecurityTrustUrl(url),
    }));
  }
}
