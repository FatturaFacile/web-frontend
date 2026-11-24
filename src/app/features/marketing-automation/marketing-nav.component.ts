import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { TranslatePipe } from '@shared';

export type MarketingTab =
  'dashboard' | 'segments' | 'campaigns' | 'designer' | 'journey' | 'consent';

interface MarketingTabLink {
  readonly tab: MarketingTab;
  readonly path: string;
  readonly label: string;
}

/** Navigation tabs shared by every view of the Marketing Automation hub (Mod 155). */
@Component({
  selector: 'app-marketing-nav',
  imports: [RouterLink, NzButtonModule, TranslatePipe],
  template: `
    <nav class="mb-4 flex flex-wrap gap-2" [attr.aria-label]="'marketing.nav.aria' | translate">
      @for (link of links; track link.tab) {
        <a
          nz-button
          [routerLink]="link.path"
          [nzType]="activeTab() === link.tab ? 'primary' : 'default'"
          [attr.aria-current]="activeTab() === link.tab ? 'page' : null"
        >
          {{ link.label | translate }}
        </a>
      }
    </nav>
  `,
})
export class MarketingNavComponent {
  readonly activeTab = input<MarketingTab>('dashboard');

  protected readonly links: readonly MarketingTabLink[] = [
    { tab: 'dashboard', path: '/marketing-automation/dashboard', label: 'marketing.tab.dashboard' },
    { tab: 'segments', path: '/marketing-automation/segments', label: 'marketing.tab.segments' },
    { tab: 'campaigns', path: '/marketing-automation/campaigns', label: 'marketing.tab.campaigns' },
    { tab: 'designer', path: '/marketing-automation/designer', label: 'marketing.tab.designer' },
    { tab: 'journey', path: '/marketing-automation/journey', label: 'marketing.tab.journey' },
    { tab: 'consent', path: '/marketing-automation/consent', label: 'marketing.tab.consent' },
  ];
}
