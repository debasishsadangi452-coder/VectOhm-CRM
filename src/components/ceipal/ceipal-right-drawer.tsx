import React, { useState } from 'react';
import { X, Clock, FileText, CheckSquare, Sparkles, Send } from 'lucide-react';
import { useCeipal } from './ceipal-context';

export const CeipalRightDrawer: React.FC = () => {
  const { isRightDrawerOpen, toggleRightDrawer } = useCeipal();
  const [notes, setNotes] = useState<string[]>([
    'Review candidate submissions for JPC-102 (Niagara Health)',
    'Follow up with client manager on senior Java roles',
    'Verify eBoarding documentation for upcoming joiners',
  ]);
  const [newNote, setNewNote] = useState('');

  if (!isRightDrawerOpen) return null;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNotes((prev) => [newNote.trim(), ...prev]);
    setNewNote('');
  };

  return (
    <aside className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200 text-slate-800">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1467d6] text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Recruiter Workspace</h3>
        </div>
        <button
          onClick={toggleRightDrawer}
          className="p-1 hover:bg-white/20 rounded text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Quick Notepad */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-700 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" /> Quick Notes
            </span>
            <span className="text-[10px] text-slate-400">{notes.length} notes</span>
          </div>
          <form onSubmit={handleAddNote} className="flex gap-1.5 mb-2.5">
            <input
              type="text"
              placeholder="Add a quick reminder..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center justify-center"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
          <div className="space-y-1.5">
            {notes.map((note, idx) => (
              <div
                key={idx}
                className="p-2 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded text-slate-700 flex items-start justify-between gap-2"
              >
                <span>{note}</span>
                <button
                  onClick={() => setNotes((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-300 hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent ATS Activities */}
        <div>
          <span className="font-bold text-slate-700 uppercase tracking-wide text-[11px] flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> Recent Actions
          </span>
          <div className="border-l-2 border-blue-200 pl-3 space-y-3">
            <div>
              <p className="text-slate-800 font-medium">Megan Davis updated JPC-102</p>
              <p className="text-[10px] text-slate-400">10 mins ago • Niagara Health</p>
            </div>
            <div>
              <p className="text-slate-800 font-medium">New Applicant synced from ZipRecruiter</p>
              <p className="text-[10px] text-slate-400">28 mins ago • Sr. Java Engineer</p>
            </div>
            <div>
              <p className="text-slate-800 font-medium">eBoarding packet generated for verification</p>
              <p className="text-[10px] text-slate-400">1 hour ago • Venus Consultancy</p>
            </div>
          </div>
        </div>

        {/* Fast Action Shortcuts */}
        <div>
          <span className="font-bold text-slate-700 uppercase tracking-wide text-[11px] flex items-center gap-1.5 mb-2">
            <CheckSquare className="w-3.5 h-3.5 text-blue-600" /> Quick Status Check
          </span>
          <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-[11px] space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span>Active Job Postings:</span>
              <span className="font-bold text-blue-700">480</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Total Resumes:</span>
              <span className="font-bold text-blue-700">11,918</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Client Accounts:</span>
              <span className="font-bold text-blue-700">11</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>eBoarding In Progress:</span>
              <span className="font-bold text-emerald-700">Live</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
