import { redirect } from "next/navigation";
import { getAuthUser } from "../auth";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  changed: "Senha alterada. As outras sessões foram terminadas.",
  invalid: "A senha atual está incorreta.",
  mismatch: "A confirmação não corresponde à nova senha.",
  weak: "Use uma senha com pelo menos 10 caracteres.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/entrar");

  const { status } = await searchParams;
  const message = status ? messages[status] : null;

  return (
    <main className="account-page">
      <section className="account-card">
        <a className="account-back" href="/">← Voltar ao painel</a>
        <p className="eyebrow">Segurança da conta</p>
        <h1>Alterar senha</h1>
        <p>
          A nova senha será usada por toda a equipa e terminará as sessões
          abertas noutros dispositivos.
        </p>

        {message && (
          <div
            className={`account-message ${status === "changed" ? "success" : ""}`}
            role="status"
          >
            {message}
          </div>
        )}

        <form action="/api/auth/change-password" method="post">
          <label className="auth-field">
            <span>Senha atual</span>
            <input name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <label className="auth-field">
            <span>Nova senha</span>
            <input name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
          </label>
          <label className="auth-field">
            <span>Confirmar nova senha</span>
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
          </label>
          <button className="auth-submit" type="submit">Guardar nova senha</button>
        </form>

        <form action="/api/auth/logout" method="post">
          <button className="account-logout" type="submit">Terminar sessão</button>
        </form>
      </section>
    </main>
  );
}
