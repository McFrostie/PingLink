import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import splash1 from '../assests/onboarding/splash-1.webp';
import splash2 from '../assests/onboarding/splash-2.webp';
import splash3 from '../assests/onboarding/splash-3.webp';

interface OnboardingProps {
  key?: string;
  onComplete: () => void;
}

const slides = [
  {
    id: 1,
    title: "Find your arena",
    description: "Discover local tables and venues instantly. Never play alone again.",
    image: splash1
  },
  {
    id: 2,
    title: "Meet your match",
    description: "Connect with players at your exact skill level. From basement heroes to pros.",
    image: splash2
  },
  {
    id: 3,
    title: "Dominate the table",
    description: "Track your stats, join local leagues, and climb the leaderboards.",
    image: splash3
  }
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [current, setCurrent] = useState(0);

  const nextSlide = () => {
    if (current === slides.length - 1) {
      onComplete();
    } else {
      setCurrent(c => c + 1);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white relative overflow-hidden">
      {/* Image Section */}
      <div className="relative flex-1 w-full overflow-hidden bg-gray-100">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <img 
              src={slides[current].image} 
              alt="Background" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent"></div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Content Section */}
      <div className="relative z-10 flex-shrink-0 flex flex-col justify-between px-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-8 bg-white min-h-[40%] rounded-t-3xl -mt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="text-4xl font-display font-bold text-black mb-3 tracking-tight">
              {slides[current].title}
            </h2>
            <p className="text-gray-500 text-base font-medium leading-relaxed">
              {slides[current].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          {/* Pagination Indicators */}
          <div className="flex gap-2">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className="h-2 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: current === idx ? '24px' : '8px',
                  backgroundColor: current === idx ? '#FF3366' : '#E2E8F0',
                }}
              />
            ))}
          </div>

          {/* Next Button */}
          <button
            onClick={nextSlide}
            className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-black/20 hover:bg-ping"
          >
            <ArrowRight size={24} color="#ffffff" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
