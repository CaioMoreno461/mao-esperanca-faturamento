"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { euroToCents, formatEuro } from "@/lib/finance";
import type { DashboardData, FinanceCase, LedgerEntry } from "@/lib/types";

type View = "overview" | "cases" | "agenda" | "cash" | "team" | "integrations";
type ModalType = "case" | "payment" | "expense" | "payout" | "professional" | "laboratory" | null;

const NAV_ITEMS: { id: View; label: string; shortLabel: string; icon: string }[] = [
  { id: "overview", label: "Visão geral", shortLabel: "Resumo", icon: "⌂" },
  { id: "cases", label: "Orçamentos", shortLabel: "Casos", icon: "▤" },
  { id: "agenda", label: "Agenda", shortLabel: "Agenda", icon: "◷" },
  { id: "cash", label: "Caixa", shortLabel: "Caixa", icon: "€" },
  { id: "team", label: "Equipa e laboratórios", shortLabel: "Equipa", icon: "◎" },
  { id: "integrations", label: "Integrações", shortLabel: "Mais", icon: "↻" },
];

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em tratamento",
  completed: "Concluído",
  pending: "Por confirmar",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

export default function FinanceApp() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<View>("overview");
  const [modal, setModal] = useState<ModalType>(null);
  const [search, setSearch] = useState("");
  const [caseStatus, setCaseStatus] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/finance", { cache: "no-store" });
      const payload = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os dados.");
      setError(null);
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runAction = useCallback(async (action: string, payload: Record<string, unknown>, successMessage: string) => {
    setSaving(true);
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const updated = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(updated.error ?? "Não foi possível guardar.");
      setData(updated);
      setModal(null);
      setToast(successMessage);
      return true;
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "Não foi possível guardar.");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const filteredCases = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLocaleLowerCase("pt-PT");
    return data.cases.filter((item) => {
      const matchesSearch = !query || `${item.patientName} ${item.title} ${item.professionalName}`.toLocaleLowerCase("pt-PT").includes(query);
      const matchesStatus = caseStatus === "all" || item.status === caseStatus;
      return matchesSearch && matchesStatus;
    });
  }, [caseStatus, data, search]);

  async function handleCsv(file: File) {
    try {
      const text = await file.text();
      const records = parseAppointmentCsv(text);
      if (!records.length) throw new Error("O CSV não contém agendamentos reconhecidos.");
      await runAction("importAppointments", { records }, `${records.length} agendamento(s) importado(s).`);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "Não foi possível importar o CSV.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) return <LoadingScreen />;
  if (!data || error) return <ErrorScreen message={error ?? "Dados indisponíveis."} onRetry={loadData} />;

  const activeNav = NAV_ITEMS.find((item) => item.id === view) ?? NAV_ITEMS[0];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <Brand />
        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
            <button className={`nav-item ${view === item.id ? "active" : ""}`} key={item.id} onClick={() => setView(item.id)} type="button">
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <button className="sync-card" type="button" onClick={() => setView("integrations")}>
          <span className="sync-dot warning" />
          <span><strong>MinhaAgenda</strong><small>Aguarda autorização</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <div className="profile-card">
          <span className="profile-avatar">CM</span>
          <span><strong>Gestão da clínica</strong><small>Acesso interno</small></span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><Brand compact /></div>
          <div><p className="eyebrow">Mão de Esperança · Quarteira</p><h1>{activeNav.label}</h1></div>
          <div className="topbar-actions">
            <div className="as-of"><span className="as-of-dot" /><span>Atualizado agora</span></div>
            <button className="icon-button" type="button" aria-label="Atualizar dados" onClick={() => void loadData()}>↻</button>
            <button className="primary-button" type="button" onClick={() => setModal("case")}><span aria-hidden="true">＋</span> Novo orçamento</button>
          </div>
        </header>

        {data.demoMode && (
          <div className="demo-banner" role="status">
            <span className="demo-icon">i</span>
            <span><strong>Ambiente inicial com dados fictícios.</strong> Pode explorar e registar informações; nenhuma pessoa apresentada é um paciente real.</span>
            <button type="button" onClick={() => setView("integrations")}>Ver integração</button>
          </div>
        )}

        <div className="page-content">
          {view === "overview" && <Overview data={data} onNewCase={() => setModal("case")} onViewCases={() => setView("cases")} />}
          {view === "cases" && <CasesView cases={filteredCases} search={search} status={caseStatus} onSearch={setSearch} onStatus={setCaseStatus} onNewCase={() => setModal("case")} onPayment={() => setModal("payment")} />}
          {view === "agenda" && <AgendaView data={data} onImport={() => fileInputRef.current?.click()} onNewCase={() => setModal("case")} />}
          {view === "cash" && <CashView data={data} onPayment={() => setModal("payment")} onExpense={() => setModal("expense")} onPayout={() => setModal("payout")} />}
          {view === "team" && <TeamView data={data} onProfessional={() => setModal("professional")} onLaboratory={() => setModal("laboratory")} onPayout={() => setModal("payout")} />}
          {view === "integrations" && <IntegrationsView data={data} onImport={() => fileInputRef.current?.click()} />}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegação móvel">
        {NAV_ITEMS.map((item) => (
          <button className={view === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setView(item.id)}><span aria-hidden="true">{item.icon}</span><small>{item.shortLabel}</small></button>
        ))}
      </nav>

      <input className="visually-hidden" ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleCsv(file); }} />
      {modal && <ActionModal type={modal} data={data} saving={saving} onClose={() => setModal(null)} onSubmit={runAction} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? "compact" : ""}`}><span className="brand-mark" aria-hidden="true"><span>＋</span></span><span className="brand-copy"><strong>Mão de Esperança</strong>{!compact && <small>Gestão financeira</small>}</span></div>;
}

function Overview({ data, onNewCase, onViewCases }: { data: DashboardData; onNewCase: () => void; onViewCases: () => void }) {
  const maxFlow = Math.max(...data.cashflow.flatMap((point) => [point.incomeCents, point.outflowCents]), 1);
  const openCases = data.cases.filter((item) => item.debtCents > 0);
  const totalObligations = data.metrics.professionalDueCents + data.metrics.laboratoryDueCents;
  const obligationMax = Math.max(data.metrics.professionalDueCents, data.metrics.laboratoryDueCents, 1);

  return (
    <>
      <section className="welcome-row">
        <div><p className="section-kicker">19 de agosto de 2026</p><h2>Bom dia, Caio.</h2><p>Este é o retrato financeiro da clínica com base nos valores efetivamente recebidos.</p></div>
        <button className="secondary-button mobile-hide" type="button" onClick={onNewCase}>＋ Registar novo caso</button>
      </section>

      <section className="metric-grid" aria-label="Indicadores financeiros">
        <MetricCard label="Total recebido" value={formatEuro(data.metrics.receivedCents)} detail="Valores pagos por pacientes" trend="Entradas confirmadas" tone="teal" icon="↙" />
        <MetricCard label="Parte da clínica" value={formatEuro(data.metrics.clinicShareCents)} detail="Após custos protéticos" trend="50% do valor distribuível" tone="navy" icon="M" />
        <MetricCard label="A pagar à equipa" value={formatEuro(data.metrics.professionalDueCents)} detail="Honorários ainda pendentes" trend={`${data.professionals.filter((item) => item.dueCents > 0).length} profissionais com saldo`} tone="amber" icon="◎" />
        <MetricCard label="A pagar a laboratórios" value={formatEuro(data.metrics.laboratoryDueCents)} detail="Trabalhos protéticos pendentes" trend={`${data.laboratories.filter((item) => item.dueCents > 0).length} laboratório(s)`} tone="violet" icon="◇" />
        <MetricCard label="Por receber" value={formatEuro(data.metrics.patientDebtCents)} detail="Saldo dos orçamentos" trend={`${openCases.length} caso(s) em dívida`} tone="rose" icon="!" />
      </section>

      <section className="dashboard-grid">
        <article className="panel cashflow-panel">
          <PanelHeader title="Fluxo de caixa" subtitle="Entradas e saídas registadas" action="Ver caixa" />
          <div className="chart-legend"><span><i className="legend-income" /> Entradas</span><span><i className="legend-outflow" /> Saídas</span></div>
          <div className="bar-chart" aria-label="Fluxo de caixa dos últimos seis meses">
            {data.cashflow.map((point) => (
              <div className="bar-group" key={point.month}><div className="bars"><span className="bar income" style={{ height: `${Math.max(4, (point.incomeCents / maxFlow) * 100)}%` }} title={`Entradas: ${formatEuro(point.incomeCents)}`} /><span className="bar outflow" style={{ height: `${Math.max(4, (point.outflowCents / maxFlow) * 100)}%` }} title={`Saídas: ${formatEuro(point.outflowCents)}`} /></div><small>{point.month}</small></div>
            ))}
          </div>
          <div className="chart-summary"><span><small>Saldo em caixa</small><strong>{formatEuro(data.metrics.cashBalanceCents)}</strong></span><span><small>Despesas gerais</small><strong>{formatEuro(data.metrics.expensesCents)}</strong></span></div>
        </article>

        <article className="panel obligations-panel">
          <PanelHeader title="Obrigações pendentes" subtitle="Valores já apurados" />
          <div className="obligation-total"><span>Total a liquidar</span><strong>{formatEuro(totalObligations)}</strong></div>
          <div className="obligation-row"><div><span className="soft-icon amber">◎</span><span><strong>Profissionais</strong><small>{data.professionals.filter((item) => item.dueCents > 0).length} com saldo pendente</small></span></div><strong>{formatEuro(data.metrics.professionalDueCents)}</strong><div className="progress-track"><span className="progress-fill amber" style={{ width: `${(data.metrics.professionalDueCents / obligationMax) * 100}%` }} /></div></div>
          <div className="obligation-row"><div><span className="soft-icon violet">◇</span><span><strong>Laboratórios</strong><small>{data.laboratories.reduce((sum, item) => sum + item.jobsCount, 0)} trabalhos registados</small></span></div><strong>{formatEuro(data.metrics.laboratoryDueCents)}</strong><div className="progress-track"><span className="progress-fill violet" style={{ width: `${(data.metrics.laboratoryDueCents / obligationMax) * 100}%` }} /></div></div>
          <div className="formula-note"><span>ƒ</span><p><strong>Regra aplicada</strong><br />(Recebido − protético) ÷ 2 para cada parte.</p></div>
        </article>
      </section>

      <section className="panel recent-panel"><PanelHeader title="Orçamentos e tratamentos recentes" subtitle="Acompanhamento de recebimentos e divisões" action="Ver todos" onAction={onViewCases} /><CasesTable cases={data.cases.slice(0, 5)} compact /></section>
    </>
  );
}

function MetricCard({ label, value, detail, trend, tone, icon }: { label: string; value: string; detail: string; trend: string; tone: string; icon: string }) {
  return <article className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong className="metric-value">{value}</strong><p>{detail}</p><small><span className="tiny-dot" /> {trend}</small></article>;
}

function PanelHeader({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="panel-header"><div><h3>{title}</h3><p>{subtitle}</p></div>{action && <button type="button" onClick={onAction}>{action} <span aria-hidden="true">›</span></button>}</div>;
}

function CasesView({ cases, search, status, onSearch, onStatus, onNewCase, onPayment }: { cases: FinanceCase[]; search: string; status: string; onSearch: (value: string) => void; onStatus: (value: string) => void; onNewCase: () => void; onPayment: () => void }) {
  return <section className="panel full-panel"><div className="list-toolbar"><div className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Pesquisar orçamentos" placeholder="Pesquisar paciente, tratamento ou profissional…" value={search} onChange={(event) => onSearch(event.target.value)} /></div><select aria-label="Filtrar por estado" value={status} onChange={(event) => onStatus(event.target.value)}><option value="all">Todos os estados</option><option value="open">Abertos</option><option value="in_progress">Em tratamento</option><option value="completed">Concluídos</option></select><button className="secondary-button" type="button" onClick={onPayment}>＋ Pagamento</button><button className="primary-button" type="button" onClick={onNewCase}>＋ Novo orçamento</button></div><CasesTable cases={cases} />{!cases.length && <EmptyState icon="⌕" title="Nenhum orçamento encontrado" body="Altere os filtros ou registe um novo caso." />}</section>;
}

function CasesTable({ cases, compact = false }: { cases: FinanceCase[]; compact?: boolean }) {
  return <div className={`table-wrap ${compact ? "compact" : ""}`}><table className="data-table"><thead><tr><th>Paciente / tratamento</th><th>Profissional</th><th>Orçamento</th><th>Recebido</th><th>Protético</th><th>Divisão 50/50</th><th>Em dívida</th><th>Estado</th></tr></thead><tbody>{cases.map((item) => <tr key={item.id}><td data-label="Paciente"><div className="patient-cell"><span className="patient-avatar">{initials(item.patientName)}</span><span><strong>{item.patientName}</strong><small>{item.title}</small></span></div></td><td data-label="Profissional"><div className="professional-cell"><i style={{ background: item.professionalColor }} /><span>{item.professionalName}</span></div></td><td data-label="Orçamento"><strong>{formatEuro(item.budgetTotalCents)}</strong></td><td data-label="Recebido"><span className="positive-money">{formatEuro(item.receivedCents)}</span></td><td data-label="Protético"><span>{item.labCostCents ? formatEuro(item.labCostCents) : "—"}</span>{item.laboratoryName && <small className="cell-note">{item.laboratoryName}</small>}</td><td data-label="Divisão"><div className="split-cell"><span><small>Clínica</small>{formatEuro(item.clinicShareCents)}</span><i /><span><small>Dentista</small>{formatEuro(item.professionalShareCents)}</span></div></td><td data-label="Em dívida"><strong className={item.debtCents > 0 ? "danger-money" : "muted-money"}>{item.debtCents > 0 ? formatEuro(item.debtCents) : "Liquidado"}</strong></td><td data-label="Estado"><StatusBadge status={item.status} />{item.coverageWarning && <small className="coverage-warning">Custo não coberto</small>}</td></tr>)}</tbody></table></div>;
}

function AgendaView({ data, onImport, onNewCase }: { data: DashboardData; onImport: () => void; onNewCase: () => void }) {
  const groups = groupAppointmentsByDay(data.appointments);
  return <div className="agenda-layout"><section className="panel agenda-panel"><div className="list-toolbar agenda-toolbar"><div><h2>Próximos atendimentos</h2><p>{data.appointments.length} compromissos no painel</p></div><div><button className="secondary-button" type="button" onClick={onImport}>⇧ Importar CSV</button><button className="primary-button" type="button" onClick={onNewCase}>＋ Criar orçamento</button></div></div><div className="agenda-days">{groups.map(([day, appointments]) => <div className="agenda-day" key={day}><div className="day-label"><strong>{formatDay(day)}</strong><small>{appointments.length} atendimento(s)</small></div><div className="appointment-list">{appointments.map((appointment) => <article className="appointment-card" key={appointment.id}><time>{formatTime(appointment.startsAt)}</time><span className="appointment-line" style={{ background: appointment.professionalColor ?? "#8aa29d" }} /><div className="appointment-main"><strong>{appointment.patientName}</strong><span>{appointment.service}</span><small>{appointment.professionalName ?? "Profissional por definir"}</small></div><div className="appointment-meta"><StatusBadge status={appointment.status} />{appointment.priceCents > 0 && <strong>{formatEuro(appointment.priceCents)}</strong>}</div></article>)}</div></div>)}</div></section><aside className="panel agenda-side"><PanelHeader title="Origem dos dados" subtitle="Sincronização da agenda" /><div className="integration-mini"><span className="integration-logo">M</span><div><strong>MinhaAgenda</strong><small>API oficial pendente</small></div><StatusBadge status="pending" /></div><p>Os registos demonstrativos e importados aparecem aqui. A sincronização automática será ativada somente após autorização do fornecedor.</p><button className="secondary-button full-width" type="button" onClick={onImport}>Importar agendamentos</button></aside></div>;
}

function CashView({ data, onPayment, onExpense, onPayout }: { data: DashboardData; onPayment: () => void; onExpense: () => void; onPayout: () => void }) {
  const [filter, setFilter] = useState("all");
  const entries = data.ledger.filter((entry) => filter === "all" || (filter === "in" ? entry.direction === "in" : entry.direction === "out"));
  return <><section className="cash-hero"><div><span>Saldo registado em caixa</span><strong>{formatEuro(data.metrics.cashBalanceCents)}</strong><small>Entradas − pagamentos − despesas</small></div><div className="cash-actions"><button type="button" className="light-button" onClick={onPayment}>↙ Nova entrada</button><button type="button" className="light-button" onClick={onPayout}>↗ Liquidar obrigação</button><button type="button" className="light-button" onClick={onExpense}>− Registar despesa</button></div></section><section className="metric-grid cash-metrics"><MetricCard label="Entradas" value={formatEuro(data.metrics.receivedCents)} detail="Recebimentos de pacientes" trend="Confirmadas" tone="teal" icon="↙" /><MetricCard label="Saídas gerais" value={formatEuro(data.metrics.expensesCents)} detail="Despesas operacionais" trend="Sem honorários e laboratórios" tone="rose" icon="↗" /><MetricCard label="Obrigações" value={formatEuro(data.metrics.professionalDueCents + data.metrics.laboratoryDueCents)} detail="Ainda por liquidar" trend="Não descontadas do caixa" tone="amber" icon="!" /></section><section className="panel full-panel"><div className="list-toolbar"><div><h2>Movimentos de caixa</h2><p>Histórico unificado e auditável</p></div><div className="segmented"><button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>Todos</button><button className={filter === "in" ? "active" : ""} type="button" onClick={() => setFilter("in")}>Entradas</button><button className={filter === "out" ? "active" : ""} type="button" onClick={() => setFilter("out")}>Saídas</button></div></div><LedgerTable entries={entries} /></section></>;
}

function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return <div className="ledger-list">{entries.map((entry) => <article className="ledger-row" key={entry.id}><span className={`ledger-icon ${entry.direction}`}>{entry.direction === "in" ? "↙" : "↗"}</span><div className="ledger-main"><strong>{entry.description}</strong><span>{entry.counterpart}</span></div><div className="ledger-meta"><strong className={entry.direction === "in" ? "positive-money" : "danger-money"}>{entry.direction === "in" ? "+" : "−"}{formatEuro(entry.amountCents)}</strong><span>{formatShortDate(entry.date)} · {entry.method}</span></div></article>)}</div>;
}

function TeamView({ data, onProfessional, onLaboratory, onPayout }: { data: DashboardData; onProfessional: () => void; onLaboratory: () => void; onPayout: () => void }) {
  return <div className="team-sections"><section className="panel team-panel"><div className="list-toolbar"><div><h2>Profissionais de medicina dentária</h2><p>Divisão padrão: 50% após o custo protético</p></div><button className="primary-button" type="button" onClick={onProfessional}>＋ Novo profissional</button></div><div className="card-list">{data.professionals.map((person) => <article className="entity-card" key={person.id}><span className="large-avatar" style={{ background: `${person.color}18`, color: person.color }}>{initials(person.name)}</span><div className="entity-main"><strong>{person.name}</strong><span>{person.specialty}</span><small><i className={person.active ? "online" : ""} /> {person.active ? "Ativo" : "Inativo"} · Comissão de {person.commissionBps / 100}%</small></div><div className="entity-finance"><span>Produzido</span><strong>{formatEuro(person.generatedCents)}</strong><small>A pagar: <b>{formatEuro(person.dueCents)}</b></small></div></article>)}</div></section><section className="panel team-panel"><div className="list-toolbar"><div><h2>Laboratórios de prótese</h2><p>Custos e trabalhos associados aos casos</p></div><button className="primary-button" type="button" onClick={onLaboratory}>＋ Novo laboratório</button></div><div className="card-list">{data.laboratories.map((lab) => <article className="entity-card" key={lab.id}><span className="large-avatar lab">◇</span><div className="entity-main"><strong>{lab.name}</strong><span>{lab.contactName ?? "Contacto por definir"}</span><small>{lab.phone ?? lab.email ?? "Sem contacto registado"}</small></div><div className="entity-finance"><span>{lab.jobsCount} trabalho(s)</span><strong>{formatEuro(lab.dueCents)}</strong><small>Saldo pendente</small></div></article>)}</div><button className="secondary-button full-width team-payout" type="button" onClick={onPayout}>Registar pagamento a profissional ou laboratório</button></section></div>;
}

function IntegrationsView({ data, onImport }: { data: DashboardData; onImport: () => void }) {
  return <div className="integration-layout"><section className="panel integration-hero-panel"><div className="integration-heading"><span className="integration-logo large">M</span><div><p className="section-kicker">Fornecedor da agenda</p><h2>MinhaAgenda</h2><span className="status-line"><i /> Autorização oficial necessária</span></div></div><p className="integration-lead">A estrutura de sincronização está preparada para receber pacientes, profissionais, serviços e agendamentos. O acesso automático permanece bloqueado até a MinhaAgenda fornecer autorização escrita, documentação e token próprios para integração.</p><div className="integration-steps"><div className="step done"><span>1</span><div><strong>Modelo de dados preparado</strong><small>Campos financeiros e agenda separados com segurança.</small></div></div><div className="step current"><span>2</span><div><strong>Solicitar acesso ao fornecedor</strong><small>Enviar o pedido de API para contato@minhaagendaapp.com.br.</small></div></div><div className="step"><span>3</span><div><strong>Configurar credenciais</strong><small>Guardar token apenas no servidor, nunca no navegador.</small></div></div><div className="step"><span>4</span><div><strong>Ativar sincronização</strong><small>Importação incremental, deduplicação e registo de auditoria.</small></div></div></div><div className="safe-notice"><span>✓</span><p><strong>Proteção da conta</strong><br />O sistema não faz scraping, não reutiliza a sua palavra-passe e não tenta descobrir endpoints privados.</p></div></section><aside className="integration-side-stack"><section className="panel import-panel"><span className="soft-icon teal">⇧</span><h3>Importação temporária por CSV</h3><p>Enquanto a API não é autorizada, pode importar agendamentos num formato controlado.</p><button className="primary-button full-width" type="button" onClick={onImport}>Escolher ficheiro CSV</button><a className="text-link" href="/modelo-importacao-agenda.csv" download>Descarregar modelo de importação</a><small>{data.integration.importedAppointments} registo(s) importado(s) nesta base.</small></section><section className="panel compact-info-panel"><h3>O que será sincronizado</h3><ul><li>Pacientes e contactos essenciais</li><li>Profissionais e serviços</li><li>Agendamentos, estados e valores</li><li>Identificadores para evitar duplicados</li></ul></section></aside></div>;
}

function ActionModal({ type, data, saving, onClose, onSubmit }: { type: Exclude<ModalType, null>; data: DashboardData; saving: boolean; onClose: () => void; onSubmit: (action: string, payload: Record<string, unknown>, message: string) => Promise<boolean> }) {
  const [hasLab, setHasLab] = useState(false);
  const [recipientType, setRecipientType] = useState("professional");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", listener);
    dialogRef.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>, action: string, moneyFields: string[], message: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(form.entries());
    for (const field of moneyFields) payload[`${field}Cents`] = euroToCents(payload[field]);
    await onSubmit(action, payload, message);
  }

  const titles: Record<Exclude<ModalType, null>, { title: string; subtitle: string }> = {
    case: { title: "Novo orçamento", subtitle: "Registe o tratamento, recebimento e eventual custo protético." },
    payment: { title: "Registar pagamento", subtitle: "O valor passa a contar na divisão financeira do caso." },
    expense: { title: "Registar despesa", subtitle: "Inclua uma saída operacional no caixa." },
    payout: { title: "Liquidar obrigação", subtitle: "Registe um pagamento a profissional ou laboratório." },
    professional: { title: "Novo profissional", subtitle: "Cadastre um profissional de medicina dentária." },
    laboratory: { title: "Novo laboratório", subtitle: "Cadastre um fornecedor de prótese dentária." },
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef}><div className="modal-header"><div><p className="section-kicker">Gestão financeira</p><h2 id="modal-title">{titles[type].title}</h2><p>{titles[type].subtitle}</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">×</button></div>
    {type === "case" && <form onSubmit={(event) => void submit(event, "createCase", ["budgetTotal", "received", "labCost"], "Orçamento criado com sucesso.")}><div className="form-section"><h3>Paciente e tratamento</h3><div className="form-grid"><Field label="Nome do paciente" name="patientName" required placeholder="Nome completo" /><Field label="Telefone" name="patientPhone" placeholder="+351 …" /><Field label="Tratamento" name="title" required placeholder="Ex.: prótese fixa" wide /><Select label="Profissional" name="professionalId" required options={data.professionals.map((item) => ({ value: item.id, label: item.name }))} /><Field label="Data prevista" name="dueDate" type="date" /></div></div><div className="form-section"><h3>Valores</h3><div className="form-grid"><Field label="Valor do orçamento (€)" name="budgetTotal" required inputMode="decimal" placeholder="0,00" /><Field label="Já recebido (€)" name="received" inputMode="decimal" placeholder="0,00" /><Select label="Método inicial" name="method" options={paymentMethods()} /><Field label="Data do recebimento" name="receivedAt" type="date" defaultValue={today()} /></div></div><label className="toggle-row"><input type="checkbox" checked={hasLab} onChange={(event) => setHasLab(event.target.checked)} /><span className="toggle-control" /><span><strong>Este caso tem trabalho protético</strong><small>O custo será retirado antes da divisão 50/50.</small></span></label>{hasLab && <div className="form-section lab-fields"><h3>Laboratório</h3><div className="form-grid"><Select label="Laboratório" name="laboratoryId" required options={data.laboratories.map((item) => ({ value: item.id, label: item.name }))} /><Field label="Custo protético (€)" name="labCost" required inputMode="decimal" placeholder="0,00" /><Field label="Descrição do trabalho" name="labDescription" placeholder="Ex.: estrutura em zircónia" wide /></div></div>}<ModalActions saving={saving} onClose={onClose} submitLabel="Criar orçamento" /></form>}
    {type === "payment" && <form onSubmit={(event) => void submit(event, "addPayment", ["amount"], "Pagamento registado com sucesso.")}><div className="form-grid single-section"><Select label="Orçamento / paciente" name="caseId" required options={data.cases.filter((item) => item.debtCents > 0).map((item) => ({ value: item.id, label: `${item.patientName} — ${item.title}` }))} wide /><Field label="Valor recebido (€)" name="amount" required inputMode="decimal" placeholder="0,00" /><Select label="Método" name="method" required options={paymentMethods()} /><Field label="Data" name="date" type="date" defaultValue={today()} /><Field label="Observação" name="note" placeholder="Opcional" /></div><ModalActions saving={saving} onClose={onClose} submitLabel="Registar entrada" /></form>}
    {type === "expense" && <form onSubmit={(event) => void submit(event, "addExpense", ["amount"], "Despesa registada com sucesso.")}><div className="form-grid single-section"><Field label="Descrição" name="description" required placeholder="Ex.: materiais clínicos" wide /><Select label="Categoria" name="category" required options={[{ value: "materiais", label: "Materiais" }, { value: "estrutura", label: "Renda e estrutura" }, { value: "marketing", label: "Marketing" }, { value: "serviços", label: "Serviços" }, { value: "outros", label: "Outros" }]} /><Field label="Valor (€)" name="amount" required inputMode="decimal" placeholder="0,00" /><Select label="Método" name="method" required options={paymentMethods()} /><Field label="Data" name="date" type="date" defaultValue={today()} /></div><ModalActions saving={saving} onClose={onClose} submitLabel="Registar despesa" /></form>}
    {type === "payout" && <form onSubmit={(event) => void submit(event, "recordPayout", ["amount"], "Pagamento de obrigação registado.")}><div className="form-grid single-section"><Select label="Tipo" name="recipientType" value={recipientType} onChange={setRecipientType} options={[{ value: "professional", label: "Profissional" }, { value: "laboratory", label: "Laboratório" }]} /><Select label="Destinatário" name="recipientId" required options={(recipientType === "professional" ? data.professionals : data.laboratories).map((item) => ({ value: item.id, label: `${item.name} — ${formatEuro(item.dueCents)} pendente` }))} /><Field label="Valor pago (€)" name="amount" required inputMode="decimal" placeholder="0,00" /><Select label="Método" name="method" required options={paymentMethods()} /><Field label="Data" name="date" type="date" defaultValue={today()} /><Field label="Observação" name="note" placeholder="Opcional" wide /></div><ModalActions saving={saving} onClose={onClose} submitLabel="Confirmar pagamento" /></form>}
    {type === "professional" && <form onSubmit={(event) => void submit(event, "createProfessional", [], "Profissional cadastrado com sucesso.")}><div className="form-grid single-section"><Field label="Nome" name="name" required placeholder="Nome profissional" wide /><Field label="Especialidade" name="specialty" required placeholder="Ex.: ortodontia" /><Field label="Cor de identificação" name="color" type="color" defaultValue="#16796f" /></div><div className="formula-note modal-note"><span>50%</span><p><strong>Regra da clínica</strong><br />O profissional recebe metade do valor distribuível após o custo protético.</p></div><ModalActions saving={saving} onClose={onClose} submitLabel="Cadastrar profissional" /></form>}
    {type === "laboratory" && <form onSubmit={(event) => void submit(event, "createLaboratory", [], "Laboratório cadastrado com sucesso.")}><div className="form-grid single-section"><Field label="Nome do laboratório" name="name" required placeholder="Razão ou nome comercial" wide /><Field label="Pessoa de contacto" name="contactName" placeholder="Opcional" /><Field label="Telefone" name="phone" placeholder="+351 …" /><Field label="E-mail" name="email" type="email" placeholder="laboratorio@…" wide /></div><ModalActions saving={saving} onClose={onClose} submitLabel="Cadastrar laboratório" /></form>}
  </div></div>;
}

function Field({ label, name, wide = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; wide?: boolean }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span><input name={name} {...props} /></label>;
}

function Select({ label, name, options, wide = false, value, onChange, ...props }: { label: string; name: string; options: { value: string | number; label: string }[]; wide?: boolean; value?: string; onChange?: (value: string) => void } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value">) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span><select name={name} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} {...props}><option value="">Selecione…</option>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
}

function ModalActions({ saving, onClose, submitLabel }: { saving: boolean; onClose: () => void; submitLabel: string }) {
  return <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "A guardar…" : submitLabel}</button></div>;
}

function StatusBadge({ status }: { status: string }) { return <span className={`status-badge ${status}`}><i />{STATUS_LABELS[status] ?? status}</span>; }
function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) { return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{body}</p></div>; }
function LoadingScreen() { return <div className="loading-screen"><span className="loading-mark">＋</span><strong>A preparar o painel financeiro</strong><div className="loading-line"><span /></div></div>; }
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="error-screen"><span>!</span><h1>Não foi possível abrir o painel</h1><p>{message}</p><button className="primary-button" type="button" onClick={onRetry}>Tentar novamente</button></div>; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function today() { return new Date().toISOString().slice(0, 10); }
function paymentMethods() { return [{ value: "multibanco", label: "Multibanco" }, { value: "transferência", label: "Transferência" }, { value: "cartão", label: "Cartão" }, { value: "numerário", label: "Numerário" }, { value: "mbway", label: "MB Way" }]; }
function formatShortDate(value: string) { const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(date).replace(".", ""); }
function formatTime(value: string) { return new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatDay(value: string) { const date = new Date(value); const label = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" }).format(date); return label.charAt(0).toUpperCase() + label.slice(1); }
function groupAppointmentsByDay(appointments: DashboardData["appointments"]) { const map = new Map<string, DashboardData["appointments"]>(); for (const appointment of appointments) { const day = appointment.startsAt.slice(0, 10); map.set(day, [...(map.get(day) ?? []), appointment]); } return [...map.entries()]; }
function normalizeHeader(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_"); }

function parseAppointmentCsv(text: string) {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  const value = (row: string[], aliases: string[]) => { const index = headers.findIndex((header) => aliases.includes(header)); return index >= 0 ? row[index]?.trim() ?? "" : ""; };
  return rows.slice(1).map((row) => ({ externalId: value(row, ["id_externo", "external_id", "id"]), patientName: value(row, ["paciente", "patient_name", "nome"]), patientPhone: value(row, ["telefone", "phone", "telemovel"]), patientEmail: value(row, ["email", "e_mail"]), service: value(row, ["servico", "service", "tratamento"]), startsAt: value(row, ["data_hora", "starts_at", "inicio"]), professionalName: value(row, ["profissional", "professional_name", "dentista"]), status: value(row, ["estado", "status"]) || "pending", priceCents: euroToCents(value(row, ["valor", "price", "preco"])) })).filter((record) => record.patientName && record.service && record.startsAt);
}

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]; const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if ((character === "," || character === ";") && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && next === "\n") index += 1; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
