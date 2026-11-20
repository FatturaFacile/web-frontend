import { describe, expect, it } from 'vitest';
import { BoundingBox, MatchEvaluation } from './ocr-inbox.models';
import {
  boxMap,
  clampZoom,
  confidenceBand,
  lineKey,
  lineMatchFor,
  parseDecimal,
  providerKey,
  reconcileTotals,
  rotateBox,
  totalsTolerance,
  trustKind,
  unrotateBox,
} from './ocr-inbox.utils';

describe('confidenceBand', () => {
  it('is green from 90, amber from 70 to below 90 and red below 70', () => {
    expect(confidenceBand(100)).toBe('high');
    expect(confidenceBand(90)).toBe('high');
    expect(confidenceBand(89.99)).toBe('medium');
    expect(confidenceBand(70)).toBe('medium');
    expect(confidenceBand(69.99)).toBe('low');
    expect(confidenceBand(0)).toBe('low');
    expect(confidenceBand(undefined)).toBe('low');
    expect(confidenceBand(null)).toBe('low');
  });
});

describe('trustKind', () => {
  it('tells a QR-bill, an XML invoice and an OCR reading apart', () => {
    expect(trustKind('hybrid_qr_plus_ocr', 'swiss_qr_bill')).toBe('qr');
    expect(trustKind('embedded_xml_or_qr', 'fatturapa')).toBe('xml');
    expect(trustKind('embedded_xml_or_qr', 'zugferd')).toBe('xml');
    expect(trustKind('vision_llm_ocr', 'ocr')).toBe('ocr');
    expect(trustKind(null, undefined)).toBe('ocr');
  });
});

describe('providerKey', () => {
  it('names the engine or nothing', () => {
    expect(providerKey('ollama_local')).toBe('OCR_INBOX.PROVIDER_OLLAMA_LOCAL');
    expect(providerKey('azure_document_intelligence')).toBe(
      'OCR_INBOX.PROVIDER_AZURE_DOCUMENT_INTELLIGENCE',
    );
    expect(providerKey(null)).toBeNull();
  });
});

describe('box rotation', () => {
  const box: BoundingBox = { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 };

  it('keeps the box at 0 degrees and swaps its sides at 90 and 270', () => {
    expect(rotateBox(box, 0)).toEqual(box);
    const quarter = rotateBox(box, 90);
    expect(quarter.width).toBeCloseTo(0.1);
    expect(quarter.height).toBeCloseTo(0.3);
    expect(quarter.x).toBeCloseTo(0.7);
    expect(quarter.y).toBeCloseTo(0.1);
    const turned = rotateBox(box, 270);
    expect(turned.x).toBeCloseTo(0.2);
    expect(turned.y).toBeCloseTo(0.6);
    const half = rotateBox(box, 180);
    expect(half.x).toBeCloseTo(0.6);
    expect(half.y).toBeCloseTo(0.7);
    expect(half.width).toBeCloseTo(0.3);
  });

  it('is undone by unrotateBox for every quarter turn', () => {
    for (const rotation of [0, 90, 180, 270, 360, -90]) {
      const back = unrotateBox(rotateBox(box, rotation), rotation);
      expect(back.x).toBeCloseTo(box.x);
      expect(back.y).toBeCloseTo(box.y);
      expect(back.width).toBeCloseTo(box.width);
      expect(back.height).toBeCloseTo(box.height);
    }
  });

  it('keeps the box inside the page', () => {
    for (const rotation of [90, 180, 270]) {
      const turned = rotateBox({ page: 1, x: 0.8, y: 0.85, width: 0.2, height: 0.15 }, rotation);
      expect(turned.x).toBeGreaterThanOrEqual(-1e-9);
      expect(turned.y).toBeGreaterThanOrEqual(-1e-9);
      expect(turned.x + turned.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(turned.y + turned.height).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe('clampZoom', () => {
  it('stays between 50 and 300 in steps of 25', () => {
    expect(clampZoom(10)).toBe(50);
    expect(clampZoom(120)).toBe(125);
    expect(clampZoom(1000)).toBe(300);
    expect(clampZoom(100)).toBe(100);
  });
});

describe('reconcileTotals', () => {
  it('accepts a CHF difference of 0.05 and refuses 0.06', () => {
    const base = { netAmounts: [1000], vatRates: [8.1], vat: 81, currency: 'CHF' };

    expect(reconcileTotals({ ...base, gross: 1081.05 }).reconciled).toBe(true);
    expect(reconcileTotals({ ...base, gross: 1081.06 }).reconciled).toBe(false);
    expect(reconcileTotals({ ...base, gross: 1081.06 }).difference).toBe(0.06);
    expect(totalsTolerance('chf')).toBe(0.05);
  });

  it('accepts an EUR difference of 0.01 and refuses 0.02', () => {
    const base = { netAmounts: [150], vatRates: [22], vat: 33, currency: 'EUR' };

    expect(reconcileTotals({ ...base, gross: 183.01 }).reconciled).toBe(true);
    expect(reconcileTotals({ ...base, gross: 183.02 }).reconciled).toBe(false);
    expect(totalsTolerance('EUR')).toBe(0.01);
  });

  it('computes the VAT from the lines when the document states none, and the gross from net plus VAT', () => {
    const totals = reconcileTotals({
      netAmounts: [100, 50],
      vatRates: [22, 10],
      vat: null,
      gross: null,
      currency: 'EUR',
    });

    expect(totals).toMatchObject({
      net: 150,
      vat: 27,
      gross: 177,
      difference: 0,
      reconciled: true,
    });
  });

  it('treats a blank amount as zero', () => {
    expect(
      reconcileTotals({
        netAmounts: [null, 10],
        vatRates: [null, 0],
        vat: 0,
        gross: 10,
        currency: 'EUR',
      }).reconciled,
    ).toBe(true);
  });
});

describe('lineMatchFor', () => {
  const evaluations: MatchEvaluation[] = [
    {
      purchase_order_id: 'po-1',
      purchase_order_number: 'PO-1',
      status: 'variance',
      unmatched_invoice_lines: [2],
      lines: [
        {
          invoice_line_index: 0,
          purchase_order_line_id: 'l-1',
          price_variance: 5,
          price_variance_percent: 11.1,
          quantity_variance: 0,
          received_variance: 0,
          within_tolerance: false,
        },
      ],
    },
  ];

  it('finds the variances of a matched line and nothing for an unmatched one', () => {
    expect(lineMatchFor(evaluations, 0)).toEqual({
      orderId: 'po-1',
      match: evaluations[0].lines[0],
    });
    expect(lineMatchFor(evaluations, 2)).toBeNull();
    expect(lineMatchFor([], 0)).toBeNull();
  });
});

describe('small helpers', () => {
  it('builds the field key the API uses for lines', () => {
    expect(lineKey(2, 'unit_price')).toBe('lines[2].unit_price');
  });

  it('turns the empty PHP array of boxes into an empty map', () => {
    expect(boxMap([])).toEqual({});
    expect(boxMap({ a: { page: 1, x: 0, y: 0, width: 1, height: 1 } })).toHaveProperty('a');
  });

  it('parses decimals typed with a comma or a point', () => {
    expect(parseDecimal('12,50')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal(3)).toBe(3);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(Number.NaN)).toBeNull();
  });
});
