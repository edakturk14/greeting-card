const $=s=>document.querySelector(s);
const fields=['to','greeting','message','from'];
const defaults={to:'someone special',greeting:'Happy birthday!',message:'Here’s to the little moments, the big adventures, and everything that makes you, you.',from:'your someone'};
// Card rendering is independent of the editor and storage. Future optional media can be added here.
function renderCard(card){for(const key of fields)$(`[data-card="${key}"]`).textContent=card[key]||defaults[key];}
const form=$('#card-form');const status=$('#status');let saved=null;let busy=false;
function draft(){return Object.fromEntries(fields.map(key=>[key,$(`#${key}`).value.trim()]));}
function update(){renderCard(draft());$('#message-count').textContent=`${$('#message').value.length} / 1500`;}
for(const key of fields)$(`#${key}`).addEventListener('input',update);
const recipient=location.pathname.match(/^\/c\/([^/]+)$/);
if(recipient){
 document.body.classList.add('recipient');$('#editor-panel').hidden=true;$('#preview-caption').textContent='A little thoughtfulness, delivered.';$('#card').hidden=true;
 status.textContent='Opening your card…';
 try{const response=await fetch(`/api/cards/${encodeURIComponent(recipient[1])}`);if(!response.ok)throw Error(response.status===404?'This link may be incomplete, or the card is no longer available.':'Please try refreshing in a moment.');const card=await response.json();renderCard(card);document.title=`A little note for ${card.to}`;$('#card').hidden=false;status.textContent='';}
 catch(error){$('.card-stage').hidden=true;$('#recipient-error').hidden=false;$('#recipient-error-message').textContent=error.message;status.textContent='';}
}else{
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;const card=draft();
  if(fields.some(key=>!card[key])){status.textContent='Please fill in every field before creating your card.';return;}
  busy=true;$('#create').disabled=true;$('#create').textContent='Saving your card…';status.textContent='';
  try{
   if(!saved||JSON.stringify(saved.card)!==JSON.stringify(card)){
    const response=await fetch('/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(card)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Your card couldn’t be saved. Please try again.');saved={...result,card};
   }
   renderCard(card);$('#share-url').value=saved.url;$('#editor-panel').hidden=true;$('#finished-panel').hidden=false;$('#preview-caption').textContent='Made by you. Just for them.';$('#share').focus();
  }catch(error){status.textContent=error.message||'Your card couldn’t be saved. Please try again.';}
  finally{busy=false;$('#create').disabled=false;$('#create').innerHTML='Create card <span aria-hidden="true">↗</span>';}
 });
 $('#edit').addEventListener('click',()=>{$('#finished-panel').hidden=true;$('#editor-panel').hidden=false;status.textContent='';$('#preview-caption').textContent='A little preview of a lovely thing.';$('#to').focus();});
 async function copyLink(){
  try{
   if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(saved.url);
   else{const input=$('#share-url');input.focus();input.select();if(!document.execCommand('copy'))throw Error('copy unavailable');}
   status.textContent='Link copied. Send a little happiness.';$('#copy').textContent='Copied ✓';setTimeout(()=>{$('#copy').textContent='Copy link ↗';},2200);
  }catch{const input=$('#share-url');input.focus();input.select();status.textContent='Select and copy the link above to share your card.';}
 }
 $('#copy').addEventListener('click',copyLink);
 $('#share').addEventListener('click',async()=>{
  if(!saved)return;
  if(navigator.share){try{await navigator.share({title:`A little note for ${saved.card.to}`,text:'A little card, just for you.',url:saved.url});status.textContent='Your card is ready to make their day.';}catch(error){if(error.name!=='AbortError')await copyLink();}}
  else await copyLink();
 });
}
const stage=$('.card-stage');const cardEl=$('#card');
if(matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches){stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5;const y=(e.clientY-r.top)/r.height-.5;cardEl.style.transform=`rotate(-1deg) rotateY(${x*5}deg) rotateX(${-y*4}deg)`;});stage.addEventListener('pointerleave',()=>{cardEl.style.transform='';});}
