import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DuplicateStrategy,
  I18nService,
  LeadApiService,
  LeadRoutingRule,
  LeadWebhookEndpoint,
  RoutingStrategy,
  SettingsApiService,
  UserResource,
  WebhookProvider,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-crm-lead-settings',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './lead-settings.component.html',
  styleUrl: './leads.component.scss',
})
export class LeadSettingsComponent implements OnInit {
  private readonly api = inject(LeadApiService);
  private readonly settings = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly webhooks = signal<LeadWebhookEndpoint[]>([]);
  protected readonly rules = signal<LeadRoutingRule[]>([]);
  protected readonly users = signal<UserResource[]>([]);

  /** Secret shown once after creating / rotating an endpoint. */
  protected readonly revealed = signal<{ name: string; url: string; secret: string } | null>(null);

  protected readonly webhookModal = signal(false);
  protected readonly webhookName = signal('');
  protected readonly webhookProvider = signal<WebhookProvider>('generic');
  protected readonly webhookStrategy = signal<DuplicateStrategy>('notify');

  protected readonly ruleModal = signal(false);
  protected readonly ruleName = signal('');
  protected readonly ruleStrategy = signal<RoutingStrategy>('round_robin');
  protected readonly rulePriority = signal(100);
  protected readonly ruleValues = signal('');
  protected readonly ruleAssignees = signal<string[]>([]);

  protected readonly providerOptions: { value: WebhookProvider; label: string }[] = [
    { value: 'generic', label: 'Generic JSON' },
    { value: 'wordpress', label: 'WordPress' },
    { value: 'webflow', label: 'Webflow' },
    { value: 'meta_ads', label: 'Meta Ads' },
    { value: 'linkedin', label: 'LinkedIn Lead Gen' },
  ];

  protected readonly strategyOptions = computed(() => {
    this.i18n.currentLanguage();
    return (['notify', 'merge', 'create'] as DuplicateStrategy[]).map((value) => ({
      value,
      label: this.i18n.translate(`CRM.LEADS.STRATEGY.${value.toUpperCase()}`),
    }));
  });

  protected readonly routingOptions = computed(() => {
    this.i18n.currentLanguage();
    return (['round_robin', 'geographic', 'product_line', 'company_size'] as RoutingStrategy[]).map(
      (value) => ({
        value,
        label: this.i18n.translate(`CRM.LEADS.ROUTING.${value.toUpperCase()}`),
      }),
    );
  });

  protected readonly userOptions = computed(() =>
    this.users().map((u) => ({ value: u.id, label: u.name })),
  );

  ngOnInit(): void {
    this.reload();
    this.settings.getTenantUsers().subscribe((res) => this.users.set(res.data));
  }

  protected reload(): void {
    this.api.listWebhooks().subscribe((res) => this.webhooks.set(res.data));
    this.api.listRoutingRules().subscribe((res) => this.rules.set(res.data));
  }

  protected userName(id: string): string {
    return this.users().find((u) => u.id === id)?.name ?? id;
  }

  protected strategyLabel(strategy: string): string {
    return this.i18n.translate(`CRM.LEADS.ROUTING.${strategy.toUpperCase()}`);
  }

  // --- Webhooks --------------------------------------------------------------
  protected saveWebhook(): void {
    this.api
      .createWebhook({
        name: this.webhookName(),
        provider: this.webhookProvider(),
        duplicate_strategy: this.webhookStrategy(),
      })
      .subscribe((endpoint) => {
        this.webhookModal.set(false);
        this.webhookName.set('');
        this.reveal(endpoint);
        this.reload();
      });
  }

  protected rotate(endpoint: LeadWebhookEndpoint): void {
    this.api.rotateWebhookSecret(endpoint.id).subscribe((updated) => this.reveal(updated));
  }

  protected deleteWebhook(endpoint: LeadWebhookEndpoint): void {
    this.api.deleteWebhook(endpoint.id).subscribe(() => this.reload());
  }

  private reveal(endpoint: LeadWebhookEndpoint): void {
    if (endpoint.secret) {
      this.revealed.set({ name: endpoint.name, url: endpoint.url, secret: endpoint.secret });
    }
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text);
    this.message.success(this.i18n.translate('CRM.LEADS.SETTINGS.COPIED'));
  }

  // --- Routing rules ---------------------------------------------------------
  protected saveRule(): void {
    const values = this.ruleValues()
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const strategy = this.ruleStrategy();

    let criteria: LeadRoutingRule['criteria'] = null;
    if (strategy === 'geographic') {
      criteria = { regions: values };
    } else if (strategy === 'product_line') {
      criteria = { product_lines: values };
    } else if (strategy === 'company_size') {
      criteria = { min_size: Number(values[0] ?? 0), max_size: Number(values[1] ?? 1_000_000) };
    }

    this.api
      .createRoutingRule({
        name: this.ruleName(),
        strategy,
        priority: this.rulePriority(),
        criteria,
        assignee_user_ids: this.ruleAssignees(),
        is_active: true,
      })
      .subscribe(() => {
        this.ruleModal.set(false);
        this.ruleName.set('');
        this.ruleValues.set('');
        this.ruleAssignees.set([]);
        this.reload();
      });
  }

  protected toggleRule(rule: LeadRoutingRule, active: boolean): void {
    this.api.updateRoutingRule(rule.id, { is_active: active }).subscribe(() => this.reload());
  }

  protected deleteRule(rule: LeadRoutingRule): void {
    this.api.deleteRoutingRule(rule.id).subscribe(() => this.reload());
  }

  protected criteriaSummary(rule: LeadRoutingRule): string {
    const c = rule.criteria ?? {};
    return (
      [
        ...(c.regions ?? []),
        ...(c.countries ?? []),
        ...(c.product_lines ?? []),
        c.min_size !== undefined ? `${c.min_size}–${c.max_size ?? '∞'}` : '',
      ]
        .filter(Boolean)
        .join(', ') || '-'
    );
  }
}
