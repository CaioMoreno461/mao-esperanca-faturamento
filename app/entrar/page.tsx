import { redirect } from "next/navigation";
import { getAuthUser } from "../auth";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid: "Utilizador ou senha incorretos.",
  configuration: "O acesso ainda não foi configurado.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getAuthUser();
  if (user) redirect("/");

  const { error } = await searchParams;
  const message = error ? errorMessages[error] : null;

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="Clínica Mão de Esperança">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>
            <strong>Mão de Esperança</strong>
            <small>Gestão Financeira</small>
          </span>
        </div>

        <div className="auth-message">
          <p className="section-kicker">Área reservada</p>
          <h1>Gestão clara para cuidar do que importa.</h1>
          <p>
            Consulte recebimentos, acompanhe orçamentos e organize os
            pagamentos da clínica num único lugar protegido.
          </p>
        </div>

        <div className="auth-trust">
          <span aria-hidden="true">✓</span>
          <p>
            <strong>Acesso protegido</strong>
            <small>Sessão segura com duração máxima de oito horas.</small>
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card" action="/api/auth/login" method="post">
          <div className="auth-lock" aria-hidden="true">⌁</div>
          <p className="eyebrow">Bem-vindo de volta</p>
          <h2>Entre na sua conta</h2>
          <p className="auth-description">
            Introduza as credenciais internas da Clínica Mão de Esperança.
          </p>

          {message && <div className="auth-error" role="alert">{message}</div>}

          <label className="auth-field">
            <span>Utilizador</span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              autoFocus
            />
          </label>

          <label className="auth-field">
            <span>Senha</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="auth-submit" type="submit">
            Entrar no painel
          </button>

          <div className="auth-security-note">
            <span aria-hidden="true">i</span>
            <p>
              Apenas pessoas autorizadas devem utilizar estas credenciais.
              Termine sempre a sessão em computadores partilhados.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
