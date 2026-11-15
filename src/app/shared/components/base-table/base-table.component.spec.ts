import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { I18nService } from '@core';
import { icons } from '../../../icons-provider';
import { BaseTableComponent } from './base-table.component';
import { TableColumnDef } from './table.models';

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
}

const columns: TableColumnDef<Row>[] = [{ key: 'name', header: 'Name' }];
const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i, name: `Row ${i}` }));

describe('BaseTableComponent', () => {
  beforeEach(() => {
    globalThis.ResizeObserver ??= class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        {
          provide: I18nService,
          useValue: { currentLanguage: signal('en'), translate: (k: string) => k },
        },
      ],
    });
  });

  function create(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(BaseTableComponent<Row>);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture;
  }

  it('renders every row with a11y attributes in paginated mode', () => {
    const fixture = create({ data: rows(15), columns, total: 15, selectable: true });
    const trs = (fixture.nativeElement as HTMLElement).querySelectorAll('tr.table-row');
    expect(trs.length).toBe(15);
    expect(trs[0].getAttribute('role')).toBe('row');
    expect(trs[0].getAttribute('tabindex')).toBe('0');
    expect(trs[0].getAttribute('aria-selected')).toBe('false');
    expect((fixture.nativeElement as HTMLElement).querySelector('nz-pagination')).not.toBeNull();
  });

  it('emits rowClick on Enter and Space', () => {
    const fixture = create({ data: rows(2), columns, total: 2 });
    const clicked: Row[] = [];
    fixture.componentInstance.rowClick.subscribe((r) => clicked.push(r));
    const tr = (fixture.nativeElement as HTMLElement).querySelector('tr.table-row') as HTMLElement;
    tr.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    tr.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(clicked.length).toBe(2);
  });

  it('toggles aria-expanded on keyboard activation for expandable tables', () => {
    const fixture = create({ data: rows(1), columns, total: 1, expandable: true });
    const tr = (fixture.nativeElement as HTMLElement).querySelector('tr.table-row') as HTMLElement;
    expect(tr.getAttribute('aria-expanded')).toBe('false');
    tr.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(tr.getAttribute('aria-expanded')).toBe('true');
  });

  it('virtual mode always sets both scroll axes and keeps the paginated scroll untouched', () => {
    const virtual = create({ data: rows(1), columns, virtualScroll: true, scroll: { y: '300px' } });
    expect(virtual.componentInstance.tableScroll()).toEqual({ x: '100%', y: '300px' });

    const paginated = create({ data: rows(1), columns, scroll: { x: '900px' } });
    expect(paginated.componentInstance.tableScroll()).toEqual({ x: '900px' });
  });

  it('virtual mode shares explicit column widths between header and body via colgroup', () => {
    const wide: TableColumnDef<Row>[] = [
      { key: 'id', header: 'Id', width: '120px' },
      { key: 'name', header: 'Name', width: '240px' },
    ];
    const fixture = create({ data: rows(50), columns: wide, virtualScroll: true });
    const widths = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('col')).map(
      (c) => (c as HTMLElement).style.width,
    );
    expect(widths).toContain('120px');
    expect(widths).toContain('240px');
  });

  it('virtual mode accepts 100,000 rows, hides pagination and renders only a window', () => {
    const fixture = create({
      data: rows(100_000),
      columns,
      virtualScroll: true,
      virtualItemSize: 44,
      virtualMaxBufferPx: 800,
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.tableScroll()).toEqual({ x: '1200px', y: '480px' });
    expect(el.querySelector('nz-pagination')).toBeNull();
    expect(el.querySelectorAll('tr.table-row').length).toBeLessThan(1000);
  });
});
