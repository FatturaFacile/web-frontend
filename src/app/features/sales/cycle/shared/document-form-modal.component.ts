import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  applyServerErrors,
  AuthStore,
  CoreOrder,
  CoreOrderPayload,
  CoreQuote,
  CoreQuotePayload,
  SalesCycleApiService,
} from '@core';
import { TranslatePipe } from '@shared';
import { createLineGroup, DocumentLinesEditorComponent, LineGroup, linesToPayload } from './document-lines-editor.component';
import { SalesLookupsService } from './sales-lookups.service';
import { inDaysIso, todayIso } from './sales-status';

export type SalesDocumentKind = 'quote' | 'order';

/** Create / edit modal shared by quotes and orders of the core sales cycle. */
@Component({
  selector: 'app-document-form-modal',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzSelectModule,
    DocumentLinesEditorComponent,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="titleKey() | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      nzWidth="960px"
      (nzOnCancel)="visible.set(false)"
      (nzOnOk)="submit()"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div nz-row [nzGutter]="16">
            <div nz-col [nzSpan]="10">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="doc-contact">{{ 'SC.COMMON.CUSTOMER' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SC.COMMON.REQUIRED' | translate">
                  <nz-select nzId="doc-contact" formControlName="contact_id" nzShowSearch>
                    @for (c of lookups.contacts(); track c.id) {
                      <nz-option [nzValue]="c.id" [nzLabel]="lookups.contactLabel(c)"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="5">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="doc-date">{{ 'SC.COMMON.DATE' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SC.COMMON.REQUIRED' | translate">
                  <input nz-input id="doc-date" type="date" formControlName="date" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="5">
              <nz-form-item>
                <nz-form-label nzFor="doc-due">
                  {{ (kind() === 'quote' ? 'SC.QUOTES.VALID_UNTIL' : 'SC.ORDERS.DUE_DATE') | translate }}
                </nz-form-label>
                <nz-form-control [nzErrorTip]="serverError('due')">
                  <input nz-input id="doc-due" type="date" formControlName="due" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="4">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="doc-currency">{{ 'SC.COMMON.CURRENCY' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'SC.COMMON.REQUIRED' | translate">
                  <input nz-input id="doc-currency" maxlength="3" formControlName="currency" />
                </nz-form-control>
              </nz-form-item>
            </div>
          </div>
          <app-document-lines-editor [lines]="items" />
          <nz-form-item class="notes">
            <nz-form-label nzFor="doc-notes">{{ 'SC.COMMON.NOTES' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input id="doc-notes" rows="2" formControlName="notes"></textarea>
            </nz-form-control>
          </nz-form-item>
          @if (kind() === 'quote') {
            <nz-form-item>
              <nz-form-label nzFor="doc-text">{{ 'SC.QUOTES.CUSTOM_TEXT' | translate }}</nz-form-label>
              <nz-form-control>
                <textarea nz-input id="doc-text" rows="2" formControlName="custom_text"></textarea>
              </nz-form-control>
            </nz-form-item>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class DocumentFormModalComponent {
  protected readonly lookups = inject(SalesLookupsService);
  private readonly api = inject(SalesCycleApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly authStore = inject(AuthStore);

  readonly kind = input.required<SalesDocumentKind>();
  /** Document being edited (with its items), or null to create a new one. */
  readonly document = input<CoreQuote | CoreOrder | null>(null);
  readonly visible = model(false);
  readonly saved = output<CoreQuote | CoreOrder>();

  protected readonly saving = signal(false);

  protected readonly items: FormArray<LineGroup> = this.fb.array([createLineGroup(this.fb)]);
  protected readonly form = this.fb.group({
    contact_id: ['', Validators.required],
    date: [todayIso(), Validators.required],
    due: [''],
    currency: ['EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    notes: [''],
    custom_text: [''],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.reset(this.document());
      }
    });
  }

  protected titleKey(): string {
    const editing = !!this.document();
    if (this.kind() === 'quote') {
      return editing ? 'SC.QUOTES.EDIT' : 'SC.QUOTES.NEW';
    }
    return editing ? 'SC.ORDERS.EDIT' : 'SC.ORDERS.NEW';
  }

  protected serverError(field: string): string {
    const error = this.form.get(field)?.errors?.['serverError'];
    return typeof error === 'string' ? error : '';
  }

  private reset(doc: CoreQuote | CoreOrder | null): void {
    const due =
      doc && 'valid_until' in doc
        ? (doc.valid_until ?? '')
        : doc && 'due_date' in doc
          ? (doc.due_date ?? '')
          : this.kind() === 'quote'
            ? inDaysIso(30)
            : '';
    this.form.reset({
      contact_id: doc?.contact_id ?? '',
      date: doc?.date?.substring(0, 10) ?? todayIso(),
      due: due.substring(0, 10),
      currency: doc?.currency ?? this.authStore.activeCurrency(),
      notes: doc?.notes ?? '',
      custom_text: doc && 'custom_text' in doc ? (doc.custom_text ?? '') : '',
    });
    this.items.clear();
    const lines = doc?.items?.length ? doc.items : [undefined];
    for (const line of lines) {
      this.items.push(createLineGroup(this.fb, line));
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.items.invalid) {
      this.form.markAllAsTouched();
      this.items.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const base = {
      contact_id: value.contact_id,
      date: value.date,
      currency: value.currency.toUpperCase(),
      notes: value.notes || null,
      items: linesToPayload(this.items),
    };
    const doc = this.document();
    this.saving.set(true);
    const request: Observable<ApiResponse<CoreQuote | CoreOrder>> =
      this.kind() === 'quote'
        ? this.saveQuote(doc, { ...base, valid_until: value.due || null, custom_text: value.custom_text || null })
        : this.saveOrder(doc, { ...base, due_date: value.due || null });
    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.visible.set(false);
        this.saved.emit(res.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        if (unmapped.length) {
          this.message.error(unmapped[0]);
        }
      },
    });
  }

  private saveQuote(doc: CoreQuote | CoreOrder | null, payload: CoreQuotePayload) {
    return doc ? this.api.updateQuote(doc.id, payload) : this.api.createQuote(payload);
  }

  private saveOrder(doc: CoreQuote | CoreOrder | null, payload: CoreOrderPayload) {
    return doc ? this.api.updateOrder(doc.id, payload) : this.api.createOrder(payload);
  }
}
