import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LookupItemDto,
  LookupService,
  PermissionsService,
  SaveLookupTranslationPayload,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { from, tap } from 'rxjs';
import {
  ActionFormComponent,
  ActionFormConfig,
} from '../../../hr/shared/action-form/action-form.component';

const CATEGORIES = ['vat_rates', 'units_of_measure', 'country_codes', 'payment_methods'];
const LOCALES = ['it', 'en', 'de', 'fr'];

/** The items of a lookup list (VAT rates, units, countries, payment methods) and their custom translations for the company. */
@Component({
  selector: 'app-lookup-translations',
  styleUrl: './lookup-translations.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    ModalActionsDirective,
    ActionFormComponent,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'lookupTranslations.title' | translate"
      [subtitle]="'lookupTranslations.subtitle' | translate"
    />
    <nz-card>
      <div class="filter-bar">
        <div>
          <label for="lk-category">{{ 'lookupTranslations.category' | translate }}</label>
          <nz-select
            id="lk-category"
            class="w-field-md"
            nzShowSearch
            nzAllowClear
            [ngModel]="category()"
            (ngModelChange)="setCategory($event)"
          >
            @for (code of categories; track code) {
              <nz-option [nzValue]="code" [nzLabel]="code" />
            }
          </nz-select>
        </div>
        <button
          nz-button
          type="button"
          [disabled]="!category()"
          [nzLoading]="loading()"
          (click)="load(true)"
        >
          {{ 'hrmCommon.refresh' | translate }}
        </button>
      </div>
      <nz-table
        #table
        [nzData]="items()"
        [nzLoading]="loading()"
        [nzFrontPagination]="false"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th [nzSortFn]="'code' | gridSort">{{ 'hrmCommon.code' | translate }}</th>
            <th [nzSortFn]="'label' | gridSort">{{ 'lookupTranslations.label' | translate }}</th>
            <th [nzSortFn]="'short_label' | gridSort">{{ 'lookupTranslations.shortLabel' | translate }}</th>
            @if (canWrite()) {
              <th>{{ 'hrmCommon.actions' | translate }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (item of table.data; track item.id) {
            <tr>
              <td>{{ item.code }}</td>
              <td>{{ item.label }}</td>
              <td>{{ item.short_label }}</td>
              @if (canWrite()) {
                <td>
                  <button nz-button nzSize="small" type="button" (click)="edit(item)">
                    {{ 'lookupTranslations.translate' | translate }}
                  </button>
                </td>
              }
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="selected() !== null"
      [nzTitle]="'lookupTranslations.translate' | translate"
      [nzFooter]="null"
      (nzOnCancel)="selected.set(null)"
    >
      <ng-container *nzModalContent>
        <p>{{ selected()?.code }} &middot; {{ selected()?.label }}</p>
        <app-action-form [config]="config()" />
      </ng-container>
    </nz-modal>
  `,
})
export class LookupTranslationsComponent {
  private readonly lookups = inject(LookupService);
  private readonly permissions = inject(PermissionsService);

  protected readonly categories = CATEGORIES;
  protected readonly canWrite = computed(() => this.permissions.canWrite('system'));
  protected readonly category = signal<string | null>(null);
  protected readonly items = signal<LookupItemDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly selected = signal<LookupItemDto | null>(null);

  protected readonly config = computed<ActionFormConfig>(() => {
    const item = this.selected();
    const category = this.category() ?? undefined;
    return {
      submitLabelKey: 'hrmCommon.save',
      fields: [
        {
          key: 'locale',
          labelKey: 'lookupTranslations.locale',
          type: 'select',
          required: true,
          options: () => LOCALES.map((value) => ({ value, label: value.toUpperCase() })),
        },
        {
          key: 'label',
          labelKey: 'lookupTranslations.label',
          type: 'text',
          required: true,
          maxLength: 255,
          defaultValue: item?.label ?? '',
        },
        {
          key: 'short_label',
          labelKey: 'lookupTranslations.shortLabel',
          type: 'text',
          nullable: true,
          maxLength: 15,
        },
        { key: 'description', labelKey: 'hrmCommon.description', type: 'textarea', nullable: true },
      ],
      submit: (payload) =>
        from(
          this.lookups.saveTranslation(
            {
              ...payload,
              lookup_item_id: item?.id ?? '',
            } as unknown as SaveLookupTranslationPayload,
            category,
          ),
        ).pipe(
          tap(() => {
            this.selected.set(null);
            this.load(true);
          }),
        ),
    };
  });

  protected setCategory(code: string | null): void {
    this.category.set(code);
    this.items.set([]);
    if (code) {
      this.load(false);
    }
  }

  protected edit(item: LookupItemDto): void {
    this.selected.set(item);
  }

  protected load(forceRefresh: boolean): void {
    const code = this.category();
    if (!code) {
      return;
    }
    this.loading.set(true);
    void this.lookups.getLookup(code, forceRefresh).then((items) => {
      this.items.set(items);
      this.loading.set(false);
    });
  }
}
