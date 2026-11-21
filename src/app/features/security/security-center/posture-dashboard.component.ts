import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared';
import { dsarDaysLeft } from '../../privacy-governance/privacy-governance.helpers';
import { SecurityCenterApiService } from './security-center-api.service';
import { SecurityPosture } from './security-center.model';

export type ReadinessLevel = 'good' | 'fair' | 'poor';

/** Readiness bands: 85 and above is good, 60 and above fair, anything lower poor. */
export function readinessLevel(score: number): ReadinessLevel {
  if (score >= 85) {
    return 'good';
  }
  return score >= 60 ? 'fair' : 'poor';
}

export function readinessColor(level: ReadinessLevel): string {
  switch (level) {
    case 'good':
      return '#52c41a';
    case 'fair':
      return '#faad14';
    default:
      return '#f5222d';
  }
}

/** Days until the nearest DSAR deadline (negative when overdue), `null` when no request is active. */
export function nearestDsarDays(
  posture: Pick<SecurityPosture, 'active_dsar'>,
  now: number = Date.now(),
): number | null {
  const due = posture.active_dsar.nearest_due_at;
  return due ? dsarDaysLeft(due, now) : null;
}

/** Posture dashboard of the Security Center: one KPI card per control, read from `GET /security/posture`. */
@Component({
  selector: 'app-security-posture-dashboard',
  styleUrl: './security-center.scss',
  imports: [
    DatePipe,
    NzAlertModule,
    NzCardModule,
    NzProgressModule,
    NzSpinModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (error()) {
      <nz-alert
        class="banner"
        nzType="error"
        nzShowIcon
        data-testid="posture-error"
        [nzMessage]="'SECURITY_CENTER.POSTURE.LOAD_ERROR' | translate"
      />
    }
    <nz-spin [nzSpinning]="loading()">
      @if (posture(); as p) {
        <div class="kpi-grid">
          <nz-card
            [nzTitle]="'SECURITY_CENTER.POSTURE.AUDIT_CHAIN' | translate"
            data-testid="kpi-chain"
          >
            <nz-tag
              data-testid="chain-status"
              [nzColor]="p.audit_chain.status === 'verified' ? 'green' : 'red'"
            >
              {{
                (p.audit_chain.status === 'verified'
                  ? 'SECURITY_CENTER.POSTURE.CHAIN_VERIFIED'
                  : 'SECURITY_CENTER.POSTURE.CHAIN_TAMPER'
                ) | translate
              }}
            </nz-tag>
            <div class="kpi-caption">
              {{ 'SECURITY_CENTER.POSTURE.LAST_VERIFIED' | translate }}:
              @if (p.audit_chain.last_verified_at) {
                {{ p.audit_chain.last_verified_at | date: 'medium' }}
              } @else {
                {{ 'SECURITY_CENTER.POSTURE.NEVER' | translate }}
              }
            </div>
            @if (p.audit_chain.last_hash) {
              <div class="kpi-caption mono" data-testid="last-hash">
                {{ p.audit_chain.last_hash }}
              </div>
            }
          </nz-card>

          <nz-card
            [nzTitle]="'SECURITY_CENTER.POSTURE.ENCRYPTION' | translate"
            data-testid="kpi-encryption"
          >
            <nz-progress [nzPercent]="p.encrypted_fields_coverage.percent" nzSize="small" />
            <div class="kpi-caption" data-testid="encryption-caption">
              {{
                'SECURITY_CENTER.POSTURE.ENCRYPTED_OF'
                  | translate
                    : {
                        encrypted: p.encrypted_fields_coverage.encrypted,
                        total: p.encrypted_fields_coverage.total,
                      }
              }}
            </div>
          </nz-card>

          <nz-card
            [nzTitle]="'SECURITY_CENTER.POSTURE.ACTIVE_DSAR' | translate"
            data-testid="kpi-dsar"
          >
            <div class="kpi-value" data-testid="dsar-count">{{ p.active_dsar.count }}</div>
            <div class="kpi-caption" data-testid="dsar-sla">
              @if (dsarDays() === null) {
                {{ 'SECURITY_CENTER.POSTURE.NO_DSAR' | translate }}
              } @else if ((dsarDays() ?? 0) < 0) {
                {{
                  'SECURITY_CENTER.POSTURE.SLA_OVERDUE' | translate: { days: -(dsarDays() ?? 0) }
                }}
              } @else {
                {{ 'SECURITY_CENTER.POSTURE.SLA_DAYS' | translate: { days: dsarDays() ?? 0 } }}
              }
            </div>
          </nz-card>

          <nz-card
            [nzTitle]="'SECURITY_CENTER.POSTURE.LEGAL_HOLDS' | translate"
            data-testid="kpi-holds"
          >
            <div class="kpi-value">{{ p.legal_holds_active }}</div>
          </nz-card>

          <nz-card
            [nzTitle]="'SECURITY_CENTER.POSTURE.INCIDENTS' | translate"
            data-testid="kpi-incidents"
          >
            <div class="kpi-value">{{ p.open_incidents }}</div>
          </nz-card>

          <nz-card
            [nzTitle]="'SECURITY_CENTER.POSTURE.READINESS' | translate"
            data-testid="kpi-readiness"
          >
            <nz-progress
              nzType="circle"
              [nzPercent]="p.readiness_score"
              [nzStrokeColor]="readinessColor()"
              [nzWidth]="96"
            />
            <div class="kpi-caption" data-testid="readiness-level">
              {{ 'SECURITY_CENTER.POSTURE.READINESS_' + level().toUpperCase() | translate }}
            </div>
          </nz-card>
        </div>
      }
    </nz-spin>
  `,
})
export class PostureDashboardComponent implements OnInit {
  private readonly api = inject(SecurityCenterApiService);

  readonly posture = signal<SecurityPosture | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly dsarDays = computed(() => {
    const p = this.posture();
    return p ? nearestDsarDays(p) : null;
  });
  readonly level = computed(() => readinessLevel(this.posture()?.readiness_score ?? 0));
  readonly readinessColor = computed(() => readinessColor(this.level()));

  ngOnInit(): void {
    this.loading.set(true);
    this.api.posture().subscribe({
      next: (response) => {
        this.posture.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
