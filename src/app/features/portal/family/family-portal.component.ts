import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ChildcareFamilyApiService,
  FamilyAttendanceDay,
  FamilyChild,
  FamilyDailyReport,
  FamilyDocument,
  FamilyInvoice,
  FamilyMessage,
  I18nService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';

/** Guardian view of the childcare module: children, attendance, daily report, invoices, documents and messages. */
@Component({
  selector: 'app-family-portal',
  styleUrl: './family-portal.component.scss',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './family-portal.component.html',
})
export class FamilyPortalComponent {
  private readonly api = inject(ChildcareFamilyApiService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** The personal token lives in memory only; it is never stored or put in a URL. */
  private readonly token = signal('');

  protected readonly connected = computed(() => this.token() !== '');
  protected readonly loading = signal(false);
  protected readonly connectError = signal(false);

  protected readonly children = signal<FamilyChild[]>([]);
  protected readonly attendance = signal<FamilyAttendanceDay[]>([]);
  protected readonly dailyReport = signal<FamilyDailyReport | null>(null);
  protected readonly invoices = signal<FamilyInvoice[]>([]);
  protected readonly documents = signal<FamilyDocument[]>([]);
  protected readonly messages = signal<FamilyMessage[]>([]);
  protected readonly signingDocument = signal<FamilyDocument | null>(null);

  protected readonly tokenForm = this.fb.nonNullable.group({ token: ['', Validators.required] });
  protected readonly viewForm = this.fb.nonNullable.group({
    child_id: ['', Validators.required],
    month: [new Date().toISOString().slice(0, 7), [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
  });
  protected readonly messageForm = this.fb.nonNullable.group({
    child_id: ['', Validators.required],
    body: ['', [Validators.required, Validators.maxLength(5000)]],
  });
  protected readonly signForm = this.fb.nonNullable.group({
    signed_name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    accept: [false, Validators.requiredTrue],
  });

  protected childName(childId: string): string {
    const child = this.children().find((item) => item.id === childId);
    return child ? `${child.first_name} ${child.last_name}` : childId;
  }

  protected canSign(document: FamilyDocument): boolean {
    return document.has_file && document.signed_at === null;
  }

  protected connect(): void {
    if (this.tokenForm.invalid) {
      this.tokenForm.markAllAsTouched();
      return;
    }
    const token = this.tokenForm.getRawValue().token.trim();
    this.loading.set(true);
    this.connectError.set(false);
    this.api.getChildren(token).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.token.set(token);
        this.tokenForm.reset();
        this.children.set(res.data);
        const first = res.data[0]?.id ?? '';
        this.viewForm.patchValue({ child_id: first });
        this.messageForm.patchValue({ child_id: first });
        this.loadInvoices();
        this.loadDocuments();
        this.loadMessages();
        if (first) {
          this.loadChildView();
        }
      },
      error: () => {
        this.loading.set(false);
        this.connectError.set(true);
      },
    });
  }

  protected disconnect(): void {
    this.token.set('');
    this.children.set([]);
    this.attendance.set([]);
    this.dailyReport.set(null);
    this.invoices.set([]);
    this.documents.set([]);
    this.messages.set([]);
  }

  protected loadChildView(): void {
    if (this.viewForm.invalid) {
      this.viewForm.markAllAsTouched();
      return;
    }
    const { child_id, month, date } = this.viewForm.getRawValue();
    this.api.getAttendance(this.token(), child_id, month).subscribe({
      next: (res) => this.attendance.set(res.data),
      error: () => this.failed(),
    });
    this.api.getDailyReport(this.token(), child_id, date).subscribe({
      next: (res) => this.dailyReport.set(res.data),
      error: () => {
        this.dailyReport.set(null);
        this.failed();
      },
    });
  }

  protected mealsOf(report: FamilyDailyReport): string {
    return Array.isArray(report.meals) ? report.meals.join(', ') : report.meals;
  }

  protected download(document: FamilyDocument): void {
    this.api.downloadDocument(this.token(), document.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = document.title;
        anchor.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.failed(),
    });
  }

  protected openSign(document: FamilyDocument): void {
    this.signForm.reset({ signed_name: '', accept: false });
    this.signingDocument.set(document);
  }

  protected submitSign(): void {
    const document = this.signingDocument();
    if (!document || this.signForm.invalid) {
      this.signForm.markAllAsTouched();
      return;
    }
    this.api.signDocument(this.token(), document.id, { signed_name: this.signForm.getRawValue().signed_name.trim(), accept: true }).subscribe({
      next: (res) => {
        this.signingDocument.set(null);
        this.message.success(this.i18n.translate('FAMILY_PORTAL.SIGNED_OK'));
        this.documents.update((items) => items.map((item) => (item.id === res.data.id ? { ...item, ...res.data } : item)));
      },
      error: () => this.failed(),
    });
  }

  protected sendMessage(): void {
    if (this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }
    this.api.sendMessage(this.token(), this.messageForm.getRawValue()).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('FAMILY_PORTAL.MESSAGE_SENT'));
        this.messageForm.patchValue({ body: '' });
        this.messageForm.controls.body.markAsUntouched();
        this.loadMessages();
      },
      error: () => this.failed(),
    });
  }

  private loadInvoices(): void {
    this.api.getInvoices(this.token()).subscribe({ next: (res) => this.invoices.set(res.data), error: () => this.failed() });
  }

  private loadDocuments(): void {
    this.api.getDocuments(this.token()).subscribe({ next: (res) => this.documents.set(res.data), error: () => this.failed() });
  }

  private loadMessages(): void {
    this.api.getMessages(this.token()).subscribe({ next: (res) => this.messages.set(res.data), error: () => this.failed() });
  }

  private failed(): void {
    this.message.error(this.i18n.translate('FAMILY_PORTAL.ERROR'));
  }
}
