#!/bin/sh
set -e

# If a command was passed explicitly (docker-compose's `command:` override),
# run that unchanged — keeps local/dev/compose behavior identical.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# Otherwise dispatch by SERVICE env var (used by Kanopy, where each release
# only sets an env var, not a container command).
case "${SERVICE:-orchestrator}" in
  orchestrator) exec uvicorn app.services.orchestrator:app --host 0.0.0.0 --port "${PORT:-8080}" ;;
  planner)      exec uvicorn app.services.planner_server:app --host 0.0.0.0 --port "${PLANNER_AGENT_PORT:-8081}" ;;
  profile)      exec uvicorn app.services.profile_server:app --host 0.0.0.0 --port "${PROFILE_AGENT_PORT:-9091}" ;;
  product)      exec uvicorn app.services.product_server:app --host 0.0.0.0 --port "${PRODUCT_AGENT_PORT:-9092}" ;;
  *) echo "Unknown SERVICE: ${SERVICE}" >&2; exit 1 ;;
esac
