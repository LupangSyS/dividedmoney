// Path: app/page.tsx
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Check, PackagePlus, Users, Wand2, ArrowLeftRight, ImagePlus, X, History, Trash2, Wallet, Download, Settings2 } from 'lucide-react';

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

  const loadHistoryFromSheets = async () => {
    setHistoryLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'load_history');
      const res = await fetch('/api/gemini', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        const history = json.history || [];
        setSavedSessions(history);
        // Remember the group from the last saved split, so members don't need retyping.
        if (history[0]?.membersText) {
          setMasterMembersText(history[0].membersText);
        }
      }
    } catch (err) {
      console.error('Failed to load history:', err);
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
      if (file.size > 5 * 1024 * 1024) return alert('File size exceeds 5MB limit.');
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

  // Per-person breakdown: name -> items -> summed price (Memoized)
  const calculatedBalance = useMemo(() => {
    let membersTotal: { [name: string]: number } = {};
    masterMembers.forEach(m => membersTotal[m] = 0);

    let grossPoolValue = 0;
    billItems.forEach(item => {
      if (item.shared_by.length > 0) {
        const splitPrice = item.price / item.shared_by.length;
        grossPoolValue += item.price;
        item.shared_by.forEach(m => {
          if (membersTotal[m] !== undefined) membersTotal[m] += splitPrice;
        });
      }
    });

    const personBreakdown = masterMembers
      .map(name => ({
        name,
        items: billItems.filter(i => i.shared_by.includes(name)).map(i => i.item),
        total: membersTotal[name] || 0,
      }))
      .filter(p => p.items.length > 0);

    let outputText = "🧾 Split Summary\n=================\n\n";
    personBreakdown.forEach(p => {
      outputText += `👤 ${p.name}\n   ${p.items.join(', ')}\n   -----------------------------------------\n   Total: ฿${Math.ceil(p.total).toLocaleString()}\n\n`;
    });

    return { membersTotal, grossPoolValue, personBreakdown, outputText: outputText.trim() };
  }, [billItems, masterMembers]);

  const importSplitToLedger = async () => {
    if (calculatedBalance.personBreakdown.length === 0) {
      return alert('Tick at least one person against an item before saving.');
    }
    try {
      const formData = new FormData();
      formData.append('action', 'save_history');
      formData.append('members', masterMembersText);
      formData.append('chatText', calculatedBalance.outputText);
      formData.append('itemsJson', JSON.stringify(billItems));
      formData.append('breakdownJson', JSON.stringify(calculatedBalance.personBreakdown));

      const res = await fetch('/api/gemini', { method: 'POST', body: formData });
      const json = await res.json();
      if (!json.success) {
        return alert(json.error || 'Could not save this split. Please try again.');
      }
      await loadHistoryFromSheets();
      alert('Saved to your history.');
    } catch (e) {
      console.error('Failed to save split:', e);
      alert('Could not save this split. Please try again.');
    }
  };

  const handleAISplit = async () => {
    if (!chatText && !imageFile) return alert('Please add a receipt photo or paste some text first.');
    if (masterMembers.length === 0) return alert('Please add at least one member first.');

    setLoading(true);
    const formData = new FormData();
    formData.append('action', 'extract_items');
    formData.append('chatText', chatText);
    formData.append('members', masterMembersText);
    if (imageFile) formData.append('image', imageFile);

    try {
      const res = await fetch('/api/gemini', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        const newItems = json.data.map((item: any, i: number) => ({
          id: `item_${Date.now()}_${i}`,
          item: item.item || 'New item',
          price: Number(item.price) || 0,
          shared_by: item.shared_by || []
        }));
        setBillItems(prev => [...prev, ...newItems]);
      } else {
        alert(json.error || 'Could not read any items from that.');
      }
    } catch (err) {
      alert('Something went wrong talking to the AI. Please try again.');
    }
    setLoading(false);
  };

  const handleItemChange = (itemId: string, field: 'item' | 'price', value: any) => {
    const updated = billItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          [field]: field === 'price' ? (Number(value) || 0) : value
        };
      }
      return item;
    });
    setBillItems(updated);
  };

  const toggleSharedBy = (itemId: string, memberName: string) => {
    const updated = billItems.map(item => {
      if (item.id === itemId) {
        const isSharing = item.shared_by.includes(memberName);
        const newSharedBy = isSharing ? item.shared_by.filter(m => m !== memberName) : [...item.shared_by, memberName];
        return { ...item, shared_by: newSharedBy };
      }
      return item;
    });
    setBillItems(updated);
  };

  const handleAddItem = () => {
    setBillItems(prev => [...prev, { id: `item_${Date.now()}`, item: 'New item', price: 0, shared_by: [] }]);
  };

  const handleDeleteItem = (itemId: string) => {
    setBillItems(prev => prev.filter(i => i.id !== itemId));
  };

  // Renders "Name <space> Price" lines to a PNG, one per person, for Khunthong's photo import.
  const exportToKhunthong = () => {
    const rows = calculatedBalance.personBreakdown;
    if (rows.length === 0) {
      return alert('Tick at least one person against an item first.');
    }

    const lineHeight = 48;
    const padding = 32;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = padding * 2 + lineHeight * rows.length;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 30px monospace';
    ctx.textBaseline = 'middle';

    rows.forEach((p, i) => {
      const y = padding + lineHeight * i + lineHeight / 2;
      ctx.fillText(`${p.name} ${Math.ceil(p.total)}`, padding, y);
    });

    const link = document.createElement('a');
    link.download = 'khunthong-split.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const loadSession = (session: any) => {
    setMasterMembersText(session.membersText || masterMembersText);
    if (session.items) {
      setBillItems(session.items);
    } else {
      setBillItems([{ id: `item_${Date.now()}`, item: session.chatText || 'Item', price: 0, shared_by: [] }]);
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-10 bg-neutral-50 text-neutral-900 font-sans antialiased">
      <div className="max-w-[1400px] mx-auto space-y-8">

        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 rounded-2xl shadow-sm">
              <Wand2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">AURA Split</h1>
              <p className="text-neutral-500 text-sm mt-0.5">Split bills with your group, powered by AI receipt scanning.</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-neutral-700 font-semibold text-sm"><Users className="w-4 h-4 text-emerald-600" />Members</div>
              <p className="text-xs text-neutral-500 mb-3 leading-relaxed">Who&apos;s splitting this bill? Separate names with commas.</p>
              <input
                type="text"
                className="w-full p-3 border border-neutral-300 bg-white rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm transition-all"
                value={masterMembersText}
                onChange={(e) => setMasterMembersText(e.target.value)}
                placeholder="e.g. Pang, Wave, Ohm"
              />

              {masterMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral-100">
                  {masterMembers.map(m => (
                    <span key={m} className="px-2.5 py-1 bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs rounded-full font-medium">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-neutral-700 font-semibold text-sm"><History className="w-4 h-4 text-emerald-600" />History</div>
                <Link href="/history" className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                  <Settings2 className="w-3.5 h-3.5" /> Manage
                </Link>
              </div>
              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-neutral-400"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>Loading history...</div>
              ) : savedSessions.length === 0 ? (
                <p className="text-neutral-400 text-xs text-center py-6">No saved splits yet.</p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {savedSessions.map((s, idx) => (
                    <div key={s.id || idx} onClick={() => loadSession(s)} className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors">
                      <p className="text-[11px] font-medium text-neutral-400">{s.date || 'Past session'}</p>
                      <p className="text-xs text-neutral-700 truncate mt-1">{s.chatText || s.items?.map((i:any)=>i.item).join(', ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-neutral-700 font-semibold text-sm"><PackagePlus className="w-4 h-4 text-emerald-600" />Add items</div>
              <p className="text-xs text-neutral-500 mb-3 leading-relaxed">Paste receipt text, or upload a photo below.</p>
              <textarea
                className="w-full p-3 border border-neutral-300 bg-white rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 mb-4 text-sm leading-relaxed resize-none transition-all"
                rows={4}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder='e.g. "Pad Thai 120, Iced Tea 35"'
              />

              <div className="mb-5">
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                {!imagePreview ? (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-neutral-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors flex flex-col items-center gap-2 text-neutral-500 hover:text-emerald-600">
                    <ImagePlus className="w-6 h-6" /><span className="text-xs font-medium">Upload receipt photo</span>
                  </button>
                ) : (
                  <div className="relative rounded-lg border border-neutral-200 p-2 bg-neutral-50">
                    <img src={imagePreview} className="w-full h-28 object-cover rounded-md" alt="preview" />
                    <button onClick={removeImage} className="absolute top-4 right-4 bg-neutral-900/80 hover:bg-neutral-900 text-white p-1.5 rounded-full shadow-sm transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              <button onClick={handleAISplit} disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors active:scale-[0.98]">{loading ? 'Reading your receipt...' : 'Extract items with AI'}</button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-neutral-700 font-semibold text-sm">
                  <Check className="w-4 h-4 text-emerald-600" />Items
                </div>
                <button
                  onClick={handleAddItem}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors"
                >
                  + Add item
                </button>
              </div>

              <div className='overflow-x-auto rounded-lg border border-neutral-200'>
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                    <tr>
                      <th className="p-3 font-medium text-xs w-1/3">Item</th>
                      <th className="p-3 font-medium w-28 text-right text-xs border-r border-neutral-200">Price (฿)</th>
                      <th className="p-3 font-medium text-left text-xs pl-5">Shared by</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-neutral-100 text-neutral-800'>
                    {billItems.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-neutral-400 text-sm">No items yet — extract from a receipt or add one manually.</td></tr>
                    ) : billItems.map(item => (
                      <tr key={item.id} className="hover:bg-neutral-50 transition-colors group">
                        <td className="p-3 align-top">
                          <input type="text" className="bg-transparent w-full outline-none border-b border-transparent focus:border-emerald-400 transition-colors font-medium" value={item.item} onChange={(e) => handleItemChange(item.id, 'item', e.target.value)} />
                        </td>
                        <td className="p-3 align-top border-r border-neutral-100">
                          <input type="number" className="bg-transparent w-full outline-none text-right font-medium border-b border-transparent focus:border-emerald-400 transition-colors" value={item.price} onChange={(e) => handleItemChange(item.id, 'price', e.target.value)} />
                        </td>
                        <td className="p-3 pl-5 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {masterMembers.map(m => {
                              const isActive = item.shared_by.includes(m);
                              return (
                                <button
                                  key={m}
                                  onClick={() => toggleSharedBy(item.id, m)}
                                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors border
                                    ${isActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300'
                                    }`}
                                >
                                  {m}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-3 align-top text-center">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-neutral-300 hover:text-red-500 p-1 rounded transition-colors"
                            title="Delete item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-neutral-700 font-semibold text-sm"><ArrowLeftRight className="w-4 h-4 text-emerald-600" />Split summary</div>
              <div className="relative">
                <textarea className="w-full p-4 border border-neutral-200 bg-neutral-50 rounded-lg text-neutral-700 text-xs font-mono leading-relaxed resize-none" rows={10} value={calculatedBalance.outputText} readOnly />
                <div className="absolute bottom-3 right-3 flex flex-wrap justify-end gap-2 max-w-full">
                  <button onClick={() => { navigator.clipboard.writeText(calculatedBalance.outputText); alert('Copied to clipboard.'); }} disabled={!calculatedBalance.outputText} className='bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-600 hover:text-neutral-800 py-2 px-3.5 rounded-lg text-xs font-medium shadow-sm transition-colors active:scale-95 disabled:opacity-40'>Copy summary</button>
                  <button onClick={exportToKhunthong} disabled={calculatedBalance.personBreakdown.length === 0} title="Download a Name / Price image to import into Khunthong" className='bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-600 hover:text-neutral-800 py-2 px-3.5 rounded-lg text-xs font-medium shadow-sm transition-colors active:scale-95 disabled:opacity-40 flex items-center gap-1.5'><Download className="w-3.5 h-3.5" /> Export to Khunthong</button>
                  <button onClick={importSplitToLedger} disabled={calculatedBalance.personBreakdown.length === 0} className='bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3.5 rounded-lg text-xs font-medium shadow-sm transition-colors active:scale-95 disabled:opacity-40 disabled:bg-neutral-200 disabled:text-neutral-400'>Import to Ledger</button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5 border-b border-neutral-100 pb-4">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-neutral-700">Overview</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-5">
              <p className="text-xs text-neutral-500 font-medium mb-1.5">Total spent</p>
              <p className="text-2xl font-bold text-neutral-900">฿ {calculatedBalance.grossPoolValue.toLocaleString()}</p>
            </div>
            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-5">
              <p className="text-xs text-neutral-500 font-medium mb-1.5">Members</p>
              <p className="text-2xl font-bold text-neutral-900">{masterMembers.length}</p>
            </div>
            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-5">
              <p className="text-xs text-neutral-500 font-medium mb-1.5">People owing</p>
              <p className="text-2xl font-bold text-neutral-900">{Object.values(calculatedBalance.membersTotal).filter(v => v > 0).length}</p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
