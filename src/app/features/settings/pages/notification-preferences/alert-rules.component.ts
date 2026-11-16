import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NotificationAlertRule, PlatformApiService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';

/**
 * Administrator alert rules, for example "notify when a customer's overdue total exceeds 10,000 CHF". The card stays
 * hidden for users without access to the platform module (the API answers 403).
 */
@Component({
  selector: 'app-alert-rules',
  imports: [FormsModule, NzButtonModule, NzCardModule, NzSwitchModule, NzTableModule, TranslatePipe],
  template: `
    @if (allowed()) {
      <nz-card [nzTitle]="'PLATFORM.ALERT_RULES' | translate">
        <p class="hint">{{ 'PLATFORM.ALERT_RULES_HINT' | translate }}</p>
        <nz-table [nzData]="rules()" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'PLATFORM.RULE_NAME' | translate }}</th>
              <th>{{ 'PLATFORM.METRIC' | translate }}</th>
              <th>{{ 'PLATFORM.THRESHOLD' | translate }}</th>
              <th>{{ 'PLATFORM.ACTIVE' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (rule of rules(); track rule.id) {
              <tr>
                <td>{{ rule.name }}</td>
                <td>{{ 'PLATFORM.METRIC_' + rule.metric.toUpperCase() | translate }}</td>
                <td>{{ rule.threshold }} {{ rule.currency }}</td>
                <td><nz-switch [ngModel]="rule.is_active" (ngModelChange)="toggle(rule, $event)" [attr.aria-label]="rule.name"></nz-switch></td>
                <td>
                  <button nz-button nzDanger nzSize="small" type="button" (click)="remove(rule)">{{ 'PLATFORM.DELETE' | translate }}</button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        <form class="new" (ngSubmit)="add()">
          <input name="name" [(ngModel)]="name" required [placeholder]="'PLATFORM.RULE_NAME' | translate" />
          <select name="metric" [(ngModel)]="metric">
            @for (m of metrics(); track m) {
              <option [value]="m">{{ 'PLATFORM.METRIC_' + m.toUpperCase() | translate }}</option>
            }
          </select>
          <input name="threshold" type="number" min="0" step="0.01" [(ngModel)]="threshold" required [placeholder]="'PLATFORM.THRESHOLD' | translate" />
          <input name="currency" maxlength="3" [(ngModel)]="currency" [placeholder]="'PLATFORM.CURRENCY' | translate" />
          <button nz-button nzType="primary" type="submit">{{ 'PLATFORM.ADD_RULE' | translate }}</button>
        </form>
      </nz-card>
    }
  `,
  styles: `
    .hint {
      color: var(--text-secondary);
    }
    .new {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }
  `,
})
export class AlertRulesComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly rules = signal<NotificationAlertRule[]>([]);
  readonly metrics = signal<string[]>([]);
  readonly allowed = signal(false);

  name = '';
  metric = 'customer_overdue_total';
  threshold: number | null = null;
  currency = 'CHF';

  ngOnInit(): void {
    this.reload();
  }

  add(): void {
    if (!this.name.trim() || this.threshold === null) {
      return;
    }
    this.api
      .createAlertRule({
        name: this.name.trim(),
        metric: this.metric,
        threshold: this.threshold,
        currency: this.currency.trim().toUpperCase() || null,
        category: 'billing',
        is_active: true,
      })
      .subscribe(() => {
        this.name = '';
        this.threshold = null;
        this.message.success(this.translate.instant('PLATFORM.SAVED'));
        this.reload();
      });
  }

  toggle(rule: NotificationAlertRule, active: boolean): void {
    this.api
      .updateAlertRule(rule.id, {
        name: rule.name,
        metric: rule.metric,
        threshold: Number(rule.threshold),
        currency: rule.currency,
        category: rule.category,
        is_active: active,
      })
      .subscribe(() => this.reload());
  }

  remove(rule: NotificationAlertRule): void {
    this.api.deleteAlertRule(rule.id).subscribe(() => this.reload());
  }

  private reload(): void {
    this.api.getAlertRules().subscribe({
      next: (res) => {
        this.rules.set(res.data);
        this.metrics.set(res.metrics);
        this.allowed.set(true);
      },
      // 403 for members without access to the platform module: the card simply stays hidden.
      error: () => this.allowed.set(false),
    });
  }
}
