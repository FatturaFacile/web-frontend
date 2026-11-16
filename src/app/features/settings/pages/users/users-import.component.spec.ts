import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessApiService, SettingsApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { IMPORT_TEMPLATE, UsersImportComponent } from './users-import.component';

const dryRun = {
  dry_run: true,
  total: 3,
  created: 0,
  invited: 0,
  skipped: 1,
  errors: 1,
  rows: [
    { line: 2, email: 'a@example.test', status: 'would_add', message: null },
    { line: 3, email: 'b@example.test', status: 'skipped', message: 'Already a member' },
    { line: 4, email: 'bad', status: 'error', message: 'Invalid email' },
  ],
};
const real = { ...dryRun, dry_run: false, created: 1, rows: dryRun.rows.map((row) => (row.status === 'would_add' ? { ...row, status: 'created' } : row)) };

interface Page {
  file(): File | null;
  report(): { dry_run: boolean } | null;
  canConfirm(): boolean;
  onFile(event: Event): void;
  run(dryRun: boolean): void;
  downloadTemplate(): void;
}

describe('UsersImportComponent', () => {
  const api = { importUsers: vi.fn(), getLimits: vi.fn() };
  const settingsApi = { getAccessOptions: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };
  const csv = new File([IMPORT_TEMPLATE], 'users.csv', { type: 'text/csv' });

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: AccessApiService, useValue: api },
        { provide: SettingsApiService, useValue: settingsApi },
        { provide: NzMessageService, useValue: message },
      ],
    });
    const fixture = TestBed.createComponent(UsersImportComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as Page;
    const pick = (file: File | null): void => page.onFile({ target: { files: { item: () => file } } } as unknown as Event);
    return { page, fixture, pick };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getLimits.mockReturnValue(of({ success: true, message: '', data: { plan_code: 'starter', max_users: null, active_users: 1, pending_invitations: 0, max_custom_roles: null, custom_roles: 0 } }));
    settingsApi.getAccessOptions.mockReturnValue(of({ success: true, message: '', data: { roles: ['member'], modules: [], levels: [] } }));
  });

  it('offers a template with the columns email;name;role;team', () => {
    expect(IMPORT_TEMPLATE.split('\n')[0]).toBe('email;name;role;team');
    const createUrl = vi.fn().mockReturnValue('blob:x');
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { page } = setup();

    page.downloadTemplate();

    expect(createUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('cannot check or confirm before a file is chosen', () => {
    const { fixture, page } = setup();

    expect((fixture.nativeElement.querySelector('[data-test="check-import"]') as HTMLButtonElement).disabled).toBe(true);
    expect(page.canConfirm()).toBe(false);
  });

  it('checks the file first (dry run) and shows the report of every row, then confirms the real import', () => {
    api.importUsers.mockReturnValueOnce(of({ success: true, message: '', data: dryRun })).mockReturnValueOnce(of({ success: true, message: '', data: real }));
    const { page, fixture, pick } = setup();

    pick(csv);
    expect(page.canConfirm()).toBe(false);

    page.run(true);
    fixture.detectChanges();
    expect(api.importUsers).toHaveBeenLastCalledWith(csv, true, 'member');
    expect(fixture.nativeElement.querySelectorAll('[data-test="import-row"]').length).toBe(3);
    expect(page.canConfirm()).toBe(true);
    expect(message.success).not.toHaveBeenCalled();

    page.run(false);
    fixture.detectChanges();
    expect(api.importUsers).toHaveBeenLastCalledWith(csv, false, 'member');
    expect(page.report()?.dry_run).toBe(false);
    expect(page.canConfirm()).toBe(false);
    expect(message.success).toHaveBeenCalled();
  });

  it('drops the report when another file is chosen', () => {
    api.importUsers.mockReturnValue(of({ success: true, message: '', data: dryRun }));
    const { page, pick } = setup();

    pick(csv);
    page.run(true);
    pick(new File(['x'], 'other.csv'));

    expect(page.report()).toBeNull();
    expect(page.canConfirm()).toBe(false);
  });

  it('shows the reason when the API refuses the file', () => {
    api.importUsers.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'The file must be a CSV.' } })));
    const { page, fixture, pick } = setup();

    pick(csv);
    page.run(true);
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('[data-test="import-error"]') as HTMLElement).textContent).toContain('The file must be a CSV.');
    expect(page.report()).toBeNull();
  });

  it('shows the plan limit message when the real import is refused with 409', () => {
    api.importUsers.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'Plan limit reached', detail: 'At most 5 users.' } })),
    );
    const { page, pick } = setup();

    pick(csv);
    page.run(false);

    expect(message.error).toHaveBeenCalledWith('Plan limit reached: At most 5 users.');
  });
});
