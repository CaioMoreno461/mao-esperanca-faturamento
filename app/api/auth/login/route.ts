import {
  authenticate,
  createSessionToken,
  sessionCookie,
} from "@/app/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const result = await authenticate(username, password);

    if (!result) {
      return redirectTo(request, "/entrar?error=invalid");
    }

    const token = await createSessionToken(
      result.user.username,
      result.sessionVersion,
    );
    const response = redirectTo(request, "/");
    response.headers.set("Set-Cookie", sessionCookie(token));
    return response;
  } catch {
    return redirectTo(request, "/entrar?error=configuration");
  }
}

function redirectTo(request: Request, path: string) {
  return Response.redirect(new URL(path, request.url), 303);
}
