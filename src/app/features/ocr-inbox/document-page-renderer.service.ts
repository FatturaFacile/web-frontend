import { Service } from '@angular/core';

/** Size in CSS pixels of the page as drawn (after zoom and rotation). */
export interface RenderedPage {
  width: number;
  height: number;
}

/** Width in CSS pixels of an image at 100% zoom. */
const IMAGE_BASE_WIDTH = 900;
/** CSS pixels per PDF point at 100% zoom. */
const PDF_BASE_SCALE = 1.25;

interface PdfPage {
  getViewport(options: { scale: number; rotation: number }): { width: number; height: number };
  render(options: {
    canvas: HTMLCanvasElement;
    viewport: { width: number; height: number };
    transform?: number[];
  }): { promise: Promise<void>; cancel(): void };
}
interface PdfDocument {
  numPages: number;
  getPage(page: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

/**
 * Draws the pages of the source document on a canvas, for PDFs with pdf.js (loaded on first use, with its worker served
 * from `assets/pdfjs`) and for images with the canvas itself, so both rotate and zoom the same way and the overlay of boxes
 * has one coordinate frame. The viewer talks to this service only, which keeps pdf.js out of the unit tests.
 */
@Service()
export class DocumentPageRenderer {
  private pdf: PdfDocument | null = null;
  private image: ImageBitmap | HTMLImageElement | null = null;
  private renderTask: { cancel(): void } | null = null;

  /** Fetches the file of the signed URL and prepares it; resolves with its number of pages. */
  async load(url: string, mimeType: string | null): Promise<number> {
    this.destroy();
    const response = await fetch(url, { credentials: 'omit' });

    if (!response.ok) {
      throw new Error(`The document could not be loaded (HTTP ${response.status}).`);
    }

    const type = mimeType ?? response.headers.get('Content-Type') ?? '';

    if (type.includes('pdf')) {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'assets/pdfjs/pdf.worker.min.mjs',
        document.baseURI,
      ).toString();
      const data = new Uint8Array(await response.arrayBuffer());
      this.pdf = (await pdfjs.getDocument({ data }).promise) as unknown as PdfDocument;

      return this.pdf.numPages;
    }

    const blob = await response.blob();
    this.image = await createImageBitmap(blob);

    return 1;
  }

  /** Draws one page at the zoom (percent) and rotation (degrees, clockwise); resolves with its size on screen. */
  async render(
    page: number,
    zoom: number,
    rotation: number,
    canvas: HTMLCanvasElement,
  ): Promise<RenderedPage> {
    this.renderTask?.cancel();
    const ratio = window.devicePixelRatio || 1;

    if (this.pdf !== null) {
      const pdfPage = await this.pdf.getPage(page);
      const viewport = pdfPage.getViewport({ scale: (PDF_BASE_SCALE * zoom) / 100, rotation });
      this.size(canvas, viewport.width, viewport.height, ratio);
      const task = pdfPage.render({
        canvas,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      this.renderTask = task;
      await task.promise;

      return { width: viewport.width, height: viewport.height };
    }

    const image = this.image;

    if (image === null) {
      throw new Error('No document is loaded.');
    }

    const scale = (Math.min(1, IMAGE_BASE_WIDTH / image.width) * zoom) / 100;
    const turned = rotation % 180 !== 0;
    const width = (turned ? image.height : image.width) * scale;
    const height = (turned ? image.width : image.height) * scale;
    this.size(canvas, width, height, ratio);
    const context = canvas.getContext('2d');

    if (context === null) {
      throw new Error('The canvas is not available.');
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.translate(width / 2, height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(
      image,
      (-image.width * scale) / 2,
      (-image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );

    return { width, height };
  }

  destroy(): void {
    this.renderTask?.cancel();
    this.renderTask = null;
    void this.pdf?.destroy();
    this.pdf = null;
    if (this.image !== null && 'close' in this.image) {
      this.image.close();
    }
    this.image = null;
  }

  private size(canvas: HTMLCanvasElement, width: number, height: number, ratio: number): void {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
}
