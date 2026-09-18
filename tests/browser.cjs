const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1060},permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let creates=0,analyticsCalls=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/cards'))creates++;if(r.url().endsWith('/api/events'))analyticsCalls++;});
await page.goto('http://localhost:3001');await page.evaluate(()=>document.fonts.ready);
await page.getByRole('button',{name:'Create link'}).click();assert.equal(creates,0);
const values={to:'Çağrı & İpek',cover:'A little surprise for you…',message:'İyi ki doğdun! Here’s to the small joys, big dreams, and all the lovely moments in between.',from:'Eda Şahin'};
for(const [name,value]of Object.entries(values)){await page.locator('#'+name).fill(value);assert.equal(await page.locator(`[data-card="${name}"]`).textContent(),value);}
await page.locator('#photo').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('under 2 MB'));
await page.locator('#photo').setInputFiles('/Users/edaakturk/Desktop/projects/pet-greeting-card-restored/public/business/demo-dog.jpg');await page.waitForFunction(()=>document.querySelector('#photo-label').textContent.includes('added'));
await page.screenshot({path:'/tmp/als-desktop.png',fullPage:true,animations:'disabled'});
// Preview is private and never saved or counted as a recipient visit.
await page.getByRole('button',{name:'Preview surprise'}).click();await page.locator('#preview-panel').waitFor({state:'visible'});assert.equal(creates,0);
assert.equal(await page.locator('#surprise').getAttribute('aria-hidden'),'true');
const opaque=await page.locator('canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i]!==255)return false;return true;});assert.equal(opaque,true);
await page.getByRole('button',{name:'Reveal message'}).click();await page.waitForFunction(()=>document.querySelector('#scratch-panel').classList.contains('revealed'));
assert.equal(await page.locator('#surprise').getAttribute('aria-hidden'),'false');assert.ok(await page.locator('.confetti i').count()>0);await page.getByRole('button',{name:'Back to editing'}).click();assert.equal(creates,0);
assert.equal(await page.locator('#scratch-panel').evaluate(el=>el.classList.contains('revealed')),false);
await page.getByRole('button',{name:'Create link'}).click();await page.locator('#finished-panel').waitFor({state:'visible'});const link=await page.locator('#share-url').inputValue();assert.equal(creates,1);
await page.getByRole('button',{name:'Copy link'}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),link);
const recipientContext=await browser.newContext({viewport:{width:1100,height:950}});const recipient=await recipientContext.newPage();await recipient.goto(link);await recipient.locator('#card').waitFor({state:'visible'});assert.equal(await recipient.locator('#editor-panel').isVisible(),false);assert.equal(await recipient.locator('#scratch-panel').evaluate(el=>el.classList.contains('revealed')),false);
// Scratch with actual pointer input across at least half the coating.
const box=await recipient.locator('#scratch-canvas').boundingBox();await recipient.mouse.move(box.x+8,box.y+15);await recipient.mouse.down();for(let y=15;y<box.height-10;y+=20){await recipient.mouse.move(box.x+8,box.y+y);await recipient.mouse.move(box.x+box.width-8,box.y+y,{steps:12});}await recipient.mouse.up();await recipient.waitForFunction(()=>document.querySelector('#scratch-panel').classList.contains('revealed'));
await recipient.screenshot({path:'/tmp/als-recipient.png',fullPage:true,animations:'disabled'});
assert.equal(await recipient.locator('[data-card="message"]').textContent(),values.message);assert.ok(await recipient.locator('#card-photo').evaluate(img=>img.complete&&img.naturalWidth>0));
await recipient.reload();await recipient.locator('#card').waitFor({state:'visible'});assert.equal(await recipient.locator('#scratch-panel').evaluate(el=>el.classList.contains('revealed')),true);assert.equal(await recipient.locator('.confetti i').count(),0);
// Another device/session retains its own unrevealed state.
const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const mobile=await mobileContext.newPage();await mobile.goto(link);await mobile.locator('#card').waitFor({state:'visible'});assert.equal(await mobile.locator('#scratch-panel').evaluate(el=>el.classList.contains('revealed')),false);await mobile.screenshot({path:'/tmp/als-mobile-foil.png',fullPage:true});
const client=await mobileContext.newCDPSession(mobile);const mb=await mobile.locator('#scratch-canvas').boundingBox();await mobile.evaluate(()=>document.querySelector('#scratch-canvas').scrollIntoView({block:'center'}));const touchBox=await mobile.locator('#scratch-canvas').boundingBox();const before=await mobile.evaluate(()=>scrollY);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchBox.x+15,y:touchBox.y+20}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchBox.x+touchBox.width-15,y:touchBox.y+20}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await mobile.evaluate(()=>scrollY),before);assert.equal(await mobile.locator('#scratch-panel').evaluate(el=>el.classList.contains('scratching')),true);
await mobile.getByRole('button',{name:'Reveal message'}).click();assert.equal(await mobile.locator('.confetti i').count(),0);assert.equal(await mobile.locator('#card').evaluate(el=>getComputedStyle(el).transform),'none');
await mobile.getByRole('link',{name:'Make a card for someone'}).click();await mobile.locator('#editor-panel').waitFor({state:'visible'});assert.match(mobile.url(),/from=recipient/);for(const [name,value]of Object.entries({...values,to:'İlknur Çağrı Şengül Öztürk '.repeat(2),message:'A brand new little surprise.',from:'Gökçe Şahin'}))await mobile.locator('#'+name).fill(value);await mobile.screenshot({path:'/tmp/als-mobile-editor.png',fullPage:true});assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await mobile.getByRole('button',{name:'Create link'}).click();await mobile.locator('#finished-panel').waitFor({state:'visible'});
// Decorative seal doesn't cover name, foil, or buttons.
const overlap=await page.evaluate(()=>{const a=document.querySelector('.sticker').getBoundingClientRect();return ['.card-to','#scratch-panel','#reveal'].some(s=>{const b=document.querySelector(s).getBoundingClientRect();return b.width&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});});assert.equal(overlap,false);
await recipient.goto('http://localhost:3001/c/'+'x'.repeat(32));await recipient.locator('#recipient-error').waitFor({state:'visible'});assert.equal(analyticsCalls,0);assert.deepEqual(errors,[]);
console.log(JSON.stringify({result:'PASS',sampleLink:link,checks:['live preview','photo validation','opaque foil','preview no save','copy link','fresh session','mouse scratch auto-reveal','per-device remembered reveal','touch scratch no scroll','reduced motion','photo persisted','long Turkish names','recipient creates new card','no local analytics','sticker clearance','missing link']}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
