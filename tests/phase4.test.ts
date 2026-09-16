import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRepository } from '../src/adapters/memory-repository'
import { ControlPlane } from '../src/application/control-plane'
import { LearningEngine } from '../src/application/learning-engine'
import type { Actor, Run } from '../src/domain/models'

const owner: Actor = { id: 'owner_halstral', type: 'OWNER' }
const workspaceActor: Actor = { id: 'ws_merovia', type: 'WORKSPACE' }
let repo: MemoryRepository
let control: ControlPlane
let learning: LearningEngine
let counter: number

beforeEach(async () => {
  repo = new MemoryRepository(); control = new ControlPlane(repo); learning = new LearningEngine(repo); counter = 0
  await control.createWorkspace({ id:'ws_merovia',slug:'merovia',name:'Merovia',ownerId:owner.id,environment:'test' },owner)
  await control.createWorkspace({ id:'ws_sparkmind',slug:'sparkmind',name:'SparkMind',ownerId:owner.id,environment:'test' },owner)
  await control.createCapability({ id:'cap_echo',name:'internal.echo',ownerScope:'WORKSPACE',workspaceId:'ws_merovia',riskLevel:'LOW',inputSchema:{},outputSchema:{} },owner)
})

async function terminal(status: Run['status']='COMPLETED', verified=true, versionId='baseline', metrics:Record<string,number>={ quality:0.9 }) {
  counter += 1; const taskId=`task_${counter}`; const runId=`run_${counter}`; const created=new Date(Date.UTC(2026,0,1,0,0,counter)).toISOString(); const completed=new Date(Date.UTC(2026,0,1,0,0,counter+1)).toISOString()
  await control.createTask({id:taskId,workspaceId:'ws_merovia',title:'Learning evidence'},owner)
  const run:Run={id:runId,taskId,workspaceId:'ws_merovia',status,attempt:status==='FAILED'?2:1,idempotencyKey:null,startedAt:created,completedAt:completed,error:status==='FAILED'?'failure':null,createdAt:created,updatedAt:completed}
  await repo.createRun(run)
  if(status==='COMPLETED') await repo.createResult({id:`result_${counter}`,taskId,runId,workspaceId:'ws_merovia',stepId:`step_${counter}`,status:'SUCCEEDED',output:{ok:true},errorCode:null,errorMessage:null,createdAt:completed})
  return learning.captureOutcome({workspaceId:'ws_merovia',runId,capabilityId:'cap_echo',versionId,metrics,verified},owner)
}

async function buildProposal() {
  const out=await terminal(); const signals=await learning.deriveSignals('ws_merovia','cap_echo',owner)
  const draft=await learning.createProposal({workspaceId:'ws_merovia',targetId:'cap_echo',reason:'Verified latency improvement',evidenceRefs:[signals[0].id],proposedConfig:{description:'Optimized bounded adapter'},expectedEffect:{latency:'lower'}},owner)
  const proposal=await learning.submitProposal(draft.id,owner)
  return {out,signals,draft,proposal}
}

describe('Phase 4 controlled learning and optimization',()=>{
  it('captures successful and failed outcomes with immutable provenance and version attribution',async()=>{
    const success=await terminal('COMPLETED',true,'rev_baseline'); const failed=await terminal('FAILED',true,'rev_baseline')
    expect(success).toMatchObject({status:'SUCCEEDED',sourceType:'EXECUTION_RESULT',sourceId:'result_1',verified:true,versionId:'rev_baseline'})
    expect(failed).toMatchObject({status:'FAILED',sourceType:'RUN',sourceId:'run_2',retries:1})
    expect((await repo.listEvents()).filter((e)=>e.type==='OUTCOME_CAPTURED')).toHaveLength(2)
  })

  it('represents cancelled and blocked outcomes correctly',async()=>{
    expect((await terminal('CANCELLED')).status).toBe('CANCELLED')
    expect((await terminal('BLOCKED')).status).toBe('BLOCKED')
  })

  it('rejects plaintext secrets from learning capture and keeps audit secret-safe',async()=>{
    const out=await terminal()
    await expect(learning.createProposal({workspaceId:'ws_merovia',targetId:'cap_echo',reason:'unsafe',evidenceRefs:['missing'],proposedConfig:{apiKey:'plaintext'}},owner)).rejects.toMatchObject({code:'VALIDATION_ERROR'})
    expect(JSON.stringify({out,events:await repo.listEvents()})).not.toContain('plaintext')
  })

  it('derives traceable verified learning signals and refuses unverified-only evidence',async()=>{
    await terminal('COMPLETED',false)
    await expect(learning.deriveSignals('ws_merovia','cap_echo',owner)).rejects.toMatchObject({code:'VALIDATION_ERROR'})
    const verified=await terminal(); const signals=await learning.deriveSignals('ws_merovia','cap_echo',owner)
    expect(signals[0]).toMatchObject({validationStatus:'VERIFIED',sampleSize:1,outcomeRefs:[verified.id]})
  })

  it('enforces proposal lifecycle and never applies without explicit approval',async()=>{
    const {draft,proposal}=await buildProposal(); expect(draft.status).toBe('DRAFT'); expect(proposal.status).toBe('PENDING_REVIEW')
    await expect(learning.applyProposal(proposal.id,owner)).rejects.toMatchObject({code:'FORBIDDEN'})
    const approved=await learning.decideProposal(proposal.id,true,'owner-review-1',owner); expect(approved.status).toBe('APPROVED')
    await expect(learning.decideProposal(proposal.id,true,'again',owner)).rejects.toMatchObject({code:'CONFLICT'})
  })

  it('rechecks workspace, target, current revision, safety, and policy at application time',async()=>{
    const {proposal}=await buildProposal(); await learning.decideProposal(proposal.id,true,'owner-review-2',owner); await control.suspendWorkspace('ws_merovia',owner)
    await expect(learning.applyProposal(proposal.id,owner)).rejects.toMatchObject({code:'FORBIDDEN'})
    expect((await repo.getCapability('cap_echo'))?.description).toBe('')
  })

  it('applies approved configuration as a versioned auditable revision',async()=>{
    const {proposal}=await buildProposal(); await learning.decideProposal(proposal.id,true,'owner-review-3',owner); const applied=await learning.applyProposal(proposal.id,owner)
    expect(applied.proposal.status).toBe('APPLIED'); expect(applied.revision.version).toBe(2)
    expect((await repo.getCapability('cap_echo'))?.description).toBe('Optimized bounded adapter')
    expect((await repo.listEvents()).some((e)=>e.type==='OPTIMIZATION_APPLIED')).toBe(true)
  })

  it('captures deterministic before/after performance with strict version attribution',async()=>{
    const baseline=await terminal('COMPLETED',true,'rev_1'); await learning.measure({workspaceId:'ws_merovia',targetId:'cap_echo',versionId:'rev_1',period:'BASELINE',outcomeRefs:[baseline.id]},owner)
    const post=await terminal('FAILED',true,'rev_2'); await learning.measure({workspaceId:'ws_merovia',targetId:'cap_echo',versionId:'rev_2',period:'POST_CHANGE',outcomeRefs:[post.id]},owner)
    const comparison=await learning.comparePerformance('ws_merovia','cap_echo',owner)
    expect(comparison.delta.successRate).toBe(-1)
    await expect(learning.measure({workspaceId:'ws_merovia',targetId:'cap_echo',versionId:'wrong',period:'POST_CHANGE',outcomeRefs:[post.id]},owner)).rejects.toMatchObject({code:'VALIDATION_ERROR'})
  })

  it('reverts an applied optimization and restores the prior identifiable revision',async()=>{
    const {proposal}=await buildProposal(); await learning.decideProposal(proposal.id,true,'owner-review-4',owner); await learning.applyProposal(proposal.id,owner); const reverted=await learning.revertProposal(proposal.id,owner)
    expect(reverted.status).toBe('REVERTED'); expect((await repo.getCapability('cap_echo'))?.description).toBe('')
    expect((await learning.listRevisions(owner,'ws_merovia')).filter((r)=>r.status==='ACTIVE')).toHaveLength(1)
  })

  it('promotes only capabilities with ownership, verified provenance, security, scope, performance, approval, and safety',async()=>{
    const outcome=await terminal('COMPLETED',true,'rev_1'); const measure=await learning.measure({workspaceId:'ws_merovia',targetId:'cap_echo',versionId:'rev_1',period:'BASELINE',outcomeRefs:[outcome.id]},owner)
    const promotion=await learning.proposePromotion({workspaceId:'ws_merovia',capabilityId:'cap_echo',provenanceRefs:[outcome.id],performanceMeasurementIds:[measure.id],securityContract:{authorization:'default-deny'},scope:{operations:['execute'],destinationWorkspaces:[]}},owner)
    await expect(learning.promote(promotion.id,owner)).rejects.toMatchObject({code:'FORBIDDEN'})
    await learning.decidePromotion(promotion.id,true,'promotion-review-1',owner)
    expect((await learning.promote(promotion.id,owner)).status).toBe('PROMOTED')
    expect((await repo.getCapability('cap_echo'))?.ownerScope).toBe('WORKSPACE')
  })

  it('preserves workspace isolation and default-deny inspection',async()=>{
    await terminal();
    await expect(learning.listOutcomes(workspaceActor,'ws_sparkmind')).rejects.toMatchObject({code:'FORBIDDEN'})
    await expect(learning.listOutcomes(workspaceActor,'ws_merovia')).rejects.toMatchObject({code:'FORBIDDEN'})
    await control.createPolicy({workspaceId:'ws_merovia',name:'Read outcomes',subject:workspaceActor.id,resource:'outcome:*',action:'read',scope:'ws_merovia',effect:'ALLOW'},owner)
    expect(await learning.listOutcomes(workspaceActor,'ws_merovia')).toHaveLength(1)
  })
})
