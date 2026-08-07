# One image, four entrypoints. Each service in docker-compose runs this image
# with a different `command` (uvicorn target + port). Python 3.13 to match dev.
FROM python:3.13-slim

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY app ./app
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Run as non-root.
RUN useradd --system --create-home appuser && chown -R appuser /app
USER appuser

# docker-compose passes an explicit `command:` per service (unchanged behavior);
# Kanopy deployments instead set a SERVICE env var (orchestrator|planner|profile|
# product) and let the entrypoint dispatch the right uvicorn target/port — see
# docker-entrypoint.sh. Default SERVICE is "orchestrator".
EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD []
