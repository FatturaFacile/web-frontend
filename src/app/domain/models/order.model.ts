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
  readonly totalAmount: number;
}
