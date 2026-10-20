import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-professionals',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'PROFESSIONALS.TITLE' | translate"
      [subtitle]="'PROFESSIONALS.SUBTITLE' | translate"
    />

    <nz-card [nzTitle]="'PROFESSIONALS.CARD_TITLE' | translate">
      <nz-table #prTable [nzData]="cases" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'PROFESSIONALS.COL_CASE_NUM' | translate }}</th>
            <th>{{ 'PROFESSIONALS.COL_CLIENT' | translate }}</th>
            <th>{{ 'PROFESSIONALS.COL_MANDATE' | translate }}</th>
            <th>{{ 'PROFESSIONALS.COL_HOURS' | translate }}</th>
            <th>{{ 'PROFESSIONALS.COL_KYC_AML' | translate }}</th>
            <th>{{ 'PROFESSIONALS.COL_FEE' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (c of prTable.data; track c.num) {
            <tr>
              <td><strong>{{ c.num }}</strong></td>
              <td>{{ c.client }}</td>
              <td>{{ c.subject }}</td>
              <td>{{ c.hours }}</td>
              <td>
                <nz-tag nzColor="success"><i class="fa-solid fa-check fa-icon-spaced"></i> {{ 'PROFESSIONALS.AML_COMPLIANT' | translate }}</nz-tag>
              </td>
              <td><strong>{{ c.fee }}</strong></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class ProfessionalsComponent {
  readonly cases = [
    { num: 'FASC-2026-08', client: 'Alpine Precision AG', subject: 'Consulenza fiscale cross-border IT-CH', hours: '14.5 h', fee: 'CHF 4.350 (No ritenuta)' },
    { num: 'FASC-2026-11', client: 'Lombarda Manifatture', subject: 'Parere societario e compliance D.Lgs. 231', hours: '22.0 h', fee: '€ 5.500 (+ 4% CPA - 20% Rit.)' },
  ];
}
