import { useEffect, useState } from 'react';

// Import all heavy background images to preload them into memory
import splash1 from '../assests/onboarding/splash-1.webp';
import splash2 from '../assests/onboarding/splash-2.webp';
import splash3 from '../assests/onboarding/splash-3.webp';
import loginCover from '../assests/onboarding/logincover.webp';
import signupCover from '../assests/onboarding/signupcover.webp';

const IMAGES_TO_PRELOAD = [splash1, splash2, splash3, loginCover, signupCover];

interface SplashProps {
  key?: string;
  onComplete: () => void;
}

export default function Splash({ onComplete }: SplashProps) {
  useEffect(() => {
    let timerDone = false;
    let imagesDone = false;

    // 1. Enforce a minimum 2.5s display time so the CSS animation finishes
    const timer = setTimeout(() => {
      timerDone = true;
      checkCompletion();
    }, 2500);

    // 2. Preload all background images into memory
    const preloadImages = async () => {
      try {
        await Promise.all(
          IMAGES_TO_PRELOAD.map((src) => {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.src = src;
              img.onload = resolve;
              img.onerror = resolve; // Resolve anyway to prevent the app from hanging forever
            });
          })
        );
      } catch (e) {
        console.error("Image preload failed", e);
      } finally {
        imagesDone = true;
        checkCompletion();
      }
    };

    preloadImages();

    // 3. Only transition when BOTH the animation is done AND images are loaded
    const checkCompletion = () => {
      if (timerDone && imagesDone) {
        onComplete();
      }
    };

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="splash-root flex flex-col items-center justify-center h-full w-full bg-black relative overflow-hidden">
      {/* Ambient glow — CSS animated */}
      <div className="splash-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-ping/20 rounded-full blur-3xl pointer-events-none" />

      {/* Logo — CSS animated */}
      <div className="splash-logo flex items-center gap-3 relative z-10">
        <div className="w-10 h-10 bg-ping rounded-xl flex items-center justify-center shadow-lg shadow-ping/20 transform -rotate-3">
          <div className="w-3.5 h-3.5 bg-white rounded-full" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white tracking-tight">PingLink</h1>
      </div>

      {/* Tagline — CSS animated with delay */}
      <p className="splash-tagline text-white/40 text-sm mt-3 tracking-widest uppercase font-medium relative z-10">
        Find. Play. Connect.
      </p>
    </div>
  );
}
