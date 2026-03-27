import React, { useState, useEffect, lazy, Suspense } from 'react'
import { Brain, LogOut, User, Loader2, ShieldCheck, Activity } from 'lucide-react'
import tremoraBlue from './assets/tremora-blue.webp'
import { apiUrl } from './config/api'
import backgroundImg from './assets/background.webp'

// Lazy load pages for performance
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ParkinsonScreening = lazy(() => import('./pages/ParkinsonScreening').then(m => ({ default: m.ParkinsonScreening })))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })))

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
        const response = await fetch(apiUrl('/auth/me'), {
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
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center">
        <div className="relative mb-8">
           <div className="absolute inset-0 bg-sky-400/10 blur-3xl rounded-full scale-150" />
           <img src={tremoraBlue} alt="Tremora" className="w-32 h-32 object-contain relative z-10" />
        </div>
        <div className="flex flex-col items-center gap-2">
           <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">Tremora</h1>
           <span className="text-[10px] font-black text-sky-600 uppercase tracking-[0.5em] italic ml-2">Initializing Core</span>
           <Loader2 className="w-5 h-5 text-sky-500 animate-spin mt-2" />
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="relative min-h-[100dvh] bg-slate-900 w-full font-sans">
        <img 
          src={backgroundImg} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover z-0" 
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[1]"></div>
        
        <div className="relative z-10 min-h-[100dvh] w-full flex flex-col justify-center">
          <Suspense fallback={<div className="min-h-[100dvh] flex flex-col items-center justify-center"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /><span className="text-white mt-4 font-bold tracking-widest text-[10px] uppercase">Loading Auth...</span></div>}>
            {authView === 'login' && <Login onLoginSuccess={checkAuthStatus} onToggleRegister={() => setAuthView('register')} onToggleReset={() => setAuthView('reset')} />}
            {authView === 'register' && <Register onToggleLogin={() => setAuthView('login')} />}
            {authView === 'reset' && <ResetPassword onToggleLogin={() => setAuthView('login')} />}
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-sky-500/20">
      {/* Cinematic Header */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={handleRestart}>
             <div className="transition-transform active:scale-90 flex items-center justify-center">
                <img src={tremoraBlue} alt="Tremora Logo" className="w-10 h-10 sm:w-[3.25rem] sm:h-[3.25rem] object-contain" />
              </div>
              <div className="flex flex-col">
                 <span className="text-xl sm:text-2xl font-black tracking-tighter text-slate-900 uppercase italic leading-none">Tremora</span>
                 <span className="text-[8px] sm:text-[10px] font-black tracking-[0.2em] sm:tracking-[0.3em] text-sky-600 uppercase italic hidden sm:block">Analysis Hub</span>
              </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-6 bg-slate-50/50 p-1.5 rounded-2xl border border-slate-100">
            <button 
              onClick={() => setView('assessment')}
              className={`px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-all ${view === 'assessment' || view === 'results' ? 'bg-white text-sky-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Screening
            </button>
            <button 
              onClick={() => setView('history')}
              className={`px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-all ${view === 'history' ? 'bg-white text-sky-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <span className="hidden sm:inline">Analysis </span>History
            </button>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-6 shrink-0">
            <div className="text-right hidden lg:block">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none italic">Secure Instance</p>
                <p className="text-[10px] font-black text-sky-600 mt-1 italic uppercase line-clamp-1 max-w-[150px]">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-inner">
                   <User size={16} className="sm:w-[18px] sm:h-[18px]" />
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 sm:p-3 bg-slate-100 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Dynamic View Context */}
      <main className="pt-32 pb-32 px-10 max-w-7xl mx-auto min-h-screen relative overflow-y-auto">
         {/* Deep Space Background Orbs */}
         <div className="fixed top-1/4 -right-1/4 w-[600px] h-[600px] bg-sky-200/20 rounded-full blur-[140px] pointer-events-none opacity-40" />
         <div className="fixed bottom-1/4 -left-1/4 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-[120px] pointer-events-none opacity-40" />
         
         <div className="relative z-10">
            <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>}>
              {view === 'results' ? (
                  <ResultsPage result={lastResult} user={user} onRestart={handleRestart} />
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
            </Suspense>
         </div>
      </main>

      {/* Status Matrix Footer */}
      <footer className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-200 px-10 py-5 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-600 font-black z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="relative">
                <span className="absolute inset-0 bg-emerald-400/30 rounded-full animate-ping"></span>
                <span className="relative block w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <span className="text-emerald-700 italic">Analysis Core v3.0</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-200"></div>
          <div className="text-slate-600 italic">Mode: <span className="text-sky-600 uppercase">Interactive Redirect</span></div>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600/50" /> 
            <span className="tracking-[0.4em] italic font-black">E2E Biometric Encryption Locked</span>
        </div>
      </footer>
    </div>
  )
}

export default App
