import { Component, computed, inject } from '@angular/core';
import { CollaborationApiService, CollaborationRecordTypeKey, PermissionsService } from '@core';
import { HubPageComponent } from '../../../resource-hub/hub-page.component';
import { f, HubTab } from '../../../resource-hub/hub.types';
import { map } from 'rxjs';

/** Shared tags of the collaboration module: manage them and see which records carry a tag. */
@Component({
  selector: 'app-collaboration-tags',
  imports: [HubPageComponent],
  template: `<app-hub-page title="Tag condivisi" subtitle="Etichette applicabili a clienti, fatture, progetti e altri record" [tabs]="tabs()" />`,
})
export class CollaborationTagsComponent {
  private readonly api = inject(CollaborationApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly tabs = computed<HubTab[]>(() => {
    const canWrite = this.permissions.canWrite('collaboration') || this.permissions.canWrite('system');
    return [
      {
        kind: 'crud',
        title: 'Tag',
        config: {
          titleKey: 'Tag',
          canWrite,
          list: () => this.api.getTags().pipe(map((r) => r.data as never)),
          create: (p) => this.api.createTag(p as never),
          update: (id, p) => this.api.updateTag(id, p as never),
          remove: (id) => this.api.deleteTag(id),
          fields: [
            f.text('name', 'Nome', { required: true, maxLength: 60 }),
            f.text('color', 'Colore (#RRGGBB)', { nullable: true, pattern: '^#[0-9A-Fa-f]{6}$', maxLength: 7 }),
            f.col('usage_count', 'Utilizzi'),
          ],
        },
      },
      {
        kind: 'report',
        title: 'Record con un tag',
        filters: [f.id('tag_id', 'ID tag', { required: true }), f.text('type', 'Tipo di record (es. contact)', { column: false })],
        load: (p) => this.api.getTagRecords(String(p['tag_id']), p['type'] as CollaborationRecordTypeKey | undefined),
      },
    ];
  });
}
