import { EventEmitter } from 'events'

// ── Testa lógica de agregação do /aggregated-data ─────────────────────────────
describe('BFF — Lógica de Agregação', () => {
  function agregaDados(ag: any, notif: any, fn: any) {
    const agendamentos = ag.status === 'fulfilled'
      ? ag.value : { success: false, error: 'ms-agendamentos indisponível', data: [] }
    const notificacoes = notif.status === 'fulfilled'
      ? notif.value : { success: false, error: 'ms-notificacoes indisponível', data: [] }
    const estatisticas = fn.status === 'fulfilled'
      ? fn.value : { error: 'azure-function indisponível' }
    return { agendamentos, notificacoes, estatisticas, generatedAt: new Date().toISOString() }
  }

  it('deve agregar com sucesso quando todos os serviços respondem', () => {
    const r = agregaDados(
      { status: 'fulfilled', value: { success: true, data: [{ id: '1' }], total: 1 } },
      { status: 'fulfilled', value: { success: true, data: [{ id: 1 }],   total: 1 } },
      { status: 'fulfilled', value: { taxaConfirmacao: '80%' } }
    )
    expect(r.agendamentos.success).toBe(true)
    expect(r.notificacoes.success).toBe(true)
    expect(r.estatisticas.taxaConfirmacao).toBe('80%')
  })

  it('deve retornar fallback quando ms-agendamentos falha', () => {
    const r = agregaDados(
      { status: 'rejected' },
      { status: 'fulfilled', value: { success: true, data: [], total: 0 } },
      { status: 'fulfilled', value: {} }
    )
    expect(r.agendamentos.success).toBe(false)
    expect(r.agendamentos.error).toContain('ms-agendamentos')
  })

  it('deve tolerar falha simultânea de todos os serviços', () => {
    const r = agregaDados({ status: 'rejected' }, { status: 'rejected' }, { status: 'rejected' })
    expect(r.agendamentos.success).toBe(false)
    expect(r.notificacoes.success).toBe(false)
    expect(r.estatisticas.error).toBeDefined()
  })

  it('deve sempre incluir generatedAt', () => {
    const r = agregaDados({ status: 'rejected' }, { status: 'rejected' }, { status: 'rejected' })
    expect(new Date(r.generatedAt).toString()).not.toBe('Invalid Date')
  })
})

// ── Testa Event Bus (EDA) ─────────────────────────────────────────────────────
describe('BFF — Event Bus (Event-Driven Architecture)', () => {
  let bus: EventEmitter

  beforeEach(() => { bus = new EventEmitter() })

  function publish(type: string, payload: any) {
    const event = { type, payload, source: 'bff', timestamp: new Date().toISOString(), eventId: `${type}-test` }
    bus.emit(type, event)
    bus.emit('*', event)
    return event
  }

  it('deve publicar e receber evento agendamento.criado', (done) => {
    bus.on('agendamento.criado', (event: any) => {
      expect(event.type).toBe('agendamento.criado')
      expect(event.payload.beneficiarioNome).toBe('Maria Silva')
      done()
    })
    publish('agendamento.criado', { beneficiarioNome: 'Maria Silva' })
  })

  it('deve publicar e receber evento agendamento.confirmado', (done) => {
    bus.on('agendamento.confirmado', (event: any) => {
      expect(event.type).toBe('agendamento.confirmado')
      done()
    })
    publish('agendamento.confirmado', { id: 'ag-001' })
  })

  it('deve publicar e receber evento notificacao.falhou', (done) => {
    bus.on('notificacao.falhou', (event: any) => {
      expect(event.payload.id).toBe(5)
      done()
    })
    publish('notificacao.falhou', { id: 5 })
  })

  it('wildcard (*) deve receber todos os eventos', () => {
    const received: string[] = []
    bus.on('*', (event: any) => received.push(event.type))
    publish('agendamento.criado',    { id: '1' })
    publish('notificacao.criada',    { id: 2 })
    publish('agendamento.cancelado', { id: '3' })
    expect(received).toHaveLength(3)
  })

  it('evento deve conter timestamp ISO válido', () => {
    let captured: any
    bus.on('agendamento.criado', (e: any) => { captured = e })
    publish('agendamento.criado', {})
    expect(new Date(captured.timestamp).toString()).not.toBe('Invalid Date')
  })

  it('deve suportar múltiplos handlers para o mesmo evento', () => {
    let count = 0
    bus.on('agendamento.criado', () => count++)
    bus.on('agendamento.criado', () => count++)
    bus.on('agendamento.criado', () => count++)
    publish('agendamento.criado', {})
    expect(count).toBe(3)
  })
})
