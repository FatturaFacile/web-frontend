import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BatchPanelComponent } from './batch-panel.component';
import { RabcConsoleStore } from './rabc-console.store';
import { ScanConsolePanelComponent } from './scan-console-panel.component';

/** UNI EN 14065 (RABC) hygienic certification and the RFID roll cage scan console. */
@Component({
  selector: 'app-ilr-rabc-console',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BatchPanelComponent, NzAlertModule, NzSpinModule, PageHeaderComponent, ScanConsolePanelComponent, TranslatePipe],
  providers: [RabcConsoleStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.INDUSTRIAL_LAUNDRY_RABC' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <app-ilr-scan-console-panel></app-ilr-scan-console-panel>
      <app-ilr-batch-panel></app-ilr-batch-panel>
    </nz-spin>
  `,
})
export class RabcConsoleComponent implements OnInit {
  protected readonly store = inject(RabcConsoleStore);

  ngOnInit(): void {
    void this.store.init();
  }
}
