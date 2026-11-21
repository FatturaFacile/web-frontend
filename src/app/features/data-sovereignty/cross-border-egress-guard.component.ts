import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { JURISDICTION_ZONES, JurisdictionZone } from './data-sovereignty.models';
import { DataSovereigntyStore } from './data-sovereignty.store';
import { decisionColor, decisionKey, zoneKey } from './data-sovereignty.utils';
import { SovereigntyNavComponent } from './sovereignty-nav.component';

/**
 * The cross-border egress firewall: the adequacy matrix (Swiss Federal Council, nLPD Annex 1, and EU Commission, GDPR Art. 45),
 * a tester that judges a webhook, connector or export URL against the policy without sending anything, and the transfers that
 * were blocked.
 */
@Component({
  selector: 'app-cross-border-egress-guard',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    SovereigntyNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'DATA_SOVEREIGNTY.EGRESS_TITLE' | translate"
      [subtitle]="'DATA_SOVEREIGNTY.EGRESS_SUBTITLE' | translate"
    ></app-page-header>
    <app-sovereignty-nav></app-sovereignty-nav>

    <nz-card data-testid="blocked-counter">
      <nz-statistic
        [nzTitle]="'DATA_SOVEREIGNTY.BLOCKED_30_DAYS' | translate"
        [nzValue]="store.blockedLast30Days()"
      ></nz-statistic>
    </nz-card>

    <nz-card [nzTitle]="'DATA_SOVEREIGNTY.TEST_ENDPOINT' | translate" data-testid="tester">
      <form [formGroup]="tester" (ngSubmit)="test()">
        <label for="target">{{ 'DATA_SOVEREIGNTY.TARGET_URL' | translate }}</label>
        <input
          nz-input
          id="target"
          formControlName="target"
          data-testid="target"
          placeholder="https://hooks.example.com/…"
          autocomplete="off"
        />
        <label for="purpose">{{ 'DATA_SOVEREIGNTY.PURPOSE' | translate }}</label>
        <input
          nz-input
          id="purpose"
          formControlName="purpose"
          data-testid="purpose"
          autocomplete="off"
        />
        <label for="country">{{ 'DATA_SOVEREIGNTY.COUNTRY_OPTIONAL' | translate }}</label>
        <input
          nz-input
          id="country"
          formControlName="country"
          maxlength="2"
          data-testid="country"
          autocomplete="off"
        />
        <button
          nz-button
          nzType="primary"
          type="submit"
          data-testid="run-test"
          [nzLoading]="store.busy()"
          [disabled]="tester.invalid || store.busy()"
        >
          {{ 'DATA_SOVEREIGNTY.RUN_TEST' | translate }}
        </button>
      </form>
      @if (store.verdict(); as verdict) {
        <nz-alert
          data-testid="verdict"
          nzShowIcon
          [nzType]="verdict.allowed ? 'success' : 'error'"
          [nzMessage]="
            (verdict.allowed
              ? 'DATA_SOVEREIGNTY.VERDICT_ALLOWED'
              : 'DATA_SOVEREIGNTY.VERDICT_BLOCKED'
            ) | translate
          "
          [nzDescription]="
            describe(
              verdict.destination_country_iso2,
              verdict.reason,
              verdict.legal_basis_reference
            )
          "
        ></nz-alert>
      }
      @if (testError()) {
        <nz-alert
          nzType="error"
          nzShowIcon
          data-testid="test-error"
          [nzMessage]="'DATA_SOVEREIGNTY.GENERIC_ERROR' | translate"
        ></nz-alert>
      }
    </nz-card>

    <nz-card [nzTitle]="'DATA_SOVEREIGNTY.ADEQUACY' | translate" data-testid="matrix">
      <nz-select
        class="zone-filter"
        data-testid="zone-filter"
        [ngModel]="zone()"
        (ngModelChange)="zone.set($event)"
      >
        @for (option of zones; track option) {
          <nz-option [nzValue]="option" [nzLabel]="zoneLabel(option) | translate"></nz-option>
        }
      </nz-select>
      <nz-table #matrix [nzData]="rows()" [nzPageSize]="15" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'DATA_SOVEREIGNTY.COL_COUNTRY' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_CH_ADEQUACY' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_EU_ADEQUACY' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_DECISION' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_LEGAL_BASIS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (rule of matrix.data; track rule.id) {
            <tr [attr.data-testid]="'rule-' + rule.destination_country_iso2">
              <td>{{ rule.destination_country_name }} ({{ rule.destination_country_iso2 }})</td>
              <td>
                {{
                  (rule.has_ch_adequacy ? 'DATA_SOVEREIGNTY.YES' : 'DATA_SOVEREIGNTY.NO')
                    | translate
                }}
              </td>
              <td>
                {{
                  (rule.has_eu_adequacy ? 'DATA_SOVEREIGNTY.YES' : 'DATA_SOVEREIGNTY.NO')
                    | translate
                }}
              </td>
              <td>
                <nz-tag [nzColor]="decisionColor(rule.decision_status)">{{
                  decisionKey(rule.decision_status) | translate
                }}</nz-tag>
              </td>
              <td>{{ rule.legal_basis_reference }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card [nzTitle]="'DATA_SOVEREIGNTY.BLOCKED_ATTEMPTS' | translate" data-testid="blocked">
      <nz-table
        #blocked
        [nzData]="store.blockedAttempts()"
        [nzShowPagination]="false"
        nzSize="small"
      >
        <thead>
          <tr>
            <th>{{ 'DATA_SOVEREIGNTY.COL_TIME' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_COUNTRY' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.PURPOSE' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_TARGET' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_REASON' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (attempt of blocked.data; track attempt.id) {
            <tr data-testid="blocked-row">
              <td>{{ attempt.occurred_at | date: 'medium' }}</td>
              <td>{{ attempt.destination_country_iso2 ?? '?' }}</td>
              <td>{{ attempt.purpose }}</td>
              <td>{{ attempt.target }}</td>
              <td>{{ attempt.reason }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    nz-card {
      margin-bottom: 16px;
    }
    form label {
      display: block;
      margin: 12px 0 4px;
    }
    form button {
      margin-top: 12px;
    }
    .zone-filter {
      min-width: 260px;
      margin-bottom: 12px;
    }
  `,
})
export class CrossBorderEgressGuardComponent implements OnInit {
  protected readonly store = inject(DataSovereigntyStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly zones = JURISDICTION_ZONES;
  protected readonly decisionColor = decisionColor;
  protected readonly decisionKey = decisionKey;
  protected readonly zone = signal<JurisdictionZone>('Strict-CH-Only');
  protected readonly testError = signal(false);

  protected readonly tester = this.fb.group({
    target: this.fb.control('', [Validators.required, Validators.maxLength(2048)]),
    purpose: this.fb.control('webhook', [Validators.required, Validators.maxLength(64)]),
    country: this.fb.control('', [Validators.pattern(/^([A-Za-z]{2})?$/)]),
  });

  protected readonly rows = computed(() =>
    this.store.rules().filter((rule) => rule.source_jurisdiction === this.zone()),
  );

  ngOnInit(): void {
    this.store.loadDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.store.loadRules().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected zoneLabel(zone: JurisdictionZone): string {
    return zoneKey(zone);
  }

  protected describe(country: string | null, reason: string | null, basis: string | null): string {
    return [country, reason, basis].filter((part) => part !== null && part !== '').join(' · ');
  }

  protected test(): void {
    if (this.tester.invalid) {
      return;
    }

    const value = this.tester.getRawValue();
    this.testError.set(false);
    this.store
      .validateTransfer({
        target: value.target,
        purpose: value.purpose,
        destination_country_iso2: value.country === '' ? null : value.country.toUpperCase(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.testError.set(true) });
  }
}
