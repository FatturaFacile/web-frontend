import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollaborationApiService, PermissionsService } from '@core';
import { HubTab } from '../../../resource-hub/hub.types';
import { CollaborationTagsComponent } from './tags.component';

describe('CollaborationTagsComponent', () => {
  const api = { getTags: vi.fn(), createTag: vi.fn(), updateTag: vi.fn(), deleteTag: vi.fn(), getTagRecords: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getTags.mockReturnValue(of({ data: [{ id: 't1', name: 'VIP' }] }));
    api.getTagRecords.mockReturnValue(of({ data: [] }));
    TestBed.configureTestingModule({
      imports: [CollaborationTagsComponent],
      providers: [
        { provide: CollaborationApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
      ],
    });
  });

  function tabs(): HubTab[] {
    return (TestBed.createComponent(CollaborationTagsComponent).componentInstance as unknown as { tabs(): HubTab[] }).tabs();
  }

  it('lists the tags unwrapped from the envelope', () => {
    const tab = tabs()[0];
    if (tab.kind !== 'crud') {
      throw new Error('crud expected');
    }
    let rows: unknown;
    tab.config.list?.().subscribe((r) => (rows = r));
    expect(rows).toEqual([{ id: 't1', name: 'VIP' }]);
  });

  it('looks up the records of a tag', () => {
    const tab = tabs()[1];
    if (tab.kind !== 'report') {
      throw new Error('report expected');
    }
    tab.load({ tag_id: 't1', type: 'contact' }).subscribe();
    expect(api.getTagRecords).toHaveBeenCalledWith('t1', 'contact');
  });
});
