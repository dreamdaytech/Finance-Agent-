import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { Building2, Mail, User, Image as ImageIcon, Save, Loader2, Database, Trash2 } from 'lucide-react';
import { seedSampleData, clearUserData } from '../services/seedService';

export default function Profile() {
  const { user, profile } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.businessName || '');
      setLogoUrl(profile.logoUrl || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        businessName,
        logoUrl,
        updatedAt: new Date(),
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    if (!user) return;
    setIsDemoLoading(true);
    const toastId = toast.loading('Generating realistic sample data...');
    try {
      await seedSampleData(user.uid);
      toast.success('Sample data generated successfully!', { id: toastId });
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error('Failed to generate sample data.', { id: toastId });
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to clear ALL your data? This cannot be undone.')) return;
    
    setIsDemoLoading(true);
    const toastId = toast.loading('Clearing all data...');
    try {
      await clearUserData(user.uid);
      toast.success('All data cleared successfully!', { id: toastId });
    } catch (error) {
      console.error('Error clearing data:', error);
      toast.error('Failed to clear data.', { id: toastId });
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Business Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your business information for documents and letterheads.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">General Information</CardTitle>
          <CardDescription>This information will appear on your generated invoices and receipts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="name" value={profile?.name || ''} disabled className="pl-10 bg-muted/50" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="email" value={profile?.email || ''} disabled className="pl-10 bg-muted/50" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                id="businessName" 
                placeholder="e.g. Acme Corp" 
                value={businessName} 
                onChange={(e) => setBusinessName(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL (Letterhead)</Label>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                id="logoUrl" 
                placeholder="https://example.com/logo.png" 
                value={logoUrl} 
                onChange={(e) => setLogoUrl(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">Provide a public URL for your business logo or letterhead image.</p>
          </div>

          {logoUrl && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Preview</p>
              <div className="h-24 flex items-center justify-center bg-card rounded border overflow-hidden">
                <img 
                  src={logoUrl} 
                  alt="Logo Preview" 
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/200x100?text=Invalid+URL';
                  }}
                />
              </div>
            </div>
          )}

          <Button className="w-full" onClick={handleSave} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm border-dashed border-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Demo Tools
          </CardTitle>
          <CardDescription>Populate your account with sample data to explore the platform's features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={handleSeedData}
              disabled={isDemoLoading}
            >
              <Database className="mr-2 h-4 w-4" />
              Generate Sample Data
            </Button>
            <Button 
              variant="ghost" 
              className="text-destructive hover:text-destructive hover:bg-destructive/10" 
              onClick={handleClearData}
              disabled={isDemoLoading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Data
            </Button>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Note: Generating sample data will add customers, products, expenses, and documents to your account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
