export interface OrderItem {
  readonly id: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface Order {
  readonly id: string;
  readonly referenceNumber: string;
  readonly createdAt: Date;
  readonly items: readonly OrderItem[];
  /** Number of lines, known even when the lines themselves are not loaded (order lists). */
  readonly itemsCount?: number;
  readonly totalAmount: number;
}
