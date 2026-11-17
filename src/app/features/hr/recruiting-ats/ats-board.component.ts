import { Component, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AtsBoard, AtsJobOpening, HrExtraApiService, I18nService } from '@core';
import { TranslatePipe } from '@shared';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../shared/hr-http.util';

/** Kanban of the candidates of a job opening, one column per pipeline stage. */
@Component({
  selector: 'app-ats-board',
  imports: [FormsModule, NzInputModule, NzSelectModule, NzTagModule, TranslatePipe],
  template: `
    <div class="filter-bar">
      <nz-select class="w-field-lg" nzShowSearch [nzPlaceHolder]="'hrmAts.opening' | translate" [ngModel]="openingId()" (ngModelChange)="select($event)">
        @for (o of openings(); track o.id) {
          <nz-option [nzValue]="o.id" [nzLabel]="o.reference + ' - ' + (o.position_title ?? '')" />
        }
      </nz-select>
      <input nz-input class="w-field-md" [placeholder]="'COMMON.SEARCH' | translate" [ngModel]="search()" (ngModelChange)="search.set($event); load()" />
    </div>
    @if (board(); as b) {
      <div class="board" role="list">
        @for (col of b.stages; track col.stage) {
          @if (col.enabled || col.count > 0) {
            <section class="column" role="listitem" [attr.aria-label]="col.label">
              <h4>{{ col.label }} <nz-tag>{{ col.count }}</nz-tag></h4>
              @for (card of col.applications; track card.id) {
                <button type="button" class="card" (click)="open.emit(card.id)">
                  <strong>{{ card.full_name }}</strong>
                  <span>{{ card.email }}</span>
                  @if (card.average_score !== null) {
                    <span>{{ 'hrmAts.averageScore' | translate }}: {{ card.average_score }}</span>
                  }
                  @if (card.skills.length) {
                    <span>{{ card.skills.slice(0, 4).join(', ') }}</span>
                  }
                </button>
              }
            </section>
          }
        }
      </div>
    }
  `,
  styles: `
    .board {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
    }
    .column {
      min-width: 240px;
      flex: 1 0 240px;
      background: var(--ant-color-fill-quaternary, #fafafa);
      border-radius: 8px;
      padding: 8px;
    }
    .card {
      display: flex;
      flex-direction: column;
      width: 100%;
      text-align: left;
      gap: 2px;
      margin-bottom: 8px;
      padding: 8px;
      border: 1px solid var(--ant-color-border, #d9d9d9);
      border-radius: 6px;
      background: var(--ant-color-bg-container, #fff);
      cursor: pointer;
    }
  `,
})
export class AtsBoardComponent implements OnInit {
  /** Openings the board can show (shared with the openings tab). */
  readonly selected = input<string | null>(null);
  readonly open = output<string>();

  private readonly api = inject(HrExtraApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly openings = signal<AtsJobOpening[]>([]);
  protected readonly openingId = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly board = signal<AtsBoard | null>(null);

  constructor() {
    effect(() => {
      const id = this.selected();
      if (id) {
        this.openingId.set(id);
      }
      this.load();
    });
  }

  ngOnInit(): void {
    this.api.listRecruitingJobOpenings().subscribe({
      next: (res) => {
        this.openings.set(res.data);
        if (!this.openingId() && res.data.length) {
          this.select(res.data[0].id);
        }
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected select(id: string): void {
    this.openingId.set(id);
    this.load();
  }

  load(): void {
    const id = this.openingId();
    if (!id) {
      return;
    }
    this.api.getRecruitingJobOpeningBoard(id, this.search() ? { search: this.search() } : undefined).subscribe({
      next: (res) => this.board.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
