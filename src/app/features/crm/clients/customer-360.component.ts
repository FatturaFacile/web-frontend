import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService, OpenItem, ResourceApiService, ResourceRow } from '@core';
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
import { Customer360AddressesComponent } from './customer-360/customer-360-addresses.component';
import { Customer360ConsentsComponent } from './customer-360/customer-360-consents.component';
import { Customer360HierarchyComponent } from './customer-360/customer-360-hierarchy.component';
import { Customer360InteractionsComponent } from './customer-360/customer-360-interactions.component';
import { Customer360PersonsComponent } from './customer-360/customer-360-persons.component';
import { EntityAuditTimelineComponent } from '../../security/audit-trail/entity-audit-timeline.component';

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
    EntityAuditTimelineComponent,
    Customer360AddressesComponent,
    Customer360ConsentsComponent,
    Customer360HierarchyComponent,
    Customer360InteractionsComponent,
    Customer360PersonsComponent,
  ],
  template: `
    <app-page-header [title]="name()" [subtitle]="label('CRM.CUSTOMER360.SUBTITLE')" />
    <a nz-button nzType="link" routerLink="/crm/clients">{{ label('CRM.CUSTOMER360.BACK') }}</a>

    @if (loading()) {
      <nz-skeleton [nzActive]="true" />
    } @else {
      <nz-card [nzTitle]="label('CRM.CUSTOMER360.REGISTRY')">
        <nz-descriptions nzBordered [nzColumn]="2">
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.VAT')">{{
            taxId()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.COUNTRY')">{{
            contact()['country']
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.EMAIL')">{{
            contact()['email']
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.PHONE')">{{
            contact()['phone']
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.RECEIVABLES_DUE')">{{
            receivables()['total_due'] ?? 0
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.RECEIVABLES_OVERDUE')">{{
            receivables()['overdue_total'] ?? 0
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.CREDIT_LIMIT')">{{
            credit()['credit_limit'] ?? '—'
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.CREDIT_EXPOSURE')">{{
            credit()['exposure'] ?? 0
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="label('CRM.CUSTOMER360.PRIVACY_REGIME')">{{
            str(privacy()['regime']).toUpperCase() || 'GDPR'
          }}</nz-descriptions-item>
        </nz-descriptions>
      </nz-card>

      <nz-card [nzTitle]="label('CRM.CUSTOMER360.OPEN_ITEMS')" class="c360-card">
        @for (item of openItems(); track item.invoice_id) {
          <div class="c360-row">
            <strong>{{ item.invoice_number }}</strong>
            <span>{{ item.date }}</span>
            <span>{{ label('CRM.CUSTOMER360.DUE_DATE') }}: {{ item.due_date }}</span>
            @if (item.days_overdue) {
              <nz-tag nzColor="red">{{ item.days_overdue }} {{ label('CRM.CUSTOMER360.DAYS_OVERDUE') }}</nz-tag>
            }
            <span>{{ item.balance }} {{ item.currency }}</span>
          </div>
        } @empty {
          <nz-empty />
        }
      </nz-card>

      <nz-card [nzTitle]="label('CRM.CUSTOMER360.ADDRESSES')" class="c360-card">
        <app-customer-360-addresses [contactId]="id" />
      </nz-card>

      <nz-card [nzTitle]="label('CRM.CUSTOMER360.PERSONS')" class="c360-card">
        <app-customer-360-persons [contactId]="id" />
      </nz-card>

      <nz-card [nzTitle]="label('CRM.CUSTOMER360.HIERARCHY')" class="c360-card">
        <app-customer-360-hierarchy
          [contactId]="id"
          [parentId]="str(contact()['parent_id']) || null"
          [hierarchyType]="$any(contact()['hierarchy_type'] ?? null)"
        />
      </nz-card>

      <nz-card [nzTitle]="label('CRM.CUSTOMER360.CONSENTS')" class="c360-card">
        <app-customer-360-consents
          [contactId]="id"
          [regime]="str(privacy()['regime']) || 'gdpr'"
          [restricted]="privacy()['processing_restricted'] === true"
        />
      </nz-card>

      <nz-card [nzTitle]="label('CRM.CUSTOMER360.INTERACTION_LOG')" class="c360-card">
        <app-customer-360-interactions [contactId]="id" />
      </nz-card>

      @if (quotesList().length || ordersList().length || deliveryNotesList().length || invoicesList().length) {
        <nz-card [nzTitle]="label('CRM.CUSTOMER360.COMMERCIAL_ACTIVITY')" class="c360-card">
          @for (inv of invoicesList(); track inv['id']) {
            <div class="c360-row">
              <strong>{{ inv['invoice_number'] }}</strong>
              <span>{{ inv['date'] }}</span>
              <nz-tag>{{ value(inv['payment_status']) }}</nz-tag>
              <span>{{ inv['total_gross'] }} {{ inv['currency'] }}</span>
            </div>
          }
          @for (ord of ordersList(); track ord['id']) {
            <div class="c360-row">
              <strong>{{ ord['order_number'] }}</strong>
              <span>{{ ord['date'] }}</span>
              <nz-tag>{{ value(ord['status']) }}</nz-tag>
              <span>{{ ord['total_gross'] }} {{ ord['currency'] }}</span>
            </div>
          }
          @for (qt of quotesList(); track qt['id']) {
            <div class="c360-row">
              <strong>{{ qt['quote_number'] }}</strong>
              <span>{{ qt['date'] }}</span>
              <nz-tag>{{ value(qt['status']) }}</nz-tag>
              <span>{{ qt['total_gross'] }} {{ qt['currency'] }}</span>
            </div>
          }
          @for (ddt of deliveryNotesList(); track ddt['id']) {
            <div class="c360-row">
              <strong>{{ ddt['ddt_number'] }}</strong>
              <span>{{ ddt['date'] }}</span>
            </div>
          }
        </nz-card>
      }

      @if (openTicketsList().length || recentInteractions().length) {
        <nz-card [nzTitle]="label('CRM.CUSTOMER360.TICKETS_INTERACTIONS')" class="c360-card">
          @for (ticket of openTicketsList(); track ticket['id']) {
            <div class="c360-row">
              <strong>{{ ticket['subject'] }}</strong>
              <nz-tag>{{ value(ticket['status']) }}</nz-tag>
              <nz-tag>{{ value(ticket['priority']) }}</nz-tag>
            </div>
          }
          @for (interaction of recentInteractions(); track interaction['id']) {
            <div class="c360-row">
              <nz-tag>{{ value(interaction['type']) }}</nz-tag>
              <strong>{{ interaction['subject'] }}</strong>
              <span>{{ $any(interaction['occurred_at']) | date: 'short' }}</span>
            </div>
          }
        </nz-card>
      }

      <nz-card [nzTitle]="label('CRM.CUSTOMER360.CONTRACTS')" class="c360-card">
        @for (contract of contracts(); track contract['id']) {
          <div class="c360-row">
            <strong>{{ contract['contract_number'] }}</strong> {{ contract['title'] }}
            <nz-tag>{{ value(contract['status']) }}</nz-tag>
            @if (contract['low_balance']) {
              <nz-tag nzColor="orange">{{ label('RES.F.low_balance') }}</nz-tag>
            }
            <span
              >{{ contract['remaining_hours'] }} / {{ contract['included_hours'] }}
              {{ label('CRM.CUSTOMER360.HOURS_SHORT') }}</span
            >
          </div>
        } @empty {
          <nz-empty />
        }
      </nz-card>

      <nz-card [nzTitle]="label('CRM.CUSTOMER360.INSTALLED_BASE')" class="c360-card">
        <nz-collapse>
          @for (asset of assets(); track asset['id']) {
            <nz-collapse-panel
              [nzHeader]="str(asset['serial_number']) + ' · ' + str(asset['installation_site'])"
              (nzActiveChange)="onOpen($event, str(asset['id']))"
            >
              <nz-tag>{{ value(asset['asset_status']) }}</nz-tag>
              <nz-tag>{{ value(asset['warranty_status']) }}</nz-tag>
              @if (history()[str(asset['id'])]; as entries) {
                <nz-timeline>
                  @for (entry of entries; track $index) {
                    <nz-timeline-item>
                      {{ entry.occurredAt | date: 'medium' }} — {{ kind(entry.kind) }}
                      {{ entry.reference }}
                      @if (entry.status) {
                        ({{ value(entry.status) }})
                      }
                      @if (entry.hours) {
                        {{ entry.hours }} {{ label('CRM.CUSTOMER360.HOURS_SHORT') }}
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

      <nz-card class="c360-card">
        <app-entity-audit-timeline entityType="Contact" [entityId]="id" />
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
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly loading = signal(true);
  protected readonly contact = signal<ResourceRow>({});
  protected readonly receivables = signal<ResourceRow>({});
  protected readonly credit = signal<ResourceRow>({});
  protected readonly privacy = signal<ResourceRow>({});
  protected readonly quotesList = signal<ResourceRow[]>([]);
  protected readonly ordersList = signal<ResourceRow[]>([]);
  protected readonly deliveryNotesList = signal<ResourceRow[]>([]);
  protected readonly invoicesList = signal<ResourceRow[]>([]);
  protected readonly openTicketsList = signal<ResourceRow[]>([]);
  protected readonly recentInteractions = signal<ResourceRow[]>([]);
  protected readonly contracts = signal<ResourceRow[]>([]);
  protected readonly assets = signal<ResourceRow[]>([]);
  protected readonly history = signal<Record<string, TimelineEntry[]>>({});

  protected readonly openItems = computed(() => (this.receivables()['open_items'] ?? []) as OpenItem[]);
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
        const ov = overview as {
          contact?: ResourceRow;
          receivables?: ResourceRow;
          credit?: ResourceRow;
          privacy?: ResourceRow;
          quotes?: { recent?: ResourceRow[] };
          orders_in_progress?: { items?: ResourceRow[] };
          delivery_notes_to_invoice?: { items?: ResourceRow[] };
          invoices?: { recent?: ResourceRow[] };
          open_tickets?: { items?: ResourceRow[] };
          recent_interactions?: ResourceRow[];
        };
        this.contact.set(ov.contact ?? {});
        this.receivables.set(ov.receivables ?? {});
        this.credit.set(ov.credit ?? {});
        this.privacy.set(ov.privacy ?? {});
        this.quotesList.set(ov.quotes?.recent ?? []);
        this.ordersList.set(ov.orders_in_progress?.items ?? []);
        this.deliveryNotesList.set(ov.delivery_notes_to_invoice?.items ?? []);
        this.invoicesList.set(ov.invoices?.recent ?? []);
        this.openTicketsList.set(ov.open_tickets?.items ?? []);
        this.recentInteractions.set(ov.recent_interactions ?? []);
        this.contracts.set(
          contracts.rows.filter((row) => !row['customer_id'] || row['customer_id'] === this.id),
        );
        this.assets.set(assets.rows);
        this.loading.set(false);
      });
  }

  protected label(key: string): string {
    return this.i18n.translate(key);
  }

  protected value(raw: unknown): string {
    return this.i18n.translate(`RES.V.${this.str(raw)}`);
  }

  protected kind(raw: string): string {
    return this.i18n.translate(`CRM.CUSTOMER360.KIND_${raw.toUpperCase()}`);
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
