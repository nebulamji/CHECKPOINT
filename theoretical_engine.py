import json
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

class HarmonicSystem(Enum):
    TONAL = "tonal"
    MODAL = "modal"
    ATONAL = "atonal"
    MICROTONAL = "microtonal"
    SPECTRAL = "spectral"

class RhythmicSystem(Enum):
    METRIC = "metric"
    POLYMETRIC = "polymetric"
    FREE = "free"
    LAYERED = "layered"
    TEMPORAL = "temporal"

@dataclass
class TheoreticalConcept:
    name: str
    system: str
    description: str
    relationships: List[str]
    examples: List[str]
    complexity: float
    historical_context: str

class TheoreticalEngine:
    def __init__(self):
        """Initialize the theoretical engine for processing music theory concepts"""
        self.concepts: Dict[str, TheoreticalConcept] = {}
        self.harmonic_systems: Dict[str, List[TheoreticalConcept]] = {}
        self.rhythmic_systems: Dict[str, List[TheoreticalConcept]] = {}
        self.theoretical_relationships: Dict[str, List[Tuple[str, float]]] = {}

        # Load initial theoretical data
        self._load_theoretical_data()

    def _load_theoretical_data(self):
        """Load theoretical data from storage"""
        try:
            theoretical_path = Path('theoretical_data.json')
            if theoretical_path.exists():
                with open(theoretical_path) as f:
                    data = json.load(f)

                    # Load concepts
                    for concept_data in data.get('concepts', []):
                        concept = TheoreticalConcept(**concept_data)
                        self.concepts[concept.name] = concept

                    # Load relationships
                    self.theoretical_relationships = data.get('relationships', {})

                    # Organize by system
                    self._organize_concepts()
            else:
                self._initialize_theoretical_data()

        except Exception as e:
            logging.error(f"Error loading theoretical data: {e}")
            self._initialize_theoretical_data()

    def _initialize_theoretical_data(self):
        """Initialize basic theoretical data structure"""
        # Initialize basic concepts for each harmonic system
        for system in HarmonicSystem:
            self.harmonic_systems[system.value] = []

        # Initialize basic concepts for each rhythmic system
        for system in RhythmicSystem:
            self.rhythmic_systems[system.value] = []

        # Save initial state
        self._save_theoretical_data()

    def _organize_concepts(self):
        """Organize concepts into their respective systems"""
        # Clear existing organizations
        self.harmonic_systems = {system.value: [] for system in HarmonicSystem}
        self.rhythmic_systems = {system.value: [] for system in RhythmicSystem}

        # Organize concepts
        for concept in self.concepts.values():
            if concept.system in [s.value for s in HarmonicSystem]:
                self.harmonic_systems[concept.system].append(concept)
            elif concept.system in [s.value for s in RhythmicSystem]:
                self.rhythmic_systems[concept.system].append(concept)

    def _save_theoretical_data(self):
        """Save theoretical data to storage"""
        try:
            data = {
                'concepts': [
                    {
                        'name': c.name,
                        'system': c.system,
                        'description': c.description,
                        'relationships': c.relationships,
                        'examples': c.examples,
                        'complexity': c.complexity,
                        'historical_context': c.historical_context
                    }
                    for c in self.concepts.values()
                ],
                'relationships': self.theoretical_relationships
            }

            with open('theoretical_data.json', 'w') as f:
                json.dump(data, f, indent=2)

        except Exception as e:
            logging.error(f"Error saving theoretical data: {e}")

    def add_concept(self, concept: TheoreticalConcept):
        """Add a new theoretical concept"""
        self.concepts[concept.name] = concept
        self._organize_concepts()
        self._save_theoretical_data()

    def get_related_concepts(self, concept_name: str, min_relationship: float = 0.5) -> List[str]:
        """Get related concepts above the minimum relationship threshold"""
        if concept_name not in self.theoretical_relationships:
            return []

        return [
            name for name, strength in self.theoretical_relationships[concept_name]
            if strength >= min_relationship
        ]

    def analyze_concept_complexity(self, concept_name: str) -> Dict:
        """Analyze the complexity of a concept and its relationships"""
        if concept_name not in self.concepts:
            return {}

        concept = self.concepts[concept_name]
        related = self.get_related_concepts(concept_name)

        return {
            'name': concept.name,
            'complexity': concept.complexity,
            'num_relationships': len(related),
            'related_concepts': related,
            'system': concept.system
        }

    def get_system_concepts(self, system_name: str) -> List[TheoreticalConcept]:
        """Get all concepts for a particular system"""
        if system_name in [s.value for s in HarmonicSystem]:
            return self.harmonic_systems.get(system_name, [])
        elif system_name in [s.value for s in RhythmicSystem]:
            return self.rhythmic_systems.get(system_name, [])
        return []

    def analyze_theoretical_depth(self, concept_names: List[str]) -> Dict:
        """Analyze theoretical depth of a set of concepts"""
        if not concept_names:
            return {}

        # Get complexity metrics
        complexities = [
            self.concepts[name].complexity
            for name in concept_names
            if name in self.concepts
        ]

        # Get relationship metrics
        relationship_counts = [
            len(self.get_related_concepts(name))
            for name in concept_names
            if name in self.theoretical_relationships
        ]

        return {
            'average_complexity': sum(complexities) / len(complexities) if complexities else 0,
            'max_complexity': max(complexities) if complexities else 0,
            'total_relationships': sum(relationship_counts),
            'concepts_analyzed': len(concept_names),
            'depth_score': (
                (sum(complexities) / len(complexities) if complexities else 0) *
                (sum(relationship_counts) / len(concept_names) if concept_names else 0)
            )
        }

    def generate_theoretical_insight(self, concept_names: List[str]) -> Optional[Dict]:
        """Generate theoretical insight from a set of concepts"""
        if not concept_names or not all(name in self.concepts for name in concept_names):
            return None

        # Get concepts
        concepts = [self.concepts[name] for name in concept_names]

        # Analyze relationships
        relationships = set()
        for name in concept_names:
            if name in self.theoretical_relationships:
                relationships.update(
                    rel_name for rel_name, _ in self.theoretical_relationships[name]
                )

        # Generate insight
        return {
            'concepts': concept_names,
            'systems_involved': list(set(c.system for c in concepts)),
            'average_complexity': sum(c.complexity for c in concepts) / len(concepts),
            'related_concepts': list(relationships),
            'theoretical_depth': self.analyze_theoretical_depth(concept_names)['depth_score'],
            'insight_type': 'cross_system' if len(set(c.system for c in concepts)) > 1 else 'system_specific'
        }

    def evolve_theoretical_understanding(self, concept_names: List[str]) -> Dict:
        """Evolve theoretical understanding based on concept analysis"""
        if not concept_names:
            return {}

        # Get initial analysis
        initial_depth = self.analyze_theoretical_depth(concept_names)

        # Find potential new relationships
        new_relationships = set()
        for name in concept_names:
            if name in self.theoretical_relationships:
                current_relations = set(
                    rel_name for rel_name, _ in self.theoretical_relationships[name]
                )
                for other_name in concept_names:
                    if other_name != name and other_name not in current_relations:
                        new_relationships.add((name, other_name))

        # Update relationships with new connections
        for concept1, concept2 in new_relationships:
            if concept1 not in self.theoretical_relationships:
                self.theoretical_relationships[concept1] = []
            self.theoretical_relationships[concept1].append(
                (concept2, 0.5)  # Start with moderate relationship strength
            )

        # Get evolved analysis
        evolved_depth = self.analyze_theoretical_depth(concept_names)

        return {
            'initial_depth': initial_depth['depth_score'],
            'evolved_depth': evolved_depth['depth_score'],
            'new_relationships': len(new_relationships),
            'evolution_factor': evolved_depth['depth_score'] / initial_depth['depth_score']
            if initial_depth['depth_score'] > 0 else 1.0
        }
