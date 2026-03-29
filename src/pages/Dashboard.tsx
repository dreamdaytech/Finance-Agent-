import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { FinancialDocument, Expense } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Plus, TrendingUp, DollarSign, FileText, ArrowDownRight, Upload, Database, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DocumentActions from '../components/DocumentActions';
import { processRecurringDocuments } from '../services/recurringService';
import { seedSampleData, clearUserData } from '../services/seedService';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<FinancialDocument[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

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
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribeDocs = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        date: docSnap.data().date.toDate(),
        createdAt: docSnap.data().createdAt.toDate(),
      })) as FinancialDocument[];
      
      setDocuments(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'documents');
    });

    const qExpenses = query(
      collection(db, 'expenses'),
      where('authorId', '==', user.uid)
    );

    const unsubscribeExpenses = onSnapshot(qExpenses, (snapshot) => {
      const expensesData = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Expense[];
      setExpenses(expensesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    return () => {
      unsubscribeDocs();
      unsubscribeExpenses();
    };
  }, [user]);

  const handleSeedData = async () => {
    if (!user) return;
    setIsSeeding(true);
    const toastId = toast.loading('Generating realistic sample data...');
    try {
      await seedSampleData(user.uid);
      toast.success('Sample data generated successfully!', { id: toastId });
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error('Failed to generate sample data.', { id: toastId });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearData = async () => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to clear ALL your data? This cannot be undone.')) return;
    
    setIsSeeding(true);
    const toastId = toast.loading('Clearing all data...');
    try {
      await clearUserData(user.uid);
      toast.success('All data cleared successfully!', { id: toastId });
    } catch (error) {
      console.error('Error clearing data:', error);
      toast.error('Failed to clear data.', { id: toastId });
    } finally {
      setIsSeeding(false);
    }
  };

  if (loading) return <div>Loading dashboard...</div>;

  // Calculate metrics
  const totalRevenue = documents
    .filter(d => d.type === 'invoice' || d.type === 'receipt')
    .reduce((sum, d) => sum + d.grandTotal, 0);

  const totalCost = documents
    .filter(d => d.type === 'invoice' || d.type === 'receipt')
    .reduce((sum, d) => sum + d.totalCost, 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const totalProfit = totalRevenue - totalCost - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const recentDocs = documents.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {documents.length === 0 && (
            <Button 
              variant="outline" 
              onClick={handleSeedData} 
              disabled={isSeeding}
              className="w-full sm:w-auto border-dashed border-primary text-primary hover:bg-primary/5"
            >
              <Database className="mr-2 h-4 w-4" /> Seed Sample Data
            </Button>
          )}
          {documents.length > 0 && (
             <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClearData} 
              disabled={isSeeding}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">From invoices & receipts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Costs & Expenses</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalCost + totalExpenses).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">COGS + Operating Expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">{profitMargin.toFixed(1)}% margin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total generated</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Documents</h2>
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          {recentDocs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No documents yet. Create your first invoice or receipt!
            </div>
          ) : (
            <div className="divide-y">
              {recentDocs.map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`
                      p-2 rounded-lg
                      ${doc.type === 'invoice' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                      ${doc.type === 'proforma' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : ''}
                      ${doc.type === 'receipt' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                    `}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{doc.customerName}</p>
                      <div className="flex items-center text-xs text-muted-foreground space-x-2">
                        <span className="capitalize">{doc.type}</span>
                        <span>•</span>
                        <span>{doc.documentNumber}</span>
                        <span>•</span>
                        <span>{format(doc.date, 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right mr-4">
                      <p className="font-medium text-foreground">${doc.grandTotal.toFixed(2)}</p>
                      <p className="text-xs text-green-600 dark:text-green-500">Profit: ${doc.totalProfit.toFixed(2)}</p>
                    </div>
                    <div className="flex space-x-1">
                      <DocumentActions document={doc} profile={profile} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
