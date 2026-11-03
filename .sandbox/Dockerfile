# syntax=docker/dockerfile:1.7
# Autonomous Agent & Script Sandboxed Execution Container
FROM node:22-bookworm-slim

# Install system dependencies needed for pnpm and build tooling
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl git dumb-init && \
    rm -rf /var/lib/apt/lists/*

# Install and configure pnpm matching repository packageManager
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

# Create non-privileged agent runner user
RUN groupadd --gid 10001 agentgroup && \
    useradd --uid 10001 --gid agentgroup --shell /bin/bash --create-home agentuser

# Set up workspace directories
WORKDIR /workspace

# Prepare ephemeral writable mount points
RUN mkdir -p /workspace/.sandbox/scratch /workspace/.sandbox/output /workspace/.sandbox/cache /workspace/dist /workspace/.angular && \
    chown -R agentuser:agentgroup /workspace /pnpm

# Run as non-privileged agent user
USER agentuser

# Sanitize runtime environment
ENV NODE_ENV=development
ENV CI=true
ENV SANDBOX_CONTAINED=true

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["pnpm", "test"]
