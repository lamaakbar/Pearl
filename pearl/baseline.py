"""Utilities for handling baseline readiness calibration."""
from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Dict, Iterable, Mapping, Sequence


@dataclass
class MetricStatistics:
    """Mean and standard deviation for a monitored metric."""

    mean: float
    std_dev: float

    def z_score(self, value: float, increase_is_risky: bool) -> float:
        """Return a normalised deviation for ``value``.

        The direction of risk is controlled by ``increase_is_risky``.  When it is
        ``True`` a larger value means more fatigue and the z-score is computed as
        ``(value - mean) / std``.  Otherwise the deviation is flipped.
        """

        if self.std_dev <= 0:
            return 0.0
        deviation = value - self.mean if increase_is_risky else self.mean - value
        return deviation / self.std_dev


class BaselineProfile:
    """Container for the baseline metrics captured during the pre-shift phase."""

    def __init__(self, metrics: Mapping[str, MetricStatistics]):
        self._metrics: Dict[str, MetricStatistics] = dict(metrics)

    def metric(self, key: str) -> MetricStatistics | None:
        return self._metrics.get(key)

    def to_dict(self) -> Dict[str, Dict[str, float]]:
        """Return a serialisable representation of the baseline profile."""

        return {
            key: {"mean": stats.mean, "std_dev": stats.std_dev}
            for key, stats in self._metrics.items()
        }

    @classmethod
    def from_samples(cls, samples: Mapping[str, Sequence[float]]) -> "BaselineProfile":
        """Create a baseline profile by computing statistics from samples."""

        metrics: Dict[str, MetricStatistics] = {}
        for key, values in samples.items():
            if not values:
                continue
            mean = sum(values) / len(values)
            variance = sum((value - mean) ** 2 for value in values) / max(len(values) - 1, 1)
            metrics[key] = MetricStatistics(mean=mean, std_dev=sqrt(variance))
        return cls(metrics)

    def update(self, key: str, *, mean: float, std_dev: float) -> None:
        """Mutate the baseline entry for ``key``."""

        self._metrics[key] = MetricStatistics(mean=mean, std_dev=std_dev)

    def merge(self, other: "BaselineProfile") -> "BaselineProfile":
        """Return a new profile combining the metrics from both profiles."""

        merged = dict(self._metrics)
        merged.update(other._metrics)
        return BaselineProfile(merged)

    def keys(self) -> Iterable[str]:
        return self._metrics.keys()


__all__ = ["MetricStatistics", "BaselineProfile"]
