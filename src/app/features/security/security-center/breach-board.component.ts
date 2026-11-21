import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PgBreach, PrivacyGovernanceApiService } from '@core';
import { TranslatePipe } from '@shared';
import {
  createBreachCountdown,
  severityColor,
} from '../../privacy-governance/privacy-governance.helpers';

/** The live `HH:MM:SS` countdown to the 72 hours notification deadline of one incident. */
@Component({
  selector: 'app-breach-countdown',
  styleUrl: './security-center.scss',
  template: `
    <span class="countdown" data-testid="countdown" [class.overdue]="countdown.overdue()">{{
      countdown.label()
    }}</span>
  `,
})
export class BreachCountdownComponent {
  readonly deadline = input.required<string>();
  protected readonly countdown = createBreachCountdown(this.deadline);
}

/** Breach board: one card per incident with the 72 hours countdown to the authority notification. */
@Component({
  selector: 'app-security-breach-board',
  styleUrl: './security-center.scss',
  imports: [
    DatePipe,
    NzAlertModule,
    NzCardModule,
    NzTagModule,
    TranslatePipe,
    BreachCountdownComponent,
  ],
  template: `
    @if (error()) {
      <nz-alert
        class="banner"
        nzType="error"
        nzShowIcon
        [nzMessage]="'SECURITY_CENTER.BREACH.LOAD_ERROR' | translate"
      />
    }
    @if (!loading() && breaches().length === 0 && !error()) {
      <nz-alert
        nzType="success"
        nzShowIcon
        data-testid="no-breaches"
        [nzMessage]="'SECURITY_CENTER.BREACH.NONE' | translate"
      />
    }
    <div class="breach-grid">
      @for (breach of breaches(); track breach.id) {
        <nz-card [nzTitle]="breach.incident_code" [nzLoading]="loading()" data-testid="breach-card">
          <p>
            <strong>{{ breach.title }}</strong>
          </p>
          <nz-tag [nzColor]="severityColor(breach.severity)">{{
            'PRIVACY.SEVERITY.' + breach.severity | translate
          }}</nz-tag>
          <nz-tag>{{ 'PRIVACY.BREACH_STATUS.' + breach.status | translate }}</nz-tag>
          <div class="kpi-caption">
            {{ 'SECURITY_CENTER.BREACH.DETECTED' | translate }}:
            {{ breach.detected_at | date: 'medium' }}
          </div>
          @if (breach.authority_notified_at) {
            <nz-tag nzColor="green" data-testid="notified">{{
              'SECURITY_CENTER.BREACH.NOTIFIED' | translate
            }}</nz-tag>
          } @else {
            <div class="kpi-caption">{{ 'SECURITY_CENTER.BREACH.TIME_LEFT' | translate }}</div>
            <app-breach-countdown [deadline]="breach.notification_deadline_72h" />
          }
        </nz-card>
      }
    </div>
  `,
})
export class BreachBoardComponent implements OnInit {
  private readonly api = inject(PrivacyGovernanceApiService);

  protected readonly severityColor = severityColor;

  readonly breaches = signal<PgBreach[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getBreaches({ per_page: 50 }).subscribe({
      next: (response) => {
        this.breaches.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
