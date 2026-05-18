import { eventBus, DomainEvent } from './EventBus'

/**
 * Handlers de eventos de domínio no BFF.
 *
 * Em produção, aqui você publicaria para Azure Service Bus,
 * RabbitMQ, ou Kafka. Por ora, usamos EventEmitter local
 * para demonstrar o padrão EDA sem dependência de broker externo.
 */

// ── Quando um agendamento é criado → dispara criação de notificação ───────────
eventBus.subscribe('agendamento.criado', async (event: DomainEvent<any>) => {
  console.log(`[EDA] ✅ agendamento.criado recebido → disparando notificação de confirmação`)
  console.log(`[EDA]    Beneficiário: ${event.payload.beneficiarioNome}`)
  console.log(`[EDA]    Data: ${event.payload.data} às ${event.payload.horario}`)
  // Em produção: await notificacaoService.create({ tipo: 'CONFIRMACAO', canal: 'EMAIL', ... })
})

// ── Quando confirmado → notifica por push ─────────────────────────────────────
eventBus.subscribe('agendamento.confirmado', (event: DomainEvent<any>) => {
  console.log(`[EDA] ✅ agendamento.confirmado → enviando lembrete push`)
  console.log(`[EDA]    ID: ${event.payload.id}`)
})

// ── Quando cancelado → notifica por SMS ──────────────────────────────────────
eventBus.subscribe('agendamento.cancelado', (event: DomainEvent<any>) => {
  console.log(`[EDA] ❌ agendamento.cancelado → notificando beneficiário via SMS`)
})

// ── Quando notificação falha → agenda reenvio ─────────────────────────────────
eventBus.subscribe('notificacao.falhou', (event: DomainEvent<any>) => {
  console.log(`[EDA] ⚠️  notificacao.falhou → agendando reenvio (id: ${event.payload.id})`)
})

// ── Logger global (todos os eventos) ─────────────────────────────────────────
eventBus.subscribe('*', (event: DomainEvent<any>) => {
  // Aqui poderia gravar em Azure Application Insights, Datadog, etc.
  void event // silencia linting
})

console.log('[EventBus] 🚀 Handlers de eventos registrados')
