# Kubernetes MCP 샘플

이 샘플은 `mcp-server-kubernetes`를 **HTTP 모드**로 노출하기 위한 최소 구성입니다.
`mcp-server-kubernetes`는 stdio 기반 MCP 서버이므로 `mcp-streamablehttp-proxy`로 감싸서
HTTP로 접근할 수 있게 합니다.

## 1) 이미지 빌드/푸시

```bash
REGISTRY=your-registry.example.com
TAG=0.1.0

docker build -f deploy/k8s/mcp-samples/kubernetes/Dockerfile -t ${REGISTRY}/mcp-kubernetes:${TAG} .
docker push ${REGISTRY}/mcp-kubernetes:${TAG}
```

## 2) 배포

`deploy/k8s/mcp-samples/kubernetes/kubernetes-mcp.yaml`에서 이미지 경로만 바꾸고 적용합니다.

```bash
kubectl apply -f deploy/k8s/mcp-samples/kubernetes/kubernetes-mcp.yaml
```

## 3) 에이전트 연결

MCP 서버가 `kubernetes-mcp:8000`으로 떠있다고 가정하면,
에이전트 환경변수에 다음을 설정합니다.

```yaml
env:
  MCP_MODE: "http"
  MCP_HOST: "kubernetes-mcp"
  MCP_PORT: "8000"
```

Helm 사용 시, 해당 에이전트 블록에 `env`로 추가하면 됩니다.

