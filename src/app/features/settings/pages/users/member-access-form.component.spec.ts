import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MemberAccessFormComponent } from './member-access-form.component';

interface Form {
  setLevel(module: string, level: string): void;
  submit(): void;
}

describe('MemberAccessFormComponent', () => {
  function setup(inputs: Record<string, unknown>): {
    form: Form;
    fixture: ReturnType<typeof TestBed.createComponent<MemberAccessFormComponent>>;
    emitted: object[];
  } {
    const fixture = TestBed.createComponent(MemberAccessFormComponent);
    fixture.componentRef.setInput('roles', ['member', 'admin']);
    fixture.componentRef.setInput('modules', ['crm', 'treasury']);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    const emitted: object[] = [];
    fixture.componentInstance.saved.subscribe((payload) => emitted.push(payload));
    fixture.detectChanges();
    return { form: fixture.componentInstance as unknown as Form, fixture, emitted };
  }

  it('shows a row for every module', () => {
    const { fixture } = setup({});

    expect(fixture.nativeElement.querySelectorAll('[data-test="module-row"]').length).toBe(2);
  });

  it('emits the role and a level for every module, defaulting the untouched ones', () => {
    const { form, emitted } = setup({ initialRole: 'admin', initialModules: { crm: 'blocked' } });

    form.setLevel('treasury', 'read');
    form.submit();

    expect(emitted).toEqual([{ role: 'admin', modules: { crm: 'blocked', treasury: 'read' } }]);
  });

  it('clears a module by setting it back to the default level', () => {
    const { form, emitted } = setup({ initialModules: { crm: 'blocked' } });

    form.setLevel('crm', 'default');
    form.submit();

    expect(emitted[0]).toEqual({ role: 'member', modules: { crm: 'default', treasury: 'default' } });
  });

  it('asks for the email only when adding and cannot save without it', () => {
    const { fixture } = setup({ showEmail: true });
    const button = fixture.nativeElement.querySelector('[data-test="save-member"]') as HTMLButtonElement;

    expect(fixture.nativeElement.querySelector('#ma-email')).not.toBeNull();
    expect(button.disabled).toBe(true);
  });
});
