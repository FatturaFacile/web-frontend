import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import {
  I18nService,
  TranslateService,
  WorkspaceApiService,
  WorkspaceConnectionResource,
  WorkspaceItemResource,
} from '@core';
import { icons } from '../../icons-provider';
import { WorkspaceComponent } from './workspace.component';

describe('WorkspaceComponent', () => {
  let component: WorkspaceComponent;
  let fixture: ComponentFixture<WorkspaceComponent>;
  let mockWorkspaceApi: Partial<Record<keyof WorkspaceApiService, ReturnType<typeof vi.fn>>>;
  let mockMessage: Partial<Record<keyof NzMessageService, ReturnType<typeof vi.fn>>>;

  const mockGoogleConn: WorkspaceConnectionResource = {
    id: 'conn-g',
    provider: 'google',
    scopes: ['calendar', 'mail'],
    consent_given_at: '2026-11-01T10:00:00Z',
    last_synced_at: '2026-11-09T08:00:00Z',
  };

  const mockItems: WorkspaceItemResource[] = [
    {
      id: 'item-1',
      kind: 'calendar_event',
      subject: 'Planning riunione Q4',
      counterpart: 'info@partner.com',
      starts_at: '2026-11-10T10:00:00Z',
      ends_at: '2026-11-10T11:00:00Z',
    },
    {
      id: 'item-2',
      kind: 'email',
      subject: 'Richiesta preventivo',
      counterpart: 'cliente@azienda.it',
      starts_at: '2026-11-09T14:30:00Z',
    },
  ];

  beforeEach(async () => {
    mockWorkspaceApi = {
      getConnections: vi.fn().mockReturnValue(of({ data: [mockGoogleConn] })),
      authorize: vi.fn().mockReturnValue(of({ data: { authorization_url: 'https://oauth.google.com' } })),
      callback: vi.fn().mockReturnValue(of({ success: true })),
      sync: vi.fn().mockReturnValue(of({ data: { items: 5 } })),
      revoke: vi.fn().mockReturnValue(of({ success: true })),
      getItems: vi.fn().mockReturnValue(of({ data: mockItems })),
    };

    mockMessage = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    const translateMock = {
      instant: vi.fn((key: string) => key),
      translate: vi.fn((key: string) => key),
      currentLang: vi.fn().mockReturnValue('it'),
      get: vi.fn().mockReturnValue(of('')),
      onLangChange: of({ lang: 'it' }),
      currentLanguage: vi.fn().mockReturnValue('it'),
    };

    await TestBed.configureTestingModule({
      imports: [WorkspaceComponent],
      providers: [
        { provide: WorkspaceApiService, useValue: mockWorkspaceApi },
        { provide: NzMessageService, useValue: mockMessage },
        { provide: TranslateService, useValue: translateMock },
        { provide: I18nService, useValue: translateMock },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as unknown as { modal: { confirm: (opts: { nzOnOk?: () => void }) => NzModalRef } }).modal, 'confirm').mockImplementation(config => {
      if (config.nzOnOk) config.nzOnOk();
      return {} as NzModalRef;
    });
    fixture.detectChanges();
  });

  it('should initialize and load connections and synced items', () => {
    expect(component).toBeTruthy();
    expect(mockWorkspaceApi.getConnections).toHaveBeenCalled();
    expect(mockWorkspaceApi.getItems).toHaveBeenCalled();
    expect(component.connections().length).toBe(1);
    expect(component.googleConnection()).toEqual(mockGoogleConn);
    expect(component.microsoftConnection()).toBeUndefined();
    expect(component.items().length).toBe(2);
  });

  it('should filter synced items by kind', () => {
    expect(component.filteredItems().length).toBe(2);

    component.itemFilterKind.set('calendar_event');
    expect(component.filteredItems().length).toBe(1);
    expect(component.filteredItems()[0].kind).toBe('calendar_event');
  });

  it('should start OAuth authorization flow', () => {
    component.openAuthorizeModal('google');
    expect(component.isAuthorizeModalVisible()).toBe(true);

    component.authForm.patchValue({
      calendar: true,
      mail: true,
      consent: true,
    });

    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    component.submitAuthorize();

    expect(mockWorkspaceApi.authorize).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({
        consent: true,
        scopes: ['calendar', 'mail'],
      })
    );
    expect(component.isAuthorizeModalVisible()).toBe(false);
    expect(windowOpenSpy).toHaveBeenCalledWith('https://oauth.google.com', '_blank', 'noopener,noreferrer');
  });

  it('should complete OAuth connection with callback code and state', () => {
    component.openCallbackModal('google');
    expect(component.isCallbackModalVisible()).toBe(true);

    component.callbackForm.patchValue({
      code: 'code-xyz',
      state: 'state-abc',
    });

    component.submitCallback();
    expect(mockWorkspaceApi.callback).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({
        code: 'code-xyz',
        state: 'state-abc',
      })
    );
    expect(component.isCallbackModalVisible()).toBe(false);
  });

  it('should trigger sync on connection', () => {
    component.syncConnection(mockGoogleConn);
    expect(mockWorkspaceApi.sync).toHaveBeenCalledWith('conn-g');
    expect(mockMessage.success).toHaveBeenCalledWith(expect.stringContaining('5 elementi aggiornati'));
  });

  it('should revoke connection and reload', () => {
    component.revokeConnection(mockGoogleConn);
    expect(mockWorkspaceApi.revoke).toHaveBeenCalledWith('conn-g');
    expect(mockMessage.success).toHaveBeenCalledWith(expect.stringContaining('revocata con successo'));
  });

  it('should handle API errors gracefully during load', () => {
    mockWorkspaceApi.getConnections = vi.fn().mockReturnValue(throwError(() => new Error('Net error')));
    component.loadConnections();
    expect(component.errorMessage()).toBe('Impossibile caricare le connessioni workspace.');
  });
});
