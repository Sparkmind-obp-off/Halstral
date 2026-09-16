import { Hono } from 'hono'
import { ControlPlane } from './application/control-plane'
import { D1Repository } from './adapters/d1-repository'
import { InternalExecutionAdapter } from './adapters/internal-execution-adapter'
import { OrchestrationEngine } from './application/orchestration-engine'
import { LearningEngine } from './application/learning-engine'
import { AdapterRegistry } from './ports/execution-adapter'
import { createApp } from './http/app'

type Bindings = {
  DB: D1Database
  CONTROL_PLANE_TOKEN: string
  OWNER_ID?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.route('/', new Hono<{ Bindings: Bindings }>().all('*', async (c) => {
  const ownerId = c.env.OWNER_ID ?? 'owner_halstral'
  const repository = new D1Repository(c.env.DB)
  const adapters = new AdapterRegistry()
  adapters.register(new InternalExecutionAdapter())
  const orchestration = new OrchestrationEngine(repository, adapters, ownerId)
  const learning = new LearningEngine(repository, ownerId, orchestration.getSafetyController())
  const api = createApp(new ControlPlane(repository, ownerId), c.env.CONTROL_PLANE_TOKEN, ownerId, orchestration, learning)
  return api.fetch(c.req.raw)
}))

export default app
