import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { DcEnforcementOffice, DcEnforcementOfficePayload, PermissionsService } from '@core';
import { TranslatePipe } from '@shared';
import { DcFeedback } from './dc-feedback.service';
import { DEBT_COLLECTION_MODULE } from './debt-collection.util';
import { SettingsStore } from './settings.store';

const EMPTY_OFFICE: DcEnforcementOfficePayload = {
  name: '',
  postal_code_from: '',
  postal_code_to: '',
  address: '',
  postal_code: '',
  city: '',
  canton: '',
  email: null,
};

/** Debt enforcement offices (Betreibungsämter) with the range of postal codes each one is responsible for. */
@Component({
  selector: 'app-dc-offices',
  imports: [
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
  ],
  styleUrl: './debt-collection.scss',
  template: `
    <div class="toolbar">
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="edit(null)">
          {{ 'debtCollection.action.newOffice' | translate }}
        </button>
      }
    </div>

    <nz-table #table nzSize="small" [nzData]="store.offices()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th scope="col">{{ 'debtCollection.field.name' | translate }}</th>
          <th scope="col">{{ 'debtCollection.office.range' | translate }}</th>
          <th scope="col">{{ 'debtCollection.office.address' | translate }}</th>
          <th scope="col">{{ 'debtCollection.office.canton' | translate }}</th>
          <th scope="col">{{ 'debtCollection.field.email' | translate }}</th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
        @for (office of table.data; track office.id) {
          <tr>
            <th scope="row">{{ office.name }}</th>
            <td>{{ office.postal_code_from }} – {{ office.postal_code_to }}</td>
            <td>{{ office.address }}, {{ office.postal_code }} {{ office.city }}</td>
            <td>{{ office.canton }}</td>
            <td>{{ office.email ?? '' }}</td>
            <td>
              @if (canWrite) {
                <div class="row-actions">
                  <button nz-button nzSize="small" type="button" (click)="edit(office)">
                    {{ 'debtCollection.action.edit' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'debtCollection.office.deleteConfirm' | translate"
                    (nzOnConfirm)="remove(office)"
                  >
                    {{ 'debtCollection.action.delete' | translate }}
                  </button>
                </div>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (store.offices().length === 0) {
      <nz-empty [nzNotFoundContent]="'debtCollection.office.empty' | translate" />
    }

    <nz-modal
      [nzVisible]="draft() !== null"
      [nzTitle]="'debtCollection.office.editor' | translate"
      [nzOkText]="'debtCollection.action.save' | translate"
      [nzCancelText]="'debtCollection.action.cancel' | translate"
      [nzOkDisabled]="!valid()"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="save()"
      (nzOnCancel)="draft.set(null)"
    >
      <ng-container *nzModalContent>
        @if (draft(); as office) {
          <div class="form-grid">
            <label class="field full" for="dc-o-name">
              <span>{{ 'debtCollection.field.name' | translate }}</span>
              <input
                nz-input
                id="dc-o-name"
                maxlength="160"
                [ngModel]="office.name"
                (ngModelChange)="patch({ name: $event })"
              />
            </label>
            <label class="field" for="dc-o-from">
              <span>{{ 'debtCollection.office.postalFrom' | translate }}</span>
              <input
                nz-input
                id="dc-o-from"
                maxlength="10"
                [ngModel]="office.postal_code_from"
                (ngModelChange)="patch({ postal_code_from: $event })"
              />
            </label>
            <label class="field" for="dc-o-to">
              <span>{{ 'debtCollection.office.postalTo' | translate }}</span>
              <input
                nz-input
                id="dc-o-to"
                maxlength="10"
                [ngModel]="office.postal_code_to"
                (ngModelChange)="patch({ postal_code_to: $event })"
              />
            </label>
            <label class="field full" for="dc-o-address">
              <span>{{ 'debtCollection.office.address' | translate }}</span>
              <input
                nz-input
                id="dc-o-address"
                maxlength="200"
                [ngModel]="office.address"
                (ngModelChange)="patch({ address: $event })"
              />
            </label>
            <label class="field" for="dc-o-zip">
              <span>{{ 'debtCollection.office.postalCode' | translate }}</span>
              <input
                nz-input
                id="dc-o-zip"
                maxlength="10"
                [ngModel]="office.postal_code"
                (ngModelChange)="patch({ postal_code: $event })"
              />
            </label>
            <label class="field" for="dc-o-city">
              <span>{{ 'debtCollection.office.city' | translate }}</span>
              <input
                nz-input
                id="dc-o-city"
                maxlength="120"
                [ngModel]="office.city"
                (ngModelChange)="patch({ city: $event })"
              />
            </label>
            <label class="field" for="dc-o-canton">
              <span>{{ 'debtCollection.office.canton' | translate }}</span>
              <input
                nz-input
                id="dc-o-canton"
                maxlength="2"
                [ngModel]="office.canton"
                (ngModelChange)="patch({ canton: $event.toUpperCase() })"
              />
            </label>
            <label class="field" for="dc-o-email">
              <span>{{ 'debtCollection.field.email' | translate }}</span>
              <input
                nz-input
                id="dc-o-email"
                type="email"
                maxlength="160"
                [ngModel]="office.email ?? ''"
                (ngModelChange)="patch({ email: $event || null })"
              />
            </label>
          </div>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class DcOfficesComponent {
  protected readonly store = inject(SettingsStore);
  private readonly feedback = inject(DcFeedback);

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly draft = signal<(DcEnforcementOfficePayload & { id: string | null }) | null>(
    null,
  );

  protected readonly valid = computed(() => {
    const office = this.draft();
    return (
      office !== null &&
      [
        office.name,
        office.postal_code_from,
        office.postal_code_to,
        office.address,
        office.postal_code,
        office.city,
        office.canton,
      ].every((value) => value.trim() !== '')
    );
  });

  protected edit(office: DcEnforcementOffice | null): void {
    this.draft.set(office ? { ...office } : { ...EMPTY_OFFICE, id: null });
  }

  protected patch(change: Partial<DcEnforcementOfficePayload>): void {
    this.draft.update((office) => (office ? { ...office, ...change } : office));
  }

  protected async save(): Promise<void> {
    const office = this.draft();
    if (!office) {
      return;
    }
    const { id, ...payload } = office;
    if (
      this.feedback.report(await this.store.saveOffice(id, payload), 'debtCollection.msg.saved')
    ) {
      this.draft.set(null);
    }
  }

  protected async remove(office: DcEnforcementOffice): Promise<void> {
    this.feedback.report(await this.store.deleteOffice(office.id), 'debtCollection.msg.deleted');
  }
}
