import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Factory } from 'vexflow';

interface Note {
  pitch: string;
  duration: number;
  offset: number;
}

interface SheetMusicAnalysis {
  melody: Note[];
  harmony: Array<{
    symbol: string;
    duration: number;
    offset: number;
  }>;
  form: {
    sections: Array<{
      name: string;
      start: number;
      end: number;
    }>;
  };
  style_markers: string[];
  suggested_concepts: string[];
  key: string;
  time_signature: string;
}

interface SheetMusicTranscriberProps {
  className?: string;
}

const SheetMusicTranscriber: React.FC<SheetMusicTranscriberProps> = ({ className }) => {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<SheetMusicAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (analysis?.melody && scoreRef.current) {
      renderScore();
    }
    if (analysis?.melody && canvasRef.current) {
      renderPianoRoll();
    }
  }, [analysis]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const renderScore = () => {
    if (!scoreRef.current || !analysis?.melody || analysis.melody.length === 0) {
      console.log('No score reference or melody data');
      return;
    }

    // Clear previous content
    scoreRef.current.innerHTML = '';

    try {
      // Create VexFlow factory with a div container
      const container = document.createElement('div');
      scoreRef.current.appendChild(container);

      const vf = new Factory({
        renderer: {
          elementId: null,
          element: container,
          width: 800,
          height: 200,
        },
      });

      // Create and format system
      const system = vf.System();

      // Create a stave
      const stave = system.addStave({
        width: 750,
      }).addClef('treble').addTimeSignature(analysis.time_signature || '4/4');

      // Create notes
      const notes = analysis.melody.map(note => {
        try {
          // Convert duration to VexFlow format (e.g., 1 = whole note, 2 = half note, 4 = quarter note)
          const duration = Math.max(1, Math.min(16, Math.round(1 / note.duration))); // Clamp between whole note and sixteenth note
          return vf.StaveNote({
            keys: [note.pitch.toLowerCase()],
            duration: String(duration)
          });
        } catch (noteErr) {
          console.error('Error creating note:', noteErr, note);
          // Return a quarter note rest as fallback
          return vf.StaveNote({
            keys: ['b/4'],
            duration: '4r'
          });
        }
      });

      // If no valid notes were created, add a placeholder rest
      if (notes.length === 0) {
        notes.push(vf.StaveNote({
          keys: ['b/4'],
          duration: 'wr'  // whole rest
        }));
      }

      // Create a voice with proper timing
      const voice = vf.Voice({ time: '4/4' }).setStrict(false);
      voice.addTickables(notes);

      // Format and justify the notes
      vf.Formatter()
        .joinVoices([voice])
        .format([voice], 700);

      // Draw everything
      vf.draw();

      console.log('Rendered score with', notes.length, 'notes');
    } catch (err) {
      console.error('Error rendering sheet music:', err);
      setError('Error rendering sheet music visualization');
    }
  };

  const renderPianoRoll = () => {
    if (!canvasRef.current || !analysis?.melody) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Calculate total duration and pixels per second
    const totalDuration = analysis.melody.reduce((sum, note) => sum + note.duration, 0);
    const pixelsPerSecond = width / totalDuration;

    // Draw notes
    analysis.melody.forEach(note => {
      const x = note.offset * pixelsPerSecond;
      const noteHeight = 10;
      // Simple mapping of pitch to y position (can be improved)
      const pitchMap: { [key: string]: number } = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };
      const basePitch = note.pitch.charAt(0);
      const octave = parseInt(note.pitch.slice(-1));
      const y = height - ((pitchMap[basePitch] || 0) + (octave * 7)) * noteHeight;
      const noteWidth = note.duration * pixelsPerSecond;

      ctx.fillStyle = '#4a9eff';
      ctx.fillRect(x, y, noteWidth, noteHeight);
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      if (selectedFile.type === 'application/pdf' || selectedFile.type.startsWith('image/')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a PDF or image file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://3.23.23.171:3000/analyze-sheet-music', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.analysis) {
        setAnalysis(response.data.analysis);
      } else {
        setError('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error analyzing sheet music:', err);
      setError('Error analyzing sheet music. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile.type === 'application/pdf' || droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please upload a PDF or image file');
    }
  };

  return (
    <div className={`sheet-music-transcriber ${className || ''} w-full h-full p-4`}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        {/* Upload section */}
        <div className="lg:col-span-4 bg-black/50 backdrop-blur-md rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6 text-white">Sheet Music Analyzer</h2>

          <div
            className="border-2 border-dashed border-gray-400 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors mb-6"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,image/*"
              className="hidden"
            />
            {file ? (
              <div className="text-white">
                <p className="font-medium text-lg mb-2">{file.name}</p>
                <p className="text-gray-300">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="py-8">
                <p className="text-gray-300 text-lg mb-2">Drag and drop or click to upload</p>
                <p className="text-gray-400">Supports PDF and image files</p>
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-500 text-sm mb-4 p-3 bg-red-500/10 rounded-lg">{error}</div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className={`w-full py-3 px-6 rounded-lg text-lg font-medium ${
              !file || loading
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white transition-colors`}
          >
            {loading ? 'Analyzing...' : 'Analyze Sheet Music'}
          </button>
        </div>

        {/* Visualization section */}
        {analysis && (
          <div className="lg:col-span-8 space-y-6">
            {/* Sheet music score */}
            <div className="bg-white rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Sheet Music</h3>
              <div ref={scoreRef} className="w-full overflow-x-auto" />
            </div>

            {/* Piano roll visualization */}
            <div className="bg-black/50 backdrop-blur-md rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">Piano Roll</h3>
              <canvas
                ref={canvasRef}
                width={800}
                height={200}
                className="w-full bg-gray-900 rounded"
              />
            </div>

            {/* Playback controls */}
            <div className="bg-black/50 backdrop-blur-md rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="space-x-4">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    {isPlaying ? 'Stop' : 'Play'}
                  </button>
                </div>
                <div className="text-white">
                  Time: {currentTime.toFixed(1)}s
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SheetMusicTranscriber;
