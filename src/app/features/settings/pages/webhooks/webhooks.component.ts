import { Component, computed, inject } from '@angular/core';
import { ExtraRecord, PermissionsService, WebhookDeliveryParams, WebhookEndpointRequest, WebhooksApiService } from '@core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { tap } from 'rxjs';
import { HubPageComponent } from '../../../resource-hub/hub-page.component';
import { f, HubTab, rows } from '../../../resource-hub/hub.types';

const STATUSES = { pending: 'In attesa', retrying: 'Nuovo tentativo', succeeded: 'Consegnato', dead: 'Fallito' };

/** Outbound webhooks: endpoints (create, enable, test, rotate the secret), event catalog and delivery log with redelivery. */
@Component({
  selector: 'app-webhooks',
  imports: [HubPageComponent],
  template: `<app-hub-page
    title="Webhook"
    subtitle="Notifiche in uscita verso sistemi esterni, firmate e con registro delle consegne"
    [tabs]="tabs()"
  />`,
})
export class WebhooksComponent {
  private readonly api = inject(WebhooksApiService);
  private readonly modal = inject(NzModalService);
  private readonly permissions = inject(PermissionsService);
  private readonly canWrite = computed(() => this.permissions.canWrite('integrations'));

  protected readonly tabs = computed<HubTab[]>(() => {
    const canWrite = this.canWrite();
    return [
      {
        kind: 'crud',
        title: 'Endpoint',
        hint: 'Il segreto di firma viene mostrato una sola volta, alla creazione o alla rotazione.',
        config: {
          titleKey: 'Endpoint webhook',
          canWrite,
          list: () => rows(this.api.getEndpoints()),
          create: (p) => this.api.createEndpoint(this.toRequest(p)).pipe(tap((r) => this.showSecret(r.data))),
          update: (id, p) => this.api.updateEndpoint(id, this.toRequest(p)),
          remove: (id) => this.api.deleteEndpoint(id),
          fields: [
            f.text('name', 'Nome', { required: true, maxLength: 120 }),
            f.text('url', 'URL HTTPS', { required: true, pattern: '^https://.+' }),
            f.text('events', 'Eventi (separati da virgola)', { required: true }),
            f.area('description', 'Descrizione', { nullable: true, column: false }),
            f.col('is_active', 'Attivo'),
            f.col('status', 'Stato'),
          ],
          rowActions: [
            { labelKey: 'Abilita', run: (r) => this.api.enableEndpoint(r.id), visible: (r) => r['is_active'] === false, writeOnly: true },
            { labelKey: 'Disabilita', run: (r) => this.api.disableEndpoint(r.id), visible: (r) => r['is_active'] !== false, writeOnly: true },
            { labelKey: 'Invia test', run: (r) => this.api.testEndpoint(r.id), writeOnly: true },
            {
              labelKey: 'Ruota segreto',
              input: { labelKey: 'Ore di validità del vecchio segreto', kind: 'decimal', optional: true },
              run: (r, v) => this.api.rotateEndpointSecret(r.id, v ? Number(v) : undefined).pipe(tap((res) => this.showSecret(res.data))),
              writeOnly: true,
            },
          ],
        },
      },
      {
        kind: 'report',
        title: 'Consegne',
        filters: [
          f.id('endpoint_id', 'ID endpoint', { column: false }),
          f.select('status', 'Stato', STATUSES),
          f.text('event_name', 'Evento'),
        ],
        load: (p) => this.api.getDeliveries(p as WebhookDeliveryParams),
      },
      {
        kind: 'form',
        title: 'Rinvia consegna',
        hint: 'Rimette in coda una consegna fallita o consegnata (ID dalla tab Consegne).',
        canWrite,
        fields: [f.id('id', 'ID consegna', { required: true })],
        submitLabel: 'Rinvia',
        submit: (p) => this.api.redeliver(String(p['id'])),
      },
      { kind: 'report', title: 'Catalogo eventi', load: () => this.api.getEventCatalog() },
    ];
  });

  private toRequest(p: Record<string, unknown>): WebhookEndpointRequest {
    const events = String(p['events'] ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e !== '');
    return { ...(p as unknown as WebhookEndpointRequest), events };
  }

  private showSecret(record: ExtraRecord): void {
    const secret = record['secret'] ?? record['signing_secret'];
    if (typeof secret === 'string') {
      this.modal.info({ nzTitle: 'Segreto di firma', nzContent: `Copialo ora, non verrà mostrato di nuovo: ${secret}` });
    }
  }
}
