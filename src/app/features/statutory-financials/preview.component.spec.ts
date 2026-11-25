import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewComponent } from './preview.component';
import { baseProviders, preview, wrap } from './statutory-financials.testing';

describe('PreviewComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = { getPreview: vi.fn(() => of(wrap(preview()))) };
    TestBed.configureTestingModule({ providers: baseProviders(api) });
  });

  async function render() {
    const fixture = TestBed.createComponent(PreviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the taxonomy version, the prefix and the entry point', async () => {
    const root = await render();
    const text = root.textContent as string;

    expect(api['getPreview']).toHaveBeenCalledWith('d-1');
    expect(text).toContain('Bilancio 2025');
    expect(text).toContain('2024-11-04');
    expect(text).toContain('itcc-ci');
    expect(text).toContain('itcc-ci-2024-11-04.xsd');
  });

  it('shows the taxonomy element of each row in monospace next to the amounts', async () => {
    const root = await render();
    const row = root.querySelector('tbody tr.ant-table-row') as HTMLElement;

    expect(row.querySelector('.mono')?.textContent).toBe('itcc-ci:TotaleAttivo');
    expect(row.textContent).toContain('Totale attivo');
    expect(row.textContent).toContain('1.234');
    expect(row.textContent).toContain('1.100');
    expect(root.querySelector('thead')?.textContent).toContain(
      'statutoryFinancials.statement.comparative',
    );
  });

  it('lists the notes and the validation summary', async () => {
    const root = await render();
    const text = root.textContent as string;

    expect(text).toContain('statutoryFinancials.notes.table.off_balance');
    expect(text).toContain('Introduzione');
    expect(text).toContain('statutoryFinancials.validation.warnings');
    expect(text).toContain('120');
  });

  it('shows the XBRL excerpt in a scrollable block and says when it is truncated', async () => {
    const root = await render();
    const excerpt = root.querySelector('pre.xbrl-excerpt') as HTMLElement;

    expect(excerpt.textContent).toContain('<xbrli:xbrl>');
    expect(excerpt.getAttribute('tabindex')).toBe('0');
    expect(root.textContent).toContain('statutoryFinancials.preview.truncated');
  });

  it('does not mention truncation when the excerpt is whole', async () => {
    api['getPreview']?.mockReturnValue(of(wrap(preview({ xbrl_truncated: false }))));
    const root = await render();

    expect(root.textContent).not.toContain('statutoryFinancials.preview.truncated');
  });
});
