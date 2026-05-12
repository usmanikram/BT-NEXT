import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthed = !!req.auth;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

  if (!isAuthed && !isPublic) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("from", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (isAuthed && isPublic) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
