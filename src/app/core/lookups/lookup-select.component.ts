import {
  Component,
  forwardRef,
  inject,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { LookupService } from './lookup.service';
import { LookupItemDto } from './lookup.types';

@Component({
  selector: 'app-lookup-select',
  standalone: true,
  imports: [CommonModule, FormsModule, NzSelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LookupSelectComponent),
      multi: true,
    },
  ],
  templateUrl: './lookup-select.component.html',
})
export class LookupSelectComponent implements ControlValueAccessor, OnChanges {
  private readonly lookupService = inject(LookupService);

  /**
   * The lookup category code to populate options from (e.g., 'payment_type', 'unit_of_measure').
   */
  @Input({ required: true }) category!: string;

  @Input() placeholder = 'Select an option';
  @Input() allowClear = true;
  @Input() showSearch = true;
  @Input() showShortLabel = false;

  readonly items = signal<LookupItemDto[]>([]);
  readonly loading = signal<boolean>(false);

  selectedValue: string | null = null;
  disabled = false;

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['category'] && this.category) {
      await this.loadItems();
    }
  }

  private async loadItems(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.lookupService.getLookup(this.category);
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
