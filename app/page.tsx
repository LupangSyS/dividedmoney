// Path: app/page.tsx
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Check, Copy, PackagePlus, Users, Wand2, ArrowLeftRight, ImagePlus, X, History, Trash2, ShieldCheck, Activity, Wallet } from 'lucide-react';

interface ExpenseItem {
  id: string;
  item: string;
  price: number;
  shared_by: string[];
}

export default function Home() {
  const [chatText, setChatText] = useState('');
  const [masterMembersText, setMasterMembersText] = useState('Pang, Charlotte, Oliver, Arthur');
  const [masterMembers, setMasterMembers] = useState<string[]>([]);
  const [billItems, setBillItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize history from Google Sheets Cloud Architecture
  const loadHistoryFromSheets = async () => {
    setHistoryLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'load_history');
      const res = await fetch('/api/gemini', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) setSavedSessions(json.history || []);
    } catch (err) {
      console.error('Cloud synchronization failed:', err);
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
      if (file.size > 5 * 1024 * 1024) return alert('File size exceeds the 5MB tier-1 luxury limit.');
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
    if (!chatText && !imageFile) return alert('Please provide a premium invoice image or statement text.');
    if (masterMembers.length === 0) return alert('Please specify the high-net-worth members.');
    
    setLoading(true);
    const formData = new FormData();
    formData.append('chatText', chatText);
    formData.append('members', masterMembersText);
    if (imageFile) formData.append('image', imageFile);

    try {
      const res = await fetch('/api/gemini', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        const newItems = json.data.map((item: any, i: number) => ({
          id: `item_${Date.now()}_${i}`,
          item: item.item || 'Premium General Ledger Item',
          price: Number(item.price) || 0,
          shared_by: item.shared_by || []
        }));
        setBillItems(newItems);
        await saveToSheetsCloud(newItems);
      } else {
        alert(json.error || 'AI interpretation failed. Please refine the luxury statement.');
      }
    } catch (err) {
      alert('Cloud gateway validation error.');
    }
    setLoading(false);
  };

  const saveToSheetsCloud = async (items: ExpenseItem[]) => {
    try {
      const newSession = {
        id: Date.now(),
        date: new Date().toLocaleString('en-US', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        items: items,
        membersText: masterMembersText
      };
      const formData = new FormData();
      formData.append('action', 'save_history');
      formData.append('session', JSON.stringify(newSession));
      
      await fetch('/api/gemini', { method: 'POST', body: formData });
      loadHistoryFromSheets(); 
    } catch (e) {
      console.error('Cloud asset synchronizing failure:', e);
    }
  };

  const handleItemChange = (itemId: string, field: 'item' | 'price', value: any) => {
    setBillItems(prev => {
      const updated = prev.map(item => {
        if (item.id === itemId) {
          return { 
            ...item, 
            [field]: field === 'price' ? (Number(value) || 0) : value 
          };
        }
        return item;
      });
      saveToSheetsCloud(updated);
      return updated;
    });
  };

  const toggleSharedBy = (itemId: string, memberName: string) => {
    setBillItems(prev => {
      const updated = prev.map(item => {
        if (item.id === itemId) {
          const isSharing = item.shared_by.includes(memberName);
          const newSharedBy = isSharing ? item.shared_by.filter(m => m !== memberName) : [...item.shared_by, memberName];
          return { ...item, shared_by: newSharedBy };
        }
        return item;
      });
      saveToSheetsCloud(updated);
      return updated;
    });
  };

  const clearHistoryCloud = async () => {
    if (!confirm('Are you sure you want to permanently purge all sovereign database records from the cloud architecture?')) return;
    setHistoryLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'clear_history');
      await fetch('/api/gemini', { method: 'POST', body: formData });
      setSavedSessions([]);
      setBillItems([]);
    } catch (e) {
      alert('Purge deployment aborted.');
    }
    setHistoryLoading(false);
  };

  const loadSession = (session: any) => {
    setMasterMembersText(session.membersText);
    setBillItems(session.items);
  };

  // Advanced financial calculations & text compiler
  const calculatedBalance = useMemo(() => {
    let membersTotal: { [name: string]: number } = {};
    masterMembers.forEach(m => membersTotal[m] = 0);
    
    let grossPoolValue = 0;
    let breakdownText = "👑 AURA SPLIT - SOVEREIGN ASSET DISBURSAL:\n=========================================\n";
    
    billItems.forEach(item => {
      if (item.shared_by.length > 0) {
        const splitPrice = item.price / item.shared_by.length;
        grossPoolValue += item.price;
        item.shared_by.forEach(m => {
          if (membersTotal[m] !== undefined) membersTotal[m] += splitPrice;
        });
        breakdownText += `• ${item.item}: ฿${item.price.toLocaleString()} → [ ${item.shared_by.join(', ')} ]\n`;
      }
    });

    breakdownText += "\n💰 LIQUIDATION DIRECTIVES:\n-----------------------------------------\n";
    const netTotals = Object.entries(membersTotal).map(([name, amount]) => ({ name, amount }));
    const netOwes = netTotals.filter(t => t.amount > 0).map(t => `@${t.name} ฿${Math.ceil(t.amount).toLocaleString()}`).join('\n');
    
    return { membersTotal, grossPoolValue, outputText: breakdownText + netOwes };
  }, [billItems, masterMembers]);

  return (
    <main className="min-h-screen p-6 md:p-12 bg-neutral-950 text-neutral-100 font-sans selection:bg-teal-900 selection:text-teal-100 antialiased">
      <div className="max-w-[1700px] mx-auto space-y-12">
        
        {/* Luxury Dynamic Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-neutral-900">
          <div className="flex items-center gap-5">
            <div className="p-3.5 bg-gradient-to-br from-teal-500/20 to-emerald-500/5 rounded-3xl border border-teal-500/30 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-400/10 to-transparent animate-pulse" />
              <Wand2 className="w-10 h-10 text-teal-400 drop-shadow-[0_0_15px_rgba(20,184,166,0.5)]" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight text-neutral-50 bg-clip-text bg-gradient-to-r from-neutral-50 via-neutral-200 to-neutral-400">
                  AURA <span className="text-teal-400 font-light tracking-widest">SPLIT</span>
                </h1>
                <span className="px-3 py-1 text-[10px] uppercase font-bold tracking-widest bg-teal-950/60 border border-teal-800/40 text-teal-400 rounded-full flex items-center gap-1.5 shadow-inner">
                  <ShieldCheck className="w-3 h-3" /> Sovereign Vault Active
                </span>
              </div>
              <p className="text-neutral-500 text-xs mt-1.5 uppercase tracking-[0.25em] font-semibold">Institutional Expense Harmonizer architecture</p>
            </div>
          </div>
        </header>

        {/* Core Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Section 1: Governance & Archives */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md transition-all hover:border-neutral-700/80">
              <div className="flex items-center gap-3 mb-5 text-neutral-400 font-bold tracking-widest text-xs uppercase"><Users className="w-4 h-4 text-teal-400" />1. Syndicate Registry</div>
              <p className="text-xs text-neutral-500 mb-3 leading-relaxed">Input individual stakeholder identities separated by a comma descriptor.</p>
              <input type="text" className="w-full p-4 border border-neutral-800 bg-neutral-950 rounded-xl text-neutral-100 focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500 font-mono text-sm tracking-wide transition-all shadow-inner" value={masterMembersText} onChange={(e) => setMasterMembersText(e.target.value)} />
            </div>

            <div className="bg-neutral-900/40 border border-dashed border-neutral-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-md transition-all hover:border-neutral-700/50">
              <div className="flex items-center gap-3 mb-5 text-neutral-400 font-bold tracking-widest text-xs uppercase"><History className="w-4 h-4 text-emerald-400" />Sovereign Ledger History</div>
              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-neutral-400 font-mono tracking-wider"><div className="w-2 h-2 rounded-full bg-teal-400 animate-ping"/>Syncing with global enterprise servers...</div>
              ) : savedSessions.length === 0 ? (
                <p className="text-neutral-600 text-xs text-center py-6 italic font-medium">No encrypted ledger streams detected on cloud vault.</p>
              ) : (
                <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                  {savedSessions.map((s) => (
                    <div key={s.id} onClick={() => loadSession(s)} className="p-4 bg-neutral-950/80 border border-neutral-800/80 rounded-xl cursor-pointer hover:border-teal-500/50 hover:bg-neutral-900 transition-all duration-200 group shadow-md hover:translate-x-1">
                      <p className="text-[10px] font-bold text-neutral-500 group-hover:text-teal-400 transition-colors font-mono tracking-wider">{s.date}</p>
                      <p className="text-xs text-neutral-300 truncate mt-1.5 font-medium">{s.items.map((i:any)=>i.item).join(', ')}</p>
                    </div>
                  ))}
                  <button onClick={clearHistoryCloud} className="w-full py-2.5 text-[11px] text-red-400/80 hover:text-red-400 flex items-center justify-center gap-2 mt-4 uppercase tracking-widest font-bold border border-red-950/30 bg-red-950/10 hover:bg-red-950/30 rounded-xl transition-all duration-200"><Trash2 className="w-3.5 h-3.5" /> Purge Sovereign Database</button>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Financial Telemetry & AI Input */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md transition-all hover:border-neutral-700/80">
              <div className="flex items-center gap-3 mb-5 text-neutral-400 font-bold tracking-widest text-xs uppercase"><PackagePlus className="w-4 h-4 text-teal-400" />2. Statement Telemetry</div>
              <p className="text-xs text-neutral-500 mb-3 leading-relaxed">Drop encrypted text streams or log dumps into the validation box below.</p>
              <textarea 
                className="w-full p-4 border border-neutral-800 bg-neutral-950 rounded-xl text-neutral-100 focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500 mb-4 text-xs font-mono leading-relaxed shadow-inner resize-none" 
                rows={4} 
                value={chatText} 
                onChange={(e) => setChatText(e.target.value)} 
                placeholder="Paste telemetry logs... e.g., Omakase Executive Suite 24500. Court Live Booking 1800 shared by Pang, Charlotte." 
              />
              
              <div className="mb-6">
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                {!imagePreview ? (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-7 border-2 border-dashed border-neutral-800 rounded-xl hover:border-teal-500/40 hover:bg-neutral-900/50 transition-all duration-300 flex flex-col items-center gap-2.5 text-neutral-500 hover:text-teal-400 group">
                    <ImagePlus className="w-6 h-6 transform group-hover:scale-110 transition-transform" /><span className="text-[10px] font-bold uppercase tracking-widest">Inject Premium Optical Invoice</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl border border-neutral-800 p-2 bg-neutral-950 shadow-inner">
                    <img src={imagePreview} className="w-full h-28 object-cover rounded-lg filter brightness-90" alt="preview" />
                    <button onClick={removeImage} className="absolute top-4 right-4 bg-red-500/90 hover:bg-red-500 text-white p-1.5 rounded-full shadow-2xl transition-all hover:scale-110"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              <button onClick={handleAISplit} disabled={loading} className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-neutral-950 font-extrabold text-xs uppercase tracking-widest hover:brightness-110 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-600 transition-all duration-300 shadow-lg shadow-teal-500/10 active:scale-[0.98]">{loading ? 'Analyzing Architecture Structure...' : 'Execute AI Synchronization'}</button>
            </div>
          </div>

          {/* Section 3: Premium Interactive Ledger Sheet */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md transition-all hover:border-neutral-700/80">
              <div className="flex items-center gap-3 mb-5 text-neutral-400 font-bold tracking-widest text-xs uppercase"><Check className="w-4 h-4 text-teal-400" />📋 Asset Ledger Sheet</div>
              <div className='overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/80 shadow-inner'>
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-neutral-900/70 text-neutral-400 border-b border-neutral-800/60 font-mono tracking-wider">
                    <tr>
                      <th className="p-4 font-bold uppercase text-[10px] tracking-widest">Asset Allocation Item</th>
                      <th className="p-4 font-bold w-32 text-right uppercase text-[10px] tracking-widest">Valuation (฿)</th>
                      {masterMembers.map(m => <th key={m} className="p-4 text-center font-bold border-l border-neutral-900 text-[10px] tracking-widest uppercase">{m}</th>)}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-neutral-900/80 text-neutral-200 font-medium'>
                    {billItems.length === 0 ? (
                      <tr><td colSpan={masterMembers.length + 2} className="p-16 text-center text-neutral-600 font-medium font-mono text-xs tracking-wide italic">Awaiting telemetry computation execution context...</td></tr>
                    ) : billItems.map(item => (
                      <tr key={item.id} className="hover:bg-neutral-900/40 transition-colors duration-150 group">
                        <td className="p-4">
                          <input type="text" className="bg-transparent w-full outline-none focus:text-teal-400 font-sans border-b border-transparent focus:border-teal-900/60 transition-all font-semibold" value={item.item} onChange={(e) => handleItemChange(item.id, 'item', e.target.value)} />
                        </td>
                        <td className="p-4">
                          <input type="number" className="bg-transparent w-full outline-none text-right text-teal-400 font-mono font-bold border-b border-transparent focus:border-teal-900/60 transition-all" value={item.price} onChange={(e) => handleItemChange(item.id, 'price', e.target.value)} />
                        </td>
                        {masterMembers.map(m => (
                          <td key={m} className="p-4 text-center border-l border-neutral-900/60">
                            <input type="checkbox" className="w-5 h-5 cursor-pointer accent-teal-500 rounded bg-neutral-900 border-neutral-800 transition-all hover:scale-110 shadow-inner" checked={item.shared_by.includes(m)} onChange={() => toggleSharedBy(item.id, m)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Premium Output Digest Container */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 shadow-2xl border-t-2 border-t-teal-500/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-5 text-neutral-400 font-bold tracking-widest text-xs uppercase"><ArrowLeftRight className="w-4 h-4 text-teal-400" />📊 Liquidation Digest Terminal</div>
              <div className="relative group">
                <textarea className="w-full p-5 border border-neutral-800 bg-neutral-950 rounded-2xl text-neutral-300 text-xs font-mono leading-relaxed resize-none shadow-inner" rows={5} value={calculatedBalance.outputText} readOnly />
                <button onClick={() => { navigator.clipboard.writeText(calculatedBalance.outputText); alert('Statement package successfully synchronized to clipboard.'); }} disabled={!calculatedBalance.outputText} className='absolute bottom-4 right-4 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-teal-400 hover:text-teal-300 py-2.5 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-2xl transition-all duration-200 active:scale-95'>Copy Digest Output</button>
              </div>
            </div>
          </div>

        </div>

        {/* 💎 Sovereign Financial Telemetry Metrics Board (The New Luxury Section) */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-900/80 border border-neutral-800 rounded-3xl p-8 shadow-2xl mt-12 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-4 -translate-y-4">
            <Wallet className="w-48 h-48 text-teal-400" />
          </div>
          <div className="flex items-center gap-3 mb-6 border-b border-neutral-800/80 pb-4">
            <Activity className="w-5 h-5 text-teal-400" />
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">Syndicate Financial Telemetry Metrics</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            <div className="bg-neutral-950/50 border border-neutral-800/50 rounded-2xl p-6 shadow-inner hover:bg-neutral-950/80 transition-colors">
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Total Asset Valuation</p>
              <p className="text-4xl font-black text-teal-400 font-mono tracking-tighter">฿ {calculatedBalance.grossPoolValue.toLocaleString()}</p>
            </div>
            <div className="bg-neutral-950/50 border border-neutral-800/50 rounded-2xl p-6 shadow-inner hover:bg-neutral-950/80 transition-colors">
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Active Stakeholders</p>
              <p className="text-4xl font-black text-neutral-200 font-mono tracking-tighter">{masterMembers.length}</p>
            </div>
            <div className="bg-neutral-950/50 border border-neutral-800/50 rounded-2xl p-6 shadow-inner hover:bg-neutral-950/80 transition-colors">
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Pending Liquidations</p>
              <p className="text-4xl font-black text-emerald-400 font-mono tracking-tighter">{Object.values(calculatedBalance.membersTotal).filter(v => v > 0).length}</p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}