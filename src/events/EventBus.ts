import { EventEmitter } from 'events'

// ── Tipos de eventos do domínio ───────────────────────────────────────────────
export type DomainEventType =
  | 'agendamento.criado'
  | 'agendamento.confirmado'
  | 'agendamento.cancelado'
  | 'notificacao.criada'
  | 'notificacao.enviada'
  | 'notificacao.falhou'

export interface DomainEvent<T = unknown> {
  type:      DomainEventType
  payload:   T
  source:    string
  timestamp: string
  eventId:   string
}

// ── Event Bus singleton ───────────────────────────────────────────────────────
class EventBus extends EventEmitter {
  private readonly history: DomainEvent[] = []

  publish<T>(event: DomainEvent<T>): void {
    this.history.push(event as DomainEvent)
    this.emit(event.type, event)
    this.emit('*', event)   // wildcard — útil para logging global
    console.log(`[EventBus] 📢 ${event.type} | source: ${event.source} | id: ${event.eventId}`)
  }

  subscribe<T>(eventType: DomainEventType | '*', handler: (event: DomainEvent<T>) => void): void {
    this.on(eventType, handler)
  }

  getHistory(filter?: DomainEventType): DomainEvent[] {
    if (!filter) return [...this.history]
    return this.history.filter(e => e.type === filter)
  }

  getStats() {
    const counts: Record<string, number> = {}
    for (const e of this.history) {
      counts[e.type] = (counts[e.type] ?? 0) + 1
    }
    return { total: this.history.length, byType: counts }
  }
}

export const eventBus = new EventBus()
eventBus.setMaxListeners(50)

// ── Factory de eventos ────────────────────────────────────────────────────────
export function createEvent<T>(
  type: DomainEventType,
  payload: T,
  source = 'bff'
): DomainEvent<T> {
  return {
    type,
    payload,
    source,
    timestamp: new Date().toISOString(),
    eventId:   `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  }
}
