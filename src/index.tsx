import { Hono } from 'hono'
import { ControlPlane } from './application/control-plane'
import { D1Repository } from './adapters/d1-repository'
import { createApp } from './http/app'

type Bindings = {
  DB: D1Database
  CONTROL_PLANE_TOKEN: string
  OWNER_ID?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.route('/', new Hono<{ Bindings: Bindings }>().all('*', async (c) => {
  const ownerId = c.env.OWNER_ID ?? 'owner_halstral'
  const api = createApp(new ControlPlane(new D1Repository(c.env.DB), ownerId), c.env.CONTROL_PLANE_TOKEN, ownerId)
  return api.fetch(c.req.raw)
}))

export default app
