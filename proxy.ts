import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional password gate for the whole site (pages AND /api routes).
 *
 * Enabled only when BOTH APP_BASIC_AUTH_USER and APP_BASIC_AUTH_PASSWORD are
 * set. The browser then shows its native login prompt. Without them the site
 * is open - fine on your own PC, NOT fine on a public URL, because anyone who
 * can reach the site could search invoices and submit them to FBR.
 */

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function parseBasic(header: string | null): { user: string; pass: string } | null {
  if (!header || !header.toLowerCase().startsWith("basic ")) return null;
  try {
    const bytes = Uint8Array.from(atob(header.slice(6).trim()), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const i = decoded.indexOf(":");
    if (i < 0) return null;
    return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const user = process.env.APP_BASIC_AUTH_USER?.trim();
  const pass = process.env.APP_BASIC_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next(); // gate disabled

  const given = parseBasic(request.headers.get("authorization"));
  if (given && safeEqual(given.user, user) && safeEqual(given.pass, pass)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="FBR Digital Invoicing", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  // Everything except Next's static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
