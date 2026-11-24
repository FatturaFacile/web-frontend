import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SdiHtmlPreviewComponent } from './sdi-html-preview.component';

@Component({
  imports: [SdiHtmlPreviewComponent],
  template: `<app-sdi-html-preview [content]="content()" />`,
})
class HostComponent {
  readonly content = signal<Blob | string | null>(null);
}

describe('SdiHtmlPreviewComponent', () => {
  const create = vi.fn();
  const revoke = vi.fn();
  let counter = 0;

  beforeEach(() => {
    counter = 0;
    create.mockReset().mockImplementation(() => `blob:sdi-${++counter}`);
    revoke.mockReset();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  afterEach(() => vi.restoreAllMocks());

  function frame(fixture: ComponentFixture<HostComponent>): HTMLIFrameElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="sdi-preview-frame"]');
  }

  it('renders no frame without content', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(frame(fixture)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the content in a fully sandboxed iframe loaded from an object URL', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set('<html><script>alert(1)</script></html>');
    fixture.detectChanges();

    const iframe = frame(fixture);
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('sandbox')).toBe('');
    expect(iframe?.getAttribute('src')).toBe('blob:sdi-1');
  });

  it('revokes the previous object URL when the content changes and when it is cleared', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set(new Blob(['a'], { type: 'text/html' }));
    fixture.detectChanges();
    fixture.componentInstance.content.set(new Blob(['b'], { type: 'text/html' }));
    fixture.detectChanges();
    expect(revoke).toHaveBeenCalledWith('blob:sdi-1');

    fixture.componentInstance.content.set(null);
    fixture.detectChanges();
    expect(revoke).toHaveBeenCalledWith('blob:sdi-2');
    expect(frame(fixture)).toBeNull();
  });
});
