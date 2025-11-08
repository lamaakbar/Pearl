from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pearl import BaselineProfile, FatigueModel, PersonalProfile
from pearl.baseline import MetricStatistics


def build_baseline() -> BaselineProfile:
    return BaselineProfile(
        {
            "response_delay": MetricStatistics(mean=1.0, std_dev=0.1),
            "resolution_latency": MetricStatistics(mean=2.0, std_dev=0.2),
            "blink_rate": MetricStatistics(mean=18.0, std_dev=3.0),
            "yawn_frequency": MetricStatistics(mean=0.2, std_dev=0.1),
            "pause_ratio": MetricStatistics(mean=0.15, std_dev=0.05),
            "tone_stability": MetricStatistics(mean=0.8, std_dev=0.05),
            "reaction_time_game": MetricStatistics(mean=300.0, std_dev=20.0),
            "hesitation_frequency": MetricStatistics(mean=0.05, std_dev=0.02),
            "posture_stability": MetricStatistics(mean=0.85, std_dev=0.05),
            "workload_index": MetricStatistics(mean=0.4, std_dev=0.1),
            "heart_stress_proxy": MetricStatistics(mean=0.3, std_dev=0.05),
        }
    )


def test_fatigue_score_increases_with_deviation() -> None:
    baseline = build_baseline()
    current_metrics = {
        "response_delay": 1.3,  # +3 sigma -> capped at 1.0 risk contribution
        "resolution_latency": 2.3,
        "blink_rate": 24.0,
        "yawn_frequency": 0.35,
        "pause_ratio": 0.27,
        "tone_stability": 0.7,
        "reaction_time_game": 360.0,
        "hesitation_frequency": 0.09,
        "posture_stability": 0.76,
        "workload_index": 0.6,
        "heart_stress_proxy": 0.42,
    }

    profile = PersonalProfile(
        experience_years=3,
        health_risk=0.5,
        medication_flag=True,
        age=56,
        self_report_fatigue=4.0,
    )

    model = FatigueModel()
    result = model.compute_score(baseline, current_metrics, profile, shift_delta=0.7)

    assert 0.7 <= result.score <= 1.0
    assert result.level == "Red"
    assert result.top_factors[0].contribution >= result.top_factors[1].contribution


def test_baseline_without_metric_defaults_to_zero_risk() -> None:
    baseline = build_baseline()
    current_metrics = {"response_delay": 1.0}
    profile = PersonalProfile(experience_years=10)

    model = FatigueModel()
    result = model.compute_score(baseline, current_metrics, profile)

    assert math.isclose(result.score, 0.0, abs_tol=1e-6)
    assert result.level == "Green"
