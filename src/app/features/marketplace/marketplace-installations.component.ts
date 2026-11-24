import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  MARKETPLACE_INSTALLATION_STATUSES,
  MarketplaceApiService,
  MarketplaceInstallation,
  MarketplaceInstallationStatus,
  TranslateService,
} from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, HEALTH_COLORS, INSTALLATION_STATUS_COLORS } from './marketplace.util';

/** The installations of the company with their status and health, and the lifecycle actions of each. */
@Component({
  selector: 'app-marketplace-installations',
  styleUrl: './marketplace.scss',
  imports: [FormsModule, RouterLink, IconActionDirective, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzPopconfirmModule, NzSelectModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'MARKETPLACE.INSTALLATIONS_TITLE' | translate" [subtitle]="'MARKETPLACE.INSTALLATIONS_SUBTITLE' | translate">
      <a nz-button routerLink="/marketplace">{{ 'MARKETPLACE.CATALOG' | translate }}</a>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 240px" nzAllowClear [nzPlaceHolder]="'MARKETPLACE.STATUS' | translate" [ngModel]="status()" (ngModelChange)="status.set($event); load()" [attr.aria-label]="'MARKETPLACE.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('MARKETPLACE.STATUS_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="installations()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'MARKETPLACE.NAME' | translate }}</th>
            <th>{{ 'MARKETPLACE.CONNECTOR' | translate }}</th>
            <th>{{ 'MARKETPLACE.STATUS' | translate }}</th>
            <th>{{ 'MARKETPLACE.HEALTH' | translate }}</th>
            <th>{{ 'MARKETPLACE.LAST_SYNC' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/marketplace/installations', row.id]">{{ row.name }}</a></td>
              <td>
                {{ row.connector_name ?? row.connector_key }} <span class="muted">{{ row.connector_version }}</span>
                @if (row.update_available) {
                  <nz-tag nzColor="gold">{{ 'MARKETPLACE.UPDATE_AVAILABLE' | translate }}</nz-tag>
                }
              </td>
              <td><nz-tag [nzColor]="statusColor(row.status)">{{ ('MARKETPLACE.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td><nz-tag [nzColor]="healthColor(row.health.status)">{{ ('MARKETPLACE.HEALTH_' + row.health.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>{{ row.last_sync_at ?? '' }}</td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'enabled') {
                    <button nz-button nzType="link" type="button" (click)="disable(row)">{{ 'MARKETPLACE.DISABLE' | translate }}</button>
                  } @else if (row.status === 'disabled') {
                    <button nz-button nzType="link" type="button" (click)="enable(row)">{{ 'MARKETPLACE.ENABLE' | translate }}</button>
                  }
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'MARKETPLACE.UNINSTALL_CONFIRM' | translate" (nzOnConfirm)="uninstall(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && installations().length === 0) {
        <nz-empty [nzNotFoundContent]="'MARKETPLACE.NO_INSTALLATIONS' | translate"></nz-empty>
      }
    </nz-card>
  `,
})
export class MarketplaceInstallationsComponent implements OnInit {
  private readonly api = inject(MarketplaceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly statuses = MARKETPLACE_INSTALLATION_STATUSES;
  readonly installations = signal<MarketplaceInstallation[]>([]);
  readonly loading = signal(false);
  readonly status = signal<MarketplaceInstallationStatus | null>(null);

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: string): string {
    return INSTALLATION_STATUS_COLORS[status] ?? 'default';
  }

  healthColor(status: string): string {
    return HEALTH_COLORS[status] ?? 'default';
  }

  load(): void {
    this.loading.set(true);
    this.api.getInstallations({ status: this.status() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.installations.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('MARKETPLACE.ACTION_ERROR'));
      },
    });
  }

  enable(installation: MarketplaceInstallation): void {
    this.api.enable(installation.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('MARKETPLACE.ENABLED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR')),
    });
  }

  disable(installation: MarketplaceInstallation): void {
    this.api.disable(installation.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('MARKETPLACE.DISABLED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR')),
    });
  }

  uninstall(installation: MarketplaceInstallation): void {
    this.api.uninstall(installation.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('MARKETPLACE.UNINSTALLED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR')),
    });
  }
}
