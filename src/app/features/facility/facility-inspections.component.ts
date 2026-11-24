import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  FACILITY_INSPECTION_FREQUENCIES,
  FacilityApiService,
  FacilityBuilding,
  FacilityChecklistItem,
  FacilityChecklistItemType,
  FacilityInspection,
  FacilityInspectionAnswer,
  FacilityInspectionFrequency,
  FacilityInspectionTemplate,
  FacilityInspectionTemplateRequest,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe, RadioControlDirective } from '@shared';
import { apiErrorText, facilityAbilities, todayIso } from './facility.util';

interface ChecklistRow {
  label: string;
  type: FacilityChecklistItemType;
  required: boolean;
}

/** Recurring inspections: the checklist templates with their schedule, the generated worklist and the completion with answers. */
@Component({
  selector: 'app-facility-inspections',
  styleUrl: './facility.scss',
  imports: [
    RadioControlDirective,
    FormsModule,
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
    NzRadioModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'FACILITY.INSPECTIONS_TITLE' | translate" [subtitle]="'FACILITY.INSPECTIONS_SUBTITLE' | translate">
      @if (abilities().manage) {
        <button nz-button nzType="primary" (click)="openTemplate()" appIconAction="create"></button>
      }
    </app-page-header>

    @if (!abilities().operate) {
      <nz-empty [nzNotFoundContent]="'FACILITY.OPERATORS_ONLY' | translate"></nz-empty>
    } @else {
      <nz-card class="main-card">
        <nz-tabs>
          <nz-tab [nzTitle]="'FACILITY.TAB_INSPECTIONS' | translate">
            <div class="toolbar">
              <nz-select style="width: 200px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); loadInspections()" [nzPlaceHolder]="'FACILITY.STATUS' | translate">
                @for (value of statuses; track value) {
                  <nz-option [nzValue]="value" [nzLabel]="('FACILITY.INSPECTION_' + value.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
              <label for="facility-inspections-field-2" nzId="facility-inspections-field-2" nz-checkbox [ngModel]="onlyMine()" (ngModelChange)="onlyMine.set($event); loadInspections()">{{ 'FACILITY.ASSIGNED_TO_ME' | translate }}</label>
            </div>
            <nz-table #inspectionTable [nzData]="inspections()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
              <thead>
                <tr>
                  <th>{{ 'FACILITY.NUMBER' | translate }}</th>
                  <th>{{ 'FACILITY.TITLE' | translate }}</th>
                  <th>{{ 'FACILITY.DUE_DATE' | translate }}</th>
                  <th>{{ 'FACILITY.STATUS' | translate }}</th>
                  <th>{{ 'FACILITY.RESULT' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of inspectionTable.data; track row.id) {
                  <tr>
                    <td>{{ row.number }}</td>
                    <td>{{ row.title }}</td>
                    <td>{{ row.due_date }} @if (isOverdue(row)) { <nz-tag nzColor="red">{{ 'FACILITY.OVERDUE' | translate }}</nz-tag> }</td>
                    <td><nz-tag>{{ ('FACILITY.INSPECTION_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
                    <td>
                      @if (row.result) {
                        <nz-tag [nzColor]="row.result === 'pass' ? 'green' : 'red'">{{ ('FACILITY.RESULT_' + row.result.toUpperCase()) | translate }}</nz-tag>
                      }
                    </td>
                    <td>
                      @if (row.status === 'scheduled') {
                        <button nz-button nzSize="small" (click)="start(row)">{{ 'FACILITY.START' | translate }}</button>
                      }
                      @if (row.status === 'scheduled' || row.status === 'in_progress') {
                        <button nz-button nzSize="small" nzType="primary" (click)="openComplete(row)">{{ 'FACILITY.COMPLETE' | translate }}</button>
                        <button nz-button nzSize="small" nzDanger nz-popconfirm [nzPopconfirmTitle]="'FACILITY.CANCEL_INSPECTION_CONFIRM' | translate" (nzOnConfirm)="cancel(row)">{{ 'FACILITY.CANCEL' | translate }}</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if (!loading() && inspections().length === 0) {
              <nz-empty [nzNotFoundContent]="'FACILITY.NO_INSPECTIONS' | translate"></nz-empty>
            }
          </nz-tab>

          <nz-tab [nzTitle]="'FACILITY.TAB_TEMPLATES' | translate">
            @if (abilities().manage) {
              <div class="toolbar">
                <button nz-button (click)="generate()">{{ 'FACILITY.GENERATE_DUE' | translate }}</button>
              </div>
            }
            <nz-table #templateTable [nzData]="templates()" nzSize="small" [nzPageSize]="25">
              <thead>
                <tr>
                  <th>{{ 'FACILITY.NAME' | translate }}</th>
                  <th>{{ 'FACILITY.FREQUENCY' | translate }}</th>
                  <th>{{ 'FACILITY.NEXT_DUE' | translate }}</th>
                  <th>{{ 'FACILITY.CHECKLIST_ITEMS' | translate }}</th>
                  <th>{{ 'FACILITY.ACTIVE' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of templateTable.data; track row.id) {
                  <tr>
                    <td>{{ row.name }}</td>
                    <td>{{ ('FACILITY.FREQUENCY_' + row.frequency.toUpperCase()) | translate }} x{{ row.interval_count }}</td>
                    <td>{{ row.next_due_date }}</td>
                    <td>{{ row.checklist.length }}</td>
                    <td><nz-tag [nzColor]="row.is_active ? 'green' : 'default'">{{ (row.is_active ? 'COMMON.YES' : 'COMMON.NO') | translate }}</nz-tag></td>
                    <td>
                      @if (abilities().manage) {
                        <button nz-button nzSize="small" (click)="openTemplate(row)" appIconAction="edit"></button>
                        <button nz-button nzSize="small" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FACILITY.DELETE_TEMPLATE_CONFIRM' | translate" (nzOnConfirm)="removeTemplate(row)"></button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>
        </nz-tabs>
      </nz-card>
    }

    <nz-modal appModalActions [(nzVisible)]="templateVisible" [nzTitle]="'FACILITY.INSPECTION_TEMPLATE' | translate" (nzOnCancel)="templateVisible.set(false)" (nzOnOk)="saveTemplate()" okAction="save" [nzOkDisabled]="templateForm.invalid || rows().length === 0" nzWidth="720px">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="templateForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'FACILITY.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="name" maxlength="150" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.FREQUENCY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="frequency">
                  @for (value of frequencies; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('FACILITY.FREQUENCY_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.INTERVAL' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="1" max="52" formControlName="interval_count" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.NEXT_DUE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="next_due_date" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.BUILDING' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="building_id" nzAllowClear>
                  @for (building of buildings(); track building.id) {
                    <nz-option [nzValue]="building.id" [nzLabel]="building.code + ' - ' + building.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.LEAD_DAYS' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" max="60" formControlName="lead_days" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.ACTIVE' | translate }}</nz-form-label>
              <nz-form-control><nz-switch formControlName="is_active"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
          <h4>{{ 'FACILITY.CHECKLIST' | translate }}</h4>
          @for (row of rows(); track $index) {
            <div class="checklist-item" style="grid-template-columns: 1fr 160px 90px 40px">
              <input nz-input [ngModel]="row.label" (ngModelChange)="updateRow($index, { label: $event })" [ngModelOptions]="{ standalone: true }" maxlength="190" [placeholder]="'FACILITY.ITEM_LABEL' | translate" />
              <nz-select [ngModel]="row.type" (ngModelChange)="updateRow($index, { type: $event })" [ngModelOptions]="{ standalone: true }">
                <nz-option nzValue="pass_fail" [nzLabel]="'FACILITY.ITEM_PASS_FAIL' | translate"></nz-option>
                <nz-option nzValue="number" [nzLabel]="'FACILITY.ITEM_NUMBER' | translate"></nz-option>
                <nz-option nzValue="text" [nzLabel]="'FACILITY.ITEM_TEXT' | translate"></nz-option>
              </nz-select>
              <label [attr.for]="'facility-inspections-field-' + $index" [nzId]="'facility-inspections-field-' + $index" nz-checkbox [ngModel]="row.required" (ngModelChange)="updateRow($index, { required: $event })" [ngModelOptions]="{ standalone: true }">{{ 'FACILITY.REQUIRED' | translate }}</label>
              <button type="button" nz-button nzType="text" nzDanger appIconAction="delete" (click)="removeRow($index)"></button>
            </div>
          }
          <button type="button" nz-button nzType="dashed" (click)="addRow()">{{ 'FACILITY.ADD_ITEM' | translate }}</button>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="completeVisible" [nzTitle]="completing()?.number ?? ''" (nzOnCancel)="completeVisible.set(false)" (nzOnOk)="complete()" okAction="confirm" nzWidth="720px">
      <ng-container *nzModalContent>
        @for (item of completing()?.checklist ?? []; track item.key) {
          <div class="checklist-item">
            <div>
              {{ item.label }}
              @if (item.required) {
                <span class="muted"> *</span>
              }
            </div>
            @if (item.type === 'pass_fail') {
              <nz-radio-group [ngModel]="answers()[item.key]?.result ?? null" (ngModelChange)="setAnswer(item.key, { result: $event })">
                <label [attr.for]="'facility-inspections-pass-' + $index" appRadioControl nz-radio-button nzValue="pass">{{ 'FACILITY.PASS' | translate }}</label>
                <label [attr.for]="'facility-inspections-fail-' + $index" appRadioControl nz-radio-button nzValue="fail">{{ 'FACILITY.FAIL' | translate }}</label>
                <label [attr.for]="'facility-inspections-na-' + $index" appRadioControl nz-radio-button nzValue="na">{{ 'FACILITY.NA' | translate }}</label>
              </nz-radio-group>
            } @else {
              <input nz-input [attr.type]="item.type === 'number' ? 'number' : 'text'" [ngModel]="answers()[item.key]?.value ?? ''" (ngModelChange)="setAnswer(item.key, { value: $event })" />
            }
          </div>
        }
        <nz-form-item style="margin-top: 12px">
          <nz-form-label>{{ 'FACILITY.NOTES' | translate }}</nz-form-label>
          <nz-form-control><textarea nz-input rows="3" [ngModel]="completionNotes()" (ngModelChange)="completionNotes.set($event)" maxlength="4000"></textarea></nz-form-control>
        </nz-form-item>
      </ng-container>
    </nz-modal>
  `,
})
export class FacilityInspectionsComponent implements OnInit {
  private readonly api = inject(FacilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authStore = inject(AuthStore);

  readonly frequencies = FACILITY_INSPECTION_FREQUENCIES;
  readonly statuses = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
  readonly abilities = computed(() => facilityAbilities(this.authStore.activeRoles(), this.authStore.userPermissions()));

  readonly inspections = signal<FacilityInspection[]>([]);
  readonly templates = signal<FacilityInspectionTemplate[]>([]);
  readonly buildings = signal<FacilityBuilding[]>([]);
  readonly loading = signal(false);
  readonly status = signal<string | null>('scheduled');
  readonly onlyMine = signal(false);
  readonly templateVisible = signal(false);
  readonly completeVisible = signal(false);
  readonly rows = signal<ChecklistRow[]>([]);
  readonly completing = signal<FacilityInspection | null>(null);
  readonly answers = signal<Record<string, FacilityInspectionAnswer>>({});
  readonly completionNotes = signal('');
  private editing: FacilityInspectionTemplate | null = null;

  readonly templateForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    frequency: ['monthly' as FacilityInspectionFrequency, [Validators.required]],
    interval_count: [1, [Validators.min(1), Validators.max(52)]],
    next_due_date: [todayIso(), [Validators.required]],
    building_id: [''],
    lead_days: [0, [Validators.min(0), Validators.max(60)]],
    is_active: [true],
  });

  ngOnInit(): void {
    if (!this.abilities().operate) {
      return;
    }

    this.loadInspections();
    this.loadTemplates();
    this.api.getBuildings({ active: true, per_page: 100 }).subscribe({ next: (response) => this.buildings.set(response.data) });
  }

  isOverdue(inspection: FacilityInspection): boolean {
    return (inspection.status === 'scheduled' || inspection.status === 'in_progress') && inspection.due_date < todayIso();
  }

  loadInspections(): void {
    this.loading.set(true);
    this.api.getInspections({ status: this.status() ?? undefined, mine: this.onlyMine(), per_page: 100 }).subscribe({
      next: (response) => {
        this.inspections.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('FACILITY.ACTION_ERROR'));
      },
    });
  }

  loadTemplates(): void {
    this.api.getInspectionTemplates({ per_page: 100 }).subscribe({ next: (response) => this.templates.set(response.data) });
  }

  start(inspection: FacilityInspection): void {
    this.api.startInspection(inspection.id).subscribe({
      next: () => this.loadInspections(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  cancel(inspection: FacilityInspection): void {
    this.api.cancelInspection(inspection.id, this.translate.instant('FACILITY.CANCELLED_BY_USER')).subscribe({
      next: () => this.loadInspections(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  openComplete(inspection: FacilityInspection): void {
    this.completing.set(inspection);
    this.answers.set({});
    this.completionNotes.set('');
    this.completeVisible.set(true);
  }

  setAnswer(key: string, change: Partial<FacilityInspectionAnswer>): void {
    this.answers.update((current) => ({ ...current, [key]: { ...(current[key] ?? { key }), key, ...change } }));
  }

  complete(): void {
    const inspection = this.completing();
    if (!inspection) {
      return;
    }

    const answers = Object.values(this.answers()).map((answer) => ({
      key: answer.key,
      result: answer.result ?? null,
      value: answer.value === undefined || answer.value === null || answer.value === '' ? null : String(answer.value),
      notes: answer.notes ?? null,
    }));

    this.api.completeInspection(inspection.id, { answers, notes: this.completionNotes() || null }).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant(response.data.result === 'fail' ? 'FACILITY.INSPECTION_FAILED_REQUEST' : 'FACILITY.INSPECTION_COMPLETED'));
        this.completeVisible.set(false);
        this.loadInspections();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  openTemplate(template: FacilityInspectionTemplate | null = null): void {
    this.editing = template;
    this.templateForm.reset({
      name: template?.name ?? '',
      frequency: template?.frequency ?? 'monthly',
      interval_count: template?.interval_count ?? 1,
      next_due_date: template?.next_due_date ?? todayIso(),
      building_id: template?.building_id ?? '',
      lead_days: template?.lead_days ?? 0,
      is_active: template?.is_active ?? true,
    });
    this.rows.set(template ? template.checklist.map((item) => ({ label: item.label, type: item.type, required: item.required })) : [{ label: '', type: 'pass_fail', required: true }]);
    this.templateVisible.set(true);
  }

  addRow(): void {
    this.rows.update((current) => [...current, { label: '', type: 'pass_fail', required: true }]);
  }

  removeRow(index: number): void {
    this.rows.update((current) => current.filter((_, position) => position !== index));
  }

  updateRow(index: number, change: Partial<ChecklistRow>): void {
    this.rows.update((current) => current.map((row, position) => (position === index ? { ...row, ...change } : row)));
  }

  saveTemplate(): void {
    const value = this.templateForm.getRawValue();
    const checklist: FacilityChecklistItem[] = this.rows().filter((row) => row.label.trim() !== '').map((row) => ({ label: row.label.trim(), type: row.type, required: row.required }));
    if (checklist.length === 0) {
      return;
    }

    const payload: FacilityInspectionTemplateRequest = {
      name: value.name,
      frequency: value.frequency,
      interval_count: value.interval_count,
      next_due_date: value.next_due_date,
      building_id: value.building_id || null,
      lead_days: value.lead_days,
      is_active: value.is_active,
      checklist,
    };
    const request = this.editing ? this.api.updateInspectionTemplate(this.editing.id, payload) : this.api.createInspectionTemplate(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('FACILITY.TEMPLATE_SAVED'));
        this.templateVisible.set(false);
        this.loadTemplates();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  removeTemplate(template: FacilityInspectionTemplate): void {
    this.api.deleteInspectionTemplate(template.id).subscribe({
      next: () => this.loadTemplates(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  generate(): void {
    this.api.generateInspections().subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('FACILITY.GENERATED', { count: response.data.length }));
        this.loadInspections();
        this.loadTemplates();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }
}
