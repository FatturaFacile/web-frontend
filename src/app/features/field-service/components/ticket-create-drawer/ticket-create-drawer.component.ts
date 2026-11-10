import { Component, inject, model, output, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import {
  applyServerErrors,
  serverErrorMessage,
  StoreTicketRequest,
  TicketApiService,
  TicketChannel,
  TicketPriority,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-ticket-create-drawer',
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzSpaceModule,
  ],
  templateUrl: './ticket-create-drawer.component.html',
})
export class TicketCreateDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(TicketApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly open = model.required<boolean>();
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);

  protected readonly form = this.fb.group({
    title: this.fb.control<string>('', [Validators.required, Validators.maxLength(200)]),
    description: this.fb.control<string>(''),
    priority: this.fb.control<TicketPriority>('medium'),
    channel: this.fb.control<TicketChannel>('portal'),
    impact: this.fb.control<'low' | 'medium' | 'high' | ''>('medium'),
    urgency: this.fb.control<'low' | 'medium' | 'high' | ''>('medium'),
    contact_email: this.fb.control<string>('', [Validators.email, Validators.maxLength(180)]),
    contact_phone: this.fb.control<string>('', [Validators.maxLength(50)]),
    tags: this.fb.control<string[]>([]),
  });

  protected getErrorMessage(controlName: string): string | null {
    return serverErrorMessage(this.form, controlName);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected submit(): void {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((ctrl) => {
        ctrl.markAsDirty();
        ctrl.updateValueAndValidity();
      });
      return;
    }

    const val = this.form.getRawValue();
    const payload: StoreTicketRequest = {
      title: val.title.trim(),
      description: val.description.trim() || null,
      priority: val.priority || null,
      channel: val.channel || null,
      impact: val.impact ? (val.impact as 'low' | 'medium' | 'high') : null,
      urgency: val.urgency ? (val.urgency as 'low' | 'medium' | 'high') : null,
      contact_email: val.contact_email.trim() || null,
      contact_phone: val.contact_phone.trim() || null,
      tags: val.tags.length > 0 ? val.tags : null,
    };

    this.isSaving.set(true);
    this.api.createTicket(payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.message.success(res?.message || this.translate.instant('ticketCreateDrawer.msgTicketCreatoConSuccesso'));
        this.form.reset({
          title: '',
          description: '',
          priority: 'medium',
          channel: 'portal',
          impact: 'medium',
          urgency: 'medium',
          contact_email: '',
          contact_phone: '',
          tags: [],
        });
        this.open.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.isSaving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        if (unmapped.length > 0) {
          this.message.error(unmapped.join('; '));
        } else if (!err?.status || err.status !== 422) {
          this.message.error(err?.error?.detail || err?.message || this.translate.instant('ticketCreateDrawer.msgErroreNellaCreazioneDelTicket'));
        }
      },
    });
  }
}
