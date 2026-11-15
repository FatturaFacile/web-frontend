import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  MarketplaceApiService,
  MarketplaceConfigField,
  MarketplaceConnector,
  MarketplaceHealthCheck,
  MarketplaceInstallation,
  MarketplaceSyncRun,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, HEALTH_COLORS, INSTALLATION_STATUS_COLORS, RUN_STATUS_COLORS } from './marketplace.util';

type FieldValue = string | number | boolean;

/**
 * One installation: the configuration form generated from the schema of its connector (secrets are write-only and never
 * shown again), the lifecycle (enable, disable, upgrade, uninstall), health checks and the sync runs with their log.
 */
@Component({
  selector: 'app-marketplace-installation',
  styleUrl: './marketplace.scss',
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (installation(); as current) {
      <app-page-header [title]="current.name" [subtitle]="current.connector_name ?? current.connector_key">
        <a nz-button routerLink="/marketplace/installations">{{ 'MARKETPLACE.BACK' | translate }}</a>
      </app-page-header>

      <div class="toolbar">
        <nz-tag [nzColor]="statusColor(current.status)">{{ ('MARKETPLACE.STATUS_' + current.status.toUpperCase()) | translate }}</nz-tag>
        <nz-tag [nzColor]="healthColor(current.health.status)">{{ ('MARKETPLACE.HEALTH_' + current.health.status.toUpperCase()) | translate }}</nz-tag>
        <span class="muted">{{ current.connector_version }}</span>
        <span class="spacer"></span>
        @if (current.update_available) {
          <button nz-button (click)="upgrade()">{{ 'MARKETPLACE.UPGRADE_TO' | translate: { version: current.latest_version ?? '' } }}</button>
        }
        @if (current.status === 'enabled') {
          <button nz-button (click)="disable()">{{ 'MARKETPLACE.DISABLE' | translate }}</button>
        } @else if (current.status === 'disabled') {
          <button nz-button nzType="primary" (click)="enable()">{{ 'MARKETPLACE.ENABLE' | translate }}</button>
        }
        <button nz-button nzDanger nz-popconfirm [nzPopconfirmTitle]="'MARKETPLACE.UNINSTALL_CONFIRM' | translate" (nzOnConfirm)="uninstall()">{{ 'MARKETPLACE.UNINSTALL' | translate }}</button>
      </div>

      @if (current.health.message) {
        <p class="muted">{{ current.health.message }}</p>
      }

      <nz-card class="main-card" [nzTitle]="'MARKETPLACE.CONFIGURATION' | translate">
        <div class="form-row">
          @for (field of fields(); track field.key) {
            <div>
              <label [for]="'config-' + field.key" class="field-label">{{ field.label }}@if (field.required) { * }</label>
              @switch (field.type) {
                @case ('select') {
                  <nz-select [id]="'config-' + field.key" style="width: 100%" [ngModel]="values()[field.key] ?? null" (ngModelChange)="setValue(field.key, $event)">
                    @for (option of field.options; track option) {
                      <nz-option [nzValue]="option" [nzLabel]="option"></nz-option>
                    }
                  </nz-select>
                }
                @case ('boolean') {
                  <nz-switch [ngModel]="values()[field.key] === true" (ngModelChange)="setValue(field.key, $event)"></nz-switch>
                }
                @case ('number') {
                  <nz-input-number [id]="'config-' + field.key" style="width: 100%" [ngModel]="asNumber(values()[field.key])" (ngModelChange)="setValue(field.key, $event)"></nz-input-number>
                }
                @case ('secret') {
                  <input nz-input type="password" autocomplete="off" [id]="'config-' + field.key" [ngModel]="values()[field.key] ?? ''" (ngModelChange)="setValue(field.key, $event)" [placeholder]="isSet(field) ? ('MARKETPLACE.SECRET_SET' | translate) : ''" />
                }
                @default {
                  <input nz-input [id]="'config-' + field.key" [type]="field.type === 'url' ? 'url' : 'text'" [ngModel]="values()[field.key] ?? ''" (ngModelChange)="setValue(field.key, $event)" />
                }
              }
              @if (field.help) {
                <small class="muted">{{ field.help }}</small>
              }
            </div>
          }
          <div>
            <label for="config-rate-limit" class="field-label">{{ 'MARKETPLACE.RATE_LIMIT' | translate }}</label>
            <nz-input-number id="config-rate-limit" style="width: 100%" [nzMin]="1" [nzMax]="connector()?.max_rate_limit_per_minute ?? 10000" [ngModel]="rateLimit()" (ngModelChange)="rateLimit.set($event)"></nz-input-number>
            <small class="muted">{{ 'MARKETPLACE.RATE_LIMIT_HELP' | translate: { default: connector()?.rate_limit_per_minute ?? 0, max: connector()?.max_rate_limit_per_minute ?? 0 } }}</small>
          </div>
        </div>
        <p class="muted field-label">{{ 'MARKETPLACE.SCOPES_GRANTED' | translate }}: {{ current.granted_scopes.join(', ') }}</p>
        <button nz-button nzType="primary" [disabled]="saving()" (click)="saveConfiguration()">{{ 'MARKETPLACE.SAVE_CONFIGURATION' | translate }}</button>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'MARKETPLACE.HEALTH' | translate" [nzExtra]="checkAction">
        <ng-template #checkAction>
          <button nz-button type="button" (click)="checkHealth()" [disabled]="current.status === 'pending_configuration'">{{ 'MARKETPLACE.CHECK_NOW' | translate }}</button>
        </ng-template>
        <nz-table #healthTable [nzData]="healthChecks()" nzSize="small" [nzPageSize]="5">
          <thead>
            <tr>
              <th>{{ 'MARKETPLACE.CHECKED_AT' | translate }}</th>
              <th>{{ 'MARKETPLACE.HEALTH' | translate }}</th>
              <th class="num">{{ 'MARKETPLACE.LATENCY_MS' | translate }}</th>
              <th>{{ 'MARKETPLACE.MESSAGE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of healthTable.data; track row.id) {
              <tr>
                <td>{{ row.checked_at }}</td>
                <td><nz-tag [nzColor]="healthColor(row.status)">{{ ('MARKETPLACE.HEALTH_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
                <td class="num">{{ row.latency_ms ?? '' }}</td>
                <td>{{ row.message ?? '' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'MARKETPLACE.SYNC_RUNS' | translate">
        <div class="toolbar">
          <nz-select style="width: 240px" [ngModel]="resource()" (ngModelChange)="resource.set($event)" [nzPlaceHolder]="'MARKETPLACE.RESOURCE' | translate" [attr.aria-label]="'MARKETPLACE.RESOURCE' | translate">
            @for (name of connector()?.resources ?? []; track name) {
              <nz-option [nzValue]="name" [nzLabel]="name"></nz-option>
            }
          </nz-select>
          <button nz-button nzType="primary" [disabled]="current.status !== 'enabled' || !resource() || syncing()" (click)="runSync()">{{ 'MARKETPLACE.RUN_SYNC' | translate }}</button>
          <span class="muted">{{ 'MARKETPLACE.EFFECTIVE_RATE_LIMIT' | translate: { count: current.effective_rate_limit_per_minute ?? 0 } }}</span>
        </div>
        <nz-table #runTable [nzData]="runs()" nzSize="small" [nzPageSize]="10">
          <thead>
            <tr>
              <th>{{ 'MARKETPLACE.STARTED_AT' | translate }}</th>
              <th>{{ 'MARKETPLACE.RESOURCE' | translate }}</th>
              <th>{{ 'MARKETPLACE.STATUS' | translate }}</th>
              <th class="num">{{ 'MARKETPLACE.RECORDS' | translate }}</th>
              <th>{{ 'MARKETPLACE.MESSAGE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of runTable.data; track row.id) {
              <tr>
                <td>{{ row.started_at }}</td>
                <td>{{ row.resource }}</td>
                <td><nz-tag [nzColor]="runColor(row.status)">{{ ('MARKETPLACE.RUN_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
                <td class="num">{{ row.records_processed }}@if (row.records_failed > 0) { / {{ row.records_failed }} }</td>
                <td>{{ row.message ?? '' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (runs().length === 0) {
          <nz-empty [nzNotFoundContent]="'MARKETPLACE.NO_RUNS' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class MarketplaceInstallationComponent implements OnInit {
  private readonly api = inject(MarketplaceApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly installation = signal<MarketplaceInstallation | null>(null);
  readonly connector = signal<MarketplaceConnector | null>(null);
  readonly healthChecks = signal<MarketplaceHealthCheck[]>([]);
  readonly runs = signal<MarketplaceSyncRun[]>([]);
  readonly values = signal<Record<string, FieldValue>>({});
  readonly rateLimit = signal<number | null>(null);
  readonly resource = signal<string | null>(null);
  readonly saving = signal(false);
  readonly syncing = signal(false);

  readonly fields = computed(() => this.connector()?.config_schema ?? []);

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: string): string {
    return INSTALLATION_STATUS_COLORS[status] ?? 'default';
  }

  healthColor(status: string): string {
    return HEALTH_COLORS[status] ?? 'default';
  }

  runColor(status: string): string {
    return RUN_STATUS_COLORS[status] ?? 'default';
  }

  isSet(field: MarketplaceConfigField): boolean {
    return this.installation()?.credentials_set.includes(field.key) ?? false;
  }

  asNumber(value: FieldValue | undefined): number | null {
    return typeof value === 'number' ? value : null;
  }

  setValue(key: string, value: FieldValue | null): void {
    this.values.update((current) => {
      const next = { ...current };
      if (value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.api.getInstallation(id).subscribe({
      next: (response) => {
        this.apply(response.data);
        this.api.getConnector(response.data.connector_key).subscribe({ next: (connector) => this.connector.set(connector.data), error: () => this.connector.set(null) });
        this.loadActivity(id);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR')),
    });
  }

  /**
   * Saves the configuration. Secret fields are only sent when something was typed: a secret left blank keeps its stored
   * value, and the stored value is never sent back to the screen.
   */
  saveConfiguration(): void {
    const installation = this.installation();
    if (!installation) {
      return;
    }

    const secrets = new Set((this.connector()?.config_schema ?? []).filter((field) => field.type === 'secret').map((field) => field.key));
    const config: Record<string, FieldValue> = {};
    for (const [key, value] of Object.entries(this.values())) {
      if (!secrets.has(key) || (typeof value === 'string' && value !== '')) {
        config[key] = value;
      }
    }

    this.saving.set(true);
    this.api.configure(installation.id, { config, rate_limit_per_minute: this.rateLimit() }).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.apply(response.data);
        this.message.success(this.translate.instant('MARKETPLACE.CONFIGURATION_SAVED'));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR'));
      },
    });
  }

  enable(): void {
    this.lifecycle((id) => this.api.enable(id), 'MARKETPLACE.ENABLED');
  }

  disable(): void {
    this.lifecycle((id) => this.api.disable(id), 'MARKETPLACE.DISABLED');
  }

  upgrade(): void {
    this.lifecycle((id) => this.api.upgrade(id, this.connector()?.required_scopes ?? []), 'MARKETPLACE.UPGRADED');
  }

  uninstall(): void {
    const installation = this.installation();
    if (!installation) {
      return;
    }

    this.api.uninstall(installation.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('MARKETPLACE.UNINSTALLED'));
        void this.router.navigate(['/marketplace/installations']);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR')),
    });
  }

  checkHealth(): void {
    const installation = this.installation();
    if (!installation) {
      return;
    }

    this.api.runHealthCheck(installation.id).subscribe({
      next: () => this.reloadInstallation(installation.id),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR')),
    });
  }

  runSync(): void {
    const installation = this.installation();
    const resource = this.resource();
    if (!installation || !resource) {
      return;
    }

    this.syncing.set(true);
    this.api.runSync(installation.id, resource).subscribe({
      next: (response) => {
        this.syncing.set(false);
        const text = response.data.message ?? this.translate.instant('MARKETPLACE.SYNC_DONE');
        if (response.data.status === 'succeeded') {
          this.message.success(text);
        } else {
          this.message.warning(text);
        }
        this.reloadInstallation(installation.id);
      },
      error: (error: unknown) => {
        this.syncing.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR'));
        this.loadActivity(installation.id);
      },
    });
  }

  private lifecycle(call: (id: string) => ReturnType<MarketplaceApiService['enable']>, successKey: string): void {
    const installation = this.installation();
    if (!installation) {
      return;
    }

    call(installation.id).subscribe({
      next: (response) => {
        this.apply(response.data);
        this.loadActivity(installation.id);
        this.message.success(this.translate.instant(successKey));
      },
      error: (error: unknown) => {
        this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR'));
        this.reloadInstallation(installation.id);
      },
    });
  }

  private reloadInstallation(id: string): void {
    this.api.getInstallation(id).subscribe({ next: (response) => this.apply(response.data) });
    this.loadActivity(id);
  }

  private apply(installation: MarketplaceInstallation): void {
    this.installation.set(installation);
    this.values.set({ ...installation.settings });
    this.rateLimit.set(installation.rate_limit_per_minute);
  }

  private loadActivity(id: string): void {
    this.api.getHealthChecks(id).subscribe({ next: (response) => this.healthChecks.set(response.data), error: () => this.healthChecks.set([]) });
    this.api.getInstallationRuns(id).subscribe({ next: (response) => this.runs.set(response.data), error: () => this.runs.set([]) });
  }
}
