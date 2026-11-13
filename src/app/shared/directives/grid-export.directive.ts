import { AfterViewInit, Directive, ElementRef, inject, OnDestroy } from '@angular/core';
import { exportXlsx } from '../utils/export-xlsx';

/**
 * Adds an "Excel" button above every `<nz-table>` that exports the rows currently rendered
 * (headers and cells as shown) to a real `.xlsx` file. Applies to every table the directive is imported for.
 */
// eslint-disable-next-line @angular-eslint/directive-selector -- intentionally targets every <nz-table>
@Directive({ selector: 'nz-table' })
export class GridExportDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private bar: HTMLElement | null = null;

  ngAfterViewInit(): void {
    const parent = this.host.parentElement;
    if (typeof document === 'undefined' || !parent) {
      return;
    }
    const bar = document.createElement('div');
    bar.className = 'grid-export-bar';
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
    this.bar?.remove();
  }

  private async export(): Promise<void> {
    const headers = Array.from(this.host.querySelectorAll<HTMLElement>('.ant-table-thead th'));
    const rows = Array.from(this.host.querySelectorAll<HTMLElement>('.ant-table-tbody > tr.ant-table-row'));
    const keep = headers
      .map((th, index) => ({ index, title: (th.innerText ?? '').trim() }))
      .filter((h) => h.title !== '');
    const columns = keep.map((h) => ({
      header: h.title,
      values: rows.map((row) => toValue(row.children.item(h.index) as HTMLElement | null)),
    }));
    await exportXlsx(columns, document.title ? document.title.split('|')[0].trim() || 'export' : 'export');
  }
}

function toValue(cell: HTMLElement | null): string | number {
  const text = (cell?.innerText ?? '').replace(/\s+/g, ' ').trim();
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
}
