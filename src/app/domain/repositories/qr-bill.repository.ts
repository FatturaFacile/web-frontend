import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { QrBill } from '../models/qr-bill.model';

export interface QrBillRepository {
  getBills(): Observable<QrBill[]>;
}

export const QR_BILL_REPOSITORY = new InjectionToken<QrBillRepository>('QR_BILL_REPOSITORY');
