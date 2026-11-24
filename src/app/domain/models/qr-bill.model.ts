export interface Address {
  readonly name: string;
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: string;
  readonly qrIban?: string;
}

export interface QrBill {
  readonly id: string;
  readonly billNumber: string;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly currency: 'CHF' | 'EUR';
  readonly amount: number;
  readonly creditor: Address;
  readonly debtor: Address;
  readonly reference: string;
  readonly unstructuredMessage: string;
  readonly status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED';
}
