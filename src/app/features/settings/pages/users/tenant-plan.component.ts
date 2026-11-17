import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, I18nService, PLAN_CODES, PlanLimits, PlatformTenantRecord, UpdateTenantPlanPayload } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { reportHttpError } from '../../../hr/shared/hr-http.util';

/**
 * Platform administration: sets the plan of a company and, optionally, its user and custom role limits.
 * An empty limit removes the override and the plan limit applies again.
 */
@Component({
  selector: 'app-tenant-plan',
  imports: [FormsModule, NzButtonModule, NzCardModule, NzInputNumberModule, NzSelectModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'tenantPlan.title' | translate" [subtitle]="'tenantPlan.subtitle' | translate" />
    <nz-card>
      <div class="mb-3">
        <label for="tenant-plan-tenant">{{ 'userTenants.tenant' | translate }}</label>
        <nz-select
          id="tenant-plan-tenant"
          class="w-field-md"
          nzShowSearch
          data-test="tenant-select"
          [nzPlaceHolder]="'userTenants.pickTenant' | translate"
          [ngModel]="tenantId()"
          (ngModelChange)="tenantId.set($event)"
          (nzOnSearch)="loadTenants($event)"
        >
          @for (tenant of tenants(); track tenant.id) {
            <nz-option [nzValue]="tenant.id" [nzLabel]="tenant.name" />
          }
        </nz-select>
      </div>
      <div class="mb-3">
        <label for="tenant-plan-code">{{ 'access.limits.plan' | translate }}</label>
        <nz-select id="tenant-plan-code" class="w-field-md" data-test="plan-code" [ngModel]="planCode()" (ngModelChange)="planCode.set($event)">
          @for (code of planCodes; track code) {
            <nz-option [nzValue]="code" [nzLabel]="code" />
          }
        </nz-select>
      </div>
      <div class="mb-3">
        <label for="tenant-plan-users">{{ 'tenantPlan.maxUsers' | translate }}</label>
        <nz-input-number id="tenant-plan-users" data-test="max-users" [nzMin]="1" [ngModel]="maxUsers()" (ngModelChange)="maxUsers.set($event)" />
      </div>
      <div class="mb-3">
        <label for="tenant-plan-roles">{{ 'tenantPlan.maxCustomRoles' | translate }}</label>
        <nz-input-number id="tenant-plan-roles" data-test="max-roles" [nzMin]="0" [ngModel]="maxRoles()" (ngModelChange)="maxRoles.set($event)" />
      </div>
      <button nz-button nzType="primary" type="button" data-test="save-plan" [disabled]="tenantId() === null || saving()" [nzLoading]="saving()" (click)="save()">
        {{ 'common.save' | translate }}
      </button>
      @if (result(); as limits) {
        <p class="mt-3" data-test="plan-result">
          {{ limits.plan_code }} - {{ 'tenantPlan.maxUsers' | translate }}: {{ limits.max_users ?? '∞' }},
          {{ 'tenantPlan.maxCustomRoles' | translate }}: {{ limits.max_custom_roles ?? '∞' }}
        </p>
      }
    </nz-card>
  `,
})
export class TenantPlanComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly planCodes = PLAN_CODES;
  protected readonly tenants = signal<PlatformTenantRecord[]>([]);
  protected readonly tenantId = signal<string | null>(null);
  protected readonly planCode = signal<string>('standard');
  protected readonly maxUsers = signal<number | null>(null);
  protected readonly maxRoles = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly result = signal<PlanLimits | null>(null);

  ngOnInit(): void {
    this.loadTenants('');
  }

  protected loadTenants(term: string): void {
    this.api.listTenants({ search: term.trim() || undefined, per_page: 50 }).subscribe({
      next: (res) => this.tenants.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected save(): void {
    const id = this.tenantId();
    if (id === null) {
      return;
    }
    const payload: UpdateTenantPlanPayload = {
      plan_code: this.planCode(),
      max_users: this.maxUsers(),
      max_custom_roles: this.maxRoles(),
    };
    this.saving.set(true);
    this.api.updateTenantPlan(id, payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.result.set(res.data);
        this.message.success(this.i18n.translate('memberAccess.saved'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
