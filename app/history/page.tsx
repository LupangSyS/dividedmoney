'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';

interface HistorySession {
  id?: string;
  date?: string;
  membersText?: string;
  chatText?: string;
  items?: { item: string }[];
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'load_history');
      const res = await fetch('/api/gemini', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) setSessions(json.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const clearHistory = async () => {
    if (!confirm("This will permanently delete all saved history. This can't be undone. Continue?")) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'clear_history');
      await fetch('/api/gemini', { method: 'POST', body: formData });
      setSessions([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
      alert('Could not clear history. Please try again.');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen p-6 md:p-10 bg-neutral-50 text-neutral-900 font-sans antialiased">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="pb-6 border-b border-neutral-200">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to app
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Manage history</h1>
          <p className="text-neutral-500 text-sm mt-0.5">View or permanently delete your saved splits.</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          {loading ? (
            <p className="text-xs text-neutral-400 text-center py-8">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-neutral-400 text-sm text-center py-8">No saved splits yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, idx) => (
                <div key={s.id || idx} className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <p className="text-[11px] font-medium text-neutral-400">{s.date || 'Past session'}</p>
                  {s.membersText && <p className="text-xs text-neutral-500 mt-0.5">{s.membersText}</p>}
                  <p className="text-sm text-neutral-800 mt-1 whitespace-pre-line">{s.chatText || s.items?.map((i) => i.item).join(', ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {sessions.length > 0 && (
          <button onClick={clearHistory} className="w-full py-2.5 text-sm text-red-600 hover:text-red-700 flex items-center justify-center gap-2 font-medium border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" /> Clear all history
          </button>
        )}
      </div>
    </main>
  );
}
