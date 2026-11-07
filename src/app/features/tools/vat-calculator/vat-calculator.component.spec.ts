import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { VatCalculatorComponent } from './vat-calculator.component';

describe('VatCalculatorComponent', () => {
  let fixture: ComponentFixture<VatCalculatorComponent>;
  let component: VatCalculatorComponent;

  /** Protected members are reached through bracket access to keep the component API untouched. */
  const form = () => component['form'];
  const result = () => component['result']();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VatCalculatorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(VatCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize the form with the default values', () => {
      expect(form().getRawValue()).toEqual({ amount: 100, rate: 22, mode: 'net-to-gross' });
    });

    it('should expose the Italian VAT rates and both calculation modes', () => {
      expect(component['rates']).toEqual([22, 10, 5, 4, 0]);
      expect(component['modes'].map((m) => m.value)).toEqual(['net-to-gross', 'gross-to-net']);
    });

    it('should compute the default result (100 net + 22% VAT)', () => {
      expect(result().net).toBeCloseTo(100, 2);
      expect(result().vat).toBeCloseTo(22, 2);
      expect(result().gross).toBeCloseTo(122, 2);
    });
  });

  describe('form behaviour', () => {
    it('should be valid by default (no validators are defined)', () => {
      expect(form().valid).toBe(true);
    });

    it('should treat an empty (null) amount as zero', () => {
      form().controls.amount.setValue(null as unknown as number);
      expect(result()).toEqual({ net: 0, vat: 0, gross: 0 });
    });

    it('should not produce NaN when the rate is cleared', () => {
      form().controls.rate.setValue(null as unknown as number);
      expect(result().gross).toBeCloseTo(100, 2);
      expect(result().vat).toBeCloseTo(0, 2);
    });

    it('should propagate negative amounts without breaking (the UI input enforces min 0)', () => {
      form().controls.amount.setValue(-50);
      expect(result().net).toBeCloseTo(-50, 2);
      expect(result().gross).toBeCloseTo(-61, 2);
    });
  });

  describe('net to gross calculation', () => {
    it.each([
      { amount: 100, rate: 22, vat: 22, gross: 122 },
      { amount: 200, rate: 10, vat: 20, gross: 220 },
      { amount: 80, rate: 5, vat: 4, gross: 84 },
      { amount: 50, rate: 4, vat: 2, gross: 52 },
      { amount: 123.45, rate: 0, vat: 0, gross: 123.45 },
    ])('should add $rate% VAT to a net of $amount', ({ amount, rate, vat, gross }) => {
      form().patchValue({ amount, rate });
      expect(result().net).toBeCloseTo(amount, 2);
      expect(result().vat).toBeCloseTo(vat, 2);
      expect(result().gross).toBeCloseTo(gross, 2);
    });

    it('should update the result instantly when the rate changes', () => {
      form().controls.rate.setValue(10);
      expect(result().gross).toBeCloseTo(110, 2);
      form().controls.rate.setValue(4);
      expect(result().gross).toBeCloseTo(104, 2);
    });
  });

  describe('gross to net calculation', () => {
    beforeEach(() => form().controls.mode.setValue('gross-to-net'));

    it('should extract the VAT from a gross amount at 22%', () => {
      form().controls.amount.setValue(122);
      expect(result().gross).toBeCloseTo(122, 2);
      expect(result().net).toBeCloseTo(100, 2);
      expect(result().vat).toBeCloseTo(22, 2);
    });

    it('should extract the VAT from a gross amount at 10%', () => {
      form().patchValue({ amount: 110, rate: 10 });
      expect(result().net).toBeCloseTo(100, 2);
      expect(result().vat).toBeCloseTo(10, 2);
    });

    it('should return the gross untouched at 0% VAT', () => {
      form().patchValue({ amount: 75, rate: 0 });
      expect(result()).toEqual({ net: 75, vat: 0, gross: 75 });
    });

    it('should switch back to net-to-gross instantly', () => {
      form().controls.mode.setValue('net-to-gross');
      expect(result().gross).toBeCloseTo(122, 2);
    });
  });

  describe('template', () => {
    it('should render the three result statistics', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('nz-statistic').length).toBe(3);
    });

    it('should render the VAT rate select', () => {
      expect((fixture.nativeElement as HTMLElement).querySelector('nz-select')).not.toBeNull();
    });
  });
});
