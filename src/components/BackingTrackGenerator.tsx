import React, { useState } from 'react';
import axios from 'axios';

interface GenerationParams {
  prompt: string;
  tempo: number;
  complexity: number;
  length?: number;
  style?: string;
}

const BackingTrackGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('Swing');
  const [tempo, setTempo] = useState<number>(120);
  const [complexity, setComplexity] = useState<number>(50);
  const [prompt, setPrompt] = useState<string>('');

  const styles = [
    'Swing',
    'Latin',
    'Funk',
    'Modal',
    'Feel',
    'So What',
    'Impressions',
    'India',
    'Maiden Voyage'
  ];

  const generateTrack = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Combine user prompt with style if both are provided
      const finalPrompt = prompt.trim()
        ? `${prompt}${selectedStyle !== 'Swing' ? ` in ${selectedStyle} style` : ''}`
        : selectedStyle;

      const response = await axios.post('http://localhost:3000/generate-backing', {
        prompt: finalPrompt,
        tempo: tempo,
        complexity: complexity / 100,
        length: 32
      }, {
        responseType: 'blob'
      });

      const url = URL.createObjectURL(response.data);
      setAudioURL(url);
    } catch (err) {
      console.error('Error generating backing track:', err);
      setError('Failed to generate backing track. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative p-6 bg-black/50 backdrop-blur-md rounded-lg text-white z-10">
      <h2 className="text-2xl font-bold mb-6">Backing Track Generator</h2>

      {/* Prompt Input */}
      <div className="relative mb-6 z-20">
        <label className="block text-sm font-medium mb-2">
          Musical Idea
        </label>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'Giant Steps A Half Step Up', 'blues in C sharp'"
          className="w-full p-3 bg-gray-800 text-white border border-white/20 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-white/50"
          style={{
            position: 'relative',
            zIndex: 30
          }}
        />
      </div>

      {/* Style Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Style
        </label>
        <div className="flex flex-wrap gap-2">
          {styles.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style)}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedStyle === style
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Tempo Control */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Tempo: {tempo} BPM
        </label>
        <input
          type="range"
          min="60"
          max="300"
          value={tempo}
          onChange={(e) => setTempo(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Complexity Control */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Complexity: {complexity}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={complexity}
          onChange={(e) => setComplexity(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Generate Button */}
      <button
        onClick={generateTrack}
        disabled={isGenerating}
        className={`w-full py-3 px-4 rounded-md text-white font-medium ${
          isGenerating
            ? 'bg-blue-400/50 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isGenerating ? 'Generating...' : 'Generate Track'}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/20 text-red-300 rounded-md">
          {error}
        </div>
      )}

      {/* Audio Player */}
      {audioURL && (
        <div className="mt-6">
          <audio controls src={audioURL} className="w-full">
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Loading Indicator */}
      {isGenerating && (
        <div className="mt-4 text-center text-white/60">
          Generating track...
        </div>
      )}
    </div>
  );
};

export default BackingTrackGenerator;
