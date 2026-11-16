import { TestBed } from '@angular/core/testing';
import { NzA11yPatchService } from './nz-a11y-patch.service';

describe('NzA11yPatchService', () => {
  let host: HTMLElement;
  let service: NzA11yPatchService;

  beforeEach(() => {
    service = TestBed.inject(NzA11yPatchService);
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  it('names the search input of a select from its aria-label', () => {
    host.innerHTML =
      '<nz-select aria-label="Status"><input class="ant-select-selection-search-input" /></nz-select>';
    service.patch(host);
    expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Status');
  });

  it('falls back to the placeholder and keeps an existing name', () => {
    host.innerHTML =
      '<nz-select><input class="ant-select-selection-search-input" /><span class="ant-select-selection-placeholder"> Type </span></nz-select>' +
      '<nz-select><input class="ant-select-selection-search-input" aria-label="Own" /></nz-select>';
    service.patch(host);
    const inputs = host.querySelectorAll('input');
    expect(inputs[0].getAttribute('aria-label')).toBe('Type');
    expect(inputs[1].getAttribute('aria-label')).toBe('Own');
  });

  it('makes a scrolling table without focusable content keyboard reachable', () => {
    host.innerHTML = '<div class="ant-table-content" style="overflow-x:auto"><table></table></div>';
    service.patch(host);
    const region = host.querySelector('.ant-table-content');
    expect(region?.getAttribute('tabindex')).toBe('0');
    expect(region?.getAttribute('role')).toBe('region');
  });

  it('leaves a table that already has focusable content alone', () => {
    host.innerHTML =
      '<div class="ant-table-content" style="overflow-x:auto"><a href="#">row</a></div>';
    service.patch(host);
    expect(host.querySelector('.ant-table-content')?.hasAttribute('tabindex')).toBe(false);
  });
});
