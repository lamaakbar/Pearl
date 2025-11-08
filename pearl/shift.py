"""Structures capturing the pre- and post-shift evaluations."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Mapping

from .factors import FACTOR_DEFINITIONS


@dataclass
class ShiftPhaseSnapshot:
    """Observation of the controller at a particular phase of the shift."""

    name: str
    metrics: Mapping[str, float]


@dataclass
class ShiftReview:
    """Summary describing how a controller's state changed during a shift."""

    pre_shift: ShiftPhaseSnapshot
    post_shift: ShiftPhaseSnapshot
    delta: Dict[str, float]
    fatigue_delta: float

    def summary(self) -> str:
        """Return a human readable summary of the shift deltas."""

        top_changes = sorted(self.delta.items(), key=lambda item: abs(item[1]), reverse=True)[:3]
        formatted = ", ".join(f"{key}: {value:+.2f}" for key, value in top_changes)
        trend = "worsened" if self.fatigue_delta > 0 else "improved"
        return (
            f"Post-shift fatigue {trend} by {self.fatigue_delta:+.2f}. "
            f"Largest metric deltas — {formatted}."
        )


def compare_shift_phases(
    pre_shift: ShiftPhaseSnapshot,
    post_shift: ShiftPhaseSnapshot,
    *,
    fatigue_delta: float,
) -> ShiftReview:
    """Compute metric deltas between two shift phases."""

    delta: Dict[str, float] = {}
    for factor in FACTOR_DEFINITIONS:
        pre_value = pre_shift.metrics.get(factor.key)
        post_value = post_shift.metrics.get(factor.key)
        if pre_value is None or post_value is None:
            continue
        delta[factor.key] = post_value - pre_value
    return ShiftReview(
        pre_shift=pre_shift,
        post_shift=post_shift,
        delta=delta,
        fatigue_delta=fatigue_delta,
    )


__all__ = ["ShiftPhaseSnapshot", "ShiftReview", "compare_shift_phases"]
