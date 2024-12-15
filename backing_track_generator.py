import os
import logging
import json
import openai
import httpx
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
import pretty_midi
import note_seq
import soundfile as sf
import numpy as np
from magenta.models.melody_rnn import melody_rnn_sequence_generator
from magenta.models.drums_rnn import drums_rnn_sequence_generator
from magenta.models.music_vae import configs as vae_configs
from magenta.models.music_vae import TrainedModel
from magenta.models.shared import sequence_generator_bundle
from magenta.music import sequences_lib
from magenta.music import midi_io
from magenta.music import audio_io
from magenta.music import constants
from magenta.music import midi_synth
from magenta.music import musicnet_io
from magenta.models.improv_rnn import improv_rnn_sequence_generator
import note_seq.protobuf.generator_pb2
import re
import random

# Initialize logging
logging.basicConfig(
    filename='backing_track.log',
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    maxBytes=10485760,
    backupCount=5
)

STANDARD_PROGRESSIONS = {
    "Giant Steps": [
        ("Bmaj7", 0.5), ("D7", 0.5), ("Gmaj7", 0.5), ("Bb7", 0.5),
        ("Ebmaj7", 0.5), ("F#7", 0.5), ("Bmaj7", 0.5), ("Bb7", 0.5),
        ("Ebmaj7", 0.5), ("F#7", 0.5), ("Bmaj7", 0.5)
    ],
    "251": [("Dm7", 4.0), ("G7", 4.0), ("Cmaj7", 4.0), ("Cmaj7", 4.0)]
}

class BackingTrackGenerator:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")

        # Initialize Magenta models
        self.initialize_models()

    def initialize_models(self):
        """Initialize all required Magenta models"""
        try:
            bundle_dir = os.path.join(os.path.expanduser('~/magenta_project'), 'bundles')
            if not os.path.exists(bundle_dir):
                raise ValueError(f"Magenta bundles directory not found at {bundle_dir}")

            # Log the paths we're trying to load
            logging.info(f"Loading models from {bundle_dir}")

            # Melody RNN
            melody_path = os.path.join(bundle_dir, 'attention_rnn.mag')
            if not os.path.exists(melody_path):
                raise ValueError(f"Melody model not found at {melody_path}")
            melody_bundle = sequence_generator_bundle.read_bundle_file(melody_path)
            self.melody_generator = melody_rnn_sequence_generator.MelodyRnnSequenceGenerator(
                model=note_seq.protobuf.generator_pb2.GeneratorDetails(),
                details=melody_bundle.generator_details,
                steps_per_quarter=4,
                checkpoint=None,
                bundle=melody_bundle
            )

            # Drums RNN
            drums_path = os.path.join(bundle_dir, 'drum_kit_rnn.mag')
            if not os.path.exists(drums_path):
                raise ValueError(f"Drums model not found at {drums_path}")
            drums_bundle = sequence_generator_bundle.read_bundle_file(drums_path)
            self.drums_generator = drums_rnn_sequence_generator.DrumsRnnSequenceGenerator(
                model=note_seq.protobuf.generator_pb2.GeneratorDetails(),
                details=drums_bundle.generator_details,
                steps_per_quarter=4,
                checkpoint=None,
                bundle=drums_bundle
            )

            # Improv RNN
            improv_path = os.path.join(bundle_dir, 'improv_rnn.mag')
            if not os.path.exists(improv_path):
                raise ValueError(f"Improv model not found at {improv_path}")
            improv_bundle = sequence_generator_bundle.read_bundle_file(improv_path)
            self.improv_generator = improv_rnn_sequence_generator.ImprovRnnSequenceGenerator(
                model=note_seq.protobuf.generator_pb2.GeneratorDetails(),
                details=improv_bundle.generator_details,
                steps_per_quarter=4,
                checkpoint=None,
                bundle=improv_bundle
            )

        except Exception as e:
            logging.error(f"Error initializing models: {e}")
            raise

    def clean_song_title(self, prompt: str) -> str:
        """Clean the prompt to extract just the song title."""
        # Common words to remove
        remove_words = [
            'in', 'with', 'by', 'the', 'a', 'an',
            'style', 'feel', 'changes', 'progression',
            'swing', 'latin', 'bossa', 'jazz', 'blues',
            'straight', 'medium', 'up', 'tempo', 'fast', 'slow'
        ]

        # Remove key specifications (e.g., "in C#", "in Bb")
        prompt = re.sub(r'\s+in\s+[A-G][#b]?(?:\s+(?:major|minor))?', '', prompt, flags=re.IGNORECASE)

        # Split into words and filter
        words = prompt.split()
        cleaned_words = []

        for word in words:
            word = word.strip("'\".,!?")
            if word.lower() not in remove_words:
                cleaned_words.append(word)

        cleaned = ' '.join(cleaned_words)
        return cleaned.strip()

    def load_from_corpus(self, title: str) -> Optional[str]:
        """Load song from corpus if it exists."""
        title = self.clean_song_title(title)
        logging.info(f"Searching for title: {title}")

        if not title or len(title) < 2:  # Allow shorter titles but log them
            logging.info(f"Title too short or empty: {title}")
            return None

        # Use Path for better path handling
        corpus_base = Path('corpus/SongDB')
        corpus_dirs = [
            corpus_base / 'Songs[#,A-G]',
            corpus_base / 'Songs[H-O]',
            corpus_base / 'Songs[P-Z]'
        ]

        # Function to normalize text for comparison
        def normalize_text(text: str) -> str:
            # Remove all non-alphanumeric characters and convert to lowercase
            return ''.join(c.lower() for c in text if c.isalnum())

        normalized_search = normalize_text(title)
        logging.info(f"Normalized search term: {normalized_search}")

        for directory in corpus_dirs:
            try:
                if not directory.exists():
                    logging.info(f"Directory not found: {directory}")
                    continue

                for file_path in directory.glob('*.txt'):
                    file_title = file_path.stem
                    normalized_file = normalize_text(file_title)

                    # Log comparison for debugging
                    logging.debug(f"Comparing: {normalized_search} with {normalized_file}")

                    # Check for exact match first
                    if normalized_search == normalized_file:
                        content = file_path.read_text()
                        logging.info(f"Found exact match in corpus: {file_path.name}")
                        return content

                    # Check if search term is contained in file name
                    if normalized_search in normalized_file:
                        content = file_path.read_text()
                        logging.info(f"Found partial match in corpus: {file_path.name}")
                        return content

            except Exception as e:
                logging.error(f"Error reading directory {directory}: {str(e)}")
                continue

        logging.info(f"Song '{title}' not found in corpus, falling back to GPT")
        return None

    def _adjust_progression_length(self, progression: List[Tuple[str, float]], target_bars: int) -> List[Tuple[str, float]]:
        """Adjust progression to match target length in bars"""
        total_beats = sum(duration for _, duration in progression)
        scale_factor = (target_bars * 4) / total_beats
        return [(chord, duration * scale_factor) for chord, duration in progression]

    async def get_chord_progression(self, prompt: str) -> List[Tuple[str, float]]:
        """Get chord progression from prompt"""
        try:
            # Check for standard progressions first
            if "giant steps" in prompt.lower():
                # Return a shortened version of Giant Steps
                return [
                    ("Bmaj7", 1.0), ("D7", 1.0), ("Gmaj7", 1.0), ("Bb7", 1.0)
                ]

            # Fallback to 251 progression
            return STANDARD_PROGRESSIONS["251"]

        except Exception as e:
            logging.error(f"Error getting chord progression: {e}")
            return STANDARD_PROGRESSIONS["251"]

    def _transpose_progression(self, progression_text: str, new_key: str, new_mode: Optional[str] = None) -> str:
        """Transpose progression to new key."""
        lines = progression_text.strip().split('\n')
        result_lines = []

        for line in lines:
            if 'DBKeySig' in line:
                result_lines.append(f"DBKeySig = {new_key}{' minor' if new_mode and 'min' in new_mode.lower() else ''}")
            elif '|' in line:
                # Transpose chord progression
                chords = line.split('|')
                transposed_chords = []
                for chord in chords:
                    if chord.strip():
                        transposed_chords.append(self._transpose_chord(chord.strip(), new_key))
                result_lines.append('|'.join(transposed_chords))
            else:
                result_lines.append(line)

        return '\n'.join(result_lines)

    def _enhance_progression(self, progression_text: str) -> str:
        """Add sophisticated chord substitutions."""
        lines = progression_text.strip().split('\n')
        result_lines = []

        for line in lines:
            if '|' in line:
                # Add substitutions to chord progression
                chords = line.split('|')
                enhanced_chords = []
                for chord in chords:
                    if chord.strip():
                        enhanced_chords.append(self._enhance_chord(chord.strip()))
                result_lines.append('|'.join(enhanced_chords))
            else:
                result_lines.append(line)

        return '\n'.join(result_lines)

    def _transpose_chord(self, chord: str, new_key: str) -> str:
        """Transpose a single chord to new key."""
        # Define note mappings
        notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

        # Parse chord
        match = re.match(r'([A-G][#b]?)(.*)', chord)
        if not match:
            return chord

        root, quality = match.groups()

        # Determine source and target indices
        use_flats = 'b' in new_key
        note_list = flats if use_flats else notes

        # Find the interval to transpose
        source_idx = notes.index(root.replace('b', '#')) if '#' in root or 'b' in root else notes.index(root)
        target_idx = notes.index(new_key.replace('b', '#')) if '#' in new_key or 'b' in new_key else notes.index(new_key)

        # Calculate transposition
        interval = target_idx - source_idx
        new_idx = (source_idx + interval) % 12

        # Construct new chord
        return note_list[new_idx] + quality

    def _enhance_chord(self, chord: str) -> str:
        """Add sophisticated alterations to a chord."""
        # Parse chord
        match = re.match(r'([A-G][#b]?)([^/]*)(/[A-G][#b]?)?', chord)
        if not match:
            return chord

        root, quality, bass = match.groups()
        bass = bass or ''

        # Define enhancement rules
        enhancements = {
            'maj7': ['maj9', 'maj7#11', 'maj13'],
            '7': ['9', '13', '7#11', '7b13'],
            'm7': ['m9', 'm11', 'm13'],
            'm7b5': ['m9b5', 'm11b5'],
            'dim7': ['dim7b13'],
            '6': ['6/9', '13'],
            '': ['maj7', '6', '6/9']
        }

        # Apply enhancements based on context
        if '#11' in quality:
            # Already has #11, maybe add 13
            if '7' in quality:
                return root + quality.replace('#11', '#11,13') + bass
            return chord
        elif 'sub' in quality.lower():
            # Handle substitution request
            if '7' in quality:
                # Add alterations for dominant chords
                return root + '7b9#11' + bass
            return chord
        else:
            # Find base quality and enhance
            base_quality = ''
            for q in enhancements.keys():
                if q in quality:
                    base_quality = q
                    break

            if base_quality in enhancements:
                # Choose an enhancement
                new_quality = random.choice(enhancements[base_quality])
                return root + new_quality + bass

        return chord

    def create_midi_sequence(self, progression_text: str) -> pretty_midi.PrettyMIDI:
        """Create MIDI sequence from chord progression text."""
        pm = pretty_midi.PrettyMIDI()

        # Parse progression text
        lines = progression_text.strip().split('\n')
        progression_data = {}
        chord_line = ""

        for line in lines:
            if '=' in line:
                key, value = line.split('=', 1)
                progression_data[key.strip()] = value.strip()
            elif '|' in line:
                chord_line = line.strip()

        # Extract musical structure information
        form = progression_data.get('Form', '4-bar')
        key_sig = progression_data.get('DBKeySig', 'C')
        time_sig = progression_data.get('TimeSig', '4 4')
        num_bars = int(progression_data.get('Bars', '4'))
        tempo = int(progression_data.get('Tempo', '120'))  # Get tempo from progression data

        # Parse time signature
        beats_per_bar = int(time_sig.split()[0])
        beat_value = int(time_sig.split()[1])
        seconds_per_beat = 60.0 / tempo  # Use the tempo from progression data

        # Set the tempo in the MIDI sequence
        pm.initial_tempo = tempo

        # Create chord program with piano sound
        chord_program = pretty_midi.Instrument(program=0)  # 0 = Acoustic Grand Piano

        # Process chords
        chords = [c.strip() for c in chord_line.split('|') if c.strip()]
        current_time = 0.0

        # Handle different form types
        if form == '12-bar':
            # 12-bar blues form
            bars_per_chord = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        elif form == 'AABA':
            # 32-bar AABA form
            bars_per_chord = [2] * 16  # 16 chords, 2 bars each
        else:
            # Default to equal distribution
            bars_per_chord = [num_bars / len(chords)] * len(chords)

        # Add chords with proper timing
        for chord, num_bars in zip(chords, bars_per_chord):
            # Calculate duration for this chord
            duration = num_bars * beats_per_bar * seconds_per_beat

            # Convert chord text to MIDI notes with proper voicing
            notes = self._chord_to_notes(chord, key_sig)

            # Add notes to program with proper timing
            for note_num in notes:
                note = pretty_midi.Note(
                    velocity=100,
                    pitch=note_num,
                    start=current_time,
                    end=current_time + duration * 0.95  # Slight gap between chords
                )
                chord_program.notes.append(note)

            current_time += duration

        pm.instruments.append(chord_program)
        return pm

    def _chord_to_notes(self, chord_text: str, key: str) -> List[int]:
        """Convert chord text to MIDI note numbers with proper jazz voicings."""
        # Enhanced chord to MIDI conversion with jazz voicings
        base_notes = {
            'C': 60, 'C#': 61, 'Db': 61, 'D': 62, 'D#': 63, 'Eb': 63,
            'E': 64, 'F': 65, 'F#': 66, 'Gb': 66, 'G': 67, 'G#': 68,
            'Ab': 68, 'A': 69, 'A#': 70, 'Bb': 70, 'B': 71
        }

        # Parse chord text
        chord_parts = re.match(r'([A-G][#b]?)(.*)', chord_text)
        if not chord_parts:
            return []

        root, quality = chord_parts.groups()
        base = base_notes.get(root, 60)

        # Define jazz voicings for different chord qualities
        voicings = {
            'm7': [0, 3, 7, 10],     # minor 7th
            'maj7': [0, 4, 7, 11],   # major 7th
            '7': [0, 4, 7, 10],      # dominant 7th
            'm7b5': [0, 3, 6, 10],   # half-diminished
            'dim7': [0, 3, 6, 9],    # diminished 7th
            '6': [0, 4, 7, 9],       # major 6th
            'm6': [0, 3, 7, 9],      # minor 6th
            '9': [0, 4, 7, 10, 14],  # dominant 9th
            'maj9': [0, 4, 7, 11, 14], # major 9th
            'm9': [0, 3, 7, 10, 14]  # minor 9th
        }

        # Determine chord quality and get intervals
        if 'm7b5' in quality:
            intervals = voicings['m7b5']
        elif 'maj7' in quality:
            intervals = voicings['maj7']
        elif 'm7' in quality:
            intervals = voicings['m7']
        elif '7' in quality:
            intervals = voicings['7']
        elif 'dim7' in quality:
            intervals = voicings['dim7']
        elif 'm' in quality:
            intervals = [0, 3, 7]  # minor triad
        else:
            intervals = [0, 4, 7]  # major triad default

        # Create notes with proper voicing
        notes = [base + interval for interval in intervals]

        # Add proper octave spacing for jazz voicing
        notes = self._apply_jazz_voicing(notes)

        return notes

    def _apply_jazz_voicing(self, notes: List[int]) -> List[int]:
        """Apply proper jazz voicing spacing to the notes."""
        if not notes:
            return notes

        # Sort notes
        notes.sort()
        base = notes[0]

        # Apply typical jazz voicing spacing
        voiced_notes = [base]  # Keep root in bass

        # Space out the rest of the chord
        for i in range(1, len(notes)):
            # Move notes up octaves to create proper spacing
            while notes[i] - voiced_notes[-1] < 3:  # Minimum 3 semitones spacing
                notes[i] += 12
            voiced_notes.append(notes[i])

        return voiced_notes

    async def generate_backing_track(self, prompt: str) -> Dict[str, Any]:
        """Generate complete backing track."""
        try:
            # Get chord progression
            progression_text = await self.get_chord_progression(prompt)

            # Parse musical structure
            lines = progression_text.strip().split('\n')
            progression_data = {}
            for line in lines:
                if '=' in line:
                    key, value = line.split('=', 1)
                    progression_data[key.strip()] = value.strip()

            # Extract key musical elements
            form = progression_data.get('Form', '4-bar')
            key_sig = progression_data.get('DBKeySig', 'C')
            time_sig = progression_data.get('TimeSig', '4 4')
            num_bars = int(progression_data.get('Bars', '4'))

            # Create basic MIDI sequence with proper structure
            sequence = self.create_midi_sequence(progression_text)

            # Add walking bass line based on form
            sequence = self._add_bass(sequence, form=form, key=key_sig)

            # Add drums with appropriate style
            sequence = self._add_drums(sequence, form=form)

            # Add piano comping based on form and style
            sequence = self._add_comping(sequence, form=form)

            return {
                "progression": progression_text,
                "structure": {
                    "form": form,
                    "key": key_sig,
                    "time_signature": time_sig,
                    "bars": num_bars
                },
                "midi_sequence": sequence,
                "audio": self._midi_to_audio(sequence)
            }

        except Exception as e:
            logging.error(f"Error generating backing track: {e}")
            raise

    def _add_comping(self, sequence: pretty_midi.PrettyMIDI, form: str = '4-bar') -> pretty_midi.PrettyMIDI:
        """Add piano comping with proper voicings and rhythm."""
        # Create piano program for comping
        piano = pretty_midi.Instrument(program=0)  # Acoustic Grand Piano

        # Get tempo (using get_tempo_changes correctly)
        tempo = 120  # Default tempo
        tempo_changes = sequence.get_tempo_changes()
        if len(tempo_changes) == 2 and len(tempo_changes[1]) > 0:
            tempo = tempo_changes[1][0]
        seconds_per_beat = 60.0 / tempo

        # Get existing chord notes
        chord_times = {}
        for note in sequence.instruments[0].notes:
            start_time = note.start
            if start_time not in chord_times:
                chord_times[start_time] = []
            chord_times[start_time].append(note)

        # Add comping for each chord
        for start_time, chord_notes in sorted(chord_times.items()):
            # Get next chord time for duration
            next_times = [t for t in chord_times.keys() if t > start_time]
            end_time = min(next_times) if next_times else (start_time + 4 * seconds_per_beat)
            duration = end_time - start_time

            # Create comping rhythm based on form
            if form == '12-bar':
                # Blues comping pattern
                offsets = [0, 2, 2.5, 3.5] if duration >= 4 * seconds_per_beat else [0, 1]
            elif form == 'AABA':
                # Standard jazz comping pattern
                offsets = [0, 1.5, 2, 3.5] if duration >= 4 * seconds_per_beat else [0, 1.5]
            else:
                # Basic comping pattern
                offsets = [0, 2] if duration >= 4 * seconds_per_beat else [0]

            # Add comping notes
            for offset in offsets:
                comp_time = start_time + offset * seconds_per_beat
                # Use existing chord notes but in higher octave
                for note in chord_notes:
                    comp_note = pretty_midi.Note(
                        velocity=80,  # Slightly softer than melody
                        pitch=note.pitch + 12,  # One octave up
                        start=comp_time,
                        end=comp_time + 0.5 * seconds_per_beat  # Shorter duration for rhythmic effect
                    )
                    piano.notes.append(comp_note)

        sequence.instruments.append(piano)
        return sequence

    def _add_bass(self, sequence: pretty_midi.PrettyMIDI, form: str = '4-bar', key: str = 'C') -> pretty_midi.PrettyMIDI:
        """Add walking bass line based on form and style."""
        # Create bass program
        bass = pretty_midi.Instrument(program=32)  # Acoustic Bass

        # Get tempo (using get_tempo_changes correctly)
        tempo = 120  # Default tempo
        tempo_changes = sequence.get_tempo_changes()
        if len(tempo_changes) == 2 and len(tempo_changes[1]) > 0:
            tempo = tempo_changes[1][0]
        seconds_per_beat = 60.0 / tempo

        # Get chord roots from existing sequence
        chord_times = {}
        for note in sequence.instruments[0].notes:
            start_time = note.start
            if start_time not in chord_times:
                chord_times[start_time] = []
            chord_times[start_time].append(note)

        # Create walking bass line
        for start_time, chord_notes in sorted(chord_times.items()):
            # Get root note (lowest note of the chord)
            root = min(note.pitch for note in chord_notes)

            # Get next chord time for duration
            next_times = [t for t in chord_times.keys() if t > start_time]
            end_time = min(next_times) if next_times else (start_time + 4 * seconds_per_beat)
            duration = end_time - start_time

            # Create bass line based on form
            if form == '12-bar':
                # Blues walking bass
                pattern = [0, 7, 3, 7]  # Root, fifth, third, fifth
            elif form == 'AABA':
                # Jazz walking bass
                pattern = [0, 4, 7, 10]  # Root, fourth, fifth, seventh
            else:
                # Simple bass line
                pattern = [0, 7]  # Root and fifth

            # Add bass notes
            for i, interval in enumerate(pattern):
                if start_time + i * seconds_per_beat < end_time:
                    note = pretty_midi.Note(
                        velocity=100,
                        pitch=root - 24 + interval,  # Two octaves down plus interval
                        start=start_time + i * seconds_per_beat,
                        end=start_time + (i + 0.95) * seconds_per_beat  # Slight gap between notes
                    )
                    bass.notes.append(note)

        sequence.instruments.append(bass)
        return sequence

    def _add_drums(self, sequence: pretty_midi.PrettyMIDI, form: str = '4-bar') -> pretty_midi.PrettyMIDI:
        """Add drum accompaniment to sequence"""
        drums = pretty_midi.Instrument(program=0, is_drum=True, name='Drums')

        # Get timing info (using get_tempo_changes correctly)
        tempo = 120  # Default tempo
        tempo_changes = sequence.get_tempo_changes()
        if len(tempo_changes) == 2 and len(tempo_changes[1]) > 0:
            tempo = tempo_changes[1][0]
        seconds_per_beat = 60.0 / tempo
        beats_per_measure = 4.0  # Assuming 4/4 time
        measure_duration = seconds_per_beat * beats_per_measure

        # Get total duration
        if sequence.instruments and sequence.instruments[0].notes:
            end_time = max(note.end for note in sequence.instruments[0].notes)
        else:
            return sequence

        # Define swing pattern
        pattern = [
            # Hi-hat pattern
            (42, [0, 1, 2, 3], 80),  # Closed hi-hat on all beats
            # Ride cymbal
            (51, [0, 1, 2, 3], 90),
            # Hi-hat foot
            (44, [1, 3], 80)
        ]

        # Add drum pattern
        current_time = 0
        while current_time < end_time:
            for pitch, beats, velocity in pattern:
                for beat in beats:
                    note = pretty_midi.Note(
                        velocity=velocity,
                        pitch=pitch,
                        start=current_time + beat * seconds_per_beat,
                        end=current_time + beat * seconds_per_beat + (seconds_per_beat * 0.95)  # Slightly shorter for articulation
                    )
                    drums.notes.append(note)
            current_time += measure_duration

        sequence.instruments.append(drums)
        return sequence

    def _midi_to_audio(self, sequence: pretty_midi.PrettyMIDI) -> np.ndarray:
        """Convert MIDI sequence to audio."""
        return sequence.synthesize()

    def get_chord_notes_at_time(self, sequence: pretty_midi.PrettyMIDI, time: float) -> List[int]:
        """Get all active note numbers at a given time"""
        notes = []
        if sequence.instruments:
            for note in sequence.instruments[0].notes:
                if note.start <= time < note.end:
                    notes.append(note.pitch)
        return notes

    def add_comping_rhythm(self, sequence: pretty_midi.PrettyMIDI, style: str) -> pretty_midi.PrettyMIDI:
        """Add appropriate comping rhythm to the sequence"""
        try:
            # Create a new piano track for comping
            comping_piano = pretty_midi.Instrument(
                program=pretty_midi.instrument_name_to_program('Acoustic Grand Piano')
            )

            # Get timing info (using get_tempo_changes correctly)
            tempo = 120  # Default tempo
            tempo_changes = sequence.get_tempo_changes()
            if len(tempo_changes) == 2 and len(tempo_changes[1]) > 0:
                tempo = tempo_changes[1][0]
            seconds_per_beat = 60.0 / tempo
            measure_duration = seconds_per_beat * 4  # Assuming 4/4 time

            if sequence.instruments and sequence.instruments[0].notes:
                end_time = max(note.end for note in sequence.instruments[0].notes)
                num_measures = max(2, int(end_time / measure_duration) + 1)  # Ensure at least 2 measures
            else:
                return sequence

            # Add comping pattern based on style
            if style == "swing":
                # Swing comping pattern (2 and 4)
                for measure in range(num_measures):
                    measure_start = measure * measure_duration
                    # Add chords on beats 2 and 4
                    for beat in [1, 3]:  # 0-based, so 1 and 3 are beats 2 and 4
                        beat_time = measure_start + (beat * seconds_per_beat)
                        # Get the chord at this time
                        chord_notes = self.get_chord_notes_at_time(sequence, beat_time)
                        if chord_notes:
                            # Add each note in the chord
                            for note_num in chord_notes:
                                note = pretty_midi.Note(
                                    velocity=70,  # Slightly softer than melody
                                    pitch=note_num,
                                    start=beat_time,
                                    end=beat_time + (seconds_per_beat * 0.8)  # Slightly shorter for articulation
                                )
                                comping_piano.notes.append(note)

            sequence.instruments.append(comping_piano)
            return sequence

        except Exception as e:
            print(f"Error in add_comping_rhythm: {str(e)}")
            return sequence

    def add_walking_bass(self, sequence: pretty_midi.PrettyMIDI) -> pretty_midi.PrettyMIDI:
        """Add walking bass line to sequence"""
        bass = pretty_midi.Instrument(program=pretty_midi.instrument_name_to_program('Acoustic Bass'))

        # Get timing info
        tempo = sequence.initial_tempo  # Use initial tempo instead of estimating
        seconds_per_beat = 60.0 / tempo
        measure_duration = seconds_per_beat * 4  # Assuming 4/4 time

        # Get total duration
        if not sequence.instruments or not sequence.instruments[0].notes:
            return sequence

        end_time = max(note.end for note in sequence.instruments[0].notes)
        num_measures = int(end_time / measure_duration) + 1

        # For each measure
        prev_root = None
        for measure in range(num_measures):
            measure_start = measure * measure_duration

            # Get chord at the start of this measure
            chord_notes = get_chord_notes_at_time(sequence, measure_start)
            if not chord_notes:
                continue

            # Get the root note and chord quality
            root_num = min(chord_notes)
            chord_type = "maj"  # Default to major
            if len(chord_notes) >= 3:
                third = root_num + 4 if (root_num + 4) in chord_notes else root_num + 3
                if third == root_num + 3:
                    chord_type = "min"

            # Get next measure's chord for targeting
            next_measure_start = measure_start + measure_duration
            next_chord_notes = get_chord_notes_at_time(sequence, next_measure_start)
            next_root = min(next_chord_notes) if next_chord_notes else root_num

            # Create walking pattern (4 beats per measure)
            for beat in range(4):
                beat_start = measure_start + (beat * seconds_per_beat)

                # Choose note based on beat position
                if beat == 0:
                    # Beat 1: Root
                    note_num = root_num - 24  # Two octaves down
                elif beat == 1:
                    # Beat 2: Scale tone or chromatic approach
                    if random.random() < 0.7:  # 70% chance of scale tone
                        note_num = root_num - 24 + (2 if chord_type == "maj" else 3)
                    else:
                        note_num = root_num - 24 + 1
                elif beat == 2:
                    # Beat 3: Fifth or third
                    if random.random() < 0.6:  # 60% chance of fifth
                        note_num = root_num - 24 + 7
                    else:
                        note_num = root_num - 24 + (4 if chord_type == "maj" else 3)
                else:
                    # Beat 4: Chromatic approach to next root
                    next_root_bass = next_root - 24
                    if next_root_bass > root_num - 24:
                        note_num = next_root_bass - 1  # Approach from below
                    else:
                        note_num = next_root_bass + 1  # Approach from above

                # Create bass note with precise timing
                note = pretty_midi.Note(
                    velocity=90 if beat == 0 else 80,  # Emphasize beat 1
                    pitch=note_num,
                    start=beat_start,
                    end=beat_start + (seconds_per_beat * 0.95)  # Slightly shorter for articulation
                )
                bass.notes.append(note)

            prev_root = root_num

        sequence.instruments.append(bass)
        return sequence

async def main():
    generator = BackingTrackGenerator()
    print("Backing Track Generator initialized. Type 'exit' to quit.")

    while True:
        try:
            prompt = input("\nDescribe the backing track you want: ").strip()
            if prompt.lower() == 'exit':
                break

            result = await generator.generate_backing_track(prompt)
            print(f"\nGenerated progression:\n{result['progression']}")

            # Save MIDI file
            result['midi_sequence'].write('output.mid')
            print("\nSaved as output.mid")

            # Save audio file
            sf.write('output.wav', result['audio'], 44100)
            print("Saved as output.wav")

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
