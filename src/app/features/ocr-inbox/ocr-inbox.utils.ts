import {
  BoundingBox,
  BoundingBoxMap,
  ConfidenceBand,
  ExtractedPayload,
  ExtractionMethod,
  LineMatch,
  MatchEvaluation,
  OcrProvider,
} from './ocr-inbox.models';

/** Confidence at or above which a field is trusted without a second look (100 for XML and QR-bill fields). */
export const HIGH_CONFIDENCE = 90;
/** Confidence below which a field must be verified by hand. */
export const LOW_CONFIDENCE = 70;

/** Green from 90, amber from 70 to below 90, red below 70. */
export function confidenceBand(score: number | null | undefined): ConfidenceBand {
  const value = score ?? 0;

  if (value >= HIGH_CONFIDENCE) {
    return 'high';
  }

  return value >= LOW_CONFIDENCE ? 'medium' : 'low';
}

export const BAND_COLORS: Record<ConfidenceBand, string> = {
  high: '#2f9e44',
  medium: '#e67700',
  low: '#d6336c',
};

export const BAND_LABEL_KEYS: Record<ConfidenceBand, string> = {
  high: 'OCR_INBOX.CONFIDENCE_HIGH',
  medium: 'OCR_INBOX.CONFIDENCE_MEDIUM',
  low: 'OCR_INBOX.CONFIDENCE_LOW',
};

/** What the trust banner says about how the fields were obtained. */
export type TrustKind = 'qr' | 'xml' | 'ocr';

export function trustKind(
  method: ExtractionMethod | null,
  sourceFormat: NonNullable<ExtractedPayload['meta']>['source_format'] | undefined,
): TrustKind {
  if (method === 'hybrid_qr_plus_ocr' || sourceFormat === 'swiss_qr_bill') {
    return 'qr';
  }

  return method === 'embedded_xml_or_qr' ? 'xml' : 'ocr';
}

const PROVIDER_KEYS: Record<OcrProvider, string> = {
  ollama_local: 'OCR_INBOX.PROVIDER_OLLAMA_LOCAL',
  layoutlmv3_local: 'OCR_INBOX.PROVIDER_LAYOUTLMV3_LOCAL',
  tesseract_local: 'OCR_INBOX.PROVIDER_TESSERACT_LOCAL',
  gemini_cloud: 'OCR_INBOX.PROVIDER_GEMINI_CLOUD',
  openai_cloud: 'OCR_INBOX.PROVIDER_OPENAI_CLOUD',
  azure_document_intelligence: 'OCR_INBOX.PROVIDER_AZURE_DOCUMENT_INTELLIGENCE',
};

export function providerKey(provider: OcrProvider | null): string | null {
  return provider === null ? null : PROVIDER_KEYS[provider];
}

/** Normalizes the boxes of the wire (an empty PHP array arrives as `[]`) to a map. */
export function boxMap(raw: BoundingBoxMap | []): BoundingBoxMap {
  return Array.isArray(raw) ? {} : raw;
}

/** Box of a field turned with the page: the viewer shows a page rotated clockwise by 0, 90, 180 or 270 degrees. */
export function rotateBox(box: BoundingBox, rotation: number): BoundingBox {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { ...box, x: 1 - box.y - box.height, y: box.x, width: box.height, height: box.width };
    case 180:
      return { ...box, x: 1 - box.x - box.width, y: 1 - box.y - box.height };
    case 270:
      return { ...box, x: box.y, y: 1 - box.x - box.width, width: box.height, height: box.width };
    default:
      return box;
  }
}

/** The inverse of {@link rotateBox}: a region drawn on the turned page, in the coordinates of the page as stored. */
export function unrotateBox(box: BoundingBox, rotation: number): BoundingBox {
  return rotateBox(box, 360 - (((rotation % 360) + 360) % 360));
}

export function clampZoom(zoom: number): number {
  return Math.min(300, Math.max(50, Math.round(zoom / 25) * 25));
}

/** Key of the field a lines grid cell belongs to, the same key the API uses for boxes and confidence. */
export function lineKey(index: number, field: string): string {
  return `lines[${index}].${field}`;
}

export interface TotalsInput {
  netAmounts: (number | null)[];
  vatRates: (number | null)[];
  vat: number | null;
  gross: number | null;
  currency: string;
}

export interface Reconciliation {
  net: number;
  vat: number;
  gross: number;
  /** Gross total minus (sum of lines + VAT). */
  difference: number;
  tolerance: number;
  reconciled: boolean;
}

/** Rounding tolerance of the totals: CHF rounds to 0.05, every other currency to 0.01. */
export function totalsTolerance(currency: string): number {
  return currency.toUpperCase() === 'CHF' ? 0.05 : 0.01;
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** `Sum(lines) + VAT == Gross total`, within the rounding tolerance of the currency. */
export function reconcileTotals(input: TotalsInput): Reconciliation {
  const net = round2(input.netAmounts.reduce<number>((sum, value) => sum + (value ?? 0), 0));
  const computedVat = round2(
    input.netAmounts.reduce<number>(
      (sum, value, index) => sum + ((value ?? 0) * (input.vatRates[index] ?? 0)) / 100,
      0,
    ),
  );
  const vat = input.vat ?? computedVat;
  const gross = input.gross ?? round2(net + vat);
  const difference = round2(gross - (net + vat));
  const tolerance = totalsTolerance(input.currency);

  return {
    net,
    vat: round2(vat),
    gross: round2(gross),
    difference,
    tolerance,
    reconciled: Math.abs(difference) <= tolerance + 1e-9,
  };
}

/** The variances of one invoice line against the purchase order, when the order was matched to it. */
export function lineMatchFor(
  evaluations: readonly MatchEvaluation[],
  lineIndex: number,
): { orderId: string; match: LineMatch } | null {
  for (const evaluation of evaluations) {
    const match = evaluation.lines.find((candidate) => candidate.invoice_line_index === lineIndex);

    if (match !== undefined) {
      return { orderId: evaluation.purchase_order_id, match };
    }
  }

  return null;
}

/** CSS percentages that position a box on the page. */
export function boxStyle(box: BoundingBox): Record<string, string> {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  };
}

/** Number of a decimal typed in a form, or null when blank or not numeric. */
export function parseDecimal(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parsed = Number(value.replace(',', '.'));

  return Number.isFinite(parsed) ? parsed : null;
}
