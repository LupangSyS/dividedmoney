// Path: app/api/gemini/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const action = formData.get('action') as string;

    // 🚀 เพิ่มเติม: ถ้าหน้าบ้านสั่งให้เซฟ/โหลด ข้อมูลประวัติบิล ให้ส่งต่อไปหา Google Sheets API
    if (action === 'save_history' || action === 'load_history' || action === 'clear_history') {
      const gasUrl = process.env.NEXT_PUBLIC_GAS_URL;
      if (!gasUrl) return NextResponse.json({ success: false, error: "ไม่ได้ตั้งค่า GAS URL หลังบ้าน" });

      let bodyData = {};
      if (action === 'save_history') {
        bodyData = { action: 'save', session: JSON.parse(formData.get('session') as string) };
      } else if (action === 'load_history') {
        bodyData = { action: 'load' };
      } else if (action === 'clear_history') {
        bodyData = { action: 'clear' };
      }

      const gasRes = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      const gasJson = await gasRes.json();
      return NextResponse.json(gasJson);
    }

    // --- ส่วนของ Gemini AI สแกนบิลเดิม (คงไว้ห้ามลบ) ---
    const chatText = formData.get('chatText') as string;
    const members = formData.get('members') as string;
    const imageFile = formData.get('image') as File | null;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ success: false, error: "ลืมใส่ API Key" }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `ทำตัวเป็นผู้ช่วยสกัดข้อมูลบิลค่าใช้จ่ายที่มีความแม่นยำสูง (Structured JSON Expense Extractor).
    มึงจะได้รับรายชื่อเพื่อนที่จะหารเงินกัน: [${members}].
    จงอ่านข้อความแชท หรือ สแกนรูปภาพใบเสร็จ/สลิปโอนเงิน ที่แนบมา แล้วแปลงเป็น JSON array เปล่าๆ ห้ามมีคำอธิบายอื่นปน:
    [{"item": "ชื่อรายการ", "price": ราคาเต็ม, "shared_by": ["ชื่อคน1", "ชื่อคน2"]}]
    กฎเหล็ก: ถ้ารายการไหนไม่ได้ระบุว่าใครหาร ให้ถือว่าทุกคนต้องหารทั้งหมด ห้ามพูดพล่าม ให้ตอบกลับมาเป็น JSON เปล่าๆ เท่านั้น`;

    const parts: any[] = [prompt];
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      parts.push({ inlineData: { data: base64Data, mimeType: imageFile.type } });
    }

    const result = await model.generateContent(parts);
    const resultText = result.response.text();
    return NextResponse.json({ success: true, data: JSON.parse(resultText) });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}