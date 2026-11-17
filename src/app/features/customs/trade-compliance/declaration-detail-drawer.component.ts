import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  CustomsApiService,
  CustomsDeclarationRequest,
  CustomsDeclarationResource,
  CustomsDocumentLanguage,
  CustomsExportProof,
  CustomsRegime,
  CustomsTransitDocumentType,
  serverErrorMessage,
  TranslateService,
} from '@core';
import { downloadBlob, TranslatePipe } from '@shared';
import {
  CUSTOMS_REGIMES,
  CUSTOMS_TRANSIT_DOCUMENTS,
  declarationStatusColor,
  isPlausibleMrn,
  isTransitOverdue,
  MRN_PATTERN,
  normalizeMrn,
} from './trade-compliance.utils';

const LANGUAGE_PAIRS: readonly CustomsDocumentLanguage[] = ['it_en', 'it_de'];

/**
 * Detail drawer of a customs declaration: regime and transit data, MRN assignment, generated payload preview,
 * invoice auto-link, export proof status (the eVV upload lives on the assessment decisions page), pro-forma and
 * transit sheet PDFs, and transit discharge.
 */
@Component({
  selector: 'app-declaration-detail-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzDividerModule,
    NzDrawerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpaceModule,
    NzSpinModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="declarationId() !== null"
      [nzWidth]="640"
      [nzTitle]="'CUSTOMS_TRADE.DETAIL_TITLE' | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="loading()">
          @if (declaration(); as decl) {
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
              <nz-descriptions-item [nzTitle]="'CUSTOMS.COLS.DECLARATION_NR' | translate">
                {{ decl.trader_declaration_number }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'CUSTOMS_TRADE.COL_DIRECTION' | translate">
                {{ 'CUSTOMS_TRADE.DIRECTION.' + decl.declaration_type | translate }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'CUSTOMS.COLS.STATUS' | translate">
                <nz-tag [nzColor]="statusColor()">{{ 'CUSTOMS_TRADE.STATUS.' + decl.status | translate }}</nz-tag>
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'CUSTOMS.COLS.MRN' | translate">
                <span class="mono">{{ decl.mrn || '-' }}</span>
              </nz-descriptions-item>
            </nz-descriptions>

            <nz-divider [nzText]="'CUSTOMS_TRADE.SECTION_REGIME' | translate" nzOrientation="left" />
            <form nz-form nzLayout="vertical" [formGroup]="regimeForm" (ngSubmit)="saveRegime()">
              <nz-form-item>
                <nz-form-label>{{ 'CUSTOMS_TRADE.COL_REGIME' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="customs_regime">
                    @for (regime of regimes; track regime) {
                      <nz-option [nzValue]="regime" [nzLabel]="'CUSTOMS_TRADE.REGIME.' + regime | translate" />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'CUSTOMS_TRADE.TRANSIT_DOCUMENT' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="transit_document_type">
                    @for (type of transitDocuments; track type) {
                      <nz-option [nzValue]="type" [nzLabel]="'CUSTOMS_TRADE.TRANSIT_TYPE.' + type | translate" />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              @if (hasTransit()) {
                <nz-form-item>
                  <nz-form-label>{{ 'CUSTOMS_TRADE.TRANSIT_GUARANTEE' | translate }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="'COMMON.VALIDATION.INVALID_VALUE' | translate">
                    <input nz-input formControlName="transit_guarantee_reference" maxlength="35" />
                  </nz-form-control>
                </nz-form-item>
                <div class="two-cols">
                  <nz-form-item>
                    <nz-form-label>{{ 'CUSTOMS_TRADE.TRANSIT_DEPARTURE' | translate }}</nz-form-label>
                    <nz-form-control [nzErrorTip]="'COMMON.VALIDATION.INVALID_VALUE' | translate">
                      <input nz-input formControlName="transit_departure_office" maxlength="8" />
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label>{{ 'CUSTOMS_TRADE.TRANSIT_DESTINATION' | translate }}</nz-form-label>
                    <nz-form-control [nzErrorTip]="'COMMON.VALIDATION.INVALID_VALUE' | translate">
                      <input nz-input formControlName="transit_destination_office" maxlength="8" />
                    </nz-form-control>
                  </nz-form-item>
                </div>
                <div class="two-cols">
                  <nz-form-item>
                    <nz-form-label>{{ 'CUSTOMS_TRADE.TRANSIT_DEADLINE' | translate }}</nz-form-label>
                    <nz-form-control>
                      <input nz-input type="date" formControlName="transit_deadline_on" />
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label>{{ 'CUSTOMS_TRADE.BORDER_CROSSING' | translate }}</nz-form-label>
                    <nz-form-control [nzErrorTip]="'COMMON.VALIDATION.INVALID_VALUE' | translate">
                      <input nz-input formControlName="border_crossing" maxlength="60" />
                    </nz-form-control>
                  </nz-form-item>
                </div>
              }
              <button nz-button nzType="primary" type="submit" [nzLoading]="savingRegime()" [disabled]="regimeForm.invalid">
                {{ 'COMMON.SAVE' | translate }}
              </button>
            </form>

            <nz-divider [nzText]="'CUSTOMS_TRADE.SECTION_MRN' | translate" nzOrientation="left" />
            <form nz-form nzLayout="vertical" [formGroup]="mrnForm" (ngSubmit)="assignMrn()">
              <nz-form-item>
                <nz-form-label>{{ 'CUSTOMS.COLS.MRN' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="mrnError()">
                  <div class="inline-row">
                    <input nz-input class="mono" formControlName="mrn" maxlength="21" [placeholder]="'CUSTOMS_TRADE.MRN_PLACEHOLDER' | translate" />
                    <button nz-button nzType="primary" type="submit" [nzLoading]="savingMrn()" [disabled]="mrnForm.invalid">
                      {{ 'CUSTOMS_TRADE.ASSIGN_MRN' | translate }}
                    </button>
                  </div>
                </nz-form-control>
              </nz-form-item>
            </form>

            <nz-divider [nzText]="'CUSTOMS_TRADE.SECTION_PAYLOAD' | translate" nzOrientation="left" />
            <button nz-button (click)="loadPayload()" [nzLoading]="loadingPayload()">
              <nz-icon nzType="eye" />
              {{ 'CUSTOMS_TRADE.PREVIEW_PAYLOAD' | translate }}
            </button>
            @if (payload() !== null) {
              <pre class="payload" tabindex="0">{{ payload() }}</pre>
            }

            <nz-divider [nzText]="'CUSTOMS_TRADE.SECTION_INVOICES' | translate" nzOrientation="left" />
            <button nz-button (click)="autoLink()" [nzLoading]="linking()">
              {{ 'CUSTOMS_TRADE.AUTO_LINK' | translate }}
            </button>
            @if (linkedCount() !== null) {
              <nz-alert
                class="spaced"
                nzType="info"
                nzShowIcon
                [nzMessage]="'CUSTOMS_TRADE.LINKED_COUNT' | translate: { count: linkedCount() ?? 0 }"
              />
            }

            @if (decl.declaration_type === 'export') {
              <nz-divider [nzText]="'CUSTOMS_TRADE.SECTION_PROOF' | translate" nzOrientation="left" />
              @if (proof(); as p) {
                @if (p.has_proof) {
                  <nz-tag nzColor="success">{{ 'CUSTOMS_TRADE.PROOF_PRESENT' | translate }}</nz-tag>
                } @else {
                  <nz-tag nzColor="warning">{{ 'CUSTOMS_TRADE.PROOF_MISSING' | translate }}</nz-tag>
                }
              }
              <p class="hint">{{ 'CUSTOMS_TRADE.PROOF_UPLOAD_HINT' | translate }}</p>
              <a nz-button nzType="link" routerLink="/customs/assessments">
                <nz-icon nzType="upload" />
                {{ 'CUSTOMS_TRADE.GO_TO_ASSESSMENTS' | translate }}
              </a>
            }

            <nz-divider [nzText]="'CUSTOMS_TRADE.SECTION_DOCUMENTS' | translate" nzOrientation="left" />
            <div class="inline-row">
              <nz-select class="language" [ngModel]="language()" (ngModelChange)="language.set($event)" [attr.aria-label]="'CUSTOMS_TRADE.LANGUAGE' | translate">
                @for (pair of languagePairs; track pair) {
                  <nz-option [nzValue]="pair" [nzLabel]="'CUSTOMS_TRADE.LANGUAGE_PAIR.' + pair | translate" />
                }
              </nz-select>
              <button nz-button (click)="downloadProForma()" [nzLoading]="downloading() === 'pro-forma'">
                <nz-icon nzType="file-pdf" />
                {{ 'CUSTOMS_TRADE.PRO_FORMA' | translate }}
              </button>
              @if (hasTransit()) {
                <button nz-button (click)="downloadTransitSheet()" [nzLoading]="downloading() === 'transit-sheet'">
                  <nz-icon nzType="file-pdf" />
                  {{ 'CUSTOMS_TRADE.TRANSIT_SHEET' | translate }}
                </button>
              }
            </div>

            @if (hasTransit()) {
              <nz-divider [nzText]="'CUSTOMS_TRADE.SECTION_TRANSIT' | translate" nzOrientation="left" />
              @if (decl.transit_discharged_at) {
                <nz-tag nzColor="success">{{ 'CUSTOMS_TRADE.TRANSIT_DISCHARGED' | translate }}</nz-tag>
              } @else {
                @if (overdue()) {
                  <nz-tag nzColor="error">{{ 'CUSTOMS_TRADE.TRANSIT_OVERDUE_TAG' | translate }}</nz-tag>
                }
                <button
                  nz-button
                  nz-popconfirm
                  [nzPopconfirmTitle]="'CUSTOMS_TRADE.DISCHARGE_CONFIRM' | translate"
                  (nzOnConfirm)="discharge()"
                  [nzLoading]="discharging()"
                >
                  <nz-icon nzType="check" />
                  {{ 'CUSTOMS_TRADE.DISCHARGE' | translate }}
                </button>
              }
            }
          }
        </nz-spin>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .mono {
      font-family: var(--font-mono, monospace);
    }
    .two-cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4, 16px);
    }
    .inline-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2, 8px);
      align-items: center;
    }
    .language {
      min-width: 160px;
    }
    nz-select {
      width: 100%;
    }
    .language {
      width: auto;
    }
    .payload {
      margin-top: var(--space-3, 12px);
      max-height: 320px;
      overflow: auto;
      padding: var(--space-3, 12px);
      border: 1px solid var(--border-color, #d9d9d9);
      border-radius: var(--radius-md, 6px);
      white-space: pre-wrap;
      word-break: break-all;
      font-family: var(--font-mono, monospace);
      font-size: 12px;
    }
    .spaced {
      margin-top: var(--space-3, 12px);
    }
    .hint {
      color: var(--text-secondary, #666);
      margin: var(--space-2, 8px) 0;
    }
  `,
})
export class DeclarationDetailDrawerComponent {
  private readonly api = inject(CustomsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Id of the declaration to show; `null` keeps the drawer closed. */
  readonly declarationId = input<string | null>(null);
  readonly closed = output<void>();
  /** Emitted after any change so the page can refresh its counters and list. */
  readonly changed = output<void>();

  readonly regimes = CUSTOMS_REGIMES;
  readonly transitDocuments = CUSTOMS_TRANSIT_DOCUMENTS;
  readonly languagePairs = LANGUAGE_PAIRS;

  readonly loading = signal(false);
  readonly declaration = signal<CustomsDeclarationResource | null>(null);
  readonly proof = signal<CustomsExportProof | null>(null);
  readonly payload = signal<string | null>(null);
  readonly linkedCount = signal<number | null>(null);
  readonly language = signal<CustomsDocumentLanguage>('it_en');
  readonly savingRegime = signal(false);
  readonly savingMrn = signal(false);
  readonly loadingPayload = signal(false);
  readonly linking = signal(false);
  readonly discharging = signal(false);
  readonly downloading = signal<'pro-forma' | 'transit-sheet' | null>(null);

  readonly regimeForm = this.fb.group({
    customs_regime: this.fb.control<CustomsRegime>('edec'),
    transit_document_type: this.fb.control<CustomsTransitDocumentType>('none'),
    transit_guarantee_reference: this.fb.control('', [Validators.maxLength(35)]),
    transit_departure_office: this.fb.control('', [Validators.maxLength(8)]),
    transit_destination_office: this.fb.control('', [Validators.maxLength(8)]),
    transit_deadline_on: this.fb.control(''),
    border_crossing: this.fb.control('', [Validators.maxLength(60)]),
  });

  readonly mrnForm = this.fb.group({
    mrn: this.fb.control('', [Validators.required, Validators.pattern(MRN_PATTERN)]),
  });

  /** Transit type currently chosen in the form, so the transit fields appear as soon as it is not "none". */
  private readonly formTransitType = signal<CustomsTransitDocumentType>('none');
  readonly hasTransit = computed(() => this.formTransitType() !== 'none');
  readonly statusColor = computed(() => {
    const decl = this.declaration();
    return decl ? declarationStatusColor(decl.status) : 'default';
  });
  readonly overdue = computed(() => {
    const decl = this.declaration();
    return decl ? isTransitOverdue(decl.transit_deadline_on, decl.transit_discharged_at) : false;
  });

  constructor() {
    this.regimeForm.controls.transit_document_type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.formTransitType.set(type));

    effect(() => {
      const id = this.declarationId();
      untracked(() => this.open(id));
    });
  }

  /** Server message of the 422 when there is one, otherwise the format hint. */
  mrnError(): string {
    return serverErrorMessage(this.mrnForm, 'mrn') ?? this.translate.translate('CUSTOMS_TRADE.MRN_INVALID');
  }

  private open(id: string | null): void {
    this.declaration.set(null);
    this.proof.set(null);
    this.payload.set(null);
    this.linkedCount.set(null);
    this.mrnForm.reset({ mrn: '' });
    if (!id) {
      return;
    }
    this.reload(id);
  }

  private reload(id: string): void {
    this.loading.set(true);
    this.api
      .getDeclaration(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.applyDeclaration(res.data);
          this.loading.set(false);
          if (res.data.declaration_type === 'export') {
            this.loadProof(id);
          }
        },
        error: () => this.loading.set(false),
      });
  }

  private applyDeclaration(decl: CustomsDeclarationResource): void {
    this.declaration.set(decl);
    this.regimeForm.reset({
      customs_regime: decl.customs_regime ?? 'edec',
      transit_document_type: decl.transit_document_type ?? 'none',
      transit_guarantee_reference: decl.transit_guarantee_reference ?? '',
      transit_departure_office: decl.transit_departure_office ?? '',
      transit_destination_office: decl.transit_destination_office ?? '',
      transit_deadline_on: (decl.transit_deadline_on ?? '').slice(0, 10),
      border_crossing: decl.border_crossing ?? '',
    });
    this.formTransitType.set(decl.transit_document_type ?? 'none');
    this.mrnForm.reset({ mrn: decl.mrn ?? '' });
  }

  private loadProof(id: string): void {
    this.api
      .getExportProof(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (res) => this.proof.set(res.data) });
  }

  saveRegime(): void {
    const decl = this.declaration();
    if (!decl || this.regimeForm.invalid) {
      return;
    }
    const value = this.regimeForm.getRawValue();
    const transit = value.transit_document_type !== 'none';
    const payload: Partial<CustomsDeclarationRequest> = {
      customs_regime: value.customs_regime,
      transit_document_type: value.transit_document_type,
      transit_guarantee_reference: transit ? value.transit_guarantee_reference.trim() || null : null,
      transit_departure_office: transit ? value.transit_departure_office.trim() || null : null,
      transit_destination_office: transit ? value.transit_destination_office.trim() || null : null,
      transit_deadline_on: transit ? value.transit_deadline_on || null : null,
      border_crossing: transit ? value.border_crossing.trim() || null : null,
    };
    this.savingRegime.set(true);
    this.api
      .updateDeclaration(decl.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.savingRegime.set(false);
          this.applyDeclaration(res.data);
          this.message.success(this.translate.translate('CUSTOMS_TRADE.SAVED'));
          this.changed.emit();
        },
        error: () => this.savingRegime.set(false),
      });
  }

  assignMrn(): void {
    const decl = this.declaration();
    const mrn = normalizeMrn(this.mrnForm.controls.mrn.value);
    if (!decl || !isPlausibleMrn(mrn)) {
      return;
    }
    this.savingMrn.set(true);
    this.api
      .assignMrn(decl.id, mrn)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.savingMrn.set(false);
          this.applyDeclaration(res.data);
          this.message.success(this.translate.translate('CUSTOMS_TRADE.MRN_ASSIGNED'));
          this.changed.emit();
        },
        error: (err: unknown) => {
          this.savingMrn.set(false);
          const unmapped = applyServerErrors(this.mrnForm, err);
          if (unmapped.length > 0) {
            this.message.error(unmapped[0]);
          }
        },
      });
  }

  loadPayload(): void {
    const decl = this.declaration();
    if (!decl) {
      return;
    }
    this.loadingPayload.set(true);
    this.api
      .getDeclarationMessage(decl.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (text) => {
          this.payload.set(text);
          this.loadingPayload.set(false);
        },
        error: () => this.loadingPayload.set(false),
      });
  }

  autoLink(): void {
    const decl = this.declaration();
    if (!decl) {
      return;
    }
    this.linking.set(true);
    this.api
      .autoLinkInvoices(decl.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.linking.set(false);
          this.linkedCount.set(res.data.linked);
          if (decl.declaration_type === 'export') {
            this.loadProof(decl.id);
          }
          this.changed.emit();
        },
        error: () => this.linking.set(false),
      });
  }

  downloadProForma(): void {
    this.download('pro-forma', (id, lang) => this.api.downloadProForma(id, lang), 'pro_forma');
  }

  downloadTransitSheet(): void {
    this.download('transit-sheet', (id, lang) => this.api.downloadTransitSheet(id, lang), 'transit_sheet');
  }

  private download(
    kind: 'pro-forma' | 'transit-sheet',
    request: (id: string, language: CustomsDocumentLanguage) => ReturnType<CustomsApiService['downloadProForma']>,
    prefix: string,
  ): void {
    const decl = this.declaration();
    if (!decl) {
      return;
    }
    this.downloading.set(kind);
    request(decl.id, this.language())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          downloadBlob(blob, `${prefix}_${decl.trader_declaration_number}_${this.language()}.pdf`);
          this.downloading.set(null);
        },
        error: () => this.downloading.set(null),
      });
  }

  discharge(): void {
    const decl = this.declaration();
    if (!decl) {
      return;
    }
    this.discharging.set(true);
    this.api
      .dischargeTransit(decl.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.discharging.set(false);
          this.message.success(this.translate.translate('CUSTOMS_TRADE.TRANSIT_DISCHARGED'));
          this.reload(decl.id);
          this.changed.emit();
        },
        error: () => this.discharging.set(false),
      });
  }
}
