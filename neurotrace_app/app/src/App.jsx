import React, { useState, useEffect } from 'react'
import { Brain, LogOut, User, Loader2, ShieldCheck, Activity } from 'lucide-react'
import Login from './pages/Login'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import { ParkinsonScreening } from './pages/ParkinsonScreening'
import ResultsPage from './pages/ResultsPage'
import { HistoryPage } from './pages/HistoryPage'

/**
 * Tremora Premium Dark Theme v3.0
 * Intelligent Routing | AI Results Redirection
 */
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authView, setAuthView] = useState('login')
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Navigation State
  const [view, setView] = useState('assessment') // 'assessment' | 'results' | 'history'
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
          setIsLoggedIn(true)
        } else {
          localStorage.removeItem('token')
          setIsLoggedIn(false)
        }
      } catch (err) {
        console.error('Auth check failed', err)
      }
    }
    setIsLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsLoggedIn(false)
    setUser(null)
    setAuthView('login')
  }

  const handleResult = (resultData) => {
    setLastResult(resultData)
    setView('results')
  }

  const handleRestart = () => {
    setLastResult(null)
    setView('assessment')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050811] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn) {
    if (authView === 'login') return <Login onLoginSuccess={checkAuthStatus} onToggleRegister={() => setAuthView('register')} onToggleReset={() => setAuthView('reset')} />
    if (authView === 'register') return <Register onToggleLogin={() => setAuthView('login')} />
    if (authView === 'reset') return <ResetPassword onToggleLogin={() => setAuthView('login')} />
  }

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 font-sans selection:bg-sky-500/30">
      {/* Cinematic Header */}
      <nav className="fixed top-0 w-full z-50 bg-[#0a0f1d]/80 backdrop-blur-xl border-b border-slate-800 shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={handleRestart}>
             <div className="transition-transform active:scale-90 flex items-center justify-center pointer-events-auto">
                <img src="./icon.png" alt="Tremora Logo" className="w-[3.25rem] h-[3.25rem] object-contain" />
              </div>
              <div className="flex flex-col -gap-1">
                 <span className="text-2xl font-black tracking-tighter text-white uppercase italic">Tremora</span>
                 <span className="text-[10px] font-black tracking-[0.3em] text-sky-400 uppercase italic">Analysis Hub</span>
              </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setView('assessment')}
              className={`text-[10px] font-black tracking-widest uppercase transition-all pb-1 border-b-2 ${view === 'assessment' || view === 'results' ? 'text-sky-400 border-sky-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
            >
              Screening
            </button>
            <button 
              onClick={() => setView('history')}
              className={`text-[10px] font-black tracking-widest uppercase transition-all pb-1 border-b-2 ${view === 'history' ? 'text-sky-400 border-sky-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
            >
              Analysis History
            </button>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="text-right hidden md:block">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none opacity-50 italic">Secure Diagnostic Instance</p>
                <p className="text-xs font-black text-sky-400 mt-1.5 italic uppercase">{user?.email}</p>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 overflow-hidden shadow-inner">
                   <User size={18} />
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-3 bg-slate-900/50 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-slate-800"
                >
                  <LogOut className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Dynamic View Context */}
      <main className="pt-32 pb-32 px-10 max-w-7xl mx-auto min-h-screen relative overflow-y-auto">
         {/* Deep Space Background Orbs */}
         <div className="fixed top-1/4 -right-1/4 w-[600px] h-[600px] bg-sky-500/5 rounded-full blur-[140px] pointer-events-none opacity-50" />
         <div className="fixed bottom-1/4 -left-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none opacity-50" />
         
         <div className="relative z-10">
            {view === 'results' ? (
                <ResultsPage result={lastResult} onRestart={handleRestart} />
            ) : view === 'history' ? (
                <HistoryPage 
                  onBack={() => setView('assessment')} 
                  onViewResult={(res) => {
                    setLastResult(res);
                    setView('results');
                  }}
                />
            ) : (
                <ParkinsonScreening onResult={handleResult} />
            )}
         </div>
      </main>

      {/* Status Matrix Footer */}
      <footer className="fixed bottom-0 w-full bg-[#0a0f1d]/90 backdrop-blur-md border-t border-slate-800 px-10 py-5 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="relative">
                <span className="absolute inset-0 bg-emerald-500/50 rounded-full animate-ping"></span>
                <span className="relative block w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <span className="text-emerald-500/80 italic">Analysis Core v3.0</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-800"></div>
          <div className="text-slate-400 italic">Mode: <span className="text-sky-400 uppercase">Interactive Redirect</span></div>
        </div>
        <div className="flex items-center gap-3 text-slate-500/40">
            <ShieldCheck className="w-4 h-4 text-emerald-500/30" /> 
            <span className="tracking-[0.4em] italic font-black">E2E Biometric Encryption Locked</span>
        </div>
      </footer>
    </div>
  )
}

export default App
