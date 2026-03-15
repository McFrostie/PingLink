// src/screens/Login.tsx
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import loginCover from '../assests/onboarding/logincover.webp';

interface LoginProps {
  key?: string;
  onLogin: () => void;
  onRegister: () => void;
  onForgotPassword: () => void;
}

export default function Login({ onRegister, onForgotPassword }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useAuthStore((s) => s.login);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      // On success: isAuthenticated flips to true in the store.
      // App.tsx re-renders and routes to ProfileSetup or MainShell automatically.
      // No explicit navigation needed here.
    } catch {
      // Error is already in the store — displayed below the button
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-x-0 top-0 h-[55vh] z-0">
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full h-full relative"
        >
          <img
            src={loginCover}
            alt="Login Background"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        </motion.div>
      </div>

      <div className="flex-1" />

      {/* Form */}
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="relative z-10 bg-white rounded-t-[32px] px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] w-full shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col min-h-[55%]"
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />

        <div className="mb-8">
          <h1 className="text-[32px] leading-tight font-display font-bold text-black mb-2 tracking-tight">
            Welcome back
          </h1>
          <p className="text-gray-500 text-base font-medium">
            Enter your details to sign in
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
              <Mail size={20} strokeWidth={2.5} />
            </div>
            <input
              type="email"
              placeholder="Email address"
              className="ping-input pl-11 bg-gray-50/50 border-gray-200"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
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
              placeholder="Password"
              className="ping-input pl-11 bg-gray-50/50 border-gray-200"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); }}
              required
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end pt-1 pb-2">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm font-semibold text-gray-500 hover:text-black transition-colors"
              disabled={isSubmitting}
            >
              Forgot password?
            </button>
          </div>

          {/* Inline error */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-500 font-medium text-center px-2"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            className="ping-btn shadow-xl shadow-black/10 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : null}
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-8 text-center pb-2">
          <p className="text-gray-500 text-sm font-medium">
            Don't have an account?{' '}
            <button
              onClick={onRegister}
              className="font-bold text-black hover:text-ping transition-colors p-2 -m-2"
              disabled={isSubmitting}
            >
              Sign up
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
