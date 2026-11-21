import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { AuthStore } from '@core';
import { TranslatePipe } from '@shared';
import { SecurityCenterApiService } from './security-center-api.service';
import { PII_JUSTIFICATION_MIN_LENGTH, PII_UNMASK_PERMISSION } from './security-center.model';

/** Requires a justification of at least `PII_JUSTIFICATION_MIN_LENGTH` characters once trimmed. */
export function justificationValidator(control: AbstractControl): ValidationErrors | null {
  const length = String(control.value ?? '').trim().length;
  return length >= PII_JUSTIFICATION_MIN_LENGTH ? null : { justification: { length } };
}

/**
 * A masked personal value with a "Reveal" action. Revealing asks for a justification (at least 10 characters), sends it
 * with the entity reference to `POST /security/pii/unmask` and shows the clear value. Without the permission
 * `privacy.pii.unmask` the value stays masked and no button is offered.
 */
@Component({
  selector: 'app-pii-reveal',
  imports: [NzButtonModule, NzInputModule, ReactiveFormsModule, TranslatePipe],
  styleUrl: './security-center.scss',
  host: { class: 'pii-reveal' },
  template: `
    <span class="pii-value mono" data-testid="pii-value" aria-live="polite">{{
      revealed() ?? maskedValue()
    }}</span>

    @if (canReveal()) {
      @if (revealed() === null) {
        @if (!asking()) {
          <button
            nz-button
            nzType="link"
            nzSize="small"
            type="button"
            data-testid="reveal-button"
            (click)="asking.set(true)"
          >
            {{ 'SECURITY_CENTER.PII.REVEAL' | translate }}
          </button>
        } @else {
          <form class="pii-form" [formGroup]="form" (ngSubmit)="confirm()">
            <label [for]="inputId">{{ 'SECURITY_CENTER.PII.JUSTIFICATION' | translate }}</label>
            <textarea
              nz-input
              rows="2"
              [id]="inputId"
              formControlName="justification"
              data-testid="justification"
              [attr.aria-describedby]="inputId + '-hint'"
            ></textarea>
            <small [id]="inputId + '-hint'" class="hint">{{
              'SECURITY_CENTER.PII.JUSTIFICATION_HINT' | translate: { min: minLength }
            }}</small>
            @if (error(); as key) {
              <small class="error" role="alert" data-testid="pii-error">{{
                key | translate
              }}</small>
            }
            <div class="pii-actions">
              <button
                nz-button
                nzType="primary"
                nzSize="small"
                type="submit"
                data-testid="confirm-reveal"
                [disabled]="form.invalid || loading()"
              >
                {{ 'SECURITY_CENTER.PII.CONFIRM' | translate }}
              </button>
              <button nz-button nzSize="small" type="button" (click)="cancel()">
                {{ 'SECURITY_CENTER.PII.CANCEL' | translate }}
              </button>
            </div>
          </form>
        }
      } @else {
        <button
          nz-button
          nzType="link"
          nzSize="small"
          type="button"
          data-testid="hide-button"
          (click)="hide()"
        >
          {{ 'SECURITY_CENTER.PII.HIDE' | translate }}
        </button>
      }
    }
  `,
})
export class PiiRevealComponent {
  private static nextId = 0;

  private readonly api = inject(SecurityCenterApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();
  readonly field = input.required<string>();
  readonly maskedValue = input<string>('••••••');

  protected readonly minLength = PII_JUSTIFICATION_MIN_LENGTH;
  protected readonly inputId = `pii-justification-${PiiRevealComponent.nextId++}`;

  readonly form = this.fb.group({
    justification: ['', [justificationValidator]],
  });

  readonly asking = signal(false);
  readonly loading = signal(false);
  readonly revealed = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly canReveal = computed(() => this.authStore.can(PII_UNMASK_PERMISSION));

  confirm(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api
      .unmask({
        entity_type: this.entityType(),
        entity_id: this.entityId(),
        field: this.field(),
        justification: this.form.controls.justification.value.trim(),
      })
      .subscribe({
        next: (response) => {
          this.revealed.set(response.data.value);
          this.asking.set(false);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(
            err instanceof HttpErrorResponse && err.status === 403
              ? 'SECURITY_CENTER.PII.FORBIDDEN'
              : 'SECURITY_CENTER.PII.ERROR',
          );
        },
      });
  }

  cancel(): void {
    this.asking.set(false);
    this.form.reset();
    this.error.set(null);
  }

  hide(): void {
    this.revealed.set(null);
    this.asking.set(false);
    this.form.reset();
    this.error.set(null);
  }
}
