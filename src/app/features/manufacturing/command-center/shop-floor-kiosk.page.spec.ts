import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { beforeEach, describe, expect, it } from 'vitest';
import { ShopFloorKioskComponent } from './shop-floor-kiosk.page';

const base = `${environment.apiBaseUrl}/manufacturing`;
const ORDER = {
  id: 'o1',
  order_number: 'PO-1',
  mfg_item_id: 'i',
  item_code: 'A',
  status: 'released',
  target_quantity: '10',
  completed_quantity: '0',
  scrapped_quantity: '0',
  uom: 'pcs',
  planned_start_date: '2026-03-02',
  planned_end_date: '2026-03-03',
};
const OPERATION = {
  id: 'op1', sequence: 10, operation_code: null, name: 'Turn', work_center_id: 'wc', status: 'pending', is_subcontracted: false,
  scheduled_date: null, planned_setup_minutes: '0', planned_run_minutes: '60', planned_labor_minutes: null,
  actual_setup_minutes: '0', actual_run_minutes: '0', completed_quantity: '0', scrapped_quantity: '0',
};

describe('ShopFloorKioskComponent', () => {
  let fixture: ComponentFixture<ShopFloorKioskComponent>;
  let http: HttpTestingController;

  const click = (testId: string): void => {
    (fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(ShopFloorKioskComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`${base}/production-orders?per_page=100&status=in_progress`).flush({ success: true, message: '', data: [], meta: {} });
    http.expectOne(`${base}/production-orders?per_page=100&status=released`).flush({ success: true, message: '', data: [ORDER], meta: {} });
    fixture.detectChanges();

    click('order-PO-1');
    http.expectOne(`${base}/production-orders/o1`).flush({ success: true, message: '', data: { ...ORDER, operations: [OPERATION] } });
    fixture.detectChanges();
    click('op-10');
  });

  it('only enables the booking once a quantity is counted and asks a reason for scrap', () => {
    const book = (): HTMLButtonElement => fixture.nativeElement.querySelector('[data-testid="book"]');
    expect(book().disabled).toBe(true);

    click('good-plus10');
    expect(fixture.nativeElement.querySelector('[data-testid="good"]').textContent.trim()).toBe('10');
    expect(book().disabled).toBe(false);

    click('scrap-plus');
    expect(book().disabled).toBe(true);
    click('reason-defect');
    expect(book().disabled).toBe(false);
  });

  it('keeps the posting uuid when the booking fails and is pressed again', () => {
    click('good-plus');
    click('book');
    const first = http.expectOne(`${base}/production-orders/o1/operations/op1/confirmations`);
    const uuid = first.request.body.operation_posting_uuid;
    first.flush({ message: 'offline' }, { status: 503, statusText: 'x' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="banner"]').textContent).toContain('offline');

    click('book');
    const retry = http.expectOne(`${base}/production-orders/o1/operations/op1/confirmations`);
    expect(retry.request.body.operation_posting_uuid).toBe(uuid);
    retry.flush({ success: true, message: '', data: { id: 'c1' } }, { status: 200, statusText: 'OK' });
    http.expectOne(`${base}/production-orders/o1`).flush({ success: true, message: '', data: { ...ORDER, operations: [OPERATION] } });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="good"]').textContent.trim()).toBe('0');
  });

  it('starts the operation on the server with the first start only', () => {
    click('start');
    http.expectOne(`${base}/shop-floor/executions`).flush({ success: true, message: '', data: { id: 'e1' } });
    click('pause');
    click('start');
    http.expectNone(`${base}/shop-floor/executions`);
  });
});
