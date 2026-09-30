import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type CapybaraMood = 'idle' | 'studying' | 'eating' | 'happy' | 'sleepy' | 'thinking';
export type CapybaraState = CapybaraMood;

interface CapybaraProps {
  mood?: CapybaraMood;
  state?: CapybaraMood;
  className?: string;
  onClick?: () => void;
  levelUp?: boolean;
}

const speechLines = ['Keep going!', 'Carrot time?', 'You have got this!', 'One small step.'];
const outline = '#34271f';
const tan = '#d9a877';
const darkTan = '#c38c5f';

export default function Capybara({ mood, state, className = '', onClick, levelUp = false }: CapybaraProps) {
  const currentMood = mood ?? state ?? 'idle';
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [blinking, setBlinking] = useState(false);
  const [speech, setSpeech] = useState('');

  useEffect(() => {
    const syncVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  useEffect(() => {
    if (reduceMotion || !visible) return;
    let timeout: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const scheduleBlink = () => {
      timeout = window.setTimeout(() => {
        if (cancelled) return;
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 140);
        scheduleBlink();
      }, 3200 + Math.random() * 1800);
    };
    scheduleBlink();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [reduceMotion, visible]);

  const animateClick = () => {
    if (onClick) onClick();
    const line = speechLines[Math.floor(Math.random() * speechLines.length)];
    setSpeech(line);
    window.setTimeout(() => setSpeech(''), 1800);
  };

  const breathing = reduceMotion || !visible
    ? { scaleY: 1.01 }
    : { scaleY: currentMood === 'sleepy' ? [1, 1.018, 1] : [1, 1.03, 1] };
  const movementDuration = currentMood === 'sleepy' ? 5 : 3;
  const activeLoop = !reduceMotion && visible;

  return (
    <div className={`relative h-full w-full ${className}`}>
      {speech && (
        <motion.div
          initial={reduceMotion || !visible ? false : { opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute -right-2 -top-5 z-20 max-w-40 rounded-2xl border-2 border-white bg-white px-3 py-2 text-center text-xs font-extrabold text-pastel-brown shadow-md"
          role="status"
        >
          {speech}
        </motion.div>
      )}

      <motion.svg
        viewBox="0 0 240 220"
        role="img"
        aria-label={`Capybara feeling ${currentMood}. Click for encouragement.`}
        onClick={animateClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            animateClick();
          }
        }}
        tabIndex={0}
        className="h-full w-full cursor-pointer overflow-visible drop-shadow-md focus-visible:rounded-full"
      >
        <defs>
          <clipPath id="capybara-face-clip"><ellipse cx="120" cy="106" rx="72" ry="66" /></clipPath>
        </defs>

        {levelUp && !reduceMotion && visible && (
          <g pointerEvents="none">
            <motion.circle
              cx="120" cy="112" r="100" fill="none" stroke="#ffa552" strokeWidth="5"
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.82, 1.08, 1.2] }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              style={{ transformOrigin: '120px 112px' }}
            />
            <motion.path
              d="m120 5 4 10 10 4-10 4-4 10-4-10-10-4 10-4z m92 97 3 7 7 3-7 3-3 7-3-7-7-3 7-3z m-183 5 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"
              fill="#ffa552"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], scale: [0.6, 1.1, 0.8], rotate: [0, 12, -8] }}
              transition={{ duration: 1.3, ease: 'easeOut' }}
              style={{ transformOrigin: '120px 100px' }}
            />
          </g>
        )}

        <motion.g
          animate={activeLoop || levelUp ? {
            y: activeLoop ? currentMood === 'sleepy' ? [0, 3, 0] : [0, -2, 0] : 0,
            scale: levelUp && !reduceMotion ? [0.92, 1.08, 1] : 1,
          } : { y: 0, scale: 1 }}
          transition={{ duration: levelUp ? 0.55 : currentMood === 'thinking' ? 4 : 3, repeat: activeLoop && !levelUp ? Infinity : 0, ease: 'easeInOut' }}
          style={{ transformOrigin: '120px 112px' }}
        >
          {/* Rear feet */}
          <g stroke={outline} strokeWidth="5" strokeLinejoin="round">
            <ellipse cx="73" cy="191" rx="22" ry="13" fill={darkTan} />
            <ellipse cx="167" cy="191" rx="22" ry="13" fill={darkTan} />
          </g>

          {/* Ears */}
          <motion.g
            animate={activeLoop ? { rotate: [0, 0, -5, 0, 0] } : { rotate: 0 }}
            transition={{ duration: 4.7, repeat: activeLoop ? Infinity : 0, ease: 'easeInOut' }}
            style={{ transformOrigin: '54px 82px' }}
          >
            <circle cx="58" cy="77" r="18" fill={tan} stroke={outline} strokeWidth="5" />
            <circle cx="58" cy="77" r="7" fill="#b97e61" />
          </motion.g>
          <motion.g
            animate={activeLoop ? { rotate: [0, 0, 5, 0, 0] } : { rotate: 0 }}
            transition={{ duration: 5.2, repeat: activeLoop ? Infinity : 0, ease: 'easeInOut', delay: 1.1 }}
            style={{ transformOrigin: '182px 82px' }}
          >
            <circle cx="182" cy="77" r="18" fill={tan} stroke={outline} strokeWidth="5" />
            <circle cx="182" cy="77" r="7" fill="#b97e61" />
          </motion.g>

          {/* Body */}
          <motion.g animate={breathing} transition={{ duration: movementDuration, repeat: activeLoop ? Infinity : 0, ease: 'easeInOut' }} style={{ transformOrigin: '120px 159px' }}>
            <ellipse cx="120" cy="150" rx="84" ry="61" fill={tan} stroke={outline} strokeWidth="6" />
            <path d="M56 155 Q120 181 184 155" fill="none" stroke="#e5bd91" strokeWidth="3" strokeLinecap="round" opacity=".65" />
          </motion.g>

          {/* Head */}
          <motion.g
            animate={currentMood === 'thinking' && activeLoop ? { rotate: [-2, 3, -2] } : currentMood === 'sleepy' ? { y: 4 } : { rotate: 0, y: 0 }}
            transition={{ duration: 3.7, repeat: currentMood === 'thinking' && activeLoop ? Infinity : 0, ease: 'easeInOut' }}
            style={{ transformOrigin: '120px 114px' }}
          >
            <ellipse cx="120" cy="108" rx="75" ry="69" fill={tan} stroke={outline} strokeWidth="6" />

            {/* Studying headphones */}
            {currentMood === 'studying' && (
              <g fill="none" stroke={outline} strokeWidth="9" strokeLinecap="round">
                <path d="M58 96 A63 63 0 0 1 182 96" />
                <rect x="48" y="90" width="17" height="36" rx="8" fill="#bde0fe" />
                <rect x="175" y="90" width="17" height="36" rx="8" fill="#bde0fe" />
              </g>
            )}

            {/* Blush */}
            <g opacity={currentMood === 'happy' || currentMood === 'eating' ? 1 : 0.8}>
              <ellipse cx="69" cy="130" rx="16" ry="9" fill="#ef9fa8" />
              <ellipse cx="171" cy="130" rx="16" ry="9" fill="#ef9fa8" />
              {(currentMood === 'happy' || currentMood === 'eating') && (
                <>
                  <motion.path d="M61 130h4m8 0h4m86 0h4m8 0h4" stroke="#c66e7d" strokeWidth="2.5" strokeLinecap="round" animate={activeLoop ? { opacity: [0.3, 1, 0.3] } : { opacity: 1 }} transition={{ duration: 0.8, repeat: activeLoop ? Infinity : 0 }} />
                </>
              )}
            </g>

            {/* Closed, blinking eyes */}
            <g fill="none" stroke={outline} strokeWidth="5.5" strokeLinecap="round">
              {currentMood === 'sleepy' || blinking ? (
                <><path d="M79 105q9 7 18 0" /><path d="M143 105q9 7 18 0" /></>
              ) : currentMood === 'happy' ? (
                <><path d="M79 105q9-13 18 0" /><path d="M143 105q9-13 18 0" /></>
              ) : (
                <><path d="M80 105q8-6 16 0" /><path d="M144 105q8-6 16 0" /></>
              )}
            </g>

            {/* Snout patch, nose and mouth */}
            <motion.g animate={currentMood === 'eating' && activeLoop ? { scaleY: [1, 0.9, 1] } : { scaleY: 1 }} transition={{ duration: 0.24, repeat: currentMood === 'eating' && activeLoop ? 5 : 0 }} style={{ transformOrigin: '120px 137px' }}>
              <ellipse cx="120" cy="137" rx="39" ry="27" fill="#8b5e3c" stroke={outline} strokeWidth="5" />
              <ellipse cx="120" cy="125" rx="9" ry="6" fill={outline} />
              <path d="M120 131v12m0 0q-8 11-15 3m15-3q8 11 15 3" fill="none" stroke={outline} strokeWidth="3.5" strokeLinecap="round" />
            </motion.g>

            {/* Forearms */}
            <motion.g
              animate={currentMood === 'happy' && activeLoop ? { rotate: [-8, 15, -8] } : { rotate: 0 }}
              transition={{ duration: 0.8, repeat: currentMood === 'happy' && activeLoop ? 3 : 0 }}
              style={{ transformOrigin: '57px 162px' }}
            >
              <path d="M57 158q-17 1-15 19q3 11 17 4l13-11" fill={tan} stroke={outline} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              {currentMood === 'happy' && <path d="M46 155v-17m11 15v-18" stroke={outline} strokeWidth="4.5" strokeLinecap="round" />}
            </motion.g>
            <motion.g
              animate={currentMood === 'happy' && activeLoop ? { rotate: [8, -15, 8] } : { rotate: 0 }}
              transition={{ duration: 0.9, repeat: currentMood === 'happy' && activeLoop ? 3 : 0, delay: 0.1 }}
              style={{ transformOrigin: '183px 162px' }}
            >
              <path d="M183 158q17 1 15 19q-3 11-17 4l-13-11" fill={tan} stroke={outline} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </motion.g>
          </motion.g>

          {/* Front paws */}
          <g fill={tan} stroke={outline} strokeWidth="5">
            <ellipse cx="95" cy="190" rx="14" ry="9" />
            <ellipse cx="145" cy="190" rx="14" ry="9" />
          </g>

          {/* Book */}
          {currentMood === 'studying' && (
            <g stroke={outline} strokeWidth="4" strokeLinejoin="round">
              <path d="M91 171q-13-6-25 0v24q12-6 25 0zm0 0q13-6 25 0v24q-12-6-25 0z" fill="#fff8ec" />
              <path d="M71 178h13m-13 5h13m12-5h13m-13 5h13" stroke="#bde0fe" strokeWidth="2.5" />
            </g>
          )}

          {/* Eating carrot */}
          {currentMood === 'eating' && (
            <motion.g
              initial={!reduceMotion && visible ? { x: 42, y: 32, rotate: -35, opacity: 0 } : false}
              animate={!reduceMotion && visible ? { x: 0, y: 0, rotate: [0, -7, 5, -5, 0], opacity: 1 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
              transition={{ duration: 1.1, times: [0, 0.35, 0.5, 0.7, 0.88, 1], ease: 'easeOut' }}
            >
              <path d="M151 132l35 13-29 33q-5 5-9-2l-8-31z" fill="#ffa552" stroke={outline} strokeWidth="4" strokeLinejoin="round" />
              <path d="M150 135q-5-16 4-22m-3 23q5-15 17-16m-16 17q-2-13-13-16" fill="none" stroke="#8eaf71" strokeWidth="5" strokeLinecap="round" />
              <path d="m151 151 9 5m-14 3 7 5" stroke="#d87935" strokeWidth="2.5" strokeLinecap="round" />
            </motion.g>
          )}

          {/* Thinking bubble */}
          {currentMood === 'thinking' && (
            <g>
              <circle cx="182" cy="33" r="7" fill="white" stroke={outline} strokeWidth="3" />
              <circle cx="196" cy="19" r="11" fill="white" stroke={outline} strokeWidth="3" />
              <rect x="148" y="-3" width="78" height="38" rx="17" fill="white" stroke={outline} strokeWidth="3" />
              {[0, 1, 2].map((dot) => (
                <motion.circle key={dot} cx={169 + dot * 18} cy="16" r="3.3" fill="#8b5e3c" animate={activeLoop ? { opacity: [0.25, 1, 0.25], y: [0, -2, 0] } : { opacity: 1 }} transition={{ duration: 1.1, delay: dot * 0.18, repeat: activeLoop ? Infinity : 0 }} />
              ))}
            </g>
          )}

          {/* Sleepy Zs */}
          {currentMood === 'sleepy' && (
            <motion.g animate={activeLoop ? { y: [4, -4, 4], opacity: [0.45, 1, 0.45] } : { y: 0, opacity: 1 }} transition={{ duration: 3.2, repeat: activeLoop ? Infinity : 0 }}>
              <text x="173" y="34" fontSize="21" fontWeight="800" fill="#8b5e3c">z</text>
              <text x="190" y="18" fontSize="28" fontWeight="800" fill="#8b5e3c">Z</text>
            </motion.g>
          )}

          {/* Happy sparkles */}
          {currentMood === 'happy' && (
            <motion.g animate={activeLoop ? { opacity: [0.3, 1, 0.3], scale: [0.9, 1.08, 0.9] } : { opacity: 1 }} transition={{ duration: 1.2, repeat: activeLoop ? Infinity : 0 }} style={{ transformOrigin: '120px 105px' }} fill="#ffa552">
              <path d="m34 80 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
              <path d="m207 111 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
              <circle cx="47" cy="117" r="3" /><circle cx="202" cy="72" r="3" />
            </motion.g>
          )}

          {/* Crumbs and hearts while eating */}
          {currentMood === 'eating' && (
            <motion.g animate={activeLoop ? { opacity: [0, 1, 0], y: [0, -11, -21] } : { opacity: 1 }} transition={{ duration: 1.1, repeat: activeLoop ? 3 : 0 }}>
              <text x="50" y="112" fontSize="17">♥</text>
              <circle cx="188" cy="157" r="3" fill="#ffa552" />
              <circle cx="197" cy="145" r="2.5" fill="#ffa552" />
            </motion.g>
          )}
        </motion.g>
      </motion.svg>
    </div>
  );
}