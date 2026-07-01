"""verification_agent — the confidence cross-check node of the Prahari graph.

After intake classifies a report, this agent cross-checks the classification
confidence and flags low-confidence or unclassified cases for community
confirmation, rather than trusting a weak result. This is a deterministic
disagreement check, so it is instant and never spends a model call.

Exposes `verify_classification(result)`. Never raises.
"""

from __future__ import annotations

from typing import TypedDict

# Below this confidence, a classification is treated as uncertain and routed to
# community confirmation instead of being trusted outright.
CONFIDENCE_FLOOR = 0.55


class VerificationResult(TypedDict):
    confident: bool
    needsCommunity: bool
    note: str


def verify_classification(result: dict) -> VerificationResult:
    """Cross-check the intake classification confidence. Never raises."""
    try:
        confidence = float(result.get("confidence", 0.0) or 0.0)
    except (TypeError, ValueError):
        confidence = 0.0
    issue = result.get("issueType")

    if issue == "unknown" or confidence < CONFIDENCE_FLOOR:
        return VerificationResult(
            confident=False,
            needsCommunity=True,
            note="Confidence is low, so this case is flagged for community confirmation.",
        )
    return VerificationResult(
        confident=True,
        needsCommunity=False,
        note="Classification confidence is sufficient to proceed.",
    )
