import { Component, inject, OnInit, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { LegalCase, ProfessionalsApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-professionals',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './professionals.component.html',
})
export class ProfessionalsComponent implements OnInit {
  private readonly api = inject(ProfessionalsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly cases = signal<LegalCase[]>([]);

  ngOnInit(): void {
    this.loadCases();
  }

  loadCases(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getCases().subscribe({
      next: (res) => {
        this.cases.set(res?.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || this.translate.instant('cases.errors.loadFailed'));
        this.message.error(this.translate.instant('cases.errors.loadFailedDetail'));
        this.cases.set([]);
        this.loading.set(false);
      },
    });
  }
}
