import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ContractDocumentVersionResource, ContractRegisterApiService, I18nService } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../icons-provider';
import { ContractRedlineComponent } from './redline.component';

const version = (n: number): ContractDocumentVersionResource => ({
  id: `v${n}`,
  contract_kind: 'customer',
  contract_id: 'c1',
  version_no: n,
  source: 'edit',
  body: `text ${n}`,
  body_hash: `h${n}`,
});

describe('ContractRedlineComponent', () => {
  let fixture: ComponentFixture<ContractRedlineComponent>;
  const api = {
    getDocumentVersions: vi.fn(),
    compareDocumentVersions: vi.fn(),
    getVersionComments: vi.fn(),
    addVersionComment: vi.fn(),
    resolveVersionComment: vi.fn(),
  };

  interface Internals {
    from: number | null;
    to: number | null;
    comments: () => { id: string; status: string }[];
    commentForm: { patchValue: (value: { body: string; line_number: number }) => void };
    compare: () => void;
    addComment: () => void;
    resolve: (comment: { id: string }) => void;
  }
  const internals = () => fixture.componentInstance as unknown as Internals;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getDocumentVersions.mockReturnValue(of({ data: [version(2), version(1)] }));
    api.compareDocumentVersions.mockReturnValue(
      of({
        data: {
          from: 1,
          to: 2,
          added: 1,
          removed: 1,
          lines: [
            { type: 'removed', text: 'old' },
            { type: 'added', text: 'new' },
          ],
        },
      }),
    );
    api.getVersionComments.mockReturnValue(of({ data: [] }));
    await TestBed.configureTestingModule({
      imports: [ContractRedlineComponent],
      providers: [
        { provide: ContractRegisterApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ kind: 'customer', id: 'c1' }) } } },
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLang: () => 'en', lang: () => 'en' } },
        provideNzIcons(icons),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ContractRedlineComponent);
    fixture.detectChanges();
  });

  it('preselects the two latest versions and shows the diff with its counters', () => {
    expect(api.getDocumentVersions).toHaveBeenCalledWith('customer', 'c1');
    expect(internals().from).toBe(1);
    expect(internals().to).toBe(2);

    internals().compare();
    fixture.detectChanges();

    expect(api.compareDocumentVersions).toHaveBeenCalledWith('customer', 'c1', 1, 2);
    expect(fixture.nativeElement.querySelectorAll('.redline-added').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.redline-removed').length).toBe(1);
    expect(api.getVersionComments).toHaveBeenCalledWith('v2');
  });

  it('adds a comment to the newer version and resolves it', () => {
    api.addVersionComment.mockReturnValue(of({ data: { id: 'k1', status: 'open', body: 'Check', document_version_id: 'v2' } }));
    api.resolveVersionComment.mockReturnValue(of({ data: { id: 'k1', status: 'resolved', body: 'Check', document_version_id: 'v2' } }));
    internals().compare();
    fixture.detectChanges();

    internals().commentForm.patchValue({ body: 'Check', line_number: 3 });
    internals().addComment();
    expect(api.addVersionComment).toHaveBeenCalledWith('v2', { body: 'Check', line_number: 3 });
    expect(internals().comments()).toHaveLength(1);

    internals().resolve({ id: 'k1' });
    expect(internals().comments()[0].status).toBe('resolved');
  });
});
