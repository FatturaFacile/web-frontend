import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AppCanDirective } from './app-can.directive';
import { PermissionStore } from './permission.store';

@Component({
  imports: [AppCanDirective],
  template: `
    <button *appCan="key()" id="guarded">Approve</button>
    <span *appCan="['a.b.view', 'c.d.view']" id="any">Any</span>
  `,
})
class HostComponent {
  readonly key = signal('invoicing.invoices.approve');
}

describe('*appCan', () => {
  const granted = signal<string[]>([]);
  const fake = {
    hasAnyPermission: (keys: readonly string[]) => keys.some((k) => granted().includes(k)),
  };

  function render() {
    TestBed.configureTestingModule({ providers: [{ provide: PermissionStore, useValue: fake }] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing by default (deny by default)', () => {
    granted.set([]);
    const fixture = render();
    expect(fixture.nativeElement.querySelector('#guarded')).toBeNull();
    expect(fixture.nativeElement.querySelector('#any')).toBeNull();
  });

  it('renders the template while the permission is held and removes it when revoked', () => {
    granted.set(['invoicing.invoices.approve', 'c.d.view']);
    const fixture = render();
    expect(fixture.nativeElement.querySelector('#guarded')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#any')).not.toBeNull();

    granted.set([]);
    fixture.componentInstance.key.set('other.key.view');
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#guarded')).toBeNull();
  });
});
