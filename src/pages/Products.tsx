import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Plus, Search, Package, Trash2, Edit2, DollarSign, ArrowDownRight, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'products'),
      where('authorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
      })) as Product[];
      
      setProducts(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name);
      setDescription(product.description || '');
      setUnitPrice(product.unitPrice);
      setCostPrice(product.costPrice);
    } else {
      setEditingProduct(null);
      setName('');
      setDescription('');
      setUnitPrice(0);
      setCostPrice(0);
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name) {
      toast.error('Product name is required');
      return;
    }

    try {
      const productData = {
        authorId: user.uid,
        name,
        description,
        unitPrice,
        costPrice,
        createdAt: editingProduct ? editingProduct.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editingProduct?.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        toast.success('Product updated successfully');
      } else {
        await addDoc(collection(db, 'products'), productData);
        toast.success('Product added successfully');
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('Product deleted successfully');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Loading products...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Products & Services</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground ml-2" />
        <Input 
          placeholder="Search products..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-0 focus-visible:ring-0 shadow-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-card rounded-xl border border-dashed">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No products found. Add your first product or service to get started!</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold text-foreground">{product.name}</CardTitle>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(product)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(product.id!)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Unit Price</p>
                    <div className="flex items-center text-lg font-bold text-foreground">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {product.unitPrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Cost Price</p>
                    <div className="flex items-center text-lg font-bold text-muted-foreground">
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                      {product.costPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="text-xs text-green-700 dark:text-green-500 font-semibold uppercase tracking-wider">Estimated Profit</span>
                  <div className="flex items-center text-green-700 dark:text-green-500 font-bold">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    ${(product.unitPrice - product.costPrice).toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Product/Service Name *</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Consultation Fee" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Hourly consultation rate" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unitPrice">Selling Price ($)</Label>
              <Input id="unitPrice" type="number" value={unitPrice || ''} onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)} placeholder="100.00" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="costPrice">Cost Price ($)</Label>
              <Input id="costPrice" type="number" value={costPrice || ''} onChange={e => setCostPrice(parseFloat(e.target.value) || 0)} placeholder="50.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingProduct ? 'Update' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
