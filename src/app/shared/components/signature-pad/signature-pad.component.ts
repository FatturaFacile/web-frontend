import { Component, ElementRef, output, signal, viewChild } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Touchscreen signature pad. Emits the drawn signature as a PNG data URI (`data:image/png;base64,...`),
 * or `null` when the pad is cleared.
 */
@Component({
  selector: 'app-signature-pad',
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
  styles: `
    .sig-canvas {
      width: 100%;
      max-width: 480px;
      height: auto;
      aspect-ratio: 8 / 3;
      border: 1px dashed var(--ant-color-border, #bfbfbf);
      border-radius: 6px;
      background: #fff;
      touch-action: none;
      cursor: crosshair;
    }
    .sig-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 480px;
      margin-top: 4px;
    }
    .sig-hint {
      font-size: 12px;
      opacity: 0.75;
    }
  `,
})
export class SignaturePadComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly signatureChange = output<string | null>();

  protected readonly hasInk = signal(false);
  private drawing = false;

  protected start(event: PointerEvent): void {
    this.drawing = true;
    const ctx = this.context();
    const point = this.point(event);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
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
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  protected end(): void {
    if (!this.drawing) {
      return;
    }
    this.drawing = false;
    this.hasInk.set(true);
    this.signatureChange.emit(this.canvas().nativeElement.toDataURL('image/png'));
  }

  clear(): void {
    const element = this.canvas().nativeElement;
    this.context().clearRect(0, 0, element.width, element.height);
    this.hasInk.set(false);
    this.signatureChange.emit(null);
  }

  private context(): CanvasRenderingContext2D {
    return this.canvas().nativeElement.getContext('2d') as CanvasRenderingContext2D;
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const element = this.canvas().nativeElement;
    const rect = element.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * element.width,
      y: ((event.clientY - rect.top) / rect.height) * element.height,
    };
  }
}
