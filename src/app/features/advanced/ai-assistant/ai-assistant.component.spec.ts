import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { AssistantApiService } from '../../../core/api/assistant-api.service';
import { I18nService, TranslateService } from '../../../core/i18n';
import { icons } from '../../../icons-provider';
import { AiAssistantComponent } from './ai-assistant.component';
import {
  AssistantAnswer,
  AssistantCatalogueEntry,
  AssistantLogResource,
} from '../../../core/models';

describe('AiAssistantComponent', () => {
  let component: AiAssistantComponent;
  let fixture: ComponentFixture<AiAssistantComponent>;
  let mockAssistantApi: Partial<Record<keyof AssistantApiService, ReturnType<typeof vi.fn>>>;

  const mockCatalogue: AssistantCatalogueEntry[] = [
    { key: 'top_customers', description: 'Top 5 customers by sales volume' },
    { key: 'stock_shortage', description: 'Products below reorder threshold' },
  ];

  const mockLogs: AssistantLogResource[] = [
    {
      id: 'log-1',
      user_id: 'usr-1',
      role: 'admin',
      question: 'Show top 5 customers',
      resolver: 'catalogue',
      query_key: 'top_customers',
      outcome: 'answered',
      row_count: 5,
      created_at: '2026-11-09T10:00:00Z',
    },
    {
      id: 'log-2',
      user_id: 'usr-2',
      role: 'operator',
      question: 'What is company EBITDA?',
      resolver: 'role_guard',
      query_key: 'ebitda_summary',
      outcome: 'forbidden',
      row_count: 0,
      created_at: '2026-11-09T11:00:00Z',
    },
  ];

  const mockAnswer: AssistantAnswer = {
    outcome: 'answered',
    query: 'top_customers',
    description: 'Top 5 customers',
    parameters: { limit: 5 },
    rows: [
      { name: 'Acme Corp', total: 125000 },
      { name: 'Globex Inc', total: 98000 },
    ],
  };

  beforeEach(async () => {
    mockAssistantApi = {
      ask: vi.fn().mockReturnValue(of({ success: true, data: mockAnswer })),
      getCatalogue: vi.fn().mockReturnValue(of({ success: true, data: mockCatalogue })),
      getLogs: vi.fn().mockReturnValue(of({ success: true, data: mockLogs })),
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
      imports: [AiAssistantComponent],
      providers: [
        { provide: AssistantApiService, useValue: mockAssistantApi },
        { provide: TranslateService, useValue: translateMock },
        { provide: I18nService, useValue: translateMock },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiAssistantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load catalogue and logs', () => {
    expect(component).toBeTruthy();
    expect(mockAssistantApi.getCatalogue).toHaveBeenCalled();
    expect(mockAssistantApi.getLogs).toHaveBeenCalled();
    expect(component.catalogue().length).toBe(2);
    expect(component.logs().length).toBe(2);
  });

  it('should filter catalogue on search query', () => {
    expect(component.filteredCatalogue().length).toBe(2);

    const mockEvent = { target: { value: 'shortage' } } as unknown as Event;
    component.onCatalogueSearchChange(mockEvent);

    expect(component.filteredCatalogue().length).toBe(1);
    expect(component.filteredCatalogue()[0].key).toBe('stock_shortage');
  });

  it('should submit natural language question and display answered results', () => {
    component.askForm.patchValue({ question: 'Who are the top customers?' });
    component.onAskSubmit();

    expect(mockAssistantApi.ask).toHaveBeenCalledWith({ question: 'Who are the top customers?' });
    expect(component.currentAnswer()).toEqual(mockAnswer);
    expect(component.lastQuestion()).toBe('Who are the top customers?');
    expect(component.answerColumns()).toEqual(['name', 'total']);
  });

  it('should ask question from catalogue suggestion', () => {
    const entry = mockCatalogue[0];
    component.askCatalogueQuestion(entry);

    expect(component.askForm.controls.question.value).toBe(entry.description);
    expect(mockAssistantApi.ask).toHaveBeenCalled();
    expect(component.activeTabIndex()).toBe(0);
  });

  it('should open and close log detail drawer', () => {
    const log = mockLogs[0];
    component.openLogDrawer(log);

    expect(component.isLogDrawerVisible()).toBe(true);
    expect(component.selectedLog()).toEqual(log);

    component.closeLogDrawer();

    expect(component.isLogDrawerVisible()).toBe(false);
    expect(component.selectedLog()).toBeNull();
  });

  it('should return correct badge color for outcomes', () => {
    expect(component.getOutcomeColor('answered')).toBe('success');
    expect(component.getOutcomeColor('unmatched')).toBe('warning');
    expect(component.getOutcomeColor('forbidden')).toBe('error');
    expect(component.getOutcomeColor('failed')).toBe('default');
  });

  it('should filter logs by outcome', () => {
    component.logFilterForm.patchValue({ outcome: 'answered' });
    component.loadLogs();

    expect(mockAssistantApi.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'answered' })
    );
  });

  it('should handle API errors gracefully during ask', () => {
    mockAssistantApi.ask = vi.fn().mockReturnValue(throwError(() => new Error('Service down')));

    component.askForm.patchValue({ question: 'Test failing question' });
    component.onAskSubmit();

    expect(component.isAsking()).toBe(false);
    expect(component.errorMessage()).toBe('Service down');
  });

  it('should export answer as CSV when rows exist', () => {
    component.currentAnswer.set(mockAnswer);

    const createElementSpy = vi.spyOn(document, 'createElement');
    component.exportAnswerCsv();

    expect(createElementSpy).toHaveBeenCalledWith('a');
  });
});
