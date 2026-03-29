import { collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { FinancialDocument } from '../types';
import { addDays, addWeeks, addMonths, addYears, isBefore, startOfDay } from 'date-fns';

export async function processRecurringDocuments(userId: string) {
  const q = query(
    collection(db, 'documents'),
    where('authorId', '==', userId),
    where('isRecurring', '==', true)
  );

  const snapshot = await getDocs(q);
  let generatedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as FinancialDocument;
    if (!data.nextRecurringDate) continue;

    let nextDate = (data.nextRecurringDate as any).toDate ? (data.nextRecurringDate as any).toDate() : new Date(data.nextRecurringDate);
    const endDate = data.recurringEndDate ? ((data.recurringEndDate as any).toDate ? (data.recurringEndDate as any).toDate() : new Date(data.recurringEndDate)) : null;
    const today = startOfDay(new Date());

    let currentDocNextDate = nextDate;
    let needsUpdate = false;

    // Generate invoices if past due
    while (isBefore(currentDocNextDate, today) || currentDocNextDate.getTime() === today.getTime()) {
      if (endDate && isBefore(endDate, currentDocNextDate)) {
        // Reached end date, turn off recurring
        await updateDoc(docSnap.ref, { isRecurring: false });
        needsUpdate = false;
        break;
      }

      // Create new invoice
      const newDocData = {
        ...data,
        isRecurring: false, // The generated invoice is not the recurring template itself
        documentNumber: `${data.type === 'invoice' ? 'INV' : data.type === 'proforma' ? 'PRO' : 'REC'}-${Date.now().toString().slice(-6)}`,
        date: currentDocNextDate,
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: serverTimestamp(),
      };
      delete newDocData.nextRecurringDate;
      delete newDocData.recurringEndDate;
      delete newDocData.recurringFrequency;
      delete newDocData.id;

      await addDoc(collection(db, 'documents'), newDocData);
      generatedCount++;

      // Calculate next date
      if (data.recurringFrequency === 'daily') currentDocNextDate = addDays(currentDocNextDate, 1);
      else if (data.recurringFrequency === 'weekly') currentDocNextDate = addWeeks(currentDocNextDate, 1);
      else if (data.recurringFrequency === 'monthly') currentDocNextDate = addMonths(currentDocNextDate, 1);
      else if (data.recurringFrequency === 'yearly') currentDocNextDate = addYears(currentDocNextDate, 1);
      else break; // fallback

      needsUpdate = true;
    }

    if (needsUpdate) {
      await updateDoc(docSnap.ref, {
        nextRecurringDate: currentDocNextDate,
      });
    }
  }

  return generatedCount;
}
