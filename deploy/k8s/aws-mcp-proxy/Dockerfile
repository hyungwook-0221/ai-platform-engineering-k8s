FROM public.ecr.aws/awslabs-mcp/awslabs/eks-mcp-server:sha-c816e7fa8729545d65e31043cff9c35892bd5dc7

# Use root just for package install
USER root

# Install streamable HTTP proxy for stdio MCP servers
RUN python -m ensurepip --upgrade \
    && python -m pip install --no-cache-dir mcp-streamablehttp-proxy \
    && python -m pip cache purge

USER 1000

EXPOSE 8000

# Wrap the stdio-only EKS MCP server with a streamable HTTP proxy
ENTRYPOINT ["mcp-streamablehttp-proxy", "--host", "0.0.0.0", "--port", "8000", "awslabs.eks-mcp-server"]
