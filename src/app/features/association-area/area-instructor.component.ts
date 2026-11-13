import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AssociationAreaApiService,
  AssociationAreaInstructorCourse,
  AssociationAreaParticipant,
  AssociationAttendanceEntry,
  I18nService,
} from '@core';
import { TranslatePipe, IconActionDirective, GridExportDirective, GridSortPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTableModule } from 'ng-zorro-antd/table';

/** Courses of an instructor: participants and the attendance sheet of a day. */
@Component({
  selector: 'app-area-instructor',
  styleUrl: './area-instructor.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    DatePipe, FormsModule, NzButtonModule, NzEmptyModule, NzRadioModule, NzTableModule, TranslatePipe],
  template: `
    @if (courses().length === 0) {
      <nz-empty [nzNotFoundContent]="'ASSOC_AREA.NO_COURSES' | translate" />
    } @else {
      <nz-table nzSize="small" [nzData]="courses()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th [nzSortFn]="'title' | gridSort">{{ 'ASSOC_AREA.COURSE' | translate }}</th>
            <th [nzSortFn]="'starts_on' | gridSort">{{ 'ASSOC_AREA.STARTS_ON' | translate }}</th>
            <th>{{ 'ASSOC_AREA.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (course of courses(); track course.id) {
            <tr>
              <td>{{ course.title }}</td>
              <td>{{ course.starts_on | date: 'mediumDate' }}</td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="open(course)">{{ 'ASSOC_AREA.ATTENDANCE' | translate }}</button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    @if (selected(); as course) {
      <section class="area-sheet" [attr.aria-label]="'ASSOC_AREA.ATTENDANCE' | translate">
        <h3>{{ course.title }}</h3>
        <label class="area-date">
          {{ 'ASSOC_AREA.DATE' | translate }}
          <input type="date" [ngModel]="day()" (ngModelChange)="day.set($event)" />
        </label>
        @for (participant of participants(); track participant.member_id) {
          <div class="area-row">
            <span>{{ participant.name }}</span>
            <nz-radio-group [ngModel]="status(participant.member_id)" (ngModelChange)="setStatus(participant.member_id, $event)">
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-radio nzValue="present">{{ 'ASSOC_AREA.PRESENT' | translate }}</label>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-radio nzValue="absent">{{ 'ASSOC_AREA.ABSENT' | translate }}</label>
            </nz-radio-group>
          </div>
        }
        <button nz-button nzType="primary" type="button" appIconAction="save" [nzLoading]="saving()" [disabled]="day() === ''" (click)="save(course.id)"></button>
      </section>
    }
  `,
})
export class AreaInstructorComponent implements OnInit {
  private readonly api = inject(AssociationAreaApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly courses = signal<AssociationAreaInstructorCourse[]>([]);
  protected readonly selected = signal<AssociationAreaInstructorCourse | null>(null);
  protected readonly participants = signal<AssociationAreaParticipant[]>([]);
  protected readonly statuses = signal<Record<string, AssociationAttendanceEntry['status']>>({});
  protected readonly day = signal(new Date().toISOString().slice(0, 10));
  protected readonly saving = signal(false);

  ngOnInit(): void {
    this.api.instructorCourses().subscribe({ next: (res) => this.courses.set(res.data), error: () => this.courses.set([]) });
  }

  protected open(course: AssociationAreaInstructorCourse): void {
    this.selected.set(course);
    this.api.instructorParticipants(course.id).subscribe((res) => {
      this.participants.set(res.data);
      this.statuses.set(Object.fromEntries(res.data.map((participant) => [participant.member_id, 'present' as const])));
    });
  }

  protected status(memberId: string): AssociationAttendanceEntry['status'] {
    return this.statuses()[memberId] ?? 'present';
  }

  protected setStatus(memberId: string, status: AssociationAttendanceEntry['status']): void {
    this.statuses.update((all) => ({ ...all, [memberId]: status }));
  }

  protected save(courseId: string): void {
    const entries: AssociationAttendanceEntry[] = this.participants().map((participant) => ({
      member_id: participant.member_id,
      status: this.status(participant.member_id),
    }));
    this.saving.set(true);
    this.api.recordInstructorAttendance(courseId, { date: this.day(), entries }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('ASSOC_AREA.ATTENDANCE_SAVED'));
      },
      error: () => {
        this.saving.set(false);
        this.message.error(this.i18n.translate('ASSOC_AREA.ATTENDANCE_FAILED'));
      },
    });
  }
}
