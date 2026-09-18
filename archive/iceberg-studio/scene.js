const $=selector=>document.querySelector(selector);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const moving=()=>!reduced.matches&&!document.body.classList.contains('motion-paused');
const wrap=$('.card-wrap'),pal=$('#penguin-pal'),panel=$('#scratch-panel');
let hopTimer,bubbleTimer,nudges=0;
function hop(words){
 clearTimeout(bubbleTimer);pal.querySelector('.penguin-bubble').textContent=words;pal.classList.add('talking');bubbleTimer=setTimeout(()=>pal.classList.remove('talking'),2400);
 if(!moving())return;pal.classList.remove('hopping');void pal.offsetWidth;pal.classList.add('hopping');clearTimeout(hopTimer);hopTimer=setTimeout(()=>pal.classList.remove('hopping'),900);
}
function nudge(){
 if(panel.classList.contains('active')&&!panel.classList.contains('revealed'))return;
 if(!moving())return;
 wrap.classList.remove('card-nudged');void wrap.offsetWidth;wrap.classList.add('card-nudged');hop(++nudges%3===0?'wheee!':'nice one!');
}
wrap.addEventListener('animationend',event=>{if(event.animationName==='card-nudge')wrap.classList.remove('card-nudged');});
wrap.addEventListener('click',event=>{if(event.target.closest('button,a,input,textarea'))return;nudge();});
$('#nudge-card').addEventListener('click',nudge);
pal.addEventListener('click',()=>hop(['oh, hi!','nice to see you.','you again!'][Math.floor(Math.random()*3)]));
let wasRevealed=false;
new MutationObserver(()=>{const revealed=panel.classList.contains('revealed');if(revealed&&!wasRevealed)hop('surprise!');wasRevealed=revealed;$('#nudge-card').hidden=panel.classList.contains('active')&&!revealed;}).observe(panel,{attributes:true,attributeFilter:['class']});
$('#motion-toggle').addEventListener('click',()=>{
 const paused=document.body.classList.toggle('motion-paused');$('#motion-toggle').setAttribute('aria-pressed',String(paused));$('#motion-toggle').textContent=paused?'Play motion':'Pause motion';
 wrap.classList.remove('card-nudged');pal.classList.remove('hopping');wrap.style.setProperty('--tilt-x','0deg');wrap.style.setProperty('--tilt-y','0deg');
});
reduced.addEventListener('change',()=>{wrap.classList.remove('card-nudged');pal.classList.remove('hopping');});

const mascotSection=document.querySelector('.mascot-footer');
let parallaxFrame;
mascotSection.addEventListener('pointermove',event=>{
 if(!moving()||event.pointerType!=='mouse')return;
 const r=mascotSection.getBoundingClientRect(),x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;
 cancelAnimationFrame(parallaxFrame);parallaxFrame=requestAnimationFrame(()=>{pal.style.setProperty('--look-x',`${x*12}px`);pal.style.setProperty('--look-y',`${y*8}px`);pal.style.setProperty('--look-r',`${x*1.8}deg`);});
});
function centerPal(){pal.style.setProperty('--look-x','0px');pal.style.setProperty('--look-y','0px');pal.style.setProperty('--look-r','0deg');}
mascotSection.addEventListener('pointerleave',centerPal);reduced.addEventListener('change',centerPal);document.querySelector('#motion-toggle').addEventListener('click',centerPal);
