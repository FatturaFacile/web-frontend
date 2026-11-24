import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ConstructionApiService } from '../../core/api/construction-api.service';
import { HrEmployeeApiService } from '../../core/api/hr-employee-api.service';
import { ManufacturingApiService } from '../../core/api/manufacturing-api.service';
import { ConstructionSite } from '../../core/models/construction.model';
import { PositionResource } from '../../core/models/hr-employee.model';
import { MfgWorkCenterResource } from '../../core/models/manufacturing.model';
import {
  CertificateType,
  Jurisdiction,
  RequirementMatrix,
  RequirementMatrixPayload,
} from './hse.models';
import { HseStore } from './hse.store';
import { CERTIFICATE_KEYS } from './hse.utils';

const CERTIFICATES = Object.keys(CERTIFICATE_KEYS) as CertificateType[];

/**
 * Configurator of the safety requirements (`/hse/requirements`): one rule per job position, work center or construction
 * site, listing the certificates (with their validity), the medical protocols and the PPE a worker needs. The hard block
 * of Mod 064, 084 and 108 is computed from these rules. Saving an existing rule sends its version, so a concurrent edit
 * is rejected by the server instead of overwritten.
 */
@Component({
  selector: 'app-hse-requirements-page',
  styleUrl: './hse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'HSE.REQ_TITLE' | translate" [subtitle]="'HSE.NAV' | translate">
    </app-page-header>

    <button nz-button nzType="primary" type="button" data-testid="new-rule" (click)="open()">
      {{ 'HSE.REQ_NEW' | translate }}
    </button>

    <nz-table nzSize="small" [nzData]="store.requirementMatrices()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'HSE.REQ_NAME' | translate }}</th>
          <th>{{ 'HSE.FILTER_JURISDICTION' | translate }}</th>
          <th>{{ 'HSE.REQ_TRAININGS' | translate }}</th>
          <th>{{ 'HSE.REQ_MEDICAL' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (rule of store.requirementMatrices(); track rule.id) {
          <tr [attr.data-testid]="'rule-' + rule.id">
            <td>{{ rule.name }}</td>
            <td>
              <nz-tag>{{ rule.jurisdiction }}</nz-tag>
            </td>
            <td>
              @for (training of rule.required_training_types; track training.type) {
                <nz-tag>{{ certificateKey(training.type) | translate }}</nz-tag>
              }
            </td>
            <td>{{ rule.required_medical_exam_codes.join(', ') }}</td>
            <td>
              <button nz-button nzSize="small" type="button" (click)="open(rule)">
                {{ 'HSE.REQ_EDIT' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzTitle]="'HSE.REQ_TITLE' | translate"
      nzWidth="520"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form
          nz-form
          nzLayout="vertical"
          [formGroup]="form"
          (ngSubmit)="submit()"
          data-testid="rule-form"
        >
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'HSE.REQ_NAME' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="name" data-testid="name" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.FILTER_JURISDICTION' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="jurisdiction" data-testid="jurisdiction">
                <nz-option nzValue="IT" nzLabel="IT"></nz-option>
                <nz-option nzValue="CH" nzLabel="CH"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.REQ_POSITION' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select
                formControlName="positionId"
                nzAllowClear
                nzShowSearch
                data-testid="position"
              >
                @for (position of positions(); track position.id) {
                  <nz-option [nzValue]="position.id" [nzLabel]="position.title"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.REQ_WORK_CENTER' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select
                formControlName="workCenterId"
                nzAllowClear
                nzShowSearch
                data-testid="work-center"
              >
                @for (center of workCenters(); track center.id) {
                  <nz-option [nzValue]="center.id" [nzLabel]="center.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.REQ_SITE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="siteId" nzAllowClear nzShowSearch data-testid="site">
                @for (site of sites(); track site.id) {
                  <nz-option [nzValue]="site.id" [nzLabel]="site.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (!hasScope()) {
            <p class="hse-hint" data-testid="needs-scope">
              {{ 'HSE.REQ_NEEDS_SCOPE' | translate }}
            </p>
          }
          <nz-form-item>
            <nz-form-label>{{ 'HSE.REQ_HAZARD_CLASS' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="hazardClass" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.REQ_TRAININGS' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="trainings" nzMode="multiple" data-testid="trainings">
                @for (type of certificates; track type) {
                  <nz-option
                    [nzValue]="type"
                    [nzLabel]="certificateKey(type) | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.REQ_MEDICAL' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select
                formControlName="medicalCodes"
                nzMode="tags"
                data-testid="medical"
              ></nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.REQ_ACTIVE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-switch formControlName="isActive"></nz-switch>
            </nz-form-control>
          </nz-form-item>
          <button
            nz-button
            nzType="primary"
            type="submit"
            data-testid="submit"
            [nzLoading]="store.busy()"
            [disabled]="form.invalid || !hasScope()"
          >
            {{ 'HSE.REQ_SAVE' | translate }}
          </button>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class HseRequirementsPageComponent implements OnInit {
  protected readonly store = inject(HseStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly hr = inject(HrEmployeeApiService);
  private readonly manufacturing = inject(ManufacturingApiService);
  private readonly construction = inject(ConstructionApiService);

  protected readonly certificates = CERTIFICATES;
  protected readonly certificateKey = (type: CertificateType): string => CERTIFICATE_KEYS[type];
  protected readonly positions = signal<PositionResource[]>([]);
  protected readonly workCenters = signal<MfgWorkCenterResource[]>([]);
  protected readonly sites = signal<ConstructionSite[]>([]);
  protected readonly drawerOpen = signal(false);
  private editing: RequirementMatrix | null = null;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    jurisdiction: ['IT' as Jurisdiction],
    positionId: [''],
    workCenterId: [''],
    siteId: [''],
    hazardClass: [''],
    trainings: [[] as CertificateType[]],
    medicalCodes: [[] as string[]],
    isActive: [true],
  });

  ngOnInit(): void {
    const failed = (): void => {
      this.message.error(this.i18n.instant('HSE.LOAD_ERROR'));
    };

    this.store.loadRequirementMatrices().subscribe({ error: failed });
    this.hr
      .getPositions({ per_page: 200 })
      .subscribe({ next: (res) => this.positions.set(res.data), error: failed });
    this.manufacturing
      .getWorkCenters({ per_page: 200 })
      .subscribe({ next: (res) => this.workCenters.set(res.data), error: failed });
    this.construction
      .getSites({ per_page: 200 })
      .subscribe({ next: (res) => this.sites.set(res.data), error: failed });
  }

  /** A rule must apply to something: a position, a work center or a site. */
  protected hasScope(): boolean {
    const { positionId, workCenterId, siteId } = this.form.getRawValue();

    return positionId !== '' || workCenterId !== '' || siteId !== '';
  }

  protected open(rule?: RequirementMatrix): void {
    this.editing = rule ?? null;
    this.form.reset({
      name: rule?.name ?? '',
      jurisdiction: rule?.jurisdiction ?? 'IT',
      positionId: rule?.job_position_id ?? '',
      workCenterId: rule?.work_center_id ?? '',
      siteId: rule?.construction_site_id ?? '',
      hazardClass: rule?.suva_hazard_class ?? '',
      trainings: rule?.required_training_types.map((training) => training.type) ?? [],
      medicalCodes: rule?.required_medical_exam_codes ?? [],
      isActive: rule?.is_active ?? true,
    });
    this.drawerOpen.set(true);
  }

  protected submit(): void {
    if (this.form.invalid || !this.hasScope()) {
      return;
    }

    const value = this.form.getRawValue();
    const kept = new Map(
      (this.editing?.required_training_types ?? []).map((training) => [training.type, training]),
    );
    const payload: RequirementMatrixPayload = {
      name: value.name.trim(),
      jurisdiction: value.jurisdiction,
      job_position_id: value.positionId || null,
      work_center_id: value.workCenterId || null,
      construction_site_id: value.siteId || null,
      suva_hazard_class: value.hazardClass.trim() || null,
      // A validity already configured for a certificate is kept when the certificate stays in the rule.
      required_training_types: value.trainings.map((type) => ({
        type,
        validity_months: kept.get(type)?.validity_months ?? null,
      })),
      required_medical_exam_codes: value.medicalCodes,
      required_ppe_product_ids: this.editing?.required_ppe_product_ids ?? [],
      is_active: value.isActive,
      ...(this.editing ? { expected_version: this.editing.version } : {}),
    };

    this.store.saveRequirementMatrix(payload, this.editing?.id).subscribe({
      next: () => this.drawerOpen.set(false),
      error: (error: HttpErrorResponse) =>
        this.message.error(
          (error.error as { detail?: string } | null)?.detail ??
            this.i18n.instant('HSE.SAVE_ERROR'),
        ),
    });
  }
}
