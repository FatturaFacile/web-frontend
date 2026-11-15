import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  LegalCase,
  PracticeApiService,
  PracticeCaseParty,
  PracticeConflictCheck,
  PracticeConflictRole,
  PracticePartyRole,
  ProfessionalsApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, CONFLICT_RESULT_COLORS, loadCases } from './practice-firm.util';

const CHECK_ROLES: readonly PracticeConflictRole[] = ['client', 'opposing_party', 'related_party'];
const PARTY_ROLES: readonly PracticePartyRole[] = ['client', 'opposing_party', 'related_party', 'witness'];

/** Conflicts-of-interest search and the parties recorded on matters that feed it. */
@Component({
  selector: 'app-practice-conflicts',
  styleUrl: './practice-firm.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'PRACTICEFIRM.CONFLICTS_TITLE' | translate" [subtitle]="'PRACTICEFIRM.CONFLICTS_SUBTITLE' | translate"></app-page-header>

    <nz-card class="main-card" [nzTitle]="'PRACTICEFIRM.RUN_CHECK' | translate">
      <form nz-form [formGroup]="checkForm" nzLayout="inline" (ngSubmit)="runCheck()">
        <nz-form-item>
          <nz-form-control><input nz-input style="width: 280px" formControlName="name" maxlength="190" [placeholder]="'PRACTICEFIRM.NAME' | translate" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-control>
            <nz-select style="width: 200px" formControlName="role">
              @for (value of checkRoles; track value) {
                <nz-option [nzValue]="value" [nzLabel]="('PRACTICEFIRM.ROLE_' + value.toUpperCase()) | translate"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <button nz-button nzType="primary" type="submit" [disabled]="checkForm.invalid">{{ 'PRACTICEFIRM.SEARCH' | translate }}</button>
      </form>

      @if (latest(); as check) {
        <div style="margin-top: 16px">
          <nz-tag [nzColor]="color(check.result)">{{ ('PRACTICEFIRM.RESULT_' + check.result.toUpperCase()) | translate }}</nz-tag>
          <span class="muted">{{ check.subject_name }}</span>
          @if (check.matches.length > 0) {
            <nz-table [nzData]="check.matches" nzSize="small" [nzShowPagination]="false" style="margin-top: 8px">
              <thead>
                <tr>
                  <th>{{ 'PRACTICEFIRM.NAME' | translate }}</th>
                  <th>{{ 'PRACTICEFIRM.ROLE' | translate }}</th>
                  <th>{{ 'PRACTICEFIRM.MATTER' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (match of check.matches; track $index) {
                  <tr>
                    <td>{{ match.name }}</td>
                    <td>{{ ('PRACTICEFIRM.ROLE_' + match.role.toUpperCase()) | translate }}</td>
                    <td>{{ match.case_number }} {{ match.case_title }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </div>
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'PRACTICEFIRM.HISTORY' | translate">
      <nz-table #historyTable [nzData]="history()" nzSize="small" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'PRACTICEFIRM.NAME' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.ROLE' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.RESULT' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.MATCHES' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of historyTable.data; track row.id) {
            <tr>
              <td>{{ row.subject_name }}</td>
              <td>{{ ('PRACTICEFIRM.ROLE_' + row.subject_role.toUpperCase()) | translate }}</td>
              <td><nz-tag [nzColor]="color(row.result)">{{ ('PRACTICEFIRM.RESULT_' + row.result.toUpperCase()) | translate }}</nz-tag></td>
              <td>{{ row.matches.length }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'PRACTICEFIRM.PARTIES' | translate">
      <div class="toolbar">
        <span class="spacer"></span>
        <button nz-button nzType="primary" (click)="openPartyModal()" appIconAction="create"></button>
      </div>
      <nz-table #partyTable [nzData]="parties()" nzSize="small" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'PRACTICEFIRM.NAME' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.ROLE' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.MATTER' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of partyTable.data; track row.id) {
            <tr>
              <td>{{ row.name }}</td>
              <td>{{ ('PRACTICEFIRM.ROLE_' + row.role.toUpperCase()) | translate }}</td>
              <td>{{ row.legal_case?.case_number }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'PRACTICEFIRM.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeParty(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (parties().length === 0) {
        <nz-empty [nzNotFoundContent]="'PRACTICEFIRM.NO_PARTIES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="partyModalVisible" [nzTitle]="'PRACTICEFIRM.NEW_PARTY' | translate" (nzOnCancel)="partyModalVisible.set(false)" (nzOnOk)="saveParty()" okAction="save" [nzOkDisabled]="partyForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="partyForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PRACTICEFIRM.MATTER' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="legal_case_id" nzShowSearch>
                @for (matter of cases(); track matter.id) {
                  <nz-option [nzValue]="matter.id" [nzLabel]="matter.case_number + ' - ' + matter.title"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="party-name">{{ 'PRACTICEFIRM.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="party-name" formControlName="name" maxlength="190" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PRACTICEFIRM.ROLE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="role">
                  @for (value of partyRoles; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('PRACTICEFIRM.ROLE_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="party-notes">{{ 'PRACTICEFIRM.NOTES' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="party-notes" formControlName="notes" maxlength="500" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PracticeConflictsComponent implements OnInit {
  private readonly api = inject(PracticeApiService);
  private readonly professionals = inject(ProfessionalsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly checkRoles = CHECK_ROLES;
  readonly partyRoles = PARTY_ROLES;
  readonly history = signal<PracticeConflictCheck[]>([]);
  readonly parties = signal<PracticeCaseParty[]>([]);
  readonly cases = signal<LegalCase[]>([]);
  readonly latest = signal<PracticeConflictCheck | null>(null);
  readonly partyModalVisible = signal(false);

  readonly checkForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(190)]],
    role: ['client' as PracticeConflictRole],
  });

  readonly partyForm = this.fb.group({
    legal_case_id: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(190)]],
    role: ['opposing_party' as PracticePartyRole],
    notes: [''],
  });

  ngOnInit(): void {
    loadCases(this.professionals).subscribe((cases) => this.cases.set(cases));
    this.loadHistory();
    this.loadParties();
  }

  color(result: string): string {
    return CONFLICT_RESULT_COLORS[result] ?? 'default';
  }

  loadHistory(): void {
    this.api.getConflictChecks({ per_page: 100 }).subscribe((response) => this.history.set(response.data));
  }

  loadParties(): void {
    this.api.getCaseParties({ per_page: 100 }).subscribe((response) => this.parties.set(response.data));
  }

  runCheck(): void {
    if (this.checkForm.invalid) {
      return;
    }
    const value = this.checkForm.getRawValue();
    this.api.runConflictCheck({ name: value.name, role: value.role }).subscribe({
      next: (response) => {
        this.latest.set(response.data);
        this.loadHistory();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  openPartyModal(): void {
    this.partyForm.reset({ legal_case_id: '', name: '', role: 'opposing_party', notes: '' });
    this.partyModalVisible.set(true);
  }

  saveParty(): void {
    const value = this.partyForm.getRawValue();
    this.api.createCaseParty({ legal_case_id: value.legal_case_id, name: value.name, role: value.role, notes: blankToNull(value.notes) }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICEFIRM.PARTY_SAVED'));
        this.partyModalVisible.set(false);
        this.loadParties();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  removeParty(party: PracticeCaseParty): void {
    this.api.deleteCaseParty(party.id).subscribe({
      next: () => this.loadParties(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }
}
