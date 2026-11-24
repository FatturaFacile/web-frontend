import { Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CPQ_LOCALES, CpqApiService, CpqLocale, CpqSignatureLink, CpqSignatureRequest } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';

/**
 * Signature links of a quote: creates a secure time-limited link for the customer in a chosen language, lists the
 * requests with their audit data and checks that a signed quote was not changed afterwards.
 */
@Component({
  selector: 'app-cpq-signature-link',
  imports: [ReactiveFormsModule, NzAlertModule, NzButtonModule, NzSelectModule, NzTagModule, TranslatePipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="create()" class="create">
      <label for="link-locale">{{ 'CPQ.PREVIEW.LANGUAGE' | translate }}</label>
      <nz-select id="link-locale" formControlName="locale">
        @for (locale of locales; track locale) {
          <nz-option [nzValue]="locale" [nzLabel]="locale.toUpperCase()" />
        }
      </nz-select>
      <button nz-button nzType="primary" type="submit" data-test="create-link" [nzLoading]="busy()">
        {{ 'CPQ.SIGN.CREATE_LINK' | translate }}
      </button>
    </form>

    @if (created(); as link) {
      <nz-alert nzType="success" nzShowIcon data-test="created-link" [nzMessage]="'CPQ.SIGN.LINK_EXPIRES' | translate" [nzDescription]="link.url" />
    }

    <ul class="requests" data-test="requests">
      @for (request of requests(); track request.id) {
        <li>
          <nz-tag>{{ request.status }}</nz-tag>
          {{ request.locale.toUpperCase() }} · {{ request.expires_at }}
          @if (request.status === 'signed') {
            <div>{{ request.signer_name }} — {{ request.signer_role }}</div>
            <div>{{ request.signed_at }} · {{ request.ip_address }}</div>
            <div class="hash">{{ request.payload_hash }}</div>
            <button nz-button nzSize="small" type="button" data-test="verify" (click)="verify(request)">
              {{ 'CPQ.SIGN.VERIFY' | translate }}
            </button>
            @if (verified()[request.id] === true) {
              <nz-alert nzType="success" nzShowIcon [nzMessage]="'CPQ.SIGN.INTEGRITY_OK' | translate" />
            } @else if (verified()[request.id] === false) {
              <nz-alert nzType="error" nzShowIcon data-test="integrity-broken" [nzMessage]="'CPQ.SIGN.INTEGRITY_BROKEN' | translate" />
            }
          }
          @if (request.status === 'changes_requested') {
            <div>{{ request.change_request }}</div>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    .create {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .hash {
      font-family: monospace;
      font-size: 11px;
      word-break: break-all;
    }
  `,
})
export class CpqSignatureLinkComponent {
  private readonly api = inject(CpqApiService);
  private readonly fb = inject(FormBuilder);

  readonly quoteId = input.required<string>();

  protected readonly locales = CPQ_LOCALES;
  protected readonly busy = signal(false);
  protected readonly created = signal<CpqSignatureLink | null>(null);
  protected readonly requests = signal<CpqSignatureRequest[]>([]);
  protected readonly verified = signal<Record<string, boolean>>({});

  protected readonly form = this.fb.nonNullable.group({
    locale: this.fb.nonNullable.control<CpqLocale>('it'),
  });

  constructor() {
    effect(() => this.load(this.quoteId()));
  }

  protected create(): void {
    this.busy.set(true);
    this.api.createSignatureLink(this.quoteId(), this.form.getRawValue().locale).subscribe({
      next: (res) => {
        this.created.set(res.data);
        this.busy.set(false);
        this.load(this.quoteId());
      },
      error: () => this.busy.set(false),
    });
  }

  protected verify(request: CpqSignatureRequest): void {
    this.api.verifySignature(this.quoteId(), request.id).subscribe({
      next: (res) => this.verified.update((state) => ({ ...state, [request.id]: res.data.valid })),
    });
  }

  private load(quoteId: string): void {
    this.api.getSignatureRequests(quoteId).subscribe({ next: (res) => this.requests.set(res.data) });
  }
}
