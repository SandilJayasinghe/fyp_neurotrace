import React from 'react';
import { User, Mail, Calendar, MapPin, X, Github, Target } from 'lucide-react';

function ProfilePopup({ user, onClose }) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header/Cover */}
        <div className="h-32 bg-gradient-to-r from-sky-600 to-sky-500 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 rounded-full text-white transition-all shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Stats/Avatar Overlay */}
        <div className="px-8 pb-8 -mt-12 relative">
          <div className="flex justify-between items-end mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-slate-50 border-4 border-white flex items-center justify-center shadow-xl overflow-hidden">
                <User className="w-12 h-12 text-sky-600" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full shadow-lg"></div>
            </div>
            
            <div className="flex gap-2">
              <div className="px-3 py-1 bg-sky-50 border border-sky-100 rounded-full text-[10px] font-black text-sky-600 uppercase tracking-widest">
                Scientist
              </div>
              <div className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                Active
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{user.name}</h2>
            <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
              <Mail className="w-4 h-4 text-sky-600/50" />
              {user.email}
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                <Calendar className="w-3 h-3" /> Date of Birth
              </div>
              <div className="text-slate-900 font-bold text-sm">
                {user.dob || 'Not Provided'}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                <Target className="w-3 h-3" /> User Age
              </div>
              <div className="text-slate-900 font-bold text-sm">
                {user.age || 'N/A'} Years
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                <User className="w-3 h-3" /> Gender
              </div>
              <div className="text-slate-900 font-bold text-sm uppercase">
                {user.gender || 'Unknown'}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                <MapPin className="w-3 h-3" /> Origin Location
              </div>
              <div className="text-slate-900 font-bold text-sm">
                {user.country || 'Global'}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3">
            <button className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-slate-200 active:scale-95 shadow-sm">
              Edit Project Settings
            </button>
          </div>
        </div>

        {/* System Trace ID */}
        <div className="px-8 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
          <span>System Trace ID: {user.id || 'N/A'}</span>
          <span className="text-sky-600/50">Tremora v1.0</span>
        </div>
      </div>
    </div>
  );
}

export default ProfilePopup;
