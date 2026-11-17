import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  isValidationError,
  PublicEstimate,
  PublicEstimateDecision,
  PublicRmaApiService,
} from '@core';
import { CurrencyFormatPipe, TranslatePipe } from '@shared';
import { runRequest } from '../state/action-result';
import { toAmount } from '../utils/rma-status';
import { PublicShellComponent } from './public-shell.component';

type PageState = 'loading' | 'ready' | 'invalid' | 'error';

/**
 * Customer repair-estimate page reached through the tokenized link (no session). Shows only what the
 * public endpoint returns (prices, never internal costs or lab notes) and lets the customer accept or
 * decline with their name. Bad or expired tokens get a neutral page without details.
 */
@Component({
  selector: 'app-rma-estimate',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSpinModule,
    NzTableModule,
    TranslatePipe,
    CurrencyFormatPipe,
    PublicShellComponent,
  ],
  templateUrl: './rma-estimate.component.html',
  styleUrl: './public-page.scss',
})
export class RmaEstimateComponent implements OnInit {
  private readonly api = inject(PublicRmaApiService);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  readonly state = signal<PageState>('loading');
  readonly estimate = signal<PublicEstimate | null>(null);
  readonly name = signal('');
  readonly reason = signal('');
  readonly submitting = signal<PublicEstimateDecision | null>(null);
  readonly nameError = signal<string | null>(null);
  readonly alreadyDecided = signal(false);

  readonly decision = computed(() => this.estimate()?.decision ?? null);
  readonly currency = computed(() => this.estimate()?.currency || 'EUR');
  readonly toAmount = toAmount;

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    if (!this.token) {
      this.state.set('invalid');
      return;
    }
    const res = await runRequest(this.api.getEstimate(this.token));
    if (res.ok) {
      this.estimate.set(res.data.data);
      this.state.set('ready');
      return;
    }
    // Never reveal why a link does not work: 404 (and anything else 4xx) is "invalid or expired".
    this.state.set(
      res.status !== null && res.status >= 400 && res.status < 500 ? 'invalid' : 'error',
    );
  }

  async decide(decision: PublicEstimateDecision): Promise<void> {
    const name = this.name().trim();
    if (!name) {
      this.nameError.set('RMA.PUBLIC.NAME_REQUIRED');
      return;
    }
    this.nameError.set(null);
    this.submitting.set(decision);
    const res =
      decision === 'approved'
        ? await runRequest(this.api.acceptEstimate(this.token, { accepted_by_name: name }))
        : await runRequest(
            this.api.declineEstimate(this.token, {
              declined_by_name: name,
              reason: this.reason().trim() || null,
            }),
          );
    this.submitting.set(null);
    if (res.ok) {
      const current = this.estimate();
      if (current) {
        this.estimate.set({
          ...current,
          decision: res.data.data.decision,
          status: res.data.data.status,
        });
      }
      return;
    }
    if (res.status === 409) {
      this.alreadyDecided.set(true);
      await this.load();
      return;
    }
    if (isValidationError(res.error)) {
      const errors: Record<string, string[]> = res.error.error.errors;
      const message =
        errors['accepted_by_name']?.[0] ?? errors['declined_by_name']?.[0] ?? errors['reason']?.[0];
      this.nameError.set(message ?? 'RMA.PUBLIC.NAME_REQUIRED');
      return;
    }
    if (res.status === 404) {
      this.state.set('invalid');
      return;
    }
    this.state.set('error');
  }
}
