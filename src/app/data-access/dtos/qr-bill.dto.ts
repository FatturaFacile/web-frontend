export interface AddressDto {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  qrIban?: string;
}

export interface QrBillDto {
  id: string;
  billNumber: string;
  issueDate: string;
  dueDate: string;
  currency: 'CHF' | 'EUR';
  amount: number;
  creditor: AddressDto;
  debtor: AddressDto;
  reference: string;
  unstructuredMessage: string;
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED';
}
