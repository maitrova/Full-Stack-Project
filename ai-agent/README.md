# AI Shopping Agent - Step 7

This is a small Python FastAPI service for learning how a backend communicates with an existing LLM API.

Step 1 did this:

```text
User message -> Python API -> Gemini API -> LLM response -> Python API response
```

It does not include tool calling, MongoDB, product search, cart integration, RAG, embeddings, vector databases, agent frameworks, LangChain, LangGraph, or memory.

Step 2 connects the existing React frontend to this `/chat` API through a small chat widget.

Step 3 adds a small hardcoded sample product catalog and sends it to the LLM as context.

Step 4 adds a simple Python product search function over the static catalog. The LLM now receives only matching sample products instead of the full sample catalog.

Step 5 connects the Python AI service to the existing Node/Express product API. The static sample catalog remains as a fallback when the MERN backend is not running.

Step 6 improves product matching with aliases, simple typo tolerance, and price formats such as `1k` and `2.5k`.

Step 7 returns structured matched products to React so the chat can show product cards, not only AI text.

## Project Structure

```text
ai-agent/
  app/
    __init__.py
    main.py
    config.py
    services/
      __init__.py
      backend_product_service.py
      llm_service.py
      product_context.py
      product_search.py
  .env.example
  .gitignore
  requirements.txt
  README.md
```

## Request Flow

```text
React/user
-> POST /chat
-> FastAPI
-> backend_product_service calls Node/Express API
-> product_search with aliases and typo tolerance
-> llm_service
-> matching sample product context
-> Gemini API
-> LLM
-> llm_service
-> FastAPI returns response text and products
-> user
```

## Installation

Open a terminal inside the `ai-agent` folder:

```bash
cd ai-agent
```

Create a Python virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows PowerShell:

```bash
.\.venv\Scripts\Activate.ps1
```

Activate it on macOS/Linux:

```bash
source .venv/bin/activate
```

Install requirements:

```bash
pip install -r requirements.txt
```

## Environment Setup

Create a `.env` file inside `ai-agent`.

Get a Gemini API key from Google AI Studio:

```text
https://aistudio.google.com/app/apikey
```

Then add it to `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
MERN_API_URL=http://localhost:5000/api
MERN_PRODUCTS_LIMIT=100
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Never hardcode the API key in Python files.

## Start FastAPI

Run this from inside the `ai-agent` folder:

```bash
uvicorn app.main:app --reload
```

The API will run at:

```text
http://127.0.0.1:8000
```

## Test With Postman

1. Open Postman.
2. Set the request method to `POST`.
3. Use this URL:

```text
http://127.0.0.1:8000/chat
```

4. Go to `Body`.
5. Select `raw`.
6. Select `JSON`.
7. Send this request:

```json
{
  "message": "I need a black dress under 2000"
}
```

Example response:

```json
{
  "response": "I found a few matching products.",
  "products": [
    {
      "name": "inner wear updated",
      "category": "inners",
      "price": 1000,
      "sizes": ["M", "L"]
    }
  ]
}
```

## What Step 7 Accomplishes

In Step 1, the Python backend learned how to receive a user message, send it to Gemini, receive the LLM response, and return it as JSON.

In Step 2, the React frontend learned how to call the Python `/chat` API and show the response in a chat widget.

In Step 3, the Python service now gives Gemini a small static product catalog. This helps you understand how product information can be included in the prompt before connecting a real database.

In Step 4, Python filters the static catalog before calling Gemini. This helps you understand that business logic can run in your backend before the LLM writes the final customer-friendly response.

In Step 5, Python gets real product data from your existing MERN backend API before filtering products. This means the AI service still does not know MongoDB directly; it uses the same backend API your website already uses.

In Step 6, Python search became more flexible. For example, `inside wear below 1k` can match an `inners` category, and `tshirt under 800` can match `t-shirt` products. This is still normal Python code, not LLM tool calling.

In Step 7, FastAPI returns structured products along with the AI response. React can now render product cards inside the chat, using the product data found by Python search.

Later, when tools are introduced, the LLM will be able to request actions such as searching products, checking inventory, or helping with cart actions. For now, it only replies with text using products found by Python search and has no ability to perform website actions.
