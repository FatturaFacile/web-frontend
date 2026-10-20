import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { QrBill } from '@domain/models/qr-bill.model';
import { QrBillRepository } from '@domain/repositories/qr-bill.repository';
import { QrBillDto } from '../dtos/qr-bill.dto';
import { QrBillMapper } from '../mappers/qr-bill.mapper';

@Injectable()
export class QrBillHttpRepository implements QrBillRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/sales/qr-bills';

  getBills(): Observable<QrBill[]> {
    return this.http
      .get<QrBillDto[]>(this.baseUrl)
      .pipe(map((dtos) => dtos.map((dto) => QrBillMapper.toDomain(dto))));
  }

  createBill(bill: Omit<QrBill, 'id'>): Observable<QrBill> {
    const fullBill: QrBill = {
      ...bill,
      id: `qrb-${Date.now()}`,
    };
    const dto = QrBillMapper.toDto(fullBill);
    return this.http
      .post<QrBillDto>(this.baseUrl, dto)
      .pipe(map((res) => QrBillMapper.toDomain(res ?? dto)));
  }
}
