import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialDocument, UserProfile } from '../types';
import { format } from 'date-fns';

export const generatePDF = async (originalDoc: FinancialDocument, profile: UserProfile | null) => {
  // Sanitize document data for older documents
  const doc: FinancialDocument = {
    ...originalDoc,
    discount: originalDoc.discount || 0,
    tax: originalDoc.tax || 0,
    amountPaid: originalDoc.amountPaid || 0,
    balance: originalDoc.balance ?? (originalDoc.grandTotal - (originalDoc.amountPaid || 0)),
    customDetails: originalDoc.customDetails || [],
    customCustomerDetails: originalDoc.customCustomerDetails || [],
    customTotals: originalDoc.customTotals || []
  };

  const pdf = new jsPDF();
  
  // Add Logo if exists
  let logoAdded = false;
  if (profile?.logoUrl) {
    try {
      const img = new Image();
      img.src = profile.logoUrl;
      img.crossOrigin = 'Anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Add logo at top right
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = canvas.toDataURL('image/png');
        // Calculate dimensions to fit (max 40x20mm)
        const ratio = img.width / img.height;
        let w = 40;
        let h = 40 / ratio;
        if (h > 20) {
          h = 20;
          w = 20 * ratio;
        }
        pdf.addImage(imgData, 'PNG', 196 - w, 10, w, h);
        logoAdded = true;
      }
    } catch (e) {
      console.error('Error adding logo to PDF:', e);
    }
  }

  // Header
  pdf.setFontSize(20);
  pdf.setTextColor(40, 40, 40);
  pdf.text(doc.type.toUpperCase(), 14, 22);
  
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Document #: ${doc.documentNumber}`, 14, 30);
  pdf.text(`Date: ${format(doc.date, 'MMM d, yyyy')}`, 14, 36);
  if (doc.referenceNumber) {
    pdf.text(`Ref: ${doc.referenceNumber}`, 14, 42);
  }
  if (doc.projectName) {
    pdf.text(`Project: ${doc.projectName}`, 14, 48);
  }
  
  let detailsY = 48;
  if (doc.customDetails) {
    doc.customDetails.forEach(field => {
      detailsY += 6;
      pdf.text(`${field.label}: ${field.value}`, 14, detailsY);
    });
  }

  // Business Info (Right aligned)
  const businessName = profile?.businessName || profile?.name || 'Your Business';
  pdf.setFontSize(12);
  pdf.setTextColor(40, 40, 40);
  // Adjust Y if logo was added
  const businessY = logoAdded ? 35 : 22;
  pdf.text(businessName, 196, businessY, { align: 'right' });
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(profile?.email || '', 196, businessY + 8, { align: 'right' });

  // Customer Info
  pdf.setFontSize(12);
  pdf.setTextColor(40, 40, 40);
  pdf.text('Bill To:', 14, 60);
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  let customerY = 66;
  pdf.text(doc.customerName, 14, customerY);
  if (doc.customerContact) {
    customerY += 6;
    pdf.text(doc.customerContact, 14, customerY);
  }
  if (doc.customerAddress) {
    customerY += 6;
    const addressLines = pdf.splitTextToSize(doc.customerAddress, 80);
    pdf.text(addressLines, 14, customerY);
    customerY += (addressLines.length * 5);
  }
  if (doc.customerTaxId) {
    customerY += 6;
    pdf.text(`TIN: ${doc.customerTaxId}`, 14, customerY);
  }
  if (doc.customCustomerDetails) {
    doc.customCustomerDetails.forEach(field => {
      customerY += 6;
      pdf.text(`${field.label}: ${field.value}`, 14, customerY);
    });
  }

  // Items Table
  const tableData = doc.items.map(item => [
    item.name,
    item.quantity.toString(),
    `$${item.unitPrice.toFixed(2)}`,
    `$${item.total.toFixed(2)}`
  ]);

  autoTable(pdf, {
    startY: Math.max(customerY + 10, 85),
    head: [['Item Description', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202] },
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
    }
  });

  // Totals
  const finalY = (pdf as any).lastAutoTable.finalY || 150;
  
  pdf.setFontSize(10);
  pdf.setTextColor(40, 40, 40);
  
  let currentY = finalY + 10;
  
  pdf.text('Subtotal:', 140, currentY);
  pdf.text(`$${doc.subtotal.toFixed(2)}`, 196, currentY, { align: 'right' });
  
  const isPercentageDiscount = doc.type === 'invoice' || doc.type === 'proforma';
  const discountAmount = isPercentageDiscount ? doc.subtotal * (doc.discount / 100) : doc.discount;

  if (doc.discount > 0) {
    currentY += 8;
    pdf.text(`Discount${isPercentageDiscount ? ` (${doc.discount}%)` : ''}:`, 140, currentY);
    pdf.text(`-$${discountAmount.toFixed(2)}`, 196, currentY, { align: 'right' });
  }
  
  if (doc.tax > 0) {
    currentY += 8;
    pdf.text('Tax:', 140, currentY);
    pdf.text(`$${doc.tax.toFixed(2)}`, 196, currentY, { align: 'right' });
  }

  currentY += 10;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Grand Total:', 140, currentY);
  pdf.text(`$${doc.grandTotal.toFixed(2)}`, 196, currentY, { align: 'right' });

  if (doc.amountPaid > 0) {
    currentY += 10;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Amount Paid:', 140, currentY);
    pdf.text(`$${doc.amountPaid.toFixed(2)}`, 196, currentY, { align: 'right' });
  }

  currentY += 10;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Balance Due:', 140, currentY);
  pdf.text(`$${doc.balance.toFixed(2)}`, 196, currentY, { align: 'right' });

  if (doc.customTotals) {
    doc.customTotals.forEach(field => {
      currentY += 8;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${field.label}:`, 140, currentY);
      pdf.text(field.value, 196, currentY, { align: 'right' });
    });
  }

  // Footer
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(150, 150, 150);
  pdf.text('Thank you for your business!', 105, 280, { align: 'center' });

  // Save PDF
  pdf.save(`${doc.type}-${doc.documentNumber}.pdf`);
};
