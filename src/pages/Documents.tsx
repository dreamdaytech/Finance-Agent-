import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { FinancialDocument } from '../types';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Plus, Search, FileText, Upload, Repeat } from 'lucide-react';
import { Input } from '../components/ui/input';
import DocumentActions from '../components/DocumentActions';
import { processRecurringDocuments } from '../services/recurringService';
import { toast } from 'sonner';

export default function Documents() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<FinancialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    // Check and generate recurring invoices
    processRecurringDocuments(user.uid).then((count) => {
      if (count > 0) {
        toast.success(`Generated ${count} recurring invoice${count > 1 ? 's' : ''}`);
      }
    }).catch(err => {
      console.error('Error processing recurring documents:', err);
    });

    const q = query(
      collection(db, 'documents'),
      where('authorId', '==', user.uid),
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
  }, [user]);

  const filteredDocs = documents.filter(docData => 
    docData.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    docData.documentNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div>Loading documents...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Link to="/documents/upload" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">
              <Upload className="mr-2 h-4 w-4" /> Scan Document
            </Button>
          </Link>
          <Link to="/documents/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Create Document
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground ml-2" />
        <Input 
          placeholder="Search by customer or document number..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-0 focus-visible:ring-0 shadow-none bg-transparent"
        />
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No documents found.
          </div>
        ) : (
          <div className="divide-y">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className={`
                    p-3 rounded-lg
                    ${doc.type === 'invoice' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                    ${doc.type === 'proforma' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : ''}
                    ${doc.type === 'receipt' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                  `}>
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-lg flex items-center gap-2">
                      {doc.customerName}
                      {doc.isRecurring && (
                        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded flex items-center">
                          <Repeat className="w-3 h-3 mr-1" />
                          Recurring
                        </span>
                      )}
                    </p>
                    <div className="flex items-center text-sm text-muted-foreground space-x-2 mt-1">
                      <span className="capitalize font-medium">{doc.type}</span>
                      <span>•</span>
                      <span>{doc.documentNumber}</span>
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
                    <p className="font-bold text-foreground text-lg">${doc.grandTotal.toFixed(2)}</p>
                    <p className="text-sm text-green-600 dark:text-green-500 font-medium">Profit: ${doc.totalProfit.toFixed(2)}</p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <DocumentActions document={doc} profile={profile} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
