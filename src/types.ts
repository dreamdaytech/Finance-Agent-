export type DocumentType = 'invoice' | 'proforma' | 'receipt';
export type DocumentStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially paid' | 'paid';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ExpenseCategory = 'software' | 'hardware' | 'marketing' | 'office' | 'travel' | 'utilities' | 'other';

export interface LineItem {
  id: string; // Used for React keys
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  total: number;
  profit: number;
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface FinancialDocument {
  id?: string;
  authorId: string;
  type: DocumentType;
  documentNumber: string;
  customerName: string;
  customerContact?: string;
  customerAddress?: string;
  customerTaxId?: string;
  referenceNumber?: string;
  projectName?: string;
  date: Date;
  items: LineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  amountPaid: number;
  balance: number;
  grandTotal: number;
  totalCost: number;
  totalProfit: number;
  status: DocumentStatus;
  paymentStatus: PaymentStatus;
  customDetails?: CustomField[];
  customCustomerDetails?: CustomField[];
  customTotals?: CustomField[];
  relatedDocumentId?: string;
  relatedDocumentNumber?: string;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  nextRecurringDate?: Date;
  recurringEndDate?: Date;
  createdAt: Date;
}

export interface Customer {
  id?: string;
  authorId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  createdAt: Date;
}

export interface Product {
  id?: string;
  authorId: string;
  name: string;
  description?: string;
  unitPrice: number;
  costPrice: number;
  createdAt: Date;
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  businessName?: string;
  logoUrl?: string;
  createdAt: Date;
}

export interface Expense {
  id?: string;
  authorId: string;
  amount: number;
  date: Date;
  category: ExpenseCategory | string;
  description: string;
  vendor?: string;
  createdAt: Date;
}
