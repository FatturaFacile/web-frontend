import { Component, ElementRef, output, signal, viewChild } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { TranslatePipe } from '@shared';

/** Minimal pointer-driven signature pad; emits the drawing as a PNG data URL (or null when cleared). */
@Component({
  selector: 'app-signature-pad',
  imports: [NzButtonModule, TranslatePipe],
  template: `
    <canvas
      #canvas
      class="pad"
      width="480"
      height="160"
      role="img"
      [attr.aria-label]="'SC.QUOTES.SIGNATURE_PAD' | translate"
      (pointerdown)="start($event)"
      (pointermove)="move($event)"
      (pointerup)="end()"
      (pointerleave)="end()"
    ></canvas>
    <button nz-button nzSize="small" type="button" (click)="clear()">{{ 'SC.COMMON.CLEAR' | translate }}</button>
  `,
  styles: `
    .pad { display: block; width: 100%; max-width: 480px; border: 1px dashed #999; border-radius: 4px; touch-action: none; background: #fff; margin-bottom: 8px; }
  `,
})
export class SignaturePadComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly drawing = signal(false);

  readonly signatureChange = output<string | null>();

  protected start(event: PointerEvent): void {
    this.drawing.set(true);
    const ctx = this.context();
    const { x, y } = this.point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  protected move(event: PointerEvent): void {
    if (!this.drawing()) {
      return;
    }
    const ctx = this.context();
    const { x, y } = this.point(event);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  protected end(): void {
    if (this.drawing()) {
      this.drawing.set(false);
      this.signatureChange.emit(this.canvas().nativeElement.toDataURL('image/png'));
    }
  }

  protected clear(): void {
    const el = this.canvas().nativeElement;
    this.context().clearRect(0, 0, el.width, el.height);
    this.signatureChange.emit(null);
  }

  private context(): CanvasRenderingContext2D {
    return this.canvas().nativeElement.getContext('2d') as CanvasRenderingContext2D;
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const el = this.canvas().nativeElement;
    const rect = el.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * el.width) / rect.width,
      y: ((event.clientY - rect.top) * el.height) / rect.height,
    };
  }
}
