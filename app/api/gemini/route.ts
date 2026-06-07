import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const action = formData.get('action');
    
    // ถ้าไม่มี action ส่งมาเลย อย่าพัง! ให้ส่ง 400 กลับไป
    if (!action) {
      return NextResponse.json({ success: false, error: "Action parameter missing" }, { status: 400 });
    }

    const gasUrl = process.env.NEXT_PUBLIC_GAS_URL;
    if (!gasUrl) {
      return NextResponse.json({ success: false, error: "Missing NEXT_PUBLIC_GAS_URL in environment" }, { status: 500 });
    }

    // ส่งต่อข้อมูลไปหา Google Apps Script
    const response = await fetch(gasUrl, {
      method: 'POST',
      body: formData // ส่ง FormData ต่อไปเลยให้ GAS ไปจัดการ
    });

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Backend Error:", error); // ดูใน Terminal ของมึงว่า Error คืออะไร
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}