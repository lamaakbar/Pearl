"""Fatigue scoring engine that combines operational and personal inputs."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Mapping, Sequence, Tuple

from .baseline import BaselineProfile
from .factors import FACTOR_DEFINITIONS


@dataclass
class PersonalProfile:
    """Details that calibrate fatigue sensitivity for a controller."""

    experience_years: float
    health_risk: float = 0.0
    medication_flag: bool = False
    age: int | None = None
    self_report_fatigue: float = 0.0  # 0-5 scale

    def fatigue_modifier(self) -> Tuple[float, Dict[str, float]]:
        """Return a multiplier reflecting the contextual fatigue modifiers.

        The modifier is computed as a weighted blend of the Tier 3 factors.  It
        is intentionally simple so that it can run on edge devices without
        external dependencies while still reflecting the qualitative guidance
        from the PEARL specification.
        """

        adjustments: Dict[str, float] = {}
        modifier = 1.0

        if self.experience_years < 5:
            delta = 0.05
            modifier += delta
            adjustments["experience_modifier"] = delta
        else:
            delta = -0.03
            modifier += delta
            adjustments["experience_modifier"] = delta

        health_component = max(0.0, min(self.health_risk, 1.0)) * 0.08
        if self.medication_flag:
            health_component += 0.04
        modifier += health_component
        adjustments["health_modifier"] = health_component

        if self.age is not None:
            age_component = 0.0
            if self.age >= 55:
                age_component = 0.05
            elif self.age <= 30:
                age_component = -0.02
            modifier += age_component
            adjustments["age_modifier"] = age_component

        self_report_component = max(0.0, min(self.self_report_fatigue, 5.0)) / 5.0 * 0.08
        modifier += self_report_component
        adjustments["shift_delta_modifier"] = self_report_component

        modifier = max(0.8, min(modifier, 1.35))
        return modifier, adjustments


@dataclass
class FactorContribution:
    """Contribution of a single factor to the final fatigue score."""

    key: str
    name: str
    weight: float
    z_score: float
    risk: float
    contribution: float


@dataclass
class FatigueResult:
    score: float
    level: str
    top_factors: Sequence[FactorContribution]
    contributions: Sequence[FactorContribution]
    modifier_breakdown: Dict[str, float]
    recommendation: str
    profile_modifier: float


class FatigueModel:
    """Combine baseline, live metrics and personal data into a fatigue score."""

    def __init__(self, *, z_threshold: float = 2.5):
        self.z_threshold = z_threshold
        self._factors = FACTOR_DEFINITIONS

    def compute_score(
        self,
        baseline: BaselineProfile,
        current_metrics: Mapping[str, float],
        profile: PersonalProfile,
        *,
        shift_delta: float | None = None,
    ) -> FatigueResult:
        """Calculate the fatigue score for the current monitoring window."""

        contributions: List[FactorContribution] = []
        raw_score = 0.0

        for factor in self._factors:
            metric = baseline.metric(factor.key)
            value = current_metrics.get(factor.key)
            z_score = 0.0
            risk = 0.0
            if metric is not None and value is not None:
                z_score = metric.z_score(value, factor.is_increase_risky())
                risk = self._normalise_z(z_score)
            elif value is not None:
                # Without baseline fall back to a neutral risk scaled between 0 and 1.
                risk = max(0.0, min(value, 1.0))
            elif factor.key == "shift_delta_modifier" and shift_delta is not None:
                risk = max(0.0, min(shift_delta, 1.0))
            contribution = factor.weight * risk
            raw_score += contribution
            contributions.append(
                FactorContribution(
                    key=factor.key,
                    name=factor.name,
                    weight=factor.weight,
                    z_score=z_score,
                    risk=risk,
                    contribution=contribution,
                )
            )

        modifier, modifier_breakdown = profile.fatigue_modifier()

        if shift_delta is not None:
            modifier += min(max(shift_delta - 0.5, -0.1), 0.1)
            modifier_breakdown["shift_delta_modifier"] = modifier_breakdown.get(
                "shift_delta_modifier", 0.0
            ) + min(max(shift_delta - 0.5, -0.1), 0.1)

        final_score = max(0.0, min(raw_score * modifier, 1.0))
        contributions.sort(key=lambda item: item.contribution, reverse=True)
        top_factors = contributions[:3]
        level = self._level_from_score(final_score)
        recommendation = self._recommendation_from_score(final_score)

        return FatigueResult(
            score=final_score,
            level=level,
            top_factors=top_factors,
            contributions=contributions,
            modifier_breakdown=modifier_breakdown,
            recommendation=recommendation,
            profile_modifier=modifier,
        )

    def _normalise_z(self, z_score: float) -> float:
        """Convert a z-score into a bounded risk value between 0 and 1."""

        if z_score <= 0:
            return 0.0
        return min(1.0, z_score / self.z_threshold)

    @staticmethod
    def _level_from_score(score: float) -> str:
        if score >= 0.7:
            return "Red"
        if score >= 0.4:
            return "Yellow"
        return "Green"

    @staticmethod
    def _recommendation_from_score(score: float) -> str:
        if score >= 0.7:
            return "High fatigue risk — suggest 5-minute micro-break and supervisor follow-up."
        if score >= 0.4:
            return "Moderate fatigue — monitor closely and prepare recovery options."
        return "Within baseline — continue routine monitoring."


__all__ = [
    "PersonalProfile",
    "FactorContribution",
    "FatigueResult",
    "FatigueModel",
]
