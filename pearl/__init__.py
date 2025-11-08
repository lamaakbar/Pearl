"""Core package for the PEARL fatigue detection framework.

This lightweight package provides utilities for modelling the fatigue
scoring pipeline described in the PEARL documentation.  It focuses on
local, on-premise execution and keeps data structures simple so that
they can be embedded inside edge-device workflows without additional
dependencies.
"""

from .factors import FACTOR_DEFINITIONS, FactorDefinition
from .baseline import BaselineProfile, MetricStatistics
from .model import (
    FatigueModel,
    FatigueResult,
    FactorContribution,
    PersonalProfile,
)
from .shift import ShiftPhaseSnapshot, ShiftReview

__all__ = [
    "FACTOR_DEFINITIONS",
    "FactorDefinition",
    "BaselineProfile",
    "MetricStatistics",
    "FatigueModel",
    "FatigueResult",
    "FactorContribution",
    "PersonalProfile",
    "ShiftPhaseSnapshot",
    "ShiftReview",
]
