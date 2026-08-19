import { redirect } from "next/navigation";
import {
  chatGPTSignInPath,
  getChatGPTUser,
} from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const user = await getChatGPTUser();
  if (user) redirect("/");

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
            <small>Os seus dados de acesso não são guardados pela aplicação.</small>
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-lock" aria-hidden="true">⌁</div>
          <p className="eyebrow">Bem-vindo de volta</p>
          <h2>Entre na sua conta</h2>
          <p className="auth-description">
            Use a sua conta ChatGPT autorizada para aceder ao painel financeiro
            da Clínica Mão de Esperança.
          </p>

          <a className="auth-submit" href={chatGPTSignInPath("/")}>
            <span aria-hidden="true">◆</span>
            Entrar com ChatGPT
          </a>

          <div className="auth-divider"><span>acesso institucional</span></div>

          <div className="auth-security-note">
            <span aria-hidden="true">i</span>
            <p>
              Apenas utilizadores autorizados conseguem consultar ou alterar
              informações financeiras.
            </p>
          </div>

          <p className="auth-help">
            Precisa de acesso? Contacte o administrador da clínica.
          </p>
        </div>
      </section>
    </main>
  );
}
