import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MarginCalculatorComponent } from './margin-calculator.component';

describe('MarginCalculatorComponent', () => {
  let fixture: ComponentFixture<MarginCalculatorComponent>;
  let component: MarginCalculatorComponent;

  const form = () => component['form'];
  const result = () => component['result']();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarginCalculatorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MarginCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize the form with the default values', () => {
      expect(form().getRawValue()).toEqual({
        mode: 'from-price',
        cost: 60,
        price: 100,
        marginPercent: 40,
      });
    });

    it('should start in "from price" mode', () => {
      expect(component['isFromPrice']()).toBe(true);
    });

    it('should compute the default result (cost 60, price 100)', () => {
      expect(result().price).toBeCloseTo(100, 2);
      expect(result().margin).toBeCloseTo(40, 2);
      expect(result().marginPercent).toBeCloseTo(40, 2);
      expect(result().markupPercent).toBeCloseTo(66.67, 2);
    });
  });

  describe('form behaviour', () => {
    it('should be valid by default (no validators are defined)', () => {
      expect(form().valid).toBe(true);
    });

    it('should treat empty (null) cost and price as zero', () => {
      form().patchValue({ cost: null as unknown as number, price: null as unknown as number });
      expect(result()).toEqual({ price: 0, margin: 0, marginPercent: 0, markupPercent: 0 });
    });

    it('should return a zero margin percentage when the price is zero', () => {
      form().patchValue({ cost: 10, price: 0 });
      expect(result().margin).toBeCloseTo(-10, 2);
      expect(result().marginPercent).toBe(0);
    });

    it('should return a zero markup when the cost is zero', () => {
      form().patchValue({ cost: 0, price: 50 });
      expect(result().markupPercent).toBe(0);
      expect(result().marginPercent).toBeCloseTo(100, 2);
    });

    it('should report a negative margin when selling below cost', () => {
      form().patchValue({ cost: 100, price: 80 });
      expect(result().margin).toBeCloseTo(-20, 2);
      expect(result().marginPercent).toBeCloseTo(-25, 2);
      expect(result().markupPercent).toBeCloseTo(-20, 2);
    });
  });

  describe('"from price" mode', () => {
    it('should update the result instantly when the price changes', () => {
      form().controls.price.setValue(120);
      expect(result().margin).toBeCloseTo(60, 2);
      expect(result().marginPercent).toBeCloseTo(50, 2);
      expect(result().markupPercent).toBeCloseTo(100, 2);
    });

    it('should ignore the target margin field', () => {
      form().controls.marginPercent.setValue(90);
      expect(result().price).toBeCloseTo(100, 2);
    });
  });

  describe('"from margin" mode', () => {
    beforeEach(() => form().controls.mode.setValue('from-margin'));

    it('should expose isFromPrice as false', () => {
      expect(component['isFromPrice']()).toBe(false);
    });

    it('should derive the selling price from the target margin', () => {
      form().patchValue({ cost: 60, marginPercent: 40 });
      expect(result().price).toBeCloseTo(100, 2);
      expect(result().margin).toBeCloseTo(40, 2);
      expect(result().marginPercent).toBeCloseTo(40, 2);
    });

    it('should update the price instantly when the cost changes', () => {
      form().patchValue({ cost: 30, marginPercent: 50 });
      expect(result().price).toBeCloseTo(60, 2);
    });

    it('should return the cost as price at 0% margin', () => {
      form().patchValue({ cost: 80, marginPercent: 0 });
      expect(result().price).toBeCloseTo(80, 2);
      expect(result().margin).toBeCloseTo(0, 2);
    });

    it('should clamp the target margin to 99.99% to avoid division by zero', () => {
      form().patchValue({ cost: 10, marginPercent: 100 });
      expect(Number.isFinite(result().price)).toBe(true);
      expect(result().marginPercent).toBeCloseTo(99.99, 2);
    });

    it('should clamp a negative target margin to 0%', () => {
      form().patchValue({ cost: 50, marginPercent: -20 });
      expect(result().price).toBeCloseTo(50, 2);
    });

    it('should ignore the selling price field', () => {
      form().patchValue({ cost: 60, marginPercent: 40, price: 999 });
      expect(result().price).toBeCloseTo(100, 2);
    });
  });

  describe('template', () => {
    it('should switch between the selling price and target margin fields depending on the mode', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="margin-price"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="margin-percent"]')).toBeNull();

      form().controls.mode.setValue('from-margin');
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="margin-price"]')).toBeNull();
      expect(el.querySelector('[data-testid="margin-percent"]')).not.toBeNull();
    });

    it('should render the four result statistics', () => {
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('nz-statistic').length).toBe(4);
    });
  });
});
