import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import {
  applyServerErrors,
  AssignTicketRequest,
  ChangeTicketStatusRequest,
  HelpdeskTicketActivityResource,
  HelpdeskTicketMessageResource,
  ResolveTicketRequest,
  serverErrorMessage,
  StoreTicketMessageRequest,
  TicketApiService,
  TicketPriority,
  TicketResource,
  TicketStatus,
  TicketType,
  UpdateHelpdeskTicketRequest,
} from '@core';

@Component({
  selector: 'app-ticket-detail-drawer',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzDrawerModule,
    NzTabsModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzTagModule,
    NzDescriptionsModule,
    NzTimelineModule,
    NzSpinModule,
    NzSpaceModule,
    NzModalModule,
    NzRadioModule,
    NzDividerModule,
    NzIconModule,
  ],
  templateUrl: './ticket-detail-drawer.component.html',
})
export class TicketDetailDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(TicketApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  readonly ticketId = input<string | null>(null);
  readonly open = model.required<boolean>();
  readonly updated = output<void>();

  protected readonly loading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly isPostingMessage = signal(false);
  protected readonly ticket = signal<TicketResource | null>(null);
  protected readonly messages = signal<HelpdeskTicketMessageResource[]>([]);
  protected readonly activities = signal<HelpdeskTicketActivityResource[]>([]);

  // Modals state
  protected readonly statusModalVisible = signal(false);
  protected readonly targetStatus = signal<TicketStatus>('open');
  protected readonly statusNote = signal('');

  protected readonly assignModalVisible = signal(false);
  protected readonly assignedUserId = signal('');
  protected readonly assignedTeamId = signal('');

  protected readonly resolveModalVisible = signal(false);
  protected readonly resolutionNotes = signal('');
  protected readonly rootCause = signal('');

  // Main edit form
  protected readonly form = this.fb.group({
    subject: this.fb.control<string>('', [Validators.required, Validators.maxLength(200)]),
    description: this.fb.control<string>(''),
    type: this.fb.control<TicketType>('incident'),
    priority: this.fb.control<TicketPriority>('medium'),
    impact: this.fb.control<'low' | 'medium' | 'high' | ''>('medium'),
    urgency: this.fb.control<'low' | 'medium' | 'high' | ''>('medium'),
    contact_name: this.fb.control<string>(''),
    contact_email: this.fb.control<string>('', [Validators.email, Validators.maxLength(180)]),
    contact_phone: this.fb.control<string>('', [Validators.maxLength(50)]),
  });

  // Reply message form
  protected readonly replyForm = this.fb.group({
    body: this.fb.control<string>('', [Validators.required, Validators.maxLength(20000)]),
    visibility: this.fb.control<'public' | 'internal'>('public'),
  });

  protected readonly statusColor = computed(() => {
    const s = this.ticket()?.status;
    switch (s) {
      case 'new':
        return 'cyan';
      case 'open':
        return 'blue';
      case 'pending_customer':
        return 'purple';
      case 'on_hold':
        return 'warning';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  });

  protected readonly priorityColor = computed(() => {
    const p = this.ticket()?.priority;
    switch (p) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'blue';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  });

  protected readonly slaColor = computed(() => {
    const s = this.ticket()?.sla_state;
    switch (s) {
      case 'ok':
        return 'success';
      case 'warning':
        return 'warning';
      case 'breached':
        return 'error';
      case 'paused':
        return 'default';
      default:
        return 'default';
    }
  });

  constructor() {
    effect(() => {
      const id = this.ticketId();
      const isOpen = this.open();
      if (isOpen && id) {
        this.loadTicket(id);
      }
    });
  }

  loadTicket(id: string): void {
    this.loading.set(true);
    this.api.getTicket(id).subscribe({
      next: (res) => {
        const t = res.data;
        this.ticket.set(t);
        this.form.patchValue({
          subject: t.subject || t.title || '',
          description: t.description || '',
          type: (t.type as TicketType) || 'incident',
          priority: t.priority || 'medium',
          impact: t.impact || 'medium',
          urgency: t.urgency || 'medium',
          contact_name: '',
          contact_email: t.contact_email || '',
          contact_phone: t.contact_phone || '',
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.message.error(err?.error?.detail || err?.message || 'Errore nel caricamento del ticket');
      },
    });

    this.api.getTicketMessages(id).subscribe({
      next: (res) => {
        this.messages.set(res.data || []);
      },
      error: () => {
        this.messages.set([]);
      },
    });

    this.api.getTicketActivities(id).subscribe({
      next: (res) => {
        this.activities.set(res.data || []);
      },
      error: () => {
        this.activities.set([]);
      },
    });
  }

  protected getErrorMessage(controlName: string): string | null {
    return serverErrorMessage(this.form, controlName);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected saveDetails(): void {
    const id = this.ticketId();
    if (!id || this.form.invalid) return;

    const val = this.form.getRawValue();
    const payload: UpdateHelpdeskTicketRequest = {
      subject: val.subject.trim(),
      description: val.description.trim() || undefined,
      type: val.type,
      priority: val.priority,
      impact: val.impact ? (val.impact as 'low' | 'medium' | 'high') : null,
      urgency: val.urgency ? (val.urgency as 'low' | 'medium' | 'high') : null,
      contact_name: val.contact_name.trim() || null,
      contact_email: val.contact_email.trim() || null,
      contact_phone: val.contact_phone.trim() || null,
    };

    this.isSaving.set(true);
    this.api.updateTicket(id, payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.ticket.set(res.data);
        this.message.success('Ticket aggiornato');
        this.updated.emit();
      },
      error: (err) => {
        this.isSaving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        if (unmapped.length > 0) {
          this.message.error(unmapped.join('; '));
        } else {
          this.message.error(err?.error?.detail || err?.message || 'Errore durante l\'aggiornamento');
        }
      },
    });
  }

  protected postReply(): void {
    const id = this.ticketId();
    if (!id || this.replyForm.invalid) return;

    const val = this.replyForm.getRawValue();
    const payload: StoreTicketMessageRequest = {
      body: val.body.trim(),
      visibility: val.visibility,
    };

    this.isPostingMessage.set(true);
    this.api.addTicketMessage(id, payload).subscribe({
      next: (res) => {
        this.isPostingMessage.set(false);
        this.replyForm.reset({ body: '', visibility: 'public' });
        this.messages.update((list) => [...list, res.data]);
        this.message.success('Messaggio inviato');
      },
      error: (err) => {
        this.isPostingMessage.set(false);
        this.message.error(err?.error?.detail || err?.message || 'Errore nell\'invio del messaggio');
      },
    });
  }

  // Action modals handlers
  protected openStatusModal(): void {
    const current = this.ticket()?.status || 'open';
    this.targetStatus.set(current);
    this.statusNote.set('');
    this.statusModalVisible.set(true);
  }

  protected confirmStatusChange(): void {
    const id = this.ticketId();
    if (!id) return;

    const payload: ChangeTicketStatusRequest = {
      status: this.targetStatus(),
      note: this.statusNote().trim() || null,
    };

    this.api.changeTicketStatus(id, payload).subscribe({
      next: (res) => {
        this.statusModalVisible.set(false);
        this.ticket.set(res.data);
        this.message.success('Stato del ticket aggiornato');
        this.loadTicket(id);
        this.updated.emit();
      },
      error: (err) => {
        this.message.error(err?.error?.detail || err?.message || 'Errore nel cambio di stato');
      },
    });
  }

  protected openAssignModal(): void {
    const t = this.ticket();
    this.assignedUserId.set(t?.assigned_to_id || '');
    this.assignedTeamId.set(t?.service_team_id || '');
    this.assignModalVisible.set(true);
  }

  protected confirmAssign(): void {
    const id = this.ticketId();
    if (!id || !this.assignedUserId().trim()) {
      this.message.warning('Inserisci l\'ID utente da assegnare');
      return;
    }

    const payload: AssignTicketRequest = {
      assigned_to_id: this.assignedUserId().trim(),
      service_team_id: this.assignedTeamId().trim() || null,
    };

    this.api.assignTicket(id, payload).subscribe({
      next: (res) => {
        this.assignModalVisible.set(false);
        this.ticket.set(res.data);
        this.message.success('Ticket assegnato con successo');
        this.loadTicket(id);
        this.updated.emit();
      },
      error: (err) => {
        this.message.error(err?.error?.detail || err?.message || 'Errore nell\'assegnazione');
      },
    });
  }

  protected openResolveModal(): void {
    this.resolutionNotes.set('');
    this.rootCause.set('');
    this.resolveModalVisible.set(true);
  }

  protected confirmResolve(): void {
    const id = this.ticketId();
    if (!id) return;

    const payload: ResolveTicketRequest = {
      resolution_notes: this.resolutionNotes().trim() || null,
      root_cause: this.rootCause().trim() || null,
    };

    this.api.resolveTicket(id, payload).subscribe({
      next: (res) => {
        this.resolveModalVisible.set(false);
        this.ticket.set(res.data);
        this.message.success('Ticket contrassegnato come risolto');
        this.loadTicket(id);
        this.updated.emit();
      },
      error: (err) => {
        this.message.error(err?.error?.detail || err?.message || 'Errore nella risoluzione');
      },
    });
  }

  protected confirmClose(): void {
    const id = this.ticketId();
    if (!id) return;

    this.modal.confirm({
      nzTitle: 'Conferma chiusura ticket',
      nzContent: 'Sei sicuro di voler chiudere definitivamente questo ticket?',
      nzOkText: 'Chiudi Ticket',
      nzOkDanger: true,
      nzOnOk: () => {
        this.api.closeTicket(id).subscribe({
          next: (res) => {
            this.ticket.set(res.data);
            this.message.success('Ticket chiuso con successo');
            this.loadTicket(id);
            this.updated.emit();
          },
          error: (err) => {
            this.message.error(err?.error?.detail || err?.message || 'Errore nella chiusura');
          },
        });
      },
    });
  }

  protected confirmReopen(): void {
    const id = this.ticketId();
    if (!id) return;

    this.modal.confirm({
      nzTitle: 'Riapri Ticket',
      nzContent: 'Vuoi riaprire questo ticket e riavviare la lavorazione?',
      nzOkText: 'Riapri',
      nzOnOk: () => {
        this.api.reopenTicket(id).subscribe({
          next: (res) => {
            this.ticket.set(res.data);
            this.message.success('Ticket riaperto');
            this.loadTicket(id);
            this.updated.emit();
          },
          error: (err) => {
            this.message.error(err?.error?.detail || err?.message || 'Errore nella riapertura');
          },
        });
      },
    });
  }
}
