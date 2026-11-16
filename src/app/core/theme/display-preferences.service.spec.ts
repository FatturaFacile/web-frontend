import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DisplayPreferencesService } from './display-preferences.service';

describe('DisplayPreferencesService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('defaults to compact density and the teal brand', () => {
    const service = TestBed.inject(DisplayPreferencesService);
    expect(service.density()).toBe('compact');
    expect(service.brand()).toBe('teal');
  });

  it('applies the preferences as attributes on <html> and persists them', () => {
    const service = TestBed.inject(DisplayPreferencesService);
    service.setDensity('comfortable');
    service.setBrand('indigo');
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-density')).toBe('comfortable');
    expect(document.documentElement.getAttribute('data-brand')).toBe('indigo');
    expect(localStorage.getItem('ff-density')).toBe('comfortable');
    expect(localStorage.getItem('ff-brand')).toBe('indigo');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem('ff-brand', 'neon');
    expect(TestBed.inject(DisplayPreferencesService).brand()).toBe('teal');
  });

  it('reset restores the defaults', () => {
    const service = TestBed.inject(DisplayPreferencesService);
    service.setDensity('comfortable');
    service.setBrand('amber');
    service.reset();
    expect(service.density()).toBe('compact');
    expect(service.brand()).toBe('teal');
  });
});
