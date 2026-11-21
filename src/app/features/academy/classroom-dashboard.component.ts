import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AcademyStore } from './academy.store';

/** Classroom: create a cohort, join one with a code and, for teachers, follow the students of a cohort. */
@Component({
  selector: 'app-classroom-dashboard',
  imports: [
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzProgressModule,
  ],
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      font-weight: 600;
    }
    input {
      width: 100%;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid var(--border-color, #f0f0f0);
    }
  `,
  template: `
    <app-page-header
      [title]="'ACADEMY.CLASSROOM' | translate"
      [subtitle]="'ACADEMY.CLASSROOM_SUBTITLE' | translate"
    ></app-page-header>
    <p><a routerLink="/academy">{{ 'ACADEMY.BACK_TO_HUB' | translate }}</a></p>

    @if (cohortId()) {
      @if (forbidden()) {
        <p role="alert" data-testid="classroom-forbidden">{{ 'ACADEMY.FORBIDDEN' | translate }}</p>
      } @else if (store.dashboard(); as d) {
        <nz-card [nzTitle]="d.cohort.name">
          @if (d.cohort.join_code) {
            <p>
              {{ 'ACADEMY.JOIN_CODE' | translate }}: <strong>{{ d.cohort.join_code }}</strong>
            </p>
          }
          <table data-testid="classroom-students">
            <thead>
              <tr>
                <th scope="col">{{ 'ACADEMY.STUDENT' | translate }}</th>
                <th scope="col">{{ 'ACADEMY.PROGRESS' | translate }}</th>
                <th scope="col">{{ 'ACADEMY.XP' | translate }}</th>
                <th scope="col">{{ 'ACADEMY.CERTIFICATES' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (s of d.students; track s.user_id) {
                <tr>
                  <td>{{ s.name }}</td>
                  <td>
                    <nz-progress
                      [nzPercent]="
                        s.missions_total ? round((s.missions_completed / s.missions_total) * 100) : 0
                      "
                      nzSize="small"
                    ></nz-progress>
                    {{ s.missions_completed }} / {{ s.missions_total }}
                  </td>
                  <td>{{ s.total_xp }}</td>
                  <td>{{ s.certificates.length }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">{{ 'ACADEMY.NO_STUDENTS' | translate }}</td>
                </tr>
              }
            </tbody>
          </table>
        </nz-card>
      }
    } @else {
      <div class="grid">
        <nz-card [nzTitle]="'ACADEMY.CREATE_COHORT' | translate">
          <label for="cohort-name">{{ 'ACADEMY.COHORT_NAME' | translate }}</label>
          <input
            id="cohort-name"
            type="text"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
          />
          <label for="cohort-tracks">{{ 'ACADEMY.TRACKS' | translate }}</label>
          <select
            id="cohort-tracks"
            multiple
            (change)="selectTracks($event.target)"
            data-testid="cohort-tracks"
          >
            @for (t of store.tracks(); track t.id) {
              <option [value]="t.id">{{ t.title }}</option>
            }
          </select>
          <label for="cohort-due">{{ 'ACADEMY.DUE_DATE' | translate }}</label>
          <input
            id="cohort-due"
            type="date"
            [value]="dueDate()"
            (input)="dueDate.set($any($event.target).value)"
          />
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="store.busy() || !canCreate()"
            (click)="create()"
            data-testid="create-cohort"
          >
            {{ 'ACADEMY.CREATE_COHORT' | translate }}
          </button>
        </nz-card>
        <nz-card [nzTitle]="'ACADEMY.JOIN_COHORT' | translate">
          <label for="join-code">{{ 'ACADEMY.JOIN_CODE' | translate }}</label>
          <input
            id="join-code"
            type="text"
            [value]="joinCode()"
            (input)="joinCode.set($any($event.target).value)"
          />
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="store.busy() || !joinCode().trim()"
            (click)="join()"
            data-testid="join-cohort"
          >
            {{ 'ACADEMY.JOIN_COHORT' | translate }}
          </button>
        </nz-card>
      </div>
    }
  `,
})
export class ClassroomDashboardComponent implements OnInit {
  protected readonly store = inject(AcademyStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly cohortId = signal<string | null>(null);
  protected readonly forbidden = signal(false);
  protected readonly name = signal('');
  protected readonly dueDate = signal('');
  protected readonly joinCode = signal('');
  protected readonly selectedTracks = signal<string[]>([]);
  protected readonly round = Math.round;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.cohortId.set(id);
    if (id) {
      this.store.loadDashboard(id).subscribe({
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 403) {
            this.forbidden.set(true);
          } else {
            this.message.error(this.i18n.instant('ACADEMY.LOAD_ERROR'));
          }
        },
      });
    } else {
      this.store.loadTracks().subscribe({ error: () => undefined });
    }
  }

  protected canCreate(): boolean {
    return !!this.name().trim() && this.selectedTracks().length > 0 && !!this.dueDate();
  }

  protected selectTracks(target: EventTarget | null): void {
    const select = target as HTMLSelectElement;
    this.selectedTracks.set(Array.from(select.selectedOptions).map((o) => o.value));
  }

  protected create(): void {
    this.store
      .createCohort({
        name: this.name().trim(),
        track_ids: this.selectedTracks(),
        due_date: this.dueDate(),
      })
      .subscribe({
        next: (res) => void this.router.navigate(['/academy/classroom', res.data.id]),
        error: () => this.message.error(this.i18n.instant('ACADEMY.COHORT_ERROR')),
      });
  }

  protected join(): void {
    this.store.joinCohort(this.joinCode().trim()).subscribe({
      next: () => {
        this.message.success(this.i18n.instant('ACADEMY.JOINED'));
        this.joinCode.set('');
      },
      error: () => this.message.error(this.i18n.instant('ACADEMY.JOIN_ERROR')),
    });
  }
}
