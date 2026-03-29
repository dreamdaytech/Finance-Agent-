/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentCreate from './pages/DocumentCreate';
import DocumentEdit from './pages/DocumentEdit';
import DocumentView from './pages/DocumentView';
import DocumentUpload from './pages/DocumentUpload';
import Profile from './pages/Profile';
import Customers from './pages/Customers';
import CustomerView from './pages/CustomerView';
import Products from './pages/Products';
import Expenses from './pages/Expenses';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from './components/ThemeProvider';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="finance-agent-theme">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="documents" element={<Documents />} />
              <Route path="documents/new" element={<DocumentCreate />} />
              <Route path="documents/edit/:id" element={<DocumentEdit />} />
              <Route path="documents/view/:id" element={<DocumentView />} />
              <Route path="documents/upload" element={<DocumentUpload />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/:id" element={<CustomerView />} />
              <Route path="products" element={<Products />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Routes>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

