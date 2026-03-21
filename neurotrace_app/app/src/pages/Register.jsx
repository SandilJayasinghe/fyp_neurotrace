import React, { useState } from 'react';
import { Brain, Lock, Mail, User, Calendar, Loader2 } from 'lucide-react';

function Register({ onToggleLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    dob: '',
    age: '',
    gender: 'Other',
    country: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:8421/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Registration failed');
      }

      setSuccess(true);
      setTimeout(() => onToggleLogin(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8 bg-[#0f172a] animate-fade-in relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[48rem] h-[32rem] bg-indigo-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <h2 className="text-3xl font-extrabold leading-9 tracking-tight text-white mb-2">Create New Account</h2>
        <p className="text-sm text-slate-400">Join the NeuroTrace analysis platform</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-10 rounded-3xl shadow-2xl shadow-black/50">
          
          {success ? (
            <div className="text-center py-10 animate-bounce">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="text-white w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Account Created!</h3>
              <p className="text-slate-400">Redirecting to login...</p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 ml-1 uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <input name="name" required onChange={handleChange} className="block w-full rounded-xl bg-slate-900/50 py-3 pl-11 text-white ring-1 ring-slate-700/50 focus:ring-2 focus:ring-sky-500 transition-all text-sm" placeholder="John Doe" />
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 ml-1 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <input name="email" type="email" required onChange={handleChange} className="block w-full rounded-xl bg-slate-900/50 py-3 pl-11 text-white ring-1 ring-slate-700/50 focus:ring-2 focus:ring-sky-500 transition-all text-sm" placeholder="john@example.com" />
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 ml-1 uppercase tracking-wider">Secure Password</label>
                <div className="relative">
                  <input name="password" type="password" required onChange={handleChange} className="block w-full rounded-xl bg-slate-900/50 py-3 pl-11 text-white ring-1 ring-slate-700/50 focus:ring-2 focus:ring-sky-500 transition-all text-sm" placeholder="••••••••" />
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 ml-1 uppercase tracking-wider">DOB</label>
                  <input name="dob" type="date" onChange={handleChange} className="block w-full rounded-xl bg-slate-900/50 py-3 px-3 text-white ring-1 ring-slate-700/50 focus:ring-2 focus:ring-sky-500 transition-all text-sm cursor-pointer" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 ml-1 uppercase tracking-wider">Age</label>
                  <input name="age" type="number" onChange={handleChange} className="block w-full rounded-xl bg-slate-900/50 py-3 px-4 text-white ring-1 ring-slate-700/50 focus:ring-2 focus:ring-sky-500 transition-all text-sm" placeholder="25" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 ml-1 uppercase tracking-wider">Gender</label>
                  <select name="gender" onChange={handleChange} className="block w-full rounded-xl bg-slate-900/50 py-3 px-3 text-white ring-1 ring-slate-700/50 focus:ring-2 focus:ring-sky-500 transition-all text-sm cursor-pointer border-r-8 border-transparent">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {error && <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-xs">{error}</div>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-4 bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register Experience'}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <button onClick={onToggleLogin} className="font-semibold text-sky-400 hover:text-sky-300">Log In</button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
