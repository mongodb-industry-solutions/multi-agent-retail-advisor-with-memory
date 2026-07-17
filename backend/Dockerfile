# One image, four entrypoints. Each service in docker-compose runs this image
# with a different `command` (uvicorn target + port). Python 3.13 to match dev.
FROM python:3.13-slim

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY app ./app

# Run as non-root.
RUN useradd --system --create-home appuser && chown -R appuser /app
USER appuser

# Default command is the orchestrator (frontend-facing API). Overridden per
# service in docker-compose for the profile / product / planner A2A servers.
EXPOSE 8080
CMD ["uvicorn", "app.services.orchestrator:app", "--host", "0.0.0.0", "--port", "8080"]
