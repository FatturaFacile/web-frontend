import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  GC_EQUIPMENT_TYPES,
  GC_LICENSE_TYPES,
  GcCrew,
  GcCrewMember,
  GcCrewPayload,
  GcEquipment,
  GcLicense,
  GcLicensePayload,
  GcLicenseType,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { GreenCareCrewStore } from './green-care.stores';
import { GREEN_CARE_MODULE, isoDay, licenseColor, licenseState, parseDay } from './green-care.util';

interface MemberRow {
  id?: string;
  name: string;
  role: string;
  hourly_rate: number | null;
}

interface CrewForm {
  name: string;
  code: string;
  default_vehicle_plate: string;
  default_trailer_plate: string;
  equipment: Record<string, number | null>;
  daily_capacity_minutes: number | null;
  depot_latitude: number | null;
  depot_longitude: number | null;
  is_active: boolean;
  members: MemberRow[];
}

interface LicenseForm {
  license_type: GcLicenseType;
  license_number: string;
  issuing_authority: string;
  issue_date: Date | null;
  expiry_date: Date | null;
  is_active: boolean;
}

const emptyCrew = (): CrewForm => ({
  name: '',
  code: '',
  default_vehicle_plate: '',
  default_trailer_plate: '',
  equipment: {},
  daily_capacity_minutes: 480,
  depot_latitude: null,
  depot_longitude: null,
  is_active: true,
  members: [],
});

const emptyLicense = (): LicenseForm => ({
  license_type: 'PER',
  license_number: '',
  issuing_authority: '',
  issue_date: null,
  expiry_date: null,
  is_active: true,
});

/**
 * Crews and operator licences: the crew list, the crew drawer (plates, equipment counts, capacity, depot, members) and, per saved member,
 * the licence sub-table (PER / PNRP / OPF in CH, Patentino PAN in IT) with the validity badge.
 */
@Component({
  selector: 'app-green-care-crews',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styleUrl: './green-care.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.GREEN_CARE_CREWS' | translate"
      [subtitle]="'greenCare.section.crewsSubtitle' | translate"
    ></app-page-header>

    <div class="toolbar">
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-test="add-crew" (click)="openForm(null)">
          {{ 'greenCare.action.newCrew' | translate }}
        </button>
      }
    </div>

    <nz-table #crewTable nzSize="small" [nzData]="store.crews()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'greenCare.field.name' | translate }}</th>
          <th>{{ 'greenCare.field.code' | translate }}</th>
          <th>{{ 'greenCare.field.vehiclePlate' | translate }}</th>
          <th>{{ 'greenCare.field.dailyCapacity' | translate }}</th>
          <th>{{ 'greenCare.field.members' | translate }}</th>
          <th>{{ 'greenCare.field.status' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (crew of crewTable.data; track crew.id) {
          <tr [attr.data-test]="'crew-' + crew.id">
            <td>{{ crew.name }}</td>
            <td>{{ crew.code ?? '-' }}</td>
            <td>{{ crew.default_vehicle_plate ?? '-' }}</td>
            <td>{{ crew.daily_capacity_minutes }} min</td>
            <td>{{ crew.members.length }}</td>
            <td>
              <nz-tag [nzColor]="crew.is_active ? 'green' : 'default'">{{
                (crew.is_active ? 'greenCare.status.active' : 'greenCare.status.inactive') | translate
              }}</nz-tag>
            </td>
            <td>
              <div class="row-actions">
                <button nz-button nzSize="small" type="button" (click)="openForm(crew)">
                  {{ (canWrite ? 'greenCare.action.edit' : 'greenCare.action.view') | translate }}
                </button>
                @if (canWrite) {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'greenCare.confirm.deleteCrew' | translate"
                    (nzOnConfirm)="remove(crew)"
                  >
                    {{ 'greenCare.action.delete' | translate }}
                  </button>
                }
              </div>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-drawer
      [nzVisible]="formOpen()"
      [nzWidth]="800"
      [nzTitle]="(editingId() ? 'greenCare.action.editCrew' : 'greenCare.action.newCrew') | translate"
      (nzOnClose)="formOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate: formErrorParams()"></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="gc-cr-name">
            <span>{{ 'greenCare.field.name' | translate }} *</span>
            <input nz-input id="gc-cr-name" name="name" [(ngModel)]="form.name" />
          </label>
          <label class="field" for="gc-cr-code">
            <span>{{ 'greenCare.field.code' | translate }}</span>
            <input nz-input id="gc-cr-code" name="code" [(ngModel)]="form.code" />
          </label>
          <label class="field" for="gc-cr-vehicle">
            <span>{{ 'greenCare.field.vehiclePlate' | translate }}</span>
            <input nz-input id="gc-cr-vehicle" name="vehicle" [(ngModel)]="form.default_vehicle_plate" />
          </label>
          <label class="field" for="gc-cr-trailer">
            <span>{{ 'greenCare.field.trailerPlate' | translate }}</span>
            <input nz-input id="gc-cr-trailer" name="trailer" [(ngModel)]="form.default_trailer_plate" />
          </label>
          <label class="field" for="gc-cr-capacity">
            <span>{{ 'greenCare.field.dailyCapacity' | translate }}</span>
            <nz-input-number nzId="gc-cr-capacity" name="capacity" [(ngModel)]="form.daily_capacity_minutes" [nzMin]="0" [nzStep]="30"></nz-input-number>
          </label>
          <label class="field switch" for="gc-cr-active">
            <span>{{ 'greenCare.status.active' | translate }}</span>
            <nz-switch nzId="gc-cr-active" name="is_active" [(ngModel)]="form.is_active"></nz-switch>
          </label>
          <label class="field" for="gc-cr-lat">
            <span>{{ 'greenCare.field.depotLatitude' | translate }}</span>
            <nz-input-number nzId="gc-cr-lat" name="lat" [(ngModel)]="form.depot_latitude" [nzMin]="-90" [nzMax]="90" [nzStep]="0.0001"></nz-input-number>
          </label>
          <label class="field" for="gc-cr-lng">
            <span>{{ 'greenCare.field.depotLongitude' | translate }}</span>
            <nz-input-number nzId="gc-cr-lng" name="lng" [(ngModel)]="form.depot_longitude" [nzMin]="-180" [nzMax]="180" [nzStep]="0.0001"></nz-input-number>
          </label>
        </div>

        <h4 class="section-title">{{ 'greenCare.field.equipment' | translate }}</h4>
        <div class="form-grid">
          @for (type of equipmentTypes; track type) {
            <label class="field" [for]="'gc-cr-eq-' + type">
              <span>{{ 'greenCare.enum.equipment.' + type | translate }}</span>
              <nz-input-number [nzId]="'gc-cr-eq-' + type" [name]="'eq-' + type" [(ngModel)]="form.equipment[type]" [nzMin]="0" [nzStep]="1"></nz-input-number>
            </label>
          }
        </div>

        <h4 class="section-title">{{ 'greenCare.field.members' | translate }}</h4>
        @for (member of form.members; track $index) {
          <div class="botanical-row" [attr.data-test]="'member-' + $index">
            <input nz-input [name]="'member-name-' + $index" [placeholder]="'greenCare.field.name' | translate" [(ngModel)]="member.name" />
            <input nz-input [name]="'member-role-' + $index" [placeholder]="'greenCare.field.role' | translate" [(ngModel)]="member.role" />
            <nz-input-number [name]="'member-rate-' + $index" [(ngModel)]="member.hourly_rate" [nzMin]="0" [nzStep]="0.5"></nz-input-number>
            <span></span>
            <button nz-button nzDanger type="button" (click)="removeMember($index)">{{ 'greenCare.action.remove' | translate }}</button>
          </div>
          @if (member.id; as memberId) {
            <div class="panel" [attr.data-test]="'licenses-' + memberId">
              <div class="actions">
                <strong>{{ 'greenCare.section.licenses' | translate }} · {{ member.name }}</strong>
                <span class="spacer"></span>
                @if (canWrite) {
                  <button nz-button nzSize="small" type="button" [attr.data-test]="'add-license-' + memberId" (click)="openLicense(memberId, null)">
                    {{ 'greenCare.action.addLicense' | translate }}
                  </button>
                }
              </div>
              <nz-table #licenseTable nzSize="small" [nzData]="licensesOf(memberId)" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'greenCare.field.licenseType' | translate }}</th>
                    <th>{{ 'greenCare.field.licenseNumber' | translate }}</th>
                    <th>{{ 'greenCare.field.issuingAuthority' | translate }}</th>
                    <th>{{ 'greenCare.field.issueDate' | translate }}</th>
                    <th>{{ 'greenCare.field.expiryDate' | translate }}</th>
                    <th>{{ 'greenCare.field.validity' | translate }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (license of licenseTable.data; track license.id) {
                    <tr [attr.data-test]="'license-' + license.id">
                      <td>{{ 'greenCare.enum.licenseType.' + license.license_type | translate }}</td>
                      <td>{{ license.license_number }}</td>
                      <td>{{ license.issuing_authority ?? '-' }}</td>
                      <td>{{ license.issue_date ? (license.issue_date | date: 'mediumDate') : '-' }}</td>
                      <td>{{ license.expiry_date | date: 'mediumDate' }}</td>
                      <td>
                        <nz-tag [nzColor]="badgeColor(license)" [attr.data-test]="'validity-' + license.id">
                          {{ 'greenCare.licenseState.' + badgeState(license) | translate: { days: license.days_to_expiry } }}
                        </nz-tag>
                      </td>
                      <td>
                        @if (canWrite) {
                          <div class="row-actions">
                            <button nz-button nzSize="small" type="button" (click)="openLicense(memberId, license)">{{ 'greenCare.action.edit' | translate }}</button>
                            <button
                              nz-button
                              nzSize="small"
                              nzDanger
                              type="button"
                              nz-popconfirm
                              [nzPopconfirmTitle]="'greenCare.confirm.deleteLicense' | translate"
                              (nzOnConfirm)="removeLicense(license)"
                            >
                              {{ 'greenCare.action.delete' | translate }}
                            </button>
                          </div>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </div>
          } @else {
            <div class="hint">{{ 'greenCare.hint.saveMemberFirst' | translate }}</div>
          }
        }
        @if (canWrite) {
          <button nz-button type="button" data-test="add-member" (click)="addMember()">{{ 'greenCare.action.addMember' | translate }}</button>

          <div class="actions section-title">
            <button nz-button nzType="primary" type="button" data-test="save-crew" [disabled]="!formValid()" (click)="save()">
              {{ 'greenCare.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="formOpen.set(false)">{{ 'greenCare.action.cancel' | translate }}</button>
          </div>
        }
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="licenseMember() !== null"
      [nzTitle]="(licenseId() ? 'greenCare.action.editLicense' : 'greenCare.action.addLicense') | translate"
      [nzFooter]="licenseFooter"
      (nzOnCancel)="licenseMember.set(null)"
    >
      <ng-container *nzModalContent>
        @if (licenseError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate: licenseErrorParams()"></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="gc-lf-type">
            <span>{{ 'greenCare.field.licenseType' | translate }} *</span>
            <nz-select nzId="gc-lf-type" [(ngModel)]="licenseForm.license_type">
              @for (type of licenseTypes; track type) {
                <nz-option [nzValue]="type" [nzLabel]="'greenCare.enum.licenseType.' + type | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-lf-number">
            <span>{{ 'greenCare.field.licenseNumber' | translate }} *</span>
            <input nz-input id="gc-lf-number" name="license_number" [(ngModel)]="licenseForm.license_number" />
          </label>
          <label class="field" for="gc-lf-authority">
            <span>{{ 'greenCare.field.issuingAuthority' | translate }}</span>
            <input nz-input id="gc-lf-authority" name="issuing_authority" [(ngModel)]="licenseForm.issuing_authority" />
          </label>
          <label class="field" for="gc-lf-issue">
            <span>{{ 'greenCare.field.issueDate' | translate }}</span>
            <nz-date-picker nzId="gc-lf-issue" name="issue_date" [(ngModel)]="licenseForm.issue_date"></nz-date-picker>
          </label>
          <label class="field" for="gc-lf-expiry">
            <span>{{ 'greenCare.field.expiryDate' | translate }} *</span>
            <nz-date-picker nzId="gc-lf-expiry" name="expiry_date" [(ngModel)]="licenseForm.expiry_date"></nz-date-picker>
          </label>
          <label class="field switch" for="gc-lf-active">
            <span>{{ 'greenCare.status.active' | translate }}</span>
            <nz-switch nzId="gc-lf-active" name="is_active" [(ngModel)]="licenseForm.is_active"></nz-switch>
          </label>
        </div>
      </ng-container>
      <ng-template #licenseFooter>
        <button nz-button type="button" (click)="licenseMember.set(null)">{{ 'greenCare.action.cancel' | translate }}</button>
        <button nz-button nzType="primary" type="button" data-test="save-license" [disabled]="!licenseValid()" (click)="saveLicense()">
          {{ 'greenCare.action.save' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class GreenCareCrewsComponent implements OnInit {
  protected readonly store = inject(GreenCareCrewStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(GREEN_CARE_MODULE);
  protected readonly equipmentTypes = GC_EQUIPMENT_TYPES;
  protected readonly licenseTypes = GC_LICENSE_TYPES;

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorParams = signal<Record<string, string>>({});
  protected form: CrewForm = emptyCrew();

  protected readonly licenseMember = signal<string | null>(null);
  protected readonly licenseId = signal<string | null>(null);
  protected readonly licenseError = signal<string | null>(null);
  protected readonly licenseErrorParams = signal<Record<string, string>>({});
  protected licenseForm: LicenseForm = emptyLicense();

  private readonly editingCrew = computed(() => this.store.crews().find((crew) => crew.id === this.editingId()) ?? null);

  ngOnInit(): void {
    void this.store.load(true);
  }

  protected licensesOf(memberId: string): GcLicense[] {
    return (
      this.editingCrew()
        ?.members.find((member: GcCrewMember) => member.id === memberId)
        ?.licenses ?? []
    );
  }

  protected badgeState(license: GcLicense): string {
    return licenseState(license.days_to_expiry, license.is_valid);
  }

  protected badgeColor(license: GcLicense): string {
    return licenseColor(licenseState(license.days_to_expiry, license.is_valid));
  }

  protected openForm(crew: GcCrew | null): void {
    this.formError.set(null);
    this.editingId.set(crew?.id ?? null);
    this.form =
      crew === null
        ? emptyCrew()
        : {
            name: crew.name,
            code: crew.code ?? '',
            default_vehicle_plate: crew.default_vehicle_plate ?? '',
            default_trailer_plate: crew.default_trailer_plate ?? '',
            equipment: { ...(crew.equipment as Record<string, number>) },
            daily_capacity_minutes: crew.daily_capacity_minutes,
            depot_latitude: crew.depot_latitude,
            depot_longitude: crew.depot_longitude,
            is_active: crew.is_active,
            members: crew.members.map((member) => ({
              id: member.id,
              name: member.name,
              role: member.role ?? '',
              hourly_rate: member.hourly_rate,
            })),
          };
    this.formOpen.set(true);
  }

  protected addMember(): void {
    this.form.members = [...this.form.members, { name: '', role: '', hourly_rate: null }];
  }

  protected removeMember(index: number): void {
    this.form.members = this.form.members.filter((_, position) => position !== index);
  }

  protected formValid(): boolean {
    return this.form.name.trim() !== '' && this.form.members.every((member) => member.name.trim() !== '');
  }

  protected payload(): GcCrewPayload {
    const f = this.form;
    const equipment: GcEquipment = {};
    for (const type of GC_EQUIPMENT_TYPES) {
      const count = f.equipment[type];
      if (count !== null && count !== undefined && count > 0) {
        equipment[type] = count;
      }
    }
    return {
      name: f.name.trim(),
      code: f.code.trim() || null,
      default_vehicle_plate: f.default_vehicle_plate.trim() || null,
      default_trailer_plate: f.default_trailer_plate.trim() || null,
      equipment,
      daily_capacity_minutes: f.daily_capacity_minutes ?? 0,
      depot_latitude: f.depot_latitude,
      depot_longitude: f.depot_longitude,
      is_active: f.is_active,
      members: f.members.map((member) => ({
        ...(member.id ? { id: member.id } : {}),
        name: member.name.trim(),
        role: member.role.trim() || null,
        hourly_rate: member.hourly_rate,
      })),
    };
  }

  protected async save(): Promise<void> {
    if (!this.formValid()) {
      return;
    }
    const outcome = await this.store.saveCrew(this.editingId(), this.payload());
    if (outcome.ok) {
      this.formOpen.set(false);
      this.message.success(this.i18n.instant('greenCare.toast.crewSaved'));
    } else {
      this.formError.set(outcome.errorKey);
      this.formErrorParams.set(outcome.params);
    }
  }

  protected async remove(crew: GcCrew): Promise<void> {
    const outcome = await this.store.removeCrew(crew.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('greenCare.toast.crewDeleted'));
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
    }
  }

  protected openLicense(memberId: string, license: GcLicense | null): void {
    this.licenseError.set(null);
    this.licenseId.set(license?.id ?? null);
    this.licenseForm =
      license === null
        ? emptyLicense()
        : {
            license_type: license.license_type,
            license_number: license.license_number,
            issuing_authority: license.issuing_authority ?? '',
            issue_date: license.issue_date ? parseDay(license.issue_date.slice(0, 10)) : null,
            expiry_date: parseDay(license.expiry_date.slice(0, 10)),
            is_active: license.is_active,
          };
    this.licenseMember.set(memberId);
  }

  protected licenseValid(): boolean {
    const f = this.licenseForm;
    return (
      f.license_number.trim() !== '' &&
      f.expiry_date !== null &&
      (f.issue_date === null || f.issue_date <= f.expiry_date)
    );
  }

  protected licensePayload(memberId: string): GcLicensePayload {
    const f = this.licenseForm;
    return {
      crew_team_member_id: memberId,
      license_type: f.license_type,
      license_number: f.license_number.trim(),
      issuing_authority: f.issuing_authority.trim() || null,
      issue_date: f.issue_date ? isoDay(f.issue_date) : null,
      expiry_date: f.expiry_date ? isoDay(f.expiry_date) : '',
      is_active: f.is_active,
    };
  }

  protected async saveLicense(): Promise<void> {
    const memberId = this.licenseMember();
    if (memberId === null || !this.licenseValid()) {
      return;
    }
    const outcome = await this.store.saveLicense(this.licenseId(), this.licensePayload(memberId));
    if (outcome.ok) {
      this.licenseMember.set(null);
      this.message.success(this.i18n.instant('greenCare.toast.licenseSaved'));
    } else {
      this.licenseError.set(outcome.errorKey);
      this.licenseErrorParams.set(outcome.params);
    }
  }

  protected async removeLicense(license: GcLicense): Promise<void> {
    const outcome = await this.store.removeLicense(license.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('greenCare.toast.licenseDeleted'));
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
    }
  }
}
