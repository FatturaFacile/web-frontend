import { Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { I18nService, PermissionsService, SwissVatApiService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { downloadBlob } from '../accounting/tax/tax-report.utils';
import { SwissVatStore } from './swiss-vat.store';
import { canFinalizeOrExport, RETURN_STATUS_COLORS } from './swiss-vat.util';

/** Interactive AFC Box Reconciliation, Quadratura Diagnostics, XSD Validation & SuisseTax XML Export. */
@Component({
  selector: 'app-swiss-vat-reconciliation',
  imports: [
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'swissVat.title' | translate" [subtitle]="'swissVat.subtitle' | translate" />

    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <a nz-button routerLink="/swiss-vat/returns">← {{ 'swissVat.tab.returns' | translate }}</a>

      @if (store.selectedReturn(); as ret) {
        <div class="flex flex-wrap gap-2">
          <button nz-button type="button" data-testid="ch-validate-xsd-btn" [nzLoading]="store.saving()" (click)="validateXml()">
            {{ 'swissVat.action.validateXsd' | translate }}
          </button>
          @if (canWrite() && ret.status !== 'finalized' && ret.status !== 'submitted') {
            <button
              nz-button
              type="button"
              nz-popconfirm
              [nzPopconfirmTitle]="'swissVat.action.finalize' | translate"
              [disabled]="!canFinalize()"
              [nzLoading]="store.saving()"
              (nzOnConfirm)="finalize()"
            >
              {{ 'swissVat.action.finalize' | translate }}
            </button>
          }
          @if (canWrite()) {
            <button
              nz-button
              nzType="primary"
              type="button"
              data-testid="ch-export-xml-btn"
              [disabled]="!canFinalize()"
              [nzLoading]="store.saving()"
              (click)="exportXml()"
            >
              {{ 'swissVat.action.exportXml' | translate }}
            </button>
          }
        </div>
      }
    </div>

    @if (store.reconciliation(); as recon) {
      <nz-alert
        class="mb-4"
        nzShowIcon
        [nzType]="recon.quadratura_passed ? 'success' : 'error'"
        [nzMessage]="(recon.quadratura_passed ? 'swissVat.quadratura.passed' : 'swissVat.quadratura.failed') | translate"
      />

      @if (store.xmlValidation(); as val) {
        <nz-alert
          class="mb-4"
          nzShowIcon
          [nzType]="val.valid ? 'success' : 'error'"
          [nzMessage]="(val.valid ? 'swissVat.xsd.valid' : 'swissVat.xsd.invalid') | translate"
          [nzDescription]="val.errors.join(' | ')"
        />
      }

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <nz-card [nzTitle]="'NAV.SWISS_VAT_RETURNS' | translate">
          <nz-table #boxTable [nzData]="recon.box_schedule" [nzFrontPagination]="false">
            <thead>
              <tr>
                <th>{{ 'swissVat.field.afcBox' | translate }}</th>
                <th>Description</th>
                <th>Base</th>
                <th>Rate %</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (box of boxTable.data; track box.code) {
                <tr>
                  <td>
                    <nz-tag nzColor="blue">{{ box.code }}</nz-tag>
                    @if (box.epoch_box_alias) {
                      <span class="text-xs opacity-60">({{ box.epoch_box_alias }})</span>
                    }
                  </td>
                  <td>{{ box.label }}</td>
                  <td>{{ box.base_amount !== null ? (box.base_amount | money: 'CHF') : '—' }}</td>
                  <td>{{ box.rate_percent !== null ? box.rate_percent + '%' : '—' }}</td>
                  <td><strong>{{ box.amount | money: 'CHF' }}</strong></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        <div class="flex flex-col gap-4">
          <nz-card [nzTitle]="'swissVat.quadratura.title' | translate">
            <nz-table #qTable [nzData]="recon.quadratura_report.checks" [nzFrontPagination]="false">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Expected / Actual</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                @for (chk of qTable.data; track chk.code) {
                  <tr>
                    <td>
                      <strong>{{ chk.code }}</strong>
                      <div class="text-xs opacity-75">{{ chk.message }}</div>
                    </td>
                    <td>
                      <nz-tag [nzColor]="chk.passed ? 'green' : chk.severity === 'blocker' ? 'red' : 'gold'">
                        {{ chk.passed ? 'PASS' : chk.severity.toUpperCase() }}
                      </nz-tag>
                    </td>
                    <td>{{ chk.expected }} / {{ chk.actual }}</td>
                    <td>{{ chk.difference }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>

          <nz-card [nzTitle]="'swissVat.exports.history' | translate">
            <nz-table #expTable [nzData]="store.exports()" [nzFrontPagination]="false">
              <thead>
                <tr>
                  <th>File</th>
                  <th>XSD</th>
                  <th>Exported</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                @for (exp of expTable.data; track exp.id) {
                  <tr>
                    <td>
                      <strong>{{ exp.file_name }}</strong>
                      <div class="text-xs opacity-60">{{ exp.sha256_checksum.slice(0, 12) }}…</div>
                    </td>
                    <td>
                      <nz-tag [nzColor]="exp.xsd_valid && exp.quadratura_passed ? 'green' : 'red'">
                        {{ exp.xsd_valid ? 'XSD OK' : 'INVALID' }}
                      </nz-tag>
                    </td>
                    <td>{{ exp.exported_at }}</td>
                    <td>
                      <button nz-button nzSize="small" type="button" (click)="download(exp.id, exp.file_name)">
                        {{ 'swissVat.action.downloadXml' | translate }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        </div>
      </div>
    }
  `,
})
export class SwissVatReconciliationComponent implements OnInit {
  readonly store = inject(SwissVatStore);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(SwissVatApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  readonly statusColors = RETURN_STATUS_COLORS;
  readonly canWrite = computed(() => this.permissions.hasAccess('swiss_vat', 'write'));
  readonly canFinalize = computed(() => canFinalizeOrExport(this.store.reconciliation()?.quadratura_report));

  private returnId = '';

  async ngOnInit(): Promise<void> {
    this.returnId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.returnId) {
      await this.store.loadReconciliationWorkspace(this.returnId);
    }
  }

  async validateXml(): Promise<void> {
    const res = await this.store.validateXml(this.returnId);
    if (res.valid) {
      this.message.success(this.i18n.translate('swissVat.xsd.valid'));
    } else {
      this.message.error(this.i18n.translate('swissVat.xsd.invalid'));
    }
  }

  async finalize(): Promise<void> {
    await this.store.finalizeReturn(this.returnId);
    this.message.success(this.i18n.translate('swissVat.status.finalized'));
  }

  async exportXml(): Promise<void> {
    const exp = await this.store.exportXml(this.returnId);
    await this.download(exp.id, exp.file_name);
  }

  async download(exportId: string, fileName: string): Promise<void> {
    const blob = await firstValueFrom(this.api.downloadExportXml(exportId));
    downloadBlob(blob, fileName);
  }
}
