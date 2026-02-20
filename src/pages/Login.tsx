import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Eye, EyeOff, Lock, Mail, Check } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithPassword } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveDetails, setSaveDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = location.state as { from?: string } | null;
  const from = state?.from ?? '/';

  // Load saved email AND password on mount
  useEffect(() => {
    const savedSaveDetails = window.localStorage.getItem('login_save_details') === 'true';
    const savedEmail = window.localStorage.getItem('login_saved_email') || '';
    
    setSaveDetails(savedSaveDetails);
    if (savedSaveDetails && savedEmail) {
      setEmail(savedEmail);
    }
    // Clean up any previously stored password for security
    try { window.localStorage.removeItem('login_saved_password'); } catch { /* ignore */ }
  }, []);

  const isMounted = React.useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double-submit
    if (isSubmitting) return;
    
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await signInWithPassword(email.trim(), password);
      
      // If component unmounted during await, stop here
      if (!isMounted.current) return;

      if (res.error) {
        // Handle AbortError specifically
        if (res.error === 'aborted' || res.error.includes('aborted')) {

           if (isMounted.current) setIsSubmitting(false);
           return;
        }
        
        if (isMounted.current) {
          setError(res.error);
          setIsSubmitting(false);
        }
        return;
      }

      if (saveDetails) {
        try {
          window.localStorage.setItem('login_saved_email', email.trim());
          window.localStorage.setItem('login_save_details', 'true');
        } catch { /* ignore storage errors */ }
      } else {
        try {
          window.localStorage.removeItem('login_saved_email');
          window.localStorage.setItem('login_save_details', 'false');
        } catch { /* ignore storage errors */ }
      }
      // Clean up any previously stored password
      try { window.localStorage.removeItem('login_saved_password'); } catch { /* ignore */ }

      if (isMounted.current) {
        navigate(from, { replace: true });
      }
    } catch (err: any) {

      
      // Check for AbortError in catch block too
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        if (isMounted.current) setIsSubmitting(false);
        return;
      }

      if (isMounted.current) {
        setError('An unexpected error occurred. Please try again.');
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-[#13151A] text-white flex items-center justify-center p-4 xs:p-3 sm:p-4 overflow-y-auto pt-[calc(var(--safe-top)+46px)] pb-[calc(var(--safe-bottom)+110px)]">
      <div className="w-full max-w-[420px] xs:max-w-[320px] sm:max-w-[380px] bg-white/5 border border-white/10 rounded-2xl p-6 xs:p-4 sm:p-5">
        <h1 className="text-fluid-xl font-bold mb-6 xs:mb-4 sm:mb-5 text-center">Login</h1>

        <form onSubmit={onSubmit} className="space-y-4 xs:space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <label className="text-fluid-sm text-white/70">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 xs:w-3.5 xs:h-3.5 text-white/50" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl pl-10 xs:pl-9 pr-3 py-3 xs:py-2.5 text-fluid-sm text-white outline-none focus:border-[#C9A96E]/50 placeholder:text-white/40"
                placeholder="you@email.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-fluid-sm text-white/70">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 xs:w-3.5 xs:h-3.5 text-white/50" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl pl-10 xs:pl-9 pr-10 xs:pr-9 py-3 xs:py-2.5 text-fluid-sm text-white outline-none focus:border-[#C9A96E]/50 placeholder:text-white/40"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4 xs:w-3.5 xs:h-3.5" /> : <Eye className="w-4 h-4 xs:w-3.5 xs:h-3.5" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 px-3 xs:px-2 py-3 xs:py-2.5 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={saveDetails}
                onChange={(e) => setSaveDetails(e.target.checked)}
                className="peer sr-only"
              />
              <div className={`w-5 h-5 xs:w-4 xs:h-4 rounded-md border transition-all flex items-center justify-center ${
                saveDetails 
                  ? 'bg-[#C9A96E] border-[#C9A96E]' 
                  : 'bg-white/10 border-white/30 group-hover:border-white/50'
              }`}>
                {saveDetails && <Check className="w-3.5 h-3.5 xs:w-3 xs:h-3 text-black stroke-[3]" />}
              </div>
            </div>
            <span className="text-fluid-sm text-white/70 select-none">Remember email</span>
          </label>

          {error && (
            <div className="text-fluid-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 xs:p-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#C9A96E] text-black font-bold rounded-xl py-3 xs:py-2.5 text-fluid-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 xs:mt-4 text-center space-y-2">
          <Link to="/forgot-password" className="block text-fluid-sm text-white/60 hover:text-white hover:underline">
            Forgot your password?
          </Link>
          <Link to="/register" className="block text-fluid-sm text-white hover:underline">
            Don&apos;t have an account? Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
