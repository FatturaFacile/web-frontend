import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  applyServerErrors,
  AssociationApplicationStatus,
  AssociationPublicApiService,
  AssociationPublicForm,
  AssociationPublicFormField,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { map } from 'rxjs';
import { saveBlob } from '../association-area/save-blob';

const AGE_OF_MAJORITY = 18;

/**
 * Public enrolment form of an association (no login): the link token identifies the form. After the
 * submission the person gets a tracking code to follow the decision.
 */
@Component({
  selector: 'app-association-enrolment',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  templateUrl: './association-enrolment.component.html',
  styleUrl: './association-enrolment.component.scss',
})
export class AssociationEnrolmentComponent implements OnInit {
  private readonly api = inject(AssociationPublicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly token = toSignal(this.route.paramMap.pipe(map((params) => params.get('token') ?? '')), { initialValue: '' });

  protected readonly state = signal<'loading' | 'ready' | 'notFound'>('loading');
  protected readonly definition = signal<AssociationPublicForm | null>(null);
  protected readonly submitting = signal(false);
  protected readonly trackingCode = signal<string | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly status = signal<AssociationApplicationStatus | null>(null);
  protected readonly lookupCode = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  protected readonly person = this.fb.group({
    first_name: ['', [Validators.required, Validators.maxLength(255)]],
    last_name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    birth_date: ['', [Validators.required]],
    birth_place: [''],
    gender: [''],
    tax_code: ['', [Validators.required, Validators.maxLength(30)]],
    guardian_first_name: [''],
    guardian_last_name: [''],
    guardian_email: ['', [Validators.email]],
    guardian_phone: [''],
    guardian_relationship: [''],
    privacy_accepted: [false, [Validators.requiredTrue]],
  });
  protected readonly extra = new FormGroup<Record<string, AbstractControl>>({});
  protected readonly files = signal<Record<string, File>>({});

  private readonly birthDate = toSignal(this.person.controls.birth_date.valueChanges, { initialValue: '' });
  protected readonly isMinor = computed(() => {
    const value = this.birthDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const limit = new Date(value);
    limit.setFullYear(limit.getFullYear() + AGE_OF_MAJORITY);
    return limit.getTime() > Date.now();
  });
  protected readonly fillableDocuments = computed(() => (this.definition()?.documents ?? []).filter((doc) => doc.mode !== 'download_only'));

  constructor() {
    effect(() => this.requireGuardian(this.isMinor()));
  }

  ngOnInit(): void {
    this.api.getForm(this.token()).subscribe({
      next: (res) => {
        this.definition.set(res.data);
        for (const field of res.data.fields) {
          this.extra.addControl(field.code, new FormControl(field.type === 'boolean' ? false : '', field.required ? [Validators.required] : []));
        }
        this.state.set('ready');
      },
      error: () => this.state.set('notFound'),
    });
  }

  protected onFile(documentId: string, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0);
    this.files.update((all) => {
      const next = { ...all };
      if (file) {
        next[documentId] = file;
      } else {
        delete next[documentId];
      }
      return next;
    });
  }

  protected downloadTemplate(documentId: string, title: string): void {
    this.api.downloadTemplate(this.token(), documentId).subscribe((blob) => saveBlob(blob, title));
  }

  protected optionsOf(field: AssociationPublicFormField): string[] {
    return field.options ?? [];
  }

  protected fieldType(field: AssociationPublicFormField): string {
    return field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
  }

  protected submit(): void {
    this.person.markAllAsTouched();
    this.extra.markAllAsTouched();
    const missingFile = this.fillableDocuments().some((doc) => doc.mode === 'required' && !this.files()[doc.id]);
    if (this.person.invalid || this.extra.invalid || missingFile) {
      this.errors.set(missingFile ? ['ASSOC_ENROL.DOCUMENT_REQUIRED'] : []);
      return;
    }
    this.submitting.set(true);
    this.errors.set([]);
    this.api.submit(this.token(), this.buildPayload()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.trackingCode.set(res.data.tracking_code);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const unmapped = applyServerErrors(this.person, err);
        this.errors.set(unmapped.length > 0 ? unmapped : ['ASSOC_ENROL.SUBMIT_FAILED']);
      },
    });
  }

  protected track(): void {
    if (this.lookupCode.invalid) {
      return;
    }
    this.api.trackApplication(this.token(), this.lookupCode.value.trim()).subscribe({
      next: (res) => this.status.set(res.data.status),
      error: () => this.status.set(null),
    });
  }

  /** The guardian is mandatory for a minor, as the server enforces. */
  private requireGuardian(required: boolean): void {
    for (const control of [this.person.controls.guardian_first_name, this.person.controls.guardian_last_name, this.person.controls.guardian_email]) {
      if (required) {
        control.addValidators(Validators.required);
      } else {
        control.removeValidators(Validators.required);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private buildPayload(): FormData {
    const payload = new FormData();
    for (const [key, value] of Object.entries(this.person.getRawValue())) {
      if (key === 'privacy_accepted') {
        payload.append(key, value ? '1' : '0');
      } else if (value !== '') {
        payload.append(key, String(value));
      }
    }
    for (const [code, control] of Object.entries(this.extra.controls)) {
      const value: unknown = control.value;
      if (value !== '' && value !== null) {
        payload.append(`extra[${code}]`, value === true ? '1' : value === false ? '0' : String(value));
      }
    }
    for (const [documentId, file] of Object.entries(this.files())) {
      payload.append(`documents[${documentId}]`, file);
    }
    return payload;
  }
}
