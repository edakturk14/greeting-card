import {reactFig} from './scene.js';
import {ScratchCard} from './scratch.js';
import {Analytics,revealedOnDevice,rememberReveal} from './analytics.js';
const $=s=>document.querySelector(s),fields=['to','cover','message','from'];
const defaults={to:'',cover:'This one’s for you.',message:'Your message goes here',from:''};
let photoData=null,saved=null,busy=false,mode='editor',analytics=null,photoVersion=0;
const recipient=location.pathname.match(/^\/c\/([^/]+)$/);
const status=$('#status');
function announce(message){status.textContent=message;}
function renderCard(card){for(const key of fields)$(`[data-card="${key}"]`).textContent=card[key]||defaults[key];$('.card-to').hidden=true;$('.card-signoff').hidden=!card.from;const photo=$('#card-photo');photo.hidden=!card.photo;if(card.photo)photo.src=card.photo;else photo.removeAttribute('src');}
const scratch=new ScratchCard($('#scratch-panel'),{onStart(){if(mode==='recipient')analytics?.event('scratch_started',{},true);},onReveal(method){$('#reveal').hidden=true;$('#revealed-announcement').textContent='Surprise revealed. Your personal message is ready to read.';if(mode==='recipient'){rememberReveal(recipient[1]);$('#make-card').hidden=false;analytics?.event('reveal_completed',{method},true);}}});
function draft(){const name=$('#to').value.trim();$('#cover').value=name?`This one’s for you, ${name}.`:'This one’s for you.';return {...Object.fromEntries(fields.map(key=>[key,$(`#${key}`).value.trim()])),color:$('input[name="color"]:checked').value,photo:photoData};}
function showMode(next){
 mode=next;$('#editor-panel').hidden=next==='finished';$('#finished-panel').hidden=next!=='finished';
 const preview=next==='preview';$('.card-stage').classList.toggle('is-preview',preview);$('#preview-controls').hidden=!preview;$('#preview').hidden=preview||next==='finished';$('#preview-note').hidden=!preview;
 $('#reveal').hidden=!preview;$('#revealed-announcement').textContent='';$('#preview-caption').textContent=preview?'Preview · Scratch the foil':next==='finished'?'Your saved card':'Your scratch card';
 scratch.reset({color:draft().color,enabled:preview});
}
function update(){
 if(mode==='preview')showMode('editor');
 const current=draft();renderCard(current);$('#foil-label').textContent='Scratch here';$('#message-count').textContent=`${$('#message').value.length} / 1200`;scratch.reset({color:current.color});
 $('#create').disabled=busy||!config.ready||!current.message;
 for(const option of document.querySelectorAll('.message-option'))option.setAttribute('aria-pressed',String(option.dataset.message===current.message));
 const input=$('#message');input.style.height='auto';input.style.height=`${Math.min(260,Math.max(78,input.scrollHeight))}px`;
}
function valid(){if(!$('#card-form').reportValidity())return false;if(!draft().message){announce('Choose a message or write your own first.');return false;}return true;}
$('#reveal').addEventListener('click',()=>scratch.reveal('button'));
$('#make-card').addEventListener('click',()=>analytics?.event('recipient_make_card_clicked',{},true));
let config={ready:false,analytics:false};try{config=await(await fetch('/api/config')).json();}catch{announce('The card studio is taking a moment. Please refresh to try again.');}
analytics=new Analytics(config,Boolean(recipient));
if(recipient){
 document.body.classList.add('recipient');mode='recipient';$('#preview').hidden=true;$('#preview-actions').hidden=true;$('#editor-panel').hidden=true;$('#card').hidden=true;$('#preview-caption').textContent='This one’s for you.';announce('Opening your surprise…');
 try{const response=await fetch(`/api/cards/${encodeURIComponent(recipient[1])}`);const card=await response.json();if(!response.ok)throw Error(card.error||'We couldn’t find that surprise.');renderCard(card);$('#card').hidden=false;const done=revealedOnDevice(recipient[1]);scratch.reset({color:card.color,enabled:true,revealed:done});$('#reveal').hidden=done;$('#make-card').hidden=!done;analytics.event('recipient_opened',{},true);announce('');
 const stage=$('.card-stage'),envelope=$('#open-envelope'),cardElement=$('#card');
 stage.classList.add('mail-closed');envelope.hidden=false;cardElement.inert=true;cardElement.setAttribute('aria-hidden','true');$('#preview-caption').textContent='You’ve got a card.';
 envelope.addEventListener('click',()=>{
  if(envelope.disabled)return;envelope.disabled=true;stage.classList.remove('mail-closed');stage.classList.add('mail-opening');
  const finish=()=>{stage.classList.remove('mail-opening');envelope.hidden=true;cardElement.inert=false;cardElement.removeAttribute('aria-hidden');$('#preview-caption').textContent='This one’s for you.';const target=done?$('#make-card'):$('#reveal');target.focus({preventScroll:true});};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else setTimeout(finish,1200);
 });}
 catch(error){$('.card-stage').hidden=true;$('#recipient-error').hidden=false;$('#recipient-error-message').textContent=error.message;announce('');}
}else{
 analytics.event('landing_visited',{},true);analytics.event('creator_opened',{},true);
 if(!config.ready){$('#create').disabled=true;announce('Preview your surprise now. Saving cards will be available once the studio is connected.');}
 for(const key of fields)$(`#${key}`).addEventListener('input',update);
 for(const option of document.querySelectorAll('.message-option'))option.addEventListener('click',()=>{$('#message').value=option.dataset.message;update();announce('');});
 for(const radio of document.querySelectorAll('input[name="color"]'))radio.addEventListener('change',update);
 $('#photo').addEventListener('click',()=>$('#photo-restrictions').hidden=false);
 async function addPhoto(file){
 $('#photo-restrictions').hidden=false;if(!file)return;const version=++photoVersion;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>2*1024*1024){$('#photo').value='';announce('Choose a JPG, PNG or WEBP photo under 2 MB.');return;}
 try{
 const bitmap=await createImageBitmap(file);const pixels=bitmap.width*bitmap.height;bitmap.close();if(pixels>20000000)throw Error('Please use a photo under 20 megapixels.');
 const value=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('This photo couldn’t be read.'));reader.readAsDataURL(file);});if(version!==photoVersion)return;
 photoData=value;$('#photo-label').textContent='Photo added ✓';$('#remove-photo').hidden=false;announce('Photo added. Try scratching to see it.');update();
 }catch(error){if(version===photoVersion){$('#photo').value='';announce(error.message||'Try a different photo.');}}
 }
 $('#photo').addEventListener('change',event=>void addPhoto(event.target.files[0]));
 const dropzone=$('#photo-dropzone');let dragDepth=0;
 dropzone.addEventListener('dragenter',event=>{event.preventDefault();dragDepth++;dropzone.classList.add('is-dragging');$('#photo-restrictions').hidden=false;});
 dropzone.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
 dropzone.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;dropzone.classList.remove('is-dragging');}});
 dropzone.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;dropzone.classList.remove('is-dragging');const files=event.dataTransfer?.files;if(!files?.length)return;if(files.length!==1){announce('Please add one photo at a time.');return;}void addPhoto(files[0]);});
 // Prevent a missed image drop from navigating away and discarding the note.
 for(const type of ['dragover','drop'])document.addEventListener(type,event=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault();});
 $('#remove-photo').addEventListener('click',()=>{photoVersion++;photoData=null;$('#photo').value='';$('#photo-label').textContent='＋ Add a photo';$('#remove-photo').hidden=true;update();announce('Photo removed.');});
 $('#preview').addEventListener('click',()=>{if(!$('#message').value.trim()){announce('Write a message first, then try scratching.');$('#message').focus();return;}renderCard(draft());showMode('preview');analytics.event('preview_tried');$('#reveal').focus({preventScroll:true});announce('');});
 $('#reset-preview').addEventListener('click',()=>{scratch.reset({color:draft().color,enabled:true});$('#reveal').hidden=false;$('#revealed-announcement').textContent='Foil reset. Your message is hidden again.';});
 $('#back-preview').addEventListener('click',()=>{showMode('editor');$('#preview').focus();});
 $('#edit').addEventListener('click',()=>{showMode('editor');$('#message').focus();announce('');});
 $('#card-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!config.ready||!valid())return;busy=true;$('#create').disabled=true;$('#create').textContent='Saving your surprise…';announce('');const card=draft();
 try{
  if(!saved||JSON.stringify(saved.card)!==JSON.stringify(card)){const response=await fetch('/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...card,analytics:analytics.creation()})});const result=await response.json();if(!response.ok)throw Error(result.error||'Your card couldn’t be saved.');saved={...result,card};}
  $('#share-url').value=saved.url;$('#share').hidden=!navigator.share;showMode('finished');reactFig('Ready to send!');$('#copy').focus();
 }catch(error){announce(error.message||'Your card couldn’t be saved. Please try again.');}
 finally{busy=false;$('#create').disabled=!config.ready||!draft().message;$('#create').innerHTML='Create card <span aria-hidden="true">↗</span>';}
 });
 async function copy(){try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(saved.url);else{const input=$('#share-url');input.focus();input.select();if(!document.execCommand('copy'))throw Error();}announce('Link copied. Ready to send.');$('#copy').textContent='Copied ✓';setTimeout(()=>$('#copy').textContent='Copy link',2000);}catch{$('#share-url').focus();$('#share-url').select();announce('Select and copy the link above to share your card.');}}
 $('#copy').addEventListener('click',()=>{analytics.event('copy_link_clicked');void copy();});
 $('#share').addEventListener('click',async()=>{if(!saved)return;if(!navigator.share)return copy();analytics.event('native_share_action');try{await navigator.share({title:'You’ve got a surprise — SendFiggle',text:'A little surprise, delivered.',url:saved.url});}catch(error){if(error.name!=='AbortError')await copy();}});
 update();
}

// Builder card follows the desktop cursor across the page, not only over the foil.
const cardWrap=document.querySelector('.card-wrap');
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const finePointer=matchMedia('(hover: hover) and (pointer: fine)');
let tiltFrame=0;
function clearTilt(){cancelAnimationFrame(tiltFrame);tiltFrame=0;for(const [key,value]of [['--tilt-x','0deg'],['--tilt-y','0deg'],['--card-shift-x','0px'],['--card-shift-y','0px']])cardWrap.style.setProperty(key,value);}
document.addEventListener('pointermove',event=>{
 if(recipient||event.pointerType!=='mouse'||!finePointer.matches||motionPreference.matches||cardWrap.querySelector(':focus-visible')||document.querySelector('#scratch-panel').classList.contains('active')){clearTilt();return;}
 const x=Math.max(-1,Math.min(1,event.clientX/innerWidth*2-1)),y=Math.max(-1,Math.min(1,event.clientY/innerHeight*2-1));
 cancelAnimationFrame(tiltFrame);tiltFrame=requestAnimationFrame(()=>{cardWrap.style.setProperty('--tilt-x',`${-y*4}deg`);cardWrap.style.setProperty('--tilt-y',`${x*7}deg`);cardWrap.style.setProperty('--card-shift-x',`${x*7}px`);cardWrap.style.setProperty('--card-shift-y',`${y*3}px`);});
});
document.documentElement.addEventListener('pointerleave',clearTilt);
document.addEventListener('pointercancel',clearTilt);
window.addEventListener('blur',clearTilt);
cardWrap.addEventListener('focusin',clearTilt);
motionPreference.addEventListener('change',clearTilt);
finePointer.addEventListener('change',clearTilt);
$('#preview').addEventListener('click',clearTilt);
