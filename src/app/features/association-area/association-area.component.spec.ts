import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { AssociationAreaApiService, I18nService } from '@core';
import { environment } from '@env';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssociationAreaComponent } from './association-area.component';

const ME = {
  roles: [],
  contact: { first_name: 'Anna', last_name: 'Rossi', email: 'anna@example.ch', phone: null },
  profile: { id: 'm-1', status: 'active', first_name: 'Anna', last_name: 'Rossi', is_minor: false },
  wards: [{ id: 'm-2', status: 'active', first_name: 'Luca', last_name: 'Rossi', is_minor: true }],
};

describe('AssociationAreaComponent', () => {
  let http: HttpTestingController;
  let api: AssociationAreaApiService;
  let navigate: ReturnType<typeof vi.fn>;
  const base = `${environment.apiBaseUrl}/association-area`;

  function create(token: string | null): ComponentFixture<AssociationAreaComponent> {
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [AssociationAreaComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(AssociationAreaApiService);
    return TestBed.createComponent(AssociationAreaComponent);
  }

  afterEach(() => http.verify());

  it('asks for the personal link when the token is missing', () => {
    const fixture = create(null);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ASSOC_AREA.MISSING_TOKEN');
  });

  it('keeps the token in memory, removes it from the address and loads the person', () => {
    const fixture = create('secret');
    fixture.detectChanges();
    expect(api.token()).toBe('secret');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { token: null }, replaceUrl: true }));

    const me = http.expectOne(`${base}/me`);
    expect(me.request.headers.get('X-Area-Token')).toBe('secret');
    me.flush({ data: ME });
    fixture.detectChanges();

    // The tab of the profile loads the card of the person.
    http.expectOne(`${base}/members/m-1/card`).flush({ data: { card_number: null, status: null } });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Anna Rossi');
    expect(text).toContain('Luca Rossi');
  });

  it('reports an invalid token', () => {
    const fixture = create('expired');
    fixture.detectChanges();
    http.expectOne(`${base}/me`).flush({ message: 'Unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ASSOC_AREA.INVALID_TOKEN');
  });

});
