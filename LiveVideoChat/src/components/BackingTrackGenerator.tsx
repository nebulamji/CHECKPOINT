import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../main';

interface BackingTrackGeneratorProps {
  className?: string;
}

const styles = {
  'swing': ['Medium Swing', 'Fast Swing', 'Ballad', 'Waltz'],
  'latin': ['Bossa Nova', 'Samba', 'Salsa', 'Montuno'],
  'funk': ['Straight 8ths', 'Sixteenth', 'Half-time', 'Double-time'],
  'modal': ['So What', 'Impressions', 'India', 'Maiden Voyage']
};

const BackingTrackGenerator: React.FC<BackingTrackGeneratorProps> = ({ className }) => {
  const [style, setStyle] = useState('swing');
  const [subStyle, setSubStyle] = useState(styles[style][0]);
  const [tempo, setTempo] = useState(120);
  const [complexity, setComplexity] = useState(0.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');

  const generateTrack = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      // Combine prompt with style if provided
      const finalPrompt = prompt.trim()
        ? `${prompt} in ${style} style with ${subStyle} feel`
        : `${style} ${subStyle}`;

      const response = await axios.post(`${API_BASE_URL}/generate-backing`, {
        prompt: finalPrompt,
        tempo: tempo,
        complexity: complexity,
        length: 4,
        style: style.toLowerCase()
      }, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        const url = URL.createObjectURL(new Blob([response.data], { type: 'audio/wav' }));
        setAudioURL(url);
      } else {
        throw new Error('Failed to generate audio');
      }
    } catch (err) {
      console.error('Error generating backing track:', err);
      if (axios.isAxiosError(err) && err.response?.data) {
        // Try to read the error message from the blob
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorData = JSON.parse(reader.result as string);
            setError(errorData.detail || 'Failed to generate backing track. Please try again.');
          } catch {
            setError('Failed to generate backing track. Please try again.');
          }
        };
        reader.onerror = () => {
          setError('Failed to generate backing track. Please try again.');
        };
        reader.readAsText(err.response.data);
      } else {
        setError('Failed to generate backing track. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`p-4 bg-black/50 backdrop-blur-md rounded-lg ${className}`}>
      <h2 className="text-lg font-bold mb-4">Backing Track Generator</h2>

      <div className="space-y-4">
        {/* Musical Idea Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Musical Idea</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'Giant Steps A Half Step Up', 'blues in C sharp'"
            className="w-full py-2 px-3 bg-white/10 text-white border border-white/20 rounded text-sm placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Style Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Style</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(styles).map((styleOption) => (
              <button
                key={styleOption}
                onClick={() => {
                  setStyle(styleOption);
                  setSubStyle(styles[styleOption][0]);
                }}
                className={`py-2 px-3 rounded text-sm ${
                  style === styleOption
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {styleOption.charAt(0).toUpperCase() + styleOption.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-style Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Feel</label>
          <div className="grid grid-cols-2 gap-2">
            {styles[style].map((subStyleOption) => (
              <button
                key={subStyleOption}
                onClick={() => setSubStyle(subStyleOption)}
                className={`py-2 px-3 rounded text-sm ${
                  subStyle === subStyleOption
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {subStyleOption}
              </button>
            ))}
          </div>
        </div>

        {/* Tempo Control */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Tempo: {tempo} BPM
          </label>
          <input
            type="range"
            min="40"
            max="300"
            value={tempo}
            onChange={(e) => setTempo(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Complexity Control */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Complexity: {Math.round(complexity * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={complexity * 100}
            onChange={(e) => setComplexity(parseInt(e.target.value) / 100)}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={generateTrack}
          disabled={isGenerating}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : 'Generate Track'}
        </button>

        {/* Error Message */}
        {error && (
          <div className="text-red-500 text-sm mt-2">{error}</div>
        )}

        {/* Audio Player */}
        {audioURL && (
          <div className="mt-4">
            <audio src={audioURL} controls className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export default BackingTrackGenerator;
