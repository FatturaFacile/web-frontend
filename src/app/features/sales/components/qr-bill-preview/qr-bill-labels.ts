import { QrBillLanguage } from '@core/models/swiss-qr-bill.model';

/** Payment slip labels as prescribed by the SIX Swiss Payment Standards, which fix them per language. */
export interface QrBillLabels {
  readonly receipt: string;
  readonly paymentPart: string;
  readonly accountPayableTo: string;
  readonly reference: string;
  readonly additionalInformation: string;
  readonly payableBy: string;
  readonly payableByName: string;
  readonly currency: string;
  readonly amount: string;
  readonly acceptancePoint: string;
  readonly separateBeforePaying: string;
}

export const QR_BILL_LANGUAGES: readonly QrBillLanguage[] = ['it', 'de', 'fr', 'en'];

export const QR_BILL_LABELS: Record<QrBillLanguage, QrBillLabels> = {
  it: {
    receipt: 'Ricevuta',
    paymentPart: 'Sezione pagamento',
    accountPayableTo: 'Conto / Pagabile a',
    reference: 'Riferimento',
    additionalInformation: 'Informazioni aggiuntive',
    payableBy: 'Pagabile da',
    payableByName: 'Pagabile da (nome/indirizzo)',
    currency: 'Valuta',
    amount: 'Importo',
    acceptancePoint: 'Punto di accettazione',
    separateBeforePaying: 'Da staccare prima del versamento',
  },
  de: {
    receipt: 'Empfangsschein',
    paymentPart: 'Zahlteil',
    accountPayableTo: 'Konto / Zahlbar an',
    reference: 'Referenz',
    additionalInformation: 'Zusätzliche Informationen',
    payableBy: 'Zahlbar durch',
    payableByName: 'Zahlbar durch (Name/Adresse)',
    currency: 'Währung',
    amount: 'Betrag',
    acceptancePoint: 'Annahmestelle',
    separateBeforePaying: 'Vor der Einzahlung abzutrennen',
  },
  fr: {
    receipt: 'Récépissé',
    paymentPart: 'Section paiement',
    accountPayableTo: 'Compte / Payable à',
    reference: 'Référence',
    additionalInformation: 'Informations supplémentaires',
    payableBy: 'Payable par',
    payableByName: 'Payable par (nom/adresse)',
    currency: 'Monnaie',
    amount: 'Montant',
    acceptancePoint: 'Point de dépôt',
    separateBeforePaying: 'A détacher avant le versement',
  },
  en: {
    receipt: 'Receipt',
    paymentPart: 'Payment part',
    accountPayableTo: 'Account / Payable to',
    reference: 'Reference',
    additionalInformation: 'Additional information',
    payableBy: 'Payable by',
    payableByName: 'Payable by (name/address)',
    currency: 'Currency',
    amount: 'Amount',
    acceptancePoint: 'Acceptance point',
    separateBeforePaying: 'Separate before paying in',
  },
};
