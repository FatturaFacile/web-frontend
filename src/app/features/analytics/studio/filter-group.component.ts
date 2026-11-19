import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AnalyticsSemanticDataset, AnalyticsSpecFilter, StudioFilterGroup } from '@core';
import { TranslatePipe } from '@shared';
import { OPERATOR_KEYS } from './studio-keys';
import {
  addFilterGroup,
  defaultOperator,
  filterValueFor,
  filterValueText,
  isFilterGroup,
  MAX_FILTER_DEPTH,
  updateFilterNode,
} from './studio-state';

/**
 * One group of the nested filter expression, with its conditions and sub groups (AND / OR, up to the depth the API
 * accepts). The component is recursive: a sub group is another instance that reports its change up as a new root.
 */
@Component({
  selector: 'app-filter-group',
  imports: [
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    TranslatePipe,
    FilterGroupComponent,
  ],
  styleUrl: './filter-group.component.scss',
  template: `
    <div class="group" [attr.data-depth]="path().length">
      <div class="head">
        <nz-select
          [ngModel]="group().logic"
          (ngModelChange)="setLogic($event)"
          nzSize="small"
          [attr.aria-label]="'ANALYTICS_STUDIO.FILTER_LOGIC' | translate"
          class="logic"
        >
          <nz-option nzValue="and" [nzLabel]="'ANALYTICS_STUDIO.LOGIC_AND' | translate"></nz-option>
          <nz-option nzValue="or" [nzLabel]="'ANALYTICS_STUDIO.LOGIC_OR' | translate"></nz-option>
        </nz-select>
        @if (path().length > 0) {
          <button nz-button nzSize="small" nzDanger type="button" (click)="remove(path())">
            {{ 'ANALYTICS_STUDIO.REMOVE' | translate }}
          </button>
        }
      </div>

      @for (node of group().conditions; track $index; let index = $index) {
        @if (isGroup(node)) {
          <app-filter-group
            [root]="root()"
            [path]="[...path(), index]"
            [dataset]="dataset()"
            (rootChange)="rootChange.emit($event)"
          />
        } @else {
          <div class="condition">
            <nz-select
              [ngModel]="node.field"
              (ngModelChange)="setField([...path(), index], node, $event)"
              nzSize="small"
              nzShowSearch
              [attr.aria-label]="'ANALYTICS_STUDIO.FILTER_FIELD' | translate"
              class="field"
            >
              @for (dimension of dataset().dimensions; track dimension.key) {
                <nz-option [nzValue]="dimension.key" [nzLabel]="dimension.label"></nz-option>
              }
            </nz-select>
            <nz-select
              [ngModel]="node.operator"
              (ngModelChange)="setOperator([...path(), index], node, $event)"
              nzSize="small"
              [attr.aria-label]="'ANALYTICS_STUDIO.FILTER_OPERATOR' | translate"
              class="operator"
            >
              @for (operator of operatorsOf(node.field); track operator) {
                <nz-option
                  [nzValue]="operator"
                  [nzLabel]="operatorKeys[operator] | translate"
                ></nz-option>
              }
            </nz-select>
            @if (needsValue(node.operator)) {
              <input
                nz-input
                nzSize="small"
                class="value"
                [ngModel]="valueText(node.value)"
                (ngModelChange)="setValue([...path(), index], node, $event)"
                [attr.aria-label]="'ANALYTICS_STUDIO.FILTER_VALUE' | translate"
                [placeholder]="
                  isList(node.operator) ? ('ANALYTICS_STUDIO.FILTER_LIST_HINT' | translate) : ''
                "
              />
            }
            <button
              nz-button
              nzSize="small"
              nzDanger
              type="button"
              (click)="remove([...path(), index])"
              [attr.aria-label]="'ANALYTICS_STUDIO.REMOVE' | translate"
            >
              ×
            </button>
          </div>
        }
      }

      <div class="add">
        <button nz-button nzSize="small" type="button" (click)="addCondition()">
          {{ 'ANALYTICS_STUDIO.ADD_CONDITION' | translate }}
        </button>
        @if (canNest()) {
          <button nz-button nzSize="small" type="button" (click)="addGroup()">
            {{ 'ANALYTICS_STUDIO.ADD_GROUP' | translate }}
          </button>
        }
      </div>
    </div>
  `,
})
export class FilterGroupComponent {
  /** The whole filter expression: every change is made on it and reported as a new root. */
  readonly root = input.required<StudioFilterGroup>();
  readonly path = input<number[]>([]);
  readonly dataset = input.required<AnalyticsSemanticDataset>();
  readonly rootChange = output<StudioFilterGroup>();

  protected readonly operatorKeys = OPERATOR_KEYS;

  protected readonly group = computed<StudioFilterGroup>(() => {
    let current: StudioFilterGroup = this.root();
    for (const index of this.path()) {
      const next = current.conditions[index];
      if (next === undefined || !isFilterGroup(next)) {
        break;
      }
      current = next;
    }

    return current;
  });

  protected readonly canNest = computed(() => this.path().length + 2 <= MAX_FILTER_DEPTH);

  protected isGroup(node: AnalyticsSpecFilter | StudioFilterGroup): node is StudioFilterGroup {
    return isFilterGroup(node);
  }

  protected operatorsOf(field: string): string[] {
    return this.dataset().dimensions.find((item) => item.key === field)?.operators ?? ['eq'];
  }

  protected needsValue(operator: string): boolean {
    return !['is_null', 'not_null'].includes(operator);
  }

  protected isList(operator: string): boolean {
    return ['in', 'not_in', 'between'].includes(operator);
  }

  protected valueText(value: unknown): string {
    return filterValueText(value);
  }

  setLogic(logic: 'and' | 'or'): void {
    this.rootChange.emit(
      updateFilterNode(this.root(), this.path(), (node) =>
        isFilterGroup(node) ? { ...node, logic } : node,
      ),
    );
  }

  addCondition(): void {
    const first = this.dataset().dimensions[0];
    if (first === undefined) {
      return;
    }
    const condition: AnalyticsSpecFilter = {
      field: first.key,
      operator: defaultOperator(this.dataset(), first.key),
      value: '',
    };
    this.rootChange.emit(
      updateFilterNode(this.root(), this.path(), (node) =>
        isFilterGroup(node) ? { ...node, conditions: [...node.conditions, condition] } : node,
      ),
    );
  }

  addGroup(): void {
    this.rootChange.emit(addFilterGroup(this.root(), this.path(), 'or'));
  }

  remove(path: number[]): void {
    this.rootChange.emit(updateFilterNode(this.root(), path, () => undefined));
  }

  setField(path: number[], node: AnalyticsSpecFilter, field: string): void {
    this.rootChange.emit(
      updateFilterNode(this.root(), path, () => ({
        field,
        operator: defaultOperator(this.dataset(), field),
        value: '',
      })),
    );
  }

  setOperator(path: number[], node: AnalyticsSpecFilter, operator: string): void {
    this.rootChange.emit(
      updateFilterNode(this.root(), path, () => ({
        field: node.field,
        operator,
        value: filterValueFor(operator, filterValueText(node.value)),
      })),
    );
  }

  setValue(path: number[], node: AnalyticsSpecFilter, text: string): void {
    this.rootChange.emit(
      updateFilterNode(this.root(), path, () => ({
        field: node.field,
        operator: node.operator,
        value: filterValueFor(node.operator, text),
      })),
    );
  }
}
