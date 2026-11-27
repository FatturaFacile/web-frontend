import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GcBotanicalEntry, GcGeoPolygon, GcSite, GcSitePayload, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { GreenCareGeoPreviewComponent } from './green-care-geo-preview.component';
import { GreenCareLookupStore, GreenCareSitesStore } from './green-care.stores';
import { GREEN_CARE_MODULE, isoDay, parseDay, polygonFromText, polygonToText } from './green-care.util';

interface BotanicalRow {
  species: string;
  planting_date: Date | null;
  pruning_schedule: string;
  phytosanitary_notes: string;
}

interface SiteForm {
  code: string;
  name: string;
  customer_id: string | null;
  condominium_administrator_id: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  polygon: string;
  lawn_area_sqm: number | null;
  hedge_length_meters: number | null;
  tree_count: number | null;
  zones: number | null;
  controller_type: string;
  winterized: boolean;
  irrigation_notes: string;
  access_gate_code: string;
  access_notes: string;
  botanical: BotanicalRow[];
  is_active: boolean;
}

const EMPTY_FORM: SiteForm = {
  code: '',
  name: '',
  customer_id: null,
  condominium_administrator_id: null,
  address: '',
  latitude: null,
  longitude: null,
  polygon: '',
  lawn_area_sqm: null,
  hedge_length_meters: null,
  tree_count: null,
  zones: null,
  controller_type: '',
  winterized: false,
  irrigation_notes: '',
  access_gate_code: '',
  access_notes: '',
  botanical: [],
  is_active: true,
};

/**
 * Green space sites ("Siti & Giardini"): master list with search, detail with the SVG polygon preview, surfaces, irrigation specs,
 * gate code and botanical inventory, and the create / edit drawer.
 */
@Component({
  selector: 'app-green-care-sites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    FormsModule,
    GreenCareGeoPreviewComponent,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [GreenCareSitesStore],
  styleUrl: './green-care.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.GREEN_CARE_SITES' | translate"
      [subtitle]="'greenCare.section.sitesSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <div class="toolbar">
      <label class="field" for="gc-s-search">
        <span>{{ 'greenCare.filter.search' | translate }}</span>
        <input nz-input id="gc-s-search" [(ngModel)]="search" (keyup.enter)="reload()" (blur)="reload()" />
      </label>
      <label class="field" for="gc-s-active">
        <span>{{ 'greenCare.filter.activeState' | translate }}</span>
        <nz-select nzId="gc-s-active" nzAllowClear [(ngModel)]="active" (ngModelChange)="reload()">
          <nz-option [nzValue]="true" [nzLabel]="'greenCare.status.active' | translate"></nz-option>
          <nz-option [nzValue]="false" [nzLabel]="'greenCare.status.inactive' | translate"></nz-option>
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-test="add-site" (click)="openForm(null)">
          {{ 'greenCare.action.newSite' | translate }}
        </button>
      }
    </div>

    <div class="master-detail">
      <nz-table #sites nzSize="small" [nzData]="store.sites()" [nzLoading]="store.loading()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'greenCare.field.code' | translate }}</th>
            <th>{{ 'greenCare.field.name' | translate }}</th>
            <th>{{ 'greenCare.field.customer' | translate }}</th>
            <th>{{ 'greenCare.field.lawnArea' | translate }}</th>
            <th>{{ 'greenCare.field.status' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (site of sites.data; track site.id) {
            <tr
              class="selectable"
              [class.selected]="store.selected()?.id === site.id"
              [attr.data-test]="'site-' + site.id"
              (click)="store.select(site)"
            >
              <td>{{ site.code }}</td>
              <td>{{ site.name }}</td>
              <td>{{ site.customer_name }}</td>
              <td>{{ site.lawn_area_sqm ?? 0 | number: '1.0-0' }}</td>
              <td>
                <nz-tag [nzColor]="site.is_active ? 'green' : 'default'">{{
                  (site.is_active ? 'greenCare.status.active' : 'greenCare.status.inactive') | translate
                }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>

      <div class="panel" data-test="site-detail">
        @if (store.selected(); as site) {
          <div class="actions">
            <h3>{{ site.code }} · {{ site.name }}</h3>
            <span class="spacer"></span>
            @if (canWrite) {
              <button nz-button type="button" data-test="edit-site" (click)="openForm(site)">{{ 'greenCare.action.edit' | translate }}</button>
              <button
                nz-button
                nzDanger
                type="button"
                nz-popconfirm
                [nzPopconfirmTitle]="'greenCare.confirm.deleteSite' | translate"
                (nzOnConfirm)="remove(site)"
              >
                {{ 'greenCare.action.delete' | translate }}
              </button>
            }
          </div>
          <div class="form-grid">
            <div>
              <div class="hint">{{ 'greenCare.field.customer' | translate }}</div>
              {{ site.customer_name }}
            </div>
            <div>
              <div class="hint">{{ 'greenCare.field.condominiumAdministrator' | translate }}</div>
              {{ site.condominium_administrator_name ?? '-' }}
            </div>
            <div>
              <div class="hint">{{ 'greenCare.field.address' | translate }}</div>
              {{ site.address ?? '-' }}
            </div>
            <div>
              <div class="hint">{{ 'greenCare.field.jurisdiction' | translate }}</div>
              <nz-tag>{{ site.jurisdiction }}</nz-tag>
            </div>
            <div>
              <div class="hint">{{ 'greenCare.field.lawnArea' | translate }}</div>
              {{ site.lawn_area_sqm ?? 0 | number: '1.0-2' }} m²
            </div>
            <div>
              <div class="hint">{{ 'greenCare.field.hedgeLength' | translate }}</div>
              {{ site.hedge_length_meters ?? 0 | number: '1.0-2' }} m
            </div>
            <div>
              <div class="hint">{{ 'greenCare.field.treeCount' | translate }}</div>
              {{ site.tree_count ?? 0 }}
            </div>
            <div>
              <div class="hint">{{ 'greenCare.field.gateCode' | translate }}</div>
              <code data-test="gate-code">{{ site.access_gate_code ?? '-' }}</code>
            </div>
          </div>

          <h4 class="section-title">{{ 'greenCare.section.geometry' | translate }}</h4>
          <app-green-care-geo-preview
            [polygon]="site.geo_polygon_coordinates"
            [latitude]="site.latitude"
            [longitude]="site.longitude"
            [label]="'greenCare.section.geometry' | translate"
          ></app-green-care-geo-preview>
          <div class="hint">{{ site.latitude ?? '-' }}, {{ site.longitude ?? '-' }}</div>

          <h4 class="section-title">{{ 'greenCare.section.irrigation' | translate }}</h4>
          @if (site.irrigation_system_specs; as irrigation) {
            <div class="form-grid">
              <div>{{ 'greenCare.field.zones' | translate }}: {{ irrigation.zones ?? '-' }}</div>
              <div>{{ 'greenCare.field.controllerType' | translate }}: {{ irrigation.controller_type ?? '-' }}</div>
              <div>
                <nz-tag [nzColor]="irrigation.winterized ? 'blue' : 'default'">{{
                  (irrigation.winterized ? 'greenCare.irrigation.winterized' : 'greenCare.irrigation.active') | translate
                }}</nz-tag>
              </div>
            </div>
          } @else {
            <span class="muted">-</span>
          }

          <h4 class="section-title">{{ 'greenCare.section.botanicalInventory' | translate }}</h4>
          <nz-table #botanical nzSize="small" [nzData]="site.botanical_inventory" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'greenCare.field.species' | translate }}</th>
                <th>{{ 'greenCare.field.plantingDate' | translate }}</th>
                <th>{{ 'greenCare.field.pruningSchedule' | translate }}</th>
                <th>{{ 'greenCare.field.phytosanitaryNotes' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of botanical.data; track $index) {
                <tr>
                  <td>{{ entry.species }}</td>
                  <td>{{ entry.planting_date ?? '-' }}</td>
                  <td>{{ entry.pruning_schedule ?? '-' }}</td>
                  <td>{{ entry.phytosanitary_notes ?? '-' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (site.access_notes) {
            <h4 class="section-title">{{ 'greenCare.field.accessNotes' | translate }}</h4>
            <p>{{ site.access_notes }}</p>
          }
        } @else {
          <nz-empty [nzNotFoundContent]="'greenCare.empty.siteSelection' | translate"></nz-empty>
        }
      </div>
    </div>

    <nz-drawer
      [nzVisible]="formOpen()"
      [nzWidth]="720"
      [nzTitle]="(editingId() ? 'greenCare.action.editSite' : 'greenCare.action.newSite') | translate"
      (nzOnClose)="formOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate: formErrorParams()"></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="gc-sf-code">
            <span>{{ 'greenCare.field.code' | translate }}</span>
            <input nz-input id="gc-sf-code" name="code" [(ngModel)]="form.code" />
          </label>
          <label class="field" for="gc-sf-name">
            <span>{{ 'greenCare.field.name' | translate }} *</span>
            <input nz-input id="gc-sf-name" name="name" [(ngModel)]="form.name" />
          </label>
          <label class="field" for="gc-sf-customer">
            <span>{{ 'greenCare.field.customer' | translate }} *</span>
            <nz-select nzId="gc-sf-customer" nzShowSearch nzServerSearch [(ngModel)]="form.customer_id" (nzOnSearch)="lookup.searchCustomers($event)">
              @for (option of customerOptions(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-sf-admin">
            <span>{{ 'greenCare.field.condominiumAdministrator' | translate }}</span>
            <nz-select
              nzId="gc-sf-admin"
              nzShowSearch
              nzServerSearch
              nzAllowClear
              [(ngModel)]="form.condominium_administrator_id"
              (nzOnSearch)="lookup.searchCustomers($event)"
            >
              @for (option of customerOptions(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field full" for="gc-sf-address">
            <span>{{ 'greenCare.field.address' | translate }}</span>
            <input nz-input id="gc-sf-address" name="address" [(ngModel)]="form.address" />
          </label>
          <label class="field" for="gc-sf-lat">
            <span>{{ 'greenCare.field.latitude' | translate }}</span>
            <nz-input-number nzId="gc-sf-lat" name="latitude" [(ngModel)]="form.latitude" [nzMin]="-90" [nzMax]="90" [nzStep]="0.0001"></nz-input-number>
          </label>
          <label class="field" for="gc-sf-lng">
            <span>{{ 'greenCare.field.longitude' | translate }}</span>
            <nz-input-number nzId="gc-sf-lng" name="longitude" [(ngModel)]="form.longitude" [nzMin]="-180" [nzMax]="180" [nzStep]="0.0001"></nz-input-number>
          </label>
          <label class="field full" for="gc-sf-polygon">
            <span>{{ 'greenCare.field.polygon' | translate }}</span>
            <textarea nz-input id="gc-sf-polygon" name="polygon" rows="4" [(ngModel)]="form.polygon"></textarea>
            <span class="hint">{{ 'greenCare.hint.polygon' | translate }}</span>
          </label>
          <app-green-care-geo-preview
            class="field full"
            [polygon]="previewPolygon()"
            [latitude]="form.latitude"
            [longitude]="form.longitude"
            [label]="'greenCare.section.geometry' | translate"
          ></app-green-care-geo-preview>
          <label class="field" for="gc-sf-lawn">
            <span>{{ 'greenCare.field.lawnArea' | translate }}</span>
            <nz-input-number nzId="gc-sf-lawn" name="lawn_area_sqm" [(ngModel)]="form.lawn_area_sqm" [nzMin]="0" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="gc-sf-hedge">
            <span>{{ 'greenCare.field.hedgeLength' | translate }}</span>
            <nz-input-number nzId="gc-sf-hedge" name="hedge_length_meters" [(ngModel)]="form.hedge_length_meters" [nzMin]="0" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="gc-sf-trees">
            <span>{{ 'greenCare.field.treeCount' | translate }}</span>
            <nz-input-number nzId="gc-sf-trees" name="tree_count" [(ngModel)]="form.tree_count" [nzMin]="0" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="gc-sf-zones">
            <span>{{ 'greenCare.field.zones' | translate }}</span>
            <nz-input-number nzId="gc-sf-zones" name="zones" [(ngModel)]="form.zones" [nzMin]="0" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="gc-sf-controller">
            <span>{{ 'greenCare.field.controllerType' | translate }}</span>
            <input nz-input id="gc-sf-controller" name="controller_type" [(ngModel)]="form.controller_type" />
          </label>
          <label class="field switch" for="gc-sf-winterized">
            <span>{{ 'greenCare.field.winterized' | translate }}</span>
            <nz-switch nzId="gc-sf-winterized" name="winterized" [(ngModel)]="form.winterized"></nz-switch>
          </label>
          <label class="field full" for="gc-sf-irrigation-notes">
            <span>{{ 'greenCare.field.irrigationNotes' | translate }}</span>
            <input nz-input id="gc-sf-irrigation-notes" name="irrigation_notes" [(ngModel)]="form.irrigation_notes" />
          </label>
          <label class="field" for="gc-sf-gate">
            <span>{{ 'greenCare.field.gateCode' | translate }}</span>
            <input nz-input id="gc-sf-gate" name="access_gate_code" autocomplete="off" [(ngModel)]="form.access_gate_code" />
          </label>
          <label class="field switch" for="gc-sf-active">
            <span>{{ 'greenCare.status.active' | translate }}</span>
            <nz-switch nzId="gc-sf-active" name="is_active" [(ngModel)]="form.is_active"></nz-switch>
          </label>
          <label class="field full" for="gc-sf-notes">
            <span>{{ 'greenCare.field.accessNotes' | translate }}</span>
            <textarea nz-input id="gc-sf-notes" name="access_notes" rows="2" [(ngModel)]="form.access_notes"></textarea>
          </label>
        </div>

        <h4 class="section-title">{{ 'greenCare.section.botanicalInventory' | translate }}</h4>
        @for (row of form.botanical; track $index) {
          <div class="botanical-row" [attr.data-test]="'botanical-' + $index">
            <input nz-input [name]="'species' + $index" [placeholder]="'greenCare.field.species' | translate" [(ngModel)]="row.species" />
            <nz-date-picker [name]="'planted' + $index" [(ngModel)]="row.planting_date"></nz-date-picker>
            <input nz-input [name]="'pruning' + $index" [placeholder]="'greenCare.field.pruningSchedule' | translate" [(ngModel)]="row.pruning_schedule" />
            <input nz-input [name]="'notes' + $index" [placeholder]="'greenCare.field.phytosanitaryNotes' | translate" [(ngModel)]="row.phytosanitary_notes" />
            <button nz-button nzDanger type="button" (click)="removeBotanical($index)">{{ 'greenCare.action.remove' | translate }}</button>
          </div>
        }
        <button nz-button type="button" data-test="add-botanical" (click)="addBotanical()">{{ 'greenCare.action.addSpecies' | translate }}</button>

        <div class="actions section-title">
          <button nz-button nzType="primary" type="button" data-test="save-site" [disabled]="!formValid()" (click)="save()">
            {{ 'greenCare.action.save' | translate }}
          </button>
          <button nz-button type="button" (click)="formOpen.set(false)">{{ 'greenCare.action.cancel' | translate }}</button>
        </div>
      </ng-container>
    </nz-drawer>
  `,
})
export class GreenCareSitesComponent implements OnInit {
  protected readonly store = inject(GreenCareSitesStore);
  protected readonly lookup = inject(GreenCareLookupStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(GREEN_CARE_MODULE);

  protected search = '';
  protected active: boolean | null = null;

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorParams = signal<Record<string, string>>({});
  private readonly pinned = signal<{ id: string; label: string }[]>([]);
  protected form: SiteForm = { ...EMPTY_FORM, botanical: [] };

  protected readonly customerOptions = computed(() => {
    const known = this.lookup.customers();
    const missing = this.pinned().filter((option) => !known.some((item) => item.id === option.id));
    return [...missing, ...known];
  });

  ngOnInit(): void {
    void this.lookup.searchCustomers();
    void this.reload();
  }

  protected async reload(): Promise<void> {
    await this.store.load({ search: this.search.trim() === '' ? null : this.search.trim(), is_active: this.active });
  }

  private polygonText = '';
  private polygonValue: GcGeoPolygon | null = null;

  /** Memoised on the typed text: a fresh object on every change detection pass would break the input binding check. */
  protected previewPolygon(): GcGeoPolygon | null {
    if (this.form.polygon !== this.polygonText) {
      this.polygonText = this.form.polygon;
      this.polygonValue = polygonFromText(this.polygonText);
    }
    return this.polygonValue;
  }

  protected openForm(site: GcSite | null): void {
    this.formError.set(null);
    this.editingId.set(site?.id ?? null);
    const pinned: { id: string; label: string }[] = [];
    if (site?.customer_id && site.customer_name) {
      pinned.push({ id: site.customer_id, label: site.customer_name });
    }
    if (site?.condominium_administrator_id && site.condominium_administrator_name) {
      pinned.push({ id: site.condominium_administrator_id, label: site.condominium_administrator_name });
    }
    this.pinned.set(pinned);
    this.form =
      site === null
        ? { ...EMPTY_FORM, botanical: [] }
        : {
            code: site.code,
            name: site.name,
            customer_id: site.customer_id,
            condominium_administrator_id: site.condominium_administrator_id,
            address: site.address ?? '',
            latitude: site.latitude,
            longitude: site.longitude,
            polygon: polygonToText(site.geo_polygon_coordinates),
            lawn_area_sqm: site.lawn_area_sqm,
            hedge_length_meters: site.hedge_length_meters,
            tree_count: site.tree_count,
            zones: site.irrigation_system_specs?.zones ?? null,
            controller_type: site.irrigation_system_specs?.controller_type ?? '',
            winterized: site.irrigation_system_specs?.winterized ?? false,
            irrigation_notes: site.irrigation_system_specs?.notes ?? '',
            access_gate_code: site.access_gate_code ?? '',
            access_notes: site.access_notes ?? '',
            botanical: site.botanical_inventory.map((entry) => ({
              species: entry.species,
              planting_date: entry.planting_date ? parseDay(entry.planting_date) : null,
              pruning_schedule: entry.pruning_schedule ?? '',
              phytosanitary_notes: entry.phytosanitary_notes ?? '',
            })),
            is_active: site.is_active,
          };
    this.formOpen.set(true);
  }

  protected addBotanical(): void {
    this.form.botanical = [...this.form.botanical, { species: '', planting_date: null, pruning_schedule: '', phytosanitary_notes: '' }];
  }

  protected removeBotanical(index: number): void {
    this.form.botanical = this.form.botanical.filter((_, position) => position !== index);
  }

  protected formValid(): boolean {
    return this.form.name.trim() !== '' && this.form.customer_id !== null;
  }

  protected payload(): GcSitePayload {
    const f = this.form;
    const botanical: GcBotanicalEntry[] = f.botanical
      .filter((row) => row.species.trim() !== '')
      .map((row) => ({
        species: row.species.trim(),
        planting_date: row.planting_date ? isoDay(row.planting_date) : null,
        pruning_schedule: row.pruning_schedule.trim() || null,
        phytosanitary_notes: row.phytosanitary_notes.trim() || null,
      }));
    const hasIrrigation = f.zones !== null || f.controller_type.trim() !== '' || f.winterized || f.irrigation_notes.trim() !== '';

    return {
      code: f.code.trim() || null,
      name: f.name.trim(),
      customer_id: f.customer_id ?? '',
      condominium_administrator_id: f.condominium_administrator_id,
      address: f.address.trim() || null,
      latitude: f.latitude,
      longitude: f.longitude,
      geo_polygon_coordinates: polygonFromText(f.polygon),
      lawn_area_sqm: f.lawn_area_sqm,
      hedge_length_meters: f.hedge_length_meters,
      tree_count: f.tree_count,
      irrigation_system_specs: hasIrrigation
        ? { zones: f.zones, controller_type: f.controller_type.trim() || null, winterized: f.winterized, notes: f.irrigation_notes.trim() || null }
        : null,
      access_gate_code: f.access_gate_code.trim() || null,
      access_notes: f.access_notes.trim() || null,
      botanical_inventory: botanical,
      is_active: f.is_active,
    };
  }

  protected async save(): Promise<void> {
    if (!this.formValid()) {
      return;
    }
    const outcome = await this.store.save(this.editingId(), this.payload());
    if (outcome.ok) {
      this.formOpen.set(false);
      this.message.success(this.i18n.instant('greenCare.toast.siteSaved'));
      await this.reload();
    } else {
      this.formError.set(outcome.errorKey);
      this.formErrorParams.set(outcome.params);
    }
  }

  protected async remove(site: GcSite): Promise<void> {
    const outcome = await this.store.remove(site.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('greenCare.toast.siteDeleted'));
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
    }
  }
}
