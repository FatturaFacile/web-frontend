import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  OnInit,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@core/i18n/i18n.service';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import {
  AnalyticsApiService,
  DmsApiService,
  DmsFolderResource,
  SettingsApiService,
  StudioExportFormat,
  StudioLocale,
  StudioSaveScheduleRequest,
  StudioSchedule,
  UserResource,
} from '@core';
import { TranslatePipe, RadioControlDirective } from '@shared';
import { analyticsErrorText } from '../analytics-designer.util';
import { CRON_PRESET_KEYS, CRON_PRESETS, CronPresetKey, presetOf, readCron } from './cron-presets';
import { FORMAT_KEYS, LOCALE_KEYS, PRESET_KEYS, TIMEZONES } from './studio-keys';

/**
 * The delivery schedule of a saved report: a cron expression built from presets (every day, Monday, the 1st of the month)
 * or typed by hand with a plain-language reading and the next real runs from the API, a time zone, the locale and format
 * of the file, and the channels it goes to: internal users and external addresses by e-mail, Telegram chats, a document
 * folder and a signed webhook. The signing secret of a new webhook is shown once.
 */
@Component({
  selector: 'app-schedule-drawer',
  imports: [
    RadioControlDirective,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
    NzSwitchModule,
    TranslatePipe,
  ],
  styleUrl: './schedule-drawer.component.scss',
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      nzPlacement="right"
      nzWidth="520"
      [nzTitle]="'ANALYTICS_STUDIO.SCHEDULE_TITLE' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (errorText(); as text) {
          <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="block"></nz-alert>
        }
        @if (secret(); as value) {
          <nz-alert
            nzType="success"
            nzShowIcon
            class="block"
            [nzMessage]="'ANALYTICS_STUDIO.WEBHOOK_SECRET' | translate"
            [nzDescription]="value"
          ></nz-alert>
        }

        <div class="field">
          <label for="sched-name">{{ 'ANALYTICS_STUDIO.SCHEDULE_NAME' | translate }}</label>
          <input
            id="sched-name"
            nz-input
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            maxlength="150"
          />
        </div>

        <fieldset class="field">
          <legend>{{ 'ANALYTICS_STUDIO.SCHEDULE_WHEN' | translate }}</legend>
          <nz-radio-group
            [ngModel]="preset()"
            (ngModelChange)="choosePreset($event)"
            data-testid="cron-presets"
          >
            @for (key of presetKeys; track key) {
              <label [attr.for]="'schedule-drawer-field-2-' + $index" appRadioControl nz-radio [nzValue]="key">{{ presetLabels[key] | translate }}</label>
            }
          </nz-radio-group>
          <label class="sub" for="sched-cron">{{
            'ANALYTICS_STUDIO.CRON_EXPRESSION' | translate
          }}</label>
          <input
            id="sched-cron"
            nz-input
            class="mono"
            [ngModel]="cron()"
            (ngModelChange)="setCron($event)"
            [readOnly]="preset() !== 'custom'"
          />
          <small class="hint" data-testid="cron-reading">{{ reading() }}</small>
        </fieldset>

        <div class="field">
          <label for="sched-timezone">{{ 'ANALYTICS_STUDIO.TIMEZONE' | translate }}</label>
          <nz-select
            id="sched-timezone"
            nzShowSearch
            [ngModel]="timezone()"
            (ngModelChange)="setTimezone($event)"
          >
            @for (zone of timezones; track zone) {
              <nz-option [nzValue]="zone" [nzLabel]="zone"></nz-option>
            }
          </nz-select>
        </div>

        <div class="preview" aria-live="polite" data-testid="cron-preview">
          <strong>{{ 'ANALYTICS_STUDIO.NEXT_RUNS' | translate }}</strong>
          @if (previewError(); as text) {
            <span class="error">{{ text }}</span>
          } @else {
            <ul>
              @for (run of nextRuns(); track run) {
                <li>{{ run }}</li>
              }
            </ul>
          }
        </div>

        <div class="row">
          <div class="field">
            <label for="sched-locale">{{ 'ANALYTICS_STUDIO.LOCALE' | translate }}</label>
            <nz-select id="sched-locale" [ngModel]="locale()" (ngModelChange)="locale.set($event)">
              @for (item of locales; track item) {
                <nz-option [nzValue]="item" [nzLabel]="localeLabels[item] | translate"></nz-option>
              }
            </nz-select>
          </div>
          <div class="field">
            <label for="sched-format">{{ 'ANALYTICS_STUDIO.FORMAT' | translate }}</label>
            <nz-select id="sched-format" [ngModel]="format()" (ngModelChange)="format.set($event)">
              @for (item of formats; track item) {
                <nz-option [nzValue]="item" [nzLabel]="formatLabels[item] | translate"></nz-option>
              }
            </nz-select>
          </div>
        </div>

        <fieldset class="field channels">
          <legend>{{ 'ANALYTICS_STUDIO.CHANNELS' | translate }}</legend>
          <label for="schedule-drawer-field" nzId="schedule-drawer-field" nz-checkbox [ngModel]="email()" (ngModelChange)="email.set($event)">{{
            'ANALYTICS_STUDIO.CHANNEL_EMAIL' | translate
          }}</label>

          <label class="sub" for="sched-users">{{
            'ANALYTICS_STUDIO.INTERNAL_USERS' | translate
          }}</label>
          <nz-select
            id="sched-users"
            nzMode="multiple"
            nzShowSearch
            [ngModel]="userIds()"
            (ngModelChange)="userIds.set($event)"
          >
            @for (user of users(); track user.id) {
              <nz-option
                [nzValue]="user.id"
                [nzLabel]="user.name + ' (' + user.email + ')'"
              ></nz-option>
            }
          </nz-select>

          <label class="sub" for="sched-external">{{
            'ANALYTICS_STUDIO.EXTERNAL_EMAILS' | translate
          }}</label>
          <nz-select
            id="sched-external"
            nzMode="tags"
            [ngModel]="externalEmails()"
            (ngModelChange)="externalEmails.set($event)"
            [nzTokenSeparators]="[',', ';', ' ']"
          ></nz-select>

          <label class="sub" for="sched-telegram">{{
            'ANALYTICS_STUDIO.TELEGRAM_CHATS' | translate
          }}</label>
          <nz-select
            id="sched-telegram"
            nzMode="tags"
            [ngModel]="telegramChats()"
            (ngModelChange)="telegramChats.set($event)"
            [nzTokenSeparators]="[',', ' ']"
          ></nz-select>

          <label class="sub" for="sched-folder">{{
            'ANALYTICS_STUDIO.DMS_FOLDER' | translate
          }}</label>
          <nz-select
            id="sched-folder"
            nzAllowClear
            [ngModel]="folderId()"
            (ngModelChange)="folderId.set($event)"
          >
            @for (folder of folders(); track folder.id) {
              <nz-option [nzValue]="folder.id" [nzLabel]="folder.name"></nz-option>
            }
          </nz-select>

          <label class="sub" for="sched-webhook">{{
            'ANALYTICS_STUDIO.WEBHOOK_URL' | translate
          }}</label>
          <input
            id="sched-webhook"
            nz-input
            type="url"
            placeholder="https://"
            [ngModel]="webhookUrl()"
            (ngModelChange)="webhookUrl.set($event)"
          />
        </fieldset>

        <div class="field inline">
          <nz-switch
            [ngModel]="active()"
            (ngModelChange)="active.set($event)"
            id="sched-active"
          ></nz-switch>
          <label for="sched-active">{{ 'ANALYTICS_STUDIO.SCHEDULE_ACTIVE' | translate }}</label>
        </div>

        <div class="actions">
          <button nz-button type="button" (click)="close()">
            {{ 'ANALYTICS_STUDIO.CLOSE' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="saving()"
            [disabled]="!canSave()"
            (click)="save()"
            data-testid="schedule-save"
          >
            {{ 'ANALYTICS_STUDIO.SCHEDULE_SAVE' | translate }}
          </button>
        </div>
      </ng-container>
    </nz-drawer>
  `,
})
export class ScheduleDrawerComponent implements OnInit {
  private readonly api = inject(AnalyticsApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly dmsApi = inject(DmsApiService);
  private readonly i18n = inject(I18nService);

  readonly visible = model(false);
  /** The saved report to schedule. */
  readonly reportId = input.required<string | null>();
  /** The schedule being edited, if any. */
  readonly schedule = input<StudioSchedule | null>(null);
  readonly saved = output<StudioSchedule>();

  protected readonly presetKeys = CRON_PRESET_KEYS;
  protected readonly presetLabels = PRESET_KEYS;
  protected readonly timezones = TIMEZONES;
  protected readonly locales = Object.keys(LOCALE_KEYS) as StudioLocale[];
  protected readonly localeLabels = LOCALE_KEYS;
  protected readonly formats = ['xlsx', 'pdf', 'csv', 'json'] as StudioExportFormat[];
  protected readonly formatLabels = FORMAT_KEYS;

  readonly name = signal('');
  readonly preset = signal<CronPresetKey>('weekly_monday');
  readonly cron = signal<string>(CRON_PRESETS.weekly_monday);
  readonly timezone = signal('Europe/Zurich');
  readonly locale = signal<StudioLocale>('it-CH');
  readonly format = signal<StudioExportFormat>('xlsx');
  readonly email = signal(true);
  readonly userIds = signal<string[]>([]);
  readonly externalEmails = signal<string[]>([]);
  readonly telegramChats = signal<string[]>([]);
  readonly folderId = signal<string | null>(null);
  readonly webhookUrl = signal('');
  readonly active = signal(true);

  readonly users = signal<UserResource[]>([]);
  readonly folders = signal<DmsFolderResource[]>([]);
  readonly nextRuns = signal<string[]>([]);
  readonly previewError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errorText = signal<string | null>(null);
  readonly secret = signal<string | null>(null);
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewTicket = 0;

  protected readonly reading = computed(() => {
    const read = readCron(this.cron());
    const params: Record<string, string> = { ...read.params };
    const weekday = read.params['weekday'];
    if (weekday !== undefined) {
      params['weekday'] = this.i18n.translate(weekday);
    }

    return this.i18n.translate(read.key, params);
  });

  readonly canSave = computed(
    () =>
      this.reportId() !== null &&
      this.cron().trim() !== '' &&
      this.previewError() === null &&
      (this.email() ||
        this.userIds().length > 0 ||
        this.externalEmails().length > 0 ||
        this.telegramChats().length > 0 ||
        this.folderId() !== null ||
        this.webhookUrl().trim() !== ''),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimer());

    // Loads the schedule being edited into the form each time the drawer opens.
    effect(() => {
      if (this.visible()) {
        untracked(() => this.load(this.schedule()));
      }
    });
  }

  ngOnInit(): void {
    this.settingsApi.getTenantUsers().subscribe({
      next: (response) => this.users.set(response.data.filter((user) => user.is_active)),
      error: () => this.users.set([]),
    });
    this.dmsApi.getFolders().subscribe({
      next: (response) => this.folders.set(response.data),
      error: () => this.folders.set([]),
    });
  }

  choosePreset(key: CronPresetKey): void {
    this.preset.set(key);
    if (key !== 'custom') {
      this.setCron(CRON_PRESETS[key]);
    }
  }

  setCron(expression: string): void {
    this.cron.set(expression);
    this.queuePreview();
  }

  setTimezone(zone: string): void {
    this.timezone.set(zone);
    this.queuePreview();
  }

  /** Asks the API for the next runs of the expression; it is also what validates the expression. */
  preview(): void {
    this.clearTimer();
    const ticket = ++this.previewTicket;
    this.api.previewCron(this.cron().trim(), this.timezone()).subscribe({
      next: (response) => {
        if (ticket === this.previewTicket) {
          this.nextRuns.set(response.data.next_runs.map((run) => this.formatRun(run)));
          this.previewError.set(null);
        }
      },
      error: (error: unknown) => {
        if (ticket === this.previewTicket) {
          this.nextRuns.set([]);
          this.previewError.set(
            analyticsErrorText(error) ?? this.i18n.translate('ANALYTICS_STUDIO.CRON_INVALID'),
          );
        }
      },
    });
  }

  save(): void {
    const reportId = this.reportId();
    if (reportId === null || !this.canSave()) {
      return;
    }

    const payload: StudioSaveScheduleRequest = {
      designed_report_id: reportId,
      name: this.name().trim() === '' ? null : this.name().trim(),
      cron_expression: this.cron().trim(),
      timezone: this.timezone(),
      locale: this.locale(),
      format: this.format(),
      recipient_user_ids: this.userIds(),
      external_emails: this.externalEmails(),
      delivery_channels: {
        email: this.email(),
        telegram_chat_ids: this.telegramChats(),
        dms_folder_id: this.folderId(),
        webhook_url: this.webhookUrl().trim() === '' ? null : this.webhookUrl().trim(),
      },
      is_active: this.active(),
    };
    const current = this.schedule();
    const request =
      current === null
        ? this.api.createStudioSchedule(payload)
        : this.api.updateStudioSchedule(current.id, payload);

    this.saving.set(true);
    this.errorText.set(null);
    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.secret.set(response.data.webhook_secret);
        this.saved.emit(response.data.schedule);
        if (response.data.webhook_secret === null) {
          this.close();
        }
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorText.set(
          analyticsErrorText(error) ?? this.i18n.translate('ANALYTICS_STUDIO.ACTION_ERROR'),
        );
      },
    });
  }

  close(): void {
    this.visible.set(false);
    this.secret.set(null);
    this.errorText.set(null);
  }

  private load(schedule: StudioSchedule | null): void {
    const expression = schedule?.cron_expression ?? CRON_PRESETS.weekly_monday;
    this.name.set(schedule?.name ?? '');
    this.cron.set(expression);
    this.preset.set(presetOf(expression));
    this.timezone.set(schedule?.timezone ?? 'Europe/Zurich');
    this.locale.set(schedule?.locale ?? 'it-CH');
    this.format.set(schedule?.format ?? 'xlsx');
    this.email.set(schedule?.delivery_channels.email ?? true);
    this.userIds.set(schedule?.recipient_user_ids ?? []);
    this.externalEmails.set(schedule?.external_emails ?? []);
    this.telegramChats.set(schedule?.delivery_channels.telegram_chat_ids ?? []);
    this.folderId.set(schedule?.delivery_channels.dms_folder_id ?? null);
    this.webhookUrl.set(schedule?.delivery_channels.webhook_url ?? '');
    this.active.set(schedule?.is_active ?? true);
    this.secret.set(null);
    this.errorText.set(null);
    this.preview();
  }

  private queuePreview(): void {
    this.clearTimer();
    this.previewTimer = setTimeout(() => this.preview(), 400);
  }

  private clearTimer(): void {
    if (this.previewTimer !== null) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
  }

  private formatRun(iso: string): string {
    const date = new Date(iso);

    return Number.isNaN(date.getTime()) ? iso : `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
  }
}
