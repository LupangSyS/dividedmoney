import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const EXTRACT_PROMPT = `You are a receipt/menu reading assistant. Look at the provided image and/or text and extract every purchasable line item with its price.

Return ONLY a JSON array (no markdown fences, no commentary) of objects shaped like:
[{ "item": "string name of the item", "price": number }]

Rules:
- "price" must be a plain number in the local currency shown on the receipt (no currency symbols, no commas).
- Skip subtotal, tax, service charge, discount, and total lines unless the user's text explicitly asks to include them as line items.
- If both an image and text are provided, merge information from both; text can clarify or correct what's in the image.
- If nothing readable is found, return [].`;

async function extractItems(chatText: string, imageFile: File | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in environment');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const parts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[] = [
    { text: EXTRACT_PROMPT },
  ];

  if (chatText) {
    parts.push({ text: `Statement / notes from the user:\n${chatText}` });
  }

  if (imageFile) {
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    parts.push({
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: imageFile.type || 'image/jpeg',
      },
    });
  }

  const result = await model.generateContent(parts);
  const raw = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI did not return valid JSON');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed)) throw new Error('AI response was not a list of items');

  return (parsed as Record<string, unknown>[])
    .map((entry) => ({
      item: String(entry?.item ?? '').trim(),
      price: Number(entry?.price) || 0,
    }))
    .filter((entry) => entry.item.length > 0);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const action = formData.get('action');

    if (!action) {
      return NextResponse.json({ success: false, error: 'Action parameter missing' }, { status: 400 });
    }

    if (action === 'extract_items') {
      const chatText = (formData.get('chatText') as string) || '';
      const imageFile = formData.get('image') as File | null;

      if (!chatText && !imageFile) {
        return NextResponse.json({ success: false, error: 'Provide an image or text to extract from' }, { status: 400 });
      }

      const data = await extractItems(chatText, imageFile);
      return NextResponse.json({ success: true, data });
    }

    // save_history / load_history / clear_history are persisted to Google Sheets
    // via an Apps Script web app deployment. See google-apps-script/Code.gs.
    const gasUrl = process.env.NEXT_PUBLIC_GAS_URL;
    if (!gasUrl) {
      return NextResponse.json({ success: false, error: 'Missing NEXT_PUBLIC_GAS_URL in environment' }, { status: 500 });
    }

    const response = await fetch(gasUrl, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Backend Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
