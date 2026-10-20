import { NextRequest, NextResponse } from "next/server";

// Capacitor WebViews have a different origin from the HTTPS-hosted Next.js API.
// Only these exact native origins can access that API across origins.
const nativeOrigins = new Set(["capacitor://localhost", "https://localhost"]);

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const native = origin !== null && nativeOrigins.has(origin);
  if (request.method === "OPTIONS") {
    if (!native) return new NextResponse(null, { status: 403 });
    return new NextResponse(null, { status: 204, headers: cors(origin!) });
  }
  const response = NextResponse.next();
  if (native) for (const [name, value] of Object.entries(cors(origin!))) response.headers.set(name, value);
  return response;
}

function cors(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

export const config = { matcher: "/api/:path*" };
