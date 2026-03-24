import React, { useState } from 'react';
import { Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { apiUrl } from '../config/api';

function ResetPassword({ onToggleLogin }) {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/auth/reset-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, new_password: newPassword }),
      });

      if (!response.ok) {
        throw new Error('User not found or reset failed');
      }

      setSuccess(true);
      setTimeout(() => onToggleLogin(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col justify-center px-6 lg:px-8 relative z-10">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 mt-12">
        <h2 className="text-center text-3xl font-extrabold text-white shadow-sm">Reset Password</h2>
        <p className="mt-2 text-center text-sm text-white/80 italic">Securely recover your account access</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-xl">
          {success ? (
            <div className="text-center py-5">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Lock className="text-white w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Password Reset Successful!</h3>
              <p className="text-slate-600">Redirecting to login...</p>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 ml-1 uppercase tracking-wider text-[10px]">Verify Email Address</label>
                <div className="relative">
                  <input required onChange={(e) => setEmail(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-sm" placeholder="email@example.com" />
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-700" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 ml-1 uppercase tracking-wider text-[10px]">New Secure Password</label>
                <div className="relative">
                  <input type="password" required onChange={(e) => setNewPassword(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-sm" placeholder="••••••••" />
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-700" />
                </div>
              </div>

              {error && <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-xs">{error}</div>}

              <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center py-4 bg-sky-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20 hover:bg-sky-400 transition-all disabled:opacity-50">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Password Update'}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <button onClick={onToggleLogin} className="flex items-center gap-2 mx-auto text-sm text-white/90 hover:text-sky-400 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Back to Log In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
