import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ABAC_ATTRIBUTES, ABAC_OPERATORS, AbacConditionDto, AbacRuleDto } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { TranslatePipe } from '@shared';
import { formatAbacValue, parseAbacValue, previewAbacRule } from './abac-preview';

/**
 * Visual builder of ABAC rules: for a permission, an `allow` rule restricts the grant to the records that match, a `deny`
 * rule overrides it. Conditions are picked from the server allowlist (never free text for attributes or operators) and a
 * live text preview shows what the rule means.
 */
@Component({
  selector: 'app-abac-rule-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule, TranslatePipe],
  template: `
    @for (rule of rules(); track $index; let i = $index) {
      <div class="rule" [attr.data-testid]="'rule-' + i">
        <div class="rule-head">
          <nz-select
            class="permission"
            [ngModel]="rule.permission"
            (ngModelChange)="patch(i, { permission: $event })"
            [nzDisabled]="readonly()"
            [nzPlaceHolder]="'IAM.ABAC_PERMISSION' | translate"
            nzShowSearch
          >
            @for (key of permissionKeys(); track key) {
              <nz-option [nzValue]="key" [nzLabel]="key"></nz-option>
            }
          </nz-select>
          <nz-select [ngModel]="rule.effect" (ngModelChange)="patch(i, { effect: $event })" [nzDisabled]="readonly()" class="effect">
            <nz-option nzValue="deny" [nzLabel]="'IAM.ABAC_DENY' | translate"></nz-option>
            <nz-option nzValue="allow" [nzLabel]="'IAM.ABAC_ALLOW' | translate"></nz-option>
          </nz-select>
          <button nz-button nzType="text" nzDanger [disabled]="readonly()" (click)="removeRule(i)" [attr.aria-label]="'IAM.REMOVE' | translate">
            <span nz-icon nzType="delete"></span>
          </button>
        </div>

        @for (condition of rule.conditions; track $index; let c = $index) {
          <div class="condition">
            <nz-select [ngModel]="condition.attribute" (ngModelChange)="patchCondition(i, c, { attribute: $event })" [nzDisabled]="readonly()">
              @for (attribute of attributes; track attribute) {
                <nz-option [nzValue]="attribute" [nzLabel]="attribute"></nz-option>
              }
            </nz-select>
            <nz-select [ngModel]="condition.operator" (ngModelChange)="changeOperator(i, c, $event)" [nzDisabled]="readonly()">
              @for (operator of operators; track operator) {
                <nz-option [nzValue]="operator" [nzLabel]="operator"></nz-option>
              }
            </nz-select>
            <input
              nz-input
              [ngModel]="display(condition)"
              (ngModelChange)="changeValue(i, c, $event)"
              [disabled]="readonly()"
              [attr.aria-label]="'IAM.ABAC_VALUE' | translate"
            />
            <button nz-button nzType="text" [disabled]="readonly() || rule.conditions.length === 1" (click)="removeCondition(i, c)">
              <span nz-icon nzType="minus-circle"></span>
            </button>
          </div>
        }
        <button nz-button nzSize="small" [disabled]="readonly()" (click)="addCondition(i)">
          <span nz-icon nzType="plus"></span> {{ 'IAM.ABAC_ADD_CONDITION' | translate }}
        </button>
        <code class="preview" [attr.data-testid]="'preview-' + i">{{ preview(rule) }}</code>
      </div>
    }
    <button nz-button nzType="dashed" [disabled]="readonly()" (click)="addRule()">
      <span nz-icon nzType="plus"></span> {{ 'IAM.ABAC_ADD_RULE' | translate }}
    </button>
  `,
  styles: [
    '.rule { border: 1px solid var(--ant-color-border, #d9d9d9); border-radius: 6px; padding: 12px; margin-bottom: 12px; display: grid; gap: 8px; }',
    '.rule-head, .condition { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .permission { min-width: 280px; } .effect { width: 110px; }',
    '.preview { display: block; padding: 6px 8px; background: var(--ant-color-fill-quaternary, #fafafa); border-radius: 4px; }',
  ],
})
export class AbacRuleBuilderComponent {
  readonly rules = model<AbacRuleDto[]>([]);
  readonly permissionKeys = input<readonly string[]>([]);
  readonly readonly = input(false);

  protected readonly attributes = ABAC_ATTRIBUTES;
  protected readonly operators = ABAC_OPERATORS;
  protected readonly preview = previewAbacRule;
  protected readonly isEmpty = computed(() => this.rules().length === 0);

  private static blankCondition(): AbacConditionDto {
    return { attribute: 'document.total', operator: '>', value: 0 };
  }

  protected display(condition: AbacConditionDto): string {
    return Array.isArray(condition.value) ? condition.value.join(', ') : formatAbacValue(condition.value);
  }

  protected addRule(): void {
    this.rules.update((rules) => [...rules, { permission: '', effect: 'deny', conditions: [AbacRuleBuilderComponent.blankCondition()] }]);
  }

  protected removeRule(index: number): void {
    this.rules.update((rules) => rules.filter((_, i) => i !== index));
  }

  protected patch(index: number, change: Partial<AbacRuleDto>): void {
    this.rules.update((rules) => rules.map((rule, i) => (i === index ? { ...rule, ...change } : rule)));
  }

  protected addCondition(index: number): void {
    this.patch(index, { conditions: [...this.rules()[index].conditions, AbacRuleBuilderComponent.blankCondition()] });
  }

  protected removeCondition(index: number, conditionIndex: number): void {
    this.patch(index, { conditions: this.rules()[index].conditions.filter((_, i) => i !== conditionIndex) });
  }

  protected patchCondition(index: number, conditionIndex: number, change: Partial<AbacConditionDto>): void {
    this.patch(index, {
      conditions: this.rules()[index].conditions.map((c, i) => (i === conditionIndex ? { ...c, ...change } : c)),
    });
  }

  protected changeOperator(index: number, conditionIndex: number, operator: AbacConditionDto['operator']): void {
    const current = this.rules()[index].conditions[conditionIndex];
    this.patchCondition(index, conditionIndex, { operator, value: parseAbacValue(this.display(current), operator) });
  }

  protected changeValue(index: number, conditionIndex: number, raw: string): void {
    const operator = this.rules()[index].conditions[conditionIndex].operator;
    this.patchCondition(index, conditionIndex, { value: parseAbacValue(raw, operator) });
  }
}
