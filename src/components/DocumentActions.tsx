import { useNavigate } from 'react-router-dom';
import { FinancialDocument, UserProfile } from '../types';
import { generatePDF } from '../lib/pdf';
import { deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { 
  MoreVertical, 
  Eye, 
  Edit2, 
  Download, 
  Share2, 
  Trash2 
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

interface DocumentActionsProps {
  document: FinancialDocument;
  profile: UserProfile | null;
}

export default function DocumentActions({ document, profile }: DocumentActionsProps) {
  const navigate = useNavigate();

  const handleDownload = async () => {
    try {
      await generatePDF(document, profile);
      toast.success('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleShare = () => {
    const text = `Here is your ${document.type} (${document.documentNumber}) for $${document.grandTotal.toFixed(2)}.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      if (!document.id) return;
      
      // If this document is linked to another, remove the link from the other document
      if (document.relatedDocumentId) {
        try {
          const relatedDocRef = doc(db, 'documents', document.relatedDocumentId);
          await updateDoc(relatedDocRef, {
            relatedDocumentId: '',
            relatedDocumentNumber: '',
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          console.error('Failed to remove link from related document:', err);
        }
      }

      await deleteDoc(doc(db, 'documents', document.id));
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => navigate(`/documents/view/${document.id}`)}>
          <Eye className="mr-2 h-4 w-4" />
          <span>View</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/documents/edit/${document.id}`)}>
          <Edit2 className="mr-2 h-4 w-4" />
          <span>Edit</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          <span>Download PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          <span>Share WhatsApp</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleDelete}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
