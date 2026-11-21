import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  ManufacturingProductionApiService,
  MfgMachineDetail,
  MfgOperationType,
  MfgRoutingDetail,
  MfgRoutingOperationDetail,
  MfgRoutingSimulation,
  MfgWorkCenterDetail,
  SaveRoutingPayload,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { debounceTime, forkJoin, Subject, switchMap, catchError, of } from 'rxjs';
import { BomItemPickerComponent } from '../bom/bom-item-picker.component';
import {
  apiErrorText,
  blankOperation,
  ganttBars,
  moveOperation,
  operationsPayload,
  toNum,
} from './production-engineering.utils';

const OPERATION_TYPES: readonly MfgOperationType[] = ['internal_machining', 'manual_assembly', 'external_subcontracting'];
const TYPE_COLOR: Record<MfgOperationType, string> = {
  internal_machining: 'blue',
  manual_assembly: 'green',
  external_subcontracting: 'orange',
};

interface RoutingDraft {
  mfg_item_id: string | null;
  name: string;
  revision: string;
  status: 'draft' | 'active' | 'obsolete';
  is_default: boolean;
  notes: string;
  operations: MfgRoutingOperationDetail[];
}

const blankRouting = (): RoutingDraft => ({
  mfg_item_id: null,
  name: '',
  revision: '',
  status: 'draft',
  is_default: false,
  notes: '',
  operations: [],
});

const draftOf = (routing: MfgRoutingDetail): RoutingDraft => ({
  mfg_item_id: routing.mfg_item_id,
  name: routing.name,
  revision: routing.revision,
  status: (routing.status as RoutingDraft['status']) ?? 'draft',
  is_default: routing.is_default,
  notes: routing.notes ?? '',
  operations: (routing.operations ?? []).map((op) => ({ ...op, bom_components: op.bom_components ?? [], alternate_work_center_ids: op.alternate_work_center_ids ?? [] })),
});

/** Visual routing designer: the operations as an ordered flow, an editor per operation and a live lead time / cost simulator. */
@Component({
  selector: 'app-mfg-routing-designer',
  imports: [
    DecimalPipe,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    BomItemPickerComponent,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  styles: `
    .bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px }
    .grow { flex: 1 1 260px }
    .layout { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.4fr); gap: 16px; align-items: start }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr } }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 14px }
    .grid .field { display: flex; flex-direction: column; gap: 4px; font-size: 13px }
    .grid nz-input-number, .grid nz-select { width: 100% }
    ol.flow { list-style: none; margin: 0 0 12px; padding: 0 }
    ol.flow li { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid var(--border-color, #d9d9d9); border-radius: 6px; margin-bottom: 14px; position: relative }
    ol.flow li.selected { border-color: #1677ff; box-shadow: 0 0 0 1px #1677ff }
    ol.flow li:not(:last-child)::after { content: '↓'; position: absolute; left: 50%; bottom: -17px; font-size: 14px; opacity: .6 }
    .step-main { flex: 1; text-align: left; background: none; border: 0; cursor: pointer; padding: 0; color: inherit; font: inherit }
    .seq { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 36px }
    .muted { opacity: .7; font-size: 12px }
    h4 { margin: 16px 0 8px }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 12px 0 }
    .kpi { border: 1px solid var(--border-color, #d9d9d9); border-radius: 6px; padding: 8px 12px }
    .kpi b { display: block; font-size: 20px; font-variant-numeric: tabular-nums }
    .gantt { position: relative; margin: 8px 0 }
    .gantt div.line { display: grid; grid-template-columns: 90px 1fr; gap: 8px; align-items: center; margin-bottom: 4px; font-size: 12px }
    .track { position: relative; height: 14px; background: #f5f5f5; border-radius: 3px }
    .bar-fill { position: absolute; top: 0; bottom: 0; background: #1677ff; border-radius: 3px; min-width: 2px }
    .bar-fill.overlap { background: #52c41a }
    .num { text-align: right; font-variant-numeric: tabular-nums }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 }
  `,
  template: `
    <app-page-header [title]="'MFG_PE.ROUTINGS_TITLE' | translate" [subtitle]="'MFG_PE.ROUTINGS_SUBTITLE' | translate"></app-page-header>

    <div class="bar">
      <nz-select
        class="grow"
        nzShowSearch
        nzAllowClear
        [nzPlaceHolder]="'MFG_PE.SELECT_ROUTING' | translate"
        [attr.aria-label]="'MFG_PE.SELECT_ROUTING' | translate"
        [ngModel]="routingId()"
        (ngModelChange)="open($event)"
        data-testid="routing-select"
      >
        @for (r of routings(); track r.id) {
          <nz-option [nzValue]="r.id" [nzLabel]="r.routing_number + ' · ' + r.name + ' (' + r.revision + ')'"></nz-option>
        }
      </nz-select>
      <button nz-button type="button" data-testid="new-routing" (click)="create()">{{ 'MFG_PE.NEW_ROUTING' | translate }}</button>
    </div>

    @if (draft(); as d) {
      <div class="layout">
        <div>
          <nz-card [nzTitle]="'MFG_PE.ROUTING_HEADER' | translate">
            <div class="grid">
              @if (!routingId()) {
                <div class="field"><span>{{ 'MFG_PE.ITEM' | translate }}</span><app-bom-item-picker [attr.aria-label]="'MFG_PE.ITEM' | translate" placeholder="MFG_PE.ITEM" [value]="d.mfg_item_id" (valueChange)="patch({ mfg_item_id: $event })"></app-bom-item-picker>
                </div>
              } @else {
                <div><span class="muted">{{ 'MFG_PE.ITEM' | translate }}</span><br />{{ routingLabel() }}</div>
              }
              <div class="field"><span>{{ 'MFG_PE.COL_NAME' | translate }}</span><input [attr.aria-label]="'MFG_PE.COL_NAME' | translate" nz-input [ngModel]="d.name" (ngModelChange)="patch({ name: $event })" data-testid="r-name" /></div>
              <div class="field"><span>{{ 'MFG_PE.REVISION' | translate }}</span><input [attr.aria-label]="'MFG_PE.REVISION' | translate" nz-input [ngModel]="d.revision" (ngModelChange)="patch({ revision: $event })" /></div>
              <div class="field"><span>{{ 'MFG_PE.COL_STATUS' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.COL_STATUS' | translate" [ngModel]="d.status" (ngModelChange)="patch({ status: $event })">
                  <nz-option nzValue="draft" [nzLabel]="'MFG_PE.ROUTING_DRAFT' | translate"></nz-option>
                  <nz-option nzValue="active" [nzLabel]="'MFG_PE.STATUS_ACTIVE' | translate"></nz-option>
                  <nz-option nzValue="obsolete" [nzLabel]="'MFG_PE.ROUTING_OBSOLETE' | translate"></nz-option>
                </nz-select>
              </div>
              <span nz-checkbox [ngModel]="d.is_default" (ngModelChange)="patch({ is_default: $event })">{{ 'MFG_PE.DEFAULT_ROUTING' | translate }}</span>
            </div>

            <h4>{{ 'MFG_PE.OPERATIONS' | translate }} ({{ d.operations.length }})</h4>
            <ol class="flow" data-testid="flow">
              @for (op of d.operations; track $index) {
                <li [class.selected]="$index === selected()" [attr.data-testid]="'op-' + $index">
                  <span class="seq">{{ ($index + 1) * 10 }}</span>
                  <button type="button" class="step-main" (click)="selected.set($index)" [attr.aria-label]="op.operation_code + ' ' + op.name">
                    <strong>{{ op.operation_code }}</strong> {{ op.name }}
                    <div class="muted">
                      <nz-tag [nzColor]="typeColor(op.operation_type)">{{ 'MFG_PE.TYPE_' + (op.operation_type ?? 'internal_machining').toUpperCase() | translate }}</nz-tag>
                      {{ workCenterCode(op.work_center_id) }}
                      · {{ 'MFG_PE.SETUP' | translate }} {{ op.setup_time_minutes ?? 0 }} · {{ 'MFG_PE.RUN' | translate }} {{ op.run_time_minutes_per_unit ?? 0 }}
                    </div>
                  </button>
                  <button nz-button nzSize="small" type="button" [disabled]="$index === 0" [attr.aria-label]="'MFG_PE.MOVE_UP' | translate" (click)="move($index, -1)">↑</button>
                  <button nz-button nzSize="small" type="button" [disabled]="$index === d.operations.length - 1" [attr.aria-label]="'MFG_PE.MOVE_DOWN' | translate" (click)="move($index, 1)">↓</button>
                  <button nz-button nzSize="small" nzDanger type="button" [attr.aria-label]="'MFG_PE.DELETE' | translate" (click)="removeOp($index)">×</button>
                </li>
              }
            </ol>
            <button nz-button type="button" data-testid="add-op" (click)="addOp()">{{ 'MFG_PE.ADD_OPERATION' | translate }}</button>

            <div class="actions">
              <button nz-button nzType="primary" type="button" data-testid="save-routing" [disabled]="!valid() || saving()" [nzLoading]="saving()" (click)="save()">{{ 'MFG_PE.SAVE' | translate }}</button>
              @if (routingId()) {
                <input nz-input style="width: 120px" [placeholder]="'MFG_PE.NEXT_REVISION' | translate" [attr.aria-label]="'MFG_PE.NEXT_REVISION' | translate" [ngModel]="cloneRevision()" (ngModelChange)="cloneRevision.set($event)" data-testid="clone-revision" />
                <button nz-button type="button" data-testid="clone" [disabled]="dirty()" (click)="clone()">{{ 'MFG_PE.CLONE_REVISION' | translate }}</button>
              }
            </div>
          </nz-card>
        </div>

        <div>
          @if (currentOp(); as op) {
            <nz-card [nzTitle]="'MFG_PE.OPERATION_EDITOR' | translate" data-testid="op-editor">
              <div class="grid">
                <div class="field"><span>{{ 'MFG_PE.COL_CODE' | translate }}</span><input [attr.aria-label]="'MFG_PE.COL_CODE' | translate" nz-input [ngModel]="op.operation_code" (ngModelChange)="patchOp({ operation_code: $event })" data-testid="o-code" /></div>
                <div class="field"><span>{{ 'MFG_PE.COL_NAME' | translate }}</span><input [attr.aria-label]="'MFG_PE.COL_NAME' | translate" nz-input [ngModel]="op.name" (ngModelChange)="patchOp({ name: $event })" data-testid="o-name" /></div>
                <div class="field"><span>{{ 'MFG_PE.OPERATION_TYPE' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.OPERATION_TYPE' | translate" [ngModel]="op.operation_type" (ngModelChange)="patchOp({ operation_type: $event })" data-testid="o-type">
                    @for (t of types; track t) {
                      <nz-option [nzValue]="t" [nzLabel]="'MFG_PE.TYPE_' + t.toUpperCase() | translate"></nz-option>
                    }
                  </nz-select>
                </div>
                <div class="field"><span>{{ 'MFG_PE.WORK_CENTER' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.WORK_CENTER' | translate" nzShowSearch [ngModel]="op.work_center_id" (ngModelChange)="patchOp({ work_center_id: $event, machine_center_id: null })" data-testid="o-wc">
                    @for (w of workCenters(); track w.id) {
                      <nz-option [nzValue]="w.id" [nzLabel]="w.work_center_code + ' · ' + w.name"></nz-option>
                    }
                  </nz-select>
                </div>
                <div class="field"><span>{{ 'MFG_PE.MACHINE' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.MACHINE' | translate" nzAllowClear [ngModel]="op.machine_center_id" (ngModelChange)="patchOp({ machine_center_id: $event })">
                    @for (m of machinesOf(op.work_center_id); track m.id) {
                      <nz-option [nzValue]="m.id" [nzLabel]="m.machine_code + ' · ' + m.name"></nz-option>
                    }
                  </nz-select>
                </div>
                <div class="field"><span>{{ 'MFG_PE.OPERATORS' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.OPERATORS' | translate" [nzMin]="1" [nzMax]="100" [ngModel]="op.required_operators" (ngModelChange)="patchOp({ required_operators: $event ?? 1 })"></nz-input-number>
                </div>
              </div>

              <h4>{{ 'MFG_PE.TIMES' | translate }}</h4>
              <div class="grid">
                <div class="field"><span>{{ 'MFG_PE.QUEUE' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.QUEUE' | translate" [nzMin]="0" [ngModel]="num(op.queue_time_minutes)" (ngModelChange)="patchOp({ queue_time_minutes: $event ?? 0 })" data-testid="o-queue"></nz-input-number>
                </div>
                <div class="field"><span>{{ 'MFG_PE.SETUP' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.SETUP' | translate" [nzMin]="0" [ngModel]="num(op.setup_time_minutes)" (ngModelChange)="patchOp({ setup_time_minutes: $event ?? 0 })" data-testid="o-setup"></nz-input-number>
                </div>
                <div class="field"><span>{{ 'MFG_PE.RUN_PER_UNIT' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.RUN_PER_UNIT' | translate" [nzMin]="0" [ngModel]="num(op.run_time_minutes_per_unit)" (ngModelChange)="patchOp({ run_time_minutes_per_unit: $event ?? 0 })" data-testid="o-run"></nz-input-number>
                </div>
                <div class="field"><span>{{ 'MFG_PE.POST_WAIT' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.POST_WAIT' | translate" [nzMin]="0" [ngModel]="num(op.post_operation_wait_minutes)" (ngModelChange)="patchOp({ post_operation_wait_minutes: $event ?? 0 })"></nz-input-number>
                </div>
                <div class="field"><span>{{ 'MFG_PE.MOVE' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.MOVE' | translate" [nzMin]="0" [ngModel]="num(op.move_time_minutes)" (ngModelChange)="patchOp({ move_time_minutes: $event ?? 0 })"></nz-input-number>
                </div>
                <div class="field"><span>{{ 'MFG_PE.OVERLAP_BATCH' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.OVERLAP_BATCH' | translate" [nzMin]="0" [ngModel]="op.overlap_transfer_batch_qty === null || op.overlap_transfer_batch_qty === undefined ? null : num(op.overlap_transfer_batch_qty)" (ngModelChange)="patchOp({ overlap_transfer_batch_qty: $event })" data-testid="o-overlap"></nz-input-number>
                </div>
                @if (op.operation_type === 'external_subcontracting') {
                  <div class="field"><span>{{ 'MFG_PE.SUBCONTRACT_COST' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.SUBCONTRACT_COST' | translate" [nzMin]="0" [ngModel]="num(op.subcontract_unit_cost)" (ngModelChange)="patchOp({ subcontract_unit_cost: $event ?? 0 })"></nz-input-number>
                  </div>
                }
              </div>

              <h4>{{ 'MFG_PE.LINKS' | translate }}</h4>
              <div class="grid">
                <div class="field"><span>{{ 'MFG_PE.WORK_INSTRUCTION' | translate }}</span><input [attr.aria-label]="'MFG_PE.WORK_INSTRUCTION' | translate" nz-input [ngModel]="op.work_instruction_doc_id ?? ''" (ngModelChange)="patchOp({ work_instruction_doc_id: $event || null })" />
                </div>
                <div class="field"><span>{{ 'MFG_PE.QUALITY_POINT' | translate }}</span><input [attr.aria-label]="'MFG_PE.QUALITY_POINT' | translate" nz-input [ngModel]="op.linked_quality_control_point_id ?? ''" (ngModelChange)="patchOp({ linked_quality_control_point_id: $event || null })" />
                </div>
                <div class="field"><span>{{ 'MFG_PE.ALTERNATES' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.ALTERNATES' | translate" nzMode="multiple" [ngModel]="op.alternate_work_center_ids" (ngModelChange)="patchOp({ alternate_work_center_ids: $event })">
                    @for (w of workCenters(); track w.id) {
                      <nz-option [nzValue]="w.id" [nzLabel]="w.work_center_code + ' · ' + w.name"></nz-option>
                    }
                  </nz-select>
                </div>
              </div>

              <h4>{{ 'MFG_PE.BOM_COMPONENTS' | translate }}</h4>
              <div class="bar">
                <input nz-input class="grow" [placeholder]="'MFG_PE.BOM_COMPONENT_ID' | translate" [attr.aria-label]="'MFG_PE.BOM_COMPONENT_ID' | translate" [ngModel]="componentId()" (ngModelChange)="componentId.set($event)" data-testid="o-component-id" />
                <button nz-button type="button" data-testid="o-component-add" [disabled]="componentId().trim() === ''" (click)="addComponent()">{{ 'MFG_PE.ADD' | translate }}</button>
              </div>
              <div class="chips">
                @for (c of op.bom_components ?? []; track c.bom_component_id) {
                  <nz-tag nzMode="closeable" (nzOnClose)="removeComponent(c.bom_component_id)">
                    {{ c.bom_component_id.slice(0, 8) }}@if (c.backflush_on_completion) { · {{ 'MFG_PE.BACKFLUSH' | translate }} }
                  </nz-tag>
                }
              </div>
            </nz-card>
          }

          <nz-card class="sim" style="margin-top: 16px" [nzTitle]="'MFG_PE.SIMULATOR' | translate" data-testid="simulator">
            @if (!routingId()) {
              <p>{{ 'MFG_PE.SIMULATOR_SAVE_FIRST' | translate }}</p>
            } @else {
              @if (dirty()) {
                <p class="muted" data-testid="sim-dirty">{{ 'MFG_PE.SIMULATOR_UNSAVED' | translate }}</p>
              }
              <div class="grid">
                <div class="field"><span>{{ 'MFG_PE.QUANTITY' | translate }}</span><nz-input-number [attr.aria-label]="'MFG_PE.QUANTITY' | translate" [nzMin]="0.0001" [ngModel]="quantity()" (ngModelChange)="setSim({ quantity: $event ?? 1 })" data-testid="sim-qty"></nz-input-number>
                </div>
                <div class="field"><span>{{ 'MFG_PE.START_DATETIME' | translate }}</span><input [attr.aria-label]="'MFG_PE.START_DATETIME' | translate" nz-input type="datetime-local" [ngModel]="start()" (ngModelChange)="setSim({ start: $event })" data-testid="sim-start" />
                </div>
                <span nz-checkbox [ngModel]="overlap()" (ngModelChange)="setSim({ overlap: $event })" data-testid="sim-overlap">{{ 'MFG_PE.INCLUDE_OVERLAP' | translate }}</span>
              </div>

              @if (sim(); as s) {
                <div class="kpis" data-testid="sim-result">
                  <div class="kpi"><span>{{ 'MFG_PE.LEAD_TIME_MIN' | translate }}</span><b data-testid="sim-total">{{ s.lead_time.total_minutes | number: '1.0-1' }}</b></div>
                  <div class="kpi"><span>{{ 'MFG_PE.SERIAL_MIN' | translate }}</span><b>{{ s.lead_time.serial_minutes | number: '1.0-1' }}</b></div>
                  <div class="kpi"><span>{{ 'MFG_PE.OVERLAP_SAVING' | translate }}</span><b>{{ s.lead_time.overlap_saving_minutes | number: '1.0-1' }}</b></div>
                  <div class="kpi"><span>{{ 'MFG_PE.COST_TOTAL' | translate }}</span><b data-testid="sim-cost">{{ s.cost.total | number: '1.2-2' }}</b></div>
                  <div class="kpi"><span>{{ 'MFG_PE.COST_UNIT' | translate }}</span><b>{{ s.cost.unit | number: '1.2-4' }}</b></div>
                </div>
                @if (s.lead_time.calendar; as cal) {
                  <p>{{ 'MFG_PE.CALENDAR_FINISH' | translate }}: {{ cal.finish_at }}</p>
                }

                <h4>{{ 'MFG_PE.COST_BREAKDOWN' | translate }}</h4>
                <nz-table nzSize="small" [nzData]="[1]" [nzFrontPagination]="false" [nzShowPagination]="false">
                  <thead><tr>
                    <th scope="col" class="num">{{ 'MFG_PE.RATE_SETUP' | translate }}</th>
                    <th scope="col" class="num">{{ 'MFG_PE.RATE_MACHINE' | translate }}</th>
                    <th scope="col" class="num">{{ 'MFG_PE.RATE_LABOUR' | translate }}</th>
                    <th scope="col" class="num">{{ 'MFG_PE.RATE_OVERHEAD' | translate }}</th>
                    <th scope="col" class="num">{{ 'MFG_PE.SUBCONTRACTING' | translate }}</th>
                    <th scope="col" class="num">{{ 'MFG_PE.MATERIAL' | translate }}</th>
                  </tr></thead>
                  <tbody><tr>
                    <td class="num">{{ s.cost.setup | number: '1.2-2' }}</td>
                    <td class="num">{{ s.cost.machine_run | number: '1.2-2' }}</td>
                    <td class="num">{{ s.cost.direct_labor | number: '1.2-2' }}</td>
                    <td class="num">{{ s.cost.overhead | number: '1.2-2' }}</td>
                    <td class="num">{{ s.cost.subcontracting | number: '1.2-2' }}</td>
                    <td class="num">{{ s.cost.material | number: '1.2-2' }}</td>
                  </tr></tbody>
                </nz-table>

                <h4>{{ 'MFG_PE.TIMELINE' | translate }}</h4>
                <div class="gantt" data-testid="gantt">
                  @for (bar of bars(); track bar.step.operation_id) {
                    <div class="line">
                      <span>{{ bar.step.operation_code }}</span>
                      <div class="track">
                        <div class="bar-fill" [class.overlap]="bar.step.overlap_applied" [style.left.%]="bar.left" [style.width.%]="bar.width" [title]="bar.step.duration_minutes + ' min'"></div>
                      </div>
                    </div>
                  }
                </div>
              }
            }
          </nz-card>
        </div>
      </div>
    }
  `,
})
export class RoutingDesignerComponent {
  private readonly api = inject(ManufacturingProductionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly types = OPERATION_TYPES;
  protected readonly routings = signal<MfgRoutingDetail[]>([]);
  protected readonly workCenters = signal<MfgWorkCenterDetail[]>([]);
  protected readonly machines = signal<MfgMachineDetail[]>([]);
  protected readonly routingId = signal<string | null>(null);
  protected readonly draft = signal<RoutingDraft | null>(null);
  protected readonly saved = signal<string>('');
  protected readonly selected = signal(0);
  protected readonly saving = signal(false);
  protected readonly cloneRevision = signal('');
  protected readonly componentId = signal('');
  protected readonly quantity = signal(1);
  protected readonly overlap = signal(true);
  protected readonly start = signal('');
  protected readonly sim = signal<MfgRoutingSimulation | null>(null);
  private readonly simTrigger = new Subject<void>();

  protected readonly currentOp = computed(() => this.draft()?.operations[this.selected()] ?? null);
  protected readonly bars = computed(() => ganttBars(this.sim()?.steps ?? []));
  protected readonly dirty = computed(() => {
    const d = this.draft();

    return !!d && JSON.stringify(d) !== this.saved();
  });
  protected readonly valid = computed(() => {
    const d = this.draft();

    return (
      !!d &&
      d.name.trim() !== '' &&
      (this.routingId() !== null || !!d.mfg_item_id) &&
      d.operations.length > 0 &&
      d.operations.every((op) => op.operation_code.trim() !== '' && op.name.trim() !== '' && op.work_center_id !== '')
    );
  });
  protected readonly routingLabel = computed(() => {
    const routing = this.routings().find((r) => r.id === this.routingId());

    return routing ? `${routing.item_code ?? ''} ${routing.item_name ?? ''}`.trim() : '';
  });

  constructor() {
    forkJoin({
      routings: this.api.listRoutings({ per_page: 200 }),
      centers: this.api.listWorkCenters({ per_page: 200 }),
      machines: this.api.listMachines({ per_page: 500 }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.routings.set(res.routings.data);
          this.workCenters.set(res.centers.data);
          this.machines.set(res.machines.data);
        },
        error: () => this.message.error(this.i18n.instant('MFG_PE.LOAD_ERROR')),
      });

    this.simTrigger
      .pipe(
        debounceTime(300),
        switchMap(() => {
          const id = this.routingId();
          if (!id) {
            return of(null);
          }

          return this.api
            .calculateRouting(id, {
              quantity: this.quantity(),
              include_overlap: this.overlap(),
              start_datetime: this.start() ? new Date(this.start()).toISOString() : null,
            })
            .pipe(
              catchError((err: unknown) => {
                this.message.error(apiErrorText(err) ?? this.i18n.instant('MFG_PE.ERROR'));

                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.sim.set(res ? res.data : null));
  }

  protected typeColor = (type: MfgOperationType | null | undefined): string => TYPE_COLOR[type ?? 'internal_machining'];
  protected num = toNum;
  protected machinesOf = (workCenterId: string): MfgMachineDetail[] => this.machines().filter((m) => m.work_center_id === workCenterId);
  protected workCenterCode = (id: string): string => this.workCenters().find((w) => w.id === id)?.work_center_code ?? '—';

  protected open(id: string | null): void {
    if (!id) {
      this.routingId.set(null);
      this.draft.set(null);
      this.sim.set(null);

      return;
    }
    this.api
      .getRouting(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (res) => this.load(res.data), error: () => this.message.error(this.i18n.instant('MFG_PE.LOAD_ERROR')) });
  }

  protected create(): void {
    this.routingId.set(null);
    this.sim.set(null);
    this.selected.set(0);
    const draft = blankRouting();
    this.draft.set(draft);
    this.saved.set(JSON.stringify(draft));
  }

  protected patch(patch: Partial<RoutingDraft>): void {
    this.draft.update((d) => (d ? { ...d, ...patch } : d));
  }

  protected patchOp(patch: Partial<MfgRoutingOperationDetail>): void {
    const index = this.selected();
    this.draft.update((d) => (d ? { ...d, operations: d.operations.map((op, i) => (i === index ? { ...op, ...patch } : op)) } : d));
  }

  protected addOp(): void {
    const first = this.workCenters()[0]?.id ?? '';
    this.draft.update((d) => (d ? { ...d, operations: [...d.operations, blankOperation(first)] } : d));
    this.selected.set((this.draft()?.operations.length ?? 1) - 1);
  }

  protected removeOp(index: number): void {
    this.draft.update((d) => (d ? { ...d, operations: d.operations.filter((_, i) => i !== index) } : d));
    this.selected.update((s) => Math.max(0, Math.min(s, (this.draft()?.operations.length ?? 1) - 1)));
  }

  protected move(index: number, delta: -1 | 1): void {
    this.draft.update((d) => (d ? { ...d, operations: moveOperation(d.operations, index, delta) } : d));
    this.selected.set(index + delta);
  }

  protected addComponent(): void {
    const id = this.componentId().trim();
    const current = this.currentOp();
    if (!id || !current || (current.bom_components ?? []).some((c) => c.bom_component_id === id)) {
      return;
    }
    this.patchOp({ bom_components: [...(current.bom_components ?? []), { bom_component_id: id, backflush_on_completion: true }] });
    this.componentId.set('');
  }

  protected removeComponent(id: string): void {
    this.patchOp({ bom_components: (this.currentOp()?.bom_components ?? []).filter((c) => c.bom_component_id !== id) });
  }

  protected setSim(change: { quantity?: number; overlap?: boolean; start?: string }): void {
    if (change.quantity !== undefined) {
      this.quantity.set(change.quantity);
    }
    if (change.overlap !== undefined) {
      this.overlap.set(change.overlap);
    }
    if (change.start !== undefined) {
      this.start.set(change.start);
    }
    this.simTrigger.next();
  }

  protected save(): void {
    const d = this.draft();
    if (!d) {
      return;
    }
    const payload: SaveRoutingPayload = {
      ...(this.routingId() ? {} : { mfg_item_id: d.mfg_item_id ?? undefined }),
      name: d.name.trim(),
      revision: d.revision.trim() === '' ? null : d.revision.trim(),
      status: d.status,
      is_default: d.is_default,
      notes: d.notes.trim() === '' ? null : d.notes,
      operations: operationsPayload(d.operations),
    };
    const id = this.routingId();
    this.saving.set(true);
    (id ? this.api.updateRouting(id, payload) : this.api.createRouting(payload))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.message.success(this.i18n.instant('MFG_PE.SAVED'));
          this.upsert(res.data);
          this.load(res.data);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.message.error(apiErrorText(err) ?? this.i18n.instant('MFG_PE.ERROR'));
        },
      });
  }

  protected clone(): void {
    const id = this.routingId();
    if (!id) {
      return;
    }
    this.api
      .cloneRoutingRevision(id, this.cloneRevision().trim() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.message.success(this.i18n.instant('MFG_PE.CLONED'));
          this.cloneRevision.set('');
          this.upsert(res.data);
          this.load(res.data);
        },
        error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.i18n.instant('MFG_PE.ERROR')),
      });
  }

  private upsert(routing: MfgRoutingDetail): void {
    this.routings.update((list) => (list.some((r) => r.id === routing.id) ? list.map((r) => (r.id === routing.id ? routing : r)) : [...list, routing]));
  }

  private load(routing: MfgRoutingDetail): void {
    const draft = draftOf(routing);
    this.routingId.set(routing.id);
    this.draft.set(draft);
    this.saved.set(JSON.stringify(draft));
    this.selected.set(0);
    this.sim.set(null);
    this.simTrigger.next();
  }
}
