import { Component } from '@angular/core';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { SamlProviderFormComponent } from './saml-provider-form.component';
import { ScimGroupMappingsComponent } from './scim-group-mappings.component';
import { ScimLogsComponent } from './scim-logs.component';
import { SecurityAuditLogComponent } from './security-audit-log.component';
import { ScimTokenCardComponent } from './scim-token-card.component';
import { SecurityPolicyFormComponent } from './security-policy-form.component';
import { SsoProviderFormComponent } from './sso-provider-form.component';

/** Enterprise authentication of the tenant: security policy, OpenID Connect SSO, SAML SSO and SCIM provisioning. */
@Component({
  selector: 'app-enterprise-security',
  imports: [NzTabsModule, PageHeaderComponent, TranslatePipe, SecurityPolicyFormComponent, SsoProviderFormComponent, SamlProviderFormComponent, ScimTokenCardComponent, ScimGroupMappingsComponent, ScimLogsComponent, SecurityAuditLogComponent],
  template: `
    <app-page-header [title]="'ENT_AUTH.TITLE' | translate" [subtitle]="'ENT_AUTH.SUBTITLE' | translate" />

    <nz-tabs>
      <nz-tab [nzTitle]="'ENT_AUTH.TAB_POLICY' | translate">
        <ng-template nz-tab>
          <app-security-policy-form />
        </ng-template>
      </nz-tab>
      <nz-tab [nzTitle]="'ENT_AUTH.TAB_SSO' | translate">
        <ng-template nz-tab>
          <app-sso-provider-form />
        </ng-template>
      </nz-tab>
      <nz-tab [nzTitle]="'ENT_AUTH.TAB_SAML' | translate">
        <ng-template nz-tab>
          <app-saml-provider-form />
        </ng-template>
      </nz-tab>
      <nz-tab [nzTitle]="'ENT_AUTH.TAB_SCIM' | translate">
        <ng-template nz-tab>
          <app-scim-token-card />
          <app-scim-group-mappings />
          <app-scim-logs />
        </ng-template>
      </nz-tab>
      <nz-tab [nzTitle]="'security.audit.title' | translate">
        <ng-template nz-tab>
          <app-security-audit-log />
        </ng-template>
      </nz-tab>
    </nz-tabs>
  `,
})
export class EnterpriseSecurityComponent {}
