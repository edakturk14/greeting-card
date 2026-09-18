// Explicit opt-in for local, file-backed development only. Never applies to hosted storage.
export function localTesting(){return process.env.LOCAL_TEST_MODE==='1'&&process.env.APP_ENV==='development'&&process.env.NODE_ENV!=='production'&&!process.env.VERCEL&&!process.env.SUPABASE_URL&&!process.env.SUPABASE_SERVICE_ROLE_KEY;}
