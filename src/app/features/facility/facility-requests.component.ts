import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  FACILITY_REQUEST_CATEGORIES,
  FACILITY_REQUEST_PRIORITIES,
  FacilityApiService,
  FacilityBuilding,
  FacilityRequestComment,
  FacilityRequestStatus,
  FacilityServiceRequest,
  FacilityServiceRequestBoard,
  FacilityServiceRequestRequest,
  FacilitySpace,
  SettingsApiService,
  TranslateService,
  UserResource,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, facilityAbilities } from './facility.util';

/** Actions that need a value from the user before they are sent. */
type InputAction = 'assign' | 'hold' | 'resolve' | 'cancel' | 'link-work-order' | 'raise-work-order';

const BOARD_COLUMNS: readonly FacilityRequestStatus[] = ['new', 'assigned', 'in_progress', 'on_hold', 'resolved'];

/** Service request board: status columns with SLA due dates, the status flow, assignment and the EAM work order link. */
@Component({
  selector: 'app-facility-requests',
  styleUrl: './facility.scss',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzStatisticModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'FACILITY.REQUESTS_TITLE' | translate" [subtitle]="'FACILITY.REQUESTS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCreate()" appIconAction="create"></button>
    </app-page-header>

    <div class="stats-grid">
      <nz-card class="main-card"><nz-statistic [nzValue]="summary()?.open ?? 0" [nzTitle]="'FACILITY.OPEN_REQUESTS' | translate"></nz-statistic></nz-card>
      <nz-card class="main-card"><nz-statistic [nzValue]="summary()?.overdue ?? 0" [nzTitle]="'FACILITY.OVERDUE' | translate"></nz-statistic></nz-card>
      <nz-card class="main-card"><nz-statistic [nzValue]="summary()?.by_priority?.urgent ?? 0" [nzTitle]="'FACILITY.URGENT_OPEN' | translate"></nz-statistic></nz-card>
    </div>

    <div class="toolbar">
      <nz-select style="width: 180px" nzAllowClear [ngModel]="category()" (ngModelChange)="category.set($event)" [nzPlaceHolder]="'FACILITY.CATEGORY' | translate">
        @for (value of categories; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('FACILITY.CATEGORY_' + value) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 160px" nzAllowClear [ngModel]="priority()" (ngModelChange)="priority.set($event)" [nzPlaceHolder]="'FACILITY.PRIORITY' | translate">
        @for (value of priorities; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('FACILITY.PRIORITY_' + value) | translate"></nz-option>
        }
      </nz-select>
      <input nz-input style="width: 200px" [ngModel]="search()" (ngModelChange)="search.set($event)" [placeholder]="'FACILITY.SEARCH' | translate" />
      @if (abilities().operate) {
        <label for="facility-requests-field" nzId="facility-requests-field" nz-checkbox [ngModel]="onlyMine()" (ngModelChange)="onlyMine.set($event)">{{ 'FACILITY.ASSIGNED_TO_ME' | translate }}</label>
      }
    </div>

    <div class="board">
      @for (column of columns; track column) {
        <div class="column">
          <div class="column-title">
            <span>{{ ('FACILITY.STATUS_' + column.toUpperCase()) | translate }}</span>
            <nz-tag>{{ byStatus()[column].length }}</nz-tag>
          </div>
          @for (item of byStatus()[column]; track item.id) {
            <div class="ticket" [class]="item.priority" [class.overdue]="item.is_overdue" role="button" tabindex="0" (click)="open(item)" (keydown.enter)="open(item)">
              <div><strong>{{ item.number }}</strong> <nz-tag>{{ ('FACILITY.CATEGORY_' + item.category) | translate }}</nz-tag></div>
              <div>{{ item.title }}</div>
              <div class="muted due">{{ 'FACILITY.DUE' | translate }}: {{ item.due_at | date: 'short' }}</div>
              @if (item.assignee) {
                <div class="muted">{{ item.assignee.name }}</div>
              }
            </div>
          }
          @if (byStatus()[column].length === 0) {
            <nz-empty nzNotFoundImage="simple" [nzNotFoundContent]="null"></nz-empty>
          }
        </div>
      }
    </div>

    <nz-drawer [nzVisible]="drawerVisible()" nzWidth="560" [nzTitle]="selected()?.number ?? ''" (nzOnClose)="drawerVisible.set(false)">
      <ng-container *nzDrawerContent>
        @if (selected(); as request) {
          <h3>{{ request.title }}</h3>
          <p>{{ request.description }}</p>
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'FACILITY.STATUS' | translate"><nz-tag>{{ ('FACILITY.STATUS_' + request.status.toUpperCase()) | translate }}</nz-tag></nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'FACILITY.PRIORITY' | translate">{{ ('FACILITY.PRIORITY_' + request.priority) | translate }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'FACILITY.DUE' | translate">{{ request.due_at | date: 'medium' }} @if (request.is_overdue) { <nz-tag nzColor="red">{{ 'FACILITY.OVERDUE' | translate }}</nz-tag> }</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'FACILITY.REQUESTER' | translate">{{ request.requester?.name ?? '-' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'FACILITY.ASSIGNEE' | translate">{{ request.assignee?.name ?? '-' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'FACILITY.WORK_ORDER' | translate">{{ request.work_order_id ?? '-' }}</nz-descriptions-item>
            @if (request.hold_reason) {
              <nz-descriptions-item [nzTitle]="'FACILITY.HOLD_REASON' | translate">{{ request.hold_reason }}</nz-descriptions-item>
            }
            @if (request.resolution_notes) {
              <nz-descriptions-item [nzTitle]="'FACILITY.RESOLUTION_NOTES' | translate">{{ request.resolution_notes }}</nz-descriptions-item>
            }
          </nz-descriptions>

          <div class="toolbar" style="margin-top: 16px">
            @if (isOpen(request) && (abilities().operate || (isOwn(request) && request.status === 'new'))) {
              <button nz-button (click)="openEdit(request)">{{ 'FACILITY.EDIT_REQUEST' | translate }}</button>
            }
            @if (abilities().operate) {
              @if (request.status === 'new' || request.status === 'assigned') {
                <button nz-button (click)="askInput('assign')">{{ 'FACILITY.ASSIGN' | translate }}</button>
              }
              @if (request.status === 'new' || request.status === 'assigned' || request.status === 'on_hold') {
                <button nz-button nzType="primary" (click)="act('start')">{{ 'FACILITY.START' | translate }}</button>
              }
              @if (request.status === 'assigned' || request.status === 'in_progress') {
                <button nz-button (click)="askInput('hold')">{{ 'FACILITY.HOLD' | translate }}</button>
              }
              @if (request.status === 'in_progress') {
                <button nz-button nzType="primary" (click)="askInput('resolve')">{{ 'FACILITY.RESOLVE' | translate }}</button>
              }
              @if (request.status === 'resolved') {
                <button nz-button nzType="primary" (click)="act('close')">{{ 'FACILITY.CLOSE' | translate }}</button>
              }
              @if (!request.work_order_id && isOpen(request)) {
                <button nz-button (click)="askInput('link-work-order')">{{ 'FACILITY.LINK_WORK_ORDER' | translate }}</button>
                <button nz-button (click)="askInput('raise-work-order')">{{ 'FACILITY.RAISE_WORK_ORDER' | translate }}</button>
              }
            }
            @if (request.status === 'resolved' && (abilities().operate || isOwn(request))) {
              <button nz-button (click)="act('reopen')">{{ 'FACILITY.REOPEN' | translate }}</button>
            }
            @if (isOpen(request) && (abilities().operate || (isOwn(request) && request.status === 'new'))) {
              <button nz-button nzDanger (click)="askInput('cancel')">{{ 'FACILITY.CANCEL_REQUEST' | translate }}</button>
            }
          </div>

          <h4>{{ 'FACILITY.COMMENTS' | translate }}</h4>
          @for (comment of comments(); track comment.id) {
            <div class="comment">
              <strong>{{ comment.author?.name }}</strong>
              @if (comment.is_internal) {
                <nz-tag nzColor="orange">{{ 'FACILITY.INTERNAL' | translate }}</nz-tag>
              }
              <span class="muted"> {{ comment.created_at | date: 'short' }}</span>
              <div>{{ comment.body }}</div>
            </div>
          }
          <form nz-form [formGroup]="commentForm" nzLayout="vertical" style="margin-top: 12px">
            <nz-form-item>
              <nz-form-control><textarea nz-input rows="3" formControlName="body" maxlength="4000" [placeholder]="'FACILITY.ADD_COMMENT' | translate"></textarea></nz-form-control>
            </nz-form-item>
            <div class="toolbar">
              @if (abilities().operate) {
                <label for="facility-requests-is-internal" nzId="facility-requests-is-internal" nz-checkbox formControlName="is_internal">{{ 'FACILITY.INTERNAL_NOTE' | translate }}</label>
              }
              <span class="spacer"></span>
              <button nz-button nzType="primary" [disabled]="commentForm.invalid" (click)="sendComment()">{{ 'FACILITY.SEND' | translate }}</button>
            </div>
          </form>
        }
      </ng-container>
    </nz-drawer>

    <nz-modal appModalActions [(nzVisible)]="createVisible" [nzTitle]="(editingId() ? 'FACILITY.EDIT_REQUEST' : 'FACILITY.NEW_REQUEST') | translate" (nzOnCancel)="createVisible.set(false)" (nzOnOk)="create()" okAction="save" [nzOkDisabled]="createForm.invalid" nzWidth="640px">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="createForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.CATEGORY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="category">
                  @for (value of categories; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('FACILITY.CATEGORY_' + value) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.PRIORITY' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="slaHint()">
                <nz-select formControlName="priority">
                  @for (value of priorities; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('FACILITY.PRIORITY_' + value) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'FACILITY.TITLE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'FACILITY.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="3" formControlName="description" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.BUILDING' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="building_id" nzAllowClear>
                  @for (building of buildings(); track building.id) {
                    <nz-option [nzValue]="building.id" [nzLabel]="building.code + ' - ' + building.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.SPACE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="space_id" nzAllowClear nzShowSearch>
                  @for (space of spacesOfBuilding(); track space.id) {
                    <nz-option [nzValue]="space.id" [nzLabel]="space.code + ' - ' + space.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [nzVisible]="inputAction() !== null" [nzTitle]="inputTitle() | translate" (nzOnCancel)="inputAction.set(null)" (nzOnOk)="submitInput()" okAction="confirm" [nzOkDisabled]="inputInvalid()">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="inputForm" nzLayout="vertical">
          @if (inputAction() === 'assign') {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.ASSIGNEE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="assignee_id" nzShowSearch>
                  @for (user of users(); track user.id) {
                    <nz-option [nzValue]="user.id" [nzLabel]="user.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <button nz-button type="button" (click)="assignToMe()">{{ 'FACILITY.ASSIGN_TO_ME' | translate }}</button>
          } @else if (inputAction() === 'raise-work-order') {
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.ASSET_ID' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'FACILITY.ASSET_HINT' | translate"><input nz-input formControlName="text" /></nz-form-control>
            </nz-form-item>
          } @else {
            <nz-form-item>
              <nz-form-label nzRequired>{{ inputLabel() | translate }}</nz-form-label>
              <nz-form-control><textarea nz-input rows="3" formControlName="text" maxlength="4000"></textarea></nz-form-control>
            </nz-form-item>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class FacilityRequestsComponent implements OnInit {
  private readonly api = inject(FacilityApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authStore = inject(AuthStore);

  readonly columns = BOARD_COLUMNS;
  readonly categories = FACILITY_REQUEST_CATEGORIES;
  readonly priorities = FACILITY_REQUEST_PRIORITIES;
  readonly abilities = computed(() => facilityAbilities(this.authStore.activeRoles(), this.authStore.userPermissions()));
  readonly userId = computed(() => this.authStore.user()?.id ?? null);

  readonly requests = signal<FacilityServiceRequest[]>([]);
  readonly summary = signal<FacilityServiceRequestBoard | null>(null);
  readonly buildings = signal<FacilityBuilding[]>([]);
  readonly spaces = signal<FacilitySpace[]>([]);
  readonly users = signal<UserResource[]>([]);
  readonly comments = signal<FacilityRequestComment[]>([]);
  readonly selected = signal<FacilityServiceRequest | null>(null);
  readonly drawerVisible = signal(false);
  readonly createVisible = signal(false);
  /** Id of the request being edited, null while the modal creates a new one. */
  readonly editingId = signal<string | null>(null);
  readonly inputAction = signal<InputAction | null>(null);
  readonly category = signal<string | null>(null);
  readonly priority = signal<string | null>(null);
  readonly search = signal('');
  readonly onlyMine = signal(false);
  readonly selectedBuilding = signal<string | null>(null);

  readonly spacesOfBuilding = computed(() => this.spaces().filter((space) => this.selectedBuilding() === null || space.building_id === this.selectedBuilding()));

  readonly byStatus = computed(() => {
    const text = this.search().trim().toLowerCase();
    const filtered = this.requests().filter(
      (item) =>
        (this.category() === null || item.category === this.category()) &&
        (this.priority() === null || item.priority === this.priority()) &&
        (!this.onlyMine() || item.assignee_id === this.userId()) &&
        (text === '' || item.title.toLowerCase().includes(text) || item.number.toLowerCase().includes(text)),
    );

    return Object.fromEntries(BOARD_COLUMNS.map((column) => [column, filtered.filter((item) => item.status === column)])) as Record<FacilityRequestStatus, FacilityServiceRequest[]>;
  });

  readonly createForm = this.fb.group({
    category: ['cleaning' as FacilityServiceRequestRequest['category'], [Validators.required]],
    priority: ['normal' as NonNullable<FacilityServiceRequestRequest['priority']>],
    title: ['', [Validators.required, Validators.maxLength(190)]],
    description: [''],
    building_id: [''],
    space_id: [''],
  });

  readonly inputForm = this.fb.group({ text: [''], assignee_id: [''] });
  readonly commentForm = this.fb.group({ body: ['', [Validators.required, Validators.maxLength(4000)]], is_internal: [false] });

  readonly inputTitle = computed(() => `FACILITY.ACTION_${(this.inputAction() ?? 'cancel').toUpperCase().replace(/-/g, '_')}`);
  readonly inputLabel = computed(() => {
    switch (this.inputAction()) {
      case 'hold':
        return 'FACILITY.HOLD_REASON';
      case 'resolve':
        return 'FACILITY.RESOLUTION_NOTES';
      case 'link-work-order':
        return 'FACILITY.WORK_ORDER_ID';
      default:
        return 'FACILITY.REASON';
    }
  });

  readonly slaHint = computed(() => this.translate.instant('FACILITY.SLA_HINT'));

  constructor() {
    this.createForm.controls.building_id.valueChanges.pipe(takeUntilDestroyed()).subscribe((buildingId) => {
      this.selectedBuilding.set(buildingId || null);
      this.createForm.patchValue({ space_id: '' });
    });
  }

  ngOnInit(): void {
    this.load();
    this.api.getBuildings({ active: true, per_page: 100 }).subscribe({ next: (response) => this.buildings.set(response.data) });
    this.api.getSpaces({ active: true, per_page: 100 }).subscribe({ next: (response) => this.spaces.set(response.data) });
    if (this.abilities().operate) {
      this.settingsApi.getTenantUsers().subscribe({ next: (response) => this.users.set(response.data), error: () => this.users.set([]) });
    }
  }

  load(): void {
    this.api.getServiceRequests({ per_page: 100 }).subscribe({
      next: (response) => {
        const open = response.data.filter((item) => item.status !== 'closed' && item.status !== 'cancelled');
        this.requests.set(open);
        const current = this.selected();
        if (current) {
          this.selected.set(open.find((item) => item.id === current.id) ?? current);
        }
      },
      error: () => this.message.error(this.translate.instant('FACILITY.ACTION_ERROR')),
    });
    this.api.getServiceRequestBoard().subscribe({ next: (response) => this.summary.set(response.data) });
  }

  isOpen(request: FacilityServiceRequest): boolean {
    return ['new', 'assigned', 'in_progress', 'on_hold'].includes(request.status);
  }

  isOwn(request: FacilityServiceRequest): boolean {
    return request.requester_id !== null && request.requester_id === this.userId();
  }

  open(request: FacilityServiceRequest): void {
    this.selected.set(request);
    this.drawerVisible.set(true);
    this.loadComments(request.id);
  }

  openEdit(request: FacilityServiceRequest): void {
    this.editingId.set(request.id);
    this.selectedBuilding.set(request.building_id);
    this.createForm.reset({
      category: request.category,
      priority: request.priority,
      title: request.title,
      description: request.description ?? '',
      building_id: request.building_id ?? '',
      space_id: request.space_id ?? '',
    });
    this.createVisible.set(true);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.selectedBuilding.set(null);
    this.createForm.reset({ category: 'cleaning', priority: 'normal', title: '', description: '', building_id: '', space_id: '' });
    this.createVisible.set(true);
  }

  create(): void {
    const value = this.createForm.getRawValue();
    const payload: FacilityServiceRequestRequest = {
      category: value.category,
      priority: value.priority,
      title: value.title,
      description: value.description || null,
      building_id: value.building_id || null,
      space_id: value.space_id || null,
    };

    const editingId = this.editingId();
    const request$ = editingId ? this.api.updateServiceRequest(editingId, payload) : this.api.createServiceRequest(payload);

    request$.subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('FACILITY.REQUEST_SAVED'));
        this.createVisible.set(false);
        if (editingId) {
          this.selected.set(response.data);
        }
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  act(action: 'start' | 'close' | 'reopen'): void {
    this.send(action, {});
  }

  askInput(action: InputAction): void {
    this.inputForm.reset({ text: '', assignee_id: '' });
    this.inputAction.set(action);
  }

  assignToMe(): void {
    this.inputForm.patchValue({ assignee_id: this.userId() ?? '' });
    this.submitInput();
  }

  inputInvalid(): boolean {
    const value = this.inputForm.getRawValue();
    const action = this.inputAction();

    if (action === 'assign') {
      return value.assignee_id === '';
    }

    return action !== 'raise-work-order' && value.text.trim() === '';
  }

  submitInput(): void {
    const action = this.inputAction();
    const value = this.inputForm.getRawValue();

    if (action === null || this.inputInvalid()) {
      return;
    }

    const payloads: Record<InputAction, Record<string, unknown>> = {
      assign: { assignee_id: value.assignee_id },
      hold: { reason: value.text },
      cancel: { reason: value.text },
      resolve: { resolution_notes: value.text },
      'link-work-order': { work_order_id: value.text.trim() },
      'raise-work-order': { asset_id: value.text.trim() || null },
    };

    this.send(action, payloads[action]);
    this.inputAction.set(null);
  }

  sendComment(): void {
    const request = this.selected();
    if (!request) {
      return;
    }

    const value = this.commentForm.getRawValue();
    this.api.addRequestComment(request.id, { body: value.body, is_internal: value.is_internal }).subscribe({
      next: () => {
        this.commentForm.reset({ body: '', is_internal: false });
        this.loadComments(request.id);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  private send(action: 'assign' | 'start' | 'hold' | 'resolve' | 'close' | 'reopen' | 'cancel' | 'link-work-order' | 'raise-work-order', payload: Record<string, unknown>): void {
    const request = this.selected();
    if (!request) {
      return;
    }

    this.api.actOnServiceRequest(request.id, action, payload).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('FACILITY.REQUEST_UPDATED'));
        this.selected.set(response.data);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  private loadComments(id: string): void {
    this.api.getRequestComments(id).subscribe({ next: (response) => this.comments.set(response.data), error: () => this.comments.set([]) });
  }
}
