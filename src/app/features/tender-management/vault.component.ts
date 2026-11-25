import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TndSoaRequirement,
  TndVaultDocType,
  TndVaultDocument,
  TndVaultSegment,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  betreibungsauszugTracker,
  documentLight,
  soaNextMilestone,
  summarizeLights,
  TrafficLight,
} from './tender-management.util';
import { VaultStore } from './vault.store';

type Country = 'IT' | 'CH';
type Mode = 'create' | 'edit' | 'renew';

const LIGHT_COLOR: Record<TrafficLight, string> = { green: 'green', amber: 'orange', red: 'red', grey: 'default' };
const LIGHT_KEY: Record<TrafficLight, string> = {
  green: 'Valid',
  amber: 'ExpiringSoon',
  red: 'Expired',
  grey: 'PendingRenewal',
};

/**
 * Qualification vault (Mod 169): the administrative documents of the company with a traffic-light validity per country —
 * SOA, DURC, Casellario, Visura, ISO / PdR 125 and the FVOE 2.0 sync for Italy; Betreibungsauszug (3 months rolling), AVS, SUVA,
 * LPP, VAT, CCL and Logib for Switzerland — with the upload and renewal workflow and the hints of the missing documents.
 */
@Component({
  selector: 'app-tnd-vault',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [VaultStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.TENDER_MANAGEMENT_VAULT' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as key) {
      <nz-alert class="feedback" nzType="error" nzShowIcon nzCloseable [nzMessage]="key | translate" (nzOnClose)="feedback.set(null)"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @for (country of countries; track country) {
        @if (segment(country); as seg) {
          <section class="country" [attr.aria-labelledby]="'tnd-vault-' + country">
            <header>
              <h2 [id]="'tnd-vault-' + country">{{ 'tenderManagement.vault.' + country | translate }}</h2>
              @for (light of lights; track light) {
                <nz-tag [nzColor]="lightColor(light)">
                  {{ 'tenderManagement.enum.verificationStatus.' + lightKey(light) | translate }}: {{ summary(seg)[light] }}
                </nz-tag>
              }
              @if (country === 'IT') {
                <nz-tag nzColor="geekblue">
                  {{ 'tenderManagement.vault.fvoe' | translate: { synced: store.fvoe().synced, total: store.fvoe().total } }}
                </nz-tag>
              }
              <button nz-button nzType="primary" type="button" (click)="openCreate(country, null)">
                {{ 'tenderManagement.action.addDocument' | translate }}
              </button>
            </header>

            @if (seg.missing_types.length > 0) {
              <nz-alert class="feedback" nzType="warning" nzShowIcon [nzMessage]="'tenderManagement.vault.missingHint' | translate">
              </nz-alert>
              <p class="missing">
                @for (type of seg.missing_types; track type) {
                  <button nz-button nzSize="small" type="button" (click)="openCreate(country, type)">
                    + {{ 'tenderManagement.enum.vaultDocType.' + type | translate }}
                  </button>
                }
              </p>
            }

            <div class="grid">
              @for (doc of seg.documents; track doc.id) {
                <article class="doc" [attr.data-light]="light(doc)">
                  <header>
                    <nz-tag [nzColor]="lightColor(light(doc))">
                      {{ 'tenderManagement.enum.verificationStatus.' + lightKey(light(doc)) | translate }}
                    </nz-tag>
                    <strong>{{ 'tenderManagement.enum.vaultDocType.' + doc.doc_type | translate }}</strong>
                  </header>
                  @if (doc.document_number) {
                    <div>{{ 'tenderManagement.field.documentNumber' | translate }}: {{ doc.document_number }}</div>
                  }
                  @if (doc.expiry_date) {
                    <div>
                      {{ 'tenderManagement.field.expiryDate' | translate }}: {{ doc.expiry_date }}
                      @if (doc.days_to_expiry !== null) {
                        ({{ 'tenderManagement.vault.daysLeft' | translate: { days: doc.days_to_expiry } }})
                      }
                    </div>
                  }
                  @for (soa of doc.soa_categories_classifications ?? []; track soa.category) {
                    <nz-tag>{{ soa.category }} · {{ soa.classification }}</nz-tag>
                  }
                  @if (doc.doc_type === 'IT_SOA_Attestation') {
                    @if (milestone(doc); as next) {
                      <div>
                        {{ 'tenderManagement.vault.soaMilestone.' + next.kind | translate }}: {{ next.date }}
                        ({{ 'tenderManagement.vault.daysLeft' | translate: { days: next.daysLeft } }})
                      </div>
                    }
                  }
                  @if (doc.doc_type === 'CH_EstrattoEsecuzioniFallimenti_Betreibungsauszug') {
                    @if (tracker(doc); as rolling) {
                      <div>
                        {{ 'tenderManagement.vault.rollingValidUntil' | translate: { date: rolling.validUntil, days: rolling.daysLeft } }}
                      </div>
                    }
                  }
                  @if (doc.doc_type === 'CH_ParitaSalarialeLogib' && doc.numeric_value) {
                    <div>{{ 'tenderManagement.vault.logibDeviation' | translate: { value: doc.numeric_value } }}</div>
                  }
                  @if (country === 'IT') {
                    <nz-tag [nzColor]="doc.fvoe20_synced ? 'green' : 'default'">
                      {{ (doc.fvoe20_synced ? 'tenderManagement.vault.fvoeSynced' : 'tenderManagement.vault.fvoeNotSynced') | translate }}
                    </nz-tag>
                  }
                  <footer>
                    <button nz-button nzSize="small" type="button" (click)="openRenew(doc)">{{ 'tenderManagement.action.renew' | translate }}</button>
                    <button nz-button nzSize="small" type="button" (click)="openEdit(doc)">{{ 'tenderManagement.action.edit' | translate }}</button>
                    @if (country === 'IT') {
                      <button nz-button nzSize="small" type="button" [disabled]="store.saving()" (click)="sync(doc)">
                        {{ 'tenderManagement.action.syncFvoe' | translate }}
                      </button>
                    }
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'tenderManagement.confirm.deleteDocument' | translate"
                      (nzOnConfirm)="remove(doc)"
                    >
                      {{ 'tenderManagement.action.remove' | translate }}
                    </button>
                  </footer>
                </article>
              } @empty {
                <nz-empty [nzNotFoundContent]="'tenderManagement.empty.vault' | translate"></nz-empty>
              }
            </div>
          </section>
        }
      }
    </nz-spin>

    <nz-modal
      [nzVisible]="mode() !== null"
      nzWidth="720px"
      [nzTitle]="('tenderManagement.vault.modal.' + (mode() ?? 'create')) | translate"
      [nzOkText]="'tenderManagement.action.save' | translate"
      [nzCancelText]="'tenderManagement.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="save()"
      (nzOnCancel)="mode.set(null)"
    >
      <ng-container *nzModalContent>
        @if (formError(); as key) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate"></nz-alert>
        }
        <form [formGroup]="form" class="form">
          <label for="tnd-vd-type">{{ 'tenderManagement.field.documentType' | translate }}</label>
          <nz-select nzId="tnd-vd-type" formControlName="doc_type">
            @for (type of store.typesFor()(country()); track type.value) {
              <nz-option [nzValue]="type.value" [nzLabel]="'tenderManagement.enum.vaultDocType.' + type.value | translate"></nz-option>
            }
          </nz-select>
          <label for="tnd-vd-number">{{ 'tenderManagement.field.documentNumber' | translate }}</label>
          <input nz-input id="tnd-vd-number" formControlName="document_number" maxlength="80" />
          <label for="tnd-vd-issuer">{{ 'tenderManagement.field.issuingBody' | translate }}</label>
          <input nz-input id="tnd-vd-issuer" formControlName="issuing_body" maxlength="160" />
          <label for="tnd-vd-issue">{{ 'tenderManagement.field.issueDate' | translate }}</label>
          <input nz-input id="tnd-vd-issue" type="date" formControlName="issue_date" />
          <label for="tnd-vd-expiry">{{ 'tenderManagement.field.expiryDate' | translate }}</label>
          <input nz-input id="tnd-vd-expiry" type="date" formControlName="expiry_date" />
          @if (isSoa()) {
            <label for="tnd-vd-check">{{ 'tenderManagement.field.triennialCheck' | translate }}</label>
            <input nz-input id="tnd-vd-check" type="date" formControlName="intermediate_triennial_check_date" />
            <fieldset>
              <legend>{{ 'tenderManagement.field.requiredSoa' | translate }}</legend>
              @for (row of soaRows.controls; track row; let i = $index) {
                <div class="soa-row" [formGroup]="row">
                  <nz-select formControlName="category" nzShowSearch [nzPlaceHolder]="'tenderManagement.field.soaCategory' | translate">
                    @for (category of store.soaCategories(); track category) {
                      <nz-option [nzValue]="category" [nzLabel]="category"></nz-option>
                    }
                  </nz-select>
                  <nz-select formControlName="classification" [nzPlaceHolder]="'tenderManagement.field.soaClassification' | translate">
                    @for (classification of store.soaClassifications(); track classification) {
                      <nz-option [nzValue]="classification" [nzLabel]="classification"></nz-option>
                    }
                  </nz-select>
                  <button nz-button nzDanger type="button" (click)="soaRows.removeAt(i)">{{ 'tenderManagement.action.remove' | translate }}</button>
                </div>
              }
              <button nz-button type="button" (click)="addSoa()">{{ 'tenderManagement.action.addSoa' | translate }}</button>
            </fieldset>
          }
          @if (isLogib()) {
            <label for="tnd-vd-value">{{ 'tenderManagement.field.logibDeviation' | translate }}</label>
            <input nz-input id="tnd-vd-value" type="number" step="0.01" formControlName="numeric_value" />
          }
          <label for="tnd-vd-file">{{ 'tenderManagement.field.file' | translate }}</label>
          <input id="tnd-vd-file" type="file" (change)="pickFile($event)" />
          <label for="tnd-vd-notes">{{ 'tenderManagement.field.notes' | translate }}</label>
          <textarea nz-input id="tnd-vd-notes" rows="2" formControlName="notes"></textarea>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .country {
      margin-bottom: 32px;
    }
    .country > header {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .country h2 {
      margin: 0 8px 0 0;
    }
    .feedback {
      margin-bottom: 8px;
    }
    .missing {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .doc {
      border: 1px solid rgba(127, 127, 127, 0.3);
      border-left-width: 6px;
      border-radius: 8px;
      padding: 10px;
      display: grid;
      gap: 6px;
      align-content: start;
    }
    .doc[data-light='green'] {
      border-left-color: #52c41a;
    }
    .doc[data-light='amber'] {
      border-left-color: #fa8c16;
    }
    .doc[data-light='red'] {
      border-left-color: #f5222d;
    }
    .doc header {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .doc footer {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .form {
      display: grid;
      gap: 6px;
    }
    .soa-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      margin-bottom: 6px;
    }
  `,
})
export class VaultComponent implements OnInit {
  protected readonly store = inject(VaultStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly fb = inject(FormBuilder);

  protected readonly countries: readonly Country[] = ['IT', 'CH'];
  protected readonly lights: readonly TrafficLight[] = ['green', 'amber', 'red', 'grey'];
  protected readonly feedback = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly mode = signal<Mode | null>(null);
  protected readonly country = signal<Country>('IT');
  private editing: TndVaultDocument | null = null;
  private file: File | null = null;

  protected readonly soaRows = new FormArray<
    FormGroup<{ category: FormControl<string>; classification: FormControl<string> }>
  >([]);

  protected readonly form = this.fb.nonNullable.group({
    doc_type: ['IT_DURC' as TndVaultDocType, Validators.required],
    document_number: [''],
    issuing_body: [''],
    issue_date: [''],
    expiry_date: [''],
    intermediate_triennial_check_date: [''],
    numeric_value: [null as number | null],
    notes: [''],
  });

  ngOnInit(): void {
    void this.store.init();
  }

  protected segment(country: Country): TndVaultSegment | null {
    return country === 'IT' ? this.store.it() : this.store.ch();
  }

  protected summary(segment: TndVaultSegment): Record<TrafficLight, number> {
    return summarizeLights(segment.documents);
  }

  protected light(doc: TndVaultDocument): TrafficLight {
    return documentLight(doc);
  }

  protected lightColor(light: TrafficLight): string {
    return LIGHT_COLOR[light];
  }

  protected lightKey(light: TrafficLight): string {
    return LIGHT_KEY[light];
  }

  protected milestone(doc: TndVaultDocument) {
    return soaNextMilestone(doc);
  }

  protected tracker(doc: TndVaultDocument) {
    const type = this.store.typesFor()('CH').find((item) => item.value === doc.doc_type);
    return betreibungsauszugTracker(doc.issue_date, new Date(), type?.max_age_months ?? 3);
  }

  protected isSoa(): boolean {
    return this.form.controls.doc_type.value === 'IT_SOA_Attestation';
  }

  protected isLogib(): boolean {
    return this.form.controls.doc_type.value === 'CH_ParitaSalarialeLogib';
  }

  protected addSoa(requirement?: TndSoaRequirement): void {
    this.soaRows.push(
      this.fb.nonNullable.group({
        category: [requirement?.category ?? '', Validators.required],
        classification: [requirement?.classification ?? '', Validators.required],
      }),
    );
  }

  protected pickFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.item(0) ?? null;
  }

  private resetForm(country: Country, type: TndVaultDocType | null): void {
    this.country.set(country);
    this.file = null;
    this.formError.set(null);
    this.soaRows.clear();
    this.form.reset({
      doc_type: type ?? (country === 'IT' ? 'IT_DURC' : 'CH_AttestatoAVS_AI_IPG'),
      document_number: '',
      issuing_body: '',
      issue_date: '',
      expiry_date: '',
      intermediate_triennial_check_date: '',
      numeric_value: null,
      notes: '',
    });
  }

  protected openCreate(country: Country, type: TndVaultDocType | null): void {
    this.editing = null;
    this.resetForm(country, type);
    this.mode.set('create');
  }

  protected openEdit(doc: TndVaultDocument): void {
    this.editing = doc;
    this.resetForm(doc.jurisdiction, doc.doc_type);
    this.form.patchValue({
      document_number: doc.document_number ?? '',
      issuing_body: doc.issuing_body ?? '',
      issue_date: doc.issue_date?.slice(0, 10) ?? '',
      expiry_date: doc.expiry_date?.slice(0, 10) ?? '',
      intermediate_triennial_check_date: doc.intermediate_triennial_check_date?.slice(0, 10) ?? '',
      numeric_value: doc.numeric_value === null ? null : Number(doc.numeric_value),
      notes: doc.notes ?? '',
    });
    for (const soa of doc.soa_categories_classifications ?? []) {
      this.addSoa(soa);
    }
    this.mode.set('edit');
  }

  protected openRenew(doc: TndVaultDocument): void {
    this.editing = doc;
    this.resetForm(doc.jurisdiction, doc.doc_type);
    this.form.patchValue({ document_number: doc.document_number ?? '', issuing_body: doc.issuing_body ?? '' });
    for (const soa of doc.soa_categories_classifications ?? []) {
      this.addSoa(soa);
    }
    this.mode.set('renew');
  }

  private async report(outcome: { ok: boolean; errorKey: string | null }, success: string): Promise<boolean> {
    if (!outcome.ok) {
      this.feedback.set(outcome.errorKey);
      return false;
    }
    this.feedback.set(null);
    this.message.success(this.i18n.instant(success));
    return true;
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const payload = {
      doc_type: value.doc_type,
      document_number: value.document_number || null,
      issuing_body: value.issuing_body || null,
      issue_date: value.issue_date || null,
      expiry_date: value.expiry_date || null,
      intermediate_triennial_check_date: value.intermediate_triennial_check_date || null,
      numeric_value: value.numeric_value,
      notes: value.notes || null,
      soa_categories_classifications: this.isSoa() ? this.soaRows.getRawValue() : undefined,
      file: this.file,
    };
    const mode = this.mode();
    const editing = this.editing;
    const outcome =
      mode === 'renew' && editing
        ? await this.store.renew(editing, payload)
        : mode === 'edit' && editing
          ? await this.store.update(editing, payload)
          : await this.store.create(payload);

    if (!outcome.ok) {
      this.formError.set(outcome.errorKey);
      return;
    }
    this.mode.set(null);
    await this.report(outcome, 'tenderManagement.message.saved');
  }

  protected async remove(doc: TndVaultDocument): Promise<void> {
    await this.report(await this.store.remove(doc), 'tenderManagement.message.deleted');
  }

  protected async sync(doc: TndVaultDocument): Promise<void> {
    await this.report(await this.store.syncFvoe(doc), 'tenderManagement.message.fvoeSynced');
  }
}
