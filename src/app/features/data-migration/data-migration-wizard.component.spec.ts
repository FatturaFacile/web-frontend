import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { I18nService } from '@core';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataMigrationWizardComponent } from './data-migration-wizard.component';

describe('DataMigrationWizardComponent', () => {
  let fixture: ComponentFixture<DataMigrationWizardComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataMigrationWizardComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: I18nService,
          useValue: {
            dictionaryLocale: () => 'it-CH',
            translate: (key: string) => key,
            instant: (key: string) => key,
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DataMigrationWizardComponent);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/metadata`).flush({
      success: true,
      data: {
        connectors: [
          {
            code: 'FattureInCloud',
            name_key: 'dataMigration.connector.FattureInCloud.name',
            description_key: 'dataMigration.connector.FattureInCloud.description',
            jurisdiction: 'IT',
            default_currency: 'EUR',
            supported_extensions: ['csv', 'xlsx', 'xml'],
            default_entities: ['Customers'],
            default_transformations: { date_format: 'd/m/Y', decimal_separator: ',', currency_default: 'EUR' },
          },
        ],
        entities: [
          {
            code: 'Customers',
            label_key: 'dataMigration.entity.Customers',
            fields: [{ field: 'company_name', required: true, type: 'string', sample: 'Acme Srl', label_key: 'dataMigration.field.company_name' }],
          },
        ],
        templates: [],
        supported_locales: ['it-CH', 'de-CH', 'fr-CH', 'en', 'it-IT'],
      },
    });
    httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/jobs`).flush({
      success: true,
      data: [],
    });

    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders 5-step wizard and backend-seeded connector keys', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('dataMigration.step.1.title');
    expect(el.textContent).toContain('dataMigration.step.5.title');
    expect(el.textContent).toContain('dataMigration.connector.FattureInCloud.name');
  });
});
