import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent, TranslatePipe } from '@shared';

interface ClientItem {
  id: string;
  companyName: string;
  jurisdiction: 'IT' | 'CH';
  vatNumber: string;
  fiscalCode?: string;
  sdiCode?: string;
  pec?: string;
  uid?: string;
  qrIban?: string;
  city: string;
  country: string;
  status: string;
}

@Component({
  selector: 'app-crm-clients',
  imports: [
    FormsModule,
    NzTableModule,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzRadioModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'CRM.TITLE' | translate" [subtitle]="'CRM.SUBTITLE' | translate" />

    <nz-card>
      <div class="table-toolbar">
        <!-- eslint-disable @angular-eslint/template/label-has-associated-control -->
        <nz-radio-group [(ngModel)]="jurisdictionFilter" (ngModelChange)="filterClients()">
          <label nz-radio-button nzValue="ALL"
            >{{ 'COMMON.ALL' | translate }} ({{ clients().length }})</label
          >
          <label nz-radio-button nzValue="IT">🇮🇹 {{ 'COMMON.ITALY' | translate }}</label>
          <label nz-radio-button nzValue="CH">🇨🇭 {{ 'COMMON.SWITZERLAND' | translate }}</label>
        </nz-radio-group>
        <!-- eslint-enable @angular-eslint/template/label-has-associated-control -->
      </div>

      <nz-table
        #clientTable
        [nzData]="filteredClients()"
        [nzFrontPagination]="true"
        [nzPageSize]="10"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th>{{ 'CRM.COMPANY_NAME' | translate }}</th>
            <th>{{ 'CRM.JURISDICTION' | translate }}</th>
            <th>{{ 'CRM.FISCAL_ID' | translate }}</th>
            <th>{{ 'CRM.BILLING_CHANNEL' | translate }}</th>
            <th>{{ 'CRM.LOCATION' | translate }}</th>
            <th>{{ 'COMMON.STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (client of clientTable.data; track client.id) {
            <tr>
              <td>
                <strong>{{ client.companyName }}</strong>
              </td>
              <td>
                @if (client.jurisdiction === 'IT') {
                  <nz-tag nzColor="blue">🇮🇹 {{ 'COMMON.ITALY' | translate }}</nz-tag>
                } @else {
                  <nz-tag nzColor="red">🇨🇭 {{ 'COMMON.SWITZERLAND' | translate }}</nz-tag>
                }
              </td>
              <td>
                @if (client.jurisdiction === 'IT') {
                  <div>P.IVA: {{ client.vatNumber }}</div>
                  @if (client.fiscalCode) {
                    <small>CF: {{ client.fiscalCode }}</small>
                  }
                } @else {
                  <div>UID: {{ client.uid }}</div>
                  <small>IVA: {{ client.vatNumber }}</small>
                }
              </td>
              <td>
                @if (client.jurisdiction === 'IT') {
                  <div>
                    SDI: <strong>{{ client.sdiCode }}</strong>
                  </div>
                  <small>PEC: {{ client.pec }}</small>
                } @else {
                  <div>QR-IBAN:</div>
                  <small>{{ client.qrIban }}</small>
                }
              </td>
              <td>{{ client.city }} ({{ client.country }})</td>
              <td>
                <nz-tag nzColor="success">{{ client.status }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .table-toolbar {
      margin-bottom: 16px;
    }
  `,
})
export class ClientsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly clients = signal<ClientItem[]>([]);
  readonly filteredClients = signal<ClientItem[]>([]);
  jurisdictionFilter = 'ALL';

  ngOnInit(): void {
    this.http.get<ClientItem[]>('/api/crm/clients').subscribe({
      next: (data) => {
        this.clients.set(data);
        this.filteredClients.set(data);
      },
      error: () => {
        // Fallback demo data
        const fallback: ClientItem[] = [
          {
            id: 'c-01',
            companyName: 'Lombarda Manifatture S.p.A.',
            jurisdiction: 'IT',
            vatNumber: 'IT09876543210',
            fiscalCode: '09876543210',
            sdiCode: 'SUBM70N',
            pec: 'lombarda@pec.it',
            city: 'Como (CO)',
            country: 'IT',
            status: 'Attivo',
          },
          {
            id: 'c-02',
            companyName: 'Bernasconi Costruzioni SA',
            jurisdiction: 'CH',
            vatNumber: 'CHE-220.109.843',
            uid: 'CHE-220.109.843',
            qrIban: 'CH4431999123000889012',
            city: 'Lugano (TI)',
            country: 'CH',
            status: 'Attivo',
          },
        ];
        this.clients.set(fallback);
        this.filteredClients.set(fallback);
      },
    });
  }

  filterClients(): void {
    if (this.jurisdictionFilter === 'ALL') {
      this.filteredClients.set(this.clients());
    } else {
      this.filteredClients.set(
        this.clients().filter((c) => c.jurisdiction === this.jurisdictionFilter),
      );
    }
  }
}

export { ClientsComponent as CrmClientsComponent };
