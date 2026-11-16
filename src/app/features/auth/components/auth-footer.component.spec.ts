import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { AuthFooterComponent } from './auth-footer.component';

describe('AuthFooterComponent', () => {
  it('shows copyright (from the API), version and the two legal documents', () => {
    TestBed.configureTestingModule({
      imports: [AuthFooterComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(AuthFooterComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // Texts come from the API: without a dictionary the keys show.
    expect(text).toContain('AUTH.COPYRIGHT');
    expect(text).toContain(fixture.componentInstance['version']);
    expect(fixture.nativeElement.querySelector('nav')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('nav > a, nav > span:not([aria-hidden])')).toHaveLength(2);
  });
});
