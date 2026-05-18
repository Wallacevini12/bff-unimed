# BFF — Backend for Frontend | Unimed

> Camada de agregação e proxy entre o Microfrontend e os microserviços  
> **Stack:** Node.js · TypeScript · Express · Axios

**Equipe:** Gabriel Girotto | Giovani Tortatto | Lucas Cunha | Matheus Garozi | Wallace Vinicius

---

## Responsabilidades

- **Agregar dados** de múltiplas fontes em um único response (`GET /aggregated-data`)
- **Proxy de CRUD** para ms-agendamentos e ms-notificacoes
- **Resiliência** — retorna fallback parcial se um microserviço estiver indisponível
- **Documentação** via Swagger UI

---

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/aggregated-data` | **Agrega** MS Agendamentos + MS Notificações + Azure Function |
| GET | `/agendamentos` | Proxy → ms-agendamentos |
| POST | `/agendamentos` | Proxy → ms-agendamentos |
| PUT | `/agendamentos/:id` | Proxy → ms-agendamentos |
| DELETE | `/agendamentos/:id` | Proxy → ms-agendamentos |
| GET | `/notificacoes` | Proxy → ms-notificacoes |
| POST | `/notificacoes` | Proxy → ms-notificacoes |
| PUT | `/notificacoes/:id` | Proxy → ms-notificacoes |
| DELETE | `/notificacoes/:id` | Proxy → ms-notificacoes |
| GET | `/docs` | Swagger UI |
| GET | `/health` | Health check |

---

## Como rodar localmente

```bash
cp .env.example .env
npm install
npm run dev
```

Os microserviços precisam estar rodando nas portas 3001 e 3002.

### Acessar

| URL | Descrição |
|-----|-----------|
| http://localhost:3000/aggregated-data | Endpoint principal de agregação |
| http://localhost:3000/docs | Swagger UI |

---

## Response do /aggregated-data

```json
{
  "success": true,
  "generatedAt": "2026-05-10T09:00:00.000Z",
  "agendamentos": {
    "success": true,
    "data": [...],
    "total": 42
  },
  "notificacoes": {
    "success": true,
    "data": [...],
    "total": 128
  },
  "estatisticas": {
    "source": "azure-function:unimed-stats",
    "totalAgendamentos": 42,
    "taxaConfirmacao": "78%",
    "taxaEntregaNotif": "94%",
    "agendamentosPorTipo": { "CONSULTA": 28, "EXAME": 10, "PROCEDIMENTO": 4 }
  }
}
```

---

## Docker

```bash
docker build -t dockerhubuser/pjbl/bff:v1 .
docker push dockerhubuser/pjbl/bff:v1
```
