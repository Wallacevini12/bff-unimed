/**
 * Testes de Arquitetura — BFF (Backend for Frontend)
 * Usando ArchUnitTS (pacote: archunit)
 *
 * Valida a estrutura do BFF: separacao de responsabilidades,
 * Event-Driven Architecture e ausencia de ciclos.
 */
import { projectFiles, extendJestMatchers } from 'archunit'

extendJestMatchers()

describe('ArchUnitTS — Arquitetura BFF: Backend for Frontend', () => {

  it('[BFF-01] Events NAO devem ter dependencias circulares', async () => {
    const rule = projectFiles()
      .inFolder('**/events/**')
      .should()
      .haveNoCycles()
    await expect(rule).toPassAsync()
  })

  it('[BFF-02] Src NAO deve ter dependencias circulares', async () => {
    const rule = projectFiles()
      .inFolder('**/src/**')
      .should()
      .haveNoCycles()
    await expect(rule).toPassAsync()
  })

  it('[BFF-03] EventBus deve estar na pasta events', async () => {
    const rule = projectFiles()
      .withName('EventBus.ts')
      .should()
      .beInFolder('**/events/**')
    await expect(rule).toPassAsync()
  })

  it('[BFF-04] Handlers de eventos devem estar na pasta events', async () => {
    const rule = projectFiles()
      .withName('handlers.ts')
      .should()
      .beInFolder('**/events/**')
    await expect(rule).toPassAsync()
  })

  it('[BFF-05] Server principal deve estar na pasta src', async () => {
    const rule = projectFiles()
      .withName('server.ts')
      .should()
      .beInFolder('**/src/**')
    await expect(rule).toPassAsync()
  })

  it('[BFF-06] Events NAO devem depender do server.ts (inversao correta)', async () => {
    const rule = projectFiles()
      .inFolder('**/events/**')
      .shouldNot()
      .dependOnFiles()
      .withName('server.ts')
    await expect(rule).toPassAsync()
  })
})