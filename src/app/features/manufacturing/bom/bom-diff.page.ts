import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { BomDiffResult, EngineeringChangeResource, ManufacturingApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { BomDiffViewerComponent } from './bom-diff-viewer.component';

/**
 * Page of the revision diff. `?eco=<id>` shows the `diff_payload` of an engineering change; `?a=<bomId>&b=<bomId>` compares two
 * BOMs.
 */
@Component({
  selector: 'app-bom-diff-page',
  imports: [PageHeaderComponent, TranslatePipe, BomDiffViewerComponent, NzAlertModule, NzCardModule, NzSpinModule],
  template: `
    <app-page-header
      [title]="'MFG_BOM.DIFF_TITLE' | translate"
      [subtitle]="'MFG_BOM.DIFF_SUBTITLE' | translate"
    ></app-page-header>

    @if (error()) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="'MFG_BOM.DIFF_LOAD_ERROR' | translate"></nz-alert>
    } @else if (!eco() && !diff() && !loading()) {
      <nz-alert nzType="info" nzShowIcon [nzMessage]="'MFG_BOM.DIFF_NO_SOURCE' | translate"></nz-alert>
    } @else {
      <nz-spin [nzSpinning]="loading()">
        <nz-card [nzTitle]="title()">
          <app-bom-diff-viewer [diff]="diff()"></app-bom-diff-viewer>
        </nz-card>
      </nz-spin>
    }
  `,
})
export class BomDiffPageComponent implements OnInit {
  private readonly api = inject(ManufacturingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly eco = signal<EngineeringChangeResource | null>(null);
  protected readonly diff = signal<BomDiffResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  protected title(): string {
    const eco = this.eco();

    return eco ? `${eco.eco_number ?? ''} ${eco.title ?? ''}`.trim() : this.i18n.instant('MFG_BOM.DIFF_TITLE');
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const ecoId = params.get('eco');
    const a = params.get('a');
    const b = params.get('b');

    if (ecoId) {
      this.loading.set(true);
      this.api
        .getEngineeringChange(ecoId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.eco.set(res.data);
            this.diff.set(res.data.diff_payload ?? null);
            this.loading.set(false);
          },
          error: () => this.fail(),
        });
    } else if (a && b) {
      this.loading.set(true);
      this.api
        .getBomDiff(a, b)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.diff.set(res.data);
            this.loading.set(false);
          },
          error: () => this.fail(),
        });
    }
  }

  private fail(): void {
    this.loading.set(false);
    this.error.set(true);
  }
}
