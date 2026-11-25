import { Component, inject, OnInit } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { TranslatePipe } from '@shared';
import { DcOfficesComponent } from './dc-offices.component';
import { DcPoliciesComponent } from './dc-policies.component';
import { DcRatesComponent } from './dc-rates.component';
import { DcTemplatesComponent } from './dc-templates.component';
import { DcLookupsStore } from './lookups.store';
import { SettingsStore } from './settings.store';

/** Settings of the module: policies and levels, interest rates, notice templates and the enforcement offices. */
@Component({
  selector: 'app-dc-settings',
  imports: [
    TranslatePipe,
    DcOfficesComponent,
    DcPoliciesComponent,
    DcRatesComponent,
    DcTemplatesComponent,
    NzAlertModule,
    NzSpinModule,
    NzTabsModule,
  ],
  providers: [SettingsStore],
  styleUrl: './debt-collection.scss',
  template: `
    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate" />
    }
    <nz-spin [nzSpinning]="store.loading()">
      <nz-tabs nzSize="small">
        <nz-tab [nzTitle]="'debtCollection.settings.policies' | translate">
          <ng-template nz-tab>
            <app-dc-policies />
          </ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'debtCollection.settings.rates' | translate">
          <ng-template nz-tab>
            <app-dc-rates />
          </ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'debtCollection.settings.templates' | translate">
          <ng-template nz-tab>
            <app-dc-templates />
          </ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'debtCollection.settings.offices' | translate">
          <ng-template nz-tab>
            <app-dc-offices />
          </ng-template>
        </nz-tab>
      </nz-tabs>
    </nz-spin>
  `,
})
export class DcSettingsComponent implements OnInit {
  protected readonly store = inject(SettingsStore);
  private readonly lookups = inject(DcLookupsStore);

  ngOnInit(): void {
    void this.lookups.ensureLoaded();
    void this.store.load();
  }
}
