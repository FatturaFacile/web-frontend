import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService, ResourceApiService, ResourceRow } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { catchError, forkJoin, of } from 'rxjs';
import { PageHeaderComponent } from '@shared';
import { humanize, translateOr } from '../leads/lead-i18n';

interface TimelineEntry {
  kind: string;
  reference: string;
  status: string;
  hours: string;
  occurredAt: string;
}

/** Customer 360: registry data, maintenance contracts with their hour bank and the repair history of the installed base. */
@Component({
  selector: 'app-crm-customer-360',
  imports: [
    DatePipe,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzCollapseModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzSkeletonModule,
    NzTagModule,
    NzTimelineModule,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header
      [title]="name()"
      [subtitle]="label('CRM.CUSTOMER360.SUBTITLE', 'Customer 360')"
    />
    <a nz-button nzType="link" routerLink="/crm/clients">{{
      label('CRM.CUSTOMER360.BACK', 'Back to customers')
    }}</a>

    @if (loading()) {
      <nz-skeleton [nzActive]="true" />
    } @else {
      <nz-card [nzTitle]="label('CRM.CUSTOMER360.REGISTRY', 'Registry')">
        <nz-descriptions nzBordered [nzColumn]="2">
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.VAT', 'VAT / tax id')">{{
            taxId()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.COUNTRY', 'Country')">{{
            contact()['country']
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.EMAIL', 'E-mail')">{{
            contact()['email']
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.PHONE', 'Phone')">{{
            contact()['phone']
          }}</nz-descriptions-item>
        </nz-descriptions>
      </nz-card>

      <nz-card
        [nzTitle]="label('CRM.CUSTOMER360.CONTRACTS', 'Maintenance contracts')"
        class="c360-card"
      >
        @for (contract of contracts(); track contract['id']) {
          <div class="c360-row">
            <strong>{{ contract['contract_number'] }}</strong> {{ contract['title'] }}
            <nz-tag>{{ humanize(str(contract['status'])) }}</nz-tag>
            @if (contract['low_balance']) {
              <nz-tag nzColor="orange">{{ label('RES.F.low_balance', 'Low balance') }}</nz-tag>
            }
            <span>{{ contract['remaining_hours'] }} / {{ contract['included_hours'] }} h</span>
          </div>
        } @empty {
          <nz-empty />
        }
      </nz-card>

      <nz-card
        [nzTitle]="label('CRM.CUSTOMER360.INSTALLED_BASE', 'Installed base and repair history')"
        class="c360-card"
      >
        <nz-collapse>
          @for (asset of assets(); track asset['id']) {
            <nz-collapse-panel
              [nzHeader]="str(asset['serial_number']) + ' · ' + str(asset['installation_site'])"
              (nzActiveChange)="onOpen($event, str(asset['id']))"
            >
              <nz-tag>{{ humanize(str(asset['asset_status'])) }}</nz-tag>
              <nz-tag>{{ humanize(str(asset['warranty_status'])) }}</nz-tag>
              @if (history()[str(asset['id'])]; as entries) {
                <nz-timeline>
                  @for (entry of entries; track $index) {
                    <nz-timeline-item>
                      {{ entry.occurredAt | date: 'medium' }} — {{ humanize(entry.kind) }}
                      {{ entry.reference }}
                      @if (entry.status) {
                        ({{ humanize(entry.status) }})
                      }
                      @if (entry.hours) {
                        {{ entry.hours }} h
                      }
                    </nz-timeline-item>
                  } @empty {
                    <nz-empty />
                  }
                </nz-timeline>
              } @else {
                <nz-skeleton [nzActive]="true" />
              }
            </nz-collapse-panel>
          } @empty {
            <nz-empty />
          }
        </nz-collapse>
      </nz-card>
    }
  `,
  styles: `
    .c360-card {
      margin-top: 16px;
    }
    .c360-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 4px 0;
    }
  `,
})
export class Customer360Component {
  private readonly api = inject(ResourceApiService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly loading = signal(true);
  protected readonly contact = signal<ResourceRow>({});
  protected readonly contracts = signal<ResourceRow[]>([]);
  protected readonly assets = signal<ResourceRow[]>([]);
  protected readonly history = signal<Record<string, TimelineEntry[]>>({});
  protected readonly humanize = humanize;

  protected readonly name = computed(() => this.str(this.contact()['name']) || '…');
  protected readonly taxId = computed(() => {
    const c = this.contact();
    return this.str(c['vat_number']) || this.str(c['fiscal_code']) || this.str(c['uid_number']);
  });

  constructor() {
    const id = encodeURIComponent(this.id);
    forkJoin({
      overview: this.api
        .request('GET', `/crm/contacts/${id}/overview`)
        .pipe(catchError(() => of({}))),
      contracts: this.api
        .list('/esm/service-contracts', { customer_id: this.id })
        .pipe(catchError(() => of({ rows: [] as ResourceRow[] }))),
      assets: this.api
        .list('/esm/equipment-passports', { customer_id: this.id, per_page: 200 })
        .pipe(catchError(() => of({ rows: [] as ResourceRow[] }))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ overview, contracts, assets }) => {
        const contact = (overview as { contact?: ResourceRow }).contact ?? {};
        this.contact.set(contact);
        this.contracts.set(
          contracts.rows.filter((row) => !row['customer_id'] || row['customer_id'] === this.id),
        );
        this.assets.set(assets.rows);
        this.loading.set(false);
      });
  }

  protected label(key: string, fallback: string): string {
    return translateOr(this.i18n, key, fallback);
  }

  protected str(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  /** Loads the timeline of an asset the first time its panel is opened. */
  protected onOpen(open: boolean, assetId: string): void {
    if (!open || this.history()[assetId]) {
      return;
    }
    this.api
      .request('GET', `/esm/equipment-passports/${encodeURIComponent(assetId)}/history`)
      .pipe(
        catchError(() => of({ timeline: [] })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        const timeline = (result as { timeline?: ResourceRow[] }).timeline ?? [];
        const entries = timeline.map((row) => ({
          kind: this.str(row['kind']),
          reference: this.str(row['reference']),
          status: this.str(row['status']),
          hours: this.str(row['hours']),
          occurredAt: this.str(row['occurred_at']),
        }));
        this.history.update((all) => ({ ...all, [assetId]: entries }));
      });
  }
}
