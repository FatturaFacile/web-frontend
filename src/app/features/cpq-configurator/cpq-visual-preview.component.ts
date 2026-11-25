import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CpqVisual } from '@core';
import { RadioControlDirective, TranslatePipe } from '@shared';
import { buildScene, CPQ_VIEWBOX, CpqPreviewView } from './cpq-visual-scene';

/**
 * Layered 2D / 3D preview of the configured unit: plan, elevation and isometric views drawn as SVG from the layers the
 * API derives from the selected options. Each layer can be switched off to inspect what is under it; layers added
 * automatically by a rule are marked.
 */
@Component({
  selector: 'app-cpq-visual-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzCardModule,
    NzEmptyModule,
    NzRadioModule,
    NzSwitchModule,
    NzTagModule,
    RadioControlDirective,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'CPQ_CONFIGURATOR.PREVIEW.TITLE' | translate" class="preview">
      <nz-radio-group
        class="views"
        [ngModel]="view()"
        (ngModelChange)="view.set($event)"
        nzButtonStyle="solid"
      >
        @for (mode of views; track mode) {
          <label [attr.for]="'cpq-view-' + mode" appRadioControl nz-radio-button [nzValue]="mode">{{
            'CPQ_CONFIGURATOR.PREVIEW.VIEW_' + mode.toUpperCase() | translate
          }}</label>
        }
      </nz-radio-group>

      <svg
        class="scene"
        [attr.viewBox]="'0 0 ' + box.width + ' ' + box.height"
        role="img"
        [attr.aria-label]="visual().base.label ?? ('CPQ_CONFIGURATOR.PREVIEW.TITLE' | translate)"
      >
        <rect x="0" y="0" [attr.width]="box.width" [attr.height]="box.height" fill="#fafafa" />
        <ellipse cx="210" cy="262" rx="150" ry="14" fill="#00000012" />
        @for (shape of scene(); track shape.id) {
          @switch (shape.kind) {
            @case ('polygon') {
              <polygon
                [attr.points]="shape.points"
                [attr.fill]="shape.fill"
                [attr.stroke]="shape.stroke"
                [attr.opacity]="shape.opacity"
                stroke-width="1"
                [attr.data-layer]="shape.layerId"
              />
            }
            @case ('circle') {
              <circle
                [attr.cx]="shape.cx"
                [attr.cy]="shape.cy"
                [attr.r]="shape.r"
                [attr.fill]="shape.fill"
                [attr.stroke]="shape.stroke"
                [attr.data-layer]="shape.layerId"
              />
            }
            @case ('text') {
              <text
                [attr.x]="shape.x"
                [attr.y]="shape.y"
                [attr.fill]="shape.fill"
                font-size="11"
                font-weight="700"
              >
                {{ shape.text }}
              </text>
            }
          }
        }
      </svg>

      <div class="layers">
        <strong>{{ 'CPQ_CONFIGURATOR.PREVIEW.LAYERS' | translate }}</strong>
        @if (visual().layers.length === 0) {
          <nz-empty
            nzNotFoundImage="simple"
            [nzNotFoundContent]="'CPQ_CONFIGURATOR.PREVIEW.NO_LAYERS' | translate"
          ></nz-empty>
        }
        @for (layer of visual().layers; track layer.id) {
          <div class="layer">
            <span class="swatch" [style.background]="layer.color"></span>
            <nz-switch
              nzSize="small"
              [ngModel]="!hidden().has(layer.id)"
              (ngModelChange)="toggle(layer.id, $event)"
              [attr.aria-label]="layer.label"
            ></nz-switch>
            <span class="name">{{ layer.label }}</span>
            <nz-tag>{{ 'CPQ_CONFIGURATOR.LAYER.' + layer.kind.toUpperCase() | translate }}</nz-tag>
            @if (layer.auto_included) {
              <nz-tag nzColor="gold">{{ 'CPQ_CONFIGURATOR.AUTO_INCLUDED' | translate }}</nz-tag>
            }
          </div>
        }
      </div>
    </nz-card>
  `,
  styles: `
    .views {
      display: flex;
      justify-content: center;
      margin-bottom: 12px;
    }
    .scene {
      width: 100%;
      max-height: 320px;
      border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
      border-radius: 6px;
    }
    .layers {
      display: grid;
      gap: 6px;
      margin-top: 12px;
    }
    .layer {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .swatch {
      width: 14px;
      height: 14px;
      border: 1px solid #434343;
      border-radius: 3px;
    }
    .name {
      flex: 1;
    }
  `,
})
export class CpqVisualPreviewComponent {
  readonly visual = input.required<CpqVisual>();

  readonly views: CpqPreviewView[] = ['plan', 'elevation', 'isometric'];
  readonly box = CPQ_VIEWBOX;
  readonly view = signal<CpqPreviewView>('isometric');
  readonly hidden = signal<ReadonlySet<string>>(new Set());
  readonly scene = computed(() => buildScene(this.visual(), this.view(), this.hidden()));

  toggle(layerId: string, shown: boolean): void {
    const next = new Set(this.hidden());
    if (shown) {
      next.delete(layerId);
    } else {
      next.add(layerId);
    }
    this.hidden.set(next);
  }
}
