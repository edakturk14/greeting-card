// Fig is a flattened illustration, not a rig. No faux eye overlays or gaze warping.
const $=s=>document.querySelector(s),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const wrap=$('.card-wrap'),pal=$('#penguin-pal'),panel=$('#scratch-panel');
const moving=()=>!reduced.matches&&!document.body.classList.contains('motion-paused');
let reactionTimer;
export function reactFig(){
 if(!moving())return;
 pal.classList.remove('hopping');void pal.offsetWidth;pal.classList.add('hopping');
 clearTimeout(reactionTimer);reactionTimer=setTimeout(()=>pal.classList.remove('hopping'),900);
}
function stop(){clearTimeout(reactionTimer);pal.classList.remove('hopping');wrap.classList.remove('card-nudged');wrap.style.setProperty('--tilt-x','0deg');wrap.style.setProperty('--tilt-y','0deg');}
reduced.addEventListener('change',stop);
wrap.addEventListener('click',e=>{if(!moving()||panel.classList.contains('active')||e.target.closest('button,a'))return;wrap.classList.remove('card-nudged');void wrap.offsetWidth;wrap.classList.add('card-nudged');});
wrap.addEventListener('animationend',e=>{if(e.animationName==='card-nudge')wrap.classList.remove('card-nudged');});

// A small whole-character response, not simulated eye tracking.
const hoverPointer=matchMedia('(hover: hover) and (pointer: fine)');
function settleFig(){pal.style.setProperty('--fig-x','0px');pal.style.setProperty('--fig-angle','0deg');}
pal.addEventListener('pointermove',event=>{
 if(!moving()||!hoverPointer.matches||event.pointerType==='touch')return;
 const bounds=pal.getBoundingClientRect();
 const offset=Math.max(-1,Math.min(1,((event.clientX-bounds.left)/bounds.width-.5)*2));
 pal.style.setProperty('--fig-x',`${offset*9}px`);
 pal.style.setProperty('--fig-angle',`${offset*.65}deg`);
});
pal.addEventListener('pointerleave',settleFig);
pal.addEventListener('pointercancel',settleFig);
reduced.addEventListener('change',settleFig);
hoverPointer.addEventListener('change',settleFig);

