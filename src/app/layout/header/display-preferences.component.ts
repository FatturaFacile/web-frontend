import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import {
  BRAND_ACCENTS,
  type BrandAccent,
  DENSITIES,
  type Density,
  DisplayPreferencesService,
} from '@core/theme/display-preferences.service';

const BRAND_LABELS: Record<BrandAccent, string> = {
  teal: 'HEADER.BRAND_TEAL',
  indigo: 'HEADER.BRAND_INDIGO',
  purple: 'HEADER.BRAND_PURPLE',
  amber: 'HEADER.BRAND_AMBER',
};

const DENSITY_LABELS: Record<Density, string> = {
  compact: 'HEADER.DENSITY_COMPACT',
  comfortable: 'HEADER.DENSITY_COMFORTABLE',
};

/** Header popover where the user picks the interface density and the brand accent colour. */
@Component({
  selector: 'app-display-preferences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzDropdownModule, TranslatePipe],
  styleUrl: './display-preferences.component.scss',
  template: `
    <button
      type="button"
      class="action-btn"
      nz-dropdown
      nzTrigger="click"
      [nzDropdownMenu]="menu"
      nzPlacement="bottomRight"
      [title]="'HEADER.DISPLAY_PREFS' | translate"
      [attr.aria-label]="'HEADER.DISPLAY_PREFS' | translate"
      aria-haspopup="dialog"
    >
      <i class="fa-solid fa-palette" aria-hidden="true"></i>
    </button>
    <nz-dropdown-menu #menu="nzDropdownMenu">
      <div class="prefs-panel" role="dialog" [attr.aria-label]="'HEADER.DISPLAY_PREFS' | translate">
        <fieldset>
          <legend>{{ 'HEADER.DENSITY' | translate }}</legend>
          @for (d of densities; track d) {
            <label class="choice">
              <input
                type="radio"
                name="ff-density"
                [value]="d"
                [checked]="prefs.density() === d"
                (change)="prefs.setDensity(d)"
              />
              {{ densityLabels[d] | translate }}
            </label>
          }
        </fieldset>
        <fieldset>
          <legend>{{ 'HEADER.BRAND_COLOR' | translate }}</legend>
          <div class="swatches">
            @for (b of brands; track b) {
              <label
                class="swatch"
                [attr.data-brand-swatch]="b"
                [title]="brandLabels[b] | translate"
              >
                <input
                  type="radio"
                  name="ff-brand"
                  [value]="b"
                  [checked]="prefs.brand() === b"
                  [attr.aria-label]="brandLabels[b] | translate"
                  (change)="prefs.setBrand(b)"
                />
              </label>
            }
          </div>
        </fieldset>
        <button type="button" class="reset" (click)="prefs.reset()">
          {{ 'HEADER.BRAND_RESET' | translate }}
        </button>
      </div>
    </nz-dropdown-menu>
  `,
})
export class DisplayPreferencesComponent {
  readonly prefs = inject(DisplayPreferencesService);
  readonly densities = DENSITIES;
  readonly brands = BRAND_ACCENTS;
  readonly densityLabels = DENSITY_LABELS;
  readonly brandLabels = BRAND_LABELS;
}
