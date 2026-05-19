FROM node:20-alpine
ARG AI_CLI=claude
RUN apk add --no-cache git curl jq bash
RUN if [ "$AI_CLI" = "codex" ]; then \
      npm install -g @openai/codex@latest; \
    else \
      npm install -g @anthropic-ai/claude-code@latest; \
    fi
WORKDIR /app
COPY server.js .
EXPOSE 3001
CMD ["node", "server.js"]
