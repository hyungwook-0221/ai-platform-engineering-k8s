import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCaipeServerUrl(): string {
  return process.env.CAIPE_URL ||
    process.env.A2A_ENDPOINT ||
    "http://localhost:8000";
}

function buildTargetUrl(request: NextRequest, path: string[]): URL {
  const baseUrl = getCaipeServerUrl().replace(/\/$/, "");
  const targetPath = path.join("/");
  const targetUrl = new URL(`${baseUrl}/${targetPath}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  return targetUrl;
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);

  // Remove headers that should not be forwarded.
  headers.delete("host");
  headers.delete("content-length");

  return headers;
}

async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
): Promise<NextResponse> {
  const targetUrl = buildTargetUrl(request, path);
  const headers = buildForwardHeaders(request);

  const init: RequestInit = {
    method,
    headers,
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
    (init as { duplex?: "half" }).duplex = "half";
  }

  const response = await fetch(targetUrl.toString(), init);

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    return await proxyRequest(request, path, "GET");
  } catch (error) {
    console.error("[A2A Proxy] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to connect to CAIPE", details: String(error) },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    return await proxyRequest(request, path, "POST");
  } catch (error) {
    console.error("[A2A Proxy] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to connect to CAIPE", details: String(error) },
      { status: 502 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    return await proxyRequest(request, path, "DELETE");
  } catch (error) {
    console.error("[A2A Proxy] DELETE failed:", error);
    return NextResponse.json(
      { error: "Failed to connect to CAIPE", details: String(error) },
      { status: 502 }
    );
  }
}
