import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForeignTradeApiService, isCrossBorder } from '@core';
import { FOREIGN_TRADE_HUB_LINKS, ForeignTradeHubComponent } from './foreign-trade-hub.component';

describe('ForeignTradeHubComponent', () => {
  let fixture: ComponentFixture<ForeignTradeHubComponent>;
  const calculateCustomsValue = vi.fn();

  beforeEach(async () => {
    calculateCustomsValue.mockReset().mockReturnValue(
      of({
        success: true,
        data: { incoterm: 'EXW', goods_value: 1000, freight_added: 80, insurance_added: 20, customs_value: 1100, statistical_value: 1100 },
      }),
    );
    await TestBed.configureTestingModule({
      imports: [ForeignTradeHubComponent],
      providers: [provideRouter([]), { provide: ForeignTradeApiService, useValue: { calculateCustomsValue } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ForeignTradeHubComponent);
    fixture.detectChanges();
  });

  it('links the four foreign trade areas', () => {
    expect(FOREIGN_TRADE_HUB_LINKS.map((l) => l.route)).toEqual([
      '/customs/trade-compliance',
      '/customs/taric-codes',
      '/customs/setup',
      '/intrastat',
    ]);
    expect(fixture.nativeElement.querySelectorAll('a.hub-card').length).toBe(4);
  });

  it('calculates the customs value through the API', () => {
    fixture.componentInstance.form.patchValue({ incoterm: 'EXW', goods_value: 1000, freight: 80, insurance: 20 });
    fixture.componentInstance.calculate();
    fixture.detectChanges();

    expect(calculateCustomsValue).toHaveBeenCalledWith({ incoterm: 'EXW', goods_value: 1000, freight: 80, insurance: 20 });
    expect(fixture.componentInstance.result()?.customs_value).toBe(1100);
  });
});

describe('isCrossBorder', () => {
  it('is true only when both countries are known and differ', () => {
    expect(isCrossBorder('CH', 'IT')).toBe(true);
    expect(isCrossBorder('it', 'IT')).toBe(false);
    expect(isCrossBorder('IT', null)).toBe(false);
  });
});
