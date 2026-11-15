import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormArray, NonNullableFormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { createLineGroup, DocumentLinesEditorComponent, LineGroup } from './document-lines-editor.component';

describe('DocumentLinesEditorComponent', () => {
  async function render() {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DocumentLinesEditorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fb = TestBed.inject(NonNullableFormBuilder);
    const lines = new FormArray<LineGroup>([createLineGroup(fb)]);
    const fixture = TestBed.createComponent(DocumentLinesEditorComponent);
    fixture.componentRef.setInput('lines', lines);
    fixture.detectChanges();
    for (const request of TestBed.inject(HttpTestingController).match(() => true)) {
      if (request.request.url.endsWith('.svg')) {
        request.flush('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
        continue;
      }
      request.flush(request.request.url.includes('/translations/') ? { translations: {} } : { success: true, message: '', data: [], meta: { total: 0 } });
    }
    fixture.detectChanges();
    return { fixture, lines };
  }

  it('adds a line with the default quantity and tax rate', async () => {
    const { fixture, lines } = await render();

    fixture.componentInstance.add();
    fixture.detectChanges();

    expect(lines.length).toBe(2);
    expect(lines.at(1).controls.tax_rate.value).toBe('22');
    expect(lines.at(1).controls.quantity.value).toBe('1');
  });

  it('never removes the last remaining line', async () => {
    const { fixture, lines } = await render();

    fixture.componentInstance.remove(0);
    expect(lines.length).toBe(1);

    fixture.componentInstance.add();
    fixture.componentInstance.remove(0);
    expect(lines.length).toBe(1);
  });
});
