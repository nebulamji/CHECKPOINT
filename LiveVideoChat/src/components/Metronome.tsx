import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface MetronomeProps {
  className?: string;
}

interface TimeSignature {
  beats: number;
  name: string;
  defaultAccents: boolean[];
}

const timeSignatures: TimeSignature[] = [
  { beats: 2, name: "2/4", defaultAccents: [true, false] },
  { beats: 3, name: "3/4", defaultAccents: [true, false, false] },
  { beats: 4, name: "4/4", defaultAccents: [true, false, false, false] },
  { beats: 5, name: "5/4", defaultAccents: [true, false, false, true, false] },
  { beats: 6, name: "6/8", defaultAccents: [true, false, false, true, false, false] },
  { beats: 7, name: "7/8", defaultAccents: [true, false, false, true, false, true, false] }
];

export function Metronome({ className }: MetronomeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [selectedTimeSignature, setSelectedTimeSignature] = useState<TimeSignature>(timeSignatures[2]);
  const [accentPattern, setAccentPattern] = useState<boolean[]>([]);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customNumerator, setCustomNumerator] = useState(4);
  const [customDenominator, setCustomDenominator] = useState(4);

  const audioContext = useRef<AudioContext | null>(null);
  const nextNoteTime = useRef(0);
  const timerID = useRef<number | null>(null);
  const scheduledNotes = useRef<number>(0);

  // Initialize audio context and accent pattern
  useEffect(() => {
    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAccentPattern([...selectedTimeSignature.defaultAccents]);
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  // Update accent pattern when time signature changes
  useEffect(() => {
    if (!isCustomTime) {
      setAccentPattern([...selectedTimeSignature.defaultAccents]);
    }
    if (isPlaying) {
      stopMetronome();
      startMetronome();
    }
  }, [selectedTimeSignature, isCustomTime]);

  // Handle custom time signature changes
  useEffect(() => {
    if (isCustomTime) {
      handleCustomTimeChange(customNumerator, customDenominator);
    }
  }, [customNumerator, customDenominator, isCustomTime]);

  const createOscillator = (time: number, isAccent: boolean) => {
    const osc = audioContext.current!.createOscillator();
    const gainNode = audioContext.current!.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioContext.current!.destination);

    if (isAccent) {
      osc.frequency.setValueAtTime(1200, time);
      gainNode.gain.setValueAtTime(0.8, time);
    } else {
      osc.frequency.setValueAtTime(800, time);
      gainNode.gain.setValueAtTime(0.4, time);
    }

    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    return osc;
  };

  const scheduleNote = (beatNumber: number, time: number) => {
    const isAccent = accentPattern[beatNumber];
    const osc = createOscillator(time, isAccent);
    osc.start(time);
    osc.stop(time + 0.1);
  };

  const nextNote = () => {
    // Play the current beat first
    scheduleNote(scheduledNotes.current, nextNoteTime.current);
    setCurrentBeat(scheduledNotes.current);

    // Update timing for next beat
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTime.current += secondsPerBeat;

    // Increment beat counter after playing
    scheduledNotes.current = (scheduledNotes.current + 1) % selectedTimeSignature.beats;
  };

  const scheduler = () => {
    while (nextNoteTime.current < audioContext.current!.currentTime + 0.1) {
      nextNote();
    }
    timerID.current = requestAnimationFrame(scheduler);
  };

  const stopMetronome = () => {
    if (timerID.current) {
      cancelAnimationFrame(timerID.current);
    }
    setIsPlaying(false);
    setCurrentBeat(0);
    scheduledNotes.current = 0;
  };

  const startMetronome = () => {
    if (audioContext.current?.state === 'suspended') {
      audioContext.current.resume();
    }

    // Initialize beat counters
    setCurrentBeat(0);
    scheduledNotes.current = 0;

    // Start scheduling from current time
    nextNoteTime.current = audioContext.current!.currentTime;

    // Start playing
    setIsPlaying(true);
    scheduler();
  };

  const startStop = () => {
    if (isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  };

  const toggleAccent = (beatIndex: number) => {
    const newPattern = [...accentPattern];
    newPattern[beatIndex] = !newPattern[beatIndex];
    setAccentPattern(newPattern);
  };

  const handleCustomTimeChange = (numerator: number | string, denominator: number | string) => {
    // Handle empty string or invalid input
    const validNumerator = numerator === '' ? '' : Math.max(1, parseInt(numerator.toString()) || 1);
    const validDenominator = denominator === '' ? '' : Math.max(1, parseInt(denominator.toString()) || 1);

    setCustomNumerator(validNumerator);
    setCustomDenominator(validDenominator);

    // Only create accent pattern if we have valid numbers
    if (typeof validNumerator === 'number' && typeof validDenominator === 'number') {
      // Create new accent pattern
      const newAccents = Array(validNumerator).fill(false);

      // Set accents based on denominator
      if (validDenominator <= 4) {
        // Simple meter: accent first beat of each measure
        newAccents[0] = true;
      } else {
        // Compound meter: accent every third beat
        for (let i = 0; i < validNumerator; i += 3) {
          newAccents[i] = true;
        }
      }

      setAccentPattern(newAccents);
    }
  };

  const toggleCustomTime = () => {
    setIsCustomTime(!isCustomTime);
    if (isPlaying) {
      stopMetronome();
    }
  };

  return (
    <div className={`p-6 bg-black/50 backdrop-blur-md rounded-lg ${className}`}>
      <h2 className="text-2xl font-bold mb-4 text-white">Metronome</h2>

      <div className="flex flex-col gap-4">
        {/* BPM Control */}
        <div className="flex items-center gap-4">
          <label className="text-white">BPM:</label>
          <input
            type="range"
            min="40"
            max="240"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="flex-grow"
          />
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(Math.min(240, Math.max(40, parseInt(e.target.value) || 40)))}
            className="w-16 bg-white/10 text-white p-1 rounded"
          />
        </div>

        {/* Custom Time Signature Toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleCustomTime}
            className={`px-3 py-1 rounded ${
              isCustomTime
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Custom Time
          </button>
          {isCustomTime && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customNumerator}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) {
                    handleCustomTimeChange(val, customDenominator);
                  }
                }}
                onBlur={() => {
                  // On blur, ensure we have a valid number
                  if (customNumerator === '' || typeof customNumerator === 'string') {
                    handleCustomTimeChange(1, customDenominator);
                  }
                }}
                className="w-16 bg-white/10 text-white p-1 rounded"
              />
              <span className="text-white">/</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customDenominator}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) {
                    handleCustomTimeChange(customNumerator, val);
                  }
                }}
                onBlur={() => {
                  // On blur, ensure we have a valid number
                  if (customDenominator === '' || typeof customDenominator === 'string') {
                    handleCustomTimeChange(customNumerator, 4);
                  }
                }}
                className="w-16 bg-white/10 text-white p-1 rounded"
              />
            </div>
          )}
        </div>

        {/* Time Signature Selection */}
        {!isCustomTime && (
          <div className="flex gap-2 flex-wrap">
            {timeSignatures.map((ts) => (
              <button
                key={ts.name}
                onClick={() => setSelectedTimeSignature(ts)}
                className={`px-3 py-1 rounded ${
                  selectedTimeSignature.beats === ts.beats
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {ts.name}
              </button>
            ))}
          </div>
        )}

        {/* Accent Pattern */}
        <div className="flex gap-2 my-4 flex-wrap">
          {accentPattern.map((isAccent, i) => (
            <button
              key={i}
              onClick={() => toggleAccent(i)}
              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                i === currentBeat && isPlaying
                  ? 'ring-2 ring-blue-500'
                  : ''
              } ${
                isAccent
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/20 text-white/50'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Visual Beat Indicator */}
        <div className="flex gap-2 my-4 flex-wrap">
          {Array.from({ length: isCustomTime ? customNumerator : selectedTimeSignature.beats }).map((_, i) => (
            <motion.div
              key={i}
              className={`h-4 w-4 rounded-full ${
                i === currentBeat && isPlaying
                  ? accentPattern[i]
                    ? 'bg-blue-500'
                    : 'bg-white/50'
                  : accentPattern[i]
                  ? 'bg-blue-500/50'
                  : 'bg-white/20'
              }`}
              animate={i === currentBeat && isPlaying ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 60 / bpm }}
            />
          ))}
        </div>

        {/* Play/Stop Button */}
        <button
          onClick={startStop}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          {isPlaying ? 'Stop' : 'Start'}
        </button>
      </div>
    </div>
  );
}
