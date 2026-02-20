import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const signUpWithPassword = useAuthStore((state) => state.signUpWithPassword);
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMounted = React.useRef(true);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setInfo(null);

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await signUpWithPassword(email.trim(), password, username.trim() || undefined);
      
      if (!isMounted.current) return;

      if (res.error) {
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

      if (res.needsEmailConfirmation) {
        if (isMounted.current) {
          setInfo('Please check your email to confirm your account.');
          setIsSubmitting(false);
        }
        return;
      }

      // Success - navigate to home
      if (isMounted.current) {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      if (!isMounted.current) return;
      
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
         setIsSubmitting(false);
         return;
      }
      setError('Failed to create account');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-[#13151A] text-white flex items-center justify-center p-4 xs:p-3 sm:p-4 overflow-y-auto pt-[calc(var(--safe-top)+46px)] pb-[calc(var(--safe-bottom)+70px)]">
      <div className="w-full max-w-[420px] xs:max-w-[320px] sm:max-w-[380px] bg-white/5 border border-white/10 rounded-2xl p-6 xs:p-4 sm:p-5">
        <h1 className="text-fluid-xl font-bold mb-6 xs:mb-4 sm:mb-5 text-center">Create Account</h1>

        <form onSubmit={onSubmit} className="space-y-4 xs:space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <label className="text-fluid-sm text-white/70">Username (optional)</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 xs:w-3.5 xs:h-3.5 text-white/50" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl pl-10 xs:pl-9 pr-3 py-3 xs:py-2.5 text-fluid-sm text-white outline-none focus:border-[#C9A96E]/50 placeholder:text-white/40"
                placeholder="username"
                autoComplete="username"
              />
            </div>
          </div>

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
                autoComplete="new-password"
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

          <div className="space-y-2">
            <label className="text-fluid-sm text-white/70">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 xs:w-3.5 xs:h-3.5 text-white/50" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl pl-10 xs:pl-9 pr-10 xs:pr-9 py-3 xs:py-2.5 text-fluid-sm text-white outline-none focus:border-[#C9A96E]/50 placeholder:text-white/40"
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4 xs:w-3.5 xs:h-3.5" /> : <Eye className="w-4 h-4 xs:w-3.5 xs:h-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-fluid-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 xs:p-2.5">
              {error}
            </div>
          )}

          {info && (
            <div className="text-fluid-sm text-white/70 bg-white/5 border border-white/10 rounded-xl p-3 xs:p-2.5">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#C9A96E] text-black font-bold rounded-xl py-3 xs:py-2.5 text-fluid-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 xs:mt-4 text-center">
          <Link to="/login" className="text-fluid-sm text-white hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
