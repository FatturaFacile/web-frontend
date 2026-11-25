import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CpqChildKind, CpqDiagnosticIssue, CpqRecordPayload, I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  CPQ_BOM_FIELDS,
  CPQ_CHARACTERISTIC_FIELDS,
  CPQ_MODEL_FIELDS,
  CPQ_OPTION_FIELDS,
  CPQ_PRICING_FIELDS,
  CPQ_ROUTING_FIELDS,
  CPQ_RULE_FIELDS,
} from './cpq-definition-fields';
import { CpqEntityDrawerComponent, CpqFieldDef } from './cpq-entity-drawer.component';
import { modelStatusColor } from './cpq-format';
import { CpqModelEditorStore, CpqWriteOutcome } from './cpq-model-editor.store';

type DrawerKind = 'model' | 'characteristic' | 'option' | CpqChildKind;

interface DrawerState {
  kind: DrawerKind;
  record: Record<string, unknown> | null;
  /** The characteristic an option belongs to. */
  parentId: string | null;
}

interface ChildTab {
  kind: CpqChildKind;
  titleKey: string;
  columns: { header: string; cell: (row: Record<string, unknown>) => string }[];
}

const text = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);
const code = (value: unknown): string => text(value).slice(0, 80);

const CHILD_TABS: ChildTab[] = [
  {
    kind: 'rules',
    titleKey: 'CPQ_CONFIGURATOR.TAB.RULES',
    columns: [
      { header: 'CODE', cell: (row) => text(row['code']) },
      { header: 'RULE_TYPE', cell: (row) => text(row['rule_type']) },
      { header: 'CONDITION_EXPRESSION', cell: (row) => code(row['condition_expression']) },
      { header: 'TARGET_CHARACTERISTIC', cell: (row) => text(row['target_characteristic']) },
      { header: 'PRIORITY', cell: (row) => text(row['priority']) },
    ],
  },
  {
    kind: 'superbom-mappings',
    titleKey: 'CPQ_CONFIGURATOR.TAB.BOM',
    columns: [
      { header: 'CODE', cell: (row) => text(row['code']) },
      { header: 'ITEM_CODE', cell: (row) => text(row['item_code']) },
      { header: 'ITEM_NAME', cell: (row) => text(row['display']) },
      { header: 'QUANTITY_FORMULA', cell: (row) => code(row['quantity_formula']) },
      { header: 'CONDITION_EXPRESSION', cell: (row) => code(row['condition_expression']) },
    ],
  },
  {
    kind: 'routing-mappings',
    titleKey: 'CPQ_CONFIGURATOR.TAB.ROUTING',
    columns: [
      { header: 'CODE', cell: (row) => text(row['code']) },
      { header: 'OPERATION_NAME', cell: (row) => text(row['display']) },
      { header: 'WORK_CENTER', cell: (row) => text(row['work_center']) },
      { header: 'RUN_HOURS_FORMULA', cell: (row) => code(row['run_hours_formula']) },
      { header: 'HOURLY_RATE', cell: (row) => text(row['hourly_rate']) },
    ],
  },
  {
    kind: 'pricing-formulas',
    titleKey: 'CPQ_CONFIGURATOR.TAB.PRICING',
    columns: [
      { header: 'CODE', cell: (row) => text(row['code']) },
      { header: 'LABEL', cell: (row) => text(row['display']) },
      { header: 'EFFECT', cell: (row) => text(row['effect']) },
      { header: 'FORMULA', cell: (row) => code(row['formula']) },
      { header: 'CONDITION_EXPRESSION', cell: (row) => code(row['condition_expression']) },
    ],
  },
];

const FIELDS: Record<DrawerKind, CpqFieldDef[]> = {
  model: CPQ_MODEL_FIELDS,
  characteristic: CPQ_CHARACTERISTIC_FIELDS,
  option: CPQ_OPTION_FIELDS,
  rules: CPQ_RULE_FIELDS,
  'superbom-mappings': CPQ_BOM_FIELDS,
  'routing-mappings': CPQ_ROUTING_FIELDS,
  'pricing-formulas': CPQ_PRICING_FIELDS,
};

const DEFAULTS: Partial<Record<DrawerKind, Record<string, unknown>>> = {
  characteristic: { is_required: true, sort_order: 0 },
  option: { is_active: true, is_default: false, sort_order: 0 },
  rules: { severity: 'error', priority: 100, is_active: true },
  'superbom-mappings': {
    uom: 'PCS',
    quantity_formula: '1',
    unit_cost: 0,
    lead_time_days: 0,
    sort_order: 0,
    is_active: true,
  },
  'routing-mappings': {
    setup_hours_formula: '0',
    run_hours_formula: '0',
    hourly_rate: 0,
    sort_order: 0,
    is_active: true,
  },
  'pricing-formulas': { sort_order: 0, is_active: true },
};

/**
 * The definition of a model (Mod 230): characteristics with their options, constraint rules, super-BOM and routing
 * mappings and pricing formulas, the static check of the expressions and the publication. Every write is a drawer form;
 * the labels come from the API.
 */
@Component({
  selector: 'app-cpq-model-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CpqModelEditorStore],
  imports: [
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    CpqEntityDrawerComponent,
  ],
  template: `
    @if (store.model(); as model) {
      <app-page-header
        [title]="model.display + ' (' + model.code + ')'"
        [subtitle]="
          'CPQ_CONFIGURATOR.EDITOR.SUBTITLE'
            | translate: { version: model.version, prefix: model.part_number_prefix }
        "
      >
        <div class="header-actions">
          <nz-tag [nzColor]="statusColor(model.status)">{{
            'CPQ_CONFIGURATOR.STATUS.' + model.status.toUpperCase() | translate
          }}</nz-tag>
          <a nz-button routerLink="/cpq-configurator/models">{{
            'CPQ_CONFIGURATOR.BACK' | translate
          }}</a>
          @if (model.status !== 'archived') {
            <button nz-button (click)="openDrawer('model', model)">
              {{ 'CPQ_CONFIGURATOR.EDITOR.EDIT_HEADER' | translate }}
            </button>
            <button nz-button (click)="store.runDiagnostics()">
              {{ 'CPQ_CONFIGURATOR.EDITOR.CHECK' | translate }}
            </button>
          }
          @if (model.status === 'draft') {
            <button
              nz-button
              nzType="primary"
              nz-popconfirm
              [nzPopconfirmTitle]="'CPQ_CONFIGURATOR.EDITOR.CONFIRM_PUBLISH' | translate"
              (nzOnConfirm)="publish()"
            >
              {{ 'CPQ_CONFIGURATOR.EDITOR.PUBLISH' | translate }}
            </button>
          }
          @if (model.status !== 'archived') {
            <button
              nz-button
              nzDanger
              nz-popconfirm
              [nzPopconfirmTitle]="'CPQ_CONFIGURATOR.EDITOR.CONFIRM_ARCHIVE' | translate"
              (nzOnConfirm)="store.archive()"
            >
              {{ 'CPQ_CONFIGURATOR.EDITOR.ARCHIVE' | translate }}
            </button>
          }
        </div>
      </app-page-header>

      @if (store.failure(); as failure) {
        <nz-alert
          class="gap"
          nzType="error"
          nzShowIcon
          [nzMessage]="
            failure.key
              ? (failure.key | translate)
              : (failure.detail ?? ('CPQ_CONFIGURATOR.ERR.GENERIC' | translate))
          "
        ></nz-alert>
      }

      @if (store.diagnostics(); as diagnostics) {
        @if (diagnostics.issues.length === 0) {
          <nz-alert
            class="gap"
            nzType="success"
            nzShowIcon
            [nzMessage]="'CPQ_CONFIGURATOR.EDITOR.CHECK_OK' | translate"
          ></nz-alert>
        }
        @for (issue of diagnostics.issues; track $index) {
          <nz-alert
            class="gap"
            [nzType]="issue.severity === 'error' ? 'error' : 'warning'"
            nzShowIcon
            [nzMessage]="issueText(issue)"
            [nzDescription]="issue.scope"
          ></nz-alert>
        }
      }

      <nz-spin [nzSpinning]="store.loading() || store.saving()">
        <nz-tabs>
          <nz-tab [nzTitle]="'CPQ_CONFIGURATOR.TAB.CHARACTERISTICS' | translate">
            <div class="toolbar">
              <button
                nz-button
                nzType="primary"
                [disabled]="model.status === 'archived'"
                (click)="openDrawer('characteristic', null)"
              >
                {{ 'CPQ_CONFIGURATOR.EDITOR.ADD_CHARACTERISTIC' | translate }}
              </button>
            </div>
            <nz-table
              #characteristics
              [nzData]="model.characteristics ?? []"
              nzSize="small"
              [nzShowPagination]="false"
              [nzFrontPagination]="false"
            >
              <thead>
                <tr>
                  <th></th>
                  <th>{{ 'CPQ_CONFIGURATOR.FIELD.CODE' | translate }}</th>
                  <th>{{ 'CPQ_CONFIGURATOR.FIELD.LABEL' | translate }}</th>
                  <th>{{ 'CPQ_CONFIGURATOR.FIELD.TYPE' | translate }}</th>
                  <th>{{ 'CPQ_CONFIGURATOR.FIELD.STEP_CODE' | translate }}</th>
                  <th>{{ 'CPQ_CONFIGURATOR.COLUMN.ACTIONS' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (characteristic of characteristics.data; track characteristic.id) {
                  <tr>
                    <td
                      [nzExpand]="isExpanded(characteristic.id)"
                      (nzExpandChange)="toggle(characteristic.id)"
                      [nzShowExpand]="characteristic.type === 'list'"
                    ></td>
                    <td>{{ characteristic.code }}</td>
                    <td>{{ characteristic.display }}</td>
                    <td>
                      <nz-tag>{{
                        'CPQ_CONFIGURATOR.TYPE.' + characteristic.type.toUpperCase() | translate
                      }}</nz-tag>
                    </td>
                    <td>{{ characteristic.step_code }}</td>
                    <td class="actions">
                      <button
                        nz-button
                        nzSize="small"
                        (click)="openDrawer('characteristic', characteristic)"
                      >
                        {{ 'CPQ_CONFIGURATOR.EDIT' | translate }}
                      </button>
                      @if (characteristic.type === 'list') {
                        <button
                          nz-button
                          nzSize="small"
                          (click)="openDrawer('option', null, characteristic.id)"
                        >
                          {{ 'CPQ_CONFIGURATOR.EDITOR.ADD_OPTION' | translate }}
                        </button>
                      }
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        nz-popconfirm
                        [nzPopconfirmTitle]="'CPQ_CONFIGURATOR.CONFIRM_DELETE' | translate"
                        (nzOnConfirm)="store.removeCharacteristic(characteristic.id)"
                      >
                        {{ 'CPQ_CONFIGURATOR.DELETE' | translate }}
                      </button>
                    </td>
                  </tr>
                  @if (isExpanded(characteristic.id)) {
                    <tr>
                      <td></td>
                      <td colspan="5">
                        <nz-table
                          [nzData]="characteristic.options ?? []"
                          nzSize="small"
                          [nzShowPagination]="false"
                          [nzFrontPagination]="false"
                        >
                          <thead>
                            <tr>
                              <th>{{ 'CPQ_CONFIGURATOR.FIELD.CODE' | translate }}</th>
                              <th>{{ 'CPQ_CONFIGURATOR.FIELD.LABEL' | translate }}</th>
                              <th>{{ 'CPQ_CONFIGURATOR.FIELD.PART_NUMBER_CODE' | translate }}</th>
                              <th>{{ 'CPQ_CONFIGURATOR.FIELD.IS_DEFAULT' | translate }}</th>
                              <th>{{ 'CPQ_CONFIGURATOR.COLUMN.ACTIONS' | translate }}</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (option of characteristic.options ?? []; track option.id) {
                              <tr>
                                <td>{{ option.code }}</td>
                                <td>{{ option.display }}</td>
                                <td>{{ option.part_number_code }}</td>
                                <td>
                                  @if (option.is_default) {
                                    <nz-tag nzColor="green">{{
                                      'CPQ_CONFIGURATOR.YES' | translate
                                    }}</nz-tag>
                                  }
                                </td>
                                <td class="actions">
                                  <button
                                    nz-button
                                    nzSize="small"
                                    (click)="openDrawer('option', option, characteristic.id)"
                                  >
                                    {{ 'CPQ_CONFIGURATOR.EDIT' | translate }}
                                  </button>
                                  <button
                                    nz-button
                                    nzSize="small"
                                    nzDanger
                                    nz-popconfirm
                                    [nzPopconfirmTitle]="
                                      'CPQ_CONFIGURATOR.CONFIRM_DELETE' | translate
                                    "
                                    (nzOnConfirm)="store.removeOption(option.id)"
                                  >
                                    {{ 'CPQ_CONFIGURATOR.DELETE' | translate }}
                                  </button>
                                </td>
                              </tr>
                            }
                          </tbody>
                        </nz-table>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </nz-table>
          </nz-tab>

          @for (tab of childTabs; track tab.kind) {
            <nz-tab [nzTitle]="tab.titleKey | translate">
              <div class="toolbar">
                <button
                  nz-button
                  nzType="primary"
                  [disabled]="model.status === 'archived'"
                  (click)="openDrawer(tab.kind, null)"
                >
                  {{ 'CPQ_CONFIGURATOR.ADD' | translate }}
                </button>
              </div>
              <nz-table
                [nzData]="rowsOf(tab.kind)"
                nzSize="small"
                [nzShowPagination]="false"
                [nzFrontPagination]="false"
              >
                <thead>
                  <tr>
                    @for (column of tab.columns; track column.header) {
                      <th>{{ 'CPQ_CONFIGURATOR.FIELD.' + column.header | translate }}</th>
                    }
                    <th>{{ 'CPQ_CONFIGURATOR.FIELD.IS_ACTIVE' | translate }}</th>
                    <th>{{ 'CPQ_CONFIGURATOR.COLUMN.ACTIONS' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rowsOf(tab.kind); track row['id']) {
                    <tr>
                      @for (column of tab.columns; track column.header) {
                        <td
                          [class.mono]="
                            column.header.endsWith('FORMULA') ||
                            column.header.endsWith('EXPRESSION')
                          "
                        >
                          {{ column.cell(row) }}
                        </td>
                      }
                      <td>
                        <nz-tag [nzColor]="row['is_active'] ? 'green' : 'default'">{{
                          (row['is_active'] ? 'CPQ_CONFIGURATOR.YES' : 'CPQ_CONFIGURATOR.NO')
                            | translate
                        }}</nz-tag>
                      </td>
                      <td class="actions">
                        <button nz-button nzSize="small" (click)="openDrawer(tab.kind, row)">
                          {{ 'CPQ_CONFIGURATOR.EDIT' | translate }}
                        </button>
                        <button
                          nz-button
                          nzSize="small"
                          nzDanger
                          nz-popconfirm
                          [nzPopconfirmTitle]="'CPQ_CONFIGURATOR.CONFIRM_DELETE' | translate"
                          (nzOnConfirm)="store.removeChild(tab.kind, text(row['id']))"
                        >
                          {{ 'CPQ_CONFIGURATOR.DELETE' | translate }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-tab>
          }
        </nz-tabs>
      </nz-spin>
    } @else if (store.failure(); as failure) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="
          failure.key
            ? (failure.key | translate)
            : (failure.detail ?? ('CPQ_CONFIGURATOR.ERR.GENERIC' | translate))
        "
      ></nz-alert>
    } @else {
      <nz-spin nzSimple></nz-spin>
    }

    <app-cpq-entity-drawer
      [open]="drawer() !== null"
      [title]="drawerTitle() | translate"
      [fields]="drawerFields()"
      [record]="drawer()?.record ?? null"
      [defaults]="drawerDefaults()"
      [saving]="store.saving()"
      [failure]="store.failure()"
      [modelId]="store.model()?.id ?? null"
      (saved)="save($event)"
      (closed)="closeDrawer()"
    ></app-cpq-entity-drawer>
  `,
  styles: `
    .gap {
      display: block;
      margin-bottom: 12px;
    }
    .toolbar {
      margin-bottom: 12px;
    }
    .actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
  `,
})
export class CpqModelEditorComponent implements OnInit {
  protected readonly store = inject(CpqModelEditorStore);
  private readonly route = inject(ActivatedRoute);
  private readonly translator = inject(I18nService);

  readonly childTabs = CHILD_TABS;
  readonly drawer = signal<DrawerState | null>(null);
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  readonly drawerFields = computed(() => (this.drawer() ? FIELDS[this.drawer()!.kind] : []));
  readonly drawerDefaults = computed(() =>
    this.drawer() ? (DEFAULTS[this.drawer()!.kind] ?? {}) : {},
  );
  readonly drawerTitle = computed(() => {
    const state = this.drawer();

    return state
      ? `CPQ_CONFIGURATOR.DRAWER.${state.kind.toUpperCase().replace('-', '_')}_${state.record ? 'EDIT' : 'NEW'}`
      : '';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      void this.store.load(id);
    }
  }

  statusColor(status: 'draft' | 'published' | 'archived'): string {
    return modelStatusColor(status);
  }

  text(value: unknown): string {
    return text(value);
  }

  rowsOf(kind: CpqChildKind): Record<string, unknown>[] {
    const model = this.store.model();
    const rows = {
      rules: model?.rules,
      'superbom-mappings': model?.bom_mappings,
      'routing-mappings': model?.routing_mappings,
      'pricing-formulas': model?.pricing_formulas,
    }[kind];

    return (rows ?? []) as unknown as Record<string, unknown>[];
  }

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.expanded());
    if (!next.delete(id)) {
      next.add(id);
    }
    this.expanded.set(next);
  }

  openDrawer(kind: DrawerKind, record: object | null, parentId: string | null = null): void {
    this.store.clearFailure();
    this.drawer.set({ kind, record: record as Record<string, unknown> | null, parentId });
  }

  closeDrawer(): void {
    this.drawer.set(null);
    this.store.clearFailure();
  }

  issueText(issue: CpqDiagnosticIssue): string {
    const params = Object.fromEntries(
      Object.entries(issue.params ?? {}).map(([key, value]) => [key, String(value)]),
    );

    return this.translate(`CPQ_CONFIGURATOR.ISSUE.${issue.code.toUpperCase()}`, params);
  }

  async save(payload: CpqRecordPayload): Promise<void> {
    const state = this.drawer();
    if (!state) {
      return;
    }
    const id = state.record ? text(state.record['id']) : null;
    let outcome: CpqWriteOutcome;

    switch (state.kind) {
      case 'model':
        outcome = await this.store.saveModel(payload);
        break;
      case 'characteristic':
        outcome = await this.store.saveCharacteristic(id, payload);
        break;
      case 'option':
        outcome = await this.store.saveOption(state.parentId ?? '', id, payload);
        break;
      default:
        outcome = await this.store.saveChild(state.kind, id, payload);
    }

    if (outcome.ok) {
      this.drawer.set(null);
    }
  }

  async publish(): Promise<void> {
    const outcome = await this.store.publish();
    if (!outcome.ok) {
      await this.store.runDiagnostics();
    }
  }

  private translate(key: string, params: Record<string, string>): string {
    return this.translator.instant(key, params);
  }
}
