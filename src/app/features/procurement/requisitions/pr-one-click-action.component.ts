import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService, SupportedLanguage } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import { OneClickActionResponse } from '@domain/procurement/purchase-requisition.models';
import { DateFormatPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { extractApiErrorMessage, prStatusLabelKey, prStatusTagColor } from './pr-status.helpers';

type OneClickViewState = 'loading' | 'confirm_reject' | 'success' | 'error';

/**
 * Public / deep-link landing page for Email 1-Click Purchase Requisition approve/reject tokens.
 */
@Component({
  selector: 'app-pr-one-click-action',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DateFormatPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzResultModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  templateUrl: './pr-one-click-action.component.html',
  styleUrl: './pr-one-click-action.component.scss',
})
export class PrOneClickActionComponent implements OnInit {
  readonly tokenInput = input<string | null>(null);
  readonly actionInput = input<string | null>(null);

  private readonly api = inject(PurchaseRequisitionApiService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly i18n = inject(I18nService);

  readonly token = signal<string>('');
  readonly action = signal<'approve' | 'reject' | null>(null);
  readonly viewState = signal<OneClickViewState>('loading');
  readonly submitting = signal<boolean>(false);
  readonly result = signal<OneClickActionResponse | null>(null);
  readonly errorMessage = signal<string>('');
  readonly rejectError = signal<string | null>(null);

  readonly commentControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.maxLength(2000)],
  });

  readonly languages: readonly SupportedLanguage[] = ['it', 'en', 'de', 'fr'];
  readonly currentLanguage = computed(() => this.i18n.currentLanguage());

  readonly statusLabel = prStatusLabelKey;
  readonly statusColor = prStatusTagColor;

  ngOnInit(): void {
    const queryMap = this.route?.snapshot.queryParamMap;
    const resolvedToken = (this.tokenInput() ?? queryMap?.get('token') ?? '').trim();
    const rawAction = (this.actionInput() ?? queryMap?.get('action') ?? '').trim().toLowerCase();

    this.token.set(resolvedToken);

    if (!resolvedToken || (rawAction !== 'approve' && rawAction !== 'reject')) {
      this.errorMessage.set(this.i18n.translate('PR.ONE_CLICK.INVALID_LINK'));
      this.viewState.set('error');
      return;
    }

    this.action.set(rawAction);

    if (rawAction === 'approve') {
      this.executeAction('approve', null);
    } else {
      this.viewState.set('confirm_reject');
    }
  }

  switchLanguage(lang: SupportedLanguage): void {
    void this.i18n.setLanguage(lang);
  }

  submitRejection(): void {
    if (this.submitting() || this.action() !== 'reject') {
      return;
    }
    this.rejectError.set(null);
    const comment = this.commentControl.getRawValue().trim() || null;
    this.executeAction('reject', comment);
  }

  private executeAction(action: 'approve' | 'reject', comment: string | null): void {
    const currentToken = this.token();
    if (!currentToken) {
      return;
    }

    this.submitting.set(true);
    if (action === 'approve') {
      this.viewState.set('loading');
    }

    this.api.oneClickAction({ token: currentToken, action, comment }).subscribe({
      next: (res) => {
        this.result.set(res.data);
        this.submitting.set(false);
        this.viewState.set('success');
      },
      error: (err: unknown) => {
        const msg = extractApiErrorMessage(err) || this.i18n.translate('PR.ONE_CLICK.ERROR_DESC');
        this.submitting.set(false);
        if (action === 'reject' && this.isUnprocessableEntity(err)) {
          this.rejectError.set(msg);
          return;
        }
        this.errorMessage.set(msg);
        this.viewState.set('error');
      },
    });
  }

  private isUnprocessableEntity(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      (err as { status?: unknown }).status === 422
    );
  }
}
