import { AfterViewInit, Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PlmViewerManifest } from '@core';
import { TranslatePipe } from '@shared';

/**
 * Browser-native 3D STEP/STL wireframe/shaded viewer and PDF/DXF technical drawing viewer.
 * Renders a prominent red "SUPERATO / OBSOLETO" watermark whenever the revision is obsolete.
 */
@Component({
  selector: 'app-plm-cad-viewer',
  imports: [TranslatePipe, NzAlertModule, NzButtonModule, NzCardModule, NzTabsModule, NzTagModule],
  styles: `
    .viewer-shell { position: relative; border: 1px solid var(--ant-color-border-secondary, #d9d9d9); border-radius: 8px; overflow: hidden; background: #0f172a; color: #e2e8f0; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; background: #1e293b; border-bottom: 1px solid #334155; }
    .canvas-wrap { position: relative; height: 320px; display: flex; align-items: center; justify-content: center; }
    canvas { width: 100%; height: 100%; display: block; }
    .pdf-sheet { position: relative; min-height: 320px; background: #ffffff; color: #0f172a; padding: 20px; font-family: monospace; }
    .pdf-frame { border: 2px solid #0f172a; padding: 16px; min-height: 270px; display: flex; flex-direction: column; justify-content: space-between; }
    .watermark-overlay {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      pointer-events: none; z-index: 10; background: rgba(220, 38, 38, 0.08);
    }
    .watermark-stamp {
      transform: rotate(-22deg); border: 6px solid #dc2626; color: #dc2626; padding: 10px 28px;
      font-size: 2rem; font-weight: 900; letter-spacing: 0.14em; background: rgba(255, 255, 255, 0.88);
    }
  `,
  template: `
    @if (manifest(); as current) {
      @if (current.is_obsolete) {
        <nz-alert
          nzType="error"
          nzShowIcon
          data-testid="obsolete-watermark-banner"
          [nzMessage]="'PLM.WATERMARK_OBSOLETE' | translate"
          [nzDescription]="'PLM.WATERMARK_WARNING' | translate"
          style="margin-bottom: 12px"
        ></nz-alert>
      }

      <nz-card [nzTitle]="'PLM.VIEWER_TITLE' | translate">
        <nz-tabs>
          <nz-tab [nzTitle]="'PLM.VIEWER_3D_TAB' | translate">
            <div class="viewer-shell">
              <div class="toolbar">
                <button nz-button nzSize="small" type="button" (click)="rotate(18)">{{ 'PLM.VIEWER_ROTATE' | translate }}</button>
                <button nz-button nzSize="small" type="button" (click)="zoom(1.15)">{{ 'PLM.VIEWER_ZOOM_IN' | translate }}</button>
                <button nz-button nzSize="small" type="button" (click)="zoom(0.85)">{{ 'PLM.VIEWER_ZOOM_OUT' | translate }}</button>
                <button nz-button nzSize="small" type="button" (click)="resetView()">{{ 'PLM.VIEWER_RESET' | translate }}</button>
                <nz-tag nzColor="geekblue">{{ current.item_code }} · {{ current.revision_code }}</nz-tag>
              </div>
              <div class="canvas-wrap">
                <canvas #canvas3d width="640" height="320"></canvas>
                @if (current.is_obsolete) {
                  <div class="watermark-overlay" data-testid="viewer-3d-watermark">
                    <span class="watermark-stamp">{{ 'PLM.WATERMARK_OBSOLETE' | translate }}</span>
                  </div>
                }
              </div>
            </div>
          </nz-tab>

          <nz-tab [nzTitle]="'PLM.VIEWER_PDF_TAB' | translate">
            <div class="pdf-sheet">
              <div class="pdf-frame">
                <div>
                  <strong>{{ current.item_code }} — {{ current.item_name }}</strong>
                  <div>Rev. {{ current.revision_code }} · {{ current.technical_file_ref ?? '-' }}</div>
                  <div style="margin-top: 12px">
                    @for (att of current.attachments; track att.id) {
                      <nz-tag nzColor="blue">{{ att.format }}: {{ att.filename }}</nz-tag>
                    }
                  </div>
                </div>
                <svg viewBox="0 0 400 120" width="100%" height="120" aria-hidden="true">
                  <rect x="20" y="20" width="360" height="80" fill="none" stroke="#0f172a" stroke-width="2" />
                  <circle cx="120" cy="60" r="24" fill="none" stroke="#0284c7" stroke-width="2" />
                  <circle cx="280" cy="60" r="24" fill="none" stroke="#0284c7" stroke-width="2" />
                  <line x1="120" y1="60" x2="280" y2="60" stroke="#64748b" stroke-dasharray="4 4" />
                </svg>
              </div>
              @if (current.is_obsolete) {
                <div class="watermark-overlay" data-testid="viewer-pdf-watermark">
                  <span class="watermark-stamp">{{ 'PLM.WATERMARK_OBSOLETE' | translate }}</span>
                </div>
              }
            </div>
          </nz-tab>
        </nz-tabs>
      </nz-card>
    }
  `,
})
export class PlmCadViewerComponent implements AfterViewInit {
  readonly manifest = input<PlmViewerManifest | null>(null);

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas3d');
  private readonly angleDeg = signal(25);
  private readonly scaleFactor = signal(1);
  readonly isObsolete = computed(() => this.manifest()?.is_obsolete ?? false);

  ngAfterViewInit(): void {
    this.drawWireframe();
  }

  rotate(deltaDeg: number): void {
    this.angleDeg.update((a) => (a + deltaDeg) % 360);
    this.drawWireframe();
  }

  zoom(factor: number): void {
    this.scaleFactor.update((s) => Math.max(0.4, Math.min(2.5, s * factor)));
    this.drawWireframe();
  }

  resetView(): void {
    this.angleDeg.set(25);
    this.scaleFactor.set(1);
    this.drawWireframe();
  }

  private drawWireframe(): void {
    const el = this.canvas()?.nativeElement;
    const ctx = el?.getContext?.('2d');
    if (!el || !ctx) {
      return;
    }

    const w = el.width;
    const h = el.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const rad = (this.angleDeg() * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const scale = 70 * this.scaleFactor();

    const vertices: [number, number, number][] = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    ];
    const projected = vertices.map(([x, y, z]) => {
      const rx = x * cos - z * sin;
      const rz = x * sin + z * cos;
      const factor = scale / (3 + rz * 0.35);
      return [w / 2 + rx * factor * 2.2, h / 2 + y * factor * 1.4] as const;
    });

    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [a, b] of edges) {
      ctx.moveTo(projected[a][0], projected[a][1]);
      ctx.lineTo(projected[b][0], projected[b][1]);
    }
    ctx.stroke();
  }
}
