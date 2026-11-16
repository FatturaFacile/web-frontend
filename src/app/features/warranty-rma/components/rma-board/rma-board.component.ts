import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { WarrantyStatus } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { RmaBoardStore } from '../../state/rma-board.store';
import {
  allowedRmaActions,
  estimateApprovalTag,
  RmaAction,
  rmaStatusLabelKey,
  rmaStatusTag,
  warrantyStatusTag,
} from '../../utils/rma-status';
import { RmaDetailDrawerComponent } from '../rma-detail-drawer/rma-detail-drawer.component';
import { StatusTagComponent } from '../shared/status-tag.component';

/**
 * Repair bench Kanban: one column per status with counts. Status changes need payloads, so cards
 * offer the legal actions as buttons (no drag-and-drop); every action goes through the detail drawer.
 */
@Component({
  selector: 'app-rma-board',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    PageHeaderComponent,
    TranslatePipe,
    StatusTagComponent,
    RmaDetailDrawerComponent,
  ],
  templateUrl: './rma-board.component.html',
  styleUrl: './rma-board.component.scss',
})
export class RmaBoardComponent implements OnInit {
  readonly store = inject(RmaBoardStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly drawerOpen = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly selectedAction = signal<RmaAction | null>(null);

  readonly warrantyOptions: WarrantyStatus[] = [
    'covered_in_warranty',
    'out_of_warranty_billable',
    'goodwill',
  ];

  readonly rmaStatusTag = rmaStatusTag;
  readonly rmaStatusLabelKey = rmaStatusLabelKey;
  readonly warrantyStatusTag = warrantyStatusTag;
  readonly estimateApprovalTag = estimateApprovalTag;
  readonly allowedRmaActions = allowedRmaActions;

  ngOnInit(): void {
    this.store.load();
    const rmaId = this.route.snapshot.queryParamMap.get('rma');
    if (rmaId) {
      this.openRma(rmaId);
    }
  }

  openRma(id: string, action: RmaAction | null = null): void {
    this.selectedAction.set(action);
    this.selectedId.set(id);
    // Re-trigger the drawer effect even when the same card is opened again.
    this.drawerOpen.set(false);
    queueMicrotask(() => this.drawerOpen.set(true));
  }

  onDrawerOpenChange(open: boolean): void {
    this.drawerOpen.set(open);
    if (!open && this.route.snapshot.queryParamMap.has('rma')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { rma: null },
        queryParamsHandling: 'merge',
      });
    }
  }
}
