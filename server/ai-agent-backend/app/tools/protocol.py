import inspect
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, ValidationError


class StrictToolArguments(BaseModel):
    """Base class for tool arguments. Unknown model-supplied fields are rejected."""

    model_config = ConfigDict(extra="forbid", strict=True)


class ToolCall(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    arguments: dict[str, Any] | str


class ToolResult(BaseModel):
    call_id: str
    name: str
    ok: bool
    output: Any = None
    error: str | None = None


ArgumentsT = TypeVar("ArgumentsT", bound=BaseModel)


@dataclass(frozen=True)
class ToolDefinition(Generic[ArgumentsT]):
    name: str
    description: str
    arguments_model: type[ArgumentsT]
    handler: Callable[[ArgumentsT], Any | Awaitable[Any]]

    def provider_schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.arguments_model.model_json_schema(),
        }


class ValidatedToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, definition: ToolDefinition) -> None:
        if definition.name in self._tools:
            raise ValueError(f"Tool already registered: {definition.name}")
        self._tools[definition.name] = definition

    def schemas(self) -> list[dict[str, Any]]:
        return [definition.provider_schema() for definition in self._tools.values()]

    async def execute(self, call: ToolCall | dict[str, Any]) -> ToolResult:
        try:
            parsed_call = call if isinstance(call, ToolCall) else ToolCall.model_validate(call)
        except ValidationError as exc:
            return ToolResult(call_id="invalid", name="invalid", ok=False, error=f"Invalid tool call envelope: {exc}")
        definition = self._tools.get(parsed_call.name)
        if definition is None:
            return ToolResult(call_id=parsed_call.id, name=parsed_call.name, ok=False, error="Unknown tool")
        try:
            raw_arguments = (
                json.loads(parsed_call.arguments)
                if isinstance(parsed_call.arguments, str)
                else parsed_call.arguments
            )
            arguments = definition.arguments_model.model_validate(raw_arguments)
        except (json.JSONDecodeError, ValidationError) as exc:
            return ToolResult(call_id=parsed_call.id, name=parsed_call.name, ok=False, error=f"Invalid tool arguments: {exc}")
        try:
            output = definition.handler(arguments)
            if inspect.isawaitable(output):
                output = await output
            return ToolResult(call_id=parsed_call.id, name=parsed_call.name, ok=True, output=output)
        except Exception as exc:
            return ToolResult(call_id=parsed_call.id, name=parsed_call.name, ok=False, error=exc.__class__.__name__)
