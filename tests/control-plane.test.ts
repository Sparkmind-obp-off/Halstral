import { beforeEach, describe, expect, it } from 'vitest'
import { ControlPlane } from '../src/application/control-plane'
import { MemoryRepository } from '../src/adapters/memory-repository'
import type { Actor } from '../src/domain/models'
import { createApp } from '../src/http/app'

const owner: Actor = { id: 'owner_halstral', type: 'OWNER' }
const meroviaActor: Actor = { id: 'ws_merovia', type: 'WORKSPACE' }
const sparkActor: Actor = { id: 'ws_sparkmind', type: 'WORKSPACE' }

const workspaceInput = (id: string, slug: string, name = slug) => ({ id, slug, name, ownerId: owner.id, environment: 'test' })

let repo: MemoryRepository
let control: ControlPlane

beforeEach(() => {
  repo = new MemoryRepository()
  control = new ControlPlane(repo)
})

async function seedWorkspaces() {
  await control.createWorkspace(workspaceInput('ws_merovia', 'merovia', 'Merovia'), owner)
  await control.createWorkspace(workspaceInput('ws_sparkmind', 'sparkmind', 'SparkMind'), owner)
}

async function allow(subject: string, workspaceId: string, resource: string, action: string) {
  return control.createPolicy({
    workspaceId,
    name: `Allow ${subject} ${action}`,
    subject,
    resource,
    action,
    scope: workspaceId,
    effect: 'ALLOW',
  }, owner)
}

describe('workspace registry', () => {
  it('creates, lists, gets, and updates a workspace with audits', async () => {
    const created = await control.createWorkspace(workspaceInput('ws_merovia', 'merovia', 'Merovia'), owner)
    expect(created.status).toBe('ACTIVE')
    expect(await control.getWorkspace(created.id, owner)).toMatchObject({ slug: 'merovia' })
    expect(await control.listWorkspaces(owner)).toHaveLength(1)
    expect(await control.updateWorkspace(created.id, { description: 'Independent workspace' }, owner)).toMatchObject({ description: 'Independent workspace' })
    expect((await repo.listEvents()).map((event) => event.type)).toEqual(expect.arrayContaining(['WORKSPACE_CREATED', 'WORKSPACE_UPDATED']))
  })

  it('suspends and archives workspaces', async () => {
    await seedWorkspaces()
    expect((await control.suspendWorkspace('ws_merovia', owner)).status).toBe('SUSPENDED')
    expect((await control.archiveWorkspace('ws_sparkmind', owner)).status).toBe('ARCHIVED')
  })

  it('rejects duplicate workspace slugs', async () => {
    await control.createWorkspace(workspaceInput('ws_one', 'same'), owner)
    await expect(control.createWorkspace(workspaceInput('ws_two', 'same'), owner)).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('authorization and isolation', () => {
  beforeEach(seedWorkspaces)

  it('defaults to deny when no policy matches and audits the decision', async () => {
    await expect(control.getWorkspace('ws_sparkmind', meroviaActor)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const events = await repo.listEvents()
    expect(events.some((event) => event.type === 'AUTHORIZATION_DENIED' && event.metadata.reason === 'DEFAULT_DENY')).toBe(true)
  })

  it('rejects unauthorized cross-workspace access', async () => {
    await allow(meroviaActor.id, 'ws_merovia', 'workspace:ws_merovia', 'read')
    await expect(control.getWorkspace('ws_sparkmind', meroviaActor)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await control.getWorkspace('ws_merovia', meroviaActor)).toMatchObject({ id: 'ws_merovia' })
  })

  it('permits explicitly authorized cross-workspace access', async () => {
    await allow(meroviaActor.id, 'ws_sparkmind', 'workspace:ws_sparkmind', 'read')
    expect(await control.getWorkspace('ws_sparkmind', meroviaActor)).toMatchObject({ name: 'SparkMind' })
  })

  it('gives explicit DENY precedence over ALLOW', async () => {
    await allow(meroviaActor.id, 'ws_sparkmind', 'workspace:ws_sparkmind', 'read')
    await control.createPolicy({ workspaceId: 'ws_sparkmind', name: 'Deny cross read', subject: meroviaActor.id, resource: 'workspace:ws_sparkmind', action: 'read', scope: 'ws_sparkmind', effect: 'DENY' }, owner)
    await expect(control.getWorkspace('ws_sparkmind', meroviaActor)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('capability and policy registries', () => {
  beforeEach(seedWorkspaces)

  it('creates and disables capabilities', async () => {
    const capability = await control.createCapability({ id: 'cap_research', name: 'research.web', ownerScope: 'WORKSPACE', workspaceId: 'ws_merovia', riskLevel: 'LOW', inputSchema: {}, outputSchema: {} }, owner)
    expect(capability.status).toBe('ACTIVE')
    expect((await control.disableCapability(capability.id, owner)).status).toBe('DISABLED')
    expect((await repo.listEvents()).some((event) => event.type === 'CAPABILITY_DISABLED')).toBe(true)
  })

  it('creates explicit allow and deny policies', async () => {
    const allowed = await allow(meroviaActor.id, 'ws_merovia', 'task:*', 'create')
    const denied = await control.createPolicy({ workspaceId: 'ws_merovia', name: 'Deny dangerous', subject: meroviaActor.id, resource: 'capability:danger', action: 'use', scope: 'ws_merovia', effect: 'DENY' }, owner)
    expect(allowed.effect).toBe('ALLOW')
    expect(denied.effect).toBe('DENY')
  })

  it('rejects new authorization for a disabled capability', async () => {
    const capability = await control.createCapability({ id: 'cap_disabled', name: 'github.write', ownerScope: 'WORKSPACE', workspaceId: 'ws_merovia', riskLevel: 'HIGH', inputSchema: {}, outputSchema: {} }, owner)
    await control.disableCapability(capability.id, owner)
    await expect(control.createTask({ workspaceId: 'ws_merovia', title: 'Cannot use disabled', capabilityId: capability.id }, owner)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('task and run registries', () => {
  beforeEach(seedWorkspaces)

  it('creates a task and enforces valid task lifecycle transitions', async () => {
    const task = await control.createTask({ id: 'task_1', workspaceId: 'ws_merovia', title: 'Research competitor' }, owner)
    expect(task.status).toBe('PENDING')
    expect((await control.updateTask(task.id, { status: 'CLASSIFIED' }, owner)).status).toBe('CLASSIFIED')
    await expect(control.updateTask(task.id, { status: 'COMPLETED' }, owner)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('registers a run and enforces its lifecycle', async () => {
    const task = await control.createTask({ id: 'task_1', workspaceId: 'ws_merovia', title: 'Internal work' }, owner)
    const run = await control.createRun({ id: 'run_1', taskId: task.id }, owner)
    expect(run.status).toBe('CREATED')
    expect((await control.updateRun(run.id, 'RUNNING', owner)).status).toBe('RUNNING')
    expect((await control.updateRun(run.id, 'COMPLETED', owner)).status).toBe('COMPLETED')
    await expect(control.updateRun(run.id, 'RUNNING', owner)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects execution for a suspended workspace', async () => {
    const task = await control.createTask({ id: 'task_1', workspaceId: 'ws_merovia', title: 'Internal work' }, owner)
    await control.suspendWorkspace('ws_merovia', owner)
    await expect(control.createRun({ taskId: task.id }, owner)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a new task for an archived workspace', async () => {
    await control.archiveWorkspace('ws_merovia', owner)
    await expect(control.createTask({ workspaceId: 'ws_merovia', title: 'Too late' }, owner)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('audit and secret protection', () => {
  it('generates structured audit events for protected mutations and decisions', async () => {
    await seedWorkspaces()
    await expect(control.getWorkspace('ws_sparkmind', meroviaActor)).rejects.toBeTruthy()
    const events = await repo.listEvents()
    expect(events.every((event) => event.id && event.actor.id && event.resourceType && event.resourceId && event.timestamp)).toBe(true)
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(['WORKSPACE_CREATED', 'AUTHORIZATION_GRANTED', 'AUTHORIZATION_DENIED']))
  })

  it('does not expose normal audit mutation methods and prevents duplicate append', async () => {
    await control.createWorkspace(workspaceInput('ws_merovia', 'merovia'), owner)
    const event = (await repo.listEvents())[0]
    expect('saveEvent' in repo).toBe(false)
    await expect(repo.appendEvent(event)).rejects.toThrow('immutable')
  })

  it('rejects plaintext secrets while accepting scoped secret references', async () => {
    await control.createWorkspace(workspaceInput('ws_merovia', 'merovia'), owner)
    await expect(control.createTask({ workspaceId: 'ws_merovia', title: 'Unsafe', apiKey: 'plain-secret' }, owner)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    const task = await control.createTask({ workspaceId: 'ws_merovia', title: 'Safe', credentialRef: 'secret://workspace/merovia/github' }, owner)
    expect(task.credentialRef).toBe('secret://workspace/merovia/github')
    expect(JSON.stringify(await repo.listEvents())).not.toContain('plain-secret')
  })
})

describe('HTTP control plane', () => {
  it('requires authentication and implements the workspace route contract', async () => {
    const app = createApp(control, 'test-control-token')
    expect((await app.request('/workspaces')).status).toBe(401)
    const response = await app.request('/workspaces', {
      method: 'POST',
      headers: { authorization: 'Bearer test-control-token', 'content-type': 'application/json' },
      body: JSON.stringify(workspaceInput('ws_merovia', 'merovia')),
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ id: 'ws_merovia', status: 'ACTIVE' })
  })

  it('uses workspace actor policy evaluation over HTTP', async () => {
    await seedWorkspaces()
    const app = createApp(control, 'test-control-token')
    const denied = await app.request('/workspaces/ws_sparkmind', { headers: { authorization: 'Bearer test-control-token', 'x-actor-type': 'WORKSPACE', 'x-actor-id': sparkActor.id } })
    expect(denied.status).toBe(403)
    await allow(sparkActor.id, 'ws_sparkmind', 'workspace:ws_sparkmind', 'read')
    const allowedResponse = await app.request('/workspaces/ws_sparkmind', { headers: { authorization: 'Bearer test-control-token', 'x-actor-type': 'WORKSPACE', 'x-actor-id': sparkActor.id } })
    expect(allowedResponse.status).toBe(200)
  })
})
