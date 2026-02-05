FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir mcp-server-kubernetes mcp-streamablehttp-proxy \
    && pip cache purge

EXPOSE 8000

ENTRYPOINT ["mcp-streamablehttp-proxy", "--host", "0.0.0.0", "--port", "8000", "mcp-server-kubernetes"]
