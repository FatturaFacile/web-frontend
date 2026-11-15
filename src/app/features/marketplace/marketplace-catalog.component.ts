import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  MARKETPLACE_CATEGORIES,
  MarketplaceApiService,
  MarketplaceCategory,
  MarketplaceConnector,
  MarketplaceOverview,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, HEALTH_COLORS } from './marketplace.util';

/** The connector catalog with the figures of the module (installations, unhealthy ones, updates) and the install form. */
@Component({
  selector: 'app-marketplace-catalog',
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
    NzModalModule,
    NzSelectModule,
    NzStatisticModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'MARKETPLACE.TITLE' | translate" [subtitle]="'MARKETPLACE.SUBTITLE' | translate"></app-page-header>

    @if (overview(); as stats) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'MARKETPLACE.INSTALLATIONS' | translate" [nzValue]="stats.installations"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'MARKETPLACE.STATUS_ENABLED' | translate" [nzValue]="stats.by_status.enabled"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'MARKETPLACE.STATUS_PENDING_CONFIGURATION' | translate" [nzValue]="stats.by_status.pending_configuration"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'MARKETPLACE.UPDATES_AVAILABLE' | translate" [nzValue]="stats.updates_available.length"></nz-statistic></nz-card>
      </div>
      @if (stats.unhealthy.length > 0) {
        <nz-card class="main-card" [nzTitle]="'MARKETPLACE.NEEDS_ATTENTION' | translate">
          @for (installation of stats.unhealthy; track installation.id) {
            <p>
              <nz-tag [nzColor]="healthColor(installation.health.status)">{{ ('MARKETPLACE.HEALTH_' + installation.health.status.toUpperCase()) | translate }}</nz-tag>
              <a [routerLink]="['/marketplace/installations', installation.id]">{{ installation.name }}</a>
              <span class="muted">{{ installation.health.message }}</span>
            </p>
          }
        </nz-card>
      }
    }

    <div class="toolbar">
      <nz-select style="width: 220px" nzAllowClear [nzPlaceHolder]="'MARKETPLACE.CATEGORY' | translate" [ngModel]="category()" (ngModelChange)="category.set($event); load()" [attr.aria-label]="'MARKETPLACE.CATEGORY' | translate">
        @for (value of categories; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('MARKETPLACE.CATEGORY_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <input nz-input style="width: 260px" [placeholder]="'MARKETPLACE.SEARCH' | translate" [attr.aria-label]="'MARKETPLACE.SEARCH' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" (keydown.enter)="load()" />
      <button nz-button (click)="load()">{{ 'MARKETPLACE.SEARCH' | translate }}</button>
      <span class="spacer"></span>
      <a nz-button routerLink="/marketplace/installations">{{ 'MARKETPLACE.MY_INSTALLATIONS' | translate }}</a>
    </div>

    <div class="catalog-grid">
      @for (connector of connectors(); track connector.key) {
        <nz-card [nzTitle]="connector.name" [nzExtra]="version" class="main-card">
          <ng-template #version><nz-tag>{{ connector.version }}</nz-tag></ng-template>
          <p>{{ connector.description }}</p>
          <p><nz-tag nzColor="blue">{{ ('MARKETPLACE.CATEGORY_' + connector.category.toUpperCase()) | translate }}</nz-tag>
            @if (connector.installations > 0) {
              <nz-tag nzColor="green">{{ 'MARKETPLACE.INSTALLED_COUNT' | translate: { count: connector.installations } }}</nz-tag>
            }
          </p>
          <p class="muted">{{ 'MARKETPLACE.REQUIRES' | translate }}: {{ connector.required_scopes.join(', ') }}</p>
          <button nz-button nzType="primary" (click)="openInstall(connector)">{{ 'MARKETPLACE.INSTALL' | translate }}</button>
        </nz-card>
      }
    </div>
    @if (connectors().length === 0) {
      <nz-empty [nzNotFoundContent]="'MARKETPLACE.NO_CONNECTORS' | translate"></nz-empty>
    }

    <nz-modal [(nzVisible)]="installVisible" [nzTitle]="'MARKETPLACE.INSTALL_TITLE' | translate: { name: selected()?.name ?? '' }" (nzOnCancel)="installVisible.set(false)" (nzOnOk)="install()" [nzOkDisabled]="name().trim() === ''">
      <ng-container *nzModalContent>
        <label for="install-name">{{ 'MARKETPLACE.INSTALLATION_NAME' | translate }}</label>
        <input nz-input id="install-name" maxlength="120" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        <p class="field-label">{{ 'MARKETPLACE.SCOPES_GRANTED' | translate }}</p>
        @for (scope of selected()?.required_scopes ?? []; track scope) {
          <nz-tag>{{ scope }}</nz-tag>
        }
        <p class="muted field-label">{{ 'MARKETPLACE.SCOPES_HELP' | translate }}</p>
      </ng-container>
    </nz-modal>
  `,
})
export class MarketplaceCatalogComponent implements OnInit {
  private readonly api = inject(MarketplaceApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly categories = MARKETPLACE_CATEGORIES;
  readonly connectors = signal<MarketplaceConnector[]>([]);
  readonly overview = signal<MarketplaceOverview | null>(null);
  readonly category = signal<MarketplaceCategory | null>(null);
  readonly search = signal('');
  readonly installVisible = signal(false);
  readonly selected = signal<MarketplaceConnector | null>(null);
  readonly name = signal('');

  ngOnInit(): void {
    this.load();
    this.api.getOverview().subscribe({ next: (response) => this.overview.set(response.data), error: () => this.overview.set(null) });
  }

  healthColor(status: string): string {
    return HEALTH_COLORS[status] ?? 'default';
  }

  load(): void {
    this.api.getConnectors({ category: this.category() ?? undefined, search: this.search().trim() || undefined }).subscribe({
      next: (response) => this.connectors.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR')),
    });
  }

  openInstall(connector: MarketplaceConnector): void {
    this.selected.set(connector);
    this.name.set(connector.name);
    this.installVisible.set(true);
  }

  install(): void {
    const connector = this.selected();
    if (!connector) {
      return;
    }

    this.api.install({ connector_key: connector.key, name: this.name().trim(), granted_scopes: connector.required_scopes }).subscribe({
      next: (response) => {
        this.installVisible.set(false);
        this.message.success(this.translate.instant('MARKETPLACE.INSTALLED'));
        void this.router.navigate(['/marketplace/installations', response.data.id]);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR')),
    });
  }
}
