import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ElectronicSignatureApiService } from '@core/api/electronic-signature-api.service';
import { TranslateService } from '@core/i18n/i18n.service';
import {
  ESIG_JURISDICTIONS,
  ESIG_LEVELS,
  ESIG_ROLES,
  EsigAuthMethod,
  EsigEnvelopePayload,
  EsigJurisdiction,
  EsigLevel,
  EsigLookups,
  EsigProvider,
  EsigRoutingMode,
  EsigSignableType,
  EsigSignatureBox,
} from '@core/models/electronic-signature.model';
import { RadioControlDirective } from '@shared/directives/radio-control.directive';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import {
  authMethodsFor,
  boxAt,
  defaultAuthMethod,
  DraftRecipient,
  eligibleConfigs,
  emptyRecipient,
  EsigOutcome,
  failureOf,
  levelRank,
  maxLevel,
  recipientProblems,
  resizeBox,
  toRecipientPayload,
} from './e-signature.util';
import { PdfViewBox, PdfViewComponent } from './pdf-view.component';
import { firstValueFrom } from 'rxjs';

type Step = 0 | 1 | 2 | 3;

/**
 * The send-for-signature wizard, one reusable drawer for quotes, purchase orders, employment contracts, documents and for a
 * standalone file: (1) tier, jurisdiction and provider, (2) signers, routing and roles, (3) visual placement of the signature
 * boxes on the PDF and the message and expiry, (4) review and dispatch. The tier cannot go below what the compliance policy of
 * the document type and amount requires; the API enforces the same rule.
 */
@Component({
  selector: 'app-send-for-signature-drawer',
  imports: [
    FormsModule,
    PdfViewComponent,
    RadioControlDirective,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzStepsModule,
    NzTagModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzWidth]="860"
      [nzTitle]="'signatures.wizard.title' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <nz-steps [nzCurrent]="step()" nzSize="small" class="steps">
          <nz-step [nzTitle]="'signatures.wizard.step1' | translate"></nz-step>
          <nz-step [nzTitle]="'signatures.wizard.step2' | translate"></nz-step>
          <nz-step [nzTitle]="'signatures.wizard.step3' | translate"></nz-step>
          <nz-step [nzTitle]="'signatures.wizard.step4' | translate"></nz-step>
        </nz-steps>

        @if (error(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure | translate"
          ></nz-alert>
        }

        <nz-spin [nzSpinning]="loading()">
          @switch (step()) {
            @case (0) {
              @if (signableType() === 'upload') {
                <label class="field" for="esig-file">
                  <span>{{ 'signatures.wizard.file' | translate }}</span>
                  <input
                    id="esig-file"
                    type="file"
                    accept=".pdf,.xml,application/pdf,text/xml"
                    (change)="onFile($event)"
                  />
                </label>
              }

              @if (minimumLevel() !== 'FES') {
                <nz-alert
                  class="feedback"
                  nzType="info"
                  nzShowIcon
                  [nzMessage]="
                    'signatures.wizard.policyHint' | translate: { level: minimumLevel() }
                  "
                ></nz-alert>
              }

              @if (templates().length > 0) {
                <label class="field" for="esig-template">
                  <span>{{ 'signatures.wizard.template' | translate }}</span>
                  <nz-select
                    nzId="esig-template"
                    nzAllowClear
                    [nzPlaceHolder]="'signatures.wizard.noTemplate' | translate"
                    [ngModel]="templateId()"
                    (ngModelChange)="applyTemplate($event)"
                  >
                    @for (template of templates(); track template.id) {
                      <nz-option [nzValue]="template.id" [nzLabel]="template.name"></nz-option>
                    }
                  </nz-select>
                </label>
              }

              <fieldset class="group">
                <legend>{{ 'signatures.field.level' | translate }}</legend>
                <nz-radio-group
                  [ngModel]="level()"
                  (ngModelChange)="setLevel($event)"
                  class="cards"
                >
                  @for (option of levels; track option) {
                    <label
                      [attr.for]="'esig-level-' + option"
                      appRadioControl
                      nz-radio
                      class="card"
                      [nzValue]="option"
                      [nzDisabled]="levelRank(option) < levelRank(minimumLevel())"
                    >
                      <strong>{{ option }}</strong> ·
                      {{ 'signatures.levelLong.' + option | translate }}
                      <span class="hint">{{ 'signatures.levelHint.' + option | translate }}</span>
                    </label>
                  }
                </nz-radio-group>
              </fieldset>

              <fieldset class="group">
                <legend>{{ 'signatures.field.jurisdiction' | translate }}</legend>
                <nz-radio-group
                  [ngModel]="jurisdiction()"
                  (ngModelChange)="setJurisdiction($event)"
                >
                  @for (option of jurisdictions; track option) {
                    <label
                      [attr.for]="'esig-jurisdiction-' + option"
                      appRadioControl
                      nz-radio
                      [nzValue]="option"
                      >{{ 'signatures.jurisdictionBadge.' + option | translate }}</label
                    >
                  }
                </nz-radio-group>
              </fieldset>

              <label class="field" for="esig-provider">
                <span>{{ 'signatures.field.provider' | translate }}</span>
                <nz-select
                  nzId="esig-provider"
                  [ngModel]="configId()"
                  (ngModelChange)="setConfig($event)"
                >
                  <nz-option
                    [nzValue]="null"
                    [nzLabel]="'signatures.wizard.providerAuto' | translate"
                  ></nz-option>
                  @for (config of eligible(); track config.id) {
                    <nz-option
                      [nzValue]="config.id"
                      [nzLabel]="
                        config.name +
                        ' · ' +
                        ('signatures.provider.' + config.provider | translate) +
                        (config.is_sandbox ? ' · ' + ('signatures.field.sandbox' | translate) : '')
                      "
                    ></nz-option>
                  }
                </nz-select>
              </label>
              @if (level() === 'FEQ' && eligible().length === 0) {
                <nz-alert
                  nzType="warning"
                  nzShowIcon
                  [nzMessage]="'signatures.wizard.noQualifiedProvider' | translate"
                ></nz-alert>
              }
            }

            @case (1) {
              <fieldset class="group">
                <legend>{{ 'signatures.field.routing' | translate }}</legend>
                <nz-radio-group [ngModel]="routing()" (ngModelChange)="routing.set($event)">
                  <label
                    for="esig-routing-sequential"
                    appRadioControl
                    nz-radio
                    nzValue="sequential"
                    >{{ 'signatures.routing.sequential' | translate }}</label
                  >
                  <label
                    for="esig-routing-parallel"
                    appRadioControl
                    nz-radio
                    nzValue="parallel"
                    [nzDisabled]="sequentialOnly()"
                    >{{ 'signatures.routing.parallel' | translate }}</label
                  >
                </nz-radio-group>
                @if (sequentialOnly()) {
                  <span class="hint">{{ 'signatures.wizard.sequentialOnly' | translate }}</span>
                }
              </fieldset>

              @for (recipient of recipients(); track recipient.uid; let index = $index) {
                <div class="signer">
                  <div class="signer-head">
                    <strong>{{ 'signatures.wizard.signerN' | translate: { n: index + 1 } }}</strong>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      [disabled]="recipients().length === 1"
                      (click)="removeRecipient(recipient.uid)"
                    >
                      {{ 'signatures.action.remove' | translate }}
                    </button>
                  </div>
                  <div class="grid">
                    <label class="field" [attr.for]="'esig-name-' + recipient.uid">
                      <span>{{ 'signatures.field.name' | translate }}</span>
                      <input
                        nz-input
                        [id]="'esig-name-' + recipient.uid"
                        [ngModel]="recipient.full_name"
                        (ngModelChange)="patch(recipient.uid, { full_name: $event })"
                      />
                    </label>
                    <label class="field" [attr.for]="'esig-email-' + recipient.uid">
                      <span>{{ 'signatures.field.email' | translate }}</span>
                      <input
                        nz-input
                        type="email"
                        [id]="'esig-email-' + recipient.uid"
                        [ngModel]="recipient.email"
                        (ngModelChange)="patch(recipient.uid, { email: $event })"
                      />
                    </label>
                    <label class="field" [attr.for]="'esig-role-' + recipient.uid">
                      <span>{{ 'signatures.field.role' | translate }}</span>
                      <nz-select
                        [nzId]="'esig-role-' + recipient.uid"
                        [ngModel]="recipient.role"
                        (ngModelChange)="patch(recipient.uid, { role: $event })"
                      >
                        @for (role of roles; track role) {
                          <nz-option
                            [nzValue]="role"
                            [nzLabel]="'signatures.role.' + role | translate"
                          ></nz-option>
                        }
                      </nz-select>
                    </label>
                    <label class="field" [attr.for]="'esig-auth-' + recipient.uid">
                      <span>{{ 'signatures.field.authMethod' | translate }}</span>
                      <nz-select
                        [nzId]="'esig-auth-' + recipient.uid"
                        [ngModel]="recipient.auth_method"
                        (ngModelChange)="patch(recipient.uid, { auth_method: $event })"
                      >
                        @for (method of authMethods(); track method) {
                          <nz-option
                            [nzValue]="method"
                            [nzLabel]="'signatures.authMethod.' + method | translate"
                          ></nz-option>
                        }
                      </nz-select>
                    </label>
                    <label class="field" [attr.for]="'esig-phone-' + recipient.uid">
                      <span>{{ 'signatures.field.phone' | translate }}</span>
                      <input
                        nz-input
                        [id]="'esig-phone-' + recipient.uid"
                        placeholder="+41791234567"
                        [ngModel]="recipient.phone"
                        (ngModelChange)="patch(recipient.uid, { phone: $event })"
                      />
                    </label>
                    @if (routing() === 'sequential') {
                      <label class="field" [attr.for]="'esig-order-' + recipient.uid">
                        <span>{{ 'signatures.field.order' | translate }}</span>
                        <nz-input-number
                          [nzId]="'esig-order-' + recipient.uid"
                          [nzMin]="1"
                          [nzMax]="50"
                          [ngModel]="recipient.signing_order"
                          (ngModelChange)="patch(recipient.uid, { signing_order: $event ?? 1 })"
                        ></nz-input-number>
                      </label>
                    }
                  </div>
                </div>
              }

              <button
                nz-button
                type="button"
                [disabled]="recipients().length >= maxRecipients()"
                (click)="addRecipient()"
              >
                {{ 'signatures.wizard.addSigner' | translate }}
              </button>

              @for (problem of problems(); track problem) {
                <p class="problem" role="alert">{{ problem | translate }}</p>
              }
            }

            @case (2) {
              @if (previewBlob() !== null && placeable()) {
                <p class="hint">{{ 'signatures.wizard.placementHint' | translate }}</p>
                <div class="placement">
                  <div class="pdf">
                    <app-esig-pdf-view
                      mode="place"
                      [source]="previewBlob()"
                      [boxes]="viewBoxes()"
                      (placed)="placeBox($event)"
                      (moved)="moveBoxOf($event)"
                    ></app-esig-pdf-view>
                  </div>
                  <div class="side">
                    <label class="field" for="esig-place">
                      <span>{{ 'signatures.wizard.placeFor' | translate }}</span>
                      <nz-select
                        nzId="esig-place"
                        [ngModel]="placing()"
                        (ngModelChange)="placing.set($event)"
                      >
                        @for (recipient of signers(); track recipient.uid) {
                          <nz-option
                            [nzValue]="recipient.uid"
                            [nzLabel]="label(recipient)"
                          ></nz-option>
                        }
                      </nz-select>
                    </label>
                    @for (recipient of signers(); track recipient.uid) {
                      <div class="placed">
                        <span>{{ label(recipient) }}</span>
                        @if (recipient.signature_box; as box) {
                          <nz-tag nzColor="green">{{
                            'signatures.wizard.page' | translate: { page: box.page }
                          }}</nz-tag>
                          <button
                            nz-button
                            nzSize="small"
                            type="button"
                            (click)="grow(recipient.uid, 0.04)"
                          >
                            +
                          </button>
                          <button
                            nz-button
                            nzSize="small"
                            type="button"
                            (click)="grow(recipient.uid, -0.04)"
                          >
                            −
                          </button>
                          <button
                            nz-button
                            nzSize="small"
                            nzDanger
                            type="button"
                            (click)="clearBox(recipient.uid)"
                          >
                            {{ 'signatures.action.remove' | translate }}
                          </button>
                        } @else {
                          <nz-tag>{{ 'signatures.wizard.notPlaced' | translate }}</nz-tag>
                        }
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <p class="hint">{{ 'signatures.wizard.noPlacement' | translate }}</p>
              }

              <label class="field" for="esig-subject">
                <span>{{ 'signatures.field.subject' | translate }}</span>
                <input
                  nz-input
                  id="esig-subject"
                  maxlength="200"
                  [ngModel]="subject()"
                  (ngModelChange)="subject.set($event)"
                />
              </label>
              <label class="field" for="esig-message">
                <span>{{ 'signatures.field.message' | translate }}</span>
                <textarea
                  nz-input
                  id="esig-message"
                  rows="3"
                  maxlength="2000"
                  [ngModel]="message()"
                  (ngModelChange)="message.set($event)"
                ></textarea>
              </label>
              <label class="field" for="esig-days">
                <span>{{ 'signatures.field.expirationDays' | translate }}</span>
                <nz-input-number
                  nzId="esig-days"
                  [nzMin]="1"
                  [nzMax]="90"
                  [ngModel]="expirationDays()"
                  (ngModelChange)="expirationDays.set($event ?? 14)"
                ></nz-input-number>
              </label>
            }

            @case (3) {
              <dl class="review">
                <dt>{{ 'signatures.field.document' | translate }}</dt>
                <dd>{{ documentTitle() }}</dd>
                <dt>{{ 'signatures.field.level' | translate }}</dt>
                <dd>
                  <nz-tag>{{ level() }}</nz-tag>
                  {{ 'signatures.jurisdictionBadge.' + jurisdiction() | translate }}
                </dd>
                <dt>{{ 'signatures.field.provider' | translate }}</dt>
                <dd>{{ 'signatures.provider.' + provider() | translate }}</dd>
                <dt>{{ 'signatures.field.routing' | translate }}</dt>
                <dd>{{ 'signatures.routing.' + routing() | translate }}</dd>
                <dt>{{ 'signatures.field.signers' | translate }}</dt>
                <dd>
                  <ul>
                    @for (recipient of recipients(); track recipient.uid) {
                      <li>
                        {{ recipient.full_name }} &lt;{{ recipient.email }}&gt; ·
                        {{ 'signatures.role.' + recipient.role | translate }} ·
                        {{ 'signatures.authMethod.' + recipient.auth_method | translate }}
                      </li>
                    }
                  </ul>
                </dd>
                <dt>{{ 'signatures.field.expirationDays' | translate }}</dt>
                <dd>{{ expirationDays() }}</dd>
              </dl>
              <nz-alert
                nzType="info"
                nzShowIcon
                [nzMessage]="'signatures.wizard.reviewHint' | translate"
              ></nz-alert>
            }
          }
        </nz-spin>

        <div class="footer">
          <button nz-button type="button" (click)="close()">
            {{ 'signatures.action.cancel' | translate }}
          </button>
          @if (step() > 0) {
            <button nz-button type="button" (click)="back()">
              {{ 'signatures.action.back' | translate }}
            </button>
          }
          @if (step() < 3) {
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="!canAdvance()"
              (click)="next()"
            >
              {{ 'signatures.action.next' | translate }}
            </button>
          } @else {
            <button nz-button type="button" [disabled]="submitting()" (click)="submit(false)">
              {{ 'signatures.action.saveDraft' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="button"
              [nzLoading]="submitting()"
              (click)="submit(true)"
            >
              {{ 'signatures.action.send' | translate }}
            </button>
          }
        </div>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .steps,
    .feedback {
      margin-bottom: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }

    .group {
      border: 0;
      padding: 0;
      margin: 0 0 16px;
    }

    .cards {
      display: grid;
      gap: 8px;
    }

    .card {
      border: 1px solid var(--ant-color-border, #d9d9d9);
      border-radius: 6px;
      padding: 8px 12px;
      margin: 0;
      white-space: normal;
    }

    .hint {
      display: block;
      color: var(--ant-color-text-secondary, #6b7280);
      font-size: 12px;
    }

    .signer {
      border: 1px solid var(--ant-color-border, #d9d9d9);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .signer-head {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 16px;
    }

    .problem {
      color: var(--ant-color-error, #cf1322);
      margin: 8px 0 0;
    }

    .placement {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: 16px;
      margin-bottom: 16px;
    }

    .placed {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }

    .review dt {
      font-weight: 600;
      margin-top: 8px;
    }

    .review dd {
      margin: 0;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
    }
  `,
})
export class SendForSignatureDrawerComponent {
  private readonly api = inject(ElectronicSignatureApiService);
  private readonly toast = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  readonly open = input(false);
  readonly signableType = input.required<EsigSignableType>();
  readonly signableId = input<string | null>(null);
  readonly documentLabel = input<string | null>(null);
  readonly amount = input<string | null>(null);
  readonly currency = input<string | null>(null);

  readonly closed = output<void>();
  readonly created = output<void>();

  protected readonly levels = ESIG_LEVELS;
  protected readonly jurisdictions = ESIG_JURISDICTIONS;
  protected readonly roles = ESIG_ROLES;
  protected readonly levelRank = levelRank;

  protected readonly step = signal<Step>(0);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly lookups = signal<EsigLookups | null>(null);
  protected readonly minimumLevel = signal<EsigLevel>('FES');
  protected readonly level = signal<EsigLevel>('FES');
  protected readonly jurisdiction = signal<EsigJurisdiction>('eIDAS');
  protected readonly configId = signal<string | null>(null);
  protected readonly templateId = signal<string | null>(null);
  protected readonly routing = signal<EsigRoutingMode>('sequential');
  protected readonly recipients = signal<DraftRecipient[]>([]);
  protected readonly file = signal<File | null>(null);
  protected readonly previewBlob = signal<Blob | null>(null);
  protected readonly placing = signal<string | null>(null);
  protected readonly subject = signal('');
  protected readonly message = signal('');
  protected readonly expirationDays = signal(14);
  protected readonly reminderDays = signal<number[]>([3, 1]);

  protected readonly templates = computed(() =>
    (this.lookups()?.templates ?? []).filter(
      (template) => template.document_type === this.signableType(),
    ),
  );
  protected readonly eligible = computed(() =>
    eligibleConfigs(this.lookups(), this.level(), this.jurisdiction()),
  );
  protected readonly maxRecipients = computed(() => this.lookups()?.defaults.max_recipients ?? 20);
  protected readonly signers = computed(() =>
    this.recipients().filter((recipient) => recipient.role !== 'CC_RECIPIENT'),
  );

  /** The provider that will sign: the chosen configuration, else the default that can issue the tier, else the built-in engine. */
  protected readonly provider = computed<EsigProvider>(() => {
    const chosen = this.eligible().find((config) => config.id === this.configId());
    return (
      (chosen ?? this.eligible().find((config) => config.is_default) ?? this.eligible()[0])
        ?.provider ?? 'native'
    );
  });
  protected readonly sequentialOnly = computed(
    () => this.lookups()?.sequential_only_providers.includes(this.provider()) ?? false,
  );
  protected readonly authMethods = computed<EsigAuthMethod[]>(() =>
    authMethodsFor(this.provider(), this.level()),
  );
  protected readonly problems = computed(() => recipientProblems(this.recipients(), this.level()));
  protected readonly placeable = computed(
    () =>
      this.file() === null ||
      (this.file()?.type ?? '').includes('pdf') ||
      (this.file()?.name ?? '').toLowerCase().endsWith('.pdf'),
  );
  protected readonly viewBoxes = computed<PdfViewBox[]>(() =>
    this.signers()
      .filter((recipient) => recipient.signature_box !== null)
      .map((recipient) => ({
        id: recipient.uid,
        label: this.label(recipient),
        box: recipient.signature_box as EsigSignatureBox,
        active: recipient.uid === this.placing(),
      })),
  );
  protected readonly documentTitle = computed(
    () => this.file()?.name ?? this.documentLabel() ?? '',
  );

  protected readonly canAdvance = computed(() => {
    switch (this.step()) {
      case 0:
        return (
          (this.signableType() !== 'upload' || this.file() !== null) &&
          levelRank(this.level()) >= levelRank(this.minimumLevel()) &&
          (this.level() !== 'FEQ' || this.eligible().length > 0)
        );
      case 1:
        return this.problems().length === 0;
      default:
        return true;
    }
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => void this.start());
      }
    });
  }

  protected label(recipient: DraftRecipient): string {
    return recipient.full_name.trim() !== ''
      ? recipient.full_name
      : this.i18n.instant('signatures.wizard.unnamed');
  }

  protected close(): void {
    this.closed.emit();
  }

  protected back(): void {
    this.error.set(null);
    this.step.update((step) => Math.max(0, step - 1) as Step);
  }

  protected async next(): Promise<void> {
    this.error.set(null);
    const target = (this.step() + 1) as Step;
    if (target === 2) {
      await this.loadPreview();
      if (this.placing() === null) {
        this.placing.set(this.signers()[0]?.uid ?? null);
      }
    }
    this.step.set(target);
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.item(0) ?? null);
    this.previewBlob.set(null);
  }

  protected setLevel(level: EsigLevel): void {
    this.level.set(maxLevel(level, this.minimumLevel()));
    this.afterPolicyChange();
  }

  protected setJurisdiction(jurisdiction: EsigJurisdiction): void {
    this.jurisdiction.set(jurisdiction);
    this.afterPolicyChange();
  }

  protected setConfig(id: string | null): void {
    this.configId.set(id);
    this.afterPolicyChange();
  }

  protected applyTemplate(id: string | null): void {
    this.templateId.set(id);
    const template = this.templates().find((candidate) => candidate.id === id);
    if (template === undefined) {
      return;
    }
    this.level.set(maxLevel(template.required_level, this.minimumLevel()));
    this.jurisdiction.set(template.jurisdiction);
    this.configId.set(template.provider_config_id);
    this.routing.set(template.routing_mode);
    this.expirationDays.set(template.expiration_days);
    this.reminderDays.set(template.reminder_days);
    this.afterPolicyChange();
  }

  protected addRecipient(): void {
    this.recipients.update((list) =>
      [...list, emptyRecipient(this.nextOrder(), this.level())].map((recipient) =>
        this.withValidAuth(recipient),
      ),
    );
  }

  protected removeRecipient(uid: string): void {
    this.recipients.update((list) => list.filter((recipient) => recipient.uid !== uid));
  }

  protected patch(uid: string, changes: Partial<DraftRecipient>): void {
    this.recipients.update((list) =>
      list.map((recipient) => (recipient.uid === uid ? { ...recipient, ...changes } : recipient)),
    );
  }

  protected placeBox(point: { page: number; x: number; y: number }): void {
    const uid = this.placing();
    if (uid !== null) {
      this.patch(uid, { signature_box: boxAt(point.page, point.x, point.y) });
    }
  }

  protected moveBoxOf(moved: { id: string; box: EsigSignatureBox }): void {
    this.patch(moved.id, { signature_box: moved.box });
  }

  protected clearBox(uid: string): void {
    this.patch(uid, { signature_box: null });
  }

  protected grow(uid: string, delta: number): void {
    const recipient = this.recipients().find((candidate) => candidate.uid === uid);
    if (recipient?.signature_box) {
      const box = recipient.signature_box;
      this.patch(uid, { signature_box: resizeBox(box, box.width + delta, box.height + delta / 3) });
    }
  }

  protected async submit(send: boolean): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    try {
      const payload = this.payload(send);
      await firstValueFrom(this.api.createEnvelope(payload));
      this.toast.success(
        this.i18n.instant(send ? 'signatures.message.sent' : 'signatures.message.saved'),
      );
      this.created.emit();
    } catch (failure) {
      const outcome: EsigOutcome = await failureOf(failure);
      this.error.set(outcome.errorKey);
    } finally {
      this.submitting.set(false);
    }
  }

  private payload(send: boolean): EsigEnvelopePayload {
    return {
      signable_type: this.signableType(),
      signable_id: this.signableId(),
      file: this.file(),
      amount: this.amount(),
      currency: this.currency(),
      title: this.file() !== null ? this.file()!.name.replace(/\.[^.]+$/, '') : null,
      subject: this.subject().trim() === '' ? null : this.subject().trim(),
      message: this.message().trim() === '' ? null : this.message().trim(),
      required_level: this.level(),
      jurisdiction: this.jurisdiction(),
      routing_mode: this.routing(),
      provider_config_id: this.configId(),
      template_id: this.templateId(),
      expiration_days: this.expirationDays(),
      reminder_days: this.reminderDays(),
      locale: this.i18n.currentLanguage(),
      send,
      recipients: this.recipients().map(toRecipientPayload),
    };
  }

  private async start(): Promise<void> {
    this.step.set(0);
    this.error.set(null);
    this.file.set(null);
    this.previewBlob.set(null);
    this.templateId.set(null);
    this.configId.set(null);
    this.subject.set('');
    this.message.set('');
    this.loading.set(true);
    try {
      const lookups = (await firstValueFrom(this.api.getLookups())).data;
      this.lookups.set(lookups);
      this.expirationDays.set(lookups.defaults.expiration_days);
      this.reminderDays.set(lookups.defaults.reminder_days);

      const policy = (await firstValueFrom(this.api.getPolicy(this.signableType(), this.amount())))
        .data;
      this.minimumLevel.set(policy.minimum_level);
      this.level.set(policy.minimum_level);
      this.routing.set('sequential');
      this.recipients.set([emptyRecipient(1, policy.minimum_level)]);
      this.afterPolicyChange();
      if (policy.template !== null) {
        this.applyTemplate(policy.template.id);
      }
    } catch (failure) {
      this.error.set((await failureOf(failure)).errorKey);
    } finally {
      this.loading.set(false);
    }
  }

  private afterPolicyChange(): void {
    // A provider that cannot issue the tier is dropped; the identity checks and the routing follow the provider.
    if (
      this.configId() !== null &&
      !this.eligible().some((config) => config.id === this.configId())
    ) {
      this.configId.set(null);
    }
    if (this.sequentialOnly()) {
      this.routing.set('sequential');
    }
    this.recipients.update((list) => list.map((recipient) => this.withValidAuth(recipient)));
  }

  private withValidAuth(recipient: DraftRecipient): DraftRecipient {
    return this.authMethods().includes(recipient.auth_method)
      ? recipient
      : {
          ...recipient,
          auth_method: this.authMethods().includes(defaultAuthMethod(this.level()))
            ? defaultAuthMethod(this.level())
            : this.authMethods()[0],
        };
  }

  private nextOrder(): number {
    return this.routing() === 'sequential'
      ? Math.max(0, ...this.recipients().map((recipient) => recipient.signing_order)) + 1
      : 1;
  }

  private async loadPreview(): Promise<void> {
    if (this.previewBlob() !== null) {
      return;
    }
    const file = this.file();
    if (file !== null) {
      this.previewBlob.set(this.placeable() ? file : null);
      return;
    }
    const id = this.signableId();
    if (id === null) {
      return;
    }
    this.loading.set(true);
    try {
      this.previewBlob.set(
        await firstValueFrom(
          this.api.previewDocument(this.signableType(), id, this.i18n.currentLanguage()),
        ),
      );
    } catch {
      this.previewBlob.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}
