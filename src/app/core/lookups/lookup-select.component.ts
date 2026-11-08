import {
  Component,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { LookupService } from './lookup.service';
import { LookupItemDto } from './lookup.types';

@Component({
  selector: 'app-lookup-select',
  imports: [FormsModule, NzSelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LookupSelectComponent),
      multi: true,
    },
  ],
  templateUrl: './lookup-select.component.html',
})
export class LookupSelectComponent implements ControlValueAccessor {
  private readonly lookupService = inject(LookupService);

  readonly category = input.required<string>();
  readonly placeholder = input('Select an option');
  readonly allowClear = input(true);
  readonly showSearch = input(true);
  readonly showShortLabel = input(false);

  readonly items = signal<LookupItemDto[]>([]);
  readonly loading = signal<boolean>(false);

  selectedValue: string | null = null;
  disabled = false;

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      const cat = this.category();
      if (cat) {
        void this.loadItems(cat);
      }
    });
  }

  private async loadItems(cat: string): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.lookupService.getLookup(cat);
      this.items.set(data);
    } finally {
      this.loading.set(false);
    }
  }

  onSelectChange(value: string | null): void {
    this.selectedValue = value;
    this.onChange(value);
    this.onTouched();
  }

  // --- ControlValueAccessor Implementation ---

  writeValue(value: string | null): void {
    this.selectedValue = value;
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
