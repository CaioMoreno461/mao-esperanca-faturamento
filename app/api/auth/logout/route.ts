import { expiredSessionCookie } from "@/app/auth";

export async function POST(request: Request) {
  const response = Response.redirect(new URL("/entrar", request.url), 303);
  response.headers.set("Set-Cookie", expiredSessionCookie());
  return response;
}
