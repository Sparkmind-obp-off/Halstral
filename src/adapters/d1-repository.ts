import type { AuditEvent, Capability, Policy, Run, Task, Workspace } from '../domain/models'
import type { Repository } from '../ports/repository'

type Row = Record<string, unknown>
const json = (value: unknown) => JSON.stringify(value)
const parse = <T>(value: unknown): T => JSON.parse(String(value)) as T

const workspace = (r: Row): Workspace => ({ id: String(r.id), slug: String(r.slug), name: String(r.name), description: String(r.description), status: r.status as Workspace['status'], ownerId: String(r.owner_id), environment: String(r.environment), createdAt: String(r.created_at), updatedAt: String(r.updated_at) })
const capability = (r: Row): Capability => ({ id: String(r.id), name: String(r.name), description: String(r.description), ownerScope: r.owner_scope as Capability['ownerScope'], workspaceId: r.workspace_id ? String(r.workspace_id) : null, riskLevel: r.risk_level as Capability['riskLevel'], inputSchema: parse(r.input_schema), outputSchema: parse(r.output_schema), status: r.status as Capability['status'], createdAt: String(r.created_at), updatedAt: String(r.updated_at) })
const policy = (r: Row): Policy => ({ id: String(r.id), name: String(r.name), workspaceId: String(r.workspace_id), subject: String(r.subject), resource: String(r.resource), action: String(r.action), scope: String(r.scope), effect: r.effect as Policy['effect'], approvalRequired: Boolean(r.approval_required), status: r.status as Policy['status'], createdAt: String(r.created_at), updatedAt: String(r.updated_at) })
const task = (r: Row): Task => ({ id: String(r.id), workspaceId: String(r.workspace_id), title: String(r.title), description: String(r.description), status: r.status as Task['status'], capabilityId: r.capability_id ? String(r.capability_id) : null, credentialRef: r.credential_ref ? String(r.credential_ref) : null, createdAt: String(r.created_at), updatedAt: String(r.updated_at) })
const run = (r: Row): Run => ({ id: String(r.id), taskId: String(r.task_id), workspaceId: String(r.workspace_id), status: r.status as Run['status'], startedAt: r.started_at ? String(r.started_at) : null, completedAt: r.completed_at ? String(r.completed_at) : null, error: r.error ? String(r.error) : null, createdAt: String(r.created_at), updatedAt: String(r.updated_at) })
const event = (r: Row): AuditEvent => ({ id: String(r.id), type: r.type as AuditEvent['type'], actor: parse(r.actor), workspaceId: r.workspace_id ? String(r.workspace_id) : null, resourceType: String(r.resource_type), resourceId: String(r.resource_id), timestamp: String(r.timestamp), metadata: parse(r.metadata) })

export class D1Repository implements Repository {
  constructor(private readonly db: D1Database) {}
  private async one<T>(sql: string, id: string, map: (r: Row) => T): Promise<T | null> { const row = await this.db.prepare(sql).bind(id).first<Row>(); return row ? map(row) : null }
  private async many<T>(sql: string, map: (r: Row) => T): Promise<T[]> { const result = await this.db.prepare(sql).all<Row>(); return result.results.map(map) }

  async createWorkspace(v: Workspace) { await this.db.prepare('INSERT INTO workspaces (id,slug,name,description,status,owner_id,environment,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(v.id,v.slug,v.name,v.description,v.status,v.ownerId,v.environment,v.createdAt,v.updatedAt).run() }
  getWorkspace(id: string) { return this.one('SELECT * FROM workspaces WHERE id=?', id, workspace) }
  listWorkspaces() { return this.many('SELECT * FROM workspaces ORDER BY created_at', workspace) }
  async saveWorkspace(v: Workspace) { await this.db.prepare('UPDATE workspaces SET slug=?,name=?,description=?,status=?,environment=?,updated_at=? WHERE id=?').bind(v.slug,v.name,v.description,v.status,v.environment,v.updatedAt,v.id).run() }

  async createCapability(v: Capability) { await this.db.prepare('INSERT INTO capabilities (id,name,description,owner_scope,workspace_id,risk_level,input_schema,output_schema,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(v.id,v.name,v.description,v.ownerScope,v.workspaceId,v.riskLevel,json(v.inputSchema),json(v.outputSchema),v.status,v.createdAt,v.updatedAt).run() }
  getCapability(id: string) { return this.one('SELECT * FROM capabilities WHERE id=?', id, capability) }
  listCapabilities() { return this.many('SELECT * FROM capabilities ORDER BY created_at', capability) }
  async saveCapability(v: Capability) { await this.db.prepare('UPDATE capabilities SET name=?,description=?,risk_level=?,input_schema=?,output_schema=?,status=?,updated_at=? WHERE id=?').bind(v.name,v.description,v.riskLevel,json(v.inputSchema),json(v.outputSchema),v.status,v.updatedAt,v.id).run() }

  async createPolicy(v: Policy) { await this.db.prepare('INSERT INTO policies (id,name,workspace_id,subject,resource,action,scope,effect,approval_required,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(v.id,v.name,v.workspaceId,v.subject,v.resource,v.action,v.scope,v.effect,v.approvalRequired ? 1 : 0,v.status,v.createdAt,v.updatedAt).run() }
  getPolicy(id: string) { return this.one('SELECT * FROM policies WHERE id=?', id, policy) }
  listPolicies() { return this.many('SELECT * FROM policies ORDER BY created_at', policy) }
  async savePolicy(v: Policy) { await this.db.prepare('UPDATE policies SET name=?,subject=?,resource=?,action=?,scope=?,effect=?,approval_required=?,status=?,updated_at=? WHERE id=?').bind(v.name,v.subject,v.resource,v.action,v.scope,v.effect,v.approvalRequired ? 1 : 0,v.status,v.updatedAt,v.id).run() }

  async createTask(v: Task) { await this.db.prepare('INSERT INTO tasks (id,workspace_id,title,description,status,capability_id,credential_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(v.id,v.workspaceId,v.title,v.description,v.status,v.capabilityId,v.credentialRef,v.createdAt,v.updatedAt).run() }
  getTask(id: string) { return this.one('SELECT * FROM tasks WHERE id=?', id, task) }
  listTasks() { return this.many('SELECT * FROM tasks ORDER BY created_at', task) }
  async saveTask(v: Task) { await this.db.prepare('UPDATE tasks SET title=?,description=?,status=?,capability_id=?,credential_ref=?,updated_at=? WHERE id=?').bind(v.title,v.description,v.status,v.capabilityId,v.credentialRef,v.updatedAt,v.id).run() }

  async createRun(v: Run) { await this.db.prepare('INSERT INTO runs (id,task_id,workspace_id,status,started_at,completed_at,error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(v.id,v.taskId,v.workspaceId,v.status,v.startedAt,v.completedAt,v.error,v.createdAt,v.updatedAt).run() }
  getRun(id: string) { return this.one('SELECT * FROM runs WHERE id=?', id, run) }
  listRuns() { return this.many('SELECT * FROM runs ORDER BY created_at', run) }
  async saveRun(v: Run) { await this.db.prepare('UPDATE runs SET status=?,started_at=?,completed_at=?,error=?,updated_at=? WHERE id=?').bind(v.status,v.startedAt,v.completedAt,v.error,v.updatedAt,v.id).run() }

  async appendEvent(v: AuditEvent) { await this.db.prepare('INSERT INTO events (id,type,actor,workspace_id,resource_type,resource_id,timestamp,metadata) VALUES (?,?,?,?,?,?,?,?)').bind(v.id,v.type,json(v.actor),v.workspaceId,v.resourceType,v.resourceId,v.timestamp,json(v.metadata)).run() }
  getEvent(id: string) { return this.one('SELECT * FROM events WHERE id=?', id, event) }
  listEvents() { return this.many('SELECT * FROM events ORDER BY timestamp', event) }
}
