import { NextResponse, type NextRequest } from "next/server";
import { configProblems } from "@/lib/env";

// If required settings are missing, show the setup page instead of crashing on every request.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/setup") return NextResponse.next();
  if (configProblems().length === 0) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/setup";
  url.search = "";
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip static assets, Next internals and the health check.
  matcher: ["/((?!_next/|api/health|favicon|apple-touch-icon|img/|uploads/|robots.txt).*)"],
};
