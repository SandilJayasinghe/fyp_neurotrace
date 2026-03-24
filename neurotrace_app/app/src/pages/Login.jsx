import React, { useState } from 'react';
import { Brain, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

function Login({ onLoginSuccess, onToggleRegister, onToggleReset }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid email or password');
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col justify-center px-6 py-12 lg:px-8 bg-[#f8fafc] animate-fade-in relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-sky-200/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-200/20 rounded-full blur-[100px]"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="p-3 bg-sky-500 rounded-2xl shadow-lg shadow-sky-500/20">
            <Brain className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold leading-9 tracking-tight text-slate-900">
          Sign In to Tremora
        </h2>
        <p className="mt-2 text-center text-sm text-slate-800">
          Enter your credentials to access the analytics workspace
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-xl overflow-hidden relative">
          
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email Address
              </label>
              <div className="mt-2 relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border-0 bg-slate-50 py-3 pl-11 pr-3 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 transition-all"
                  placeholder="name@example.com"
                />
                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-700" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <button 
                  type="button"
                  onClick={onToggleReset}
                  className="text-sm font-semibold text-sky-600 hover:text-sky-500 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="mt-2 relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border-0 bg-slate-50 py-3 pl-11 pr-3 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 transition-all"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-700" />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-xs font-medium animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-4 text-sm font-bold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 transition-all font-sans active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log In'}
              {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-700">
            Don't have an account?{' '}
            <button 
              onClick={onToggleRegister}
              className="font-semibold leading-6 text-sky-600 hover:text-sky-500 underline-offset-4 hover:underline transition-all"
            >
              Register Now
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
