import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { HrApiService } from '../../core/api/hr-api.service';
import { EmployeeResource } from '../../core/models/hr.model';
import { CorrectiveAction, IncidentReport, IncidentType } from './hse.models';
import { HseStore } from './hse.store';
import { INCIDENT_STATUS_KEYS, INCIDENT_TYPE_KEYS } from './hse.utils';

const TYPES: IncidentType[] = ['near_miss', 'first_aid_injury', 'lost_time_accident_inail_or_suva', 'fatal_or_severe'];

/**
 * Incident and near-miss registry with the CAPA board (`/hse/incidents`): every event with its protocol, a reporting drawer
 * with the 5-whys root cause and the corrective actions, and a badge that links a reportable accident to its SUVA / INAIL
 * claim draft in Mod 074. Open corrective actions of every incident are gathered in the board on top.
 */
@Component({
  selector: 'app-hse-incidents-page',
  styleUrl: './hse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'HSE.INC_TITLE' | translate" [subtitle]="'HSE.NAV' | translate">
    </app-page-header>

    <button nz-button nzType="primary" type="button" data-testid="report" (click)="drawerOpen.set(true)">
      {{ 'HSE.INC_REPORT' | translate }}
    </button>

    <nz-card [nzTitle]="'HSE.INC_CAPA' | translate" nzSize="small" class="capa-board">
      <ul data-testid="capa-board">
        @for (item of openActions(); track $index) {
          <li>
            <strong>{{ item.protocol }}</strong> {{ item.action.description }}
            @if (item.action.due_date) {
              <nz-tag>{{ item.action.due_date }}</nz-tag>
            }
          </li>
        }
      </ul>
    </nz-card>

    <nz-table nzSize="small" [nzData]="store.incidents()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'HSE.INC_PROTOCOL' | translate }}</th>
          <th>{{ 'HSE.INC_DESCRIPTION' | translate }}</th>
          <th>{{ 'HSE.INC_PROGNOSIS' | translate }}</th>
          <th></th>
          <th>{{ 'HSE.INC_CLAIM_LINK' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (incident of store.incidents(); track incident.id) {
          <tr>
            <td>{{ incident.protocol_number }}<br />{{ incident.incident_date | date: 'short' }}</td>
            <td>
              <nz-tag>{{ typeLabel(incident.incident_type) | translate }}</nz-tag>
              {{ incident.description }}
            </td>
            <td>{{ incident.prognosis_days }}</td>
            <td>
              <nz-tag>{{ statusLabel(incident.status) | translate }}</nz-tag>
            </td>
            <td>
              @if (incident.linked_insurance_claim_id) {
                <nz-tag nzColor="processing" [attr.data-testid]="'claim-' + incident.id">
                  {{ incident.jurisdiction === 'CH' ? 'SUVA Sunet' : 'INAIL' }}
                </nz-tag>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzTitle]="'HSE.INC_REPORT' | translate"
      nzWidth="520"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()" data-testid="incident-form">
          <nz-form-item>
            <nz-form-control>
              <nz-select formControlName="type" data-testid="type">
                @for (type of types; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="typeLabel(type) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.EMPLOYEE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="employeeId" nzAllowClear nzShowSearch data-testid="employee">
                @for (employee of employees(); track employee.id) {
                  <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'HSE.INC_DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input rows="3" formControlName="description" data-testid="description"></textarea>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.INC_PROGNOSIS' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number formControlName="prognosisDays" [nzMin]="0"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.INC_ROOT_CAUSE' | translate }}</nz-form-label>
            <nz-form-control>
              @for (index of whyIndexes; track index) {
                <input nz-input class="why" [formControlName]="'why' + index" [attr.data-testid]="'why-' + index" />
              }
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'HSE.INC_CAPA' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="correctiveAction" data-testid="capa" />
            </nz-form-control>
          </nz-form-item>
          <button
            nz-button
            nzType="primary"
            type="submit"
            data-testid="submit"
            [nzLoading]="store.busy()"
            [disabled]="form.invalid"
          >
            {{ 'HSE.INC_REPORT' | translate }}
          </button>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class HseIncidentsPageComponent implements OnInit {
  protected readonly store = inject(HseStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly hr = inject(HrApiService);
  protected readonly employees = signal<EmployeeResource[]>([]);
  protected readonly types = TYPES;
  protected readonly whyIndexes = [1, 2, 3, 4, 5];
  protected readonly drawerOpen = signal(false);
  protected readonly typeLabel = (type: IncidentType): string => INCIDENT_TYPE_KEYS[type];
  protected readonly statusLabel = (status: IncidentReport['status']): string => INCIDENT_STATUS_KEYS[status];

  /** The corrective actions not yet verified, across every open incident. */
  protected readonly openActions = computed(() =>
    this.store
      .incidents()
      .filter((incident) => incident.status !== 'closed')
      .flatMap((incident) =>
        incident.corrective_actions
          .filter((action) => action.verification_status !== 'verified')
          .map((action) => ({ protocol: incident.protocol_number, action })),
      ),
  );

  protected readonly form = this.fb.group({
    type: ['near_miss' as IncidentType, Validators.required],
    employeeId: [''],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    prognosisDays: [0, Validators.min(0)],
    why1: [''],
    why2: [''],
    why3: [''],
    why4: [''],
    why5: [''],
    correctiveAction: [''],
  });

  ngOnInit(): void {
    this.store
      .loadIncidents()
      .subscribe({ error: () => this.message.error(this.i18n.instant('HSE.LOAD_ERROR')) });
    this.hr.getEmployees({ per_page: 200 }).subscribe({
      next: (res) => this.employees.set(res.data),
      error: () => this.message.error(this.i18n.instant('HSE.LOAD_ERROR')),
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const whys = [value.why1, value.why2, value.why3, value.why4, value.why5].filter((why) => why.trim() !== '');
    const actions: CorrectiveAction[] =
      value.correctiveAction.trim() === ''
        ? []
        : [{ description: value.correctiveAction.trim(), verification_status: 'open' }];

    this.store
      .reportIncident({
        incident_type: value.type,
        incident_date: new Date().toISOString(),
        description: value.description,
        prognosis_days: value.prognosisDays,
        involved_employee_ids: value.employeeId === '' ? [] : [value.employeeId],
        injury_dynamics: null,
        root_cause_analysis: whys.length === 0 ? null : { whys, root_cause: whys[whys.length - 1] },
        corrective_actions: actions,
      })
      .subscribe({
        next: () => {
          this.drawerOpen.set(false);
          this.form.reset();
        },
        error: (error: HttpErrorResponse) =>
          this.message.error((error.error as { detail?: string } | null)?.detail ?? this.i18n.instant('HSE.SAVE_ERROR')),
      });
  }
}
