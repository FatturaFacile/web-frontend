import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CommunicationApiService,
  CommunicationContactPreference,
  ContactResource,
  CrmApiService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './communication-inbox.util';

/** Opt-out per channel of one contact, shown next to the marketing consent of the CRM. */
@Component({
  selector: 'app-communication-preferences',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzCardModule,
    NzEmptyModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'COMMUNICATION.PREFERENCES_TITLE' | translate" [subtitle]="'COMMUNICATION.PREFERENCES_SUBTITLE' | translate"></app-page-header>

    <nz-card class="main-card">
      <nz-select
        class="contact-select"
        nzShowSearch
        nzServerSearch
        [nzPlaceHolder]="'COMMUNICATION.SEARCH_CONTACT' | translate"
        [ngModel]="contactId()"
        [nzLoading]="searching()"
        (nzOnSearch)="searchContacts($event)"
        (ngModelChange)="selectContact($event)"
      >
        @for (contact of contacts(); track contact.id) {
          <nz-option [nzValue]="contact.id" [nzLabel]="contactLabel(contact)"></nz-option>
        }
      </nz-select>

      @if (contactId() === null) {
        <nz-empty [nzNotFoundContent]="'COMMUNICATION.SELECT_CONTACT' | translate"></nz-empty>
      } @else {
        <nz-table #table [nzData]="preferences()" [nzLoading]="loading()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'COMMUNICATION.CHANNEL' | translate }}</th>
              <th>{{ 'COMMUNICATION.OPTED_OUT' | translate }}</th>
              <th>{{ 'COMMUNICATION.MARKETING_CONSENT' | translate }}</th>
              <th>{{ 'COMMUNICATION.CAN_RECEIVE_MARKETING' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.channel) {
              <tr>
                <td>{{ row.channel }}</td>
                <td><nz-switch [ngModel]="row.is_opted_out" (ngModelChange)="setOptOut(row, $event)"></nz-switch></td>
                <td>{{ consentKey(row) | translate }}</td>
                <td>
                  <nz-tag [nzColor]="row.can_receive_marketing ? 'green' : 'red'">{{ (row.can_receive_marketing ? 'COMMON.YES' : 'COMMON.NO') | translate }}</nz-tag>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>
  `,
})
export class CommunicationPreferencesComponent {
  private readonly api = inject(CommunicationApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly contacts = signal<ContactResource[]>([]);
  readonly contactId = signal<string | null>(null);
  readonly preferences = signal<CommunicationContactPreference[]>([]);
  readonly searching = signal(false);
  readonly loading = signal(false);

  contactLabel(contact: ContactResource): string {
    const name = contact.company_name || `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();

    return contact.email ? `${name} (${contact.email})` : name;
  }

  consentKey(row: CommunicationContactPreference): string {
    if (row.marketing_consent === 'granted') {
      return 'COMMUNICATION.CONSENT_GRANTED';
    }

    return row.marketing_consent === 'withdrawn' ? 'COMMUNICATION.CONSENT_WITHDRAWN' : 'COMMUNICATION.CONSENT_NONE';
  }

  searchContacts(term: string): void {
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

  selectContact(id: string | null): void {
    this.contactId.set(id);
    this.preferences.set([]);
    if (id === null) {
      return;
    }
    this.loading.set(true);
    this.api.getContactPreferences(id).subscribe({
      next: (response) => {
        this.preferences.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('COMMUNICATION.ACTION_ERROR'));
      },
    });
  }

  setOptOut(row: CommunicationContactPreference, isOptedOut: boolean): void {
    const id = this.contactId();
    if (id === null) {
      return;
    }
    this.api.setContactPreference(id, { channel: row.channel, is_opted_out: isOptedOut }).subscribe({
      next: (response) => {
        this.preferences.set(response.data);
        this.message.success(this.translate.instant('COMMUNICATION.PREFERENCE_SAVED'));
      },
      error: (error: unknown) => {
        this.selectContact(id);
        this.message.error(apiErrorText(error) ?? this.translate.instant('COMMUNICATION.ACTION_ERROR'));
      },
    });
  }
}
