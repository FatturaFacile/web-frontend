import { Component, inject } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { AuthStore } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-settings',
  imports: [NzCardModule, NzTableModule, NzTagModule, NzButtonModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'SETTINGS.TITLE' | translate"
      [subtitle]="'SETTINGS.SUBTITLE' | translate"
    />

    <nz-card [nzTitle]="'SETTINGS.CARD_TITLE' | translate">
      <nz-table #tenTable [nzData]="authStore.tenants()" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'SETTINGS.COL_NAME' | translate }}</th>
            <th>{{ 'SETTINGS.COL_JURISDICTION' | translate }}</th>
            <th>{{ 'SETTINGS.COL_CURRENCY' | translate }}</th>
            <th>{{ 'SETTINGS.COL_FISCAL_ID' | translate }}</th>
            <th>{{ 'SETTINGS.COL_ADDRESS' | translate }}</th>
            <th>{{ 'COMMON.STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (t of tenTable.data; track t.id) {
            <tr>
              <td>
                <strong>{{ t.name }}</strong>
                @if (t.id === authStore.activeTenantId()) {
                  <nz-tag nzColor="processing" style="margin-left: 8px;">{{ 'COMMON.ACTIVE' | translate }}</nz-tag>
                }
              </td>
              <td>
                <nz-tag [nzColor]="t.jurisdiction === 'IT' ? 'blue' : 'red'">
                  {{ t.jurisdiction === 'IT' ? ('🇮🇹 ' + ('COMMON.ITALY' | translate)) : ('🇨🇭 ' + ('COMMON.SWITZERLAND' | translate)) }}
                </nz-tag>
              </td>
              <td><strong>{{ t.currency }}</strong></td>
              <td>
                {{ t.vatNumber }}
                @if (t.sdiCode) {
                  <div><small>SDI: {{ t.sdiCode }}</small></div>
                }
                @if (t.qrIban) {
                  <div><small>QR-IBAN: {{ t.qrIban }}</small></div>
                }
              </td>
              <td>{{ t.address }}</td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  [nzType]="t.id === authStore.activeTenantId() ? 'primary' : 'default'"
                  (click)="authStore.switchTenant(t.id)"
                >
                  {{ t.id === authStore.activeTenantId() ? ('COMMON.SELECTED' | translate) : ('COMMON.SELECT' | translate) }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class SettingsComponent {
  readonly authStore = inject(AuthStore);
}
