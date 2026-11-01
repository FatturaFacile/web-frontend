import { Component, inject, OnInit, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { RetailApiService, RetailSession, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-retail',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './retail.component.html',
})
export class RetailComponent implements OnInit {
  private readonly api = inject(RetailApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sessions = signal<RetailSession[]>([]);

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getSessions().subscribe({
      next: (res) => {
        this.sessions.set(res?.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || this.translate.instant('retail.errors.loadFailed'));
        this.message.error(this.translate.instant('retail.errors.loadFailedDetail'));
        this.sessions.set([]);
        this.loading.set(false);
      },
    });
  }
}
