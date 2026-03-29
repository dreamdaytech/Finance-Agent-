import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FinancialDocument, UserProfile, DocumentType } from '../types';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Download, Share2, Loader2, FileText, Copy, Link as LinkIcon, Repeat } from 'lucide-react';
import { generatePDF } from '../lib/pdf';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export default function DocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [document, setDocument] = useState<FinancialDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocument() {
      if (!id) return;
      try {
        const docRef = doc(db, 'documents', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as FinancialDocument;
          // Handle date conversion
          const docDate = data.date instanceof Date ? data.date : (data.date as any).toDate();
          
          // Ensure all fields have defaults for older documents
          const sanitizedData: FinancialDocument = {
            ...data,
            id: docSnap.id,
            date: docDate,
            discount: data.discount || 0,
            tax: data.tax || 0,
            amountPaid: data.amountPaid || 0,
            balance: data.balance ?? (data.grandTotal - (data.amountPaid || 0)),
            customDetails: data.customDetails || [],
            customCustomerDetails: data.customCustomerDetails || [],
            customTotals: data.customTotals || []
          };
          
          setDocument(sanitizedData);
        } else {
          toast.error('Document not found');
          navigate('/documents');
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        toast.error('Failed to load document');
      } finally {
        setLoading(false);
      }
    }
    fetchDocument();
  }, [id, navigate]);

  const handleDownload = async () => {
    if (document) {
      await generatePDF(document, profile);
    }
  };

  const handleShare = () => {
    if (!document) return;
    const text = `Here is your ${document.type} (${document.documentNumber}) for $${document.grandTotal.toFixed(2)}.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleConvert = async (newType: DocumentType) => {
    if (!document || !user) return;
    
    setLoading(true);
    try {
      const newDocNumber = `${newType.charAt(0).toUpperCase()}${Date.now().toString().slice(-6)}`;
      const newDocData = {
        ...document,
        type: newType,
        documentNumber: newDocNumber,
        relatedDocumentId: document.id,
        relatedDocumentNumber: document.documentNumber,
        createdAt: serverTimestamp(),
        date: new Date(),
        status: 'draft'
      };
      
      // Remove id from the data object before saving
      const { id, ...dataToSave } = newDocData as any;
      
      const docRef = await addDoc(collection(db, 'documents'), dataToSave);
      
      // Handle bidirectional linking update for the original document
      try {
        const originalDocRef = doc(db, 'documents', document.id!);
        await updateDoc(originalDocRef, {
          relatedDocumentId: docRef.id,
          relatedDocumentNumber: newDocNumber,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Failed to update original document with link:', err);
      }

      toast.success(`Converted to ${newType} successfully!`);
      navigate(`/documents/view/${docRef.id}`);
    } catch (error) {
      console.error('Error converting document:', error);
      toast.error('Failed to convert document');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!document) return null;

  const isPercentageDiscount = document.type === 'invoice' || document.type === 'proforma';
  const discountAmount = isPercentageDiscount ? document.subtotal * (document.discount / 100) : document.discount;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/documents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">View {document.type}</h1>
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none">
                <Copy className="mr-2 h-4 w-4" /> Convert To...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {document.type !== 'invoice' && (
                <DropdownMenuItem onClick={() => handleConvert('invoice')}>
                  Convert to Invoice
                </DropdownMenuItem>
              )}
              {document.type !== 'proforma' && (
                <DropdownMenuItem onClick={() => handleConvert('proforma')}>
                  Convert to Proforma
                </DropdownMenuItem>
              )}
              {document.type !== 'receipt' && (
                <DropdownMenuItem onClick={() => handleConvert('receipt')}>
                  Convert to Receipt
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-lg">
        <CardHeader className="bg-primary text-primary-foreground p-8">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-4">
              {profile?.logoUrl && (
                <div className="bg-card p-2 rounded w-fit">
                  <img 
                    src={profile.logoUrl} 
                    alt="Logo" 
                    className="h-12 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-bold uppercase tracking-wider">{document.type}</h2>
                  {document.isRecurring && (
                    <span className="bg-white/20 text-white text-xs px-2 py-1 rounded flex items-center">
                      <Repeat className="w-3 h-3 mr-1" />
                      Recurring ({document.recurringFrequency})
                    </span>
                  )}
                </div>
                <p className="text-primary-foreground/70 mt-1">#{document.documentNumber}</p>
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-xl font-bold">{profile?.businessName || profile?.name || 'Your Business'}</h3>
              <p className="text-primary-foreground/70 text-sm">{profile?.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bill To</p>
              <p className="text-lg font-bold text-foreground">{document.customerName}</p>
              {document.customerContact && (
                <p className="text-muted-foreground">{document.customerContact}</p>
              )}
              {document.customerAddress && (
                <p className="text-muted-foreground whitespace-pre-wrap">{document.customerAddress}</p>
              )}
              {document.customerTaxId && (
                <p className="text-muted-foreground text-xs mt-1">TIN: {document.customerTaxId}</p>
              )}
              {document.customCustomerDetails?.map((field) => (
                <div key={field.id} className="mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{field.label}</p>
                  <p className="text-foreground">{field.value}</p>
                </div>
              ))}
              {document.relatedDocumentId && (
                <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20 flex items-center space-x-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">
                    Related to: <Link to={`/documents/view/${document.relatedDocumentId}`} className="font-bold text-primary underline">{document.relatedDocumentNumber}</Link>
                  </span>
                </div>
              )}
            </div>
            <div className="text-right space-y-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Date</p>
                <p className="text-lg font-bold text-foreground">{format(document.date, 'MMMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Payment Status</p>
                <p className="text-foreground font-medium capitalize">{document.paymentStatus || 'Unpaid'}</p>
              </div>
              {document.referenceNumber && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reference</p>
                  <p className="text-foreground font-medium">{document.referenceNumber}</p>
                </div>
              )}
              {document.projectName && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Project</p>
                  <p className="text-foreground font-medium">{document.projectName}</p>
                </div>
              )}
              {document.customDetails?.map((field) => (
                <div key={field.id}>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">{field.label}</p>
                  <p className="text-foreground font-medium">{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-4 font-semibold text-foreground">Description</th>
                  <th className="p-4 font-semibold text-foreground text-center">Qty</th>
                  <th className="p-4 font-semibold text-foreground text-right">Unit Price</th>
                  <th className="p-4 font-semibold text-foreground text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {document.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-4 text-muted-foreground">{item.name}</td>
                    <td className="p-4 text-muted-foreground text-center">{item.quantity}</td>
                    <td className="p-4 text-muted-foreground text-right">${item.unitPrice.toFixed(2)}</td>
                    <td className="p-4 font-medium text-foreground text-right">${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-3">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>${document.subtotal.toFixed(2)}</span>
              </div>
              {document.discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount {isPercentageDiscount ? `(${document.discount}%)` : ''}</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              {document.tax > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>${document.tax.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-3 border-t flex justify-between items-center">
                <span className="text-lg font-bold text-foreground">Total</span>
                <span className="text-2xl font-bold text-primary">${document.grandTotal.toFixed(2)}</span>
              </div>
              {document.amountPaid > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Amount Paid</span>
                  <span>${document.amountPaid.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 flex justify-between items-center border-t border-dashed">
                <span className="font-bold text-foreground">Balance Due</span>
                <span className={`text-xl font-bold ${document.balance > 0 ? 'text-red-600 dark:text-red-500' : 'text-foreground'}`}>
                  ${document.balance.toFixed(2)}
                </span>
              </div>
              {document.customTotals?.map((field) => (
                <div key={field.id} className="flex justify-between text-muted-foreground pt-1">
                  <span>{field.label}</span>
                  <span>{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
