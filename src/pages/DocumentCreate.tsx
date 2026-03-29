import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { DocumentType, LineItem, FinancialDocument, CustomField, Customer, Product, PaymentStatus } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Plus, Trash2, ArrowLeft, Sparkles, Download, Share2, User, Package } from 'lucide-react';
import { toast } from 'sonner';
import { generatePDF } from '../lib/pdf';

export default function DocumentCreate() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState<DocumentType>('invoice');
  const [documentNumber, setDocumentNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', name: '', quantity: 1, unitPrice: 0, costPrice: 0, total: 0, profit: 0 }
  ]);
  
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);

  const [customDetails, setCustomDetails] = useState<CustomField[]>([]);
  const [customCustomerDetails, setCustomCustomerDetails] = useState<CustomField[]>([]);
  const [customTotals, setCustomTotals] = useState<CustomField[]>([]);
  const [relatedDocumentId, setRelatedDocumentId] = useState('');
  const [relatedDocumentNumber, setRelatedDocumentNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<string>('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState('');

  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [allDocuments, setAllDocuments] = useState<FinancialDocument[]>([]);

  // Fetch saved customers and products
  useEffect(() => {
    if (!user) return;

    const fetchSavedData = async () => {
      const customersQuery = query(collection(db, 'customers'), where('authorId', '==', user.uid), orderBy('name'));
      const productsQuery = query(collection(db, 'products'), where('authorId', '==', user.uid), orderBy('name'));
      const documentsQuery = query(collection(db, 'documents'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc'));

      const [customersSnap, productsSnap, documentsSnap] = await Promise.all([
        getDocs(customersQuery),
        getDocs(productsQuery),
        getDocs(documentsQuery)
      ]);

      setSavedCustomers(customersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]);
      setSavedProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
      setAllDocuments(documentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as FinancialDocument[]);
    };

    fetchSavedData();
  }, [user]);

  // Handle pre-filled data from OCR
  useEffect(() => {
    const extractedData = location.state?.extractedData as Partial<FinancialDocument>;
    if (extractedData) {
      if (extractedData.type) setType(extractedData.type);
      if (extractedData.documentNumber) setDocumentNumber(extractedData.documentNumber);
      if (extractedData.customerName) setCustomerName(extractedData.customerName);
      if (extractedData.customerContact) setCustomerContact(extractedData.customerContact);
      
      if (extractedData.date) {
        try {
          const d = new Date(extractedData.date);
          if (!isNaN(d.getTime())) {
            setDate(d.toISOString().split('T')[0]);
          }
        } catch (e) {
          console.error('Invalid date from OCR:', extractedData.date);
        }
      }
      
      if (extractedData.items && extractedData.items.length > 0) {
        setItems(extractedData.items);
      }
      
      toast.success('Data pre-filled from scan!');
      // Clear navigation state to avoid re-filling on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate total and profit
        updated.total = updated.quantity * updated.unitPrice;
        updated.profit = updated.total - (updated.quantity * updated.costPrice);
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    setItems([...items, { 
      id: Date.now().toString(), 
      name: '', 
      quantity: 1, 
      unitPrice: 0, 
      costPrice: 0, 
      total: 0, 
      profit: 0 
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
  
  const isPercentageDiscount = type === 'invoice' || type === 'proforma';
  const discountAmount = isPercentageDiscount ? subtotal * (discount / 100) : discount;
  
  const grandTotal = subtotal - discountAmount + tax;
  const balance = grandTotal - amountPaid;
  const totalProfit = grandTotal - totalCost;

  const handleTypeChange = (value: DocumentType) => {
    setType(value);
    const prefix = value === 'invoice' ? 'INV' : value === 'proforma' ? 'PRO' : 'REC';
    setDocumentNumber(`${prefix}-${Date.now().toString().slice(-6)}`);
  };

  const handleSelectCustomer = (customerId: string) => {
    const customer = savedCustomers.find(c => c.id === customerId);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerContact(customer.phone || customer.email || '');
      setCustomerAddress(customer.address || '');
      setCustomerTaxId(customer.taxId || '');
    }
  };

  const handleSelectRelatedDocument = (docId: string) => {
    if (docId === 'none') {
      setRelatedDocumentId('');
      setRelatedDocumentNumber('');
      return;
    }
    const doc = allDocuments.find(d => d.id === docId);
    if (doc) {
      setRelatedDocumentId(doc.id!);
      setRelatedDocumentNumber(doc.documentNumber);
    }
  };

  const handleSelectProduct = (itemId: string, productId: string) => {
    const product = savedProducts.find(p => p.id === productId);
    if (product) {
      updateItem(itemId, 'name', product.name);
      updateItem(itemId, 'unitPrice', product.unitPrice);
      updateItem(itemId, 'costPrice', product.costPrice);
    }
  };

  const handleSave = async (action?: 'download' | 'share') => {
    if (!user) return;
    if (!customerName) {
      toast.error('Customer name is required');
      return;
    }
    if (items.some(i => !i.name)) {
      toast.error('All items must have a name');
      return;
    }

    setLoading(true);
    try {
      const docData: any = {
        authorId: user.uid,
        type,
        documentNumber,
        customerName,
        customerContact,
        customerAddress,
        customerTaxId,
        referenceNumber,
        projectName,
        date: new Date(date),
        items,
        subtotal,
        discount,
        tax,
        amountPaid,
        balance,
        grandTotal,
        totalCost,
        totalProfit,
        customDetails,
        customCustomerDetails,
        customTotals,
        relatedDocumentId,
        relatedDocumentNumber,
        status: 'draft',
        paymentStatus,
        createdAt: serverTimestamp()
      };

      if (isRecurring) {
        docData.isRecurring = true;
        docData.recurringFrequency = recurringFrequency;
        
        // Calculate next date based on frequency
        const startDate = new Date(date);
        let nextDate = new Date(startDate);
        if (recurringFrequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (recurringFrequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (recurringFrequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        else if (recurringFrequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
        
        docData.nextRecurringDate = nextDate;
        if (recurringEndDate) {
          docData.recurringEndDate = new Date(recurringEndDate);
        }
      }

      const docRef = await addDoc(collection(db, 'documents'), docData);
      
      // Handle bidirectional linking updates
      if (relatedDocumentId) {
        try {
          const relatedDocRef = doc(db, 'documents', relatedDocumentId);
          await updateDoc(relatedDocRef, {
            relatedDocumentId: docRef.id,
            relatedDocumentNumber: documentNumber,
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          console.error('Failed to update related document:', err);
        }
      }

      toast.success('Document saved successfully!');
      
      if (action === 'download') {
        await generatePDF({ ...docData, id: docRef.id } as any, profile);
      } else if (action === 'share') {
        const text = `Here is your ${type} (${documentNumber}) for $${grandTotal.toFixed(2)}.`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      }
      
      navigate('/documents');
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Failed to save document');
    } finally {
      setLoading(false);
    }
  };

  const addCustomField = (section: 'details' | 'customer' | 'totals') => {
    const newField = { id: Date.now().toString(), label: '', value: '' };
    if (section === 'details') setCustomDetails([...customDetails, newField]);
    else if (section === 'customer') setCustomCustomerDetails([...customCustomerDetails, newField]);
    else if (section === 'totals') setCustomTotals([...customTotals, newField]);
  };

  const updateCustomField = (section: 'details' | 'customer' | 'totals', id: string, field: 'label' | 'value', val: string) => {
    const setter = section === 'details' ? setCustomDetails : section === 'customer' ? setCustomCustomerDetails : setCustomTotals;
    const list = section === 'details' ? customDetails : section === 'customer' ? customCustomerDetails : customTotals;
    setter(list.map(f => f.id === id ? { ...f, [field]: val } : f));
  };

  const removeCustomField = (section: 'details' | 'customer' | 'totals', id: string) => {
    const setter = section === 'details' ? setCustomDetails : section === 'customer' ? setCustomCustomerDetails : setCustomTotals;
    const list = section === 'details' ? customDetails : section === 'customer' ? customCustomerDetails : customTotals;
    setter(list.filter(f => f.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Create Document</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Document Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={type} onValueChange={(v) => handleTypeChange(v as DocumentType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="proforma">Proforma Invoice</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partially paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Document Number</Label>
              <Input value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="PO-12345" />
            </div>

            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Office Renovation" />
            </div>

            <div className="space-y-2">
              <Label>Related Document</Label>
              <Select onValueChange={handleSelectRelatedDocument} value={relatedDocumentId || 'none'}>
                <SelectTrigger className="bg-primary/5 border-primary/20">
                  <SelectValue placeholder="Link to another document..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {allDocuments.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id!}>
                      <span className="capitalize">{doc.type}</span>: {doc.documentNumber} ({doc.customerName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="isRecurring" className="font-medium">Make this a Recurring {type === 'invoice' ? 'Invoice' : type === 'proforma' ? 'Proforma' : 'Receipt'}</Label>
              </div>

              {isRecurring && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Input 
                      type="date" 
                      value={recurringEndDate} 
                      onChange={(e) => setRecurringEndDate(e.target.value)} 
                    />
                  </div>
                </div>
              )}
            </div>

            {customDetails.map((field) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-1">
                  <Input 
                    placeholder="Label (e.g. Delivery Date)" 
                    value={field.label} 
                    onChange={e => updateCustomField('details', field.id, 'label', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-5 space-y-1">
                  <Input 
                    placeholder="Value" 
                    value={field.value} 
                    onChange={e => updateCustomField('details', field.id, 'value', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCustomField('details', field.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-xs h-8 border-dashed border" onClick={() => addCustomField('details')}>
              <Plus className="h-3 w-3 mr-1" /> Add Detail Field
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {savedCustomers.length > 0 && (
              <div className="space-y-2 pb-4 border-b">
                <Label className="text-blue-600 flex items-center">
                  <User className="h-3 w-3 mr-1" /> Select Saved Customer
                </Label>
                <Select onValueChange={handleSelectCustomer}>
                  <SelectTrigger className="bg-primary/5 border-primary/20">
                    <SelectValue placeholder="Choose a customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {savedCustomers.map(c => (
                      <SelectItem key={c.id} value={c.id!}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="John Doe" />
            </div>
            
            <div className="space-y-2">
              <Label>Contact (Phone/Email)</Label>
              <Input value={customerContact} onChange={e => setCustomerContact(e.target.value)} placeholder="+232 77 123456" />
            </div>

            <div className="space-y-2">
              <Label>Customer Address</Label>
              <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="123 Main St, Freetown" />
            </div>

            <div className="space-y-2">
              <Label>Customer Tax ID / TIN</Label>
              <Input value={customerTaxId} onChange={e => setCustomerTaxId(e.target.value)} placeholder="TIN-987654321" />
            </div>

            {customCustomerDetails.map((field) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-1">
                  <Input 
                    placeholder="Label (e.g. Website)" 
                    value={field.label} 
                    onChange={e => updateCustomField('customer', field.id, 'label', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-5 space-y-1">
                  <Input 
                    placeholder="Value" 
                    value={field.value} 
                    onChange={e => updateCustomField('customer', field.id, 'value', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCustomField('customer', field.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-xs h-8 border-dashed border" onClick={() => addCustomField('customer')}>
              <Plus className="h-3 w-3 mr-1" /> Add Customer Field
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-2" /> Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end border-b pb-4 last:border-0">
              <div className="sm:col-span-4 space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="sm:hidden">Item Name</Label>
                  {savedProducts.length > 0 && (
                    <Select onValueChange={(val) => handleSelectProduct(item.id, val)}>
                      <SelectTrigger className="h-7 text-[10px] w-auto border-dashed bg-muted/50">
                        <Package className="h-3 w-3 mr-1" />
                        <SelectValue placeholder="Select Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {savedProducts.map(p => (
                          <SelectItem key={p.id} value={p.id!}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Input 
                  placeholder="Item description" 
                  value={item.name} 
                  onChange={e => updateItem(item.id, 'name', e.target.value)} 
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="sm:hidden">Quantity</Label>
                <Input 
                  type="number" 
                  min="1" 
                  placeholder="Qty" 
                  value={item.quantity || ''} 
                  onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="sm:hidden">Unit Price</Label>
                <Input 
                  type="number" 
                  min="0" 
                  placeholder="Price" 
                  value={item.unitPrice || ''} 
                  onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="sm:hidden">Cost Price (Internal)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  placeholder="Cost" 
                  value={item.costPrice || ''} 
                  onChange={e => updateItem(item.id, 'costPrice', parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="sm:col-span-1 space-y-2">
                <Label className="sm:hidden">Total</Label>
                <div className="h-10 flex items-center font-medium">
                  ${item.total.toFixed(2)}
                </div>
              </div>
              <div className="sm:col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div></div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center space-x-4">
              <span className="text-sm text-muted-foreground w-1/3">
                Discount {isPercentageDiscount ? '(%)' : '($)'}
              </span>
              <div className="w-2/3 flex items-center space-x-2">
                <Input 
                  type="number" 
                  min="0" 
                  max={isPercentageDiscount ? "100" : undefined}
                  className="text-right" 
                  value={discount || ''} 
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)} 
                />
                {isPercentageDiscount && discount > 0 && (
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    -${discountAmount.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center space-x-4">
              <span className="text-sm text-muted-foreground w-1/3">Tax</span>
              <Input 
                type="number" 
                min="0" 
                className="w-2/3 text-right" 
                value={tax || ''} 
                onChange={e => setTax(parseFloat(e.target.value) || 0)} 
              />
            </div>

            <div className="pt-4 border-t flex justify-between items-center">
              <span className="font-bold text-lg">Grand Total</span>
              <span className="font-bold text-2xl text-foreground">${grandTotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center space-x-4">
              <span className="text-sm text-muted-foreground w-1/3">Amount Paid</span>
              <Input 
                type="number" 
                min="0" 
                className="w-2/3 text-right" 
                value={amountPaid || ''} 
                onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)} 
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="font-semibold text-foreground">Balance Due</span>
              <span className={`font-bold ${balance > 0 ? 'text-destructive' : 'text-foreground'}`}>
                ${balance.toFixed(2)}
              </span>
            </div>

            <div className="pt-2 flex justify-between items-center text-sm text-green-600 dark:text-green-500 font-medium">
              <span>Estimated Profit</span>
              <span>${totalProfit.toFixed(2)}</span>
            </div>

            {customTotals.map((field) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-center pt-2 border-t border-dashed">
                <div className="col-span-5">
                  <Input 
                    placeholder="Label (e.g. Shipping)" 
                    value={field.label} 
                    onChange={e => updateCustomField('totals', field.id, 'label', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-5">
                  <Input 
                    placeholder="Value" 
                    value={field.value} 
                    onChange={e => updateCustomField('totals', field.id, 'value', e.target.value)}
                    className="h-8 text-xs text-right"
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCustomField('totals', field.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-xs h-8 border-dashed border" onClick={() => addCustomField('totals')}>
              <Plus className="h-3 w-3 mr-1" /> Add Total Field
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:relative md:bg-transparent md:border-0 md:p-0 flex flex-col sm:flex-row justify-end gap-2">
        <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => handleSave('download')} disabled={loading}>
          <Download className="mr-2 h-4 w-4" /> Save & Download
        </Button>
        <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => handleSave('share')} disabled={loading}>
          <Share2 className="mr-2 h-4 w-4" /> Save & Share
        </Button>
        <Button size="lg" className="w-full sm:w-auto" onClick={() => handleSave()} disabled={loading}>
          {loading ? 'Saving...' : 'Save Document'}
        </Button>
      </div>
    </div>
  );
}
