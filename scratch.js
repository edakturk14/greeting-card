const palettes={silver:['#929ba8','#e5e9ee','#b9c1cc','#fafbfc','#99a2af'],pink:['#c58ca2','#f6dbe5','#d5a2b7','#ffe7ec','#bb849d'],gold:['#b99d62','#f5e6b6','#c6ad76','#fff2cb','#ad9050']};
export class ScratchCard{
 constructor(panel,{onStart=()=>{},onReveal=()=>{}}={}){
  this.panel=panel;this.canvas=panel.querySelector('canvas');this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});this.onStart=onStart;this.onReveal=onReveal;this.color='silver';this.enabled=false;this.revealed=false;this.started=false;this.paths=[];this.shift=0;this.paintFrame=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(panel);
  this.canvas.addEventListener('pointerdown',e=>this.down(e));this.canvas.addEventListener('pointermove',e=>this.move(e));this.canvas.addEventListener('pointerup',e=>this.up(e));this.canvas.addEventListener('pointercancel',()=>this.cancel());this.canvas.addEventListener('lostpointercapture',()=>this.cancel());
  this.canvas.addEventListener('pointerleave',()=>{if(!this.dragging&&!this.reduced.matches&&!document.body.classList.contains('motion-paused')){this.shift=0;this.schedulePaint();}});
  this.reduced.addEventListener('change',()=>{this.shift=0;this.panel.querySelector('.confetti').replaceChildren();this.schedulePaint();});
 }
 reset({color='silver',enabled=false,revealed=false}={}){
  this.color=color;this.enabled=enabled;this.revealed=revealed;this.started=false;this.dragging=false;this.paths=[];this.shift=0;
  this.panel.classList.toggle('active',enabled);this.panel.classList.toggle('revealed',revealed);this.panel.classList.remove('scratching');this.panel.querySelector('.confetti').replaceChildren();
  this.accessibility();this.resize();
 }
 accessibility(){const surprise=this.panel.querySelector('.surprise');surprise.inert=!this.revealed;surprise.setAttribute('aria-hidden',String(!this.revealed));}
 resize(){const rect=this.panel.getBoundingClientRect();if(!rect.width||!rect.height)return;this.width=this.panel.clientWidth;this.height=this.panel.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);this.dpr=dpr;this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.paint();}
 schedulePaint(){if(this.paintFrame)return;this.paintFrame=requestAnimationFrame(()=>{this.paintFrame=0;this.paint();});}
 paint(){if(!this.width)return;const ctx=this.ctx,w=this.width,h=this.height;ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;const gradient=ctx.createLinearGradient(-w*.3+this.shift*w,0,w*1.3+this.shift*w,h*.3);palettes[this.color].forEach((c,i)=>gradient.addColorStop(i/4,c));ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  // Opaque brushed-metal base, micro-grain, and a broad directional sheen.
  ctx.globalAlpha=.12;for(let y=0;y<h;y+=2){ctx.strokeStyle=y%4?'#fff':'#555963';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  let seed=48321;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};ctx.globalAlpha=.12;for(let i=0;i<Math.min(w*h/14,18000);i++){const x=random()*w,y=random()*h;ctx.fillStyle=i%2?'#fff':'#60636a';ctx.fillRect(x,y,.7,.7);}ctx.globalAlpha=1;
  const sheen=ctx.createLinearGradient(this.shift*w,0,w+this.shift*w,h*.35);sheen.addColorStop(0,'#ffffff00');sheen.addColorStop(.39,'#ffffff00');sheen.addColorStop(.48,'#ffffff50');sheen.addColorStop(.57,'#ffffff00');sheen.addColorStop(1,'#ffffff00');ctx.fillStyle=sheen;ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='destination-out';ctx.lineCap='round';ctx.lineJoin='round';for(const p of this.paths)this.erase(p);ctx.globalCompositeOperation='source-over';
 }
 point(e){const r=this.canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
 erase(segment){const ctx=this.ctx;ctx.lineWidth=Math.min(48,this.width*.15);ctx.beginPath();ctx.moveTo(segment.a.x*this.width,segment.a.y*this.height);ctx.lineTo(segment.b.x*this.width,segment.b.y*this.height);ctx.stroke();ctx.beginPath();ctx.arc(segment.b.x*this.width,segment.b.y*this.height,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}
 down(e){if(!this.enabled||this.revealed||e.button!==0)return;e.preventDefault();this.dragging=true;this.pointer=e.pointerId;this.canvas.setPointerCapture(e.pointerId);this.last=this.point(e);if(!this.started){this.started=true;this.panel.classList.add('scratching');this.onStart();}this.scratch(this.last);}
 move(e){if(this.revealed)return;if(this.dragging&&e.pointerId===this.pointer){e.preventDefault();this.scratch(this.point(e));}else if(e.pointerType==='mouse'&&!this.reduced.matches&&!document.body.classList.contains('motion-paused')){this.shift=(this.point(e).x-.5)*.2;this.schedulePaint();}}
 scratch(point){const segment={a:this.last,b:point};this.paths.push(segment);this.last=point;this.ctx.globalCompositeOperation='destination-out';this.erase(segment);this.ctx.globalCompositeOperation='source-over';if(this.paths.length%5===0)this.check();}
 check(){if(this.revealed)return;const {data}=this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height);let cleared=0,total=0;for(let y=5;y<this.canvas.height;y+=12)for(let x=5;x<this.canvas.width;x+=12){total++;if(data[(y*this.canvas.width+x)*4+3]<100)cleared++;}if(total&&cleared/total>=.43)this.reveal('scratch');}
 up(e){if(this.dragging&&e.pointerId===this.pointer){this.check();this.cancel();}}
 cancel(){this.dragging=false;this.last=null;}
 reveal(method='button'){if(this.revealed||!this.enabled)return;this.revealed=true;this.dragging=false;this.panel.classList.add('revealed');this.accessibility();this.celebrate();this.onReveal(method);}
 celebrate(){if(this.reduced.matches||document.body.classList.contains('motion-paused'))return;const container=this.panel.querySelector('.confetti');for(let i=0;i<23;i++){const bit=document.createElement('i');bit.style.setProperty('--confetti-color',['#cdb3e6','#7041a6','#e8d9f5'][i%3]);const angle=i/23*Math.PI*2;bit.style.setProperty('--x',`${Math.cos(angle)*(70+i%4*24)}px`);bit.style.setProperty('--y',`${Math.sin(angle)*130+40}px`);bit.style.setProperty('--r',`${i*53}deg`);container.appendChild(bit);}setTimeout(()=>container.replaceChildren(),1000);}
 destroy(){this.observer.disconnect();cancelAnimationFrame(this.paintFrame);}
}
