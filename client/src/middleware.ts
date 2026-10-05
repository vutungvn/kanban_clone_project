import { NextRequest, NextResponse } from 'next/server';

// Chỉ kiểm tra "có cookie phiên hay không" để điều hướng nhanh.
// Việc xác thực thật sự do API server đảm nhiệm.
const PROTECTED_PREFIXES = ['/boards'];
const AUTH_PAGES = ['/login', '/register'];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has('access_token') || req.cookies.has('refresh_token');

  if (!hasSession && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/boards', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/boards/:path*', '/login', '/register'],
};
