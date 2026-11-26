import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { EsigSignatureBox } from '@core/models/electronic-signature.model';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { DocumentPageRenderer } from '../ocr-inbox/document-page-renderer.service';
import { moveBox } from './e-signature.util';

/** A signature box drawn over a page of the document. */
export interface PdfViewBox {
  id: string;
  label: string;
  box: EsigSignatureBox;
  /** The box that is being placed or is the signer's own: drawn with a stronger outline. */
  active: boolean;
}

/**
 * Shows the pages of a PDF (pdf.js, through the shared page renderer) with the signature boxes over them. In placement mode a
 * click on the page asks for a box at that point and the boxes can be dragged; in view mode the page only shows them.
 * Coordinates leave and enter as fractions of the page (origin at the top left), the same frame the API stores.
 */
@Component({
  selector: 'app-esig-pdf-view',
  imports: [NzButtonModule, NzSpinModule, TranslatePipe],
  providers: [DocumentPageRenderer],
  template: `
    <div class="bar">
      <button
        nz-button
        nzSize="small"
        type="button"
        [disabled]="page() <= 1"
        [attr.aria-label]="'signatures.viewer.previous' | translate"
        (click)="goTo(page() - 1)"
      >
        ‹
      </button>
      <span class="page" aria-live="polite">
        {{ 'signatures.viewer.page' | translate: { page: page(), pages: pages() } }}
      </span>
      <button
        nz-button
        nzSize="small"
        type="button"
        [disabled]="page() >= pages()"
        [attr.aria-label]="'signatures.viewer.next' | translate"
        (click)="goTo(page() + 1)"
      >
        ›
      </button>
    </div>
    <nz-spin [nzSpinning]="loading()">
      <div class="scroller">
        <div
          #stage
          class="stage"
          [class.placing]="mode() === 'place'"
          [style.width.px]="size().width"
          [style.height.px]="size().height"
          [attr.role]="mode() === 'place' ? 'button' : null"
          [attr.tabindex]="mode() === 'place' ? 0 : null"
          [attr.aria-label]="
            mode() === 'place' ? ('signatures.wizard.placementHint' | translate) : null
          "
          (click)="onStageClick($event)"
          (keydown.enter)="onStageKey($event)"
        >
          <canvas #canvas></canvas>
          @for (item of visibleBoxes(); track item.id) {
            <div
              class="box"
              [class.active]="item.active"
              [style.left.%]="item.box.x * 100"
              [style.top.%]="item.box.y * 100"
              [style.width.%]="item.box.width * 100"
              [style.height.%]="item.box.height * 100"
              [attr.data-box]="item.id"
              (pointerdown)="startDrag($event, item)"
            >
              <span class="label">{{ item.label }}</span>
            </div>
          }
        </div>
      </div>
    </nz-spin>
    @if (failed()) {
      <p class="error" role="alert">{{ 'signatures.viewer.failed' | translate }}</p>
    }
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .scroller {
      max-height: 70vh;
      overflow: auto;
      background: var(--ant-color-fill-tertiary, #f0f0f0);
      padding: 12px;
      text-align: center;
    }

    .stage {
      position: relative;
      display: inline-block;
      background: #fff;
      box-shadow: 0 1px 6px rgb(0 0 0 / 25%);
      touch-action: none;
    }

    .stage.placing {
      cursor: crosshair;
    }

    canvas {
      display: block;
    }

    .box {
      position: absolute;
      box-sizing: border-box;
      border: 1.5px dashed #1e407c;
      background: rgb(30 64 124 / 12%);
      cursor: move;
      overflow: hidden;
    }

    .box.active {
      border: 2px solid #1e407c;
      background: rgb(30 64 124 / 22%);
    }

    .label {
      font-size: 11px;
      color: #1e407c;
      padding: 2px 4px;
      display: block;
      pointer-events: none;
    }

    .error {
      color: var(--ant-color-error, #cf1322);
    }
  `,
})
export class PdfViewComponent {
  private readonly renderer = inject(DocumentPageRenderer);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');

  readonly source = input<Blob | null>(null);
  readonly boxes = input<readonly PdfViewBox[]>([]);
  readonly mode = input<'place' | 'view'>('view');

  /** A click on the page in placement mode: the page and the point (fractions). */
  readonly placed = output<{ page: number; x: number; y: number }>();
  /** A box was dragged to a new position. */
  readonly moved = output<{ id: string; box: EsigSignatureBox }>();
  /** The number of pages once the document is loaded. */
  readonly loaded = output<number>();

  protected readonly page = signal(1);
  protected readonly pages = signal(0);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly size = signal({ width: 0, height: 0 });

  protected readonly visibleBoxes = () =>
    this.boxes().filter((item) => item.box.page === this.page());

  private objectUrl: string | null = null;
  private drag: {
    item: PdfViewBox;
    startX: number;
    startY: number;
    origin: EsigSignatureBox;
    box: EsigSignatureBox;
  } | null = null;

  constructor() {
    effect(() => {
      const blob = this.source();
      untracked(() => void this.open(blob));
    });
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  protected goTo(page: number): void {
    if (page < 1 || page > this.pages()) {
      return;
    }
    this.page.set(page);
    void this.draw();
  }

  /** The keyboard way to place a box: Enter on the page puts it in the middle. */
  protected onStageKey(event: Event): void {
    if (
      event.target !== this.stage().nativeElement ||
      this.mode() !== 'place' ||
      this.size().width === 0
    ) {
      return;
    }
    this.placed.emit({ page: this.page(), x: 0.5, y: 0.5 });
  }

  protected onStageClick(event: MouseEvent): void {
    // A click on a box ends a drag; it does not place another one.
    if (
      this.mode() !== 'place' ||
      this.size().width === 0 ||
      (event.target as HTMLElement).closest('.box')
    ) {
      return;
    }
    const rect = this.stage().nativeElement.getBoundingClientRect();
    this.placed.emit({
      page: this.page(),
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }

  protected startDrag(event: PointerEvent, item: PdfViewBox): void {
    if (this.mode() !== 'place') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.drag = {
      item,
      startX: event.clientX,
      startY: event.clientY,
      origin: item.box,
      box: item.box,
    };
    const stage = this.stage().nativeElement;
    const rect = stage.getBoundingClientRect();

    const onMove = (move: PointerEvent): void => {
      if (this.drag === null) {
        return;
      }
      this.drag.box = moveBox(
        this.drag.origin,
        (move.clientX - this.drag.startX) / rect.width,
        (move.clientY - this.drag.startY) / rect.height,
      );
      const element = stage.querySelector<HTMLElement>(`[data-box="${CSS.escape(item.id)}"]`);
      if (element !== null) {
        element.style.left = `${this.drag.box.x * 100}%`;
        element.style.top = `${this.drag.box.y * 100}%`;
      }
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (this.drag !== null) {
        this.moved.emit({ id: this.drag.item.id, box: this.drag.box });
        this.drag = null;
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  private async open(blob: Blob | null): Promise<void> {
    this.dispose();
    this.pages.set(0);
    this.page.set(1);
    this.failed.set(false);
    this.size.set({ width: 0, height: 0 });

    if (blob === null) {
      return;
    }

    this.loading.set(true);
    try {
      this.objectUrl = URL.createObjectURL(blob);
      const count = await this.renderer.load(this.objectUrl, blob.type || 'application/pdf');
      this.pages.set(count);
      this.loaded.emit(count);
      await this.draw();
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async draw(): Promise<void> {
    try {
      const size = await this.renderer.render(this.page(), 100, 0, this.canvas().nativeElement);
      this.size.set({ width: size.width, height: size.height });
    } catch {
      this.failed.set(true);
    }
  }

  private dispose(): void {
    this.renderer.destroy();
    if (this.objectUrl !== null) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
