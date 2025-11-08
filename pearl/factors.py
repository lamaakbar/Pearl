"""Definitions of fatigue indicators and their recommended weights.

The weights and descriptions mirror the prioritisation documented in the
updated PEARL specification.  They are expressed in a structured format
so that the scoring engine can iterate over the factors without hard
coding them in multiple places.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class FactorDefinition:
    """Metadata describing how a single fatigue factor should be handled."""

    name: str
    key: str
    category: str
    tier: int
    priority: str
    weight: float
    direction: str
    justification: str

    def is_increase_risky(self) -> bool:
        """Return ``True`` when a higher measurement indicates higher fatigue."""

        return self.direction.lower() == "increase"


FACTOR_DEFINITIONS: List[FactorDefinition] = [
    FactorDefinition(
        name="Response Delay",
        key="response_delay",
        category="Operational",
        tier=1,
        priority="Critical",
        weight=0.12,
        direction="increase",
        justification=(
            "Validated predictor of vigilance loss. Increased delay directly "
            "maps to cognitive slowdown."
        ),
    ),
    FactorDefinition(
        name="Resolution Latency",
        key="resolution_latency",
        category="Operational",
        tier=1,
        priority="Critical",
        weight=0.10,
        direction="increase",
        justification=(
            "Measures time needed to close operational events; prolonged "
            "values highlight workload saturation and executive fatigue."
        ),
    ),
    FactorDefinition(
        name="Blink Rate",
        key="blink_rate",
        category="Facial",
        tier=1,
        priority="Critical",
        weight=0.10,
        direction="increase",
        justification=(
            "Physiological indicator showing reduced alertness when the rate rises."
        ),
    ),
    FactorDefinition(
        name="Yawn Frequency",
        key="yawn_frequency",
        category="Facial",
        tier=1,
        priority="Critical",
        weight=0.10,
        direction="increase",
        justification="Short-term marker of sleep pressure and oxygen-deprivation fatigue.",
    ),
    FactorDefinition(
        name="Pause Ratio",
        key="pause_ratio",
        category="Voice",
        tier=1,
        priority="Critical",
        weight=0.10,
        direction="increase",
        justification="Higher silence ratio correlates with reduced processing speed.",
    ),
    FactorDefinition(
        name="Tone Stability",
        key="tone_stability",
        category="Voice",
        tier=2,
        priority="High",
        weight=0.08,
        direction="decrease",
        justification="Flattened or erratic tone signals stress-induced fatigue.",
    ),
    FactorDefinition(
        name="Reaction Time Mini-Test",
        key="reaction_time_game",
        category="Behavioral",
        tier=2,
        priority="High",
        weight=0.08,
        direction="increase",
        justification="Reaction-time tasks are gold-standard fatigue probes.",
    ),
    FactorDefinition(
        name="Hesitation Frequency",
        key="hesitation_frequency",
        category="Voice",
        tier=2,
        priority="High",
        weight=0.06,
        direction="increase",
        justification="Verbal hesitation rises with cognitive load and fatigue.",
    ),
    FactorDefinition(
        name="Posture Stability",
        key="posture_stability",
        category="Facial/Body",
        tier=2,
        priority="Medium",
        weight=0.06,
        direction="decrease",
        justification="Physical drift or slouching indicates reduced alertness.",
    ),
    FactorDefinition(
        name="Workload Index",
        key="workload_index",
        category="Operational",
        tier=2,
        priority="Medium",
        weight=0.06,
        direction="increase",
        justification="Accumulated unresolved load elevates fatigue risk indirectly.",
    ),
    FactorDefinition(
        name="Heart Stress Proxy",
        key="heart_stress_proxy",
        category="Physiological",
        tier=2,
        priority="Medium",
        weight=0.06,
        direction="increase",
        justification="Voice-based stress correlates with autonomic fatigue markers.",
    ),
    FactorDefinition(
        name="Experience Level",
        key="experience_modifier",
        category="Personal",
        tier=3,
        priority="Modifier",
        weight=0.04,
        direction="decrease",
        justification="Higher experience mitigates fatigue sensitivity.",
    ),
    FactorDefinition(
        name="Health / Medication",
        key="health_modifier",
        category="Personal",
        tier=3,
        priority="Modifier",
        weight=0.04,
        direction="increase",
        justification="Personal health issues increase fatigue susceptibility.",
    ),
    FactorDefinition(
        name="Age",
        key="age_modifier",
        category="Demographic",
        tier=3,
        priority="Modifier",
        weight=0.03,
        direction="increase",
        justification="Recovery rate decreases with age; used for calibration.",
    ),
    FactorDefinition(
        name="Pre/Post Shift Delta",
        key="shift_delta_modifier",
        category="Shift Context",
        tier=3,
        priority="Supportive",
        weight=0.03,
        direction="increase",
        justification="Captures the change between pre- and post-shift observations.",
    ),
]


def factor_by_key(key: str) -> FactorDefinition:
    """Return the factor definition matching ``key``.

    Parameters
    ----------
    key:
        Lowercase identifier used in the scoring pipeline.
    """

    for factor in FACTOR_DEFINITIONS:
        if factor.key == key:
            return factor
    raise KeyError(f"Unknown factor key: {key}")


def tier_weights() -> Dict[int, float]:
    """Summarise the total weighting per tier to help with diagnostics."""

    totals: Dict[int, float] = {}
    for factor in FACTOR_DEFINITIONS:
        totals.setdefault(factor.tier, 0.0)
        totals[factor.tier] += factor.weight
    return totals


__all__ = ["FactorDefinition", "FACTOR_DEFINITIONS", "factor_by_key", "tier_weights"]
