from typing import Any

from pydantic import BaseModel, Field


class EvaluationCase(BaseModel):
    id: str | None = Field(default=None, max_length=100)
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_state: dict[str, Any] = Field(default_factory=dict)
    expected: dict[str, Any] = Field(default_factory=dict)


class EvaluationRequest(BaseModel):
    name: str = Field(default="manual-evaluation", max_length=120)
    cases: list[EvaluationCase] = Field(..., min_length=1, max_length=500)

