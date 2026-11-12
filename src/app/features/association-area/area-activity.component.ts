import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AssociationAreaApiService,
  AssociationAreaCalendarEntry,
  AssociationAreaRecord,
  I18nService,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { recordText, saveBlob } from './save-blob';

/** Calendar of lessons, documents shared with the person and authorizations to sign as a guardian. */
@Component({
  selector: 'app-area-activity',
  styleUrl: './area-activity.component.scss',
  imports: [FormsModule, NzButtonModule, NzEmptyModule, NzInputModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    <h3>{{ 'ASSOC_AREA.CALENDAR' | translate }}</h3>
    @if (calendar().length === 0) {
      <nz-empty />
    } @else {
      <nz-table nzSize="small" [nzData]="calendar()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'ASSOC_AREA.DATE' | translate }}</th>
            <th>{{ 'ASSOC_AREA.TIME' | translate }}</th>
            <th>{{ 'ASSOC_AREA.COURSE' | translate }}</th>
            <th>{{ 'ASSOC_AREA.STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (entry of calendar(); track entry.course_id + entry.date + entry.starts_at) {
            <tr>
              <td>{{ entry.date }}</td>
              <td>{{ entry.starts_at }} - {{ entry.ends_at }}</td>
              <td>{{ entry.title }}</td>
              <td>
                @if (entry.suspended) {
                  <nz-tag nzColor="warning">{{ 'ASSOC_AREA.SUSPENDED' | translate }}</nz-tag>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <h3 class="area-section">{{ 'ASSOC_AREA.DOCUMENTS' | translate }}</h3>
    @if (documents().length === 0) {
      <nz-empty />
    } @else {
      <nz-table nzSize="small" [nzData]="documents()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'ASSOC_AREA.TITLE_COLUMN' | translate }}</th>
            <th>{{ 'ASSOC_AREA.EXPIRES_ON' | translate }}</th>
            <th>{{ 'ASSOC_AREA.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (document of documents(); track text(document, 'id')) {
            <tr>
              <td>{{ text(document, 'title') }}</td>
              <td>{{ text(document, 'expires_on').slice(0, 10) }}</td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="download(text(document, 'id'), text(document, 'original_name'))">
                  {{ 'ASSOC_AREA.DOWNLOAD' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    @if (isWard()) {
      <h3 class="area-section">{{ 'ASSOC_AREA.AUTHORIZATIONS' | translate }}</h3>
      @if (authorizations().length === 0) {
        <nz-empty />
      } @else {
        @for (authorization of authorizations(); track text(authorization, 'id')) {
          <article class="area-authorization">
            <h4>{{ text(authorization, 'title') }} <nz-tag>{{ text(authorization, 'status') }}</nz-tag></h4>
            <p class="area-body">{{ text(authorization, 'body') }}</p>
            @if (text(authorization, 'status') === 'pending') {
              <div class="area-sign">
                <input
                  nz-input
                  [attr.aria-label]="'ASSOC_AREA.SIGNED_NAME' | translate"
                  [placeholder]="'ASSOC_AREA.SIGNED_NAME' | translate"
                  [ngModel]="signedName()"
                  (ngModelChange)="signedName.set($event)"
                />
                <button nz-button nzType="primary" type="button" [disabled]="signedName().trim().length < 3" (click)="sign(text(authorization, 'id'))">
                  {{ 'ASSOC_AREA.SIGN' | translate }}
                </button>
              </div>
            }
          </article>
        }
      }
    }
  `,
})
export class AreaActivityComponent {
  private readonly api = inject(AssociationAreaApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly memberId = input.required<string>();
  /** Authorizations are signed by the guardian of a minor in care. */
  readonly isWard = input(false);

  protected readonly calendar = signal<AssociationAreaCalendarEntry[]>([]);
  protected readonly documents = signal<AssociationAreaRecord[]>([]);
  protected readonly authorizations = signal<AssociationAreaRecord[]>([]);
  protected readonly signedName = signal('');
  protected readonly text = recordText;

  constructor() {
    effect(() => {
      const id = this.memberId();
      this.api.calendar(id).subscribe({ next: (res) => this.calendar.set(res.data), error: () => this.calendar.set([]) });
      this.api.documents(id).subscribe({ next: (res) => this.documents.set(res.data), error: () => this.documents.set([]) });
      if (this.isWard()) {
        this.loadAuthorizations(id);
      } else {
        this.authorizations.set([]);
      }
    });
  }

  protected download(documentId: string, fileName: string): void {
    this.api.downloadDocument(this.memberId(), documentId).subscribe((blob) => saveBlob(blob, fileName || documentId));
  }

  protected sign(authorizationId: string): void {
    this.api.signAuthorization(this.memberId(), authorizationId, this.signedName().trim()).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('ASSOC_AREA.SIGNED'));
        this.signedName.set('');
        this.loadAuthorizations(this.memberId());
      },
      error: () => this.message.error(this.i18n.translate('ASSOC_AREA.SIGN_FAILED')),
    });
  }

  private loadAuthorizations(memberId: string): void {
    this.api.authorizations(memberId).subscribe({
      next: (res) => this.authorizations.set(res.data),
      error: () => this.authorizations.set([]),
    });
  }
}
