import { collection, addDoc, serverTimestamp, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { FinancialDocument, Customer, Product, Expense, DocumentType, DocumentStatus, PaymentStatus, ExpenseCategory } from '../types';
import { subDays, subMonths, format } from 'date-fns';

const SAMPLE_CUSTOMERS = [
  { name: 'Acme Corp', email: 'billing@acme.com', phone: '+1 (555) 123-4567', address: '123 Industrial Way, Springfield, IL', taxId: 'US-123456789' },
  { name: 'Global Tech Solutions', email: 'accounts@globaltech.io', phone: '+1 (555) 987-6543', address: '456 Innovation Blvd, San Francisco, CA', taxId: 'US-987654321' },
  { name: 'Starlight Retail', email: 'finance@starlight.com', phone: '+1 (555) 246-8135', address: '789 Market St, New York, NY', taxId: 'US-246813579' },
  { name: 'Green Valley Organics', email: 'hello@greenvalley.org', phone: '+1 (555) 369-2580', address: '321 Farm Rd, Austin, TX', taxId: 'US-369258014' },
];

const SAMPLE_PRODUCTS = [
  { name: 'Web Development Service', description: 'Custom website design and development', unitPrice: 1500, costPrice: 500 },
  { name: 'Monthly Maintenance', description: 'Server upkeep and software updates', unitPrice: 200, costPrice: 50 },
  { name: 'SEO Optimization', description: 'Search engine optimization package', unitPrice: 800, costPrice: 200 },
  { name: 'Cloud Hosting (Annual)', description: 'Premium cloud hosting subscription', unitPrice: 1200, costPrice: 800 },
  { name: 'UI/UX Consultation', description: 'Design review and user experience audit', unitPrice: 500, costPrice: 100 },
];

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['software', 'hardware', 'marketing', 'office', 'travel', 'utilities', 'other'];

export async function seedSampleData(userId: string) {
  // 1. Create Customers
  const customerRefs: string[] = [];
  const customerNames: string[] = [];
  for (const cust of SAMPLE_CUSTOMERS) {
    const docRef = await addDoc(collection(db, 'customers'), {
      ...cust,
      authorId: userId,
      createdAt: serverTimestamp()
    });
    customerRefs.push(docRef.id);
    customerNames.push(cust.name);
  }

  // 2. Create Products
  const products: Product[] = [];
  for (const prod of SAMPLE_PRODUCTS) {
    const docRef = await addDoc(collection(db, 'products'), {
      ...prod,
      authorId: userId,
      createdAt: serverTimestamp()
    });
    products.push({ id: docRef.id, ...prod, authorId: userId, createdAt: new Date() });
  }

  // 3. Create Expenses (last 3 months)
  for (let i = 0; i < 15; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const category = EXPENSE_CATEGORIES[Math.floor(Math.random() * EXPENSE_CATEGORIES.length)];
    const amount = Math.floor(Math.random() * 500) + 20;
    
    await addDoc(collection(db, 'expenses'), {
      authorId: userId,
      amount,
      date: subDays(new Date(), daysAgo),
      category,
      description: `Sample ${category} expense ${i + 1}`,
      vendor: 'Sample Vendor Inc.',
      createdAt: serverTimestamp()
    });
  }

  // 4. Create Documents (Invoices, Proformas, Receipts)
  const docTypes: DocumentType[] = ['invoice', 'proforma', 'receipt'];
  
  for (let i = 0; i < 12; i++) {
    const type = docTypes[Math.floor(Math.random() * docTypes.length)];
    const customerIndex = Math.floor(Math.random() * SAMPLE_CUSTOMERS.length);
    const customer = SAMPLE_CUSTOMERS[customerIndex];
    const daysAgo = Math.floor(Math.random() * 60);
    const date = subDays(new Date(), daysAgo);
    
    // Random items
    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = [];
    let subtotal = 0;
    let totalCost = 0;
    
    for (let j = 0; j < numItems; j++) {
      const prod = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const total = quantity * prod.unitPrice;
      const profit = total - (quantity * prod.costPrice);
      
      items.push({
        id: `item-${Date.now()}-${j}`,
        name: prod.name,
        quantity,
        unitPrice: prod.unitPrice,
        costPrice: prod.costPrice,
        total,
        profit
      });
      
      subtotal += total;
      totalCost += (quantity * prod.costPrice);
    }
    
    const tax = subtotal * 0.1; // 10% tax
    const grandTotal = subtotal + tax;
    const status: DocumentStatus = type === 'receipt' ? 'paid' : (Math.random() > 0.3 ? 'sent' : 'draft');
    const paymentStatus: PaymentStatus = type === 'receipt' ? 'paid' : (status === 'sent' ? (Math.random() > 0.5 ? 'paid' : 'unpaid') : 'unpaid');
    const amountPaid = paymentStatus === 'paid' ? grandTotal : 0;
    const balance = grandTotal - amountPaid;
    const totalProfit = grandTotal - totalCost;

    const docNumber = `${type.charAt(0).toUpperCase()}${format(date, 'yyMM')}${i.toString().padStart(3, '0')}`;

    await addDoc(collection(db, 'documents'), {
      authorId: userId,
      type,
      documentNumber: docNumber,
      customerName: customer.name,
      customerContact: customer.email,
      customerAddress: customer.address,
      customerTaxId: customer.taxId,
      date,
      items,
      subtotal,
      discount: 0,
      tax,
      amountPaid,
      balance,
      grandTotal,
      totalCost,
      totalProfit,
      status,
      paymentStatus,
      createdAt: serverTimestamp()
    });
  }
}

export async function clearUserData(userId: string) {
  const collections = ['customers', 'products', 'expenses', 'documents'];
  
  for (const collName of collections) {
    const q = query(collection(db, collName), where('authorId', '==', userId));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }
}
