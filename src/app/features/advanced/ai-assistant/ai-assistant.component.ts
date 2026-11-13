import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { AssistantApiService } from '../../../core/api/assistant-api.service';
import {
  AskAssistantRequest,
  AssistantAnswer,
  AssistantCatalogueEntry,
  AssistantLogQueryParams,
  AssistantLogResource,
  AssistantOutcome,
} from '../../../core/models';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ModalActionsDirective, GridExportDirective, GridSortPipe } from '@shared';

@Component({
  selector: 'app-ai-assistant',
  styleUrl: './ai-assistant.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    ReactiveFormsModule,
    NzTabsModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzTableModule,
    NzTagModule,
    NzSpinModule,
    NzAlertModule,
    NzSelectModule,
    NzModalModule,
    ModalActionsDirective,
    NzFormModule,
    TranslatePipe,
  ],
  templateUrl: './ai-assistant.component.html',
})
export class AiAssistantComponent implements OnInit {
  private readonly assistantApi = inject(AssistantApiService);
  private readonly fb = inject(FormBuilder);

  // --- State Signals ---
  readonly activeTabIndex = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  readonly isAsking = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Catalogue & Logs
  readonly catalogue = signal<AssistantCatalogueEntry[]>([]);
  readonly catalogueSearch = signal<string>('');
  readonly logs = signal<AssistantLogResource[]>([]);
  readonly selectedLog = signal<AssistantLogResource | null>(null);
  readonly isLogDrawerVisible = signal<boolean>(false);

  // Latest Answer & Question
  readonly lastQuestion = signal<string>('');
  readonly currentAnswer = signal<AssistantAnswer | null>(null);

  // Form Controls
  readonly askForm = this.fb.group({
    question: ['', [Validators.required, Validators.maxLength(500)]],
  });

  readonly logFilterForm = this.fb.group({
    outcome: ['all'],
    per_page: [25],
  });

  // Filtered Catalogue
  readonly filteredCatalogue = computed(() => {
    const q = this.catalogueSearch().toLowerCase().trim();
    const list = this.catalogue();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.description.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q)
    );
  });

  // Dynamic columns for current answer table
  readonly answerColumns = computed<string[]>(() => {
    const ans = this.currentAnswer();
    if (!ans?.rows || ans.rows.length === 0) return [];
    return Object.keys(ans.rows[0]);
  });

  ngOnInit(): void {
    this.loadCatalogue();
    this.loadLogs();
  }

  loadCatalogue(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.assistantApi.getCatalogue().subscribe({
      next: (res) => {
        this.catalogue.set(res.data ?? []);
        this.isLoading.set(false);
      },
      error: (err: { message?: string }) => {
        this.errorMessage.set(err.message ?? 'Impossibile caricare il catalogo delle query.');
        this.isLoading.set(false);
      },
    });
  }

  loadLogs(): void {
    const outcomeVal = this.logFilterForm.controls.outcome.value;
    const perPageVal = this.logFilterForm.controls.per_page.value ?? 25;
    const params: AssistantLogQueryParams = {
      per_page: perPageVal,
      ...(outcomeVal && outcomeVal !== 'all' ? { outcome: outcomeVal as AssistantOutcome } : {}),
    };

    this.assistantApi.getLogs(params).subscribe({
      next: (res) => {
        this.logs.set(res.data ?? []);
      },
      error: (err: { message?: string }) => {
        this.errorMessage.set(err.message ?? 'Impossibile caricare i log delle richieste.');
      },
    });
  }

  onAskSubmit(): void {
    if (this.askForm.invalid) {
      this.askForm.markAllAsTouched();
      return;
    }

    const question = this.askForm.controls.question.value?.trim() ?? '';
    if (!question) return;

    this.isAsking.set(true);
    this.errorMessage.set(null);
    this.lastQuestion.set(question);

    const payload: AskAssistantRequest = { question };
    this.assistantApi.ask(payload).subscribe({
      next: (res) => {
        this.currentAnswer.set(res.data);
        this.isAsking.set(false);
        // Refresh logs so the latest question appears in audit
        this.loadLogs();
      },
      error: (err: { message?: string }) => {
        this.errorMessage.set(err.message ?? 'Errore durante la richiesta all assistente.');
        this.isAsking.set(false);
      },
    });
  }

  askCatalogueQuestion(entry: AssistantCatalogueEntry): void {
    this.askForm.patchValue({ question: entry.description });
    this.activeTabIndex.set(0);
    this.onAskSubmit();
  }

  onTextareaKeydown(event: Event): void {
    const kbEvent = event as KeyboardEvent;
    if (kbEvent.key === 'Enter' && (kbEvent.ctrlKey || kbEvent.metaKey)) {
      kbEvent.preventDefault();
      this.onAskSubmit();
    }
  }

  onCatalogueSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.catalogueSearch.set(input.value);
  }

  openLogDrawer(log: AssistantLogResource): void {
    this.selectedLog.set(log);
    this.isLogDrawerVisible.set(true);
  }

  closeLogDrawer(): void {
    this.isLogDrawerVisible.set(false);
    this.selectedLog.set(null);
  }

  getOutcomeColor(outcome: AssistantOutcome | string): string {
    switch (outcome) {
      case 'answered':
        return 'success';
      case 'unmatched':
        return 'warning';
      case 'forbidden':
        return 'error';
      case 'failed':
      default:
        return 'default';
    }
  }

  exportAnswerCsv(): void {
    const ans = this.currentAnswer();
    if (!ans?.rows || ans.rows.length === 0) return;

    const cols = this.answerColumns();
    const csvHeader = cols.join(',');
    const csvRows = ans.rows.map((row) =>
      cols
        .map((col) => {
          const val = row[col];
          const str = val !== null && val !== undefined ? String(val) : '';
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [csvHeader, ...csvRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `assistant_query_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
