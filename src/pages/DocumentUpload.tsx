import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Upload, FileText, Loader2, ArrowLeft, X } from 'lucide-react';
import { extractDocumentData } from '../services/ocrService';
import { toast } from 'sonner';
import { FinancialDocument } from '../types';
import { Badge } from '../components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

export default function DocumentUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<Partial<FinancialDocument> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setPreview(base64);
        
        // Auto-classify and extract
        setLoading(true);
        try {
          const data = await extractDocumentData(base64, selectedFile.type);
          setExtractedData(data);
          toast.success(`Document classified as ${data.type}`);
        } catch (error) {
          console.error('Classification error:', error);
          toast.error('Failed to analyze document automatically.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setExtractedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProceed = () => {
    if (!extractedData) return;
    navigate('/documents/new', { state: { extractedData } });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Upload Document</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan Document</CardTitle>
          <CardDescription>
            Upload an image or PDF of an invoice or receipt. Our AI will extract the details for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!preview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center space-y-4 hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer"
            >
              <div className="bg-primary/10 p-4 rounded-full">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">PNG, JPG or PDF (max 5MB)</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border bg-muted/30 aspect-[3/4] max-h-[400px] flex items-center justify-center">
                {file?.type.includes('pdf') ? (
                  <div className="flex flex-col items-center space-y-2">
                    <FileText className="h-16 w-16 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">{file.name}</p>
                  </div>
                ) : (
                  <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                )}
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-2 right-2 rounded-full h-8 w-8"
                  onClick={clearFile}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {extractedData && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Classification Result</p>
                      <Badge variant="secondary" className="mt-1 capitalize">
                        {extractedData.type === 'proforma' ? 'Proforma Invoice' : extractedData.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-sm font-bold text-primary">High</p>
                  </div>
                </div>
              )}
              
              <Button 
                className="w-full h-12 text-lg" 
                onClick={handleProceed}
                disabled={loading || !extractedData}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing Document...
                  </>
                ) : (
                  extractedData ? 'Confirm & Proceed' : 'Waiting for analysis...'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start space-x-3">
        <div className="bg-primary/10 p-1 rounded">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="text-sm text-foreground">
          <p className="font-semibold text-primary">Pro Tip</p>
          <p className="text-muted-foreground">Make sure the document is well-lit and all text is clearly visible for the best results.</p>
        </div>
      </div>
    </div>
  );
}
