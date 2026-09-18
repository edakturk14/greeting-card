import {publicOrigin} from '../metadata.mjs';
export const BREAK_MESSAGE='Video cards are taking a little break. You can still send a scratch card.';
export const MODELS={voice:'fal-ai/elevenlabs/tts/multilingual-v2',video:'fal-ai/kling-video/ai-avatar/v2/standard'};
export const MAX_SECONDS=10;
export const MAX_WORDS=20;
export const MAX_CHARS=200;
function integer(name,fallback){const v=Number(process.env[name]??fallback);return Number.isSafeInteger(v)&&v>=0?v:0;}
export function videoConfig(){
 const caps={visitor:integer('VIDEO_VISITOR_DAILY_LIMIT',1),ip:integer('VIDEO_IP_DAILY_LIMIT',2),daily:integer('VIDEO_GLOBAL_DAILY_LIMIT',3),inflight:integer('VIDEO_INFLIGHT_LIMIT',2),dailyCents:integer('VIDEO_DAILY_BUDGET_CENTS',200),totalCents:integer('VIDEO_TOTAL_BUDGET_CENTS',1000)};
 let publicReady=false;try{publicOrigin(process.env.PUBLIC_BASE_URL);publicReady=true;}catch{}
 const configured=publicReady&&Boolean(process.env.FAL_KEY&&process.env.FAL_WEBHOOK_USER_ID&&process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.APP_SECRET?.length>=32&&process.env.PUBLIC_BASE_URL?.startsWith('https://'));
 return {enabled:process.env.VIDEO_ENABLED==='1'&&configured&&Object.values(caps).every(v=>v>0),configured,caps,reserveCents:65,voice:'Rachel',maxSeconds:MAX_SECONDS,maxWords:MAX_WORDS,maxChars:MAX_CHARS,mocked:false};
}
export function publicVideoConfig(c=videoConfig()){return {available:c.enabled,maxSeconds:c.maxSeconds,maxWords:c.maxWords,maxChars:c.maxChars,mocked:c.mocked===true,notice:c.enabled?'':c.configured?BREAK_MESSAGE:'Video generation is not available yet. You can still make a scratch card.'};}
