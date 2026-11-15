import { Directive, ElementRef, inject, output } from '@angular/core';

const CELL_SELECTOR = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
const ROW_SELECTOR = 'tr, [role="row"]';

/**
 * Excel-like keyboard navigation for grids and line-item tables.
 * Arrows move between cells, Enter advances, Alt+N adds a row,
 * Ctrl+Backspace deletes the active row, Ctrl+S saves in bulk.
 */
@Directive({
  selector: '[appGridKeyboardNav]',
  host: {
    '(keydown)': 'onKeydown($event)',
  },
})
export class GridKeyboardNavDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly requestAddRow = output<void>();
  readonly requestDeleteRow = output<HTMLElement | null>();
  readonly requestBulkSave = output<void>();

  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.requestBulkSave.emit();
      return;
    }
    if (event.altKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      this.requestAddRow.emit();
      return;
    }
    if (event.ctrlKey && event.key === 'Backspace') {
      event.preventDefault();
      this.requestDeleteRow.emit(this.activeRow());
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target?.matches(CELL_SELECTOR) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
        this.moveVertical(event, target, -1);
        break;
      case 'ArrowDown':
        this.moveVertical(event, target, 1);
        break;
      case 'ArrowLeft':
        if (this.canLeaveHorizontally(target, 'left')) this.moveHorizontal(event, target, -1);
        break;
      case 'ArrowRight':
        if (this.canLeaveHorizontally(target, 'right')) this.moveHorizontal(event, target, 1);
        break;
      case 'Enter':
        this.advance(event, target);
        break;
    }
  }

  private rows(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(ROW_SELECTOR)).filter(
      (row) => row.querySelector(CELL_SELECTOR) !== null,
    );
  }

  private cellsOf(row: HTMLElement): HTMLElement[] {
    return Array.from(row.querySelectorAll<HTMLElement>(CELL_SELECTOR));
  }

  private activeRow(): HTMLElement | null {
    const active = document.activeElement as HTMLElement | null;
    return active && this.host.nativeElement.contains(active) ? active.closest<HTMLElement>(ROW_SELECTOR) : null;
  }

  private position(target: HTMLElement): { rows: HTMLElement[]; row: number; col: number } | null {
    const rows = this.rows();
    const rowEl = target.closest<HTMLElement>(ROW_SELECTOR);
    const row = rowEl ? rows.indexOf(rowEl) : -1;
    if (!rowEl || row < 0) return null;
    return { rows, row, col: this.cellsOf(rowEl).indexOf(target) };
  }

  private focus(event: KeyboardEvent, el: HTMLElement | undefined): boolean {
    if (!el) return false;
    event.preventDefault();
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
    return true;
  }

  private moveVertical(event: KeyboardEvent, target: HTMLElement, delta: number): void {
    if (target instanceof HTMLSelectElement && event.key !== 'Enter') return; // keep native option cycling
    const pos = this.position(target);
    if (!pos) return;
    const nextRow = pos.rows[pos.row + delta];
    if (nextRow) this.focus(event, this.cellsOf(nextRow)[pos.col] ?? this.cellsOf(nextRow).at(-1));
  }

  private moveHorizontal(event: KeyboardEvent, target: HTMLElement, delta: number): void {
    const pos = this.position(target);
    if (!pos) return;
    this.focus(event, this.cellsOf(pos.rows[pos.row])[pos.col + delta]);
  }

  private advance(event: KeyboardEvent, target: HTMLElement): void {
    if (target instanceof HTMLTextAreaElement) return;
    const pos = this.position(target);
    if (!pos) return;
    const cells = this.cellsOf(pos.rows[pos.row]);
    const nextRow = pos.rows[pos.row + 1];
    if (pos.col === cells.length - 1 && !nextRow) {
      event.preventDefault();
      this.requestAddRow.emit();
      return;
    }
    this.focus(event, cells[pos.col + 1] ?? (nextRow ? this.cellsOf(nextRow)[0] : undefined));
  }

  /** Text inputs only hand focus over when the caret is at the edge, so editing stays natural. */
  private canLeaveHorizontally(target: HTMLElement, edge: 'left' | 'right'): boolean {
    if (!(target instanceof HTMLInputElement) || target.selectionStart === null) return true;
    const { selectionStart, selectionEnd, value } = target;
    // A fully selected value (entered via navigation) may always be left.
    if (selectionStart === 0 && selectionEnd === value.length) return true;
    return edge === 'left' ? selectionStart === 0 && selectionEnd === 0 : selectionStart === value.length;
  }
}
