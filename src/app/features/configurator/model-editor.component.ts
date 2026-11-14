import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ConfiguratorApiService,
  ConfiguratorGroup,
  ConfiguratorGroupRequest,
  ConfiguratorGroupType,
  ConfiguratorModel,
  ConfiguratorOption,
  ConfiguratorOptionRequest,
  ConfiguratorRule,
  ConfiguratorRuleCheck,
  ConfiguratorRuleCondition,
  ConfiguratorRuleRequest,
  ConfiguratorRuleType,
  I18nService,
  InventoryApiService,
  PermissionsService,
  ProductItem,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { formatMoney, modelStatusColor, trimDecimal } from './configurator-format';

const GROUP_TYPES: readonly ConfiguratorGroupType[] = ['single', 'multi', 'range', 'boolean'];
const RULE_TYPES: readonly ConfiguratorRuleType[] = ['requires', 'excludes', 'default', 'price_rule'];
const OPERATORS = ['eq', 'gt', 'gte', 'lt', 'lte'] as const;

type ConditionForm = FormGroup<{
  type: FormControl<'option' | 'range'>;
  option: FormControl<string>;
  negate: FormControl<boolean>;
  group: FormControl<string>;
  operator: FormControl<string>;
  value: FormControl<number>;
}>;

type BreakForm = FormGroup<{ min_quantity: FormControl<number>; discount_percent: FormControl<number> }>;

@Component({
  selector: 'app-configurator-model-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ModalActionsDirective,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    @if (model(); as current) {
      <app-page-header [title]="current.code + ' - ' + current.name" [subtitle]="'CONFIGURATOR.EDITOR_SUBTITLE' | translate">
        <div class="header-actions">
          <a nz-button routerLink="/configurator">{{ 'CONFIGURATOR.BACK' | translate }}</a>
          <button nz-button (click)="checkRules()">{{ 'CONFIGURATOR.CHECK_RULES' | translate }}</button>
          @if (editable() && current.status === 'draft') {
            <button nz-button nzType="primary" (click)="publish()">{{ 'CONFIGURATOR.PUBLISH' | translate }}</button>
          }
          @if (current.status === 'published') {
            <a nz-button nzType="primary" routerLink="/configurator/configure" [queryParams]="{ model: current.id }">{{ 'CONFIGURATOR.CONFIGURE' | translate }}</a>
          }
        </div>
      </app-page-header>

      <div class="status-line">
        <nz-tag [nzColor]="statusColor(current.status)">{{ 'CONFIGURATOR.MODEL_STATUS_' + current.status.toUpperCase() | translate }}</nz-tag>
        <span>{{ 'CONFIGURATOR.VERSION' | translate }} {{ current.version }}</span>
      </div>

      @if (ruleCheck(); as check) {
        @if (check.valid) {
          <nz-alert nzType="success" nzShowIcon [nzMessage]="'CONFIGURATOR.RULES_OK' | translate" class="block"></nz-alert>
        } @else {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="'CONFIGURATOR.RULES_PROBLEMS' | translate" class="block" [nzDescription]="problems"></nz-alert>
          <ng-template #problems>
            <ul>
              @for (problem of check.problems; track problem.message) {
                <li>{{ problem.message }}</li>
              }
            </ul>
          </ng-template>
        }
      }

      <nz-card [nzTitle]="'CONFIGURATOR.GENERAL' | translate" class="block">
        <form nz-form [formGroup]="modelForm" nzLayout="vertical" (ngSubmit)="saveModel()">
          <div class="form-row">
            <nz-form-item class="wide">
              <nz-form-label nzRequired nzFor="m-name">{{ 'CONFIGURATOR.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="m-name" formControlName="name" maxlength="190" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="m-price">{{ 'CONFIGURATOR.BASE_PRICE' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number id="m-price" formControlName="base_price" [nzMin]="0" [nzPrecision]="2"></nz-input-number></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="m-cost">{{ 'CONFIGURATOR.BASE_COST' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number id="m-cost" formControlName="base_cost" [nzMin]="0" [nzPrecision]="2"></nz-input-number></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="m-currency">{{ 'CONFIGURATOR.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="m-currency" formControlName="currency">
                  <nz-option nzValue="EUR" nzLabel="EUR"></nz-option>
                  <nz-option nzValue="CHF" nzLabel="CHF"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="m-tax">{{ 'CONFIGURATOR.TAX_RATE' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number id="m-tax" formControlName="tax_rate" [nzMin]="0" [nzMax]="100" [nzPrecision]="2"></nz-input-number></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="m-margin">{{ 'CONFIGURATOR.MIN_MARGIN' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number id="m-margin" formControlName="min_margin_percent" [nzMin]="0" [nzMax]="99.99" [nzPrecision]="2"></nz-input-number></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item class="wide">
              <nz-form-label nzFor="m-product">{{ 'CONFIGURATOR.BASE_PRODUCT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="m-product" formControlName="base_product_id" nzAllowClear nzShowSearch>
                  @for (product of products(); track product.id) {
                    <nz-option [nzValue]="product.id" [nzLabel]="product.sku + ' - ' + product.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="m-from-product">{{ 'CONFIGURATOR.PRICE_FROM_PRODUCT' | translate }}</nz-form-label>
              <nz-form-control><nz-switch id="m-from-product" formControlName="base_price_from_product"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
          <h4>{{ 'CONFIGURATOR.VOLUME_BREAKS' | translate }}</h4>
          @for (breakForm of breaks.controls; track breakForm; let i = $index) {
            <div class="form-row break-row" [formGroup]="breakForm">
              <nz-form-item>
                <nz-form-label>{{ 'CONFIGURATOR.MIN_QUANTITY' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number formControlName="min_quantity" [nzMin]="1"></nz-input-number></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'CONFIGURATOR.DISCOUNT_PERCENT' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number formControlName="discount_percent" [nzMin]="0" [nzMax]="100" [nzPrecision]="2"></nz-input-number></nz-form-control>
              </nz-form-item>
              <button nz-button nzDanger type="button" (click)="removeBreak(i)">{{ 'CONFIGURATOR.REMOVE' | translate }}</button>
            </div>
          }
          <div class="form-actions">
            <button nz-button type="button" (click)="addBreak()">{{ 'CONFIGURATOR.ADD_BREAK' | translate }}</button>
            @if (editable()) {
              <button nz-button nzType="primary" type="submit" [disabled]="modelForm.invalid">{{ 'CONFIGURATOR.SAVE' | translate }}</button>
            }
          </div>
        </form>
      </nz-card>

      <nz-card [nzTitle]="'CONFIGURATOR.GROUPS' | translate" class="block" [nzExtra]="addGroupButton">
        <ng-template #addGroupButton>
          @if (editable()) {
            <button nz-button nzType="primary" (click)="openGroupModal()">{{ 'CONFIGURATOR.ADD_GROUP' | translate }}</button>
          }
        </ng-template>
        @for (group of groups(); track group.id) {
          <nz-card nzType="inner" class="group-card" [nzTitle]="groupTitle" [nzExtra]="groupActions">
            <ng-template #groupTitle>
              <strong>{{ group.name }}</strong> <code>{{ group.code }}</code>
              <nz-tag>{{ 'CONFIGURATOR.TYPE_' + group.type.toUpperCase() | translate }}</nz-tag>
              @if (group.is_required) {
                <nz-tag nzColor="blue">{{ 'CONFIGURATOR.REQUIRED' | translate }}</nz-tag>
              }
            </ng-template>
            <ng-template #groupActions>
              @if (editable()) {
                @if (group.type !== 'range' && (group.type !== 'boolean' || !group.options?.length)) {
                  <button nz-button nzSize="small" (click)="openOptionModal(group)">{{ 'CONFIGURATOR.ADD_OPTION' | translate }}</button>
                }
                <button nz-button nzSize="small" (click)="openGroupModal(group)">{{ 'CONFIGURATOR.EDIT' | translate }}</button>
                <button nz-button nzSize="small" nzDanger nz-popconfirm [nzPopconfirmTitle]="'CONFIGURATOR.CONFIRM_DELETE' | translate" (nzOnConfirm)="deleteGroup(group)">{{ 'CONFIGURATOR.DELETE' | translate }}</button>
              }
            </ng-template>
            @if (group.type === 'range') {
              <p>
                {{ 'CONFIGURATOR.RANGE_SUMMARY' | translate: { min: trim(group.range_min), max: trim(group.range_max), unit: group.unit ?? '', price: money(group.unit_price_delta, model()!.currency) } }}
              </p>
            } @else {
              <nz-table [nzData]="group.options ?? []" nzSize="small" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'CONFIGURATOR.CODE' | translate }}</th>
                    <th>{{ 'CONFIGURATOR.NAME' | translate }}</th>
                    <th>{{ 'CONFIGURATOR.PRICE_DELTA' | translate }}</th>
                    <th>{{ 'CONFIGURATOR.PRICE_MULTIPLIER' | translate }}</th>
                    <th>{{ 'CONFIGURATOR.COST' | translate }}</th>
                    <th>{{ 'CONFIGURATOR.DEFAULT' | translate }}</th>
                    <th>{{ 'CONFIGURATOR.ACTIVE' | translate }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (option of group.options ?? []; track option.id) {
                    <tr>
                      <td>{{ option.code }}</td>
                      <td>{{ option.name }}</td>
                      <td>{{ option.price_from_product ? ('CONFIGURATOR.FROM_PRICE_LIST' | translate) : money(option.price_delta, model()!.currency) }}</td>
                      <td>{{ trim(option.price_multiplier) }}</td>
                      <td>{{ money(option.cost, model()!.currency) }}</td>
                      <td>{{ option.is_default ? '✓' : '' }}</td>
                      <td>{{ option.is_active ? '✓' : '' }}</td>
                      <td>
                        @if (editable()) {
                          <button nz-button nzSize="small" (click)="openOptionModal(group, option)">{{ 'CONFIGURATOR.EDIT' | translate }}</button>
                          <button nz-button nzSize="small" nzDanger nz-popconfirm [nzPopconfirmTitle]="'CONFIGURATOR.CONFIRM_DELETE' | translate" (nzOnConfirm)="deleteOption(option)">{{ 'CONFIGURATOR.DELETE' | translate }}</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            }
          </nz-card>
        } @empty {
          <nz-empty [nzNotFoundContent]="'CONFIGURATOR.NO_GROUPS' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card [nzTitle]="'CONFIGURATOR.RULES' | translate" class="block" [nzExtra]="addRuleButton">
        <ng-template #addRuleButton>
          @if (editable()) {
            <button nz-button nzType="primary" (click)="openRuleModal()">{{ 'CONFIGURATOR.ADD_RULE' | translate }}</button>
          }
        </ng-template>
        <nz-table [nzData]="rules()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'CONFIGURATOR.NAME' | translate }}</th>
              <th>{{ 'CONFIGURATOR.RULE_TYPE' | translate }}</th>
              <th>{{ 'CONFIGURATOR.RULE_WHEN' | translate }}</th>
              <th>{{ 'CONFIGURATOR.RULE_THEN' | translate }}</th>
              <th>{{ 'CONFIGURATOR.ACTIVE' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (rule of rules(); track rule.id) {
              <tr>
                <td>{{ rule.name }}</td>
                <td><nz-tag>{{ 'CONFIGURATOR.RULE_TYPE_' + rule.type.toUpperCase() | translate }}</nz-tag></td>
                <td>{{ describeConditions(rule) }}</td>
                <td>{{ describeEffect(rule) }}</td>
                <td>{{ rule.is_active ? '✓' : '' }}</td>
                <td>
                  @if (editable()) {
                    <button nz-button nzSize="small" (click)="openRuleModal(rule)">{{ 'CONFIGURATOR.EDIT' | translate }}</button>
                    <button nz-button nzSize="small" nzDanger nz-popconfirm [nzPopconfirmTitle]="'CONFIGURATOR.CONFIRM_DELETE' | translate" (nzOnConfirm)="deleteRule(rule)">{{ 'CONFIGURATOR.DELETE' | translate }}</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6"><nz-empty [nzNotFoundContent]="'CONFIGURATOR.NO_RULES' | translate"></nz-empty></td></tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }

    <nz-modal
      [nzVisible]="groupModalVisible()"
      [nzTitle]="'CONFIGURATOR.GROUP' | translate"
      (nzOnCancel)="groupModalVisible.set(false)"
      (nzOnOk)="saveGroup()"
      okAction="save"
      [nzOkDisabled]="groupForm.invalid"
      nzWidth="680px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="groupForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="g-code">{{ 'CONFIGURATOR.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="g-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item class="wide">
              <nz-form-label nzRequired nzFor="g-name">{{ 'CONFIGURATOR.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="g-name" formControlName="name" maxlength="190" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="g-type">{{ 'CONFIGURATOR.GROUP_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="g-type" formControlName="type">
                  @for (type of groupTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="'CONFIGURATOR.TYPE_' + type.toUpperCase() | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="g-required">{{ 'CONFIGURATOR.REQUIRED' | translate }}</nz-form-label>
              <nz-form-control><nz-switch id="g-required" formControlName="is_required"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
          @if (groupType() === 'multi') {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzFor="g-min-select">{{ 'CONFIGURATOR.MIN_SELECT' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number id="g-min-select" formControlName="min_select" [nzMin]="0"></nz-input-number></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="g-max-select">{{ 'CONFIGURATOR.MAX_SELECT' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number id="g-max-select" formControlName="max_select" [nzMin]="1"></nz-input-number></nz-form-control>
              </nz-form-item>
            </div>
          }
          @if (groupType() === 'range') {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzFor="g-range-min">{{ 'CONFIGURATOR.RANGE_MIN' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number id="g-range-min" formControlName="range_min" [nzMin]="0"></nz-input-number></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="g-range-max">{{ 'CONFIGURATOR.RANGE_MAX' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number id="g-range-max" formControlName="range_max" [nzMin]="0"></nz-input-number></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="g-range-step">{{ 'CONFIGURATOR.RANGE_STEP' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number id="g-range-step" formControlName="range_step" [nzMin]="0"></nz-input-number></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="g-default">{{ 'CONFIGURATOR.DEFAULT_VALUE' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number id="g-default" formControlName="default_value" [nzMin]="0"></nz-input-number></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="g-unit">{{ 'CONFIGURATOR.UNIT' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="g-unit" formControlName="unit" maxlength="20" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="g-unit-price">{{ 'CONFIGURATOR.UNIT_PRICE' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number id="g-unit-price" formControlName="unit_price_delta" [nzPrecision]="4"></nz-input-number></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="g-unit-cost">{{ 'CONFIGURATOR.UNIT_COST' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number id="g-unit-cost" formControlName="unit_cost" [nzMin]="0" [nzPrecision]="4"></nz-input-number></nz-form-control>
              </nz-form-item>
              <nz-form-item class="wide">
                <nz-form-label nzFor="g-product">{{ 'CONFIGURATOR.LINKED_PRODUCT' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select id="g-product" formControlName="product_id" nzAllowClear nzShowSearch>
                    @for (product of products(); track product.id) {
                      <nz-option [nzValue]="product.id" [nzLabel]="product.sku + ' - ' + product.name"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
          }
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="optionModalVisible()"
      [nzTitle]="'CONFIGURATOR.OPTION' | translate"
      (nzOnCancel)="optionModalVisible.set(false)"
      (nzOnOk)="saveOption()"
      okAction="save"
      [nzOkDisabled]="optionForm.invalid"
      nzWidth="680px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="optionForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="o-code">{{ 'CONFIGURATOR.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="o-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item class="wide">
              <nz-form-label nzRequired nzFor="o-name">{{ 'CONFIGURATOR.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="o-name" formControlName="name" maxlength="190" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="o-delta">{{ 'CONFIGURATOR.PRICE_DELTA' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number id="o-delta" formControlName="price_delta" [nzPrecision]="4"></nz-input-number></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="o-multiplier">{{ 'CONFIGURATOR.PRICE_MULTIPLIER' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number id="o-multiplier" formControlName="price_multiplier" [nzMin]="0.0001" [nzPrecision]="4"></nz-input-number></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="o-cost">{{ 'CONFIGURATOR.COST' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number id="o-cost" formControlName="cost" [nzMin]="0" [nzPrecision]="4"></nz-input-number></nz-form-control>
            </nz-form-item>
            <nz-form-item class="wide">
              <nz-form-label nzFor="o-product">{{ 'CONFIGURATOR.LINKED_PRODUCT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="o-product" formControlName="product_id" nzAllowClear nzShowSearch>
                  @for (product of products(); track product.id) {
                    <nz-option [nzValue]="product.id" [nzLabel]="product.sku + ' - ' + product.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="o-from-product">{{ 'CONFIGURATOR.PRICE_FROM_PRODUCT' | translate }}</nz-form-label>
              <nz-form-control><nz-switch id="o-from-product" formControlName="price_from_product"></nz-switch></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="o-default">{{ 'CONFIGURATOR.DEFAULT' | translate }}</nz-form-label>
              <nz-form-control><nz-switch id="o-default" formControlName="is_default"></nz-switch></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="o-active">{{ 'CONFIGURATOR.ACTIVE' | translate }}</nz-form-label>
              <nz-form-control><nz-switch id="o-active" formControlName="is_active"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="ruleModalVisible()"
      [nzTitle]="'CONFIGURATOR.RULE' | translate"
      (nzOnCancel)="ruleModalVisible.set(false)"
      (nzOnOk)="saveRule()"
      okAction="save"
      [nzOkDisabled]="ruleForm.invalid"
      nzWidth="820px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="ruleForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item class="wide">
              <nz-form-label nzRequired nzFor="r-name">{{ 'CONFIGURATOR.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="r-name" formControlName="name" maxlength="190" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="r-type">{{ 'CONFIGURATOR.RULE_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="r-type" formControlName="type">
                  @for (type of ruleTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="'CONFIGURATOR.RULE_TYPE_' + type.toUpperCase() | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="r-match">{{ 'CONFIGURATOR.RULE_MATCH' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="r-match" formControlName="match">
                  <nz-option nzValue="all" [nzLabel]="'CONFIGURATOR.MATCH_ALL' | translate"></nz-option>
                  <nz-option nzValue="any" [nzLabel]="'CONFIGURATOR.MATCH_ANY' | translate"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>

          <h4>{{ 'CONFIGURATOR.RULE_WHEN' | translate }}</h4>
          @for (condition of conditions.controls; track condition; let i = $index) {
            <div class="form-row condition-row" [formGroup]="condition">
              <nz-form-item>
                <nz-select formControlName="type" [attr.aria-label]="'CONFIGURATOR.CONDITION_TYPE' | translate">
                  <nz-option nzValue="option" [nzLabel]="'CONFIGURATOR.CONDITION_OPTION' | translate"></nz-option>
                  <nz-option nzValue="range" [nzLabel]="'CONFIGURATOR.CONDITION_RANGE' | translate"></nz-option>
                </nz-select>
              </nz-form-item>
              @if (condition.controls.type.value === 'option') {
                <nz-form-item class="wide">
                  <nz-select formControlName="option" nzShowSearch [nzPlaceHolder]="'CONFIGURATOR.OPTION' | translate">
                    @for (choice of optionChoices(); track choice.code) {
                      <nz-option [nzValue]="choice.code" [nzLabel]="choice.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-item>
                <nz-form-item>
                  <nz-switch formControlName="negate" [nzCheckedChildren]="'CONFIGURATOR.NOT' | translate" [nzUnCheckedChildren]="'CONFIGURATOR.IS' | translate"></nz-switch>
                </nz-form-item>
              } @else {
                <nz-form-item class="wide">
                  <nz-select formControlName="group" [nzPlaceHolder]="'CONFIGURATOR.GROUP' | translate">
                    @for (group of rangeGroups(); track group.code) {
                      <nz-option [nzValue]="group.code" [nzLabel]="group.name"></nz-option>
                    }
                  </nz-select>
                </nz-form-item>
                <nz-form-item>
                  <nz-select formControlName="operator">
                    @for (operator of operators; track operator) {
                      <nz-option [nzValue]="operator" [nzLabel]="'CONFIGURATOR.OPERATOR_' + operator.toUpperCase() | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-item>
                <nz-form-item>
                  <nz-input-number formControlName="value"></nz-input-number>
                </nz-form-item>
              }
              <button nz-button nzDanger type="button" (click)="removeCondition(i)">{{ 'CONFIGURATOR.REMOVE' | translate }}</button>
            </div>
          }
          <button nz-button type="button" (click)="addCondition()">{{ 'CONFIGURATOR.ADD_CONDITION' | translate }}</button>

          <h4>{{ 'CONFIGURATOR.RULE_THEN' | translate }}</h4>
          @if (ruleType() === 'price_rule') {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzFor="r-effect-type">{{ 'CONFIGURATOR.EFFECT_TYPE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select id="r-effect-type" formControlName="price_effect_type">
                    <nz-option nzValue="amount" [nzLabel]="'CONFIGURATOR.EFFECT_AMOUNT' | translate"></nz-option>
                    <nz-option nzValue="percent" [nzLabel]="'CONFIGURATOR.EFFECT_PERCENT' | translate"></nz-option>
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="r-effect-value">{{ 'CONFIGURATOR.EFFECT_VALUE' | translate }}</nz-form-label>
                <nz-form-control><nz-input-number id="r-effect-value" formControlName="price_effect_value" [nzPrecision]="4"></nz-input-number></nz-form-control>
              </nz-form-item>
            </div>
          } @else {
            <nz-form-item>
              <nz-form-label nzFor="r-targets">{{ 'CONFIGURATOR.TARGET_OPTIONS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="r-targets" formControlName="target_options" nzMode="multiple" nzShowSearch>
                  @for (choice of optionChoices(); track choice.code) {
                    <nz-option [nzValue]="choice.code" [nzLabel]="choice.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <div class="form-row">
            <nz-form-item class="wide">
              <nz-form-label nzFor="r-message">{{ 'CONFIGURATOR.RULE_MESSAGE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="r-message" formControlName="message" maxlength="255" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="r-priority">{{ 'CONFIGURATOR.PRIORITY' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number id="r-priority" formControlName="priority"></nz-input-number></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="r-active">{{ 'CONFIGURATOR.ACTIVE' | translate }}</nz-form-label>
              <nz-form-control><nz-switch id="r-active" formControlName="is_active"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .header-actions { display: flex; gap: 8px; }
    .status-line { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    .block { margin-bottom: 16px; display: block; }
    .group-card { margin-bottom: 12px; }
    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; align-items: end; }
    .form-row .wide { grid-column: span 2; }
    .form-actions { display: flex; gap: 8px; margin-top: 12px; }
    nz-input-number { width: 100%; }
  `,
})
export class ModelEditorComponent implements OnInit {
  private readonly api = inject(ConfiguratorApiService);
  private readonly inventory = inject(InventoryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissions = inject(PermissionsService);

  readonly groupTypes = GROUP_TYPES;
  readonly ruleTypes = RULE_TYPES;
  readonly operators = OPERATORS;
  readonly statusColor = modelStatusColor;
  readonly money = formatMoney;
  readonly trim = trimDecimal;

  readonly model = signal<ConfiguratorModel | null>(null);
  readonly products = signal<ProductItem[]>([]);
  readonly ruleCheck = signal<ConfiguratorRuleCheck | null>(null);
  readonly groups = computed<ConfiguratorGroup[]>(() => this.model()?.groups ?? []);
  readonly rules = computed<ConfiguratorRule[]>(() => this.model()?.rules ?? []);
  readonly editable = computed(() => this.permissions.canWrite('configurator') && this.model()?.status !== 'archived');
  readonly optionChoices = computed(() =>
    this.groups().flatMap((group) => (group.options ?? []).map((option) => ({ code: option.code, label: `${group.name}: ${option.name}` }))),
  );
  readonly rangeGroups = computed(() => this.groups().filter((group) => group.type === 'range'));

  readonly groupModalVisible = signal(false);
  readonly optionModalVisible = signal(false);
  readonly ruleModalVisible = signal(false);
  private editingGroup: ConfiguratorGroup | null = null;
  private editingOption: ConfiguratorOption | null = null;
  private optionGroup: ConfiguratorGroup | null = null;
  private editingRule: ConfiguratorRule | null = null;

  readonly breaks = new FormArray<BreakForm>([]);
  readonly modelForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(190)]],
    base_price: [0, [Validators.min(0)]],
    base_cost: [0, [Validators.min(0)]],
    currency: ['EUR'],
    tax_rate: [22, [Validators.min(0), Validators.max(100)]],
    min_margin_percent: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(99.99)]),
    base_product_id: this.fb.control<string | null>(null),
    base_price_from_product: [false],
    volume_breaks: this.breaks,
  });

  readonly groupForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(190)]],
    type: this.fb.control<ConfiguratorGroupType>('single'),
    is_required: [false],
    min_select: this.fb.control<number | null>(null),
    max_select: this.fb.control<number | null>(null),
    range_min: this.fb.control<number | null>(null),
    range_max: this.fb.control<number | null>(null),
    range_step: this.fb.control<number | null>(null),
    default_value: this.fb.control<number | null>(null),
    unit: [''],
    unit_price_delta: [0],
    unit_cost: [0],
    product_id: this.fb.control<string | null>(null),
  });
  readonly groupType = toSignal(this.groupForm.controls.type.valueChanges, { initialValue: this.groupForm.controls.type.value });

  readonly optionForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(190)]],
    price_delta: [0],
    price_multiplier: [1, [Validators.min(0.0001)]],
    cost: [0, [Validators.min(0)]],
    product_id: this.fb.control<string | null>(null),
    price_from_product: [false],
    is_default: [false],
    is_active: [true],
  });

  readonly conditions = new FormArray<ConditionForm>([]);
  readonly ruleForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(190)]],
    type: this.fb.control<ConfiguratorRuleType>('requires'),
    match: ['all'],
    conditions: this.conditions,
    target_options: this.fb.control<string[]>([]),
    price_effect_type: ['amount'],
    price_effect_value: this.fb.control<number | null>(null),
    message: [''],
    priority: [100],
    is_active: [true],
  });
  readonly ruleType = toSignal(this.ruleForm.controls.type.valueChanges, { initialValue: this.ruleForm.controls.type.value });

  ngOnInit(): void {
    this.reload();
    this.inventory
      .getProducts({ per_page: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (response) => this.products.set(response.data) });
  }

  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.api
      .getModel(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.model.set(response.data);
          this.patchModelForm(response.data);
        },
        error: (error) => this.fail(error),
      });
  }

  private patchModelForm(model: ConfiguratorModel): void {
    this.breaks.clear();
    for (const volumeBreak of model.volume_breaks) {
      this.addBreak(Number(volumeBreak.min_quantity), Number(volumeBreak.discount_percent));
    }
    this.modelForm.patchValue({
      name: model.name,
      base_price: Number(model.base_price),
      base_cost: Number(model.base_cost),
      currency: model.currency,
      tax_rate: Number(model.tax_rate),
      min_margin_percent: model.min_margin_percent === null ? null : Number(model.min_margin_percent),
      base_product_id: model.base_product_id,
      base_price_from_product: model.base_price_from_product,
    });
  }

  addBreak(minQuantity = 10, discountPercent = 5): void {
    this.breaks.push(
      this.fb.group({
        min_quantity: [minQuantity, [Validators.required, Validators.min(1)]],
        discount_percent: [discountPercent, [Validators.required, Validators.min(0), Validators.max(100)]],
      }),
    );
  }

  removeBreak(index: number): void {
    this.breaks.removeAt(index);
  }

  saveModel(): void {
    const current = this.model();
    if (!current || this.modelForm.invalid) {
      return;
    }

    const value = this.modelForm.getRawValue();
    this.api
      .updateModel(current.id, {
        ...value,
        base_product_id: value.base_product_id,
        volume_breaks: value.volume_breaks.map((row) => ({ min_quantity: row.min_quantity, discount_percent: row.discount_percent })),
      })
      .subscribe({
        next: () => {
          this.message.success(this.i18n.translate('CONFIGURATOR.MODEL_SAVED'));
          this.reload();
        },
        error: (error) => this.fail(error),
      });
  }

  publish(): void {
    const current = this.model();
    if (!current) {
      return;
    }

    this.api.publishModel(current.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CONFIGURATOR.MODEL_PUBLISHED'));
        this.ruleCheck.set(null);
        this.reload();
      },
      error: (error) => this.fail(error),
    });
  }

  checkRules(): void {
    const current = this.model();
    if (!current) {
      return;
    }

    this.api.checkRules(current.id).subscribe({
      next: (response) => this.ruleCheck.set(response.data),
      error: (error) => this.fail(error),
    });
  }

  openGroupModal(group?: ConfiguratorGroup): void {
    this.editingGroup = group ?? null;
    this.groupForm.reset({
      code: group?.code ?? '',
      name: group?.name ?? '',
      type: group?.type ?? 'single',
      is_required: group?.is_required ?? false,
      min_select: group?.min_select ?? null,
      max_select: group?.max_select ?? null,
      range_min: group?.range_min == null ? null : Number(group.range_min),
      range_max: group?.range_max == null ? null : Number(group.range_max),
      range_step: group?.range_step == null ? null : Number(group.range_step),
      default_value: group?.default_value == null ? null : Number(group.default_value),
      unit: group?.unit ?? '',
      unit_price_delta: Number(group?.unit_price_delta ?? 0),
      unit_cost: Number(group?.unit_cost ?? 0),
      product_id: group?.product_id ?? null,
    });
    this.groupModalVisible.set(true);
  }

  saveGroup(): void {
    const current = this.model();
    if (!current || this.groupForm.invalid) {
      return;
    }

    const value = this.groupForm.getRawValue();
    const payload: ConfiguratorGroupRequest = {
      code: value.code,
      name: value.name,
      type: value.type,
      is_required: value.is_required,
      min_select: value.type === 'multi' ? value.min_select : null,
      max_select: value.type === 'multi' ? value.max_select : null,
      range_min: value.type === 'range' ? value.range_min : null,
      range_max: value.type === 'range' ? value.range_max : null,
      range_step: value.type === 'range' ? value.range_step : null,
      default_value: value.type === 'range' ? value.default_value : null,
      unit: value.type === 'range' && value.unit ? value.unit : null,
      unit_price_delta: value.type === 'range' ? value.unit_price_delta : 0,
      unit_cost: value.type === 'range' ? value.unit_cost : 0,
      product_id: value.type === 'range' ? value.product_id : null,
    };
    const request = this.editingGroup
      ? this.api.updateGroup(this.editingGroup.id, payload)
      : this.api.createGroup(current.id, payload);

    request.subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CONFIGURATOR.GROUP_SAVED'));
        this.groupModalVisible.set(false);
        this.reload();
      },
      error: (error) => this.fail(error),
    });
  }

  deleteGroup(group: ConfiguratorGroup): void {
    this.api.deleteGroup(group.id).subscribe({
      next: () => this.afterDelete(),
      error: (error) => this.fail(error),
    });
  }

  openOptionModal(group: ConfiguratorGroup, option?: ConfiguratorOption): void {
    this.optionGroup = group;
    this.editingOption = option ?? null;
    this.optionForm.reset({
      code: option?.code ?? '',
      name: option?.name ?? '',
      price_delta: Number(option?.price_delta ?? 0),
      price_multiplier: Number(option?.price_multiplier ?? 1),
      cost: Number(option?.cost ?? 0),
      product_id: option?.product_id ?? null,
      price_from_product: option?.price_from_product ?? false,
      is_default: option?.is_default ?? false,
      is_active: option?.is_active ?? true,
    });
    this.optionModalVisible.set(true);
  }

  saveOption(): void {
    const group = this.optionGroup;
    if (!group || this.optionForm.invalid) {
      return;
    }

    const payload: ConfiguratorOptionRequest = this.optionForm.getRawValue();
    const request = this.editingOption
      ? this.api.updateOption(this.editingOption.id, payload)
      : this.api.createOption(group.id, payload);

    request.subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CONFIGURATOR.OPTION_SAVED'));
        this.optionModalVisible.set(false);
        this.reload();
      },
      error: (error) => this.fail(error),
    });
  }

  deleteOption(option: ConfiguratorOption): void {
    this.api.deleteOption(option.id).subscribe({
      next: () => this.afterDelete(),
      error: (error) => this.fail(error),
    });
  }

  openRuleModal(rule?: ConfiguratorRule): void {
    this.editingRule = rule ?? null;
    this.conditions.clear();
    for (const condition of rule?.conditions ?? []) {
      this.addCondition(condition);
    }
    this.ruleForm.patchValue({
      name: rule?.name ?? '',
      type: rule?.type ?? 'requires',
      match: rule?.match ?? 'all',
      target_options: rule?.target_options ?? [],
      price_effect_type: rule?.price_effect_type ?? 'amount',
      price_effect_value: rule?.price_effect_value == null ? null : Number(rule.price_effect_value),
      message: rule?.message ?? '',
      priority: rule?.priority ?? 100,
      is_active: rule?.is_active ?? true,
    });
    this.ruleModalVisible.set(true);
  }

  addCondition(condition?: ConfiguratorRuleCondition): void {
    this.conditions.push(
      this.fb.group({
        type: this.fb.control<'option' | 'range'>(condition?.type ?? 'option'),
        option: [condition?.option ?? ''],
        negate: [condition?.negate ?? false],
        group: [condition?.group ?? ''],
        operator: this.fb.control<string>(condition?.operator ?? 'gte'),
        value: [Number(condition?.value ?? 0)],
      }),
    );
  }

  removeCondition(index: number): void {
    this.conditions.removeAt(index);
  }

  saveRule(): void {
    const current = this.model();
    if (!current || this.ruleForm.invalid) {
      return;
    }

    const value = this.ruleForm.getRawValue();
    const isPrice = value.type === 'price_rule';
    const payload: ConfiguratorRuleRequest = {
      name: value.name,
      type: value.type,
      match: value.match as 'all' | 'any',
      conditions: value.conditions.map((row) =>
        row.type === 'range'
          ? { type: 'range', group: row.group, operator: row.operator as ConfiguratorRuleCondition['operator'], value: row.value }
          : { type: 'option', option: row.option, negate: row.negate },
      ),
      target_options: isPrice ? null : value.target_options,
      price_effect_type: isPrice ? (value.price_effect_type as 'amount' | 'percent') : null,
      price_effect_value: isPrice ? value.price_effect_value : null,
      message: value.message || null,
      priority: value.priority,
      is_active: value.is_active,
    };
    const request = this.editingRule
      ? this.api.updateRule(this.editingRule.id, payload)
      : this.api.createRule(current.id, payload);

    request.subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CONFIGURATOR.RULE_SAVED'));
        this.ruleModalVisible.set(false);
        this.reload();
      },
      error: (error) => this.fail(error),
    });
  }

  deleteRule(rule: ConfiguratorRule): void {
    this.api.deleteRule(rule.id).subscribe({
      next: () => this.afterDelete(),
      error: (error) => this.fail(error),
    });
  }

  describeConditions(rule: ConfiguratorRule): string {
    if (rule.conditions.length === 0) {
      return this.i18n.translate('CONFIGURATOR.ALWAYS');
    }

    const joiner = rule.match === 'any' ? ' | ' : ' & ';
    return rule.conditions
      .map((condition) =>
        condition.type === 'range'
          ? `${condition.group} ${this.i18n.translate('CONFIGURATOR.OPERATOR_' + String(condition.operator).toUpperCase())} ${trimDecimal(condition.value)}`
          : `${condition.negate ? '! ' : ''}${condition.option}`,
      )
      .join(joiner);
  }

  describeEffect(rule: ConfiguratorRule): string {
    if (rule.type === 'price_rule') {
      const value = trimDecimal(rule.price_effect_value);
      return rule.price_effect_type === 'percent' ? `${value} %` : value;
    }
    return rule.target_options.join(', ');
  }

  private afterDelete(): void {
    this.message.success(this.i18n.translate('CONFIGURATOR.DELETED'));
    this.reload();
  }

  private fail(error: { error?: { message?: string } }): void {
    this.message.error(error?.error?.message ?? this.i18n.translate('CONFIGURATOR.ACTION_ERROR'));
  }
}
