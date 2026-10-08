import { NextRequest, NextResponse } from 'next/server';
import { isSafeNextPath } from './lib/safe-path';

// Chỉ kiểm tra "có cookie phiên hay không" để điều hướng nhanh.
// Việc xác thực thật sự do API server đảm nhiệm.
const PROTECTED_PREFIXES = ['/boards', '/b/', '/invite/'];
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
    // Đã đăng nhập mà vẫn mở /login?next=... (vd từ liên kết mời) → đi thẳng tới đích
    const next = req.nextUrl.searchParams.get('next');
    return NextResponse.redirect(new URL(isSafeNextPath(next) ? next : '/boards', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/boards/:path*', '/b/:path*', '/invite/:path*', '/login', '/register'],
};
