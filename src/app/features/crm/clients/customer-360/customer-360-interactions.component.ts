import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  ClientApiService,
  INTERACTION_TYPES,
  InteractionRecord,
  InteractionType,
} from '@core';
import { TranslatePipe } from '@shared';

/** Interaction log of a customer (calls, emails, notes, meetings): the full history, newest first, and a form to log one. */
@Component({
  selector: 'app-customer-360-interactions',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="log()" class="add">
      <nz-select formControlName="type" [attr.aria-label]="'CRM.CUSTOMER360.INTERACTION_TYPE' | translate">
        @for (t of types; track t) {
          <nz-option [nzValue]="t" [nzLabel]="'CRM.CUSTOMER360.INTERACTION_' + t.toUpperCase() | translate" />
        }
      </nz-select>
      <input
        nz-input
        class="grow"
        formControlName="subject"
        maxlength="200"
        [placeholder]="'CRM.CUSTOMER360.INTERACTION_SUBJECT' | translate"
      />
      <input
        nz-input
        class="grow"
        formControlName="notes"
        [placeholder]="'CRM.CUSTOMER360.INTERACTION_NOTES' | translate"
      />
      <button nz-button nzType="primary" type="submit" [disabled]="form.invalid" [nzLoading]="saving()">
        {{ 'CRM.CUSTOMER360.LOG_INTERACTION' | translate }}
      </button>
    </form>

    @for (interaction of interactions(); track interaction.id) {
      <div class="row">
        <nz-tag>{{ 'CRM.CUSTOMER360.INTERACTION_' + interaction.type.toUpperCase() | translate }}</nz-tag>
        <strong>{{ interaction.subject }}</strong>
        <span>{{ interaction.occurred_at ?? interaction.created_at | date: 'short' }}</span>
        @if (interaction.notes) {
          <span>{{ interaction.notes }}</span>
        }
      </div>
    } @empty {
      <nz-empty />
    }

    @if (hasMore()) {
      <button nz-button type="button" [nzLoading]="loadingMore()" (click)="loadMore()">
        {{ 'CRM.CUSTOMER360.LOAD_MORE' | translate }}
      </button>
    }
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
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .grow {
      flex: 1 1 200px;
      width: auto;
    }
  `,
})
export class Customer360InteractionsComponent implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly contactId = input.required<string>();

  protected readonly types = INTERACTION_TYPES;
  protected readonly interactions = signal<InteractionRecord[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly saving = signal(false);
  private page = 1;

  protected readonly form = this.fb.group({
    type: this.fb.control<InteractionType>('call', Validators.required),
    subject: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    notes: this.fb.control(''),
  });

  ngOnInit(): void {
    this.reload();
  }

  /** Loads the first page again (after a new entry). */
  protected reload(): void {
    this.page = 1;
    this.fetch(false);
  }

  protected loadMore(): void {
    this.page += 1;
    this.loadingMore.set(true);
    this.fetch(true);
  }

  private fetch(append: boolean): void {
    this.api
      .interactions(this.contactId(), this.page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.interactions.update((all) => (append ? [...all, ...res.data] : res.data));
          this.hasMore.set(res.meta.current_page < res.meta.last_page);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          if (!append) {
            this.interactions.set([]);
          }
        },
      });
  }

  protected log(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { type, subject, notes } = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .createInteraction(this.contactId(), { type, subject, notes: notes.trim() || null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.patchValue({ subject: '', notes: '' });
          this.form.markAsUntouched();
          this.reload();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          applyServerErrors(this.form, err).forEach((m) => this.message.error(m));
        },
      });
  }
}
