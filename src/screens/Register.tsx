// src/screens/Register.tsx
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import signupCover from '../assests/onboarding/signupcover.webp';

interface RegisterProps {
  key?: string;
  onBack: () => void;
  onRegister: () => void; // called when email confirmation is needed (show prompt then go back)
}

export default function Register({ onBack }: RegisterProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const signup = useAuthStore((s) => s.signup);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError(null);

    // Client-side validation
    if (fullName.trim().length < 2) {
      setValidationError('Name must be at least 2 characters.');
      return;
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }

    try {
      const result = await signup(email, password, fullName.trim());
      if (result.needsConfirmation) {
        setNeedsConfirmation(true);
      }
      // If no confirmation needed, isAuthenticated becomes true in the store.
      // App.tsx automatically routes to ProfileSetup.
    } catch {
      // Error is in the store and displayed below
    }
  };

  // Email confirmation pending state
  if (needsConfirmation) {
    return (
      <div className="flex flex-col h-[100dvh] w-full bg-white px-6 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <button
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center bg-white border-2 border-gray-100 rounded-2xl text-black hover:border-black hover:bg-gray-50 transition-all shadow-sm mb-6 self-start"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl mb-6 flex items-center justify-center"
          >
            <CheckCircle2 size={32} strokeWidth={2} />
          </motion.div>

          <h1 className="text-3xl font-display font-bold text-black mb-3 tracking-tight">
            Check your email
          </h1>
          <p className="text-gray-500 text-base font-medium leading-relaxed mb-8">
            We've sent a confirmation link to{' '}
            <span className="font-semibold text-black">{email}</span>.{' '}
            Click it to activate your account, then come back to sign in.
          </p>

          <button onClick={onBack} className="ping-btn">
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-x-0 top-0 h-[50vh] z-0">
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full h-full relative"
        >
          <img
            src={signupCover}
            alt="Sign Up Background"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
        </motion.div>
      </div>

      {/* Back button */}
      <div className="absolute top-[calc(env(safe-area-inset-top,0px)+1rem)] left-4 z-20">
        <button
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white hover:bg-white/20 transition-all shadow-sm"
          disabled={isSubmitting}
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1" />

      {/* Form */}
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="relative z-10 bg-white rounded-t-[32px] px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] w-full shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col min-h-[60%]"
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

        <div className="mb-6">
          <h1 className="text-[32px] leading-tight font-display font-bold text-black mb-2 tracking-tight">
            Create account
          </h1>
          <p className="text-gray-500 text-base font-medium">
            Join PingLink to connect with players
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
              <User size={20} strokeWidth={2.5} />
            </div>
            <input
              type="text"
              placeholder="Full name"
              className="ping-input pl-11 bg-gray-50/50 border-gray-200"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setValidationError(null); }}
              required
              autoComplete="name"
              disabled={isSubmitting}
            />
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
              <Mail size={20} strokeWidth={2.5} />
            </div>
            <input
              type="email"
              placeholder="Email address"
              className="ping-input pl-11 bg-gray-50/50 border-gray-200"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); setValidationError(null); }}
              required
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
              <Lock size={20} strokeWidth={2.5} />
            </div>
            <input
              type="password"
              placeholder="Password (8+ characters)"
              className="ping-input pl-11 bg-gray-50/50 border-gray-200"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setValidationError(null); clearError(); }}
              required
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </div>

          {/* Inline errors (validation first, then server error) */}
          {(validationError || error) && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-500 font-medium text-center px-2"
            >
              {validationError ?? error}
            </motion.p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="ping-btn shadow-xl shadow-black/10 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : null}
              {isSubmitting ? 'Creating account…' : 'Continue'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center pb-2">
          <p className="text-gray-500 text-sm font-medium">
            Already have an account?{' '}
            <button
              onClick={onBack}
              className="font-bold text-black hover:text-ping transition-colors p-2 -m-2"
              disabled={isSubmitting}
            >
              Sign in
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
