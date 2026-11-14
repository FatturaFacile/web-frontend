import { AfterViewInit, Directive, ElementRef, inject, OnDestroy } from '@angular/core';
import { exportXlsx } from '../utils/export-xlsx';

/**
 * Adds a toolbar above every `<nz-table>` the directive is imported for:
 *  - "Raggruppa per": groups the rows of the page by a sortable column (collapsible group header rows);
 *  - "Excel": exports the rows currently rendered (headers and cells as shown) to a real `.xlsx` file.
 */
// eslint-disable-next-line @angular-eslint/directive-selector -- intentionally targets every <nz-table>
@Directive({ selector: 'nz-table' })
export class GridExportDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private bar: HTMLElement | null = null;
  private select: HTMLSelectElement | null = null;
  private observer: MutationObserver | null = null;
  private groupIndex: number | null = null;

  ngAfterViewInit(): void {
    const parent = this.host.parentElement;
    if (typeof document === 'undefined' || !parent) {
      return;
    }
    const bar = document.createElement('div');
    bar.className = 'grid-export-bar';

    const select = document.createElement('select');
    select.className = 'grid-group-select ant-input ant-input-sm';
    select.dataset['testid'] = 'grid-group-by';
    select.setAttribute('aria-label', 'Raggruppa per');
    select.addEventListener('focus', () => this.fillGroupOptions());
    select.addEventListener('mousedown', () => this.fillGroupOptions());
    select.addEventListener('change', () => this.applyGrouping(select.value));
    this.fillGroupOptions();
    bar.appendChild(select);
    this.select = select;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ant-btn ant-btn-text ant-btn-sm grid-export-button';
    button.dataset['testid'] = 'grid-export-xlsx';
    button.title = 'Esporta in Excel (xlsx)';
    button.setAttribute('aria-label', 'Esporta in Excel (xlsx)');
    button.textContent = '⬇ Excel';
    button.addEventListener('click', () => void this.export());
    bar.appendChild(button);

    parent.insertBefore(bar, this.host);
    this.bar = bar;
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.bar?.remove();
  }

  /** Header cells of the first header row that can be sorted (their rows can be made contiguous). */
  private groupableHeaders(): { index: number; title: string; th: HTMLElement }[] {
    const ths = Array.from(this.host.querySelectorAll<HTMLElement>('.ant-table-thead th'));
    return ths
      .map((th, index) => ({ index, title: (th.innerText ?? '').trim().split('\n')[0].trim(), th }))
      .filter((h) => h.title !== '' && h.th.querySelector('.ant-table-column-sorters') !== null);
  }

  private fillGroupOptions(): void {
    const select = this.select;
    if (!select) {
      return;
    }
    const headers = this.groupableHeaders();
    const wanted = ['', ...headers.map((h) => String(h.index))].join('|');
    if (select.dataset['signature'] === wanted) {
      return;
    }
    select.dataset['signature'] = wanted;
    select.replaceChildren();
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Raggruppa per…';
    select.appendChild(none);
    for (const h of headers) {
      const option = document.createElement('option');
      option.value = String(h.index);
      option.textContent = h.title;
      select.appendChild(option);
    }
    select.value = this.groupIndex === null ? '' : String(this.groupIndex);
  }

  private applyGrouping(value: string): void {
    this.observer?.disconnect();
    this.observer = null;
    this.clearGroupRows();
    if (value === '') {
      this.groupIndex = null;
      return;
    }
    const index = Number(value);
    const header = this.groupableHeaders().find((h) => h.index === index);
    if (!header) {
      return;
    }
    this.groupIndex = index;
    // Sort the column ascending so equal values are contiguous.
    for (let i = 0; i < 3 && !header.th.querySelector('.ant-table-column-sorter-up.active'); i++) {
      header.th.querySelector<HTMLElement>('.ant-table-column-sorters')?.click();
    }
    const body = this.host.querySelector('.ant-table-tbody');
    if (!body) {
      return;
    }
    this.renderGroupRows();
    this.observer = new MutationObserver(() => {
      this.observer?.disconnect();
      this.renderGroupRows();
      this.observer?.observe(body, { childList: true, subtree: false });
    });
    this.observer.observe(body, { childList: true, subtree: false });
  }

  private clearGroupRows(): void {
    this.host.querySelectorAll('.grid-group-row').forEach((row) => row.remove());
    this.host
      .querySelectorAll<HTMLElement>('.ant-table-tbody > tr[data-grid-collapsed]')
      .forEach((row) => {
        row.style.display = '';
        row.removeAttribute('data-grid-collapsed');
      });
  }

  private renderGroupRows(): void {
    this.clearGroupRows();
    const index = this.groupIndex;
    const body = this.host.querySelector('.ant-table-tbody');
    if (index === null || !body) {
      return;
    }
    const rows = Array.from(body.querySelectorAll<HTMLElement>(':scope > tr.ant-table-row'));
    const columns = this.host.querySelectorAll('.ant-table-thead th').length;
    let currentLabel: string | null = null;
    let members: HTMLElement[] = [];
    let header: HTMLElement | null = null;
    const finish = (): void => {
      const counter = header?.querySelector('.grid-group-count');
      if (counter) {
        counter.textContent = ` (${members.length})`;
      }
    };
    for (const row of rows) {
      const label =
        ((row.children.item(index) as HTMLElement | null)?.innerText ?? '')
          .replace(/\s+/g, ' ')
          .trim() || '—';
      if (label !== currentLabel || header === null) {
        finish();
        currentLabel = label;
        const own: HTMLElement[] = [];
        members = own;
        header = this.createGroupRow(label, columns, () => own);
        body.insertBefore(header, row);
      }
      members.push(row);
    }
    finish();
  }

  private createGroupRow(label: string, columns: number, rows: () => HTMLElement[]): HTMLElement {
    const tr = document.createElement('tr');
    tr.className = 'grid-group-row';
    const td = document.createElement('td');
    td.colSpan = columns;
    td.style.cursor = 'pointer';
    td.style.fontWeight = '600';
    const name = document.createElement('span');
    name.textContent = `▾ ${label}`;
    const count = document.createElement('span');
    count.className = 'grid-group-count';
    td.append(name, count);
    td.addEventListener('click', () => {
      const collapsed = tr.dataset['collapsed'] !== 'true';
      tr.dataset['collapsed'] = String(collapsed);
      name.textContent = `${collapsed ? '▸' : '▾'} ${label}`;
      for (const row of rows()) {
        row.style.display = collapsed ? 'none' : '';
        if (collapsed) {
          row.setAttribute('data-grid-collapsed', 'true');
        } else {
          row.removeAttribute('data-grid-collapsed');
        }
      }
    });
    tr.appendChild(td);
    return tr;
  }

  private async export(): Promise<void> {
    const headers = Array.from(this.host.querySelectorAll<HTMLElement>('.ant-table-thead th'));
    const rows = Array.from(
      this.host.querySelectorAll<HTMLElement>('.ant-table-tbody > tr.ant-table-row'),
    );
    const keep = headers
      .map((th, index) => ({ index, title: (th.innerText ?? '').trim().split('\n')[0].trim() }))
      .filter((h) => h.title !== '');
    const columns = keep.map((h) => ({
      header: h.title,
      values: rows.map((row) => toValue(row.children.item(h.index) as HTMLElement | null)),
    }));
    await exportXlsx(columns, 'export');
  }
}

function toValue(cell: HTMLElement | null): string | number {
  const text = (cell?.innerText ?? '').replace(/\s+/g, ' ').trim();
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
}
