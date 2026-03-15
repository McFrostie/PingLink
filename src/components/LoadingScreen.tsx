// src/components/LoadingScreen.tsx
import { motion } from 'motion/react';

/**
 * Post-splash loading screen.
 * Shown briefly if auth state has not resolved by the time the 2.5s splash ends.
 * In practice this is nearly instant (localStorage read), so this rarely shows.
 */
export default function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-black">
      {/* Reuse the same logo as Splash for visual continuity */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-ping rounded-xl flex items-center justify-center shadow-lg shadow-ping/20 transform -rotate-3">
          <div className="w-3.5 h-3.5 bg-white rounded-full" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white tracking-tight">PingLink</h1>
      </div>

      {/* Pulsing dots spinner */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-white/40 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  );
}
