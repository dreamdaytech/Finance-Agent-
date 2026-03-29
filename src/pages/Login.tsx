import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Navigate } from 'react-router-dom';
import { Calculator, AlertCircle } from 'lucide-react';

export default function Login() {
  const { user, loginWithGoogle, loading, isLoggingIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during login.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Finance Agent</CardTitle>
          <CardDescription>Your Smart Digital Accountant for Everyday Business</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-start space-x-3 text-sm">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <Button 
            className="w-full h-12 text-lg" 
            onClick={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Connecting...' : 'Continue with Google'}
          </Button>
          <p className="text-sm text-center text-muted-foreground mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
