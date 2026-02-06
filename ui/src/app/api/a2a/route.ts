import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCaipeServerUrl(): string {
  return process.env.CAIPE_URL ||
    process.env.A2A_ENDPOINT ||
    "http://localhost:8000";
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  return headers;
}

async function proxyRoot(request: NextRequest, method: string): Promise<NextResponse> {
  const targetUrl = getCaipeServerUrl();
  const headers = buildForwardHeaders(request);

  const init: RequestInit = {
    method,
    headers,
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
    (init as { duplex?: "half" }).duplex = "half";
  }

  const response = await fetch(targetUrl, init);

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

export async function GET(request: NextRequest) {
  try {
    return await proxyRoot(request, "GET");
  } catch (error) {
    console.error("[A2A Proxy] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to connect to CAIPE", details: String(error) },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await proxyRoot(request, "POST");
  } catch (error) {
    console.error("[A2A Proxy] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to connect to CAIPE", details: String(error) },
      { status: 502 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return await proxyRoot(request, "DELETE");
  } catch (error) {
    console.error("[A2A Proxy] DELETE failed:", error);
    return NextResponse.json(
      { error: "Failed to connect to CAIPE", details: String(error) },
      { status: 502 }
    );
  }
}
