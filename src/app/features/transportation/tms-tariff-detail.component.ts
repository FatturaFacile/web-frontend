import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, TmsTariffTable, TransportationApiService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TariffBandsEditorComponent } from './tariff-bands-editor.component';

/** One tariff table of a carrier with the editor of its price bands. */
@Component({
  selector: 'app-tms-tariff-detail',
  styleUrl: './transportation.scss',
  imports: [RouterLink, PageHeaderComponent, TranslatePipe, TariffBandsEditorComponent, NzButtonModule, NzCardModule, NzEmptyModule, NzTagModule],
  template: `
    @if (table(); as record) {
      <app-page-header [title]="record.name" [subtitle]="record.carrier?.name ?? ''">
        @if (record.carrier) {
          <a nz-button [routerLink]="['/transportation/carriers', record.carrier.id]">{{ 'TMS.BACK_TO_CARRIER' | translate }}</a>
        }
        <a nz-button routerLink="/transportation/carriers">{{ 'TMS.BACK_TO_LIST' | translate }}</a>
      </app-page-header>

      <nz-card class="main-card">
        <dl class="detail-grid">
          <div>
            <dt>{{ 'TMS.RATE_BASIS' | translate }}</dt>
            <dd><nz-tag>{{ 'RES.V.' + record.rate_basis | translate }}</nz-tag></dd>
          </div>
          <div>
            <dt>{{ 'TMS.VALID_FROM' | translate }}</dt>
            <dd>{{ record.valid_from }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.VALID_TO' | translate }}</dt>
            <dd>{{ record.valid_to ?? '-' }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.FUEL_SURCHARGE' | translate }}</dt>
            <dd>{{ record.fuel_surcharge_percent }} %</dd>
          </div>
          <div>
            <dt>{{ 'TMS.MINIMUM_CHARGE' | translate }}</dt>
            <dd>{{ record.minimum_charge }} {{ record.currency }}</dd>
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

      <nz-card class="main-card" [nzTitle]="'TMS.TAB_TARIFF_BANDS' | translate">
        <app-tariff-bands-editor [tariffTableId]="record.id" [canEdit]="canEdit()"></app-tariff-bands-editor>
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'TMS.NOT_FOUND' | translate"></nz-empty>
    }
  `,
})
export class TmsTariffDetailComponent implements OnInit {
  private readonly api = inject(TransportationApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly permissions = inject(PermissionsService);

  readonly table = signal<TmsTariffTable | null>(null);
  readonly loading = signal(false);
  readonly canEdit = computed(() => this.permissions.canWrite('transportation'));

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getTariffTable(this.route.snapshot.paramMap.get('id') ?? '').subscribe({
      next: (response) => {
        this.table.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.table.set(null);
        this.loading.set(false);
      },
    });
  }
}
