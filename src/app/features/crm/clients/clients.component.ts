import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '@shared';

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
  ],
  template: `
    <app-page-header
      title="Anagrafica Clienti Cross-Border (IT / CH)"
      subtitle="Gestione completa profili fiscali italiani (SDI, PEC, P.IVA) e svizzeri (IDI/UID, QR-IBAN)"
    />

    <nz-card>
      <div class="table-toolbar">
        <nz-radio-group [(ngModel)]="jurisdictionFilter" (ngModelChange)="filterClients()">
          <label nz-radio-button nzValue="ALL">Tutti ({{ clients().length }})</label>
          <label nz-radio-button nzValue="IT">🇮🇹 Italia</label>
          <label nz-radio-button nzValue="CH">🇨🇭 Svizzera</label>
        </nz-radio-group>
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
            <th>Ragione Sociale</th>
            <th>Giurisdizione</th>
            <th>Identificativo Fiscale</th>
            <th>Canale Fatturazione</th>
            <th>Località</th>
            <th>Stato</th>
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
                  <nz-tag nzColor="blue">🇮🇹 Italia</nz-tag>
                } @else {
                  <nz-tag nzColor="red">🇨🇭 Svizzera</nz-tag>
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
                  <div>SDI: <strong>{{ client.sdiCode }}</strong></div>
                  <small>PEC: {{ client.pec }}</small>
                } @else {
                  <div>QR-IBAN:</div>
                  <small class="iban-text">{{ client.qrIban }}</small>
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

    .iban-text {
      font-family: monospace;
      color: #0958d9;
    }
  `,
})
export class CrmClientsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly clients = signal<ClientItem[]>([]);
  readonly filteredClients = signal<ClientItem[]>([]);
  jurisdictionFilter = 'ALL';

  ngOnInit(): void {
    this.http.get<ClientItem[]>('/api/crm/clients').subscribe({
      next: (data) => {
        this.clients.set(data);
        this.filterClients();
      },
      error: () => {
        // Fallback demo data
        const fallback: ClientItem[] = [
          {
            id: 'cli-01',
            companyName: 'Bernasconi SA',
            jurisdiction: 'CH',
            vatNumber: 'CHE-245.891.102 MWST',
            uid: 'CHE-245.891.102',
            qrIban: 'CH5631999123000987654',
            city: 'Lugano',
            country: 'Svizzera',
            status: 'ACTIVE',
          },
        ];
        this.clients.set(fallback);
        this.filterClients();
      },
    });
  }

  filterClients(): void {
    if (this.jurisdictionFilter === 'ALL') {
      this.filteredClients.set(this.clients());
    } else {
      this.filteredClients.set(
        this.clients().filter((c) => c.jurisdiction === this.jurisdictionFilter)
      );
    }
  }
}
