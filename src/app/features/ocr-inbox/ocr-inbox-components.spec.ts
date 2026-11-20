import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmApiService } from '../../core/api/crm-api.service';
import { PlatformApiService } from '../../core/api/platform-api.service';
import { icons } from '../../icons-provider';
import { DocumentBoundingBoxViewerComponent } from './document-bounding-box-viewer.component';
import { DocumentPageRenderer } from './document-page-renderer.service';
import { ExtractionReviewFormComponent } from './extraction-review-form.component';
import { OcrInboxApiService } from './ocr-inbox-api.service';
import { OcrInboxPageComponent } from './ocr-inbox-page.component';
import { OcrInboxStore } from './ocr-inbox.store';
import {
  boxesFixture,
  pageFixture,
  payloadFixture,
  purchaseOrderFixture,
  workbenchFixture,
} from './ocr-inbox.testing';
import { Workbench } from './ocr-inbox.models';

const ok = <T>(data: T) => of({ success: true, message: '', data });
const job = {
  id: 'job-1',
  dms_document_id: 'doc-1',
  status: 'confirmed' as const,
  document_category: 'vendor_invoice' as const,
  resulting_entity_type: 'supplier_invoice',
  resulting_entity_id: 'inv-1',
};

const q = (fixture: ComponentFixture<unknown>, selector: string): HTMLElement | null =>
  (fixture.nativeElement as HTMLElement).querySelector(selector);
const all = (fixture: ComponentFixture<unknown>, selector: string): HTMLElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));
const byId = (fixture: ComponentFixture<unknown>, id: string): HTMLElement | null =>
  q(fixture, `[data-testid="${id}"]`);

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function baseProviders(overrides: unknown[] = []): unknown[] {
  return [provideNzIcons(icons), provideNzI18n(en_US), provideNzDateFnsAdapter(), ...overrides];
}

describe('document bounding box viewer', () => {
  let renderer: {
    load: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  let fixture: ComponentFixture<DocumentBoundingBoxViewerComponent>;
  const source = {
    url: 'https://api.test/source?signature=x',
    mime_type: 'application/pdf',
    file_name: 'r.pdf',
  };

  async function create(inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(DocumentBoundingBoxViewerComponent);
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('boxes', boxesFixture);
    fixture.componentRef.setInput('confidence', payloadFixture().field_confidence);

    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }

    await settle(fixture);
    await settle(fixture);
  }

  const rects = (): HTMLElement[] => all(fixture, 'rect.box');

  beforeEach(() => {
    renderer = {
      load: vi.fn(async () => 2),
      render: vi.fn(async () => ({ width: 500, height: 1000 })),
      destroy: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: baseProviders([{ provide: DocumentPageRenderer, useValue: renderer }]) as never,
    });
  });

  afterEach(() => vi.useRealTimers());

  it('loads the source, draws the first page and shows only the boxes of that page', async () => {
    await create();

    expect(renderer.load).toHaveBeenCalledWith(source.url, 'application/pdf');
    expect(renderer.render).toHaveBeenCalledWith(1, 100, 0, expect.any(HTMLCanvasElement));
    expect(byId(fixture, 'page-of')?.textContent).toContain('OCR_INBOX.PAGE_OF');
    expect(rects().map((rect) => rect.dataset['testid'])).toEqual([
      'box-header.document_number',
      'box-header.issue_date',
      'box-lines[0].unit_price',
    ]);

    (byId(fixture, 'next-page') as HTMLButtonElement).click();
    await settle(fixture);

    expect(rects().map((rect) => rect.dataset['testid'])).toEqual(['box-lines[1].unit_price']);
    expect(renderer.render).toHaveBeenLastCalledWith(2, 100, 0, expect.any(HTMLCanvasElement));
    expect((byId(fixture, 'next-page') as HTMLButtonElement).disabled).toBe(true);
  });

  it('colours the boxes by confidence: green from 90, amber from 70, red below, with a different outline for each', async () => {
    await create({
      confidence: {
        'header.document_number': 100,
        'header.issue_date': 82,
        'lines[0].unit_price': 40,
      },
    });

    const [high, medium, low] = rects();

    expect(high.getAttribute('stroke')).toBe('#2f9e44');
    expect(high.getAttribute('stroke-dasharray')).toBe('none');
    expect(medium.getAttribute('stroke')).toBe('#e67700');
    expect(medium.getAttribute('stroke-dasharray')).toBe('6 3');
    expect(low.getAttribute('stroke')).toBe('#d6336c');
    expect(low.getAttribute('stroke-dasharray')).toBe('2 3');
    expect(low.getAttribute('aria-label')).toContain('OCR_INBOX.CONFIDENCE_LOW');
    expect(low.getAttribute('aria-label')).toContain('40%');
  });

  it('reports a clicked box, and one activated from the keyboard', async () => {
    await create();
    const selected: string[] = [];
    fixture.componentInstance.boxSelected.subscribe((key) => selected.push(key));

    byId(fixture, 'box-header.issue_date')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    byId(fixture, 'box-lines[0].unit_price')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );

    expect(selected).toEqual(['header.issue_date', 'lines[0].unit_price']);
  });

  it('brings the active field closer, scrolls to it and pulses it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await create();
    const scroll = vi.fn();
    (byId(fixture, 'viewer-scroll') as HTMLElement).scrollTo = scroll;

    fixture.componentRef.setInput('activeKey', 'header.document_number');
    fixture.componentRef.setInput('focusTick', 1);
    await settle(fixture);
    await settle(fixture);

    const active = byId(fixture, 'box-header.document_number') as HTMLElement;

    expect(byId(fixture, 'zoom-level')?.textContent).toContain('OCR_INBOX.ZOOM_LEVEL');
    expect(renderer.render).toHaveBeenLastCalledWith(1, 150, 0, expect.any(HTMLCanvasElement));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.calls[0][0].behavior).toBe('smooth');
    expect(active.classList.contains('active')).toBe(true);
    expect(active.classList.contains('pulse-b')).toBe(true);
    expect(active.getAttribute('aria-pressed')).toBe('true');

    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    expect(active.classList.contains('pulse-b')).toBe(false);

    fixture.componentRef.setInput('focusTick', 2);
    await settle(fixture);
    expect(active.classList.contains('pulse-a')).toBe(true);
  });

  it('turns to the page of an active field that is on another page', async () => {
    await create();

    fixture.componentRef.setInput('activeKey', 'lines[1].unit_price');
    fixture.componentRef.setInput('focusTick', 1);
    await settle(fixture);
    await settle(fixture);

    expect(renderer.render).toHaveBeenLastCalledWith(2, 150, 0, expect.any(HTMLCanvasElement));
    expect(byId(fixture, 'box-lines[1].unit_price')?.classList.contains('active')).toBe(true);
  });

  it('zooms between 50% and 300% and disables the buttons at the limits', async () => {
    await create();
    const zoomIn = byId(fixture, 'zoom-in') as HTMLButtonElement;
    const zoomOut = byId(fixture, 'zoom-out') as HTMLButtonElement;

    for (let step = 0; step < 10; step++) {
      zoomIn.click();
      fixture.detectChanges();
    }
    expect(zoomIn.disabled).toBe(true);
    await settle(fixture);
    expect(renderer.render).toHaveBeenLastCalledWith(1, 300, 0, expect.any(HTMLCanvasElement));

    for (let step = 0; step < 12; step++) {
      zoomOut.click();
      fixture.detectChanges();
    }
    expect(zoomOut.disabled).toBe(true);
    await settle(fixture);
    expect(renderer.render).toHaveBeenLastCalledWith(1, 50, 0, expect.any(HTMLCanvasElement));
  });

  it('rotates the page and the boxes with it', async () => {
    await create();
    const before = byId(fixture, 'box-header.document_number') as HTMLElement;
    expect(before.getAttribute('x')).toBe('0.1');

    (byId(fixture, 'rotate') as HTMLButtonElement).click();
    await settle(fixture);

    const turned = byId(fixture, 'box-header.document_number') as HTMLElement;
    expect(renderer.render).toHaveBeenLastCalledWith(1, 100, 90, expect.any(HTMLCanvasElement));
    expect(Number(turned.getAttribute('x'))).toBeCloseTo(0.77);
    expect(Number(turned.getAttribute('y'))).toBeCloseTo(0.1);
    expect(Number(turned.getAttribute('width'))).toBeCloseTo(0.03);
    expect(Number(turned.getAttribute('height'))).toBeCloseTo(0.2);
  });

  it('reports the rubber-band region in the coordinates of the page as stored, also when the page is turned', async () => {
    await create();
    const overlay = byId(fixture, 'overlay') as unknown as SVGSVGElement;
    overlay.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 500,
      height: 1000,
      right: 500,
      bottom: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const regions: { box: unknown }[] = [];
    fixture.componentInstance.regionSelected.subscribe((region) => regions.push(region));
    const pointer = (type: string, x: number, y: number) =>
      overlay.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }),
      );

    // Without the region mode a drag only pans the page.
    pointer('pointerdown', 100, 200);
    pointer('pointerup', 300, 600);
    expect(regions).toEqual([]);

    (byId(fixture, 'region-mode') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(byId(fixture, 'region-mode')?.getAttribute('aria-pressed')).toBe('true');

    pointer('pointerdown', 100, 200);
    pointer('pointermove', 200, 400);
    fixture.detectChanges();
    expect(byId(fixture, 'region-draft')).not.toBeNull();
    pointer('pointerup', 300, 600);
    fixture.detectChanges();

    expect(byId(fixture, 'region-draft')).toBeNull();
    expect(regions).toHaveLength(1);
    const first = regions[0].box as {
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };
    expect(first).toMatchObject({ page: 1 });
    expect(first.x).toBeCloseTo(0.2);
    expect(first.y).toBeCloseTo(0.2);
    expect(first.width).toBeCloseTo(0.4);
    expect(first.height).toBeCloseTo(0.4);

    // A click without a drag is not a region.
    pointer('pointerdown', 100, 100);
    pointer('pointerup', 100, 100);
    expect(regions).toHaveLength(1);

    (byId(fixture, 'rotate') as HTMLButtonElement).click();
    await settle(fixture);
    pointer('pointerdown', 100, 200);
    pointer('pointerup', 300, 600);
    const turned = regions[1].box as { x: number; y: number; width: number; height: number };
    // The turned page shows the stored page rotated clockwise: the stored box is the inverse rotation of the drawn one.
    expect(turned.width).toBeCloseTo(0.4);
    expect(turned.height).toBeCloseTo(0.4);
    expect(turned.x).toBeCloseTo(0.2);
    expect(turned.y).toBeCloseTo(0.4);
  });

  it('says so when the document cannot be loaded', async () => {
    renderer.load.mockRejectedValue(new Error('HTTP 403'));
    await create();

    expect(byId(fixture, 'viewer-error')?.textContent).toContain('OCR_INBOX.VIEWER_ERROR');
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('releases the document when it is destroyed', async () => {
    await create();
    fixture.destroy();

    expect(renderer.destroy).toHaveBeenCalled();
  });
});

describe('extraction review form', () => {
  const message = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let crm: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<ExtractionReviewFormComponent>;
  let store: OcrInboxStore;

  interface Internals {
    form: {
      controls: {
        gross: { setValue(value: string): void };
        currency: { setValue(value: string): void };
        lines: {
          at(index: number): {
            controls: Record<string, { value: unknown; setValue(value: unknown): void }>;
          };
          length: number;
        };
      };
    };
  }
  const view = (): Internals => fixture.componentInstance as unknown as Internals;

  async function create(workbench: Workbench = workbenchFixture()): Promise<void> {
    store = TestBed.inject(OcrInboxStore);
    store.workbench.set(workbench);
    store.selectedId.set(workbench.id);
    fixture = TestBed.createComponent(ExtractionReviewFormComponent);
    fixture.componentRef.setInput('workbench', workbench);
    document.body.appendChild(fixture.nativeElement);
    await settle(fixture);
    await settle(fixture);
  }

  const input = (testId: string): HTMLInputElement => byId(fixture, testId) as HTMLInputElement;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      inbox: vi.fn(() => ok(pageFixture())),
      workbench: vi.fn(() => ok(workbenchFixture())),
      saveDraft: vi.fn(() => ok({ ...job, status: 'ready_for_review' })),
      confirm: vi.fn(() => ok(job)),
      reject: vi.fn(() => ok({ ...job, status: 'rejected' })),
      rerun: vi.fn(() => ok({ ...job, status: 'queued' })),
    };
    crm = {
      getSuppliers: vi.fn(() => of({ success: true, message: '', data: [], meta: {} })),
      createContact: vi.fn(() =>
        ok({ id: 'v-new', company_name: 'Muster AG', first_name: null, last_name: null }),
      ),
    };
    TestBed.configureTestingModule({
      providers: baseProviders([
        { provide: OcrInboxApiService, useValue: api },
        { provide: CrmApiService, useValue: crm },
        { provide: NzMessageService, useValue: message },
      ]) as never,
    });
  });

  afterEach(() => fixture?.nativeElement.remove());

  it('names how the fields were obtained: Swiss QR-bill, XML invoice or AI vision OCR with the engine', async () => {
    await create();
    expect(byId(fixture, 'trust-banner')?.classList.contains('qr')).toBe(true);
    expect(byId(fixture, 'trust-label')?.textContent).toContain('OCR_INBOX.BANNER_QR');
    expect(byId(fixture, 'trust-confidence')?.textContent).toContain('OCR_INBOX.BANNER_CONFIDENCE');
    fixture.destroy();

    await create(
      workbenchFixture({
        extraction_method: 'embedded_xml_or_qr',
        ocr_provider_used: null,
        payload: payloadFixture({ meta: { source_format: 'fatturapa' } }),
        overall_confidence_score: 100,
      }),
    );
    expect(byId(fixture, 'trust-banner')?.classList.contains('xml')).toBe(true);
    expect(byId(fixture, 'trust-label')?.textContent).toContain('OCR_INBOX.BANNER_XML');
    fixture.destroy();

    await create(
      workbenchFixture({
        extraction_method: 'vision_llm_ocr',
        payload: payloadFixture({ meta: { source_format: 'ocr' } }),
      }),
    );
    expect(byId(fixture, 'trust-banner')?.classList.contains('ocr')).toBe(true);
    expect(byId(fixture, 'trust-label')?.textContent).toContain('OCR_INBOX.BANNER_OCR');
    expect(byId(fixture, 'ocr-warning')).toBeNull();
  });

  it('warns when the OCR engine could not read the lines of a QR-bill', async () => {
    await create(
      workbenchFixture({
        payload: payloadFixture({
          meta: { source_format: 'swiss_qr_bill', warnings: ['ocr_unavailable'] },
          lines: [],
        }),
      }),
    );

    expect(byId(fixture, 'ocr-warning')).not.toBeNull();
  });

  it('shows the extraction with its coding suggestions and the confidence of each', async () => {
    await create();

    expect(input('document-number').value).toBe('R-2026-17');
    expect(view().form.controls.lines.length).toBe(2);
    expect(view().form.controls.lines.at(0).controls['glAccountId'].value).toBe('gl-1');
    expect(view().form.controls.lines.at(0).controls['vatCodeId'].value).toBe('vat-std');
    expect(byId(fixture, 'coding-confidence-0')?.textContent).toContain('100');
    expect(byId(fixture, 'coding-confidence-0')?.dataset['band']).toBe('high');
    expect(byId(fixture, 'coding-confidence-1')).toBeNull();
    // The second line has no suggestion, so its VAT code is found from its rate.
    expect(view().form.controls.lines.at(1).controls['vatCodeId'].value).toBe('vat-red');
    expect(input('document-number').closest('.field')?.classList.contains('band-high')).toBe(true);
    expect(all(fixture, 'td.field.band-medium')).toHaveLength(1);
    expect(all(fixture, 'td.field.band-low')).toHaveLength(1);
  });

  it('reports the field that gets the focus, so the document shows its region', async () => {
    await create();

    input('document-number').dispatchEvent(new FocusEvent('focus'));
    expect(store.activeFieldKey()).toBe('header.document_number');
    expect(store.activeBox()).toEqual(boxesFixture['header.document_number']);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLInputElement>('[data-field="lines[0].unit_price"]')
      ?.dispatchEvent(new FocusEvent('focus'));
    expect(store.activeFieldKey()).toBe('lines[0].unit_price');
  });

  it('takes the focus when the document chooses a field, without bouncing the choice back', async () => {
    await create();
    const tick = store.focusTick();

    store.focusField('header.issue_date');
    await settle(fixture);

    const date = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-field="header.issue_date"]',
    );
    expect(document.activeElement).toBe(date);
    expect(store.focusTick()).toBe(tick + 1);
    expect(date?.closest('.field')?.classList.contains('active')).toBe(true);

    store.focusField('vendor.name');
    await settle(fixture);
    expect(document.activeElement?.closest('nz-select')?.getAttribute('data-field')).toBe(
      'vendor.name',
    );
  });

  it('checks that the lines plus VAT equal the gross total, with the rounding tolerance of the currency', async () => {
    await create();
    expect(byId(fixture, 'totals-ok')).not.toBeNull();
    expect(byId(fixture, 'total-net')?.textContent).toContain('1,250.00');

    view().form.controls.gross.setValue('1356.15');
    await settle(fixture);
    expect(byId(fixture, 'totals-ok')).not.toBeNull();

    view().form.controls.gross.setValue('1356.16');
    await settle(fixture);
    expect(byId(fixture, 'totals-ok')).toBeNull();
    expect(byId(fixture, 'totals-difference')?.textContent).toContain(
      'OCR_INBOX.TOTALS_DIFFERENCE',
    );

    view().form.controls.currency.setValue('EUR');
    view().form.controls.gross.setValue('1356.11');
    await settle(fixture);
    expect(byId(fixture, 'totals-ok')).not.toBeNull();
    view().form.controls.gross.setValue('1356.12');
    await settle(fixture);
    expect(byId(fixture, 'totals-difference')).not.toBeNull();
  });

  it('recomputes the net of a line from quantity and price, and the rate from the VAT code', async () => {
    await create();
    const line = view().form.controls.lines.at(0).controls;

    line['quantity'].setValue('2');
    line['unitPrice'].setValue('99.5');
    expect(line['netAmount'].value).toBe('199');

    line['vatCodeId'].setValue('vat-red');
    expect(line['vatRate'].value).toBe(2.6);
  });

  it('adds and removes lines', async () => {
    await create();

    (byId(fixture, 'add-line') as HTMLButtonElement).click();
    await settle(fixture);
    expect(all(fixture, '[data-testid^="line-"]')).toHaveLength(3);

    (byId(fixture, 'remove-line-2') as HTMLButtonElement).click();
    await settle(fixture);
    expect(all(fixture, '[data-testid^="line-"]')).toHaveLength(2);
  });

  it('shows the purchase order with its variances, links a line in one click and asks for a reason to override', async () => {
    await create();

    expect(byId(fixture, 'match-po-1')?.textContent).toContain('OCR_INBOX.MATCH_PURCHASE_ORDER');
    expect(byId(fixture, 'match-status-po-1')?.textContent).toContain('OCR_INBOX.MATCH_VARIANCE');
    expect(byId(fixture, 'match-line-0')?.textContent).toContain('OCR_INBOX.MATCH_PRICE_VARIANCE');
    expect(byId(fixture, 'override-reason')).not.toBeNull();
    expect((byId(fixture, 'link-line-0') as HTMLButtonElement).disabled).toBe(false);

    (byId(fixture, 'link-line-0') as HTMLButtonElement).click();
    await settle(fixture);

    expect(view().form.controls.lines.at(0).controls['purchaseOrderLineId'].value).toBe('pol-1');
    expect((byId(fixture, 'link-line-0') as HTMLButtonElement).disabled).toBe(true);
  });

  it('needs no override reason when the order matches', async () => {
    await create(
      workbenchFixture({
        three_way_match: {
          purchase_orders: [
            purchaseOrderFixture({
              evaluation: {
                purchase_order_id: 'po-1',
                purchase_order_number: 'PO-2026-77',
                status: 'matched',
                lines: [],
                unmatched_invoice_lines: [],
              },
            }),
          ],
        },
      }),
    );

    expect(byId(fixture, 'override-reason')).toBeNull();
  });

  it('says so when no order matches the document', async () => {
    await create(workbenchFixture({ three_way_match: { purchase_orders: [] } }));

    expect(byId(fixture, 'match-none')).not.toBeNull();
  });

  it('confirms the reviewed document with its coding, the linked orders and receipts', async () => {
    await create();
    const line = view().form.controls.lines.at(0).controls;
    line['glAccountId'].setValue('gl-2');
    input('override-reason').value = 'Agreed by phone';
    input('override-reason').dispatchEvent(new Event('input'));
    (byId(fixture, 'link-line-0') as HTMLButtonElement).click();
    await settle(fixture);

    (byId(fixture, 'confirm') as HTMLButtonElement).click();
    await settle(fixture);

    const sent = api['confirm'].mock.calls[0];

    expect(sent[0]).toBe('job-1');
    expect(sent[1]).toMatchObject({
      category: 'vendor_invoice',
      vendor_id: 'v-1',
      header: {
        number: 'R-2026-17',
        issue_date: '2026-03-05',
        due_date: '2026-04-04',
        currency: 'CHF',
        qr_reference: '210000000003139471430009017',
      },
      totals: { net: 1250, vat: 106.1, gross: 1356.1 },
      purchase_order_ids: ['po-1'],
      goods_receipt_ids: ['gr-1'],
      match_override_reason: 'Agreed by phone',
    });
    expect(sent[1].lines[0]).toMatchObject({
      description: 'Montage Heizung',
      quantity: 10,
      unit_price: 120,
      net_amount: 1200,
      vat_rate: 8.1,
      gl_account_id: 'gl-2',
      vat_code_id: 'vat-std',
      purchase_order_line_id: 'pol-1',
      source_line_index: 0,
    });
    expect(message.success).toHaveBeenCalledWith('OCR_INBOX.CONFIRMED_OK');
  });

  it('shows the reason the server gives when it refuses the document', async () => {
    api['confirm'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'The fiscal period March 2026 is closed.' },
          }),
      ),
    );
    await create();

    (byId(fixture, 'confirm') as HTMLButtonElement).click();
    await settle(fixture);

    expect(message.error).toHaveBeenCalledWith('The fiscal period March 2026 is closed.');
  });

  it('does not confirm a document without an issue date', async () => {
    await create();
    const date = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-field="header.issue_date"]',
    ) as HTMLInputElement;
    date.value = '';
    date.dispatchEvent(new Event('input'));

    (byId(fixture, 'confirm') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api['confirm']).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith('OCR_INBOX.FIELD_REQUIRED');
  });

  it('saves a draft and restores it the next time the document is opened', async () => {
    await create();
    input('document-number').value = 'R-CORRECTED';
    input('document-number').dispatchEvent(new Event('input'));

    (byId(fixture, 'save-draft') as HTMLButtonElement).click();
    await settle(fixture);

    const draft = api['saveDraft'].mock.calls[0][1];
    expect(draft.header.number).toBe('R-CORRECTED');
    expect(message.success).toHaveBeenCalledWith('OCR_INBOX.DRAFT_SAVED');
    fixture.destroy();

    await create(workbenchFixture({ review_draft: draft }));
    expect(input('document-number').value).toBe('R-CORRECTED');
  });

  it('runs the extraction again and rejects a document with a reason', async () => {
    await create();

    (byId(fixture, 'rerun') as HTMLButtonElement).click();
    await settle(fixture);
    expect(api['rerun']).toHaveBeenCalledWith('job-1');
    expect(message.success).toHaveBeenCalledWith('OCR_INBOX.RERUN_OK');

    (byId(fixture, 'reject') as HTMLButtonElement).click();
    await settle(fixture);
    const confirm = byId(fixture, 'reject-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    input('reject-reason').value = 'Not addressed to us';
    input('reject-reason').dispatchEvent(new Event('input'));
    await settle(fixture);
    confirm.click();
    await settle(fixture);

    expect(api['reject']).toHaveBeenCalledWith('job-1', 'Not addressed to us');
    expect(message.success).toHaveBeenCalledWith('OCR_INBOX.REJECTED_OK');
  });

  it('only lets a document that is ready be confirmed or saved', async () => {
    await create(workbenchFixture({ status: 'confirmed' }));

    expect((byId(fixture, 'confirm') as HTMLButtonElement).disabled).toBe(true);
    expect((byId(fixture, 'save-draft') as HTMLButtonElement).disabled).toBe(true);
    expect((byId(fixture, 'rerun') as HTMLButtonElement).disabled).toBe(true);
  });

  it('creates the vendor from the extracted data and selects it', async () => {
    await create(workbenchFixture({ vendor: null }));
    const vendor = (): unknown =>
      (
        fixture.componentInstance as unknown as {
          form: { controls: { vendorId: { value: unknown } } };
        }
      ).form.controls.vendorId.value;

    expect(vendor()).toBeNull();
    (byId(fixture, 'create-vendor') as HTMLButtonElement).click();
    await settle(fixture);

    const name = (document.querySelector('#new-name') as HTMLInputElement) ?? null;
    expect(name?.value).toBe('Muster AG');

    (document.querySelector('[data-testid="create-vendor-submit"]') as HTMLButtonElement).click();
    await settle(fixture);

    expect(crm['createContact'].mock.calls[0][0]).toMatchObject({
      type: 'supplier',
      company_name: 'Muster AG',
      uid_number: 'CHE-123.456.789',
      qr_iban: 'CH4431999123000889012',
    });
    expect(vendor()).toBe('v-new');
  });
});

describe('AI Inbox page', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<OcrInboxPageComponent>;
  const queryParams = { value: {} as Record<string, string> };
  const navigate = vi.fn(() => Promise.resolve(true));

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(OcrInboxPageComponent);
    await settle(fixture);
    await settle(fixture);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryParams.value = {};
    api = {
      inbox: vi.fn(() => ok(pageFixture())),
      workbench: vi.fn(() => ok(workbenchFixture())),
    };
    TestBed.configureTestingModule({
      providers: baseProviders([
        { provide: OcrInboxApiService, useValue: api },
        { provide: CrmApiService, useValue: { getSuppliers: vi.fn(() => of({ data: [] })) } },
        {
          provide: PlatformApiService,
          useValue: {
            getNotificationRealtime: vi.fn(() => ok({ enabled: false, key: null, host: null })),
          },
        },
        {
          provide: DocumentPageRenderer,
          useValue: {
            load: vi.fn(async () => 1),
            render: vi.fn(async () => ({ width: 100, height: 100 })),
            destroy: vi.fn(),
          },
        },
        {
          provide: NzMessageService,
          useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
        },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return convertToParamMap(queryParams.value);
              },
            },
          },
        },
      ]) as never,
    });
  });

  it('shows the counters and the queue with the status and confidence of each document', async () => {
    await create();

    expect(byId(fixture, 'counter-ready_for_review')?.textContent).toContain('2');
    expect(byId(fixture, 'counter-failed')?.textContent).toContain('1');
    expect(all(fixture, '[data-testid^="item-"]')).toHaveLength(2);
    expect(byId(fixture, 'item-job-1')?.textContent).toContain('Muster AG');
    expect(byId(fixture, 'item-job-1')?.textContent).toContain('91%');
    expect(byId(fixture, 'item-job-2')?.textContent).toContain('ollama_local: unreachable');
    expect(byId(fixture, 'no-selection')).not.toBeNull();
  });

  it('opens the workbench of a document: viewer and form side by side, and remembers it in the address', async () => {
    await create();

    (byId(fixture, 'item-job-1') as HTMLButtonElement).click();
    await settle(fixture);
    await settle(fixture);

    expect(api['workbench']).toHaveBeenCalledWith('job-1');
    expect(byId(fixture, 'workbench')).not.toBeNull();
    expect(q(fixture, 'app-document-bounding-box-viewer')).not.toBeNull();
    expect(q(fixture, 'app-extraction-review-form')).not.toBeNull();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { job: 'job-1' } }),
    );
    expect(byId(fixture, 'no-selection')).toBeNull();
  });

  it('opens the document named in the address', async () => {
    queryParams.value = { job: 'job-1' };
    await create();

    expect(api['workbench']).toHaveBeenCalledWith('job-1');
    expect(byId(fixture, 'workbench')).not.toBeNull();
  });

  it('filters the queue by a counter and clears the filter on a second click', async () => {
    await create();

    (byId(fixture, 'counter-failed') as HTMLButtonElement).click();
    await settle(fixture);
    expect(api['inbox']).toHaveBeenLastCalledWith({ status: 'failed', page: 1, perPage: 25 });
    expect(byId(fixture, 'counter-failed')?.getAttribute('aria-pressed')).toBe('true');

    (byId(fixture, 'counter-failed') as HTMLButtonElement).click();
    await settle(fixture);
    expect(api['inbox']).toHaveBeenLastCalledWith({ status: null, page: 1, perPage: 25 });
  });

  it('shows an empty state when the queue is empty', async () => {
    api['inbox'].mockReturnValue(
      ok(
        pageFixture({
          queue: [],
          counters: { queued: 0, processing: 0, ready_for_review: 0, failed: 0 },
        }),
      ),
    );
    await create();

    expect(all(fixture, '[data-testid^="item-"]')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('OCR_INBOX.EMPTY_QUEUE');
  });
});
