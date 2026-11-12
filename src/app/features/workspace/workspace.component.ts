import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import {
  AuthorizeWorkspaceRequest,
  WorkspaceApiService,
  WorkspaceCallbackRequest,
  WorkspaceConnectionResource,
  WorkspaceItemKind,
  WorkspaceItemResource,
  WorkspaceProvider,
  WorkspaceScope,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-workspace',
  styleUrl: './workspace.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    UpperCasePipe,
    NzTabsModule,
    NzCardModule,
    NzButtonModule,
    NzTagModule,
    NzTableModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSwitchModule,
    NzSelectModule,
    NzAlertModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './workspace.component.html',
})
export class WorkspaceComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly workspaceApi = inject(WorkspaceApiService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  readonly selectedTab = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  readonly isSyncing = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Connections
  readonly connections = signal<WorkspaceConnectionResource[]>([]);
  readonly googleConnection = computed(() =>
    this.connections().find((c) => c.provider === 'google' && !c.revoked_at)
  );
  readonly microsoftConnection = computed(() =>
    this.connections().find((c) => c.provider === 'microsoft' && !c.revoked_at)
  );

  // Synced items
  readonly items = signal<WorkspaceItemResource[]>([]);
  readonly itemFilterKind = signal<string>('all');
  readonly filteredItems = computed(() => {
    const kind = this.itemFilterKind();
    const list = this.items();
    if (kind === 'all') return list;
    return list.filter((i) => i.kind === kind);
  });

  // Modal states
  readonly isAuthorizeModalVisible = signal<boolean>(false);
  readonly isCallbackModalVisible = signal<boolean>(false);
  readonly selectedProvider = signal<WorkspaceProvider>('google');
  readonly isAuthorizing = signal<boolean>(false);

  // Authorize Form
  readonly authForm = this.fb.group({
    calendar: [true],
    mail: [true],
    consent: [false, [Validators.requiredTrue]],
  });

  // Callback Form
  readonly callbackForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(4096)]],
    state: ['', [Validators.required, Validators.maxLength(128)]],
  });

  ngOnInit(): void {
    this.loadConnections();
    this.loadItems();
  }

  loadConnections(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.workspaceApi.getConnections().subscribe({
      next: (res) => {
        this.connections.set(res.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossibile caricare le connessioni workspace.');
        this.isLoading.set(false);
      },
    });
  }

  loadItems(): void {
    const kindVal = this.itemFilterKind();
    const kind = kindVal !== 'all' ? (kindVal as WorkspaceItemKind) : undefined;

    this.workspaceApi.getItems({ kind, per_page: 50 }).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
      },
      error: () => {
        this.message.error(this.translate.instant('workspace.msgImpossibileCaricareGliElementiSincronizzati'));
      },
    });
  }

  openAuthorizeModal(provider: WorkspaceProvider): void {
    this.selectedProvider.set(provider);
    this.authForm.reset({
      calendar: true,
      mail: true,
      consent: false,
    });
    this.isAuthorizeModalVisible.set(true);
  }

  submitAuthorize(): void {
    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
      return;
    }

    const scopes: WorkspaceScope[] = [];
    if (this.authForm.controls.calendar.value) scopes.push('calendar');
    if (this.authForm.controls.mail.value) scopes.push('mail');

    if (scopes.length === 0) {
      this.message.warning(this.translate.instant('workspace.msgSelezionaAlmenoUnAmbitoDiSincronizzazione'));
      return;
    }

    this.isAuthorizing.set(true);
    const payload: AuthorizeWorkspaceRequest = {
      consent: true,
      scopes,
    };

    const provider = this.selectedProvider();
    this.workspaceApi.authorize(provider, payload).subscribe({
      next: (res) => {
        this.isAuthorizing.set(false);
        this.isAuthorizeModalVisible.set(false);
        const authUrl = res.data?.authorization_url;
        if (authUrl) {
          this.message.success(this.translate.instant('workspace.msgReindirizzamentoAllAutorizzazioneCloudInCorso'));
          // Open authorization window
          window.open(authUrl, '_blank', 'noopener,noreferrer');
        }
      },
      error: () => {
        this.isAuthorizing.set(false);
        this.message.error(this.translate.instant('workspace.msgErroreDuranteLAvvioDellAutorizzazione'));
      },
    });
  }

  openCallbackModal(provider: WorkspaceProvider): void {
    this.selectedProvider.set(provider);
    this.callbackForm.reset({ code: '', state: '' });
    this.isCallbackModalVisible.set(true);
  }

  submitCallback(): void {
    if (this.callbackForm.invalid) {
      this.callbackForm.markAllAsTouched();
      return;
    }

    const val = this.callbackForm.getRawValue();
    const payload: WorkspaceCallbackRequest = {
      code: val.code || '',
      state: val.state || '',
    };

    this.isAuthorizing.set(true);
    this.workspaceApi.callback(this.selectedProvider(), payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('workspace.msgConnessioneCloudCompletataConSuccesso'));
        this.isAuthorizing.set(false);
        this.isCallbackModalVisible.set(false);
        this.loadConnections();
        this.loadItems();
      },
      error: () => {
        this.isAuthorizing.set(false);
        this.message.error(this.translate.instant('workspace.msgCodiceOTokenDiAutorizzazioneNon'));
      },
    });
  }

  syncConnection(connection: WorkspaceConnectionResource): void {
    this.isSyncing.set(true);
    this.workspaceApi.sync(connection.id).subscribe({
      next: (res) => {
        this.isSyncing.set(false);
        const count = res.data?.items ?? 0;
        this.message.success(this.translate.instant('workspace.msgSincronizzazioneCompletataElementiAggiornati', { count }));
        this.loadConnections();
        this.loadItems();
      },
      error: () => {
        this.isSyncing.set(false);
        this.message.error(this.translate.instant('workspace.msgErroreDuranteLaSincronizzazione'));
      },
    });
  }

  revokeConnection(connection: WorkspaceConnectionResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('workspace.dlgDisconnettere', { value: connection.provider.toUpperCase() }),
      nzContent:
        this.translate.instant('workspace.dlgTuttiITokenDiAccessoE'),
      nzOkDanger: true,
      nzOkText: this.translate.instant('workspace.dlgRevocaAccesso'),
      nzOnOk: () => {
        this.workspaceApi.revoke(connection.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('workspace.msgConnessioneRevocataConSuccesso'));
            this.loadConnections();
          },
          error: () => this.message.error(this.translate.instant('workspace.msgImpossibileRevocareLaConnessione')),
        });
      },
    });
  }

  getItemKindColor(kind: string): string {
    return kind === 'calendar_event' ? 'blue' : 'green';
  }
}
