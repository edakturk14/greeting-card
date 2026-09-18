// Browser-rendered brand layouts reuse the original Fig artwork without altering it.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 const fig='data:image/png;base64,'+(await fs.readFile('pip-cutout.png')).toString('base64');
 await page.setContent(`<html><head><style>@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=DM+Sans:wght@400;500&display=swap');*{box-sizing:border-box}body{margin:0;background:#F8F5FC;color:#33213F;width:1200px;height:630px;overflow:hidden}.brand{position:absolute;left:80px;top:182px;z-index:2}h1{font:700 83px/1.1 'Bricolage Grotesque',sans-serif;letter-spacing:-4px;margin:0 0 27px;color:#7041A6}p{font:400 34px/1.4 'DM Sans',sans-serif;margin:0;max-width:460px}.scene{position:absolute;right:48px;top:48px;width:510px;height:534px;border-radius:40px;background:#E5D8F3;overflow:hidden}img{position:absolute;width:780px;max-width:none;left:-135px;bottom:-14px}</style></head><body><div class="brand"><h1>SendFiggle</h1><p>A little surprise,<br>delivered.</p></div><div class="scene"><img src="${fig}"></div></body></html>`);
 await page.evaluate(()=>document.fonts.ready);await page.locator('img').evaluate(i=>i.decode());await page.screenshot({path:'social-preview.png'});
 for(const [size,file]of [[32,'favicon-32.png'],[180,'apple-touch-icon.png'],[192,'icon-192.png']]){
 await page.setViewportSize({width:size,height:size});
 await page.setContent(`<html><body style="margin:0;background:#E5D8F3;overflow:hidden"><img src="${fig}" style="position:absolute;width:190%;max-width:none;left:-45%;top:-5%"></body></html>`);await page.locator('img').evaluate(i=>i.decode());await page.screenshot({path:file});
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
