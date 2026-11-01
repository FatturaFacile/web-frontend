import { Component, inject, OnInit, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { FieldServiceApiService, FieldServiceTicket, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-field-service',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './field-service.component.html',
})
export class FieldServiceComponent implements OnInit {
  private readonly api = inject(FieldServiceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly tickets = signal<FieldServiceTicket[]>([]);

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getTickets().subscribe({
      next: (res) => {
        this.tickets.set(res?.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || this.translate.instant('fieldService.errors.loadFailed'));
        this.message.error(this.translate.instant('fieldService.errors.loadFailedDetail'));
        this.tickets.set([]);
        this.loading.set(false);
      },
    });
  }
}
