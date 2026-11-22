import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CountVariance, InventoryCountApiService } from '@core';
import { inventoryTestProviders } from '../shared/inventory-valuation.testing';
import { CountReconcileComponent } from './count-reconcile.component';

function variance(overrides: Partial<CountVariance> = {}): CountVariance {
  return {
    session: { id: 's1', session_number: 'INV-1', status: 'pending_approval', is_blind: true } as CountVariance['session'],
    summary: {
      lines: 2,
      counted_lines: 2,
      uncounted_lines: 0,
      differing_lines: 2,
      recount_pending_lines: 0,
      system_value_total: '100.00',
      gross_variance_value: '30.00',
      net_variance_value: '-10.00',
      approval_mode: 'multi_level',
      suggested_approval_level: 2,
      within_tolerance: false,
    },
    lines: [
      {
        id: 'l1',
        sku: 'SKU-1',
        item_name: 'Bolt',
        warehouse_bin_id: 'b1',
        bin_barcode: 'BIN-1',
        is_counted: true,
        recount_required: false,
        recount_round: 0,
        system_quantity: '10',
        counted_quantity: '8',
        final_quantity: '8',
        variance_quantity: '-2',
        variance_value: '-20.00',
        variance_percentage: '-20',
        variance_percentage_undefined: false,
      },
      {
        id: 'l2',
        sku: 'SKU-2',
        item_name: 'Nut',
        warehouse_bin_id: 'b1',
        bin_barcode: 'BIN-1',
        is_counted: true,
        recount_required: false,
        recount_round: 0,
        system_quantity: '0',
        counted_quantity: '3',
        final_quantity: '3',
        variance_quantity: '3',
        variance_value: '10.00',
        variance_percentage: null,
        variance_percentage_undefined: true,
      },
    ] as CountVariance['lines'],
    approvals: [
      { id: 'a1', level: 1, required_role: 'warehouse_manager', status: 'pending', decided_by: null, decided_at: null, notes: null },
      { id: 'a2', level: 2, required_role: 'cfo', status: 'pending', decided_by: null, decided_at: null, notes: null },
    ],
    adjustment: {
      id: 'adj-1',
      adjustment_number: 'ADJ-1',
      status: 'pending_approval',
      net_valuation_change: '-10.00',
      journal_entry_id: 'je-9',
      gl_posted_at: null,
    },
    ...overrides,
  };
}

describe('CountReconcileComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  function create(data: CountVariance = variance()) {
    api = {
      getVariance: vi.fn(() => of(data)),
      getEvents: vi.fn(() => of([{ id: 'e1', event: 'session.created', user_id: 'u1', payload: null, created_at: '2026-11-01T10:00:00Z' }])),
      recount: vi.fn(() => of({ recount_lines: 1 })),
      reconcile: vi.fn(() => of({})),
      approve: vi.fn(() => of({})),
      reject: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({
      imports: [CountReconcileComponent],
      providers: [
        ...inventoryTestProviders(),
        { provide: InventoryCountApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 's1' })) } },
      ],
    });
    const fixture = TestBed.createComponent(CountReconcileComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('shows system, counted and variance columns, the undefined label, and the ledger links', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('[data-testid="variance-lines"] tbody tr').length).toBe(2);
    const percents = Array.from(el.querySelectorAll('[data-testid="variance-percent"]')).map((c) => c.textContent?.trim());
    expect(percents[0]).toContain('20');
    expect(percents[1]).toBe('INVENTORY_COUNT.RECON.UNDEFINED');
    expect(el.querySelector('[data-testid="journal-entry"]')?.textContent).toBe('je-9');
    expect(el.textContent).toContain('ADJ-1');
    expect(el.textContent).toContain('session.created');
  });

  it('offers approve / reject only for the pending level that can be decided', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="decision-level-1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="decision-level-2"]')).toBeNull();
  });

  it('hides the decision buttons once every level is decided', () => {
    const data = variance();
    data.approvals = data.approvals.map((a) => ({ ...a, status: 'approved' as const }));
    const fixture = create(data);

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="approve-btn"]')).toBeNull();
  });

  it('requires a reason to reject and sends the level and reason', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openDecision(1, 'reject');
    expect(c.decisionValid()).toBe(false);
    c.confirmDecision();
    expect(api['reject']).not.toHaveBeenCalled();

    c.decisionText.set('  Wrong count  ');
    c.confirmDecision();
    expect(api['reject']).toHaveBeenCalledWith('s1', 1, 'Wrong count');
  });

  it('approves with optional notes', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openDecision(1, 'approve');
    expect(c.decisionValid()).toBe(true);
    c.confirmDecision();
    expect(api['approve']).toHaveBeenCalledWith('s1', 1, undefined);
  });

  it('sends the selected lines to a recount', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    expect(c.canRecount()).toBe(false);
    c.toggleLine('l1', true);
    c.recount();
    expect(api['recount']).toHaveBeenCalledWith('s1', ['l1']);
  });
});
