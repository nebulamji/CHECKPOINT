import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../main';

interface Note {
  pitch: number;
  note_name: string;
  start_time: number;
  end_time: number;
  velocity: number;
}

interface TechnicalDetails {
  tempo: number;
  key_signature: string;
  time_signature: string;
  total_time: number;
  note_count: number;
  notes: Note[];
  beats: number[];
}

interface AnalysisResult {
  analysis: string;
  technical_details: TechnicalDetails;
  files: {
    midi: string;
  };
}

interface MusicAnalyzerProps {
  className?: string;
}

const MusicAnalyzer: React.FC<MusicAnalyzerProps> = ({ className }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 44100,
          sampleSize: 16
        }
      });

      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(audioBlob);
          setAudioURL(url);

          const audioContext = new AudioContext();
          const audioData = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(audioData);

          const wavBlob = await convertToWav(audioBuffer);
          await analyzeAudio(wavBlob);
        } catch (err) {
          console.error('Error processing audio:', err);
          setError('Error processing audio. Please try again.');
        }
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setAnalysisResult(null);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setError('Error accessing microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const analyzeAudio = async (audioBlob: Blob) => {
    try {
      console.log('Starting audio analysis...');
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');

      const response = await fetch(`${API_BASE_URL}/analyze-music`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Analysis failed: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log('Analysis result received:', result);

      if (!result || !result.technical_details || !result.files) {
        throw new Error('Invalid analysis result structure');
      }

      setAnalysisResult(result);
    } catch (error) {
      console.error('Error analyzing audio:', error);
      setError(`Error analyzing audio: ${error}`);
    }
  };

  const convertToWav = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const numOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const offset = 44;
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset + i * bytesPerSample, sample * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  return (
    <div className={`music-analyzer ${className || ''}`}>
      <div className="flex gap-4 h-[200px]">
        {/* Left column: Recording controls */}
        <div className="w-64 p-4 bg-black/50 backdrop-blur-md rounded-lg">
          <h2 className="text-lg font-bold mb-4">Music Analyzer</h2>
          <div className="space-y-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full py-2 px-4 rounded ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white transition-colors`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            {error && (
              <div className="text-red-500 text-sm mt-2">{error}</div>
            )}

            {audioURL && (
              <div className="mt-4">
                <audio src={audioURL} controls className="w-full" />
              </div>
            )}
          </div>
        </div>

        {/* Analysis results */}
        <div className="flex-1 flex gap-4">
          {analysisResult ? (
            <>
              {/* Technical details and visualization */}
              <div className="flex-1 p-4 bg-black/50 backdrop-blur-md rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Analysis Results</h3>
                  <div className="flex gap-2">
                    <a
                      href={`${API_BASE_URL}/download/midi/${analysisResult.files.midi}`}
                      download
                      className="py-1 px-3 bg-green-500 hover:bg-green-600 text-white rounded text-center text-sm"
                    >
                      MIDI
                    </a>
                  </div>
                </div>

                <div className="text-sm text-gray-400 mb-4">
                  <div>Tempo: {analysisResult.technical_details.tempo.toFixed(1)} BPM</div>
                  <div>Notes: {analysisResult.technical_details.note_count}</div>
                  <div>Duration: {analysisResult.technical_details.total_time.toFixed(2)}s</div>
                </div>

                <div className="h-20 bg-black/20 rounded overflow-hidden relative">
                  {analysisResult.technical_details.notes.map((note, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `${(note.start_time / analysisResult.technical_details.total_time) * 100}%`,
                        bottom: `${(note.pitch % 12) * 8}%`,
                        width: '4px',
                        height: '8px',
                        backgroundColor: 'rgba(66, 135, 245, 0.8)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Analysis text */}
              <div className="w-96 p-4 bg-black/50 backdrop-blur-md rounded-lg">
                <h4 className="font-medium mb-2">Musical Analysis:</h4>
                <div className="h-[120px] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{analysisResult.analysis}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 p-4 bg-black/50 backdrop-blur-md rounded-lg">
              <div className="text-center text-gray-400">
                Record some audio to see the analysis
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicAnalyzer;
