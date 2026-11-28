import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CrisisJurisdiction, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CmDscrPanelComponent } from './cm-dscr-panel.component';
import { CmItalyPanelComponent } from './cm-italy-panel.component';
import { CmProfileDrawerComponent } from './cm-profile-drawer.component';
import { CmStressTestComponent } from './cm-stress-test.component';
import { CmSwissPanelComponent } from './cm-swiss-panel.component';
import { CrisisMonitoringStore } from './crisis-monitoring.store';
import { CRISIS_JURISDICTIONS, CRISIS_MODULE } from './crisis-monitoring.util';

/** Corporate crisis monitoring workspace (Mod 357): executive dashboard, CCII / Art. 725 CO panels, stress test and profile. */
@Component({
  selector: 'app-crisis-monitoring',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    CmDscrPanelComponent,
    CmItalyPanelComponent,
    CmProfileDrawerComponent,
    CmStressTestComponent,
    CmSwissPanelComponent,
    NzAlertModule,
    NzButtonModule,
    NzSegmentedModule,
    NzSpinModule,
    NzTabsModule,
  ],
  styleUrl: './crisis-monitoring.scss',
  template: `
    <app-page-header
      [title]="'crisis.title' | translate"
      [subtitle]="'crisis.subtitle' | translate"
    />

    <div class="cm-toolbar">
      <nz-segmented
        [nzOptions]="jurisdictionOptions()"
        [ngModel]="store.view()"
        (ngModelChange)="store.setJurisdictionView($event)"
        data-testid="cm-jurisdiction"
      />
      <span class="cm-toolbar-spacer"></span>
      <button
        nz-button
        [nzLoading]="store.loading()"
        data-testid="cm-refresh"
        (click)="store.refresh()"
      >
        {{ 'crisis.refresh' | translate }}
      </button>
      @if (canWrite) {
        <button
          nz-button
          [nzLoading]="store.computing()"
          data-testid="cm-compute"
          (click)="compute()"
        >
          {{ 'crisis.compute' | translate }}
        </button>
        <button nz-button data-testid="cm-open-profile" (click)="profileOpen.set(true)">
          {{ 'crisis.profile.open' | translate }}
        </button>
      }
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.error(); as error) {
        <nz-alert
          class="cm-banner"
          nzType="error"
          nzShowIcon
          [nzMessage]="error | translate"
          data-testid="cm-error"
        />
      }

      @if (store.dashboard(); as dashboard) {
        <nz-alert
          class="cm-banner"
          role="status"
          nzShowIcon
          [nzType]="alertType()"
          [nzMessage]="'crisis.overall.' + dashboard.overall_status | translate"
          [nzDescription]="'crisis.asOf' | translate: { date: dashboard.as_of }"
          data-testid="cm-overall"
        />
      }

      <nz-tabs [nzSelectedIndex]="tab()" (nzSelectedIndexChange)="tab.set($event)">
        <nz-tab [nzTitle]="'crisis.tab.dashboard' | translate">
          <app-cm-dscr-panel />
        </nz-tab>
        <nz-tab [nzTitle]="'crisis.tab.compliance' | translate">
          @if (store.view() === 'IT') {
            <app-cm-italy-panel />
          } @else {
            <app-cm-swiss-panel [canWrite]="canWrite" />
          }
        </nz-tab>
        <nz-tab [nzTitle]="'crisis.tab.stress' | translate">
          <app-cm-stress-test />
        </nz-tab>
      </nz-tabs>
    </nz-spin>

    <app-cm-profile-drawer [(open)]="profileOpen" />
  `,
})
export class CrisisMonitoringComponent implements OnInit {
  protected readonly store = inject(CrisisMonitoringStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  protected readonly canWrite = inject(PermissionsService).canWrite(CRISIS_MODULE);

  protected readonly tab = signal(0);
  protected readonly profileOpen = signal(false);

  protected readonly jurisdictionOptions = computed(() =>
    CRISIS_JURISDICTIONS.map((value: CrisisJurisdiction) => ({
      value,
      label: this.i18n.translate('crisis.jurisdiction.' + value),
    })),
  );

  protected readonly alertType = computed<'success' | 'warning' | 'error'>(() => {
    const status = this.store.dashboard()?.overall_status;

    return status === 'red' ? 'error' : status === 'yellow' ? 'warning' : 'success';
  });

  ngOnInit(): void {
    void this.store.init();
  }

  protected async compute(): Promise<void> {
    const outcome = await this.store.compute();

    if (outcome.ok) {
      this.message.success(this.i18n.translate('crisis.computed'));
    } else {
      this.message.error(this.i18n.translate(outcome.error ?? 'crisis.error.generic'));
    }
  }
}
