import { Component, ElementRef, output, signal, viewChild } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface SignaturePoint {
  x: number;
  y: number;
}

/** Builds a self-contained SVG document (paths only, no scripts) from the strokes of a signature in canvas coordinates. */
export function strokesToSvg(strokes: readonly (readonly SignaturePoint[])[], width: number, height: number): string {
  const round = (n: number): string => (Math.round(n * 10) / 10).toString();
  const paths = strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => {
      const points = stroke.length > 1 ? stroke : [stroke[0], { x: stroke[0].x + 0.01, y: stroke[0].y + 0.01 }];
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
      // Ink on a paper surface that stays light in both themes, so the stroke colour is a literal.
      return `<path d="${d}" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${paths}</svg>`;
}

/**
 * Touchscreen signature pad. Emits the drawn signature as a PNG data URI (`data:image/png;base64,...`),
 * or `null` when the pad is cleared. `svgChange` emits the same drawing as vector SVG markup (one path per stroke),
 * or `null` when the pad is cleared.
 */
@Component({
  selector: 'app-signature-pad',
  styleUrl: './signature-pad.component.scss',
  imports: [NzButtonModule, TranslatePipe],
  template: `
    <canvas
      #canvas
      class="sig-canvas"
      width="480"
      height="180"
      role="img"
      [attr.aria-label]="'SIGNATURE.PAD_LABEL' | translate"
      (pointerdown)="start($event)"
      (pointermove)="move($event)"
      (pointerup)="end()"
      (pointerleave)="end()"
      (pointercancel)="end()"
    ></canvas>
    <div class="sig-actions">
      <span class="sig-hint">{{ 'SIGNATURE.HINT' | translate }}</span>
      <button nz-button nzSize="small" type="button" (click)="clear()" [disabled]="!hasInk()">
        {{ 'SIGNATURE.CLEAR' | translate }}
      </button>
    </div>
  `,
})
export class SignaturePadComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly signatureChange = output<string | null>();
  readonly svgChange = output<string | null>();

  protected readonly hasInk = signal(false);
  private drawing = false;
  private strokes: SignaturePoint[][] = [];

  protected start(event: PointerEvent): void {
    this.drawing = true;
    const ctx = this.context();
    const point = this.point(event);
    this.strokes.push([point]);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    // Ink on a paper surface that stays light in both themes (--paper-surface), so the ink is a literal.
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + 0.01, point.y + 0.01);
    ctx.stroke();
    this.canvas().nativeElement.setPointerCapture?.(event.pointerId);
  }

  protected move(event: PointerEvent): void {
    if (!this.drawing) {
      return;
    }
    const point = this.point(event);
    const ctx = this.context();
    this.strokes.at(-1)?.push(point);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  protected end(): void {
    if (!this.drawing) {
      return;
    }
    this.drawing = false;
    this.hasInk.set(true);
    const element = this.canvas().nativeElement;
    this.signatureChange.emit(element.toDataURL('image/png'));
    this.svgChange.emit(strokesToSvg(this.strokes, element.width, element.height));
  }

  clear(): void {
    const element = this.canvas().nativeElement;
    this.context().clearRect(0, 0, element.width, element.height);
    this.hasInk.set(false);
    this.strokes = [];
    this.signatureChange.emit(null);
    this.svgChange.emit(null);
  }

  private context(): CanvasRenderingContext2D {
    return this.canvas().nativeElement.getContext('2d') as CanvasRenderingContext2D;
  }

  private point(event: PointerEvent): SignaturePoint {
    const element = this.canvas().nativeElement;
    const rect = element.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * element.width,
      y: ((event.clientY - rect.top) / rect.height) * element.height,
    };
  }
}
