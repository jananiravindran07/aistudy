import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Capybara, { type CapybaraMood } from '../components/Capybara';

const moods: CapybaraMood[] = ['idle', 'studying', 'eating', 'happy', 'sleepy', 'thinking'];

export default function CapybaraDemo() {
  const [mood, setMood] = useState<CapybaraMood>('idle');
  const reduceMotion = useReducedMotion();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-4 sm:py-10">
      <header className="text-center">
        <span className="auth-kicker">Mascot preview</span>
        <h1 className="text-3xl text-pastel-brown">Capybara moods</h1>
        <p className="mt-2 font-bold capitalize text-pastel-brown/65" aria-live="polite">{mood}</p>
      </header>

      <motion.section
        key={mood}
        initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="card flex aspect-square w-full max-w-[360px] items-center justify-center border-pastel-peach/60 bg-white/70 p-8"
      >
        <Capybara mood={mood} />
      </motion.section>

      <div role="group" aria-label="Choose a capybara mood" className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
        {moods.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mood === option}
            onClick={() => setMood(option)}
            className={`rounded-xl border-2 px-4 py-3 font-extrabold capitalize transition-colors ${mood === option ? 'border-pastel-brown bg-pastel-brown text-white' : 'border-white bg-white/75 text-pastel-brown hover:bg-pastel-peach/40'}`}
          >
            {option}
          </button>
        ))}
      </div>
    </main>
  );
}