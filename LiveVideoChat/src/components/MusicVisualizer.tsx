import React, { useEffect, useRef, useState } from 'react';

interface Note {
  pitch: number;
  note_name: string;
  start_time: number;
  end_time: number;
  velocity: number;
}

interface MusicData {
  technical_details: {
    tempo: number;
    key_signature: string;
    time_signature: string;
    total_time: number;
    note_count: number;
    notes: Note[];
    beats: number[];
  };
  analysis: string;
  files?: {
    midi: string;
    musicxml: string;
  };
}

interface MusicVisualizerProps {
  musicData?: MusicData;
  width?: number;
  height?: number;
  audioUrl?: string;
}

const defaultWidth = 800;
const defaultHeight = 600;

const MusicVisualizer: React.FC<MusicVisualizerProps> = ({
  musicData,
  width = defaultWidth,
  height = defaultHeight,
  audioUrl
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (audioUrl) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.addEventListener('play', startVisualization);
      audioRef.current.addEventListener('pause', stopVisualization);
      audioRef.current.addEventListener('ended', stopVisualization);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', startVisualization);
        audioRef.current.removeEventListener('pause', stopVisualization);
        audioRef.current.removeEventListener('ended', stopVisualization);
      }
      stopVisualization();
    };
  }, [audioUrl]);

  const startVisualization = () => {
    const updateVisualizer = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        drawVisualization();
      }
      animationFrameRef.current = requestAnimationFrame(updateVisualizer);
    };
    updateVisualizer();
  };

  const stopVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const drawVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas || !musicData?.technical_details?.notes) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let x = 60; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw notes
    const { notes } = musicData.technical_details;
    const timeScale = (width - 60) / 4;  // 4 seconds window
    const pitchHeight = height / 2 / 36;  // 3 octaves

    notes.forEach(note => {
      if (!note || typeof note.start_time !== 'number' || typeof note.pitch !== 'number') return;

      const x = 60 + (note.start_time - currentTime) * timeScale;
      const y = height / 2 - (note.pitch - 48) * pitchHeight;
      const noteWidth = ((note.end_time || note.start_time + 0.5) - note.start_time) * timeScale;
      const opacity = (note.velocity || 100) / 127;

      if (x + noteWidth < 60 || x > width) return;

      ctx.fillStyle = `rgba(66, 135, 245, ${opacity})`;
      ctx.fillRect(x, y, Math.max(noteWidth, 1), pitchHeight * 0.8);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(x, y, Math.max(noteWidth, 1), pitchHeight * 0.8);
    });

    // Draw playhead
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 0);
    ctx.lineTo(60, height);
    ctx.stroke();
  };

  // Initial draw
  useEffect(() => {
    drawVisualization();
  }, [musicData, width, height]);

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500 rounded">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!musicData?.technical_details?.notes) {
    return (
      <div className="p-4 bg-gray-500/10 border border-gray-500 rounded">
        <p className="text-gray-500">No music data available</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full bg-gray-900 rounded"
      />

      {musicData && (
        <div className="music-info mt-4 p-4 bg-black/50 backdrop-blur-md rounded text-white">
          <div>Tempo: {musicData.technical_details.tempo.toFixed(1)} BPM</div>
          <div>Key: {musicData.technical_details.key_signature}</div>
          <div>Time Signature: {musicData.technical_details.time_signature}</div>
          <div>Notes: {musicData.technical_details.note_count}</div>
        </div>
      )}

      {audioUrl && (
        <div className="audio-controls mt-4">
          <audio
            ref={audioRef}
            controls
            src={audioUrl}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default MusicVisualizer;
