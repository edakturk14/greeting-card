import {spawn} from 'node:child_process';
const settings={APP_ENV:'production',PUBLIC_BASE_URL:'https://sendfiggle.vercel.app',VIDEO_ENABLED:'0',LOCAL_TEST_MODE:'0',APP_SECRET:process.env.APP_SECRET,CRON_SECRET:process.env.CRON_SECRET};
if(!settings.APP_SECRET||!settings.CRON_SECRET)throw Error('Load the local app secrets before running this script.');
for(const [key,value]of Object.entries(settings)){
 const secret=['APP_SECRET','CRON_SECRET'].includes(key);
 await new Promise((resolve,reject)=>{
  const child=spawn('npx',['--yes','vercel@latest','env','add',key,'production','--yes','--force',secret?'--sensitive':'--no-sensitive','--scope','edakturk14s-projects'],{stdio:['pipe','ignore','pipe']});
  child.stderr.on('data',()=>{});
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(`Could not configure ${key}`)));
  child.stdin.end(value);
 });
 console.log(`Configured ${key}`);
}
