import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { catchError, concatMap, EMPTY, finalize, from } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { applyServerErrors, FsmApiService, FsmChecklistItem, FsmServiceReport, FsmSignReportPayload, FsmWorkOrderPhoto, I18nService, serverErrorMessage } from '@core';
import { SignaturePadComponent, TranslatePipe } from '@shared';

type ChecklistResult = FsmChecklistItem['result'];

const RESULTS: readonly ChecklistResult[] = ['pass', 'fail', 'na'];

/** The report contract accepts at most 20 photo ids. */
const MAX_PHOTOS = 20;

/** Backend locale codes by UI language. */
const LOCALES: Record<string, NonNullable<FsmSignReportPayload['locale']>> = {
  it: 'it-IT',
  en: 'en',
  de: 'de-CH',
  fr: 'fr-CH',
};

/**
 * Sign-and-close modal of a service report: work summary, checklist, labour/travel, signer and a vector signature.
 * Posts to `POST /fsm/work-orders/{id}/service-report`; a 422 is shown on the matching field.
 */
@Component({
  selector: 'app-fsm-sign-report-modal',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    SignaturePadComponent,
    TranslatePipe,
  ],
  templateUrl: './sign-report-modal.component.html',
  styleUrl: './sign-report-modal.component.scss',
})
export class SignReportModalComponent {
  private readonly api = inject(FsmApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly open = model.required<boolean>();
  readonly workOrderId = input.required<string>();
  readonly signed = output<FsmServiceReport>();

  protected readonly results = RESULTS;
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly signatureSvg = signal<string | null>(null);
  protected readonly gps = signal<{ latitude: number; longitude: number } | null>(null);
  protected readonly gpsFailed = signal(false);
  protected readonly photos = signal<FsmWorkOrderPhoto[]>([]);
  protected readonly uploading = signal(false);
  protected readonly photoError = signal<string | null>(null);
  protected readonly canSubmit = computed(() => this.signatureSvg() !== null && !this.saving() && !this.uploading());

  protected readonly form = this.fb.group({
    work_performed_summary: this.fb.control('', [Validators.required, Validators.maxLength(5000)]),
    labor_hours: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(999)]),
    travel_hours: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(999)]),
    travel_km: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(99999)]),
    apply_callout_fee: this.fb.control(false),
    meter_reading_hours: this.fb.control<number | null>(null, Validators.min(0)),
    meter_reading_cycles: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
    customer_signer_name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    customer_signer_role: this.fb.control('', Validators.maxLength(100)),
    checklist: this.fb.array([this.buildRow()]),
  });

  protected get checklist() {
    return this.form.controls.checklist;
  }

  private buildRow() {
    return this.fb.group({
      item: this.fb.control('', Validators.maxLength(200)),
      result: this.fb.control<ChecklistResult>('pass'),
      notes: this.fb.control('', Validators.maxLength(1000)),
    });
  }

  protected addRow(): void {
    this.checklist.push(this.buildRow());
  }

  protected removeRow(index: number): void {
    this.checklist.removeAt(index);
  }

  protected fieldError(path: string): string | null {
    return serverErrorMessage(this.form, path);
  }

  /** Uploads the chosen images one by one (the endpoint takes a single file) and keeps their ids for the report. */
  protected onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const room = MAX_PHOTOS - this.photos().length;
    const files = Array.from(input.files ?? []).slice(0, Math.max(room, 0));
    input.value = '';
    if (files.length === 0) {
      return;
    }
    this.photoError.set(null);
    this.uploading.set(true);
    from(files)
      .pipe(
        concatMap((file) =>
          this.api.uploadPhoto(this.workOrderId(), file, { clientUuid: globalThis.crypto.randomUUID(), stage: 'after' }).pipe(
            catchError(() => {
              this.photoError.set(this.i18n.translate('FSM.REPORT.PHOTO_FAILED'));
              return EMPTY;
            }),
          ),
        ),
        finalize(() => this.uploading.set(false)),
      )
      .subscribe((res) => this.photos.update((list) => [...list, res.data]));
  }

  protected removePhoto(id: string): void {
    this.photos.update((list) => list.filter((p) => p.id !== id));
  }

  protected captureLocation(): void {
    this.gpsFailed.set(false);
    if (!('geolocation' in globalThis.navigator)) {
      this.gpsFailed.set(true);
      return;
    }
    globalThis.navigator.geolocation.getCurrentPosition(
      (position) => this.gps.set({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => this.gpsFailed.set(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  protected submit(): void {
    const svg = this.signatureSvg();
    if (this.form.invalid || svg === null || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const location = this.gps();
    const payload: FsmSignReportPayload = {
      client_uuid: globalThis.crypto.randomUUID(),
      work_performed_summary: v.work_performed_summary.trim(),
      checklist: v.checklist
        .filter((row) => row.item.trim() !== '')
        .map((row) => ({ item: row.item.trim(), result: row.result, notes: row.notes.trim() || null })),
      labor_hours: v.labor_hours ?? 0,
      travel_hours: v.travel_hours,
      travel_km: v.travel_km,
      apply_callout_fee: v.apply_callout_fee,
      meter_reading_hours: v.meter_reading_hours,
      meter_reading_cycles: v.meter_reading_cycles,
      customer_signer_name: v.customer_signer_name.trim(),
      customer_signer_role: v.customer_signer_role.trim() || null,
      signature_svg: svg,
      signed_at: new Date().toISOString(),
      gps_latitude: location?.latitude ?? null,
      gps_longitude: location?.longitude ?? null,
      photo_ids: this.photos().length > 0 ? this.photos().map((p) => p.id) : undefined,
      locale: LOCALES[this.i18n.currentLanguage()] ?? 'en',
    };
    this.saving.set(true);
    this.formError.set(null);
    this.api.signReport(this.workOrderId(), payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('FSM.REPORT.SIGN_DONE'));
        this.open.set(false);
        this.signed.emit(res.data);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, error);
        this.formError.set(unmapped[0] ?? this.i18n.translate('FSM.REPORT.SIGN_FAILED'));
      },
    });
  }
}
