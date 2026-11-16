import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PlanningApiService, PlanningRate, PlanningResource, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './planning.util';

/** Capacity resources with their default monthly capacity and the load each item puts on them. */
@Component({
  selector: 'app-planning-resources',
  styleUrl: './planning.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'PLANNING.RESOURCES_TITLE' | translate" [subtitle]="'PLANNING.RESOURCES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openResource()" appIconAction="create"></button>
    </app-page-header>

    @for (resource of resources(); track resource.id) {
      <nz-card class="main-card" [nzTitle]="resource.code + ' - ' + resource.name">
        <div class="toolbar">
          <nz-tag [nzColor]="resource.is_active ? 'green' : 'default'">{{ (resource.is_active ? 'PLANNING.ACTIVE' : 'PLANNING.INACTIVE') | translate }}</nz-tag>
          <span class="muted">{{ 'PLANNING.DEFAULT_CAPACITY' | translate }}: {{ resource.default_capacity | number: '1.0-3' }} {{ resource.unit }}</span>
          <span class="spacer"></span>
          <button nz-button (click)="openRate(resource)">{{ 'PLANNING.NEW_RATE' | translate }}</button>
          <button nz-button nzType="text" appIconAction="edit" (click)="openResource(resource)"></button>
          <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'PLANNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeResource(resource)"></button>
        </div>
        <nz-table #rateTable [nzData]="resource.rates ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLANNING.ITEM_CODE' | translate }}</th>
              <th class="num">{{ 'PLANNING.LOAD_PER_UNIT' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (rate of rateTable.data; track rate.id) {
              <tr>
                <td>{{ rate.item_code }}</td>
                <td class="num">{{ rate.load_per_unit | number: '1.0-5' }}</td>
                <td>
                  <div class="row-actions">
                    <button nz-button nzType="text" appIconAction="edit" (click)="openRate(resource, rate)"></button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'PLANNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeRate(rate)"></button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
    @if (!loading() && resources().length === 0) {
      <nz-empty [nzNotFoundContent]="'PLANNING.NO_RESOURCES' | translate"></nz-empty>
    }

    <nz-modal [(nzVisible)]="resourceVisible" [nzTitle]="(editingResource() ? 'PLANNING.EDIT_RESOURCE' : 'PLANNING.NEW_RESOURCE') | translate" (nzOnCancel)="resourceVisible.set(false)" (nzOnOk)="saveResource()" okAction="save" [nzOkDisabled]="resourceForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="resourceForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="resource-code">{{ 'PLANNING.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="resource-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="resource-name">{{ 'PLANNING.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="resource-name" formControlName="name" maxlength="160" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="resource-unit">{{ 'PLANNING.UNIT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="resource-unit" formControlName="unit" maxlength="20" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="resource-capacity">{{ 'PLANNING.DEFAULT_CAPACITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="resource-capacity" type="number" min="0" step="any" formControlName="default_capacity" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <nz-form-control><label nz-checkbox formControlName="is_active">{{ 'PLANNING.ACTIVE' | translate }}</label></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="rateVisible" [nzTitle]="(editingRate() ? 'PLANNING.EDIT_RATE' : 'PLANNING.NEW_RATE') | translate" (nzOnCancel)="rateVisible.set(false)" (nzOnOk)="saveRate()" okAction="save" [nzOkDisabled]="rateForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="rateForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="rate-code">{{ 'PLANNING.ITEM_CODE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="rate-code" formControlName="item_code" maxlength="60" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="rate-load">{{ 'PLANNING.LOAD_PER_UNIT' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="rate-load" type="number" min="0" step="any" formControlName="load_per_unit" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PlanningResourcesComponent implements OnInit {
  private readonly api = inject(PlanningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly resources = signal<PlanningResource[]>([]);
  readonly loading = signal(false);
  readonly resourceVisible = signal(false);
  readonly editingResource = signal<PlanningResource | null>(null);
  readonly rateVisible = signal(false);
  readonly editingRate = signal<PlanningRate | null>(null);
  readonly rateResource = signal<PlanningResource | null>(null);

  readonly resourceForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    unit: ['hours', [Validators.required, Validators.maxLength(20)]],
    default_capacity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    is_active: [true],
  });

  readonly rateForm = this.fb.group({
    item_code: ['', [Validators.required, Validators.maxLength(60)]],
    load_per_unit: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.00001)]),
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getResources().subscribe({
      next: (response) => {
        this.resources.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PLANNING.ACTION_ERROR'));
      },
    });
  }

  openResource(resource: PlanningResource | null = null): void {
    this.editingResource.set(resource);
    this.resourceForm.reset({
      code: resource?.code ?? '',
      name: resource?.name ?? '',
      unit: resource?.unit ?? 'hours',
      default_capacity: resource ? Number(resource.default_capacity) : null,
      is_active: resource?.is_active ?? true,
    });
    this.resourceVisible.set(true);
  }

  saveResource(): void {
    const value = this.resourceForm.getRawValue();
    const payload = { code: value.code, name: value.name, work_center_id: null, unit: value.unit, default_capacity: String(value.default_capacity), is_active: value.is_active };
    const current = this.editingResource();
    const request = current ? this.api.updateResource(current.id, payload) : this.api.createResource(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLANNING.RESOURCE_SAVED'));
        this.resourceVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }

  removeResource(resource: PlanningResource): void {
    this.api.deleteResource(resource.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLANNING.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }

  openRate(resource: PlanningResource, rate: PlanningRate | null = null): void {
    this.rateResource.set(resource);
    this.editingRate.set(rate);
    this.rateForm.reset({ item_code: rate?.item_code ?? '', load_per_unit: rate ? Number(rate.load_per_unit) : null });
    this.rateVisible.set(true);
  }

  saveRate(): void {
    const resource = this.rateResource();
    if (!resource) {
      return;
    }

    const value = this.rateForm.getRawValue();
    const payload = { item_code: value.item_code, load_per_unit: String(value.load_per_unit) };
    const current = this.editingRate();
    const request = current ? this.api.updateRate(current.id, payload) : this.api.createRate(resource.id, payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLANNING.RATE_SAVED'));
        this.rateVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }

  removeRate(rate: PlanningRate): void {
    this.api.deleteRate(rate.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLANNING.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }
}
