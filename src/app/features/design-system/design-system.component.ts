import { Component, computed, inject, signal } from '@angular/core';
import { UiPreferencesApiService } from '@core/api/ui-preferences-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { UiPreferencesService } from '@core/theme/ui-preferences.service';
import {
  THEME_PREFERENCES,
  UI_DENSITIES,
  ThemePreference,
  UiDensity,
} from '@core/theme/ui-preferences.types';
import { isHexColor } from '@core/theme/contrast.util';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { AlertComponent } from '@shared/ui/alert/alert.component';
import { BadgeComponent } from '@shared/ui/badge/badge.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CardComponent } from '@shared/ui/card/card.component';
import {
  DataTableColumn,
  DataTableComponent,
  DataTableRow,
} from '@shared/ui/data-table/data-table.component';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';
import { FormFieldComponent } from '@shared/ui/form-field/form-field.component';
import { InputComponent } from '@shared/ui/input/input.component';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';
import { ToastService } from '@shared/ui/toast/toast.service';

/** Colour tokens shown in the catalog; the swatches read the live CSS variables, so they follow theme and brand. */
const SWATCHES = [
  'primary',
  'primary-hover',
  'primary-active',
  'primary-subtle',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'surface',
  'surface-alt',
  'text',
  'text-secondary',
  'text-muted',
  'border-input',
] as const;

/**
 * The design system catalog: tokens, every core component and the theme, density and brand controls, live. It is the
 * place to review a change in both themes and all densities, and the page the accessibility tests render.
 */
@Component({
  selector: 'app-design-system',
  imports: [
    TranslatePipe,
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    DataTableComponent,
    EmptyStateComponent,
    FormFieldComponent,
    InputComponent,
    ModalComponent,
    SelectComponent,
  ],
  templateUrl: './design-system.component.html',
  styleUrl: './design-system.component.scss',
})
export class DesignSystemComponent {
  protected readonly prefs = inject(UiPreferencesService);
  private readonly api = inject(UiPreferencesApiService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly swatches = SWATCHES;
  protected readonly themes = THEME_PREFERENCES;
  protected readonly densities = UI_DENSITIES;

  protected readonly modalOpen = signal(false);
  protected readonly drawerOpen = signal(false);
  protected readonly confirmOpen = signal(false);

  protected readonly sampleName = signal('');
  protected readonly sampleCountry = signal('');
  protected readonly nameError = computed(() =>
    this.sampleName().trim() === '' ? this.i18n.translate('DESIGN_SYSTEM.SAMPLE_NAME_ERROR') : null,
  );

  protected readonly primary = signal(this.prefs.branding().brand_primary_color ?? '');
  protected readonly secondary = signal(this.prefs.branding().brand_secondary_color ?? '');
  protected readonly primaryError = computed(() => this.colourError(this.primary()));
  protected readonly secondaryError = computed(() => this.colourError(this.secondary()));
  protected readonly saving = signal(false);

  protected readonly countries = computed<readonly SelectOption[]>(() => [
    { value: 'IT', label: this.i18n.translate('DESIGN_SYSTEM.SAMPLE_COUNTRY_IT') },
    { value: 'CH', label: this.i18n.translate('DESIGN_SYSTEM.SAMPLE_COUNTRY_CH') },
    { value: 'DE', label: this.i18n.translate('DESIGN_SYSTEM.SAMPLE_COUNTRY_DE') },
  ]);

  protected readonly columns = computed<readonly DataTableColumn[]>(() => [
    { key: 'number', label: this.i18n.translate('DESIGN_SYSTEM.TABLE_NUMBER') },
    { key: 'customer', label: this.i18n.translate('DESIGN_SYSTEM.TABLE_CUSTOMER') },
    { key: 'amount', label: this.i18n.translate('DESIGN_SYSTEM.TABLE_AMOUNT'), align: 'end' },
  ]);

  protected readonly rows: readonly DataTableRow[] = [
    { number: '2026/0412', customer: 'Rossi Impianti S.r.l.', amount: '1’250.00' },
    { number: '2026/0413', customer: 'Müller AG', amount: '840.50' },
    { number: '2026/0414', customer: 'Dupont SARL', amount: '3’010.00' },
  ];

  protected themeLabel(theme: ThemePreference): string {
    return `DESIGN_SYSTEM.THEME_${theme.toUpperCase()}`;
  }

  protected densityLabel(density: UiDensity): string {
    return `DESIGN_SYSTEM.DENSITY_${density.toUpperCase()}`;
  }

  protected swatchVariable(name: string): string {
    return `var(--ff-color-${name})`;
  }

  protected previewBrand(): void {
    if (this.primaryError() || this.secondaryError()) {
      return;
    }
    this.prefs.applyBranding({
      ...this.prefs.branding(),
      brand_primary_color: this.primary() || null,
      brand_secondary_color: this.secondary() || null,
    });
  }

  protected saveBrand(): void {
    if (this.primaryError() || this.secondaryError()) {
      return;
    }
    this.saving.set(true);
    this.api
      .updateTenantBranding({
        brand_primary_color: this.primary() || null,
        brand_secondary_color: this.secondary() || null,
      })
      .subscribe({
        next: (res) => {
          this.prefs.applyBranding(res.data);
          this.saving.set(false);
          this.toast.success(this.i18n.translate('DESIGN_SYSTEM.BRAND_SAVED'));
        },
        error: () => {
          this.saving.set(false);
          this.toast.error(this.i18n.translate('DESIGN_SYSTEM.BRAND_SAVE_FAILED'));
        },
      });
  }

  protected showToast(tone: 'success' | 'danger' | 'info'): void {
    this.toast.show(this.i18n.translate(`DESIGN_SYSTEM.TOAST_${tone.toUpperCase()}`), { tone });
  }

  protected confirmDelete(): void {
    this.confirmOpen.set(false);
    this.toast.success(this.i18n.translate('DESIGN_SYSTEM.CONFIRM_DONE'));
  }

  private colourError(value: string): string | null {
    return value === '' || isHexColor(value)
      ? null
      : this.i18n.translate('DESIGN_SYSTEM.BRAND_COLOUR_ERROR');
  }
}
