FROM ghcr.io/cnoe-io/agent-aws:0.2.8

USER root

# Install uv/uvx for MCP stdio server execution
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && UV_NO_MODIFY_PATH=1 curl -fsSL https://astral.sh/uv/install.sh | sh \
    && mv /root/.local/bin/uv /usr/local/bin/uv \
    && mv /root/.local/bin/uvx /usr/local/bin/uvx

USER 1000
