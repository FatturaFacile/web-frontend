import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { EquipmentPassport } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { SerialLookupStore } from '../../state/serial-lookup.store';
import { rmaStatusTag, warrantyEvaluationTag } from '../../utils/rma-status';
import {
  PassportFormDialogComponent,
  PassportPrefill,
} from '../passport-list/passport-form-dialog.component';
import { RmaLabelDialogComponent } from '../shared/rma-label-dialog.component';
import { StatusTagComponent } from '../shared/status-tag.component';
import { IssueRmaDialogComponent } from './issue-rma-dialog.component';

/** Warranty check by serial number, with RMA issue and passport creation for unknown serials. */
@Component({
  selector: 'app-serial-lookup',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzInputModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
    StatusTagComponent,
    IssueRmaDialogComponent,
    RmaLabelDialogComponent,
    PassportFormDialogComponent,
  ],
  templateUrl: './serial-lookup.component.html',
  styles: `
    .lookup-input {
      max-width: 320px;
    }
    .lookup-alert,
    .lookup-card {
      margin-top: 16px;
    }
    .lookup-history-title {
      margin: 24px 0 8px;
      font-size: 16px;
    }
  `,
})
export class SerialLookupComponent {
  readonly store = inject(SerialLookupStore);

  readonly serial = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('serial') ?? '');
  readonly issueOpen = signal(false);
  readonly passportFormOpen = signal(false);

  readonly rmaStatusTag = rmaStatusTag;

  readonly warrantyTag = computed(() => {
    const result = this.store.result();
    return result ? warrantyEvaluationTag(result.warranty.status) : null;
  });

  readonly passportPrefill = computed<PassportPrefill>(() => {
    const hint = this.store.stockHint();
    return {
      serial_number: hint?.serial_number ?? this.store.serial(),
      stock_serial_number_id: hint?.stock_serial_number_id ?? null,
      product_id: hint?.product_id ?? null,
    };
  });

  constructor() {
    if (this.serial()) {
      void this.store.lookup(this.serial());
    }
  }

  search(): void {
    void this.store.lookup(this.serial());
  }

  onPassportCreated(passport: EquipmentPassport): void {
    this.serial.set(passport.serial_number);
    void this.store.lookup(passport.serial_number);
  }
}
