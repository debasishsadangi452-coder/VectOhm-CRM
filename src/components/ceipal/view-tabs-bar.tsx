import React, { useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useCeipal } from './ceipal-context';

interface ViewTabsBarProps {
  defaultTitle: string;
  rightActions?: React.ReactNode;
}

export const ViewTabsBar: React.FC<ViewTabsBarProps> = ({ defaultTitle, rightActions }) => {
  const { activeModule, views, activeViewId, setActiveViewId, addView } = useCeipal();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const moduleViews = views.filter((v) => v.module === activeModule);
  const currentView = moduleViews.find((v) => v.id === activeViewId) || moduleViews[0] || { label: defaultTitle };

  const handleCreateView = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newViewName.trim()) return;
    addView(newViewName.trim());
    setNewViewName('');
    setShowAddModal(false);
  };

  return (
    <div className="bg-[#eef1f6] px-4 py-2 flex flex-wrap items-center justify-between border-b border-[#e2e6ec] gap-2">
      {/* Left: View selector pill & + Add View link */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowDropdown((prev) => !prev)}
            className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-300 text-xs font-semibold text-slate-800 shadow-xs hover:border-blue-400 focus:outline-none"
          >
            <span>{currentView?.label || defaultTitle}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {showDropdown && (
            <div
              className="absolute left-0 mt-1 w-44 bg-white rounded-md shadow-xl border border-slate-200 py-1 z-30 text-xs"
              onMouseLeave={() => setShowDropdown(false)}
            >
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Saved Views
              </div>
              {moduleViews.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setActiveViewId(v.id);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 ${
                    v.id === activeViewId ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="text-xs font-semibold text-[#1467d6] hover:underline flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add View
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {rightActions}
      </div>

      {/* Add View Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Create Custom View</h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateView} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">View Name</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Active Healthcare Roles, High Margin Jobs"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#1467d6] hover:bg-blue-700 text-white rounded font-medium shadow-xs"
                >
                  Save View
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
