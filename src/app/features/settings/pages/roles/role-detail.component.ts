import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AbacRuleDto, FieldPolicyEntry, I18nService, IamApiService, PermissionCatalog, PermissionStore, RoleDto } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { firstValueFrom } from 'rxjs';
import { AbacRuleBuilderComponent } from './abac-rule-builder.component';
import { FieldPoliciesComponent } from './field-policies.component';
import { RoleMatrixComponent } from './role-matrix.component';

/** One role: the permission matrix, the field policies and the ABAC rules, saved together. System roles are read only. */
@Component({
  selector: 'app-role-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AbacRuleBuilderComponent,
    FieldPoliciesComponent,
    NzButtonModule,
    NzSpinModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    RoleMatrixComponent,
    TranslatePipe,
  ],
  template: `
    @if (role(); as role) {
      <app-page-header [title]="role.name" [subtitle]="role.description ?? ''" />
      @if (role.is_system) {
        <nz-tag nzColor="blue">{{ 'IAM.ROLE_SYSTEM' | translate }}</nz-tag>
      }

      <nz-tabs>
        <nz-tab [nzTitle]="'IAM.TAB_PERMISSIONS' | translate">
          <app-role-matrix [catalog]="catalog()" [(selected)]="permissions" [readonly]="readonly()" />
        </nz-tab>
        <nz-tab [nzTitle]="'IAM.TAB_FIELDS' | translate">
          <app-field-policies [(policies)]="fieldPolicies" [readonly]="readonly()" />
        </nz-tab>
        <nz-tab [nzTitle]="'IAM.TAB_ABAC' | translate">
          <app-abac-rule-builder [(rules)]="abacRules" [permissionKeys]="permissions()" [readonly]="readonly()" />
        </nz-tab>
      </nz-tabs>

      @if (!readonly()) {
        <div class="footer">
          <button nz-button nzType="primary" [nzLoading]="saving()" (click)="save()" data-testid="save-role">{{ 'IAM.SAVE' | translate }}</button>
        </div>
      }
    } @else {
      <nz-spin nzSimple />
    }
  `,
  styles: ['.footer { margin-top: 16px; display: flex; justify-content: flex-end; }'],
})
export class RoleDetailComponent implements OnInit {
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  private readonly api = inject(IamApiService);
  private readonly store = inject(PermissionStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly role = signal<RoleDto | null>(null);
  protected readonly catalog = signal<PermissionCatalog>({});
  protected readonly permissions = signal<string[]>([]);
  protected readonly fieldPolicies = signal<FieldPolicyEntry[]>([]);
  protected readonly abacRules = signal<AbacRuleDto[]>([]);
  protected readonly saving = signal(false);
  protected readonly readonly = computed(() => this.role()?.is_system === true || !this.store.hasPermission('settings.roles.update'));

  private etag: string | undefined;

  async ngOnInit(): Promise<void> {
    const [catalog, role] = await Promise.all([firstValueFrom(this.api.catalog()), firstValueFrom(this.api.role(this.id))]);
    this.catalog.set(catalog.data.catalog);
    this.apply(role.data);
  }

  protected async save(): Promise<void> {
    const role = this.role();
    if (!role) {
      return;
    }
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(this.api.updateRole(role.id, { permissions: this.permissions() }, this.etag));
      await firstValueFrom(this.api.saveFieldPolicies(role.id, this.fieldPolicies()));
      await firstValueFrom(this.api.saveAbacRules(role.id, this.abacRules()));
      this.message.success(this.i18n.translate('IAM.SAVED'));
      await this.store.reload();
      this.etag = undefined;
      this.apply((await firstValueFrom(this.api.role(updated.data.id))).data);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 412) {
        this.message.warning(this.i18n.translate('IAM.EDIT_CONFLICT'));
        this.apply((await firstValueFrom(this.api.role(role.id))).data);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private apply(role: RoleDto): void {
    this.role.set(role);
    this.permissions.set([...(role.permissions ?? [])]);
    this.fieldPolicies.set([...(role.field_policies ?? [])]);
    this.abacRules.set([...(role.abac_rules ?? [])]);
    this.etag = undefined;
  }
}
