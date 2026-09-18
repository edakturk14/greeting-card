import os from 'node:os';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const isProduction=()=>Boolean(process.env.VERCEL||process.env.APP_ENV==='production');
function publicOrigin(value){
 const url=new URL(value);const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!host.includes('.')||host.endsWith('.local')||host.endsWith('.localhost')||host==='localhost'||host.includes(':')||/^\d+\.\d+\.\d+\.\d+$/.test(host))throw Error('Configure a public HTTPS origin for SendFiggle.');
 return url.origin;
}
export function baseUrl(req){
 const configured=process.env.PUBLIC_BASE_URL;
 if(configured)return isProduction()?publicOrigin(configured):new URL(configured).origin;
 if(isProduction()){
  const deployment=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
  if(deployment)return publicOrigin(`https://${deployment}`);
  throw Error('PUBLIC_BASE_URL is required in production.');
 }
 const port=Number(process.env.PORT||3001);const host=req.headers.host||`localhost:${port}`;
 if(/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)){
  const address=Object.values(os.networkInterfaces()).flat().find(n=>n&&n.family==='IPv4'&&!n.internal&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address));
  if(address)return `http://${address.address}:${port}`;
 }
 return new URL(`http://${host}`).origin;
}
export function metadata(origin,pathname){
 const recipient=pathname.startsWith('/c/');
 const title=recipient?'You’ve got a surprise — SendFiggle':'SendFiggle — Scratch-to-Reveal Cards';
 const description=recipient?'Someone made you a card. Open it and scratch to reveal your message.':'Make someone smile with a personal scratch-to-reveal card. Pick a message, make it yours, and share a link. No account needed.';
 const socialTitle=recipient?title:'Send a little surprise with SendFiggle';
 const socialDescription=recipient?description:'A note from you. A surprise for them. Create a card they can scratch to reveal.';
 const url=origin+(recipient?pathname:'/');const image=origin+'/social-preview.png';
 const meta=(key,value,property=false)=>`<meta ${property?'property':'name'}="${key}" content="${escape(value)}">`;
 return `<title>${escape(title)}</title>`+meta('description',description)+`<link rel="canonical" href="${escape(url)}">`+
 meta('robots',recipient?'noindex,nofollow,noarchive':'index,follow')+
 Object.entries({'og:site_name':'SendFiggle','og:title':socialTitle,'og:description':socialDescription,'og:type':'website','og:url':url,'og:image':image,'og:image:type':'image/png','og:image:width':'1200','og:image:height':'630','og:image:alt':'Fig beside the SendFiggle wordmark. A little surprise, delivered.'}).map(([k,v])=>meta(k,v,true)).join('')+
 Object.entries({'twitter:card':'summary_large_image','twitter:title':socialTitle,'twitter:description':socialDescription,'twitter:image':image,'twitter:image:alt':'Fig beside the SendFiggle wordmark. A little surprise, delivered.'}).map(([k,v])=>meta(k,v)).join('');
}
