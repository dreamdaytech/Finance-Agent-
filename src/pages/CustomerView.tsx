import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { Customer, FinancialDocument } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Mail, Phone, MapPin, FileText, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import DocumentActions from '../components/DocumentActions';

export default function CustomerView() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [documents, setDocuments] = useState<FinancialDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;

    const fetchCustomer = async () => {
      try {
        const docRef = doc(db, 'customers', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as Customer;
          if (data.authorId !== user.uid) {
            navigate('/customers');
            return;
          }
          setCustomer({ id: docSnap.id, ...data });
        } else {
          navigate('/customers');
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
      }
    };

    fetchCustomer();
  }, [id, user, navigate]);

  useEffect(() => {
    if (!user || !customer) return;

    const q = query(
      collection(db, 'documents'),
      where('authorId', '==', user.uid),
      where('customerName', '==', customer.name),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        date: docSnap.data().date.toDate(),
        createdAt: docSnap.data().createdAt.toDate(),
      })) as FinancialDocument[];
      
      setDocuments(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, customer]);

  if (loading) return <div className="p-8 text-center">Loading customer details...</div>;
  if (!customer) return null;

  const totalRevenue = documents
    .filter(d => d.type === 'invoice' || d.type === 'receipt')
    .reduce((sum, d) => sum + d.grandTotal, 0);

  const totalOutstanding = documents
    .filter(d => d.type === 'invoice')
    .reduce((sum, d) => sum + d.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Customer Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl">{customer.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.email && (
              <div className="flex items-center text-muted-foreground">
                <Mail className="h-4 w-4 mr-2" />
                <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center text-muted-foreground">
                <Phone className="h-4 w-4 mr-2" />
                <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
              </div>
            )}
            {customer.address && (
              <div className="flex items-start text-muted-foreground">
                <MapPin className="h-4 w-4 mr-2 mt-0.5" />
                <span>{customer.address}</span>
              </div>
            )}
            {customer.taxId && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium">Tax ID</p>
                <p className="text-muted-foreground">{customer.taxId}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold mt-2">${totalRevenue.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
                <p className={`text-3xl font-bold mt-2 ${totalOutstanding > 0 ? 'text-red-600 dark:text-red-500' : ''}`}>
                  ${totalOutstanding.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No documents found for this customer.
                </div>
              ) : (
                <div className="divide-y">
                  {documents.map((doc) => (
                    <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className={`
                          p-3 rounded-lg
                          ${doc.type === 'invoice' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                          ${doc.type === 'proforma' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : ''}
                          ${doc.type === 'receipt' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                        `}>
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground flex items-center gap-2">
                            {doc.documentNumber}
                            {doc.isRecurring && (
                              <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded flex items-center">
                                <Repeat className="w-3 h-3 mr-1" />
                                Recurring
                              </span>
                            )}
                          </p>
                          <div className="flex items-center text-sm text-muted-foreground space-x-2 mt-1">
                            <span className="capitalize font-medium">{doc.type}</span>
                            <span>•</span>
                            <span>{format(doc.date, 'MMM d, yyyy')}</span>
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize
                              ${doc.paymentStatus === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 
                                doc.paymentStatus === 'partially paid' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 
                                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {doc.paymentStatus || 'unpaid'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-foreground">${doc.grandTotal.toFixed(2)}</p>
                        </div>
                        <div className="flex space-x-2">
                          <DocumentActions document={doc} profile={profile} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
