import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  FACILITY_LEAF_KINDS,
  FACILITY_SPACE_KINDS,
  FacilityApiService,
  FacilityBuilding,
  FacilityBuildingRequest,
  FacilitySpace,
  FacilitySpaceKind,
  FacilitySpaceNode,
  FacilitySpaceRequest,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, facilityAbilities } from './facility.util';

const KIND_ICONS: Record<FacilitySpaceKind, string> = {
  floor: 'fa-layer-group',
  office: 'fa-briefcase',
  meeting_room: 'fa-users',
  desk: 'fa-desktop',
  parking: 'fa-square-parking',
  warehouse: 'fa-warehouse',
  common_area: 'fa-couch',
};

/** Buildings and the tree of floors and spaces, with capacity, type and whether a space can be booked. */
@Component({
  selector: 'app-facility-spaces',
  styleUrl: './facility.scss',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'FACILITY.SPACES_TITLE' | translate" [subtitle]="'FACILITY.SPACES_SUBTITLE' | translate">
      @if (abilities().manage) {
        <button nz-button nzType="primary" (click)="openBuildingModal()" appIconAction="create"></button>
      }
    </app-page-header>

    <div class="split">
      <nz-card class="main-card" [nzTitle]="'FACILITY.BUILDINGS' | translate">
        @for (building of buildings(); track building.id) {
          <div class="building-item" [class.active]="building.id === buildingId()" role="button" tabindex="0" (click)="selectBuilding(building.id)" (keydown.enter)="selectBuilding(building.id)">
            <span><strong>{{ building.code }}</strong> {{ building.name }}<span class="muted"> {{ building.city }}</span></span>
            @if (!building.is_active) {
              <nz-tag>{{ 'FACILITY.INACTIVE' | translate }}</nz-tag>
            }
          </div>
        }
        @if (buildings().length === 0) {
          <nz-empty [nzNotFoundContent]="'FACILITY.NO_BUILDINGS' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'FACILITY.SPACE_TREE' | translate" [nzExtra]="actions">
        <ng-template #actions>
          @if (abilities().manage && building(); as current) {
            <button nz-button nzSize="small" (click)="openBuildingModal(current)" appIconAction="edit"></button>
            <button nz-button nzSize="small" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FACILITY.DELETE_BUILDING_CONFIRM' | translate" (nzOnConfirm)="removeBuilding(current)"></button>
            <button nz-button nzSize="small" nzType="primary" (click)="openSpaceModal()">{{ 'FACILITY.ADD_SPACE' | translate }}</button>
          }
        </ng-template>

        <ng-template #nodeTpl let-node let-depth="depth">
          <div class="tree-node" [style.padding-left.px]="depth * 20 + 8" [class.active]="node.id === selected()?.id" role="button" tabindex="0" (click)="selectNode(node.id)" (keydown.enter)="selectNode(node.id)">
            <i [class]="iconOf(node.kind)" aria-hidden="true"></i>
            <strong>{{ node.code }}</strong> {{ node.name }}
            @if (node.is_bookable) {
              <nz-tag nzColor="blue">{{ 'FACILITY.BOOKABLE' | translate }}</nz-tag>
            }
            @if (!node.is_active) {
              <nz-tag>{{ 'FACILITY.INACTIVE' | translate }}</nz-tag>
            }
          </div>
          @for (child of node.children; track child.id) {
            <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: child, depth: depth + 1 }"></ng-container>
          }
        </ng-template>
        @if (tree().length > 0) {
          @for (root of tree(); track root.id) {
            <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: root, depth: 0 }"></ng-container>
          }
        } @else {
          <nz-empty [nzNotFoundContent]="'FACILITY.NO_SPACES' | translate"></nz-empty>
        }

        @if (selected(); as space) {
          <nz-descriptions class="main-card" nzBordered nzSize="small" [nzColumn]="2" [nzTitle]="space.code + ' - ' + space.name">
            <nz-descriptions-item [nzTitle]="'FACILITY.KIND' | translate">{{ ('FACILITY.KIND_' + space.kind) | translate }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'FACILITY.CAPACITY' | translate">{{ space.capacity ?? '-' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'FACILITY.AREA' | translate">{{ space.area_sqm ?? '-' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'FACILITY.BOOKABLE' | translate">{{ (space.is_bookable ? 'COMMON.YES' : 'COMMON.NO') | translate }}</nz-descriptions-item>
          </nz-descriptions>
          @if (abilities().manage) {
            <div class="toolbar">
              <button nz-button (click)="openSpaceModal(space)" appIconAction="edit"></button>
              <button nz-button nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FACILITY.DELETE_SPACE_CONFIRM' | translate" (nzOnConfirm)="removeSpace(space)"></button>
            </div>
          }
        }
      </nz-card>
    </div>

    <nz-modal appModalActions [(nzVisible)]="buildingModalVisible" [nzTitle]="'FACILITY.BUILDING' | translate" (nzOnCancel)="buildingModalVisible.set(false)" (nzOnOk)="saveBuilding()" okAction="save" [nzOkDisabled]="buildingForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="buildingForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="code" maxlength="30" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="name" maxlength="150" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.CITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="city" maxlength="100" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.COUNTRY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="country" nzAllowClear>
                  <nz-option nzValue="IT" nzLabel="IT"></nz-option>
                  <nz-option nzValue="CH" nzLabel="CH"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'FACILITY.ACTIVE' | translate }}</nz-form-label>
            <nz-form-control><nz-switch formControlName="is_active"></nz-switch></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="spaceModalVisible" [nzTitle]="'FACILITY.SPACE' | translate" (nzOnCancel)="spaceModalVisible.set(false)" (nzOnOk)="saveSpace()" okAction="save" [nzOkDisabled]="spaceForm.invalid" nzWidth="640px">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="spaceForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.KIND' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="kind">
                  @for (value of kinds; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('FACILITY.KIND_' + value) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.PARENT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="parent_id" nzAllowClear [nzDisabled]="spaceForm.controls.kind.value === 'floor'">
                  @for (candidate of parentCandidates(); track candidate.id) {
                    <nz-option [nzValue]="candidate.id" [nzLabel]="candidate.code + ' - ' + candidate.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="name" maxlength="150" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.FLOOR_LEVEL' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" formControlName="floor_level" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.CAPACITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="1" formControlName="capacity" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.AREA' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" step="0.01" formControlName="area_sqm" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'FACILITY.AMENITIES' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'FACILITY.AMENITIES_HINT' | translate"><input nz-input formControlName="amenities" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.BOOKABLE' | translate }}</nz-form-label>
              <nz-form-control><nz-switch formControlName="is_bookable"></nz-switch></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.ACTIVE' | translate }}</nz-form-label>
              <nz-form-control><nz-switch formControlName="is_active"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class FacilitySpacesComponent implements OnInit {
  private readonly api = inject(FacilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authStore = inject(AuthStore);

  readonly kinds = FACILITY_SPACE_KINDS;
  readonly abilities = computed(() => facilityAbilities(this.authStore.activeRoles(), this.authStore.userPermissions()));

  readonly buildings = signal<FacilityBuilding[]>([]);
  readonly buildingId = signal<string | null>(null);
  readonly building = computed(() => this.buildings().find((item) => item.id === this.buildingId()) ?? null);
  readonly tree = signal<FacilitySpaceNode[]>([]);
  readonly spaces = signal<FacilitySpace[]>([]);
  readonly selected = signal<FacilitySpace | null>(null);
  readonly buildingModalVisible = signal(false);
  readonly spaceModalVisible = signal(false);
  private editingBuilding: FacilityBuilding | null = null;
  private editingSpace: FacilitySpace | null = null;

  /** Any space that can contain others, except the one being edited. */
  readonly parentCandidates = computed(() =>
    this.spaces().filter((space) => !FACILITY_LEAF_KINDS.includes(space.kind) && space.id !== this.editingSpace?.id),
  );

  readonly buildingForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    city: [''],
    country: [''],
    is_active: [true],
  });

  readonly spaceForm = this.fb.group({
    kind: ['office' as FacilitySpaceKind, [Validators.required]],
    parent_id: [''],
    code: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    floor_level: [null as number | null],
    capacity: [null as number | null, [Validators.min(1)]],
    area_sqm: [null as number | null, [Validators.min(0)]],
    amenities: [''],
    is_bookable: [false],
    is_active: [true],
  });

  ngOnInit(): void {
    this.loadBuildings();
  }

  loadBuildings(selectId?: string): void {
    this.api.getBuildings({ per_page: 100 }).subscribe({
      next: (response) => {
        this.buildings.set(response.data);
        const target = selectId ?? this.buildingId() ?? response.data[0]?.id ?? null;
        if (target !== null && response.data.some((item) => item.id === target)) {
          this.selectBuilding(target);
        } else {
          this.buildingId.set(null);
          this.tree.set([]);
          this.spaces.set([]);
        }
      },
      error: () => this.message.error(this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  selectBuilding(id: string): void {
    this.buildingId.set(id);
    this.selected.set(null);
    this.api.getSpaceTree(id).subscribe({ next: (response) => this.tree.set(response.data) });
    this.api.getSpaces({ building_id: id, per_page: 100 }).subscribe({ next: (response) => this.spaces.set(response.data) });
  }

  selectNode(id: string): void {
    this.selected.set(this.spaces().find((space) => space.id === id) ?? null);
  }

  iconOf(kind: FacilitySpaceKind): string {
    return `fa-solid ${KIND_ICONS[kind]}`;
  }

  openBuildingModal(building: FacilityBuilding | null = null): void {
    this.editingBuilding = building;
    this.buildingForm.reset({ code: building?.code ?? '', name: building?.name ?? '', city: building?.city ?? '', country: building?.country ?? '', is_active: building?.is_active ?? true });
    this.buildingModalVisible.set(true);
  }

  saveBuilding(): void {
    const value = this.buildingForm.getRawValue();
    const payload: FacilityBuildingRequest = { code: value.code, name: value.name, city: value.city || null, country: value.country || null, is_active: value.is_active };
    const request = this.editingBuilding ? this.api.updateBuilding(this.editingBuilding.id, payload) : this.api.createBuilding(payload);

    request.subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('FACILITY.BUILDING_SAVED'));
        this.buildingModalVisible.set(false);
        this.loadBuildings(response.data.id);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  removeBuilding(building: FacilityBuilding): void {
    this.api.deleteBuilding(building.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FACILITY.BUILDING_DELETED'));
        this.buildingId.set(null);
        this.loadBuildings();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  openSpaceModal(space: FacilitySpace | null = null): void {
    this.editingSpace = space;
    this.spaceForm.reset({
      kind: space?.kind ?? 'office',
      parent_id: space?.parent_id ?? this.selected()?.id ?? '',
      code: space?.code ?? '',
      name: space?.name ?? '',
      floor_level: space?.floor_level ?? null,
      capacity: space?.capacity ?? null,
      area_sqm: space?.area_sqm === null || space?.area_sqm === undefined ? null : Number(space.area_sqm),
      amenities: (space?.amenities ?? []).join(', '),
      is_bookable: space?.is_bookable ?? false,
      is_active: space?.is_active ?? true,
    });
    this.spaceModalVisible.set(true);
  }

  saveSpace(): void {
    const buildingId = this.buildingId();
    if (buildingId === null) {
      return;
    }

    const value = this.spaceForm.getRawValue();
    const amenities = value.amenities.split(',').map((item) => item.trim()).filter((item) => item !== '');
    const payload: FacilitySpaceRequest = {
      building_id: buildingId,
      parent_id: value.kind === 'floor' ? null : value.parent_id || null,
      kind: value.kind,
      code: value.code,
      name: value.name,
      floor_level: value.floor_level,
      capacity: value.capacity,
      area_sqm: value.area_sqm,
      amenities: amenities.length > 0 ? amenities : null,
      is_bookable: value.is_bookable,
      is_active: value.is_active,
    };
    const request = this.editingSpace ? this.api.updateSpace(this.editingSpace.id, payload) : this.api.createSpace(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('FACILITY.SPACE_SAVED'));
        this.spaceModalVisible.set(false);
        this.selectBuilding(buildingId);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  removeSpace(space: FacilitySpace): void {
    this.api.deleteSpace(space.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FACILITY.SPACE_DELETED'));
        this.selectBuilding(space.building_id);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }
}
