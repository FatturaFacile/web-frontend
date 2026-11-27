import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { ConnectorStatusStore } from './connector-status.store';

/**
 * Non-intrusive banner of the shell: shown while an institutional connector (SDI, ELM, VIES ...) is degraded, in maintenance or
 * unreachable. Dismissible (the dismissal lasts for the session and for this very situation), with a link to the status page.
 * Imports no barrel: the shell loads it before any route.
 */
@Component({
  selector: 'app-connector-status-banner',
  imports: [NzAlertModule, RouterLink, TranslatePipe],
  template: `
    @if (store.bannerVisible()) {
      <nz-alert
        class="connector-banner"
        role="status"
        nzBanner
        nzCloseable
        [nzType]="alertType()"
        [nzMessage]="message()"
        [nzDescription]="description"
        [nzCloseText]="'OBSERVABILITY.BANNER.DISMISS' | translate"
        (nzOnClose)="store.dismiss()"
      ></nz-alert>
      <ng-template #description>
        <a routerLink="/observability/connectors" data-test="banner-link">{{
          'OBSERVABILITY.BANNER.LINK' | translate
        }}</a>
      </ng-template>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class ConnectorStatusBannerComponent implements OnInit {
  protected readonly store = inject(ConnectorStatusStore);
  private readonly i18n = inject(I18nService);

  protected readonly alertType = computed<'error' | 'warning' | 'info'>(() => {
    switch (this.store.overall()) {
      case 'outage':
        return 'error';
      case 'maintenance':
        return 'info';
      default:
        return 'warning';
    }
  });

  protected readonly message = computed(() => {
    const names = this.store
      .affected()
      .map((connector) => this.i18n.translate(connector.name_code))
      .join(', ');
    return this.i18n.translate(`OBSERVABILITY.BANNER.MESSAGE_${this.store.overall().toUpperCase()}`, { connectors: names });
  });

  ngOnInit(): void {
    this.store.startPolling();
  }
}
