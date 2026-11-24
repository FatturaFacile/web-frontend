import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { downloadBlob, PageHeaderComponent, TranslatePipe } from '@shared';
import { selectableYears } from './agent-commissions.util';
import { ExportFile, ExportsStore } from './exports.store';

/**
 * Compliance exports (Mod 041): the commissions settled in a year for the Certificazione Unica, and the Enasarco payment
 * trace of a year or of one quarter. Both are CSV files downloaded with the credentials of the session.
 */
@Component({
  selector: 'app-exports',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSelectModule,
  ],
  providers: [ExportsStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.AGENT_COMMISSIONS_EXPORTS' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <div class="cards">
      <nz-card [nzTitle]="'agentCommissions.exports.cuTitle' | translate">
        <p class="hint">{{ 'agentCommissions.exports.cuHint' | translate }}</p>
        <div class="editor">
          <label class="field" for="agc-export-cu-year">
            <span>{{ 'agentCommissions.field.year' | translate }}</span>
            <nz-select
              nzId="agc-export-cu-year"
              [ngModel]="store.year()"
              (ngModelChange)="store.setYear($event)"
            >
              @for (year of years; track year) {
                <nz-option [nzValue]="year" [nzLabel]="'' + year"></nz-option>
              }
            </nz-select>
          </label>
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.exporting() === 'cu'"
            (click)="download(store.exportCu())"
          >
            {{ 'agentCommissions.action.exportCu' | translate }}
          </button>
        </div>
      </nz-card>

      <nz-card [nzTitle]="'agentCommissions.exports.enasarcoTitle' | translate">
        <p class="hint">{{ 'agentCommissions.exports.enasarcoHint' | translate }}</p>
        <div class="editor">
          <label class="field" for="agc-export-enasarco-year">
            <span>{{ 'agentCommissions.field.year' | translate }}</span>
            <nz-select
              nzId="agc-export-enasarco-year"
              [ngModel]="store.year()"
              (ngModelChange)="store.setYear($event)"
            >
              @for (year of years; track year) {
                <nz-option [nzValue]="year" [nzLabel]="'' + year"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="agc-export-enasarco-quarter">
            <span>{{ 'agentCommissions.field.quarter' | translate }}</span>
            <nz-select
              nzId="agc-export-enasarco-quarter"
              nzAllowClear
              [nzPlaceHolder]="'agentCommissions.action.all' | translate"
              [ngModel]="store.quarter()"
              (ngModelChange)="store.setQuarter($event ?? null)"
            >
              @for (quarter of quarters; track quarter) {
                <nz-option [nzValue]="quarter" [nzLabel]="'' + quarter"></nz-option>
              }
            </nz-select>
          </label>
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.exporting() === 'enasarco'"
            (click)="download(store.exportEnasarco())"
          >
            {{ 'agentCommissions.action.exportEnasarco' | translate }}
          </button>
        </div>
      </nz-card>
    </div>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .hint {
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .editor {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
      font-size: 12px;
    }
  `,
})
export class ExportsComponent {
  readonly store = inject(ExportsStore);

  readonly years = selectableYears();
  readonly quarters = [1, 2, 3, 4];

  /** Hands the file to the browser; a refusal is already in the store (`error`). */
  async download(request: Promise<ExportFile>): Promise<void> {
    const file = await request;
    if (file.ok && file.blob) {
      downloadBlob(file.blob, file.filename);
    }
  }
}
