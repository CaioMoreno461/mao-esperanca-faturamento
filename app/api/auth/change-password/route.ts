import {
  changePassword,
  createSessionToken,
  getAuthUser,
  sessionCookie,
} from "@/app/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return redirectTo(request, "/entrar");

  const data = await request.formData();
  const currentPassword = String(data.get("currentPassword") ?? "");
  const newPassword = String(data.get("newPassword") ?? "");
  const confirmPassword = String(data.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return redirectTo(request, "/conta?status=mismatch");
  }
  if (newPassword.length < 10 || newPassword.length > 128) {
    return redirectTo(request, "/conta?status=weak");
  }

  const changed = await changePassword(currentPassword, newPassword);
  if (!changed) return redirectTo(request, "/conta?status=invalid");

  const token = await createSessionToken(
    changed.username,
    changed.sessionVersion,
  );
  const response = redirectTo(request, "/conta?status=changed");
  response.headers.set("Set-Cookie", sessionCookie(token));
  return response;
}

function redirectTo(request: Request, path: string) {
  return Response.redirect(new URL(path, request.url), 303);
}
