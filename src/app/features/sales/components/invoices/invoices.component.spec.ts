import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { InvoicesComponent } from './invoices.component';

describe('InvoicesComponent', () => {
  it('is created with the services it injects', () => {
    TestBed.configureTestingModule({
      imports: [InvoicesComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    expect(TestBed.createComponent(InvoicesComponent).componentInstance).toBeTruthy();
  });
});
