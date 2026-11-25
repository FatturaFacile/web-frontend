import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ContactResource, CrmApiService, TndConversionResult, TndConvertPayload, TndNotice } from '@core';
import { TranslatePipe } from '@shared';

/**
 * Award conversion (Mod 169): turns an awarded dossier into the customer contract (Mod 108) and the project (Mod 065), which
 * inherit CIG, CUP, RUP and the dedicated bank account (Italy, for the e-invoices) or the simap.ch reference (Switzerland).
 */
@Component({
  selector: 'app-tnd-conversion-modal',
  imports: [FormsModule, NzAlertModule, NzDescriptionsModule, NzInputModule, NzModalModule, NzSelectModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      nzWidth="720px"
      [nzTitle]="'tenderManagement.convert.title' | translate"
      [nzOkText]="(result() ? 'tenderManagement.action.close' : 'tenderManagement.action.convert') | translate"
      [nzCancelText]="'tenderManagement.action.cancel' | translate"
      [nzOkLoading]="busy()"
      [nzOkDisabled]="!result() && showContact() && !contactId()"
      (nzOnOk)="confirm()"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        @if (errorKey(); as key) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate: errorParams()"></nz-alert>
        }
        @if (result(); as done) {
          <nz-alert nzType="success" nzShowIcon [nzMessage]="'tenderManagement.convert.done' | translate"></nz-alert>
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'tenderManagement.convert.contract' | translate">
              {{ done.contract.contract_number }} — {{ done.contract.title }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'tenderManagement.convert.project' | translate">
              {{ done.project.project_number }} — {{ done.project.name }}
            </nz-descriptions-item>
          </nz-descriptions>
        } @else {
          <p>{{ 'tenderManagement.convert.intro' | translate }}</p>
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1" [nzTitle]="'tenderManagement.convert.inherited' | translate">
            @if (notice()?.jurisdiction === 'IT_Dlgs36_2023_ANAC') {
              <nz-descriptions-item nzTitle="CIG">{{ notice()?.cig_code_it ?? '–' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="CUP">{{ notice()?.cup_code_it ?? '–' }}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="RUP">{{ notice()?.rup_name ?? '–' }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.dedicatedAccount' | translate">
                {{ notice()?.dedicated_bank_account_it ?? '–' }}
              </nz-descriptions-item>
            } @else {
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.simapProjectNumber' | translate">
                {{ notice()?.simap_project_number ?? '–' }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.contractingAuthority' | translate">
                {{ notice()?.contracting_authority_name }}
              </nz-descriptions-item>
            }
          </nz-descriptions>

          @if (showContact()) {
            <label class="field" for="tnd-convert-contact">
              <span>{{ 'tenderManagement.convert.contact' | translate }}</span>
              <nz-select
                nzId="tnd-convert-contact"
                nzShowSearch
                nzServerSearch
                [nzLoading]="searching()"
                [ngModel]="contactId()"
                (ngModelChange)="contactId.set($event)"
                (nzOnSearch)="search($event)"
              >
                @for (contact of contacts(); track contact.id) {
                  <nz-option [nzValue]="contact.id" [nzLabel]="label(contact)"></nz-option>
                }
              </nz-select>
            </label>
          }
          <label class="field" for="tnd-convert-title">
            <span>{{ 'tenderManagement.convert.contractTitle' | translate }}</span>
            <input nz-input id="tnd-convert-title" maxlength="240" [ngModel]="contractTitle()" (ngModelChange)="contractTitle.set($event)" />
          </label>
          <div class="dates">
            <label class="field" for="tnd-convert-start">
              <span>{{ 'tenderManagement.convert.plannedStart' | translate }}</span>
              <input nz-input id="tnd-convert-start" type="date" [ngModel]="start()" (ngModelChange)="start.set($event)" />
            </label>
            <label class="field" for="tnd-convert-end">
              <span>{{ 'tenderManagement.convert.plannedEnd' | translate }}</span>
              <input nz-input id="tnd-convert-end" type="date" [ngModel]="end()" (ngModelChange)="end.set($event)" />
            </label>
          </div>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 12px;
    }
    .dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
  `,
})
export class ConversionModalComponent {
  readonly visible = input(false);
  readonly notice = input<TndNotice | null>(null);
  readonly busy = input(false);
  readonly result = input<TndConversionResult | null>(null);
  readonly errorKey = input<string | null>(null);
  readonly errorParams = input<Record<string, string | number>>({});

  readonly confirmed = output<TndConvertPayload>();
  readonly closed = output<void>();

  private readonly crm = inject(CrmApiService);

  protected readonly contacts = signal<ContactResource[]>([]);
  protected readonly searching = signal(false);
  protected readonly contactId = signal<string | null>(null);
  protected readonly contractTitle = signal('');
  protected readonly start = signal('');
  protected readonly end = signal('');

  /** The contracting authority contact of the notice is invoiced; without it the user picks the customer. */
  protected readonly showContact = computed(() => !this.notice()?.contracting_authority_contact_id);

  protected label(contact: ContactResource): string {
    const name = contact.company_name || `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
    return contact.email ? `${name} (${contact.email})` : name;
  }

  protected search(term: string): void {
    if (term.trim().length < 2) {
      return;
    }
    this.searching.set(true);
    this.crm.getContacts({ search: term.trim(), per_page: 20 }).subscribe({
      next: (response) => {
        this.contacts.set(response.data);
        this.searching.set(false);
      },
      error: () => {
        this.contacts.set([]);
        this.searching.set(false);
      },
    });
  }

  protected confirm(): void {
    if (this.result()) {
      this.closed.emit();
      return;
    }
    this.confirmed.emit({
      contact_id: this.contactId(),
      contract_title: this.contractTitle() || null,
      planned_start_date: this.start() || null,
      planned_end_date: this.end() || null,
    });
  }
}
