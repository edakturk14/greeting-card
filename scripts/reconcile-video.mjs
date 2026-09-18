// Operator-only recovery. Never submits a new paid request.
import {videoJobs,opaque} from '../lib/video/jobs.mjs';
import {MODELS} from '../lib/video/config.mjs';
const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];
const id=value('--job');if(!args.includes('--job')||!opaque(id))throw Error('Use --job <private job ID>. Never pass resume tokens or provider secrets on the command line.');
let job=await videoJobs.store.get(id);if(!job)throw Error('Job not found');
if(args.includes('--request-id')){
 const stage=value('--stage'),request=value('--request-id');if(!['voice','video'].includes(stage)||job.state!==stage+'_submitting'||! /^[A-Za-z0-9_-]{8,100}$/.test(request))throw Error('Only an uncertain submitting stage can attach its verified request ID.');
 const root='https://queue.fal.run/'+MODELS[stage].split('/').slice(0,2).join('/')+'/requests/'+request;
 const ref={id:request,status:root+'/status',result:root};await videoJobs.provider.poll(ref); // Must be accessible with this fal account before attaching.
 job=await videoJobs.change(job,{state:stage+'_pending',[stage+'_request']:ref,next_poll_at:0,error:null});
}
if(args.includes('--settle-cents')){
 const cents=Number(value('--settle-cents'));
 if(!args.includes('--billing-verified')||!['ready','failed','review'].includes(job.state)||!Number.isInteger(cents)||cents<0||cents>job.reserved_cents)throw Error('Require terminal job, --billing-verified, and a billed amount no greater than the held reservation.');
 job=await videoJobs.change(job,{charge_cents:cents,actual_cents:cents,cost_state:'invoice_reconciled'});
}else job=await videoJobs.advance(job.id);
console.log(JSON.stringify({id:job.id,state:job.state,costState:job.cost_state,heldOrSpentCents:job.charge_cents}));
