from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.services.llm_service import get_llm_response
from app.services.chat_memory import clear_chat_history, get_chat_history, save_chat_turn
from app.services.recommendation_service import get_page_recommendations


app = FastAPI(title="AI Shopping Agent - Complete")

# CORS allows your React app running on Vite to call this Python API in the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    page_context: dict = Field(default_factory=dict)


class ChatResponse(BaseModel):
    session_id: str
    response: str
    products: list[dict] = Field(default_factory=list)
    action: dict | None = None


class RecommendationRequest(BaseModel):
    session_id: str | None = None
    page_context: dict = Field(default_factory=dict)


class RecommendationResponse(BaseModel):
    session_id: str
    response: str
    products: list[dict] = Field(default_factory=list)
    offers: list[dict] = Field(default_factory=list)


@app.get("/")
def health_check():
    return {"status": "AI Shopping Agent complete flow is running"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, authorization: str | None = Header(default=None)):
    # 1. The user's message enters the application here through POST /chat.
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = request.session_id or str(uuid4())

    try:
        # The endpoint passes the user message to llm_service.py.
        history = get_chat_history(session_id)
        chat_result = await get_llm_response(
            request.message,
            history,
            authorization,
            request.page_context,
            session_id,
        )
        save_chat_turn(session_id, request.message, chat_result["response"])
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get LLM response: {error.__class__.__name__}: {error}",
        ) from error

    # 6. FastAPI returns the LLM response to the client as JSON.
    return ChatResponse(
        session_id=session_id,
        response=chat_result["response"],
        products=chat_result["products"],
        action=chat_result.get("action"),
    )


@app.post("/recommendations", response_model=RecommendationResponse)
async def recommendations(
    request: RecommendationRequest,
    authorization: str | None = Header(default=None),
):
    session_id = request.session_id or str(uuid4())

    try:
        result = await get_page_recommendations(
            request.page_context,
            session_id,
            authorization,
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get recommendations: {error.__class__.__name__}: {error}",
        ) from error

    return RecommendationResponse(
        session_id=session_id,
        response=result["response"],
        products=result["products"],
        offers=result["offers"],
    )


@app.delete("/chat/{session_id}")
def clear_chat(session_id: str):
    clear_chat_history(session_id)
    return {"status": "cleared", "session_id": session_id}
