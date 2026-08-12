from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.services.llm_service import get_llm_response


app = FastAPI(title="AI Shopping Agent - Step 7")

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


class ChatResponse(BaseModel):
    response: str
    products: list[dict] = Field(default_factory=list)


@app.get("/")
def health_check():
    return {"status": "AI Shopping Agent Step 7 is running"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # 1. The user's message enters the application here through POST /chat.
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        # The endpoint passes the user message to llm_service.py.
        chat_result = await get_llm_response(request.message)
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Failed to get LLM response") from error

    # 6. FastAPI returns the LLM response to the client as JSON.
    return ChatResponse(
        response=chat_result["response"],
        products=chat_result["products"],
    )
