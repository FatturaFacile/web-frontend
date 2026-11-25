import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { firstValueFrom } from 'rxjs';
import { ExpenseManagementApiService } from '@core';
import { TranslatePipe } from '@shared';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

/** Clamps a zoom factor to the range the viewer supports. */
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100));
}

/** Rotation in degrees kept in [0, 360). */
export function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Receipt previewer: an image or a PDF fetched as a blob, with zoom, pan (drag) and rotation. The object URL is
 * revoked when the receipt changes and when the component is destroyed.
 */
@Component({
  selector: 'app-exm-receipt-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzButtonModule, NzSpinModule, TranslatePipe],
  template: `
    <div
      class="toolbar"
      role="toolbar"
      [attr.aria-label]="'expenseManagement.workbench.viewer' | translate"
    >
      <button
        nz-button
        nzSize="small"
        type="button"
        (click)="zoomBy(-1)"
        [attr.aria-label]="'expenseManagement.action.zoomOut' | translate"
      >
        <i class="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i>
      </button>
      <span class="level" aria-live="polite">{{ percent() }}%</span>
      <button
        nz-button
        nzSize="small"
        type="button"
        (click)="zoomBy(1)"
        [attr.aria-label]="'expenseManagement.action.zoomIn' | translate"
      >
        <i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i>
      </button>
      <button
        nz-button
        nzSize="small"
        type="button"
        (click)="rotateBy(-90)"
        [attr.aria-label]="'expenseManagement.action.rotateLeft' | translate"
      >
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
      </button>
      <button
        nz-button
        nzSize="small"
        type="button"
        (click)="rotateBy(90)"
        [attr.aria-label]="'expenseManagement.action.rotateRight' | translate"
      >
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
      </button>
      <button nz-button nzSize="small" type="button" (click)="reset()">
        {{ 'expenseManagement.action.reset' | translate }}
      </button>
    </div>

    <nz-spin [nzSpinning]="loading()">
      <div
        class="stage"
        (pointerdown)="startPan($event)"
        (pointermove)="pan($event)"
        (pointerup)="endPan()"
        (pointerleave)="endPan()"
      >
        @if (failed()) {
          <p class="muted">{{ 'expenseManagement.error.receipt_not_found' | translate }}</p>
        } @else if (isPdf() && safeUrl()) {
          <iframe
            class="pdf"
            [src]="safeUrl()"
            [style.transform]="transform()"
            title="receipt"
          ></iframe>
        } @else if (url()) {
          <img
            class="image"
            [src]="url()"
            [style.transform]="transform()"
            alt="receipt"
            draggable="false"
          />
        }
      </div>
    </nz-spin>
  `,
  styles: `
    .toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }
    .level {
      min-width: 48px;
      text-align: center;
    }
    .stage {
      height: 520px;
      overflow: hidden;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      touch-action: none;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image {
      max-width: 100%;
      max-height: 100%;
      transform-origin: center;
      user-select: none;
    }
    .pdf {
      width: 100%;
      height: 100%;
      border: 0;
      transform-origin: center;
    }
    .muted {
      opacity: 0.65;
    }
  `,
})
export class ReceiptViewerComponent {
  private readonly api = inject(ExpenseManagementApiService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly receiptId = input<string | null>(null);

  protected readonly url = signal<string | null>(null);
  protected readonly mime = signal('');
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly zoom = signal(1);
  protected readonly rotation = signal(0);
  protected readonly offset = signal({ x: 0, y: 0 });

  protected readonly percent = computed(() => Math.round(this.zoom() * 100));
  protected readonly isPdf = computed(() => this.mime() === 'application/pdf');
  protected readonly safeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.url();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  protected readonly transform = computed(() => {
    const { x, y } = this.offset();
    return `translate(${x}px, ${y}px) rotate(${this.rotation()}deg) scale(${this.zoom()})`;
  });

  private dragging: { x: number; y: number } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release());

    let ticket = 0;
    effect(() => {
      const id = this.receiptId();
      const current = ++ticket;
      this.release();
      this.failed.set(false);
      this.reset();
      if (!id) {
        return;
      }
      this.loading.set(true);
      void firstValueFrom(this.api.receiptFile(id))
        .then((blob) => {
          if (current === ticket) {
            this.mime.set(blob.type);
            this.url.set(URL.createObjectURL(blob));
          }
        })
        .catch(() => {
          if (current === ticket) {
            this.failed.set(true);
          }
        })
        .finally(() => {
          if (current === ticket) {
            this.loading.set(false);
          }
        });
    });
  }

  protected zoomBy(direction: 1 | -1): void {
    this.zoom.update((zoom) => clampZoom(zoom + direction * ZOOM_STEP));
  }

  protected rotateBy(degrees: number): void {
    this.rotation.update((rotation) => normalizeRotation(rotation + degrees));
  }

  protected reset(): void {
    this.zoom.set(1);
    this.rotation.set(0);
    this.offset.set({ x: 0, y: 0 });
  }

  protected startPan(event: PointerEvent): void {
    this.dragging = { x: event.clientX, y: event.clientY };
  }

  protected pan(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }
    const dx = event.clientX - this.dragging.x;
    const dy = event.clientY - this.dragging.y;
    this.dragging = { x: event.clientX, y: event.clientY };
    this.offset.update((offset) => ({ x: offset.x + dx, y: offset.y + dy }));
  }

  protected endPan(): void {
    this.dragging = null;
  }

  private release(): void {
    const url = this.url();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.url.set(null);
  }
}
