import { Hono } from 'hono'
import type { Actor } from '../domain/models'
import { DomainError } from '../domain/errors'
import { ControlPlane } from '../application/control-plane'

const equalSecret = async (left: string, right: string) => {
  const encode = new TextEncoder()
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', encode.encode(left)), crypto.subtle.digest('SHA-256', encode.encode(right))])
  const aa = new Uint8Array(a); const bb = new Uint8Array(b); let diff = aa.length ^ bb.length
  for (let index = 0; index < Math.max(aa.length, bb.length); index++) diff |= (aa[index] ?? 0) ^ (bb[index] ?? 0)
  return diff === 0
}

const body = async (c: { req: { json: () => Promise<unknown> } }) => {
  try { const value = await c.req.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value as Record<string, unknown> }
  catch { throw new DomainError('INVALID_JSON', 'Request body must be a JSON object', 400) }
}

export function createApp(controlPlane: ControlPlane, controlToken: string, ownerId = 'owner_halstral') {
  const app = new Hono<{ Variables: { actor: Actor } }>()

  app.get('/', (c) => c.json({ name: 'HALSTRAL', role: 'Private Business Orchestration Core', phase: 1, autonomousExecution: false }))
  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.use('*', async (c, next) => {
    if (c.req.path === '/' || c.req.path === '/health') return next()
    const bearer = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    if (!controlToken || !await equalSecret(bearer, controlToken)) return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Valid control-plane bearer token required' } }, 401)
    const type = c.req.header('x-actor-type') === 'WORKSPACE' ? 'WORKSPACE' : 'OWNER'
    const id = c.req.header('x-actor-id') ?? (type === 'OWNER' ? ownerId : '')
    if (!id || (type === 'OWNER' && id !== ownerId)) return c.json({ error: { code: 'INVALID_ACTOR', message: 'Actor identity is invalid' } }, 401)
    c.set('actor', { id, type }); await next()
  })

  app.get('/workspaces', async (c) => c.json(await controlPlane.listWorkspaces(c.get('actor'))))
  app.post('/workspaces', async (c) => c.json(await controlPlane.createWorkspace(await body(c), c.get('actor')), 201))
  app.get('/workspaces/:id', async (c) => c.json(await controlPlane.getWorkspace(c.req.param('id'), c.get('actor'))))
  app.patch('/workspaces/:id', async (c) => c.json(await controlPlane.updateWorkspace(c.req.param('id'), await body(c), c.get('actor'))))
  app.post('/workspaces/:id/suspend', async (c) => c.json(await controlPlane.suspendWorkspace(c.req.param('id'), c.get('actor'))))
  app.post('/workspaces/:id/archive', async (c) => c.json(await controlPlane.archiveWorkspace(c.req.param('id'), c.get('actor'))))

  app.get('/capabilities', async (c) => c.json(await controlPlane.listCapabilities(c.get('actor'))))
  app.post('/capabilities', async (c) => c.json(await controlPlane.createCapability(await body(c), c.get('actor')), 201))
  app.get('/capabilities/:id', async (c) => c.json(await controlPlane.getCapability(c.req.param('id'), c.get('actor'))))
  app.patch('/capabilities/:id', async (c) => c.json(await controlPlane.updateCapability(c.req.param('id'), await body(c), c.get('actor'))))
  app.post('/capabilities/:id/disable', async (c) => c.json(await controlPlane.disableCapability(c.req.param('id'), c.get('actor'))))

  app.get('/policies', async (c) => c.json(await controlPlane.listPolicies(c.get('actor'))))
  app.post('/policies', async (c) => c.json(await controlPlane.createPolicy(await body(c), c.get('actor')), 201))
  app.get('/policies/:id', async (c) => c.json(await controlPlane.getPolicy(c.req.param('id'), c.get('actor'))))
  app.patch('/policies/:id', async (c) => c.json(await controlPlane.updatePolicy(c.req.param('id'), await body(c), c.get('actor'))))

  app.get('/tasks', async (c) => c.json(await controlPlane.listTasks(c.get('actor'))))
  app.post('/tasks', async (c) => c.json(await controlPlane.createTask(await body(c), c.get('actor')), 201))
  app.get('/tasks/:id', async (c) => c.json(await controlPlane.getTask(c.req.param('id'), c.get('actor'))))
  app.patch('/tasks/:id', async (c) => c.json(await controlPlane.updateTask(c.req.param('id'), await body(c), c.get('actor'))))
  app.post('/tasks/:id/cancel', async (c) => c.json(await controlPlane.cancelTask(c.req.param('id'), c.get('actor'))))

  app.get('/runs', async (c) => c.json(await controlPlane.listRuns(c.get('actor'))))
  app.post('/runs', async (c) => c.json(await controlPlane.createRun(await body(c), c.get('actor')), 201))
  app.get('/runs/:id', async (c) => c.json(await controlPlane.getRun(c.req.param('id'), c.get('actor'))))
  app.patch('/runs/:id', async (c) => { const input = await body(c); return c.json(await controlPlane.updateRun(c.req.param('id'), input.status, c.get('actor'), input.error)) })

  app.get('/events', async (c) => c.json(await controlPlane.listEvents(c.get('actor'))))
  app.get('/events/:id', async (c) => c.json(await controlPlane.getEvent(c.req.param('id'), c.get('actor'))))

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))
  app.onError((error, c) => {
    if (error instanceof DomainError) return c.json({ error: { code: error.code, message: error.message } }, error.status as 400)
    console.error('Unhandled request error', { name: error.name, message: error.message })
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
  })

  return app
}
