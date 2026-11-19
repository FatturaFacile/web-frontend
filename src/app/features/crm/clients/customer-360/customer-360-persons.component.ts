import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  ClientApiService,
  ContactPersonRecord,
  I18nService,
  PERSON_ROLES,
  PersonRole,
} from '@core';
import { TranslatePipe } from '@shared';

/** Contact persons of a customer, grouped by role; one person of the customer is the primary contact. */
@Component({
  selector: 'app-customer-360-persons',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @for (group of groups(); track group.role) {
      <h4>{{ 'CRM.CUSTOMER360.ROLE_' + group.role.toUpperCase() | translate }}</h4>
      @for (person of group.items; track person.id) {
        <div class="row">
          <strong>{{ person.first_name }} {{ person.last_name }}</strong>
          <span>{{ person.job_title }}</span>
          <span>{{ person.email }}</span>
          <span>{{ person.phone || person.mobile }}</span>
          @if (person.is_primary) {
            <nz-tag nzColor="green">{{ 'CRM.CUSTOMER360.PRIMARY' | translate }}</nz-tag>
          } @else {
            <button nz-button nzSize="small" type="button" (click)="makePrimary(person)">
              {{ 'CRM.CUSTOMER360.SET_PRIMARY' | translate }}
            </button>
          }
          <button nz-button nzSize="small" nzDanger type="button" (click)="remove(person)">
            {{ 'COMMON.DELETE' | translate }}
          </button>
        </div>
      }
    } @empty {
      <nz-empty />
    }

    <form nz-form nzLayout="inline" [formGroup]="form" (ngSubmit)="add()" class="add">
      <nz-form-item>
        <nz-select formControlName="role" [attr.aria-label]="'CRM.CUSTOMER360.ROLE' | translate">
          @for (role of roles; track role) {
            <nz-option
              [nzValue]="role"
              [nzLabel]="'CRM.CUSTOMER360.ROLE_' + role.toUpperCase() | translate"
            />
          }
        </nz-select>
      </nz-form-item>
      <nz-form-item>
        <input nz-input formControlName="first_name" [placeholder]="'CRM.CLIENTS.FORM.FIRST_NAME' | translate" />
      </nz-form-item>
      <nz-form-item>
        <input nz-input formControlName="last_name" [placeholder]="'CRM.CLIENTS.FORM.LAST_NAME' | translate" />
      </nz-form-item>
      <nz-form-item>
        <input nz-input formControlName="email" [placeholder]="'CRM.CLIENTS.FORM.EMAIL' | translate" />
      </nz-form-item>
      <nz-form-item>
        <input nz-input formControlName="phone" [placeholder]="'CRM.CLIENTS.FORM.PHONE' | translate" />
      </nz-form-item>
      <button nz-button nzType="primary" type="submit" [disabled]="form.invalid" [nzLoading]="saving()">
        {{ 'CRM.CUSTOMER360.ADD_PERSON' | translate }}
      </button>
    </form>
  `,
  styles: `
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 4px 0;
    }
    .add {
      margin-top: 12px;
      gap: 8px;
    }
  `,
})
export class Customer360PersonsComponent implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly contactId = input.required<string>();
  protected readonly roles = PERSON_ROLES;
  protected readonly persons = signal<ContactPersonRecord[]>([]);
  protected readonly saving = signal(false);

  /** Persons grouped by role (people without a role under "other"); the primary one comes first. */
  protected readonly groups = computed(() =>
    PERSON_ROLES.map((role) => ({
      role,
      items: this.persons()
        .filter((person) => (person.role ?? 'other') === role)
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
    })).filter((group) => group.items.length > 0),
  );

  protected readonly form = this.fb.group({
    role: this.fb.control<PersonRole>('administration', Validators.required),
    first_name: this.fb.control('', Validators.maxLength(100)),
    last_name: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
    email: this.fb.control('', Validators.email),
    phone: this.fb.control('', Validators.maxLength(50)),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .persons(this.contactId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (res) => this.persons.set(res.data), error: () => this.persons.set([]) });
  }

  protected add(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const first = this.persons().length === 0;
    this.saving.set(true);
    this.api
      .createPerson(this.contactId(), {
        role: value.role,
        first_name: value.first_name.trim() || null,
        last_name: value.last_name,
        email: value.email.trim() || null,
        phone: value.phone.trim() || null,
        // The first person of the customer is the primary contact.
        is_primary: first,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.patchValue({ first_name: '', last_name: '', email: '', phone: '' });
          this.form.markAsUntouched();
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          applyServerErrors(this.form, err).forEach((m) => this.message.error(m));
        },
      });
  }

  /** The API keeps one primary person per customer: the previous one is demoted. */
  protected makePrimary(person: ContactPersonRecord): void {
    this.api.updatePerson(this.contactId(), person.id, { is_primary: true }).subscribe({
      next: () => this.load(),
      error: () => this.message.error(this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE')),
    });
  }

  protected remove(person: ContactPersonRecord): void {
    this.api.deletePerson(this.contactId(), person.id).subscribe({
      next: () => this.load(),
      error: () => this.message.error(this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE')),
    });
  }
}
