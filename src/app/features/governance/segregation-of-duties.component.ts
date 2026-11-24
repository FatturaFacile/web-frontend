import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  GovernanceApiService,
  GovMember,
  GovSodException,
  GovSodRule,
  GovSodRuleRequest,
  GovSodViolation,
  I18nService,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { GovernanceAccess } from './governance-access.service';

/** Splits a textarea into the distinct, non-empty duties it lists (one per line). */
export function sodParseDuties(text: string): string[] {
  return [...new Set(text.split(/[\n,]/).map((duty) => duty.trim()).filter((duty) => duty !== ''))];
}

/** Segregation of duties: the register of violations, the rules and the time-boxed exceptions. */
@Component({
  selector: 'app-governance-segregation-of-duties',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styles: `
    .actions {
      display: flex;
      gap: 8px;
    }
    .w-full {
      width: 100%;
    }
  `,
  template: `
    <app-page-header [title]="'GOVERNANCE.SOD.TITLE' | translate" [subtitle]="'GOVERNANCE.SOD.SUBTITLE' | translate">
      @if (access.canManage()) {
        <div class="actions">
          <button nz-button (click)="seed()">{{ 'GOVERNANCE.SOD.SEED_DEFAULTS' | translate }}</button>
          <button nz-button nzType="primary" (click)="scan()">{{ 'GOVERNANCE.SOD.SCAN' | translate }}</button>
        </div>
      }
    </app-page-header>

    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'GOVERNANCE.SOD.TAB_VIOLATIONS' | translate">
          <nz-table #violationTable [nzData]="violations()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="15">
            <thead>
              <tr>
                <th>{{ 'GOVERNANCE.SOD.MEMBER' | translate }}</th>
                <th>{{ 'GOVERNANCE.SOD.RULE' | translate }}</th>
                <th>{{ 'GOVERNANCE.SOD.DUTIES' | translate }}</th>
                <th>{{ 'GOVERNANCE.SOD.SEVERITY' | translate }}</th>
                <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (violation of violationTable.data; track violation.id) {
                <tr>
                  <td>{{ violation.user?.name || '-' }}</td>
                  <td>{{ violation.rule_code }} {{ violation.rule_title }}</td>
                  <td>{{ violation.duty_a }} / {{ violation.duty_b }}</td>
                  <td><nz-tag [nzColor]="violation.severity === 'block' ? 'red' : 'orange'">{{ 'GOVERNANCE.SOD.SEVERITY_' + (violation.severity ?? 'warn').toUpperCase() | translate }}</nz-tag></td>
                  <td><nz-tag [nzColor]="violation.status === 'open' ? 'red' : violation.status === 'excepted' ? 'gold' : 'green'">{{ 'GOVERNANCE.SOD.STATUS_' + violation.status.toUpperCase() | translate }}</nz-tag></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'GOVERNANCE.SOD.TAB_RULES' | translate">
          @if (access.canManage()) {
            <p><button nz-button nzType="primary" (click)="openRule()">{{ 'GOVERNANCE.SOD.NEW_RULE' | translate }}</button></p>
          }
          <nz-table #ruleTable [nzData]="rules()" nzSize="small" [nzPageSize]="15">
            <thead>
              <tr>
                <th>{{ 'GOVERNANCE.COMMON.CODE' | translate }}</th>
                <th>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</th>
                <th>{{ 'GOVERNANCE.SOD.DUTIES' | translate }}</th>
                <th>{{ 'GOVERNANCE.SOD.SEVERITY' | translate }}</th>
                <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (rule of ruleTable.data; track rule.id) {
                <tr>
                  <td>{{ rule.code }}</td>
                  <td>{{ rule.title }}</td>
                  <td>{{ rule.duties_a.join(', ') }} / {{ rule.duties_b.join(', ') }}</td>
                  <td><nz-tag [nzColor]="rule.severity === 'block' ? 'red' : 'orange'">{{ 'GOVERNANCE.SOD.SEVERITY_' + rule.severity.toUpperCase() | translate }}</nz-tag></td>
                  <td><nz-tag [nzColor]="rule.is_active ? 'green' : 'default'">{{ (rule.is_active ? 'GOVERNANCE.SOD.STATUS_ACTIVE' : 'GOVERNANCE.SOD.STATUS_REVOKED') | translate }}</nz-tag></td>
                  <td>
                    @if (access.canManage()) {
                      <button nz-button nzSize="small" (click)="toggleRule(rule)"><i class="fa-solid fa-power-off"></i></button>
                      <button nz-button nzSize="small" nzDanger nz-popconfirm [nzPopconfirmTitle]="'GOVERNANCE.SOD.DELETE_RULE_CONFIRM' | translate" (nzOnConfirm)="deleteRule(rule)" [attr.aria-label]="'COMMON.DELETE' | translate"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'GOVERNANCE.SOD.TAB_EXCEPTIONS' | translate">
          @if (access.canApprove()) {
            <p><button nz-button nzType="primary" (click)="openException()">{{ 'GOVERNANCE.SOD.NEW_EXCEPTION' | translate }}</button></p>
          }
          <nz-table #exceptionTable [nzData]="exceptions()" nzSize="small" [nzPageSize]="15">
            <thead>
              <tr>
                <th>{{ 'GOVERNANCE.SOD.MEMBER' | translate }}</th>
                <th>{{ 'GOVERNANCE.SOD.RULE' | translate }}</th>
                <th>{{ 'GOVERNANCE.SOD.JUSTIFICATION' | translate }}</th>
                <th>{{ 'GOVERNANCE.SOD.APPROVED_BY' | translate }}</th>
                <th>{{ 'GOVERNANCE.SOD.EXPIRES_AT' | translate }}</th>
                <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (exception of exceptionTable.data; track exception.id) {
                <tr>
                  <td>{{ exception.user?.name || '-' }}</td>
                  <td>{{ exception.rule_code }}</td>
                  <td>{{ exception.justification }}</td>
                  <td>{{ exception.approver?.name || '-' }}</td>
                  <td>{{ exception.expires_at | date: 'dd/MM/yyyy' }}</td>
                  <td><nz-tag [nzColor]="exception.status === 'active' ? 'green' : 'default'">{{ 'GOVERNANCE.SOD.STATUS_' + exception.status.toUpperCase() | translate }}</nz-tag></td>
                  <td>
                    @if (access.canApprove() && exception.status === 'active') {
                      <button nz-button nzSize="small" nzDanger (click)="revoke(exception)">{{ 'GOVERNANCE.SOD.REVOKE' | translate }}</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="ruleVisible" [nzTitle]="'GOVERNANCE.SOD.NEW_RULE' | translate" okAction="save" [nzOkDisabled]="ruleForm.invalid" (nzOnCancel)="ruleVisible.set(false)" (nzOnOk)="saveRule()">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="ruleForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.CODE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(ruleForm, 'code')"><input nz-input formControlName="code" maxlength="30" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(ruleForm, 'title')"><input nz-input formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.SOD.DUTIES_A' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(ruleForm, 'duties_a')"><textarea nz-input rows="3" formControlName="duties_a"></textarea></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.SOD.DUTIES_B' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(ruleForm, 'duties_b')"><textarea nz-input rows="3" formControlName="duties_b"></textarea></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.SOD.SEVERITY' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="severity" class="w-full">
                <nz-option nzValue="warn" [nzLabel]="'GOVERNANCE.SOD.SEVERITY_WARN' | translate"></nz-option>
                <nz-option nzValue="block" [nzLabel]="'GOVERNANCE.SOD.SEVERITY_BLOCK' | translate"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="exceptionVisible" [nzTitle]="'GOVERNANCE.SOD.NEW_EXCEPTION' | translate" okAction="save" [nzOkDisabled]="exceptionForm.invalid" (nzOnCancel)="exceptionVisible.set(false)" (nzOnOk)="saveException()">
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="exceptionForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.SOD.RULE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(exceptionForm, 'rule_id')">
              <nz-select formControlName="rule_id" class="w-full">
                @for (rule of rules(); track rule.id) {
                  <nz-option [nzValue]="rule.id" [nzLabel]="rule.code + ' ' + rule.title"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.SOD.MEMBER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(exceptionForm, 'user_id')">
              <nz-select formControlName="user_id" class="w-full" nzShowSearch>
                @for (member of members(); track member.id) {
                  <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.SOD.JUSTIFICATION' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(exceptionForm, 'justification')"><textarea nz-input rows="3" formControlName="justification" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.SOD.EXPIRES_AT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(exceptionForm, 'expires_at')"><input nz-input type="date" formControlName="expires_at" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class GovernanceSegregationOfDutiesComponent implements OnInit {
  protected readonly access = inject(GovernanceAccess);
  private readonly api = inject(GovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly violations = signal<GovSodViolation[]>([]);
  protected readonly rules = signal<GovSodRule[]>([]);
  protected readonly exceptions = signal<GovSodException[]>([]);
  protected readonly members = signal<GovMember[]>([]);
  protected readonly loading = signal(false);
  protected readonly ruleVisible = signal(false);
  protected readonly exceptionVisible = signal(false);

  protected readonly ruleForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/^[A-Z0-9-]+$/)]],
    title: ['', [Validators.required, Validators.maxLength(190)]],
    duties_a: ['', [Validators.required]],
    duties_b: ['', [Validators.required]],
    severity: ['warn' as 'warn' | 'block', [Validators.required]],
  });

  protected readonly exceptionForm = this.fb.group({
    rule_id: ['', [Validators.required]],
    user_id: ['', [Validators.required]],
    justification: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
    expires_at: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.load();
    this.api.getMembers().subscribe({ next: (res) => this.members.set(res.data) });
  }

  load(): void {
    this.loading.set(true);
    this.api.getSodViolations({ per_page: 100 }).subscribe({
      next: (res) => {
        this.violations.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.getSodRules().subscribe({ next: (res) => this.rules.set(res.data), error: () => undefined });
    this.api.getSodExceptions({ per_page: 100 }).subscribe({ next: (res) => this.exceptions.set(res.data), error: () => undefined });
  }

  errorTip(form: { get(path: string): { errors: Record<string, unknown> | null } | null }, path: string): string {
    const errors = form.get(path)?.errors;
    if (errors?.['serverError']) {
      return String(errors['serverError']);
    }
    return errors?.['required'] ? this.i18n.translate('COMMON.VALIDATION.REQUIRED') : '';
  }

  seed(): void {
    this.api.seedSodRules().subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.SOD.SEEDED'));
        this.load();
      },
    });
  }

  scan(): void {
    this.api.scanSod().subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.SOD.SCAN_DONE'));
        this.load();
      },
    });
  }

  openRule(): void {
    this.ruleForm.reset({ code: '', title: '', duties_a: '', duties_b: '', severity: 'warn' });
    this.ruleVisible.set(true);
  }

  saveRule(): void {
    if (this.ruleForm.invalid) {
      return;
    }
    const value = this.ruleForm.getRawValue();
    const payload: GovSodRuleRequest = {
      code: value.code,
      title: value.title,
      duties_a: sodParseDuties(value.duties_a),
      duties_b: sodParseDuties(value.duties_b),
      severity: value.severity,
      is_active: true,
    };
    this.api.createSodRule(payload).subscribe({
      next: () => {
        this.ruleVisible.set(false);
        this.message.success(this.translate.instant('GOVERNANCE.SOD.SAVED'));
        this.load();
      },
      error: (error: unknown) => this.showErrors(this.ruleForm, error),
    });
  }

  toggleRule(rule: GovSodRule): void {
    this.api.updateSodRule(rule.id, { is_active: !rule.is_active }).subscribe({ next: () => this.load() });
  }

  deleteRule(rule: GovSodRule): void {
    this.api.deleteSodRule(rule.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.SOD.DELETED'));
        this.load();
      },
    });
  }

  openException(): void {
    this.exceptionForm.reset({ rule_id: '', user_id: '', justification: '', expires_at: '' });
    this.exceptionVisible.set(true);
  }

  saveException(): void {
    if (this.exceptionForm.invalid) {
      return;
    }
    this.api.createSodException(this.exceptionForm.getRawValue()).subscribe({
      next: () => {
        this.exceptionVisible.set(false);
        this.message.success(this.translate.instant('GOVERNANCE.SOD.SAVED'));
        this.load();
      },
      error: (error: unknown) => this.showErrors(this.exceptionForm, error),
    });
  }

  revoke(exception: GovSodException): void {
    this.api.revokeSodException(exception.id).subscribe({ next: () => this.load() });
  }

  private showErrors(form: Parameters<typeof applyServerErrors>[0], error: unknown): void {
    const unmapped = applyServerErrors(form, error);
    const text = unmapped[0] ?? (error as { error?: { message?: string } })?.error?.message;
    if (text) {
      this.message.error(text);
    }
  }
}
