import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AccessApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { AccessMatrixComponent } from './matrix.component';

const matrix = {
  modules: ['crm', 'treasury'],
  roles: [
    { key: 'owner', name: 'Owner', custom: false, base_role: 'owner', access: { crm: { read: true, write: true }, treasury: { read: true, write: true } } },
    { key: 'custom:r1', id: 'r1', name: 'Bookkeeper', custom: true, base_role: 'accountant', access: { crm: { read: true, write: false }, treasury: { read: false, write: false } } },
  ],
};

describe('AccessMatrixComponent', () => {
  it('renders a row per role and a column per module with read and write marks', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: AccessApiService, useValue: { getMatrix: vi.fn().mockReturnValue(of({ success: true, message: '', data: matrix })) } },
        { provide: NzMessageService, useValue: { error: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(AccessMatrixComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('[data-test="matrix-module"]').length).toBe(2);
    const rows = root.querySelectorAll('[data-test="matrix-row"]');
    expect(rows.length).toBe(2);
    const marks = (row: Element): string[] => Array.from(row.querySelectorAll('[data-mark]')).map((el) => el.getAttribute('data-mark') ?? '');
    expect(marks(rows[0])).toEqual(['write', 'write']);
    expect(marks(rows[1])).toEqual(['read', 'none']);
    expect(rows[1].textContent).toContain('Bookkeeper');
  });
});
