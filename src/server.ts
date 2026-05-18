import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import axios from 'axios'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'
import { eventBus, createEvent } from './events/EventBus'
import './events/handlers'   // registra todos os handlers EDA

const app  = express()
const PORT = process.env.PORT ?? 3000

const MS_AGENDAMENTOS = process.env.MS_AGENDAMENTOS_URL ?? 'http://localhost:3001'
const MS_NOTIFICACOES = process.env.MS_NOTIFICACOES_URL ?? 'http://localhost:3002'
const AZURE_FUNCTION  = process.env.AZURE_FUNCTION_URL  ?? ''

app.use(cors())
app.use(express.json())

// ── Swagger ───────────────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BFF — Unimed Sistema de Agendamento',
      version: '1.0.0',
      description: 'Backend for Frontend com Event-Driven Architecture, API Gateway (Traefik) e agregação de microserviços',
    },
    servers: [{ url: `http://localhost:${PORT}`, description: 'Local' }],
    tags: [
      { name: 'Aggregator',    description: 'Endpoint de agregação obrigatório' },
      { name: 'Agendamentos',  description: 'Proxy → ms-agendamentos (MongoDB)' },
      { name: 'Notificações',  description: 'Proxy → ms-notificacoes (Azure SQL)' },
      { name: 'Eventos (EDA)', description: 'Event bus — histórico e estatísticas' },
    ],
  },
  apis: [__filename],
})
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'bff-unimed', gateway: 'traefik', timestamp: new Date() })
)

// ── GET /aggregated-data ──────────────────────────────────────────────────────
/**
 * @swagger
 * /aggregated-data:
 *   get:
 *     summary: Agrega dados de MS Agendamentos + MS Notificações + Azure Function
 *     tags: [Aggregator]
 *     responses:
 *       200:
 *         description: JSON unificado com todas as fontes
 */
app.get('/aggregated-data', async (_req: Request, res: Response) => {
  const results = await Promise.allSettled([
    axios.get(`${MS_AGENDAMENTOS}/agendamentos`),
    axios.get(`${MS_NOTIFICACOES}/notificacoes`),
    AZURE_FUNCTION
      ? axios.get(AZURE_FUNCTION)
      : Promise.resolve({ data: mockAzureStats() }),
  ])

  const agendamentos = results[0].status === 'fulfilled'
    ? results[0].value.data
    : { success: false, error: 'ms-agendamentos indisponível', data: [] }

  const notificacoes = results[1].status === 'fulfilled'
    ? results[1].value.data
    : { success: false, error: 'ms-notificacoes indisponível', data: [] }

  const estatisticas = results[2].status === 'fulfilled'
    ? results[2].value.data
    : { error: 'azure-function indisponível', ...mockAzureStats() }

  res.json({
    success: true,
    generatedAt: new Date().toISOString(),
    agendamentos,
    notificacoes,
    estatisticas,
  })
})

function mockAzureStats() {
  return {
    source: 'azure-function-mock',
    totalAgendamentos: 42, totalNotificacoes: 128,
    taxaConfirmacao: '78%', taxaEntregaNotif: '94%',
    agendamentosPorTipo:  { CONSULTA: 28, EXAME: 10, PROCEDIMENTO: 4 },
    notificacoesPorCanal: { EMAIL: 60, SMS: 48, PUSH: 20 },
    computedAt: new Date().toISOString(),
  }
}

// ── EDA: histórico de eventos ─────────────────────────────────────────────────
/**
 * @swagger
 * /events:
 *   get:
 *     summary: Histórico de eventos do Event Bus (EDA)
 *     tags: [Eventos (EDA)]
 *     responses:
 *       200:
 *         description: Histórico e estatísticas dos eventos publicados
 */
app.get('/events', (_req, res) => {
  res.json({
    success: true,
    stats:   eventBus.getStats(),
    history: eventBus.getHistory(),
  })
})

// ── PROXY: Agendamentos ───────────────────────────────────────────────────────
/**
 * @swagger
 * /agendamentos:
 *   get:
 *     summary: Proxy — Lista agendamentos
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDENTE, CONFIRMADO, CANCELADO, CONCLUIDO] }
 *       - in: query
 *         name: beneficiarioId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista de agendamentos }
 */
app.get('/agendamentos', async (req, res) => {
  try {
    const { data } = await axios.get(`${MS_AGENDAMENTOS}/agendamentos`, { params: req.query })
    res.json(data)
  } catch { res.status(502).json({ success: false, error: 'ms-agendamentos indisponível' }) }
})

app.get('/agendamentos/:id', async (req, res) => {
  try {
    const { data } = await axios.get(`${MS_AGENDAMENTOS}/agendamentos/${req.params.id}`)
    res.json(data)
  } catch (err: any) { res.status(404).json({ success: false, error: err.message }) }
})

/**
 * @swagger
 * /agendamentos:
 *   post:
 *     summary: Proxy — Cria agendamento e publica evento EDA
 *     tags: [Agendamentos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [beneficiarioId, beneficiarioNome, prestadorId, prestadorNome, especialidade, tipo, data, horario]
 *             properties:
 *               beneficiarioId:    { type: string }
 *               beneficiarioNome:  { type: string }
 *               prestadorId:       { type: string }
 *               prestadorNome:     { type: string }
 *               especialidade:     { type: string }
 *               tipo:              { type: string, enum: [CONSULTA, EXAME, PROCEDIMENTO] }
 *               data:              { type: string, format: date }
 *               horario:           { type: string, example: "09:00" }
 *               observacoes:       { type: string }
 *     responses:
 *       201: { description: Agendamento criado e evento publicado }
 */
app.post('/agendamentos', async (req, res) => {
  try {
    const { data } = await axios.post(`${MS_AGENDAMENTOS}/agendamentos`, req.body)
    // ── EDA: publica evento de domínio ────────────────────────────────────
    if (data.success) {
      eventBus.publish(createEvent('agendamento.criado', data.data, 'bff:POST /agendamentos'))
    }
    res.status(201).json(data)
  } catch (err: any) { res.status(400).json({ success: false, error: err.message }) }
})

/**
 * @swagger
 * /agendamentos/{id}:
 *   put:
 *     summary: Proxy — Atualiza agendamento e publica evento EDA
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [CONFIRMADO, CANCELADO] }
 *               observacoes: { type: string }
 *     responses:
 *       200: { description: Agendamento atualizado e evento publicado }
 */
app.put('/agendamentos/:id', async (req, res) => {
  try {
    const { data } = await axios.put(`${MS_AGENDAMENTOS}/agendamentos/${req.params.id}`, req.body)
    // ── EDA: publica evento conforme status ───────────────────────────────
    if (data.success && req.body.status) {
      const type = req.body.status === 'CONFIRMADO' ? 'agendamento.confirmado' : 'agendamento.cancelado'
      eventBus.publish(createEvent(type, data.data, `bff:PUT /agendamentos/${req.params.id}`))
    }
    res.json(data)
  } catch (err: any) { res.status(400).json({ success: false, error: err.message }) }
})

app.delete('/agendamentos/:id', async (req, res) => {
  try {
    await axios.delete(`${MS_AGENDAMENTOS}/agendamentos/${req.params.id}`)
    res.status(204).send()
  } catch (err: any) { res.status(404).json({ success: false, error: err.message }) }
})

// ── PROXY: Notificações ───────────────────────────────────────────────────────
/**
 * @swagger
 * /notificacoes:
 *   get:
 *     summary: Proxy — Lista notificações
 *     tags: [Notificações]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDENTE, ENVIADA, FALHOU, LIDA] }
 *       - in: query
 *         name: canal
 *         schema: { type: string, enum: [EMAIL, SMS, PUSH] }
 *     responses:
 *       200: { description: Lista de notificações }
 */
app.get('/notificacoes', async (req, res) => {
  try {
    const { data } = await axios.get(`${MS_NOTIFICACOES}/notificacoes`, { params: req.query })
    res.json(data)
  } catch { res.status(502).json({ success: false, error: 'ms-notificacoes indisponível' }) }
})

app.get('/notificacoes/:id', async (req, res) => {
  try {
    const { data } = await axios.get(`${MS_NOTIFICACOES}/notificacoes/${req.params.id}`)
    res.json(data)
  } catch (err: any) { res.status(404).json({ success: false, error: err.message }) }
})

/**
 * @swagger
 * /notificacoes:
 *   post:
 *     summary: Proxy — Cria notificação e publica evento EDA
 *     tags: [Notificações]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agendamentoId, beneficiarioId, beneficiarioNome, tipo, canal, mensagem]
 *             properties:
 *               agendamentoId:    { type: string }
 *               beneficiarioId:   { type: string }
 *               beneficiarioNome: { type: string }
 *               tipo:  { type: string, enum: [CONFIRMACAO, LEMBRETE, CANCELAMENTO, AUTORIZACAO] }
 *               canal: { type: string, enum: [EMAIL, SMS, PUSH] }
 *               mensagem: { type: string }
 *     responses:
 *       201: { description: Notificação criada }
 */
app.post('/notificacoes', async (req, res) => {
  try {
    const { data } = await axios.post(`${MS_NOTIFICACOES}/notificacoes`, req.body)
    if (data.success) {
      eventBus.publish(createEvent('notificacao.criada', data.data, 'bff:POST /notificacoes'))
    }
    res.status(201).json(data)
  } catch (err: any) { res.status(400).json({ success: false, error: err.message }) }
})

app.put('/notificacoes/:id', async (req, res) => {
  try {
    const { data } = await axios.put(`${MS_NOTIFICACOES}/notificacoes/${req.params.id}`, req.body)
    if (data.success && req.body.status === 'FALHOU') {
      eventBus.publish(createEvent('notificacao.falhou', data.data, `bff:PUT /notificacoes/${req.params.id}`))
    }
    if (data.success && req.body.status === 'ENVIADA') {
      eventBus.publish(createEvent('notificacao.enviada', data.data, `bff:PUT /notificacoes/${req.params.id}`))
    }
    res.json(data)
  } catch (err: any) { res.status(400).json({ success: false, error: err.message }) }
})

app.delete('/notificacoes/:id', async (req, res) => {
  try {
    await axios.delete(`${MS_NOTIFICACOES}/notificacoes/${req.params.id}`)
    res.status(204).send()
  } catch (err: any) { res.status(404).json({ success: false, error: err.message }) }
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 BFF rodando em http://localhost:${PORT}`)
  console.log(`📚 Swagger em http://localhost:${PORT}/docs`)
  console.log(`🔗 Aggregated Data: http://localhost:${PORT}/aggregated-data`)
  console.log(`📡 Event Bus: http://localhost:${PORT}/events`)
  console.log(`🌐 Via API Gateway (Traefik): http://localhost/api`)
})

export default app
