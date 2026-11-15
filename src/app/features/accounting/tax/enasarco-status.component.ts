import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  Subscription,
} from 'rxjs';
import {
  ClientApiService,
  contactDisplayName,
  EnasarcoStatus,
  fiscalErrorCode,
  TaxApiService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TaxNavComponent } from './tax-nav.component';
import { reportYears } from './tax-report.utils';

/** ENASARCO year status towards one principal: commissions, ceiling and minimum shortfall (issue #286). */
@Component({
  selector: 'app-enasarco-status',
  imports: [
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DecimalPipe,
    NzAlertModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzSelectModule,
    NzSpinModule,
    PageHeaderComponent,
    TaxNavComponent,
    TranslatePipe,
  ],
  templateUrl: './enasarco-status.component.html',
  styleUrl: './tax-report.scss',
})
export class EnasarcoStatusComponent {
  private readonly api = inject(TaxApiService);
  private readonly clientApi = inject(ClientApiService);

  private readonly currentYear = new Date().getFullYear();
  protected readonly years = reportYears(this.currentYear);
  protected readonly year = signal(this.currentYear);
  protected readonly contactId = signal<string | null>(null);

  protected readonly status = signal<EnasarcoStatus | null>(null);
  protected readonly loading = signal(false);
  /** In-flight load: a newer filter cancels it so responses never arrive out of order. */
  private loadSub?: Subscription;
  /** `enasarco_rate_not_configured`: the year has no rate/ceiling, shown as a settings hint. */
  protected readonly rateMissing = signal(false);
  protected readonly failed = signal(false);

  protected readonly contactSearch = signal('');
  protected readonly contactOptions = toSignal(
    toObservable(this.contactSearch).pipe(
      debounceTime(250),
      distinctUntilChanged(),
      startWith(''),
      switchMap((search) =>
        this.clientApi.list({ search, per_page: 20 }).pipe(
          map((res) => res.data.map((c) => ({ label: contactDisplayName(c), value: c.id }))),
          catchError(() => of([])),
        ),
      ),
    ),
    { initialValue: [] },
  );

  protected setContact(id: string | null): void {
    this.contactId.set(id);
    this.load();
  }

  protected setYear(year: number): void {
    this.year.set(year);
    this.load();
  }

  load(): void {
    const contactId = this.contactId();
    this.status.set(null);
    this.rateMissing.set(false);
    this.failed.set(false);
    this.loading.set(false);
    this.loadSub?.unsubscribe();
    if (!contactId) {
      return;
    }
    this.loading.set(true);
    this.loadSub?.unsubscribe();
    this.loadSub = this.api.getEnasarcoStatus(contactId, this.year()).subscribe({
      next: (res) => {
        this.status.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (fiscalErrorCode(err) === 'enasarco_rate_not_configured') {
          this.rateMissing.set(true);
        } else {
          this.failed.set(true);
        }
      },
    });
  }
}
