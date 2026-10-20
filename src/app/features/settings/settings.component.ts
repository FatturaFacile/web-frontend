import { Component, inject } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { AuthStore } from '@core';
import { PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-settings',
  imports: [NzCardModule, NzTableModule, NzTagModule, NzButtonModule, PageHeaderComponent],
  template: `
    <app-page-header
      title="Amministrazione Multi-Tenant & Impostazioni ERP"
      subtitle="Gestione filiali, tassi di cambio ECB / BNS, ruoli RBAC e audit log conforme GDPR / LPD svizzera"
    />

    <nz-card nzTitle="Configurazione Aziende / Tenant">
      <nz-table #tenTable [nzData]="authStore.tenants()" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>Nome Tenant</th>
            <th>Giurisdizione</th>
            <th>Valuta Principale</th>
            <th>Identificativo Fiscale</th>
            <th>Indirizzo Sede</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          @for (t of tenTable.data; track t.id) {
            <tr>
              <td>
                <strong>{{ t.name }}</strong>
                @if (t.id === authStore.activeTenantId()) {
                  <nz-tag nzColor="processing" style="margin-left: 8px;">Attivo</nz-tag>
                }
              </td>
              <td>
                <nz-tag [nzColor]="t.jurisdiction === 'IT' ? 'blue' : 'red'">
                  {{ t.jurisdiction === 'IT' ? '🇮🇹 Italia' : '🇨🇭 Svizzera' }}
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
                  {{ t.id === authStore.activeTenantId() ? 'Selezionato' : 'Seleziona' }}
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
