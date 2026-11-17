import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  applyServerErrors,
  ClientApiService,
  ContactResource,
  contactDisplayName,
  I18nService,
  isValidationError,
  Lead,
  LeadApiService,
  LeadConvertPayload,
  LeadConvertResult,
  leadDisplayName,
  serverErrorMessage,
} from '@core';
import { LeadAssigneeSelectComponent } from './lead-assignee-select.component';
import { apiErrorMessage, httpStatus, translateOr, TranslateOrPipe } from './lead-i18n';

export type ContactMode = 'new' | 'existing';

/** Form fields per wizard step, used to jump to the first step with a 422 error. */
const STEP_FIELDS: readonly (readonly string[])[] = [
  ['existing_contact_id', 'contact_role'],
  ['existing_account_id', 'new_account_name', 'account_tier'],
  ['create_opportunity', 'opportunity_name', 'opportunity_amount', 'expected_close_date', 'owner_user_id'],
];

function toDateString(d: Date | null): string | null {
  if (!d) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 1-click lead conversion: contact -> account -> opportunity -> confirm. */
@Component({
  selector: 'app-lead-convert-wizard',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzRadioModule,
    NzResultModule,
    NzSelectModule,
    NzStepsModule,
    NzSwitchModule,
    TranslateOrPipe,
    LeadAssigneeSelectComponent,
  ],
  templateUrl: './lead-convert-wizard.component.html',
  styleUrl: './lead-convert-wizard.component.scss',
})
export class LeadConvertWizardComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(LeadApiService);
  private readonly contactsApi = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly lead = input.required<Lead>();
  readonly open = model(false);
  /** Emitted after a successful conversion or a 409 (lead must be refreshed). */
  readonly changed = output<void>();

  readonly step = signal(0);
  readonly submitting = signal(false);
  readonly result = signal<LeadConvertResult | null>(null);
  readonly formError = signal<string | null>(null);
  readonly contactMode = signal<ContactMode>('new');
  readonly matches = signal<ContactResource[]>([]);
  readonly contactOptions = signal<ContactResource[]>([]);
  readonly searching = signal(false);

  readonly form = this.fb.group({
    existing_contact_id: this.fb.control<string | null>(null),
    contact_role: this.fb.control<string>('decision_maker'),
    existing_account_id: this.fb.control<string | null>(null),
    new_account_name: this.fb.control<string>(''),
    account_tier: this.fb.control<string>('standard'),
    create_opportunity: this.fb.control(true),
    opportunity_name: this.fb.control<string>(''),
    opportunity_amount: this.fb.control<number | null>(null),
    expected_close_date: this.fb.control<Date | null>(null),
    owner_user_id: this.fb.control<string | null>(null),
  });

  readonly contactRoles = [
    'decision_maker',
    'influencer',
    'champion',
    'evaluator',
    'blocker',
    'economic_buyer',
    'technical_buyer',
  ];
  readonly accountTiers = ['standard', 'smb', 'mid_market', 'enterprise', 'strategic'];

  protected readonly leadName = computed(() => leadDisplayName(this.lead()));

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
  }

  /** Resets the wizard and prefills it from the lead, looking up existing contacts by VAT / email. */
  reset(): void {
    const lead = this.lead();
    this.step.set(0);
    this.result.set(null);
    this.formError.set(null);
    this.submitting.set(false);
    this.contactMode.set('new');
    this.matches.set([]);
    this.contactOptions.set([]);
    this.contactId.set(null);
    this.form.reset({
      existing_contact_id: null,
      contact_role: 'decision_maker',
      existing_account_id: null,
      new_account_name: lead.company_name ?? leadDisplayName(lead),
      account_tier: 'standard',
      create_opportunity: true,
      opportunity_name: lead.company_name ? `${lead.company_name}` : leadDisplayName(lead),
      opportunity_amount: lead.estimated_budget ?? null,
      expected_close_date: null,
      owner_user_id: lead.assigned_user_id ?? null,
    });
    this.findMatches(lead);
  }

  private findMatches(lead: Lead): void {
    const terms = [lead.vat_number, lead.email].filter((t): t is string => !!t);
    if (!terms.length) {
      return;
    }
    forkJoin(
      terms.map((search) =>
        this.contactsApi.list({ search, per_page: 5 }).pipe(
          map((r) => r.data),
          catchError(() => of([] as ContactResource[])),
        ),
      ),
    ).subscribe((lists) => {
      const seen = new Set<string>();
      const found = lists.flat().filter((c) => !seen.has(c.id) && !!seen.add(c.id));
      this.matches.set(found);
      this.contactOptions.set(found);
      if (found.length && !this.contactId()) {
        this.contactMode.set('existing');
        this.setContact(found[0].id);
      }
    });
  }

  protected searchContacts(term: string): void {
    if (!term || term.length < 2) {
      return;
    }
    this.searching.set(true);
    this.contactsApi
      .list({ search: term, per_page: 10 })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        const extra = r?.data ?? [];
        const merged = [...this.matches(), ...extra.filter((c) => !this.matches().some((m) => m.id === c.id))];
        this.contactOptions.set(merged);
        this.searching.set(false);
      });
  }

  protected setContactMode(mode: ContactMode): void {
    this.contactMode.set(mode);
    if (mode === 'new') {
      this.setContact(null);
    }
  }

  protected contactLabel(c: ContactResource): string {
    return [contactDisplayName(c), c.vat_number, c.email].filter(Boolean).join(' - ');
  }

  /** Mirrors `existing_contact_id` so that template guards stay signal-driven. */
  readonly contactId = signal<string | null>(null);

  readonly canContinue = computed(
    () => this.step() !== 0 || this.contactMode() === 'new' || !!this.contactId(),
  );

  setContact(id: string | null): void {
    this.form.controls.existing_contact_id.setValue(id);
    this.contactId.set(id);
  }

  next(): void {
    if (this.canContinue()) {
      this.step.update((s) => Math.min(3, s + 1));
    }
  }

  prev(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  buildPayload(): LeadConvertPayload {
    const v = this.form.getRawValue();
    const payload: LeadConvertPayload = {
      contact_role: v.contact_role || null,
      account_tier: v.account_tier || null,
      create_opportunity: v.create_opportunity,
    };
    if (this.contactMode() === 'existing' && v.existing_contact_id) {
      payload.existing_contact_id = v.existing_contact_id;
    }
    if (v.existing_account_id) {
      payload.existing_account_id = v.existing_account_id;
    } else if (v.new_account_name.trim()) {
      payload.new_account_name = v.new_account_name.trim();
    }
    if (v.create_opportunity) {
      payload.opportunity_name = v.opportunity_name.trim() || null;
      payload.opportunity_amount = v.opportunity_amount;
      payload.expected_close_date = toDateString(v.expected_close_date);
      payload.owner_user_id = v.owner_user_id || null;
    }
    return payload;
  }

  submit(): void {
    if (this.submitting() || this.result()) {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.api.convert(this.lead().id, this.buildPayload()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.result.set(res);
        this.message.success(translateOr(this.i18n, 'CRM.LEADS.CONVERT.SUCCESS', 'Lead converted'));
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const status = httpStatus(err);
        if (status === 409) {
          this.message.warning(
            translateOr(this.i18n, 'CRM.LEADS.CONVERT.ALREADY_CONVERTED', 'This lead has already been converted.'),
          );
          this.open.set(false);
          this.changed.emit();
          return;
        }
        if (isValidationError(err)) {
          const unmapped = applyServerErrors(this.form, err);
          const firstStep = STEP_FIELDS.findIndex((fields) => fields.some((f) => this.form.get(f)?.errors));
          if (firstStep >= 0) {
            this.step.set(firstStep);
          }
          this.formError.set(unmapped.join(' ') || apiErrorMessage(err));
          return;
        }
        this.formError.set(
          apiErrorMessage(err) ?? translateOr(this.i18n, 'CRM.LEADS.CONVERT.FAILED', 'Conversion failed. Please retry.'),
        );
      },
    });
  }

  protected fieldError(path: string): string | null {
    return serverErrorMessage(this.form, path);
  }

  protected roleLabel(role: string): string {
    return translateOr(this.i18n, `CRM.LEADS.CONVERT.ROLES.${role.toUpperCase()}`, role.replace(/_/g, ' '));
  }

  protected tierLabel(tier: string): string {
    return translateOr(this.i18n, `CRM.LEADS.CONVERT.TIERS.${tier.toUpperCase()}`, tier.replace(/_/g, ' '));
  }

  protected selectedContactLabel(): string {
    const id = this.contactId();
    const c = this.contactOptions().find((x) => x.id === id);
    return c ? this.contactLabel(c) : (id ?? '');
  }

  close(): void {
    this.open.set(false);
  }
}
