"""Example demonstrating the fatigue scoring workflow."""
from __future__ import annotations

from pearl import (
    BaselineProfile,
    FatigueModel,
    PersonalProfile,
    ShiftPhaseSnapshot,
    compare_shift_phases,
)
from pearl.baseline import MetricStatistics


# Baseline derived from pre-shift calibration samples
baseline = BaselineProfile(
    {
        "response_delay": MetricStatistics(mean=1.2, std_dev=0.2),
        "resolution_latency": MetricStatistics(mean=2.5, std_dev=0.4),
        "blink_rate": MetricStatistics(mean=18.0, std_dev=3.0),
        "yawn_frequency": MetricStatistics(mean=0.2, std_dev=0.1),
        "pause_ratio": MetricStatistics(mean=0.15, std_dev=0.05),
        "tone_stability": MetricStatistics(mean=0.75, std_dev=0.05),
        "reaction_time_game": MetricStatistics(mean=320.0, std_dev=25.0),
        "hesitation_frequency": MetricStatistics(mean=0.04, std_dev=0.02),
        "posture_stability": MetricStatistics(mean=0.82, std_dev=0.06),
        "workload_index": MetricStatistics(mean=0.35, std_dev=0.1),
        "heart_stress_proxy": MetricStatistics(mean=0.3, std_dev=0.05),
    }
)

# During-shift metrics captured in the latest window
current_metrics = {
    "response_delay": 1.45,
    "resolution_latency": 3.0,
    "blink_rate": 25.0,
    "yawn_frequency": 0.4,
    "pause_ratio": 0.25,
    "tone_stability": 0.65,
    "reaction_time_game": 360.0,
    "hesitation_frequency": 0.07,
    "posture_stability": 0.7,
    "workload_index": 0.55,
    "heart_stress_proxy": 0.45,
}

profile = PersonalProfile(
    experience_years=4,
    health_risk=0.2,
    medication_flag=False,
    age=37,
    self_report_fatigue=2.0,
)

model = FatigueModel()
result = model.compute_score(
    baseline,
    current_metrics,
    profile,
    shift_delta=0.6,  # derived from pre/post comparison for the same shift
)

print(f"Fatigue score: {result.score:.2f} ({result.level})")
print(f"Recommendation: {result.recommendation}")
print("Top contributing factors:")
for factor in result.top_factors:
    print(f"  - {factor.name}: contribution={factor.contribution:.3f}, risk={factor.risk:.2f}")

pre_shift = ShiftPhaseSnapshot(name="Pre", metrics=current_metrics)
post_shift = ShiftPhaseSnapshot(
    name="Post",
    metrics={**current_metrics, "reaction_time_game": 390.0, "blink_rate": 28.0},
)
review = compare_shift_phases(pre_shift, post_shift, fatigue_delta=0.08)
print("\nShift review summary:")
print(review.summary())
