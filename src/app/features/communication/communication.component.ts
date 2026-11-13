import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CommunicationApiService,
  CommunicationChannelResource,
  CommunicationChannelType,
  CommunicationDeliveryLog,
  CommunicationDriverType,
  CommunicationPreviewResponse,
  CommunicationSaveTemplateRequest,
  CommunicationSendDocumentRequest,
  CommunicationSendMessageRequest,
  CommunicationTemplateResource,
  CommunicationUpdateChannelRequest,
  I18nService,
  serverErrorMessage,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe, ModalActionsDirective, IconActionDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

const TEMPLATE_CODE_PATTERN = /^[a-z][a-z0-9_.]{1,99}$/;

/** API recipient shape per channel (`RecipientRules`): e-mail address, phone number or Telegram chat id / username. */
function recipientFormatValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value;
  if (!value) {
    return null;
  }
  const channel = control.parent?.get('channel')?.value as string | undefined;
  const patterns: Record<string, RegExp> = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    sms: /^\+?[0-9][0-9 ()-]{4,28}$/,
    whatsapp: /^\+?[0-9][0-9 ()-]{4,28}$/,
    telegram: /^(-?[0-9]{1,20}|@[A-Za-z0-9_]{5,32})$/,
  };
  const pattern = channel ? patterns[channel] : undefined;
  return pattern && !pattern.test(value) ? { recipientFormat: true } : null;
}

/** API rule `between:1,65535` on the SMTP port. */
function portRangeValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value;
  if (!value) {
    return null;
  }
  const port = Number(value);
  return port >= 1 && port <= 65535 ? null : { portRange: true };
}

/** API rule: 20000 characters for an email body, 1000 for the other channels. */
function bodyLengthValidator(control: AbstractControl<string>): ValidationErrors | null {
  const channel = control.parent?.get('channel')?.value as string | undefined;
  const limit = channel === 'email' ? 20000 : 1000;
  return (control.value ?? '').length > limit ? { maxlength: { requiredLength: limit } } : null;
}

/** Drivers the API accepts per channel (`DocumentSender::driversOf`) and the credentials each one takes. */
const DRIVERS_BY_CHANNEL: Record<string, CommunicationDriverType[]> = {
  email: ['mail', 'smtp', 'local'],
  telegram: ['telegram', 'local'],
  sms: ['twilio', 'local'],
  whatsapp: ['twilio', 'local'],
};

interface ChannelConfigValue {
  driver: CommunicationDriverType;
  host: string;
  port: string;
  encryption: string;
  username: string;
  password: string;
  from_address: string;
  from_name: string;
  account_sid: string;
  auth_token: string;
  from: string;
  bot_token: string;
}

const SMTP_PORT_PATTERN = /^\d{1,5}$/;

@Component({
  selector: 'app-communication',
  styleUrl: './communication.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    IconActionDirective,
    DatePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzSwitchModule,
    NzAlertModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './communication.component.html',
})
export class CommunicationComponent implements OnInit {
  private readonly api = inject(CommunicationApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal<number>(0);

  // --- TAB 0: DELIVERIES LOG ---
  readonly deliveries = signal<CommunicationDeliveryLog[]>([]);
  readonly deliveriesLoading = signal<boolean>(false);
  readonly filterChannel = signal<string>('');
  readonly filterStatus = signal<string>('');

  // Selected delivery for drawer
  readonly selectedDelivery = signal<CommunicationDeliveryLog | null>(null);
  readonly drawerVisible = signal<boolean>(false);

  // --- TAB 1: CHANNELS ---
  readonly channels = signal<CommunicationChannelResource[]>([]);
  readonly channelsLoading = signal<boolean>(false);
  readonly selectedChannel = signal<CommunicationChannelResource | null>(null);
  readonly configModalVisible = signal<boolean>(false);
  readonly testModalVisible = signal<boolean>(false);
  readonly testLoading = signal<boolean>(false);

  // --- TAB 2: TEMPLATES ---
  readonly templates = signal<CommunicationTemplateResource[]>([]);
  readonly templatesLoading = signal<boolean>(false);
  readonly filterTemplateChannel = signal<string>('');
  readonly selectedTemplate = signal<CommunicationTemplateResource | null>(null);
  readonly templateModalVisible = signal<boolean>(false);
  readonly previewModalVisible = signal<boolean>(false);
  readonly previewContent = signal<CommunicationPreviewResponse | null>(null);

  // Derived metrics
  readonly totalSent = computed(
    () => this.deliveries().filter((d) => d.status === 'sent').length,
  );
  readonly totalFailed = computed(
    () => this.deliveries().filter((d) => d.status === 'failed').length,
  );
  readonly activeChannelsCount = computed(
    () => this.channels().filter((c) => c.is_enabled).length,
  );

  // Forms
  readonly quickSendForm = this.fb.group({
    mode: ['message' as 'message' | 'document', [Validators.required]],
    channel: ['email' as CommunicationChannelType, [Validators.required]],
    recipient: ['', [Validators.required, Validators.maxLength(255), recipientFormatValidator]],
    template_code: ['', [Validators.required, Validators.pattern(TEMPLATE_CODE_PATTERN)]],
    document_type: ['invoice' as 'invoice' | 'quote'],
    document_id: [''],
    message: ['', [Validators.maxLength(1000)]],
  });

  readonly channelConfigForm = this.fb.group({
    driver: ['smtp' as CommunicationDriverType, [Validators.required]],
    is_enabled: [true],
    // SMTP credentials: validated only while the driver is smtp (as the API does)
    host: ['smtp.example.com'],
    port: ['587'],
    encryption: ['tls'],
    username: ['billing@example.com', [Validators.maxLength(500)]],
    password: ['', [Validators.maxLength(500)]],
    from_address: ['billing@example.com'],
    from_name: ['Fattura Facile'],
    // Twilio and Telegram credentials
    account_sid: ['', [Validators.maxLength(500)]],
    auth_token: ['', [Validators.maxLength(500)]],
    from: ['', [Validators.maxLength(500)]],
    bot_token: ['', [Validators.maxLength(500)]],
  });

  readonly testForm = this.fb.group({
    recipient: ['', [Validators.required, Validators.maxLength(255)]],
  });

  readonly templateForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(TEMPLATE_CODE_PATTERN)]],
    channel: ['email' as CommunicationChannelType, [Validators.required]],
    locale: ['it_IT', [Validators.required]],
    subject: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(/^[^\r\n]*$/)]],
    body: ['', [Validators.required, bodyLengthValidator]],
    is_active: [true],
  });

  readonly previewForm = this.fb.group({
    sample_name: ['Mario Rossi'],
    sample_number: ['INV-2026-0042'],
  });

  constructor() {
    const quick = this.quickSendForm.controls;
    quick.mode.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncQuickSendRequirements());
    quick.channel.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => quick.recipient.updateValueAndValidity());
    this.syncQuickSendRequirements();
    this.templateForm.controls.channel.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncTemplateRequirements());
    this.channelConfigForm.controls.driver.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncDriverValidators());
    this.channelConfigForm.controls.is_enabled.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncDriverValidators());
    this.syncDriverValidators();
  }

  /** Drivers selectable for the channel being configured. */
  driverOptions(): CommunicationDriverType[] {
    return DRIVERS_BY_CHANNEL[this.selectedChannel()?.channel ?? 'email'] ?? ['local'];
  }

  isSmtpDriver(): boolean {
    return this.channelConfigForm.controls.driver.value === 'smtp';
  }

  /** The SMTP fields are validated only when the driver is smtp; host and sender only while the channel is enabled. */
  private syncDriverValidators(): void {
    const { host, port, from_address, from_name } = this.channelConfigForm.controls;
    const smtp = this.isSmtpDriver();
    const required = smtp && this.channelConfigForm.controls.is_enabled.value;
    host.setValidators(smtp ? [...(required ? [Validators.required] : []), Validators.maxLength(253)] : []);
    port.setValidators(smtp ? [Validators.pattern(SMTP_PORT_PATTERN), portRangeValidator] : []);
    from_address.setValidators(smtp ? [...(required ? [Validators.required] : []), Validators.email, Validators.maxLength(255)] : []);
    from_name.setValidators(smtp ? [Validators.maxLength(100), Validators.pattern(/^[^\r\n]*$/)] : []);
    for (const control of [host, port, from_address, from_name]) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  /** Message mode requires the recipient and the template; document mode requires the document id. */
  isMessageMode(): boolean {
    return this.quickSendForm.controls.mode.value === 'message';
  }

  /** API rule: the subject of a template is required on the email channel only. */
  isSubjectRequired(): boolean {
    return this.templateForm.controls.channel.value === 'email';
  }

  private syncQuickSendRequirements(): void {
    const { recipient, template_code, document_id } = this.quickSendForm.controls;
    this.toggleRequired(recipient, this.isMessageMode());
    this.toggleRequired(template_code, this.isMessageMode());
    this.toggleRequired(document_id, !this.isMessageMode());
  }

  private syncTemplateRequirements(): void {
    this.toggleRequired(this.templateForm.controls.subject, this.isSubjectRequired());
    this.templateForm.controls.body.updateValueAndValidity({ emitEvent: false });
  }

  private toggleRequired(control: AbstractControl, required: boolean): void {
    if (required) {
      control.addValidators(Validators.required);
    } else {
      control.removeValidators(Validators.required);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    if (control?.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    if (control?.hasError('email')) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_EMAIL');
    }
    if (control?.errors) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
    }
    return '';
  }

  ngOnInit(): void {
    this.loadDeliveries();
    this.loadChannels();
    this.loadTemplates();
  }

  // --- TAB 0: DELIVERIES LOG ---
  loadDeliveries(): void {
    this.deliveriesLoading.set(true);
    this.api
      .getDeliveries({
        channel: this.filterChannel() || undefined,
        status: this.filterStatus() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.deliveries.set(res?.data || []);
          this.deliveriesLoading.set(false);
        },
        error: () => {
          this.deliveriesLoading.set(false);
        },
      });
  }

  openDeliveryDrawer(d: CommunicationDeliveryLog): void {
    this.selectedDelivery.set(d);
    this.drawerVisible.set(true);
  }

  closeDeliveryDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedDelivery.set(null);
  }

  // --- TAB 1: CHANNELS ---
  loadChannels(): void {
    this.channelsLoading.set(true);
    this.api.getChannels().subscribe({
      next: (res) => {
        this.channels.set(res?.data || []);
        this.channelsLoading.set(false);
      },
      error: () => {
        this.channelsLoading.set(false);
      },
    });
  }

  openChannelConfigModal(channel: CommunicationChannelResource): void {
    this.selectedChannel.set(channel);
    const s = (channel.settings || {}) as Record<string, string>;
    this.channelConfigForm.reset({
      driver: channel.driver,
      is_enabled: channel.is_enabled,
      account_sid: s['account_sid'] || '',
      auth_token: '',
      from: s['from'] || '',
      bot_token: '',
      host: s['host'] || 'smtp.example.com',
      port: s['port'] ? String(s['port']) : '587',
      encryption: s['encryption'] || 'tls',
      username: s['username'] || '',
      password: '',
      from_address: s['from_address'] || '',
      from_name: s['from_name'] || '',
    });
    this.syncDriverValidators();
    this.configModalVisible.set(true);
  }

  saveChannelConfig(): void {
    const ch = this.selectedChannel();
    if (!ch || this.channelConfigForm.invalid) {
      this.channelConfigForm.markAllAsTouched();
      return;
    }
    const val = this.channelConfigForm.getRawValue();
    const payload: CommunicationUpdateChannelRequest = {
      driver: val.driver,
      is_enabled: val.is_enabled,
      credentials: this.credentialsOf(val),
    };

    this.api.updateChannel(ch.channel, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('COMMUNICATION.CHANNEL_UPDATED'));
        this.configModalVisible.set(false);
        this.loadChannels();
      },
      error: () => {
        this.message.error(this.translate.instant('COMMUNICATION.ACTION_ERROR'));
      },
    });
  }

  /** Only the credentials of the chosen driver: the API refuses the keys another driver owns. */
  private credentialsOf(val: ChannelConfigValue): Record<string, unknown> {
    switch (val.driver) {
      case 'smtp':
        return {
          host: val.host,
          port: val.port ? Number(val.port) : null,
          encryption: val.encryption,
          username: val.username,
          password: val.password || undefined,
          from_address: val.from_address,
          from_name: val.from_name,
        };
      case 'twilio':
        return { account_sid: val.account_sid, auth_token: val.auth_token || undefined, from: val.from };
      case 'telegram':
        return { bot_token: val.bot_token || undefined };
      default:
        return {};
    }
  }

  openTestChannelModal(channel: CommunicationChannelResource): void {
    this.selectedChannel.set(channel);
    this.testForm.reset({
      recipient: channel.channel === 'email' ? 'test@example.com' : '+39333000000',
    });
    this.testModalVisible.set(true);
  }

  runChannelTest(): void {
    const ch = this.selectedChannel();
    if (!ch || this.testForm.invalid) {
      this.testForm.markAllAsTouched();
      return;
    }
    this.testLoading.set(true);
    const val = this.testForm.getRawValue();

    this.api.testChannel(ch.channel, { recipient: val.recipient }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('COMMUNICATION.TEST_SUCCESS'));
        this.testLoading.set(false);
        this.testModalVisible.set(false);
      },
      error: () => {
        this.testLoading.set(false);
        this.message.error(this.translate.instant('COMMUNICATION.TEST_FAILED'));
      },
    });
  }

  // --- TAB 2: TEMPLATES ---
  loadTemplates(): void {
    this.templatesLoading.set(true);
    this.api
      .getTemplates({
        channel: this.filterTemplateChannel() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.templates.set(res?.data || []);
          this.templatesLoading.set(false);
        },
        error: () => {
          this.templatesLoading.set(false);
        },
      });
  }

  openCreateTemplateModal(): void {
    this.selectedTemplate.set(null);
    this.templateForm.reset({
      code: '',
      channel: 'email',
      locale: 'it_IT',
      subject: '',
      body: '',
      is_active: true,
    });
    this.templateModalVisible.set(true);
  }

  openEditTemplateModal(t: CommunicationTemplateResource): void {
    this.selectedTemplate.set(t);
    this.templateForm.reset({
      code: t.code,
      channel: t.channel,
      locale: t.locale,
      subject: t.subject || '',
      body: t.body,
      is_active: t.is_active,
    });
    this.templateModalVisible.set(true);
  }

  saveTemplate(): void {
    if (this.templateForm.invalid) {
      this.templateForm.markAllAsTouched();
      return;
    }
    const val = this.templateForm.getRawValue();
    const payload: CommunicationSaveTemplateRequest = {
      code: val.code,
      channel: val.channel,
      locale: val.locale,
      subject: val.subject || undefined,
      body: val.body,
      is_active: val.is_active,
    };

    const existing = this.selectedTemplate();
    const req = existing
      ? this.api.updateTemplate(existing.id, payload)
      : this.api.createTemplate(payload);

    req.subscribe({
      next: () => {
        this.message.success(this.translate.instant('COMMUNICATION.TEMPLATE_SAVED'));
        this.templateModalVisible.set(false);
        this.loadTemplates();
      },
      error: () => {
        this.message.error(this.translate.instant('COMMUNICATION.ACTION_ERROR'));
      },
    });
  }

  deleteTemplate(id: string): void {
    this.api.deleteTemplate(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('COMMUNICATION.TEMPLATE_DELETED'));
        this.loadTemplates();
      },
      error: () => {
        this.message.error(this.translate.instant('COMMUNICATION.ACTION_ERROR'));
      },
    });
  }

  openPreviewModal(t: CommunicationTemplateResource): void {
    this.selectedTemplate.set(t);
    this.previewForm.reset({
      sample_name: 'Mario Rossi',
      sample_number: 'INV-2026-0042',
    });
    this.previewModalVisible.set(true);
    this.runPreview();
  }

  runPreview(): void {
    const t = this.selectedTemplate();
    if (!t) return;
    const val = this.previewForm.getRawValue();

    this.api
      .previewTemplate(t.id, {
        variables: {
          name: val.sample_name,
          number: val.sample_number,
        },
      })
      .subscribe({
        next: (res) => {
          this.previewContent.set(res?.data);
        },
      });
  }

  // --- TAB 3: QUICK SEND ---
  sendQuickCommunication(): void {
    if (this.quickSendForm.invalid) {
      this.quickSendForm.markAllAsTouched();
      return;
    }
    const val = this.quickSendForm.getRawValue();

    if (val.mode === 'document') {
      const payload: CommunicationSendDocumentRequest = {
        document_type: val.document_type || 'invoice',
        document_id: val.document_id || '',
        channel: val.channel,
        recipient: val.recipient,
        message: val.message || undefined,
      };
      this.api.sendDocument(payload).subscribe({
        next: () => {
          this.message.success(this.translate.instant('COMMUNICATION.DOCUMENT_SENT'));
          this.loadDeliveries();
          this.selectedTabIndex.set(0);
        },
        error: () => {
          this.message.error(this.translate.instant('COMMUNICATION.ACTION_ERROR'));
        },
      });
    } else {
      const payload: CommunicationSendMessageRequest = {
        channel: val.channel,
        recipient: val.recipient,
        template_code: val.template_code || 'payment.reminder',
      };
      this.api.sendMessage(payload).subscribe({
        next: () => {
          this.message.success(this.translate.instant('COMMUNICATION.MESSAGE_SENT'));
          this.loadDeliveries();
          this.selectedTabIndex.set(0);
        },
        error: () => {
          this.message.error(this.translate.instant('COMMUNICATION.ACTION_ERROR'));
        },
      });
    }
  }

  getChannelBadgeColor(channel: string): string {
    switch (channel) {
      case 'email':
        return 'blue';
      case 'whatsapp':
        return 'green';
      case 'telegram':
        return 'cyan';
      case 'sms':
        return 'orange';
      default:
        return 'default';
    }
  }

  getDeliveryStatusColor(status: string): string {
    switch (status) {
      case 'sent':
        return 'success';
      case 'simulated':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  }
}
