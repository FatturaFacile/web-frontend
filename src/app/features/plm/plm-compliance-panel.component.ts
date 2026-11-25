import { Component, inject, input, OnChanges, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PlmApiService, PlmRegulatoryComplianceResult, TranslateService } from '@core';
import { TranslatePipe } from '@shared';

/**
 * CE / UKCA / Swiss OMacch Technical Construction Dossier & RoHS/REACH/Conflict Minerals + ISO Audit Readiness panel.
 */
@Component({
  selector: 'app-plm-compliance-panel',
  imports: [TranslatePipe, NzButtonModule, NzCardModule, NzDescriptionsModule, NzTableModule, NzTagModule],
  template: `
    <nz-card [nzTitle]="'PLM.COMPLIANCE_TITLE' | translate">
      <div style="margin-bottom: 12px">
        <button nz-button nzType="primary" type="button" [nzLoading]="loading()" (click)="evaluate()">
          {{ 'PLM.EVALUATE_COMPLIANCE' | translate }}
        </button>
      </div>

      @if (compliance(); as result) {
        <nz-descriptions nzSize="small" [nzColumn]="2" style="margin-bottom: 16px">
          <nz-descriptions-item [nzTitle]="'PLM.ROHS_REACH' | translate">
            <nz-tag [nzColor]="result.rohs_compliant && result.reach_compliant ? 'green' : 'red'">
              {{ (result.rohs_compliant && result.reach_compliant ? 'PLM.COMPLIANT' : 'PLM.NON_COMPLIANT') | translate }}
            </nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PLM.CONFLICT_MINERALS' | translate">
            <nz-tag [nzColor]="result.conflict_minerals_compliant ? 'green' : 'red'">
              {{ (result.conflict_minerals_compliant ? 'PLM.COMPLIANT' : 'PLM.NON_COMPLIANT') | translate }}
            </nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PLM.OMACCH_MRA' | translate">
            <nz-tag [nzColor]="result.omacch_mra_ch_eu_compliant ? 'green' : 'red'">
              {{ (result.omacch_mra_ch_eu_compliant ? 'PLM.COMPLIANT' : 'PLM.NON_COMPLIANT') | translate }}
            </nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PLM.ISO_AUDIT_READINESS' | translate">
            @for (std of isoStandards(result); track std.standard) {
              <nz-tag [nzColor]="std.ready ? 'green' : 'orange'">{{ std.standard }}</nz-tag>
            }
          </nz-descriptions-item>
        </nz-descriptions>

        <nz-table [nzData]="result.checklist" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.CODE' | translate }}</th>
              <th>{{ 'PLM.CHANGE_REASON' | translate }}</th>
              <th>{{ 'PLM.STATUS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of result.checklist; track row.code) {
              <tr>
                <td>{{ row.code }}</td>
                <td>{{ row.regulation }}</td>
                <td>
                  <nz-tag [nzColor]="row.status === 'completed' ? 'green' : 'orange'">{{ row.status }}</nz-tag>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>
  `,
})
export class PlmCompliancePanelComponent implements OnChanges {
  readonly revisionId = input.required<string>();

  private readonly api = inject(PlmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly compliance = signal<PlmRegulatoryComplianceResult | null>(null);

  ngOnChanges(): void {
    if (this.revisionId()) {
      this.evaluate();
    }
  }

  evaluate(): void {
    this.loading.set(true);
    this.api.getRevisionCompliance(this.revisionId()).subscribe({
      next: (res) => {
        this.compliance.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PLM.ACTION_ERROR'));
      },
    });
  }

  isoStandards(result: PlmRegulatoryComplianceResult): { standard: string; ready: boolean }[] {
    return Object.values(result.iso_audit_readiness ?? {});
  }
}
