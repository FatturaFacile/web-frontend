import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { BiMember, BiShare, BiShareResourceType, BiSharePermission, BusinessIntelligenceApiService, TranslateService } from '@core';
import { IconActionDirective, TranslatePipe } from '@shared';
import { apiErrorText } from './bi.util';

/** Who a dashboard or a saved query is shared with, and the form to share it with one more member for viewing or editing. */
@Component({
  selector: 'app-bi-share',
  imports: [FormsModule, IconActionDirective, NzButtonModule, NzEmptyModule, NzPopconfirmModule, NzSelectModule, NzTableModule, TranslatePipe],
  template: `
    <div class="bi-share-form">
      <nz-select class="bi-share-member" [ngModel]="memberId()" (ngModelChange)="memberId.set($event)" nzShowSearch [nzPlaceHolder]="'BI.SHARE_MEMBER' | translate" [attr.aria-label]="'BI.SHARE_MEMBER' | translate">
        @for (member of availableMembers(); track member.id) {
          <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 140px" [ngModel]="permission()" (ngModelChange)="permission.set($event)" [attr.aria-label]="'BI.SHARE_PERMISSION' | translate">
        <nz-option nzValue="view" [nzLabel]="'BI.PERMISSION_VIEW' | translate"></nz-option>
        <nz-option nzValue="edit" [nzLabel]="'BI.PERMISSION_EDIT' | translate"></nz-option>
      </nz-select>
      <button nz-button nzType="primary" [disabled]="!memberId() || saving()" (click)="share()">{{ 'BI.SHARE' | translate }}</button>
    </div>

    <nz-table #table [nzData]="shares()" nzSize="small" [nzShowPagination]="false" [nzLoading]="loading()">
      <thead>
        <tr>
          <th>{{ 'BI.SHARE_MEMBER' | translate }}</th>
          <th>{{ 'BI.SHARE_PERMISSION' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr>
            <td>{{ row.user_name ?? row.user_id }}</td>
            <td>{{ ('BI.PERMISSION_' + row.permission.toUpperCase()) | translate }}</td>
            <td>
              <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BI.UNSHARE_CONFIRM' | translate" (nzOnConfirm)="unshare(row)"></button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (!loading() && shares().length === 0) {
      <nz-empty [nzNotFoundContent]="'BI.NOT_SHARED' | translate"></nz-empty>
    }
  `,
  styles: `
    .bi-share-form { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .bi-share-member { min-width: 220px; flex: 1; }
  `,
})
export class BiShareComponent {
  private readonly api = inject(BusinessIntelligenceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly resourceType = input.required<BiShareResourceType>();
  readonly resourceId = input.required<string>();

  readonly shares = signal<BiShare[]>([]);
  readonly members = signal<BiMember[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly memberId = signal<string | null>(null);
  readonly permission = signal<BiSharePermission>('view');

  constructor() {
    effect(() => {
      this.resourceType();
      this.resourceId();
      untracked(() => this.load());
    });
  }

  availableMembers(): BiMember[] {
    const shared = new Set(this.shares().map((share) => share.user_id));
    return this.members().filter((member) => !shared.has(member.id));
  }

  load(): void {
    this.loading.set(true);
    this.api.getMembers().subscribe({ next: (response) => this.members.set(response.data), error: () => this.members.set([]) });
    this.api.getShares(this.resourceType(), this.resourceId()).subscribe({
      next: (response) => {
        this.shares.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR'));
      },
    });
  }

  share(): void {
    const userId = this.memberId();
    if (!userId) {
      return;
    }

    this.saving.set(true);
    this.api.share({ resource_type: this.resourceType(), resource_id: this.resourceId(), user_id: userId, permission: this.permission() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.memberId.set(null);
        this.message.success(this.translate.instant('BI.SHARED'));
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR'));
      },
    });
  }

  unshare(share: BiShare): void {
    this.api.unshare(share.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BI.UNSHARED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }
}
