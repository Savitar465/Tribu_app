import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Next.js 16 Proxy (formerly Middleware). Runs before each matched request to
 * keep the Supabase auth session refreshed.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every path except static assets and PWA files:
     * - _next/static, _next/image, favicon
     * - the service worker, web manifest and icons
     * - common image types
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icon\\.svg|icon-maskable\\.svg|icons/).*)",
  ],
};
