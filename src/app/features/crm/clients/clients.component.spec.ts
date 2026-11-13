import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { ClientApiService, ContactResource, I18nService, TranslateService } from '@core';
import { ClientsComponent } from './clients.component';
import { ClientFacade } from '../services/client.facade';

describe('ClientsComponent', () => {
  let fixture: ComponentFixture<ClientsComponent>;
  let component: ClientsComponent;

  const mockContacts = [
    {
      id: 'c-1',
      type: 'client',
      company_name: 'Alpha SA',
      country: 'CH',
    },
  ] as unknown as ContactResource[];

  const mockClientApi = {
    list: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockContacts,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 15 },
      }),
    ),
    get: vi.fn().mockReturnValue(of({ success: true, data: mockContacts[0] })),
    create: vi.fn().mockReturnValue(of({ success: true, data: mockContacts[0] })),
    update: vi.fn().mockReturnValue(of({ success: true, data: mockContacts[0] })),
    delete: vi.fn().mockReturnValue(of({ success: true, data: null })),
  };

  const mockTranslate = {
    instant: vi.fn((k: string) => k),
    translate: vi.fn((k: string) => k),
    currentLanguage: signal('it'),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientsComponent],
      providers: [
        provideNzIcons(icons),
        ClientFacade,
        { provide: ClientApiService, useValue: mockClientApi },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: I18nService, useValue: mockTranslate },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsComponent);
    component = fixture.componentInstance;
  });

  it('initializes component successfully', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['drawerOpen']()).toBe(false);
    expect(component['selected']()).toBeNull();
  });

  it('opens drawer on create action', () => {
    fixture.detectChanges();
    component['create']();
    expect(component['drawerOpen']()).toBe(true);
    expect(component['selected']()).toBeNull();
  });

  it('opens drawer on edit action with selected contact', () => {
    fixture.detectChanges();
    component['edit'](mockContacts[0]);
    expect(component['drawerOpen']()).toBe(true);
    expect(component['selected']()).toEqual(mockContacts[0]);
  });

  it('deletes contact and shows success message', () => {
    fixture.detectChanges();
    component['delete'](mockContacts[0]);

    expect(mockClientApi.delete).toHaveBeenCalledWith('c-1');
    expect(mockMessage.success).toHaveBeenCalled();
  });
});
