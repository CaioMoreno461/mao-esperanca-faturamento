/**
 * Fronteira de integração com a MinhaAgenda.
 *
 * A plataforma não publica uma API autorizada e proíbe integrações não
 * homologadas. Este contrato mantém o restante da aplicação independente do
 * fornecedor. Só deve ser implementado quando a clínica receber documentação,
 * credenciais e autorização escrita da HighEnd Tecnologia.
 */
export type MinhaAgendaAppointment = {
  externalId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  service: string;
  startsAt: string;
  professionalName?: string;
  status: string;
  priceCents?: number;
};

export type MinhaAgendaConnector = {
  pullAppointments(since?: string): Promise<MinhaAgendaAppointment[]>;
};

export const minhaAgendaIntegration = {
  provider: "MinhaAgenda",
  status: "authorization_required" as const,
  publicApiAvailable: false,
  supportEmail: "contato@minhaagendaapp.com.br",
};
