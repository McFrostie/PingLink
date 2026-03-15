// src/screens/ForgotPassword.tsx
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ForgotPasswordProps {
  key?: string;
  onBack: () => void;
}

export default function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) {
        // Supabase returns a generic error to prevent email enumeration.
        // We still show success to the user for the same reason.
        // Only surface the error in dev mode.
        if (import.meta.env.DEV) {
          console.error('Password reset error:', resetError.message);
        }
      }

      // Always show "Check your email" — Supabase intentionally doesn't reveal
      // whether the email exists (prevents email enumeration attacks).
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white relative overflow-y-auto no-scrollbar px-6 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="absolute top-1/4 right-0 w-64 h-64 bg-ping/5 rounded-full blur-3xl translate-x-1/3 pointer-events-none" />

      <div className="mb-6 flex-shrink-0 relative z-10 pt-2">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="w-11 h-11 flex items-center justify-center bg-white border-2 border-gray-100 rounded-2xl text-black hover:border-black hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto min-h-[min-content] py-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8"
        >
          {submitted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl mb-6 flex items-center justify-center"
            >
              <CheckCircle2 size={28} strokeWidth={2.5} />
            </motion.div>
          )}
          <h1 className="text-4xl font-display font-bold text-black mb-3 tracking-tight">
            {submitted ? 'Check your email' : 'Reset password'}
          </h1>
          <p className="text-gray-500 text-base font-medium leading-relaxed">
            {submitted
              ? `We've sent password reset instructions to ${email}. Check your inbox and follow the link.`
              : "Enter your email address and we'll send you a link to reset your password."}
          </p>
        </motion.div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative group"
            >
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
                <Mail size={20} strokeWidth={2.5} />
              </div>
              <input
                type="email"
                placeholder="Email address"
                className="ping-input pl-12"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                required
                autoComplete="email"
                disabled={isSubmitting}
              />
            </motion.div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-500 font-medium text-center"
              >
                {error}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="pt-4"
            >
              <button
                type="submit"
                className="ping-btn disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <ArrowRight size={20} strokeWidth={2.5} />
                )}
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>
            </motion.div>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="pt-4"
          >
            <button onClick={onBack} className="ping-btn-outline">
              Return to sign in
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
