import { GoogleGenAI, Type } from "@google/genai";
import { FinancialDocument, LineItem, DocumentType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractDocumentData(base64Data: string, mimeType: string): Promise<Partial<FinancialDocument>> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this document and categorize it as one of the following: 'invoice', 'receipt', or 'proforma'.
  Then, extract the following information:
  - Document Type (must be one of: 'invoice', 'receipt', 'proforma')
  - Document Number
  - Date (YYYY-MM-DD)
  - Customer Name
  - Customer Contact (Phone or Email)
  - Items (Name/Description, Quantity, Unit Price)
  
  Classification Guidelines:
  - 'invoice': A formal request for payment for goods or services already provided.
  - 'receipt': A document confirming that payment has been received.
  - 'proforma': A preliminary bill or estimated invoice sent in advance of a shipment or delivery of goods.
  
  Return the data in JSON format.`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            data: base64Data.split(',')[1] || base64Data,
            mimeType,
          },
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["invoice", "receipt", "proforma"] },
          documentNumber: { type: Type.STRING },
          date: { type: Type.STRING },
          customerName: { type: Type.STRING },
          customerContact: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unitPrice: { type: Type.NUMBER },
              },
            },
          },
        },
      },
    },
  });

  try {
    const data = JSON.parse(response.text);
    const items: LineItem[] = (data.items || []).map((item: any, index: number) => ({
      id: `extracted-${index}-${Date.now()}`,
      name: item.name || "",
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      costPrice: 0,
      total: (item.quantity || 1) * (item.unitPrice || 0),
      profit: (item.quantity || 1) * (item.unitPrice || 0),
    }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    return {
      type: (data.type as DocumentType) || "invoice",
      documentNumber: data.documentNumber || "",
      date: data.date ? new Date(data.date) : new Date(),
      customerName: data.customerName || "",
      customerContact: data.customerContact || "",
      items,
      subtotal,
      grandTotal: subtotal,
      totalCost: 0,
      totalProfit: subtotal,
    };
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Failed to extract data from document");
  }
}
