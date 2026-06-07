'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Check, Copy, PackagePlus, Users, Wand2, ArrowLeftRight, ImagePlus, X, History, Trash2 } from 'lucide-react';

const Card = ({ children, title, icon: Icon, className = '' }: any) => (
  <div className={`bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl transition-all duration-300 hover:shadow-teal-900/20 hover:border-neutral-700 ${className}`}>
    <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
      {Icon && <Icon className="w-7 h-7 text-teal-400" />}
      <h2 className="text-2xl font-semibold text-neutral-100">{title}</h2>
    </div>
    {children}
  </div>
);

const Button = ({ children, icon: Icon, loading, className='', ...props }: any) => (
  <button 
    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-teal-500 text-neutral-950 font-bold text-lg transition-all duration-200 hover:bg-teal-400 hover:scale-[1.02] active:scale-95 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-teal-500/25 ${className}`} 
    disabled={loading} 
    {...props}
  >
    {loading ? <Wand2 className="w-5 h-5 animate-spin" /> : Icon && <Icon className="w-5 h-5" />}
    {children}
  </button>
);

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
  
  // State สำหรับรูปและ LocalStorage
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // โหลดประวัติจาก LocalStorage ตอนเปิดเว็บ
  useEffect(() => {
    const history = localStorage.getItem('khunthong_history');
    if (history) setSavedSessions(JSON.parse(history));
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
    if (!chatText && !imageFile) return alert('ใส่ข้อมูลมาก่อนดิ จะให้ AI นั่งเทียนรึไง!');
    if (masterMembers.length === 0) return alert('ใส่ชื่อเพื่อนด้วย!');
    
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
        // เซฟลง LocalStorage อัตโนมัติ
        saveToHistory(newItems);
      } else {
        alert(json.error || 'AI แกะไม่ออกว่ะ ลองใหม่');
      }
    } catch (err) {
      alert('เซิร์ฟเวอร์พัง หรือเน็ตมึงหลุด');
    }
    setLoading(false);
  };

  const saveToHistory = (items: ExpenseItem[]) => {
    const newSession = {
      id: Date.now(),
      date: new Date().toLocaleString('th-TH'),
      items: items,
      membersText: masterMembersText
    };
    const updatedHistory = [newSession, ...savedSessions].slice(0, 10); // เก็บแค่ 10 บิลล่าสุด
    setSavedSessions(updatedHistory);
    localStorage.setItem('khunthong_history', JSON.stringify(updatedHistory));
  };

  const loadSession = (session: any) => {
    setMasterMembersText(session.membersText);
    setBillItems(session.items);
  };

  // 🚀 Logic สรุปยอดและจัด Format ตามที่มึงขอเป๊ะๆ
  const calculatedBalance = useMemo(() => {
    if (billItems.length === 0) return { membersTotal: {}, outputText: '' };
    
    let membersTotal: { [name: string]: number } = {};
    masterMembers.forEach(m => membersTotal[m] = 0);
    
    let breakdownText = "📝 สรุปรายการ:\n";
    
    billItems.forEach(item => {
      if (item.shared_by.length > 0) {
        const splitPrice = item.price / item.shared_by.length;
        item.shared_by.forEach(m => membersTotal[m] += splitPrice);
        // แจกแจงรายการ (เช่น ตีแบดชั่วโมงแรก 1200 บาท : แปง เวฟ)
        breakdownText += `${item.item} ${item.price} บาท : ${item.shared_by.join(' ')}\n`;
      }
    });

    breakdownText += "\n💰 ยอดที่ต้องโอน:\n";
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
            <div className="p-3 bg-teal-900/30 rounded-2xl border border-teal-500/20">
              <Wand2 className="w-10 h-10 text-teal-400" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tighter text-neutral-50">
                Expense Splitter <span className="text-teal-400">Pro</span>
              </h1>
              <p className="text-neutral-400 mt-1">อัปโหลดบิล ให้ AI สแกน  สรุปยอดลงขุนทอง</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* ซ้าย: ตั้งค่า & ประวัติ */}
          <div className="lg:col-span-1 space-y-8">
            <Card title="1. รายชื่อตี้" icon={Users}>
              <input 
                type="text" 
                className="w-full p-4 border border-neutral-700 bg-neutral-950 rounded-xl text-neutral-100 focus:outline-none focus:border-teal-500 transition-colors" 
                value={masterMembersText} 
                onChange={(e) => setMasterMembersText(e.target.value)} 
              />
            </Card>

            <Card title="ประวัติบิล (เซฟในเครื่อง)" icon={History} className="bg-neutral-900/50 border-dashed">
              {savedSessions.length === 0 ? (
                <p className="text-neutral-500 text-sm text-center py-4">ยังไม่มีประวัติการหารเงิน</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {savedSessions.map((s) => (
                    <div key={s.id} onClick={() => loadSession(s)} className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-neutral-900 transition-all group">
                      <p className="text-sm font-bold text-neutral-200 group-hover:text-teal-400 transition-colors">{s.date}</p>
                      <p className="text-xs text-neutral-500 truncate">{s.items.map((i:any)=>i.item).join(', ')}</p>
                    </div>
                  ))}
                  <button onClick={() => {localStorage.removeItem('khunthong_history'); setSavedSessions([]);}} className="w-full py-2 text-sm text-red-400 hover:text-red-300 flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> ล้างประวัติ
                  </button>
                </div>
              )}
            </Card>
          </div>

          {/* กลาง: Input */}
          <div className="lg:col-span-1 space-y-8">
            <Card title="2. โยนบิลมา" icon={PackagePlus}>
              <textarea 
                className="w-full p-4 border border-neutral-700 bg-neutral-950 rounded-xl text-neutral-100 focus:outline-none focus:border-teal-500 transition-colors mb-4" 
                rows={3} 
                value={chatText} 
                onChange={(e) => setChatText(e.target.value)} 
                placeholder="แปะแชท หรือ สลิป..." 
              />
              <div className="mb-6">
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                {!imagePreview ? (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-neutral-700 rounded-xl hover:border-teal-500 hover:bg-neutral-800/50 transition-all flex flex-col items-center gap-2 text-neutral-400 hover:text-teal-400">
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-sm font-medium">แนบสลิป / บิล</span>
                  </button>
                ) : (
                  <div className="relative group rounded-xl border border-neutral-700 p-2 bg-neutral-950">
                    <img src={imagePreview} className="w-full h-32 object-cover rounded-lg opacity-80 group-hover:opacity-100 transition-opacity" alt="preview" />
                    <button onClick={removeImage} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full hover:bg-red-400 shadow-lg transform hover:scale-110 transition-all"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <Button onClick={handleAISplit} loading={loading} icon={Wand2} className="w-full shadow-teal-900/50">ประมวลผล</Button>
            </Card>
          </div>

          {/* ขวา: ตาราง & สรุป */}
          <div className="lg:col-span-2 space-y-8">
            <Card title="📋 เช็คลิสต์ (แก้ได้)" icon={Check}>
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
                      <tr><td colSpan={masterMembers.length + 2} className="p-8 text-center text-neutral-500">รอ AI สแกนข้อมูล...</td></tr>
                    ) : billItems.map(item => (
                      <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors group">
                        <td className="p-4"><input type="text" className="bg-transparent w-full outline-none focus:text-teal-400" defaultValue={item.item} /></td>
                        <td className="p-4"><input type="number" className="bg-transparent w-full outline-none text-right text-teal-400 font-mono" defaultValue={item.price} /></td>
                        {masterMembers.map(m => (
                          <td key={m} className="p-4 text-center border-l border-neutral-800/50">
                            <input 
                              type="checkbox" 
                              className="w-6 h-6 cursor-pointer accent-teal-500 rounded bg-neutral-900 border-neutral-700 transition-transform hover:scale-110" 
                              checked={item.shared_by.includes(m)}
                              onChange={() => toggleSharedBy(item.id, m)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="📊 สรุปยอด (ก๊อปส่งไลน์)" icon={ArrowLeftRight} className="border-t-4 border-t-teal-500">
              <div className="relative group">
                <textarea 
                  className="w-full p-5 border border-neutral-700 bg-neutral-950 rounded-2xl text-neutral-200 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono leading-relaxed resize-none" 
                  rows={8} 
                  value={calculatedBalance.outputText} 
                  readOnly 
                />
                <Button 
                  onClick={() => { navigator.clipboard.writeText(calculatedBalance.outputText); alert('ก๊อปปี้เรียบร้อย!'); }} 
                  disabled={!calculatedBalance.outputText} 
                  icon={Copy} 
                  className='absolute bottom-4 right-4 bg-neutral-800 text-teal-400 border border-neutral-700 hover:bg-neutral-700 hover:text-teal-300 py-2 px-4 shadow-xl'
                >
                  Copy
                </Button>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </main>
  );
}