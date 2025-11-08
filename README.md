# Pearl

PEARL (Proactive Early Awareness &amp; Readiness Layer) is an on-premise
system designed to detect early signs of mental and physical fatigue in
air-traffic controllers. It combines operational data, voice analysis and
facial cues to provide real-time fatigue insights processed entirely on
a secure edge device.

## Repository Structure

```
pearl/              # Core scoring utilities (baseline profiles, fatigue model, shift analysis)
docs/               # Architecture and process documentation
examples/           # Sample scripts showing how to use the scoring utilities
tests/              # Pytest-based unit tests covering the fatigue model behaviour
```

## Getting Started

1. Create a Python virtual environment (Python 3.11 or later recommended)
   and install `pytest` if you want to run the tests.
2. Review `docs/system_overview.md` for a high-level explanation of the
   fatigue factors and the three-phase workflow.
3. Execute `python examples/demo.py` to see a full scoring cycle using
   synthetic data.
4. Run `pytest` to execute the included unit tests.

## Key Components

- `pearl.factors` enumerates the 15 fatigue indicators and their suggested
  weights as described in the latest specification.
- `pearl.baseline` offers helpers to compute and manage baseline
  statistics captured during the pre-shift calibration.
- `pearl.model` implements the fatigue scoring engine that aggregates
  operational, behavioural and contextual modifiers.
- `pearl.shift` provides utilities for comparing pre- and post-shift
  measurements.

All modules are dependency-light and intended to be embedded within an
on-premise deployment that processes sensitive fatigue data locally.
