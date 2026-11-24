import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TmsCarrier, TmsTariffTable, TransportationApiService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** One carrier with its tariff tables, each linking to the editor of its bands. */
@Component({
  selector: 'app-tms-carrier-detail',
  styleUrl: './transportation.scss',
  imports: [RouterLink, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzTableModule, NzTagModule],
  template: `
    @if (carrier(); as record) {
      <app-page-header [title]="record.name" [subtitle]="record.code">
        <a nz-button routerLink="/transportation/carriers">{{ 'TMS.BACK_TO_LIST' | translate }}</a>
      </app-page-header>

      <nz-card class="main-card">
        <dl class="detail-grid">
          <div>
            <dt>{{ 'TMS.MODE' | translate }}</dt>
            <dd><nz-tag>{{ 'RES.V.' + record.mode | translate }}</nz-tag></dd>
          </div>
          <div>
            <dt>{{ 'TMS.SERVICE_LEVEL' | translate }}</dt>
            <dd>{{ record.service_level ?? '-' }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.CURRENCY' | translate }}</dt>
            <dd>{{ record.currency }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.ACTIVE' | translate }}</dt>
            <dd>{{ (record.is_active ? 'RES.YES' : 'RES.NO') | translate }}</dd>
          </div>
          @if (record.notes) {
            <div>
              <dt>{{ 'TMS.NOTES' | translate }}</dt>
              <dd>{{ record.notes }}</dd>
            </div>
          }
        </dl>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'TMS.TAB_TARIFF_TABLES' | translate">
        <nz-table #table [nzData]="tables()" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'TMS.TABLE_NAME' | translate }}</th>
              <th>{{ 'TMS.RATE_BASIS' | translate }}</th>
              <th>{{ 'TMS.VALID_FROM' | translate }}</th>
              <th>{{ 'TMS.VALID_TO' | translate }}</th>
              <th class="num">{{ 'TMS.FUEL_SURCHARGE' | translate }}</th>
              <th class="num">{{ 'TMS.MINIMUM_CHARGE' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of table.data; track item.id) {
              <tr>
                <td>{{ item.name }}</td>
                <td>{{ 'RES.V.' + item.rate_basis | translate }}</td>
                <td>{{ item.valid_from }}</td>
                <td>{{ item.valid_to ?? '-' }}</td>
                <td class="num">{{ item.fuel_surcharge_percent }}</td>
                <td class="num">{{ item.minimum_charge }}</td>
                <td class="num">
                  <a nz-button nzSize="small" nzType="link" [routerLink]="['/transportation/tariffs', item.id]">{{ 'TMS.OPEN_BANDS' | translate }}</a>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'TMS.NOT_FOUND' | translate"></nz-empty>
    }
  `,
})
export class TmsCarrierDetailComponent implements OnInit {
  private readonly api = inject(TransportationApiService);
  private readonly route = inject(ActivatedRoute);

  readonly carrier = signal<TmsCarrier | null>(null);
  readonly tables = signal<TmsTariffTable[]>([]);
  readonly loading = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loading.set(true);
    this.api.getCarrier(id).subscribe({
      next: (response) => {
        this.carrier.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.carrier.set(null);
        this.loading.set(false);
      },
    });
    this.api.getTariffTables(id).subscribe({
      next: (response) => this.tables.set(response.data),
      error: () => this.tables.set([]),
    });
  }
}
