import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LookupService, PermissionsService } from '@core';
import { icons } from '../../../../icons-provider';
import { LookupTranslationsComponent } from './lookup-translations.component';

interface Submittable { submit(p: object): { subscribe(o?: object): void } }

describe('LookupTranslationsComponent', () => {
  const lookups = { getLookup: vi.fn(), saveTranslation: vi.fn() };

  interface Page {
    setCategory(code: string | null): void;
    edit(item: object): void;
    config(): Submittable;
    items(): unknown[];
    selected(): unknown;
  }

  function setup(): Page {
    const fixture = TestBed.createComponent(LookupTranslationsComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Page;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    lookups.getLookup.mockResolvedValue([
      {
        id: 'i1',
        code: 'PCE',
        label: 'Pezzo',
        short_label: 'pz',
        metadata: null,
        is_default: true,
      },
    ]);
    lookups.saveTranslation.mockResolvedValue(undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: LookupService, useValue: lookups },
        { provide: PermissionsService, useValue: { canWrite: () => true, canRead: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  it('loads the items of the chosen list', async () => {
    const page = setup();
    page.setCategory('units_of_measure');
    await Promise.resolve();
    await Promise.resolve();
    expect(lookups.getLookup).toHaveBeenCalledWith('units_of_measure', false);
    expect(page.items()).toHaveLength(1);
  });

  it('saves the translation of an item for a language and refreshes the list', async () => {
    const page = setup();
    page.setCategory('units_of_measure');
    page.edit({ id: 'i1', code: 'PCE', label: 'Pezzo' });
    await new Promise<void>((resolve) =>
      page.config().submit({ locale: 'de', label: 'Stück' }).subscribe({ complete: resolve }),
    );
    expect(lookups.saveTranslation).toHaveBeenCalledWith(
      { locale: 'de', label: 'Stück', lookup_item_id: 'i1' },
      'units_of_measure',
    );
    expect(page.selected()).toBeNull();
    expect(lookups.getLookup).toHaveBeenLastCalledWith('units_of_measure', true);
  });
});
