import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ContractPublicSigningView, ContractRegisterApiService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';

/**
 * Public signing page (no login): the secret token of the link identifies the signer. The signer reads the text,
 * then signs or declines with a reason.
 */
@Component({
  selector: 'app-contract-signing',
  styleUrl: './contract-signing.component.scss',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card class="signing-card" [nzTitle]="'CONTRACT_SIGN.TITLE' | translate">
      <nz-spin [nzSpinning]="loading()">
        @if (invalidLink()) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="'CONTRACT_SIGN.INVALID_LINK' | translate" />
        } @else if (view(); as v) {
          <p class="signing-intro">
            {{ 'CONTRACT_SIGN.GREETING' | translate: { name: v.signer_name } }}
            @if (v.company_name) {
              {{ 'CONTRACT_SIGN.FROM_COMPANY' | translate: { company: v.company_name } }}
            }
          </p>
          <article class="signing-text" data-test="signing-text">{{ v.body }}</article>
          <p class="signing-hash">{{ 'CONTRACT_SIGN.DOCUMENT_HASH' | translate }}: {{ v.document_hash }}</p>
          <ul class="signing-signers">
            @for (signer of v.signers; track signer.position) {
              <li>
                {{ signer.position }}. {{ signer.name }}
                <nz-tag>{{ 'CONTRACT_SIGN.SIGNER_STATUS.' + signer.status | translate }}</nz-tag>
              </li>
            }
          </ul>

          @switch (outcome()) {
            @case ('signed') {
              <nz-alert nzType="success" nzShowIcon [nzMessage]="'CONTRACT_SIGN.SIGNED' | translate" />
            }
            @case ('declined') {
              <nz-alert nzType="warning" nzShowIcon [nzMessage]="'CONTRACT_SIGN.DECLINED' | translate" />
            }
            @default {
              @if (v.can_sign) {
                <div class="signing-actions">
                  <button nz-button nzType="primary" type="button" data-test="sign" [nzLoading]="busy()" (click)="sign()">
                    <span nz-icon nzType="check"></span>{{ 'CONTRACT_SIGN.SIGN' | translate }}
                  </button>
                  <button nz-button nzDanger type="button" data-test="start-decline" (click)="declining.set(true)">
                    {{ 'CONTRACT_SIGN.DECLINE' | translate }}
                  </button>
                </div>
                @if (declining()) {
                  <form [formGroup]="declineForm" (ngSubmit)="decline()" class="signing-decline">
                    <label for="decline-reason">{{ 'CONTRACT_SIGN.DECLINE_REASON' | translate }}</label>
                    <textarea nz-input id="decline-reason" rows="3" formControlName="reason"></textarea>
                    <button nz-button nzDanger type="submit" [nzLoading]="busy()" [disabled]="declineForm.invalid">
                      {{ 'CONTRACT_SIGN.CONFIRM_DECLINE' | translate }}
                    </button>
                  </form>
                }
              } @else {
                <nz-alert nzType="info" nzShowIcon [nzMessage]="stateKey(v) | translate" />
              }
            }
          }
          @if (errorKey()) {
            <nz-alert class="signing-error" nzType="error" nzShowIcon [nzMessage]="errorKey() | translate" />
          }
        }
      </nz-spin>
    </nz-card>
  `,
})
export class ContractSigningComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ContractRegisterApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly view = signal<ContractPublicSigningView | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly invalidLink = signal(false);
  protected readonly declining = signal(false);
  protected readonly errorKey = signal('');
  protected readonly outcome = signal<'signed' | 'declined' | null>(null);
  protected readonly declineForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.api.getPublicSigning(this.token).subscribe({
      next: (res) => {
        this.view.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.invalidLink.set(true);
        this.loading.set(false);
      },
    });
  }

  protected stateKey(view: ContractPublicSigningView): string {
    if (view.signer_status === 'signed') {
      return 'CONTRACT_SIGN.ALREADY_SIGNED';
    }
    if (view.waiting_for_previous) {
      return 'CONTRACT_SIGN.WAITING';
    }
    return `CONTRACT_SIGN.REQUEST_STATUS.${view.status}`;
  }

  protected sign(): void {
    this.busy.set(true);
    this.errorKey.set('');
    this.api.signPublicSigning(this.token).subscribe({
      next: (res) => this.done(res.data, 'signed'),
      error: (err: HttpErrorResponse) => this.fail(err),
    });
  }

  protected decline(): void {
    if (this.declineForm.invalid) {
      this.declineForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.errorKey.set('');
    this.api.declinePublicSigning(this.token, this.declineForm.getRawValue().reason).subscribe({
      next: (res) => this.done(res.data, 'declined'),
      error: (err: HttpErrorResponse) => this.fail(err),
    });
  }

  private done(view: ContractPublicSigningView, outcome: 'signed' | 'declined'): void {
    this.view.set(view);
    this.outcome.set(outcome);
    this.busy.set(false);
  }

  private fail(err: HttpErrorResponse): void {
    this.busy.set(false);
    this.errorKey.set(err.status === 404 ? 'CONTRACT_SIGN.INVALID_LINK' : 'CONTRACT_SIGN.FAILED');
  }
}
