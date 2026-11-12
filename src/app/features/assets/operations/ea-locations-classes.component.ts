import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AssetClass,
  AssetCriticality,
  AssetLocation,
  AssetLocationType,
  EamOpsApiService,
  PermissionsService,
} from '@core';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-ea-locations-classes',
  styleUrl: './ea-locations-classes.component.scss',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    TranslatePipe,
  ],
  templateUrl: './ea-locations-classes.component.html',
})
export class EaLocationsClassesComponent implements OnInit {
  private readonly api = inject(EamOpsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly canWrite = inject(PermissionsService).canWrite('assets');

  protected readonly locationTypes: AssetLocationType[] = [
    'facility',
    'building',
    'floor',
    'room',
    'yard',
    'mobile',
    'project_site',
  ];
  protected readonly criticalities: AssetCriticality[] = ['low', 'medium', 'high', 'mission_critical'];

  protected readonly locations = signal<AssetLocation[]>([]);
  protected readonly classes = signal<AssetClass[]>([]);
  protected readonly saving = signal(false);
  protected readonly modal = signal<'location' | 'class' | null>(null);
  protected readonly formErrors = signal<string[]>([]);
  private editingLocationId: string | null = null;

  protected readonly locationForm = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.maxLength(60)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    parent_id: this.fb.control(''),
    location_type: this.fb.control<AssetLocationType | null>(null),
    address: this.fb.control('', [Validators.maxLength(255)]),
    city: this.fb.control('', [Validators.maxLength(100)]),
    country: this.fb.control('', [Validators.pattern(/^[A-Za-z]{2}$/)]),
    is_active: this.fb.control(true),
  });

  protected readonly classForm = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.maxLength(60)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    criticality: this.fb.control<AssetCriticality | null>(null),
    default_maintenance_interval_days: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(3650)]),
    requires_custodian: this.fb.control(false),
    requires_calibration: this.fb.control(false),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api.getLocations().subscribe({ next: (res) => this.locations.set(res.data ?? []) });
    this.api.getAssetClasses().subscribe({ next: (res) => this.classes.set(res.data ?? []) });
  }

  protected openLocation(location: AssetLocation | null): void {
    this.editingLocationId = location?.id ?? null;
    this.formErrors.set([]);
    this.locationForm.reset({
      code: location?.code ?? '',
      name: location?.name ?? '',
      parent_id: location?.parent_id ?? '',
      location_type: location?.location_type ?? null,
      address: location?.address ?? '',
      city: location?.city ?? '',
      country: location?.country ?? '',
      is_active: location?.is_active ?? true,
    });
    this.modal.set('location');
  }

  protected openClass(): void {
    this.formErrors.set([]);
    this.classForm.reset({ requires_custodian: false, requires_calibration: false });
    this.modal.set('class');
  }

  protected saveLocation(): void {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }
    const value = this.locationForm.getRawValue();
    const payload = {
      ...value,
      parent_id: value.parent_id || null,
      address: value.address || null,
      city: value.city || null,
      country: value.country || null,
    };
    const id = this.editingLocationId;
    this.saving.set(true);
    (id ? this.api.updateLocation(id, payload) : this.api.createLocation(payload)).subscribe({
      next: () => this.done(),
      error: (err: unknown) => this.failed(err, this.locationForm),
    });
  }

  protected saveClass(): void {
    if (this.classForm.invalid) {
      this.classForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.createAssetClass(this.classForm.getRawValue()).subscribe({
      next: () => this.done(),
      error: (err: unknown) => this.failed(err, this.classForm),
    });
  }

  private done(): void {
    this.saving.set(false);
    this.modal.set(null);
    this.load();
  }

  private failed(err: unknown, form: Parameters<typeof applyServerErrors>[0]): void {
    this.saving.set(false);
    this.formErrors.set(applyServerErrors(form, err));
  }
}
