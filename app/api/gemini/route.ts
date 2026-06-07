import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    // 🚀 เปลี่ยนมารับข้อมูลเป็น FormData (รับไฟล์รูปตรงๆ ไม่ผ่าน JSON)
    const formData = await req.formData();
    const chatText = formData.get('chatText') as string;
    const members = formData.get('members') as string;
    const imageFile = formData.get('image') as File | null;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "ลืมใส่ API Key!" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `ทำตัวเป็นผู้ช่วยสกัดข้อมูลบิลค่าใช้จ่ายที่มีความแม่นยำสูง (Structured JSON Expense Extractor).
    มึงจะได้รับรายชื่อเพื่อนที่จะหารเงินกัน: [${members}].
    จงอ่านข้อความแชท หรือ สแกนรูปภาพใบเสร็จ/สลิปโอนเงิน ที่แนบมา แล้วแปลงเป็น JSON array เปล่าๆ ห้ามมีคำอธิบายอื่นปน:
    [{"item": "ชื่อรายการ", "price": ราคาเต็ม, "shared_by": ["ชื่อคน1", "ชื่อคน2"]}]
    
    กฎเหล็ก:
    1. ถ้าไม่ได้ระบุว่าใครหารรายการนั้น ให้ถือว่าทุกคนในรายชื่อต้องหารทั้งหมด.
    2. ถ้าแกะข้อมูลไม่ได้เลย ให้ตอบกลับมาเป็น JSON array ว่างๆ: [].
    3. ห้ามพูดพล่าม ให้ตอบกลับมาเป็น JSON เปล่าๆ เท่านั้น.
    
    ข้อมูลข้อความเพิ่มเติม (ถ้ามี):
    ---
    ${chatText || "ไม่มีข้อความพิมพ์มา ให้อ่านจากรูปภาพเป็นหลัก"}
    ---`;

    // เตรียมแพ็คเกจข้อมูล
    const parts: any[] = [prompt];

    // 🚀 ถ้ามีไฟล์รูปมา ให้ Node.js จัดการแปลงเป็น Base64 แบบคลีนๆ ฝั่ง Server
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: imageFile.type
        }
      });
    }

    const result = await model.generateContent(parts);
    const resultText = result.response.text();
    
    try {
        return NextResponse.json({ success: true, data: JSON.parse(resultText) });
    } catch (e) {
        return NextResponse.json({ success: true, data: [] });
    }

  } catch (error: any) {
    console.error("Backend Error:", error);
    return NextResponse.json({ success: false, error: "Backend พังว่ะ: " + error.message }, { status: 500 });
  }
}