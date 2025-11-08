# PEARL Fatigue Monitoring Overview

This document summarises how the updated PEARL (Proactive Early Awareness &amp;
Readiness Layer) implementation models fatigue detection inside this
repository.

## Factor Weighting

The fatigue engine relies on fifteen factors grouped into three tiers.
Tier 1 captures high-confidence fatigue symptoms such as response delays
and facial cues. Tier 2 reinforces detection with supportive indicators
(e.g. posture stability and workload), while Tier 3 adjusts the score
using contextual modifiers like experience or personal health data.

The factors and suggested weights are declared in
`pearl/factors.py`. They mirror the table in the product brief and can be
queried programmatically for dashboards or audits.

## Operational Phases

1. **Pre-shift** – a readiness calibration collects short video, audio
   and a reaction-time micro test. The resulting samples can be passed to
   `BaselineProfile.from_samples()` to build or refresh the baseline used
   in later calculations.
2. **During shift** – real-time streams are translated into numeric
   metrics which are aggregated per monitoring window and fed into
   `FatigueModel.compute_score()` alongside the baseline and personal
   profile information.
3. **Post-shift** – the same capture routines are repeated to measure
   recovery. Use `compare_shift_phases()` to contrast pre- and post-shift
   metrics and derive insights for fatigue trend analysis.

## Edge-Friendly Scoring Pipeline

`FatigueModel` applies the following logic:

1. Compute z-scores for each metric relative to the baseline, honouring
   whether an increase represents higher risk.
2. Convert deviations into bounded risk multipliers per factor and weight
   them according to their tier.
3. Apply contextual modifiers derived from personal health, experience
   and self-reported fatigue to personalise the score.
4. Generate a `FatigueResult` object containing the composite score, the
   highest contributing factors, textual recommendations, and a breakdown
   of modifier adjustments that can be logged for supervisor review.

The design avoids heavy dependencies and focuses on deterministic
calculations that can run entirely offline on the on-premise edge device.
