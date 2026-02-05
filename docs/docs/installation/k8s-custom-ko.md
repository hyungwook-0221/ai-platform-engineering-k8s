---
sidebar_position: 50
---

# K8s 배포 가이드 (한국어)

이 문서는 **CAIPE 백엔드(Helm)** + **CAIPE UI(Next.js)**를 Kubernetes에서 안정적으로 연결하는 방법을 정리합니다.
특히 로컬/클러스터 내부 서비스와 브라우저 간 네트워크 차이로 인해 발생하는 A2A 통신 문제와 AWS MCP 서버 문제를 해결하는 흐름을 포함합니다.

## 핵심 개선점

- **브라우저는 `/api/a2a`만 호출**하고, 서버는 `CAIPE_URL`로 내부 서비스에 접근합니다.
- AWS MCP 서버는 **stdio 전용**이므로, `uvx` 실행 환경과 캐시 경로를 보장합니다.
- 로컬 테스트는 **UI만 Port-forward**하면 충분합니다.

## 문제 원인 요약

1) **AWS MCP 서버가 동작하지 않던 이유**
- `agent-aws`는 `uvx`로 `awslabs.eks-mcp-server@latest`를 실행합니다.
- 기본 이미지에는 `uvx`가 없고, 설치 시 캐시/데이터 경로가 읽기 전용(`/.local/share`)이라 실패합니다.
- 결과적으로 MCP 서버가 뜨지 않아 **도구 호출 결과가 비어 보이는 현상**이 발생합니다.

2) **브라우저에서 CAIPE 내부 서비스 접근 실패**
- `NEXT_PUBLIC_A2A_BASE_URL`로 내부 Cluster DNS를 주면 브라우저가 접근하지 못합니다.
- 해결: **UI에서 `/api/a2a` 프록시**를 사용하고, 서버 환경변수 `CAIPE_URL`로 내부 서비스에 연결합니다.

3) **Helm upgrade 에러**
- `--force-replace`는 server-side apply와 같이 쓸 수 없습니다.
- `helm upgrade` 시 `--force-replace` 옵션을 제거하세요.

## 권장 아키텍처

- 브라우저 → `CAIPE UI` → `/api/a2a` → `CAIPE Supervisor`
- 브라우저는 내부 서비스 DNS를 몰라도 됩니다.

## 1) 이미지 빌드 및 푸시

### 1-1. CAIPE UI 이미지
```bash
REGISTRY=your-registry.example.com
TAG=0.1.0

docker build -f build/Dockerfile.caipe-ui -t ${REGISTRY}/caipe-ui:${TAG} .
docker push ${REGISTRY}/caipe-ui:${TAG}
```

### 1-2. AWS Agent (uvx 포함) 이미지
```bash
REGISTRY=your-registry.example.com
TAG=0.1.0

docker build -f deploy/k8s/aws-agent-uvx/Dockerfile -t ${REGISTRY}/agent-aws-uvx:${TAG} .
docker push ${REGISTRY}/agent-aws-uvx:${TAG}
```

### 1-3. (선택) AWS MCP Proxy 이미지
```bash
REGISTRY=your-registry.example.com
TAG=0.1.0

docker build -f deploy/k8s/aws-mcp-proxy/Dockerfile -t ${REGISTRY}/aws-mcp-proxy:${TAG} .
docker push ${REGISTRY}/aws-mcp-proxy:${TAG}
```

## 2) Helm으로 백엔드 배포

샘플 override 파일: `deploy/k8s/helm/override-values.yaml`

```bash
helm upgrade --install ai-platform-engineering charts/ai-platform-engineering \
  -n ai-platform-engineering --create-namespace \
  -f deploy/k8s/helm/override-values.yaml
```

### 핵심 포인트
- `tags.agent-aws: true`로 AWS 에이전트 활성화
- `agent-aws.image.repository`/`tag`를 **내 레지스트리**로 변경
- `agent-aws.env`에 **UV/XDG/HOME 경로**를 `/tmp`로 지정

## 3) CAIPE UI 배포 (K8s Manifest)

`deploy/k8s/caipe-ui`를 그대로 적용하고, 아래 두 파일만 수정하세요.

1) `deploy/k8s/caipe-ui/caipe-ui-deployment.yaml`
- `image:`를 내가 빌드한 CAIPE UI 이미지로 변경

2) `deploy/k8s/caipe-ui/caipe-ui-configmap.yaml`
- `CAIPE_URL`을 **클러스터 내부 Supervisor 서비스**로 지정

예시:
```yaml
CAIPE_URL: "http://ai-platform-engineering-supervisor-agent:8000"
```

적용:
```bash
kubectl apply -k deploy/k8s/caipe-ui
```

## 4) Ingress (EKS + ALB + Route53 + ACM)

### 4-1. 기본 Ingress (테스트)
`deploy/k8s/caipe-ui/caipe-ui-ingress.yaml`

### 4-2. ALB Ingress 예시 (운영)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: caipe-ui
  namespace: ai-platform-engineering
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:123456789012:certificate/xxxxxxxx
    external-dns.alpha.kubernetes.io/hostname: caipe.example.com
spec:
  rules:
    - host: caipe.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: caipe-ui
                port:
                  number: 3000
```

## 5) 테스트 방법 (Port-forward)

UI만 포트포워딩하면 됩니다.

```bash
kubectl -n ai-platform-engineering port-forward svc/caipe-ui 3000:3000
```

브라우저에서 `http://localhost:3000` 접속 후 다음 질문 테스트:

> “Seoul 리전의 EC2, VPC 목록조회. 결과는 한글로”

정상이라면 **EC2/VPC 목록 결과가 한글로 반환**되어야 합니다.

## 6) 트러블슈팅

- **AWS MCP 결과가 비어있음**
  - `kubectl logs deploy/agent-aws -n ai-platform-engineering` 확인
  - `uvx` 관련 에러가 있으면 `agent-aws.env`의 `/tmp` 설정을 확인

- **브라우저에서 A2A 접근 실패**
  - `NEXT_PUBLIC_A2A_BASE_URL`를 쓰지 말고, `/api/a2a`를 기본으로 사용
  - `CAIPE_URL`만 내부 서비스로 지정

- **헬름 업그레이드 실패**
  - `helm upgrade`에서 `--force-replace` 제거

## 7) MCP 서버 추가 방법 (샘플 포함)

Platform Engineering에서 유용한 MCP 예시로 **Kubernetes MCP**를 추가했습니다.

- 샘플 경로: `deploy/k8s/mcp-samples/kubernetes`
- Dockerfile: `deploy/k8s/mcp-samples/kubernetes/Dockerfile`
- 매니페스트: `deploy/k8s/mcp-samples/kubernetes/kubernetes-mcp.yaml`

### 빠른 적용 흐름
1) 이미지 빌드/푸시
2) K8s에 MCP 서비스 배포
3) 에이전트에 `MCP_MODE=http` + `MCP_HOST`/`MCP_PORT` 연결

자세한 단계는 `deploy/k8s/mcp-samples/kubernetes/README.md` 참고.

## 8) EKS 운영 배포 체크리스트

- [ ] 이미지 빌드/푸시 완료 (UI, AWS Agent)
- [ ] `override-values.yaml`에 레지스트리/태그 반영
- [ ] `CAIPE_URL`을 내부 서비스로 설정
- [ ] Ingress + Route53 + ACM 적용
- [ ] UI 접근 및 A2A 응답 확인
