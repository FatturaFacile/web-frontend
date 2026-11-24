import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientApiService, TranslateService } from '@core';
import { ArCustomerSelectComponent } from './ar-customer-select.component';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('ArCustomerSelectComponent', () => {
  let clients: { list: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    clients = {
      list: vi.fn(() =>
        of({
          data: [
            { id: 'c-1', company_name: 'Rossi SRL', first_name: null, last_name: null },
            { id: 'c-2', company_name: null, first_name: 'Maria', last_name: 'Bianchi' },
          ],
          meta: {},
        }),
      ),
      get: vi.fn((id: string) => of({ data: { id, company_name: 'Verdi SA' } })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ClientApiService, useValue: clients },
        { provide: TranslateService, useValue: translateSpy },
      ],
    });
  });

  async function create(customerId: string | null = null) {
    const fixture = TestBed.createComponent(ArCustomerSelectComponent);
    fixture.componentRef.setInput('customerId', customerId);
    fixture.detectChanges();
    await wait(300);
    fixture.detectChanges();
    return fixture;
  }

  it('lists the customers on opening, with their display names', async () => {
    const fixture = await create();

    expect(clients.list).toHaveBeenCalledWith({ search: '', per_page: 20 });
    expect(fixture.componentInstance.options()).toEqual([
      { id: 'c-1', name: 'Rossi SRL' },
      { id: 'c-2', name: 'Maria Bianchi' },
    ]);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('searches on the server after a pause in typing, once for a burst', async () => {
    const fixture = await create();
    clients.list.mockClear();

    fixture.componentInstance.search$.next('r');
    fixture.componentInstance.search$.next('ro');
    fixture.componentInstance.search$.next('ros');
    await wait(300);

    expect(clients.list).toHaveBeenCalledTimes(1);
    expect(clients.list).toHaveBeenCalledWith({ search: 'ros', per_page: 20 });
  });

  it('keeps the options when a search fails', async () => {
    const fixture = await create();
    clients.list.mockReturnValueOnce(throwError(() => new Error('down')));

    fixture.componentInstance.search$.next('x');
    await wait(300);

    expect(fixture.componentInstance.options()).toHaveLength(2);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('fetches the selected customer when it is not among the listed ones', async () => {
    const fixture = await create('c-9');
    await fixture.whenStable();

    expect(clients.get).toHaveBeenCalledWith('c-9');
    expect(fixture.componentInstance.options().map((option) => option.name)).toContain('Verdi SA');
  });

  it('lists a customer once when it is both fetched and found by the search', async () => {
    const fixture = await create('c-1');

    const ids = fixture.componentInstance.options().map((option) => option.id);
    expect(ids.filter((id) => id === 'c-1')).toHaveLength(1);
    expect(fixture.componentInstance.options().find((option) => option.id === 'c-1')?.name).toBe('Rossi SRL');
  });

  it('tells the parent which customer was picked, or none when it is cleared', async () => {
    const fixture = await create();
    const changed = vi.fn();
    fixture.componentInstance.customerChange.subscribe(changed);

    fixture.componentInstance.pick('c-2');
    fixture.componentInstance.pick(null);

    expect(changed).toHaveBeenNthCalledWith(1, { id: 'c-2', name: 'Maria Bianchi' });
    expect(changed).toHaveBeenNthCalledWith(2, null);
  });
});
