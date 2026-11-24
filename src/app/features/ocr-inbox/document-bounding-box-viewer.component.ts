import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { DocumentPageRenderer, RenderedPage } from './document-page-renderer.service';
import { BoundingBox, BoundingBoxMap } from './ocr-inbox.models';
import {
  BAND_COLORS,
  BAND_LABEL_KEYS,
  clampZoom,
  confidenceBand,
  rotateBox,
  unrotateBox,
} from './ocr-inbox.utils';

interface OverlayBox {
  key: string;
  box: BoundingBox;
  color: string;
  dash: string;
  score: number;
  labelKey: string;
}

/** Below this zoom a field that gets the focus is brought closer, so its region is readable. */
const FOCUS_ZOOM = 150;
const PULSE_MS = 1400;
const MIN_REGION = 0.004;

/**
 * Left pane of the review workbench: the source PDF (pdf.js canvas) or image with zoom (50-300%), pan, rotation and page
 * navigation, and an SVG overlay of the extracted regions coloured by confidence (green from 90, amber from 70, red below;
 * solid, dashed and dotted outlines too, so colour is not the only cue). The active field (`activeKey`) is scrolled into view,
 * brought to a readable zoom and pulsed; a box that is clicked or activated by keyboard is reported through `boxSelected`; in
 * region mode a rubber-band rectangle is reported through `regionSelected` in the coordinates of the page as stored.
 */
@Component({
  selector: 'app-document-bounding-box-viewer',
  styleUrl: './ocr-inbox.scss',
  imports: [DecimalPipe, TranslatePipe, NzButtonModule, NzSpinModule],
  template: `
    <div class="viewer-toolbar" role="toolbar" [attr.aria-label]="'OCR_INBOX.VIEWER' | translate">
      <button
        nz-button
        nzSize="small"
        type="button"
        data-testid="zoom-out"
        [attr.aria-label]="'OCR_INBOX.ZOOM_OUT' | translate"
        [disabled]="zoom() <= 50"
        (click)="changeZoom(-25)"
      >
        <i class="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i>
      </button>
      <span class="zoom-level" data-testid="zoom-level" aria-live="polite">{{
        'OCR_INBOX.ZOOM_LEVEL' | translate: { zoom: zoom() }
      }}</span>
      <button
        nz-button
        nzSize="small"
        type="button"
        data-testid="zoom-in"
        [attr.aria-label]="'OCR_INBOX.ZOOM_IN' | translate"
        [disabled]="zoom() >= 300"
        (click)="changeZoom(25)"
      >
        <i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i>
      </button>
      <button
        nz-button
        nzSize="small"
        type="button"
        data-testid="rotate"
        [attr.aria-label]="'OCR_INBOX.ROTATE' | translate"
        (click)="rotate()"
      >
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
      </button>
      <button
        nz-button
        nzSize="small"
        type="button"
        data-testid="region-mode"
        [nzType]="regionMode() ? 'primary' : 'default'"
        [attr.aria-pressed]="regionMode()"
        [attr.aria-label]="'OCR_INBOX.REGION_SELECT' | translate"
        [title]="'OCR_INBOX.REGION_SELECT' | translate"
        (click)="regionMode.set(!regionMode())"
      >
        <i class="fa-regular fa-object-group" aria-hidden="true"></i>
      </button>
      <span class="spacer"></span>
      <button
        nz-button
        nzSize="small"
        type="button"
        data-testid="previous-page"
        [attr.aria-label]="'OCR_INBOX.PREVIOUS_PAGE' | translate"
        [disabled]="page() <= 1"
        (click)="goToPage(page() - 1)"
      >
        <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
      </button>
      <span class="page-of" data-testid="page-of" aria-live="polite">{{
        'OCR_INBOX.PAGE_OF' | translate: { page: page(), pages: pageCount() }
      }}</span>
      <button
        nz-button
        nzSize="small"
        type="button"
        data-testid="next-page"
        [attr.aria-label]="'OCR_INBOX.NEXT_PAGE' | translate"
        [disabled]="page() >= pageCount()"
        (click)="goToPage(page() + 1)"
      >
        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>

    <ul class="legend" [attr.aria-label]="'OCR_INBOX.REGION_LEGEND' | translate">
      @for (band of bands; track band.key) {
        <li>
          <span
            class="swatch"
            [style.border-color]="band.color"
            [style.border-style]="
              band.key === 'high' ? 'solid' : band.key === 'medium' ? 'dashed' : 'dotted'
            "
          ></span>
          {{ band.labelKey | translate }}
        </li>
      }
    </ul>

    <nz-spin [nzSpinning]="loading()">
      <div
        #scroller
        class="viewer-scroll"
        data-testid="viewer-scroll"
        tabindex="0"
        [class.grab]="!regionMode()"
        (pointerdown)="startPan($event)"
        (pointermove)="movePan($event)"
        (pointerup)="endPan()"
        (pointercancel)="endPan()"
      >
        @if (error()) {
          <p class="viewer-error" role="alert" data-testid="viewer-error">
            {{ 'OCR_INBOX.VIEWER_ERROR' | translate }}
          </p>
        }
        <div
          class="page-stage"
          [style.width.px]="rendered().width"
          [style.height.px]="rendered().height"
        >
          <canvas #canvas data-testid="page-canvas"></canvas>
          <svg
            #overlay
            class="overlay"
            data-testid="overlay"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            role="group"
            [attr.aria-label]="'OCR_INBOX.VIEWER' | translate"
            [class.region-mode]="regionMode()"
            (pointerdown)="startRegion($event)"
            (pointermove)="moveRegion($event)"
            (pointerup)="endRegion($event)"
          >
            @for (item of overlayBoxes(); track item.key) {
              <rect
                class="box"
                role="button"
                tabindex="0"
                [attr.data-testid]="'box-' + item.key"
                [attr.data-band]="item.color"
                [class.active]="item.key === activeKey()"
                [class.pulse-a]="item.key === activeKey() && pulsing() && focusTick() % 2 === 0"
                [class.pulse-b]="item.key === activeKey() && pulsing() && focusTick() % 2 === 1"
                [attr.x]="item.box.x"
                [attr.y]="item.box.y"
                [attr.width]="item.box.width"
                [attr.height]="item.box.height"
                [attr.stroke]="item.color"
                [attr.fill]="item.color"
                [attr.stroke-dasharray]="item.dash"
                [attr.aria-pressed]="item.key === activeKey()"
                [attr.aria-label]="
                  item.key +
                  ': ' +
                  (item.labelKey | translate) +
                  ' (' +
                  (item.score | number: '1.0-0') +
                  '%)'
                "
                (click)="selectBox($event, item.key)"
                (keydown.enter)="selectBox($event, item.key)"
                (keydown.space)="selectBox($event, item.key)"
              />
            }
            @if (draft(); as region) {
              <rect
                class="draft"
                data-testid="region-draft"
                [attr.x]="region.x"
                [attr.y]="region.y"
                [attr.width]="region.width"
                [attr.height]="region.height"
              />
            }
          </svg>
        </div>
      </div>
    </nz-spin>
  `,
})
export class DocumentBoundingBoxViewerComponent implements OnDestroy {
  private readonly renderer = inject(DocumentPageRenderer);

  readonly source = input<{
    url: string;
    mime_type: string | null;
    file_name: string | null;
  } | null>(null);
  /** Regions by field key, in ratios of the page as stored (not rotated). */
  readonly boxes = input<BoundingBoxMap>({});
  /** Confidence (0-100) by field key. */
  readonly confidence = input<Record<string, number>>({});
  readonly activeKey = input<string | null>(null);
  /** Changes every time the active field is chosen, so the same field can be pulsed again. */
  readonly focusTick = input(0);

  readonly boxSelected = output<string>();
  readonly regionSelected = output<{ box: BoundingBox }>();

  protected readonly zoom = signal(100);
  protected readonly rotation = signal(0);
  protected readonly page = signal(1);
  protected readonly pageCount = signal(1);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly rendered = signal<RenderedPage>({ width: 0, height: 0 });
  protected readonly regionMode = signal(false);
  protected readonly pulsing = signal(false);
  protected readonly draft = signal<BoundingBox | null>(null);

  protected readonly bands = (['high', 'medium', 'low'] as const).map((key) => ({
    key,
    color: BAND_COLORS[key],
    labelKey: BAND_LABEL_KEYS[key],
  }));

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly overlay = viewChild.required<ElementRef<SVGSVGElement>>('overlay');

  private readonly loaded = signal(0);
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private panStart: { x: number; y: number; left: number; top: number } | null = null;
  private regionStart: { x: number; y: number } | null = null;
  private pendingScroll = false;

  /** Boxes of the current page, turned with it, with the colour and outline of their confidence band. */
  protected readonly overlayBoxes = computed<OverlayBox[]>(() => {
    const confidence = this.confidence();
    const rotation = this.rotation();

    return Object.entries(this.boxes())
      .filter(([, box]) => box.page === this.page())
      .map(([key, box]) => {
        const score = confidence[key] ?? 0;
        const band = confidenceBand(score);

        return {
          key,
          box: rotateBox(box, rotation),
          color: BAND_COLORS[band],
          dash: band === 'high' ? 'none' : band === 'medium' ? '6 3' : '2 3',
          score,
          labelKey: BAND_LABEL_KEYS[band],
        };
      });
  });

  constructor() {
    // A new source document is fetched and prepared.
    effect(() => {
      const source = this.source();

      untracked(() => void this.open(source));
    });

    // The page is redrawn when the document, the page, the zoom or the rotation change.
    effect(() => {
      const loaded = this.loaded();
      const page = this.page();
      const zoom = this.zoom();
      const rotation = this.rotation();

      if (loaded > 0) {
        untracked(() => void this.draw(page, zoom, rotation));
      }
    });

    // A field that gets the focus is brought into view and pulsed.
    effect(() => {
      const key = this.activeKey();
      this.focusTick();

      if (key !== null) {
        untracked(() => this.reveal(key));
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pulseTimer !== null) {
      clearTimeout(this.pulseTimer);
    }
    this.renderer.destroy();
  }

  protected changeZoom(delta: number): void {
    this.zoom.set(clampZoom(this.zoom() + delta));
  }

  protected rotate(): void {
    this.rotation.update((value) => (value + 90) % 360);
  }

  protected goToPage(page: number): void {
    this.page.set(Math.min(this.pageCount(), Math.max(1, page)));
  }

  protected selectBox(event: Event, key: string): void {
    event.stopPropagation();
    event.preventDefault();
    this.boxSelected.emit(key);
  }

  protected startPan(event: PointerEvent): void {
    if (this.regionMode() || event.button !== 0) {
      return;
    }

    const element = this.scroller().nativeElement;
    this.panStart = {
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
    };
  }

  protected movePan(event: PointerEvent): void {
    if (this.panStart === null) {
      return;
    }

    const element = this.scroller().nativeElement;
    element.scrollLeft = this.panStart.left - (event.clientX - this.panStart.x);
    element.scrollTop = this.panStart.top - (event.clientY - this.panStart.y);
  }

  protected endPan(): void {
    this.panStart = null;
  }

  protected startRegion(event: PointerEvent): void {
    if (!this.regionMode() || event.button !== 0) {
      return;
    }

    const point = this.point(event);
    this.regionStart = point;
    this.draft.set({ page: this.page(), x: point.x, y: point.y, width: 0, height: 0 });
    this.overlay().nativeElement.setPointerCapture?.(event.pointerId);
  }

  protected moveRegion(event: PointerEvent): void {
    if (this.regionStart === null) {
      return;
    }

    const point = this.point(event);
    this.draft.set({
      page: this.page(),
      x: Math.min(this.regionStart.x, point.x),
      y: Math.min(this.regionStart.y, point.y),
      width: Math.abs(point.x - this.regionStart.x),
      height: Math.abs(point.y - this.regionStart.y),
    });
  }

  protected endRegion(event: PointerEvent): void {
    if (this.regionStart === null) {
      return;
    }

    this.moveRegion(event);
    const region = this.draft();
    this.regionStart = null;
    this.draft.set(null);

    if (region !== null && region.width > MIN_REGION && region.height > MIN_REGION) {
      this.regionSelected.emit({ box: unrotateBox(region, this.rotation()) });
    }
  }

  /** A pointer position as ratios of the displayed page. */
  private point(event: PointerEvent): { x: number; y: number } {
    const rect = this.overlay().nativeElement.getBoundingClientRect();
    const clamp = (value: number): number => Math.min(1, Math.max(0, value));

    return {
      x: rect.width === 0 ? 0 : clamp((event.clientX - rect.left) / rect.width),
      y: rect.height === 0 ? 0 : clamp((event.clientY - rect.top) / rect.height),
    };
  }

  private async open(source: { url: string; mime_type: string | null } | null): Promise<void> {
    this.error.set(false);
    this.loaded.set(0);
    this.page.set(1);
    this.rotation.set(0);

    if (source === null) {
      this.renderer.destroy();
      this.pageCount.set(1);
      this.rendered.set({ width: 0, height: 0 });

      return;
    }

    this.loading.set(true);

    try {
      this.pageCount.set(await this.renderer.load(source.url, source.mime_type));
      this.loaded.update((value) => value + 1);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async draw(page: number, zoom: number, rotation: number): Promise<void> {
    try {
      this.rendered.set(
        await this.renderer.render(page, zoom, rotation, this.canvas().nativeElement),
      );
      this.error.set(false);

      if (this.pendingScroll) {
        this.pendingScroll = false;
        this.scrollToActive();
      }
    } catch {
      this.error.set(true);
    }
  }

  /** Shows the page of the field, brings it to a readable zoom, scrolls it to the middle and pulses it. */
  private reveal(key: string): void {
    const box = this.boxes()[key];

    if (box === undefined) {
      return;
    }

    this.pendingScroll = box.page !== this.page() || this.zoom() < FOCUS_ZOOM;
    this.goToPage(box.page);

    if (this.zoom() < FOCUS_ZOOM) {
      this.zoom.set(FOCUS_ZOOM);
    }

    if (!this.pendingScroll) {
      this.scrollToActive();
    }

    this.pulse();
  }

  private scrollToActive(): void {
    const key = this.activeKey();
    const box = key === null ? undefined : this.boxes()[key];

    if (box === undefined || box.page !== this.page()) {
      return;
    }

    const turned = rotateBox(box, this.rotation());
    const { width, height } = this.rendered();
    const element = this.scroller().nativeElement;

    element.scrollTo?.({
      left: (turned.x + turned.width / 2) * width - element.clientWidth / 2,
      top: (turned.y + turned.height / 2) * height - element.clientHeight / 2,
      behavior: 'smooth',
    });
  }

  private pulse(): void {
    if (this.pulseTimer !== null) {
      clearTimeout(this.pulseTimer);
    }

    this.pulsing.set(false);
    this.pulsing.set(true);
    this.pulseTimer = setTimeout(() => this.pulsing.set(false), PULSE_MS);
  }
}
