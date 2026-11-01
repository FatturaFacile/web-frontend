import { Component, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TimeAttendanceStore } from '../state/time-attendance.store';

@Component({
  selector: 'app-time-attendance',
  imports: [
    DecimalPipe,
    NzCardModule,
    NzGridModule,
    NzButtonModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
    NzStatisticModule,
    NzAlertModule,
    NzSpinModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './time-attendance.component.html',
  styleUrl: './time-attendance.component.scss',
})
export class TimeAttendanceComponent implements OnInit {
  readonly store = inject(TimeAttendanceStore);

  ngOnInit(): void {
    this.store.loadData();
  }
}
