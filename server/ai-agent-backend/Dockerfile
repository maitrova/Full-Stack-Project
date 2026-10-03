FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts/diagnose_image_delivery.py ./scripts/diagnose_image_delivery.py
# Run the service as an unprivileged user. This is required by the Helm
# chart's runAsNonRoot security policy.
RUN addgroup --system app && adduser --system --ingroup app app \
    && chown -R app:app /app
USER app
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
