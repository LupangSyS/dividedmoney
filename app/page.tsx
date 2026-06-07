// Path: app/page.tsx
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Check, Copy, PackagePlus, Users, Wand2, ArrowLeftRight, ImagePlus, X, History, Trash2 } from 'lucide-react';

interface ExpenseItem {
  id: string;
  item: string;
  price: number;
  shared_by: string[];
}

export default function Home() {
  const [chatText, setChatText] = useState('');
  const [masterMembersText, setMasterMembersText] = useState('แปง, น้ำตาล, โอม, ปุณณ์');
  const [masterMembers, setMasterMembers] = useState<string[]>([]);
  const [billItems, setBillItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🚀 โหลดประวัติข้ามแพลตฟอร์มจาก Google Sheets ตั้งแต่เปิดเว็บ
  const loadHistoryFromSheets = async () => {
    setHistoryLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'load_history');
      const res = await fetch('/api/gemini', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) setSavedSessions(json.history || []);
    } catch (err) {
      console.error('โหลดประวัติพัง:', err);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    loadHistoryFromSheets();
  }, []);

  useEffect(() => {
    setMasterMembers(masterMembersText.split(',').map(s => s.trim()).filter(s => s));
  }, [masterMembersText]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert('ไฟล์รูปใหญ่เกิน 5MB');
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAISplit = async () => {
    if (!chatText && !imageFile) return alert('กรุณาใส่ข้อมูลเพื่อประมวลผล');
    if (masterMembers.length === 0) return alert('กรุณาระบุชื่อสมาชิก');
    
    setLoading(true);
    const formData = new FormData();
    formData.append('chatText', chatText);
    formData.append('members', masterMembersText);
    if (imageFile) formData.append('image', imageFile);

    try {
      const res = await fetch('/api/gemini', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        const newItems = json.data.map((item: any, i: number) => ({ ...item, id: `item_${Date.now()}_${i}` }));
        setBillItems(newItems);
        
        // 🚀 สั่งเซฟลงคลาวด์ Google Sheets
        await saveToSheetsCloud(newItems);
      } else {
        alert(json.error || 'ระบบไม่สามารถสกัดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
    setLoading(false);
  };

  const saveToSheetsCloud = async (items: ExpenseItem[]) => {
    try {
      const newSession = {
        id: Date.now(),
        date: new Date().toLocaleString('th-TH'),
        items: items,
        membersText: masterMembersText
      };
      const formData = new FormData();
      formData.append('action', 'save_history');
      formData.append('session', JSON.stringify(newSession));
      
      await fetch('/api/gemini', { method: 'POST', body: formData });
      loadHistoryFromSheets(); // อัปเดตลิสต์ประวัติหน้าจอ
    } catch (e) {
      console.error('เซฟลง Sheet ไม่ติด:', e);
    }
  };

  const clearHistoryCloud = async () => {
    if (!confirm('ต้องการลบประวัติทั้งหมดบน Google Sheets ใช่หรือไม่?')) return;
    setHistoryLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'clear_history');
      await fetch('/api/gemini', { method: 'POST', body: formData });
      setSavedSessions([]);
    } catch (e) {
      alert('ลบไม่สำเร็จ');
    }
    setHistoryLoading(false);
  };

  const loadSession = (session: any) => {
    setMasterMembersText(session.membersText);
    setBillItems(session.items);
  };

  const calculatedBalance = useMemo(() => {
    if (billItems.length === 0) return { membersTotal: {}, outputText: '' };
    let membersTotal: { [name: string]: number } = {};
    masterMembers.forEach(m => membersTotal[m] = 0);
    let breakdownText = "📝 สรุปรายการค่าใช้จ่าย:\n";
    
    billItems.forEach(item => {
      if (item.shared_by.length > 0) {
        const splitPrice = item.price / item.shared_by.length;
        item.shared_by.forEach(m => membersTotal[m] += splitPrice);
        breakdownText += `${item.item} ${item.price} บาท : ${item.shared_by.join(' ')}\n`;
      }
    });

    breakdownText += "\n💰 สรุปยอดที่ต้องเรียกเก็บเงิน:\n";
    const netTotals = Object.entries(membersTotal).map(([name, amount]) => ({ name, amount }));
    const netOwes = netTotals.filter(t => t.amount > 0).map(t => `@${t.name} ${Math.ceil(t.amount)}`).join('\n');
    return { membersTotal, outputText: breakdownText + netOwes };
  }, [billItems, masterMembers]);

  const toggleSharedBy = (itemId: string, memberName: string) => {
    setBillItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const isSharing = item.shared_by.includes(memberName);
        const newSharedBy = isSharing ? item.shared_by.filter(m => m !== memberName) : [...item.shared_by, memberName];
        return { ...item, shared_by: newSharedBy };
      }
      return item;
    }));
  };

  return (
    <main className="min-h-screen p-6 md:p-12 bg-neutral-950 text-neutral-100 font-sans selection:bg-teal-900 selection:text-teal-100">
      <div className="max-w-[1700px] mx-auto space-y-12">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-neutral-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-900/30 rounded-2xl border border-teal-500/20"><Wand2 className="w-10 h-10 text-teal-400" /></div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tighter text-neutral-50">Expense Splitter <span className="text-teal-400">Pro Cloud</span></h1>
              <p className="text-neutral-400 mt-1">ระบบคำนวณบิลแชร์ข้อมูลข้ามแพลตฟอร์มผ่านคลาวด์แบบปลอดภัย</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <Card title="1. รายชื่อตี้สมาชิก" icon={Users}>
              <input type="text" className="w-full p-4 border border-neutral-700 bg-neutral-950 rounded-xl text-neutral-100 focus:outline-none focus:border-teal-500" value={masterMembersText} onChange={(e) => setMasterMembersText(e.target.value)} />
            </Card>

            <Card title="ประวัติบิลย้อนหลัง (Cloud)" icon={History} className="bg-neutral-900/50 border-dashed">
              {historyLoading ? (
                <p className="text-neutral-400 text-sm text-center py-4 animate-pulse">กำลังซิงค์ข้อมูลกับกูเกิ้ลชีท...</p>
              ) : savedSessions.length === 0 ? (
                <p className="text-neutral-500 text-sm text-center py-4">ไม่มีประวัติบนคลาวด์</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {savedSessions.map((s) => (
                    <div key={s.id} onClick={() => loadSession(s)} className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-neutral-900 transition-all group">
                      <p className="text-sm font-bold text-neutral-200 group-hover:text-teal-400 transition-colors">{s.date}</p>
                      <p className="text-xs text-neutral-500 truncate">{s.items.map((i:any)=>i.item).join(', ')}</p>
                    </div>
                  ))}
                  <button onClick={clearHistoryCloud} className="w-full py-2 text-sm text-red-400 hover:text-red-300 flex items-center justify-center gap-2 mt-2"><Trash2 className="w-4 h-4" /> ล้างคลาวด์</button>
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-8">
            <Card title="2. นำเข้าใบเสร็จ / แชท" icon={PackagePlus}>
              <textarea className="w-full p-4 border border-neutral-700 bg-neutral-950 rounded-xl text-neutral-100 focus:outline-none focus:border-teal-500 mb-4" rows={3} value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="พิมพ์ข้อความแชทที่นี่..." />
              <div className="mb-6">
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                {!imagePreview ? (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-neutral-700 rounded-xl hover:border-teal-500 hover:bg-neutral-800/50 transition-all flex flex-col items-center gap-2 text-neutral-400 hover:text-teal-400">
                    <ImagePlus className="w-8 h-8" /><span className="text-sm font-medium">แนบรูปใบเสร็จ / สลิปโอนเงิน</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl border border-neutral-700 p-2 bg-neutral-950">
                    <img src={imagePreview} className="w-full h-32 object-cover rounded-lg" alt="preview" />
                    <button onClick={removeImage} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full hover:bg-red-400 shadow-lg"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <button onClick={handleAISplit} disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-teal-500 text-neutral-950 font-bold text-lg hover:bg-teal-400 disabled:bg-neutral-800 transition shadow-lg">{loading ? 'กำลังสแกน...' : 'ประมวลผลข้อมูลด้วย AI'}</button>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <Card title="📋 รายการค่าใช้จ่าย" icon={Check}>
              <div className='overflow-x-auto rounded-2xl border border-neutral-800'>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-neutral-950 text-neutral-400 text-sm">
                    <tr>
                      <th className="p-4 font-semibold">รายการ</th>
                      <th className="p-4 font-semibold w-24 text-right">ราคา</th>
                      {masterMembers.map(m => <th key={m} className="p-4 text-center font-semibold border-l border-neutral-800/50">{m}</th>)}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-neutral-800/50 text-neutral-200'>
                    {billItems.length === 0 ? (
                      <tr><td colSpan={masterMembers.length + 2} className="p-8 text-center text-neutral-500">ไม่มีข้อมูลรายการค่าใช้จ่าย</td></tr>
                    ) : billItems.map(item => (
                      <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="p-4"><input type="text" className="bg-transparent w-full outline-none focus:text-teal-400" defaultValue={item.item} /></td>
                        <td className="p-4"><input type="number" className="bg-transparent w-full outline-none text-right text-teal-400 font-mono" defaultValue={item.price} /></td>
                        {masterMembers.map(m => (
                          <td key={m} className="p-4 text-center border-l border-neutral-800/50">
                            <input type="checkbox" className="w-6 h-6 cursor-pointer accent-teal-500 rounded bg-neutral-900 border-neutral-700" checked={item.shared_by.includes(m)} onChange={() => toggleSharedBy(item.id, m)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="📊 ผลลัพธ์สำหรับส่งแอปขุนทอง" icon={ArrowLeftRight} className="border-t-4 border-t-teal-500">
              <div className="relative">
                <textarea className="w-full p-5 border border-neutral-700 bg-neutral-950 rounded-2xl text-neutral-200 text-sm font-mono leading-relaxed resize-none" rows={6} value={calculatedBalance.outputText} readOnly />
                <button onClick={() => { navigator.clipboard.writeText(calculatedBalance.outputText); alert('คัดลอกข้อความสรุปแล้ว'); }} disabled={!calculatedBalance.outputText} className='absolute bottom-4 right-4 bg-neutral-800 text-teal-400 border border-neutral-700 hover:bg-neutral-700 py-2 px-4 rounded-xl text-sm font-bold shadow-xl transition-all'>คัดลอกข้อความ</button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}