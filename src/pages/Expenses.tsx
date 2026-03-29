import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { Expense, ExpenseCategory } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Search, Trash2, Edit2, DollarSign, Calendar, Tag, Building } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const CATEGORIES: { value: ExpenseCategory, label: string }[] = [
  { value: 'software', label: 'Software & Subscriptions' },
  { value: 'hardware', label: 'Hardware & Equipment' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'travel', label: 'Travel & Meals' },
  { value: 'utilities', label: 'Utilities & Internet' },
  { value: 'other', label: 'Other' },
];

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState<ExpenseCategory | string>('software');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'expenses'),
      where('authorId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesData = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        date: docSnap.data().date.toDate(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
      })) as Expense[];
      
      setExpenses(expensesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    return () => unsubscribe();
  }, [user]);

  const handleOpenDialog = (expense?: Expense) => {
    setErrors({});
    if (expense) {
      setEditingExpense(expense);
      setAmount(expense.amount.toString());
      setDate(format(expense.date, 'yyyy-MM-dd'));
      setCategory(expense.category);
      setDescription(expense.description);
      setVendor(expense.vendor || '');
    } else {
      setEditingExpense(null);
      setAmount('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setCategory('software');
      setDescription('');
      setVendor('');
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    const parsedAmount = parseFloat(amount);
    if (!amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!date) {
      newErrors.date = 'Date is required';
    } else if (isNaN(new Date(date).getTime())) {
      newErrors.date = 'Invalid date format';
    }

    if (!category) {
      newErrors.category = 'Category is required';
    } else if (!CATEGORIES.find(c => c.value === category) && category !== 'other') {
      newErrors.category = 'Invalid category selected';
    }

    if (!description || description.trim().length === 0) {
      newErrors.description = 'Description is required';
    } else if (description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    if (vendor && vendor.length > 100) {
      newErrors.vendor = 'Vendor must be less than 100 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const expenseData = {
        authorId: user!.uid,
        amount: parsedAmount,
        date: new Date(date),
        category,
        description,
        vendor,
        updatedAt: serverTimestamp()
      };

      if (editingExpense?.id) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), expenseData);
        toast.success('Expense updated successfully');
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...expenseData,
          createdAt: serverTimestamp()
        });
        toast.success('Expense added successfully');
      }
      setIsDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingExpense ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      toast.success('Expense deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const filteredExpenses = expenses.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Categorized expenses data
  const categoryData = CATEGORIES.map(cat => {
    const amount = filteredExpenses
      .filter(e => e.category === cat.value)
      .reduce((sum, e) => sum + e.amount, 0);
    return { name: cat.label, amount };
  }).filter(d => d.amount > 0).sort((a, b) => b.amount - a.amount);

  // Monthly trends data
  const monthlyDataMap = filteredExpenses.reduce((acc, expense) => {
    const monthYear = format(expense.date, 'MMM yyyy');
    if (!acc[monthYear]) {
      acc[monthYear] = { name: monthYear, amount: 0, date: expense.date };
    }
    acc[monthYear].amount += expense.amount;
    return acc;
  }, {} as Record<string, { name: string, amount: number, date: Date }>);

  const monthlyData = (Object.values(monthlyDataMap) as { name: string, amount: number, date: Date }[])
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ name, amount }) => ({ name, amount }));

  if (loading) return <div className="p-8 text-center">Loading expenses...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses (Filtered)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">${totalExpenses.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <div className="md:col-span-2 flex items-center space-x-2 bg-card p-2 rounded-lg border shadow-sm">
          <Search className="h-5 w-5 text-muted-foreground ml-2" />
          <Input 
            placeholder="Search expenses by description, vendor, or category..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 focus-visible:ring-0 shadow-none bg-transparent"
          />
        </div>
      </div>

      {filteredExpenses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `$${value}`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `$${value}`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No expenses found. Add your first expense to track your spending!</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredExpenses.map((expense) => (
              <div key={expense.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start sm:items-center space-x-4">
                  <div className="p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-lg">{expense.description}</p>
                    <div className="flex flex-wrap items-center text-sm text-muted-foreground gap-x-3 gap-y-1 mt-1">
                      <span className="flex items-center"><Calendar className="h-3 w-3 mr-1" /> {format(expense.date, 'MMM d, yyyy')}</span>
                      <span className="flex items-center capitalize"><Tag className="h-3 w-3 mr-1" /> {expense.category}</span>
                      {expense.vendor && <span className="flex items-center"><Building className="h-3 w-3 mr-1" /> {expense.vendor}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                  <div className="text-left sm:text-right">
                    <p className="font-bold text-foreground text-lg">${expense.amount.toFixed(2)}</p>
                  </div>
                  
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(expense)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(expense.id!)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount" className={errors.amount ? "text-destructive" : ""}>Amount *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="amount" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={amount} 
                  onChange={e => { setAmount(e.target.value); if (errors.amount) setErrors({...errors, amount: ''}); }} 
                  className={`pl-9 ${errors.amount ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  placeholder="0.00" 
                />
              </div>
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="date" className={errors.date ? "text-destructive" : ""}>Date *</Label>
              <Input 
                id="date" 
                type="date" 
                value={date} 
                onChange={e => { setDate(e.target.value); if (errors.date) setErrors({...errors, date: ''}); }} 
                className={errors.date ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category" className={errors.category ? "text-destructive" : ""}>Category *</Label>
              <Select 
                value={category} 
                onValueChange={(val) => { setCategory(val); if (errors.category) setErrors({...errors, category: ''}); }}
              >
                <SelectTrigger className={errors.category ? "border-destructive focus-visible:ring-destructive" : ""}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className={errors.description ? "text-destructive" : ""}>Description *</Label>
              <Input 
                id="description" 
                value={description} 
                onChange={e => { setDescription(e.target.value); if (errors.description) setErrors({...errors, description: ''}); }} 
                className={errors.description ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Monthly software subscription" 
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="vendor" className={errors.vendor ? "text-destructive" : ""}>Vendor (Optional)</Label>
              <Input 
                id="vendor" 
                value={vendor} 
                onChange={e => { setVendor(e.target.value); if (errors.vendor) setErrors({...errors, vendor: ''}); }} 
                className={errors.vendor ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="e.g. Adobe, AWS, Staples" 
              />
              {errors.vendor && <p className="text-xs text-destructive">{errors.vendor}</p>}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Expense</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
