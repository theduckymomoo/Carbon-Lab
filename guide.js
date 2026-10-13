/* guide.js — help, onboarding and small conveniences (loads after explore.js)

   * "Continue" pill in the header (Explore): jumps back into the lesson you were on
   * Help panel (?): quick tour, how to move the model, shortcuts, text size, reset progress
   * First-run tour of the Explore screen (once, then remembered)
   * Toasts, screen-reader announcements, and two shortcuts:  ?  opens help,  L  opens the lessons roadmap */
(function(){
'use strict';
if(!document.querySelector('.top')||!document.querySelector('#mx')){return}
try{
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const body=document.body, root=document.documentElement;
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const mode=()=>typeof MODEUX!=='undefined'?MODEUX:'guided';
const wide=()=>innerWidth>860;

/* ---------- announcements + toasts ---------- */
const sr=document.createElement('div');sr.id='sr';sr.className='sr-only';sr.setAttribute('aria-live','polite');body.appendChild(sr);
window.announce=t=>{sr.textContent='';setTimeout(()=>{sr.textContent=t},40)};
const toastEl=document.createElement('div');toastEl.id='toast';toastEl.setAttribute('role','status');toastEl.hidden=true;body.appendChild(toastEl);
let toastT=0;
function toast(msg){toastEl.textContent=msg;toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>toastEl.hidden=true,2600)}

/* ---------- text size ---------- */
const SIZES=[['Normal',1],['Large',1.15],['Largest',1.3]];
let size=+store.get('cl.k','1')||1;
const applySize=()=>root.style.setProperty('--k',size);
applySize();

/* ---------- header: help button next to the mode switch, Continue pill next to Lessons ---------- */
const mx=$('#mx'),rt=document.createElement('div');rt.className='rt';mx.before(rt);
const help=document.createElement('button');help.id='helpbtn';help.type='button';help.className='hbtn';help.textContent='?';
help.setAttribute('aria-label','Help and tips');help.setAttribute('aria-haspopup','dialog');help.title='Help and tips (?)';
rt.append(help,mx);
const cont=document.createElement('button');cont.id='contbtn';cont.type='button';cont.className='contbtn';cont.hidden=true;
const lt=$('.lt');lt.appendChild(cont);
function updateContinue(){
  if(typeof LessonUI==='undefined'||mode()!=='explore'||!wide()){cont.hidden=true;return}
  const r=LessonUI.resume(),flyOpen=!body.classList.contains('tour-closed'),onLearn=typeof TAB!=='undefined'&&TAB==='learn';
  if(!r.started||(flyOpen&&onLearn)){cont.hidden=true;return}
  cont.hidden=false;cont.innerHTML=`<span class="cb-l">Continue</span><span class="cb-n">${r.name}</span><span class="cb-s">step ${r.step}/${r.total}</span>`;
  cont.title=`Continue ${r.name}, step ${r.step} of ${r.total}`;
}
cont.onclick=()=>{const r=LessonUI.resume();LessonUI.open(r.i)};

/* ---------- help panel ---------- */
const panel=document.createElement('div');panel.id='helppanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Help and tips');body.appendChild(panel);
let resetArmed=false;
function renderHelp(){
  panel.innerHTML=`<div class="hp-head"><b>Help and tips</b><button type="button" class="hp-x" aria-label="Close help">✕</button></div>
   <button type="button" class="hp-tour" id="hp-tour">Take the quick tour</button>
   <h3>Moving the model</h3>
   <ul class="hp-list"><li><b>Drag</b> to rotate</li><li><b>Scroll</b> or <b>pinch</b> to zoom</li><li><b>Tap an atom</b> to inspect it</li><li><b>Hover the name</b> above it for facts</li></ul>
   <h3>Shortcuts</h3>
   <ul class="hp-list keys"><li><kbd>?</kbd> this help</li><li><kbd>L</kbd> lessons roadmap</li><li><kbd>Esc</kbd> close the top panel</li><li><kbd>←</kbd><kbd>→</kbd> move between tabs</li></ul>
   <h3>Text size</h3>
   <div class="hp-seg" role="group" aria-label="Text size">${SIZES.map(([t,k])=>`<button type="button" data-k="${k}" class="${k===size?'on':''}">${t}</button>`).join('')}</div>
   <h3>Your progress</h3>
   <p class="hp-note">Saved in this browser. Finished lessons and steps show on the roadmap.</p>
   <button type="button" class="hp-reset ${resetArmed?'armed':''}" id="hp-reset">${resetArmed?'Click again to erase progress':'Reset my progress'}</button>`;
  panel.querySelector('.hp-x').onclick=closeHelp;
  $('#hp-tour').onclick=()=>{closeHelp();startTour(true)};
  panel.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{size=+b.dataset.k;store.set('cl.k',String(size));applySize();renderHelp();toast('Text size: '+SIZES.find(s=>s[1]===size)[0]);try{layout()}catch(e){}});
  $('#hp-reset').onclick=()=>{if(!resetArmed){resetArmed=true;renderHelp();setTimeout(()=>{if(resetArmed){resetArmed=false;if(!panel.hidden)renderHelp()}},4000);return}
    resetArmed=false;LessonUI.reset();renderHelp();updateContinue();toast('Progress reset')};
}
function openHelp(){renderHelp();panel.hidden=false;help.setAttribute('aria-expanded','true');const f=panel.querySelector('.hp-tour');f&&f.focus({preventScroll:true})}
function closeHelp(){panel.hidden=true;resetArmed=false;help.setAttribute('aria-expanded','false');help.focus({preventScroll:true})}
help.onclick=()=>panel.hidden?openHelp():closeHelp();
document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&e.target!==help)closeHelp()});

/* ---------- the quick tour (Explore, desktop) ---------- */
const STEPS=[
  {sel:'#tour .tabs',side:'right',t:'Lessons and tools',x:'Learn, Names, React, Forces and Practice live here. Click one and its panel slides out to the right.'},
  {sel:'#molbtn',side:'right',t:'Your molecule',x:'This is what you are looking at. Click “Change” to pick another molecule or to build your own.'},
  {sel:'#cv',side:'center',t:'The 3D model',x:'Drag to rotate, scroll or pinch to zoom, and tap any atom to inspect it. Hover the molecule’s name above for facts.'},
  {sel:'.tools',side:'left',t:'Display tools',x:'Change the 3D style, show labels or electrons, and save a picture. Hover any icon to see what it does.'},
  {sel:'#home',side:'below',t:'Lessons roadmap',x:'Every lesson on one map. Start anywhere, and your progress is saved.'}];
const coach=document.createElement('div');coach.id='coach';coach.hidden=true;coach.innerHTML='<div class="coach-ring"></div><div class="coach-b" role="dialog" aria-label="Quick tour"></div>';body.appendChild(coach);
let ti=0;
function placeCoach(){
  const s=STEPS[ti],el=$(s.sel),ring=coach.querySelector('.coach-ring'),b=coach.querySelector('.coach-b');if(!el)return endTour(false);
  const r=el.getBoundingClientRect(),pad=6,bw=b.offsetWidth||320,bh=b.offsetHeight||170,W=innerWidth,H=innerHeight;
  if(s.side=='center'){ring.style.opacity=0;const cx=parseFloat(getComputedStyle(root).getPropertyValue('--cx'))||W/2;b.style.left=Math.max(16,Math.min(W-bw-16,cx-bw/2))+'px';b.style.top=Math.max(16,H*.34)+'px';return}
  ring.style.opacity=1;ring.style.left=(r.left-pad)+'px';ring.style.top=(r.top-pad)+'px';ring.style.width=(r.width+pad*2)+'px';ring.style.height=(r.height+pad*2)+'px';
  let x,y;
  if(s.side=='right'){x=r.right+pad+16;y=r.top}else if(s.side=='left'){x=r.left-pad-16-bw;y=r.top}else{x=r.left;y=r.bottom+pad+16}
  b.style.left=Math.max(16,Math.min(W-bw-16,x))+'px';b.style.top=Math.max(16,Math.min(H-bh-16,y))+'px';
}
function paintCoach(){
  const s=STEPS[ti],b=coach.querySelector('.coach-b');
  b.innerHTML=`<div class="cb-dots" aria-hidden="true">${STEPS.map((_,i)=>`<i class="${i===ti?'on':''}"></i>`).join('')}</div><b>${s.t}</b><p>${s.x}</p>
    <div class="cb-row"><button type="button" class="cb-skip">Skip tour</button><span>${ti>0?'<button type="button" class="cb-back">Back</button>':''}<button type="button" class="cb-next">${ti===STEPS.length-1?'Done':'Next'}</button></span></div>`;
  b.querySelector('.cb-skip').onclick=()=>endTour(false);
  const bk=b.querySelector('.cb-back');if(bk)bk.onclick=()=>{ti--;paintCoach()};
  b.querySelector('.cb-next').onclick=()=>{if(ti===STEPS.length-1)endTour(true);else{ti++;paintCoach()}};
  placeCoach();b.querySelector('.cb-next').focus({preventScroll:true});
}
function startTour(manual){
  if(!wide())return toast('The tour is for larger screens');
  if(mode()!=='explore'){setUX('explore');setTimeout(()=>startTour(manual),700);return}
  document.body.classList.add('tour-closed');try{layout()}catch(e){}
  $('#map')&&($('#map').hidden=true);ti=0;coach.hidden=false;setTimeout(paintCoach,120);
}
function endTour(done){coach.hidden=true;store.set('cl.tour','1');if(done)toast('Tour finished. You can replay it from the ? button.');}
addEventListener('resize',()=>{if(!coach.hidden)placeCoach()});
function maybeTour(){                                       // only on a quiet screen: never close or cover something the person just opened
  if(store.get('cl.tour','0')==='1'||!wide()||mode()!=='explore')return;
  const m=$('#map'),pk=$('#pick');if((m&&!m.hidden)||(pk&&!pk.hidden)||!panel.hidden)return;
  if(!body.classList.contains('tour-closed'))return;
  startTour(false);
}

/* ---------- keyboard ---------- */
addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(!coach.hidden){endTour(false);e.stopImmediatePropagation();return}if(!panel.hidden){closeHelp();e.stopImmediatePropagation();return}}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const t=e.target,typing=t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable);if(typing)return;
  if(e.key==='?'){e.preventDefault();panel.hidden?openHelp():closeHelp()}
  else if((e.key==='l'||e.key==='L')&&typeof LessonUI!=='undefined'){e.preventDefault();LessonUI.map()}
},true);

/* ---------- wiring ---------- */
function wrap(name,fn){const o=window[name];if(typeof o!=='function')return;window[name]=function(){const r=o.apply(this,arguments);try{fn()}catch(e){console.warn('guide.js',name,e)}return r}}
wrap('titleUI',updateContinue);wrap('rightUI',updateContinue);
wrap('setUX',()=>{updateContinue();if(mode()==='explore')setTimeout(maybeTour,1100)});
new MutationObserver(updateContinue).observe(body,{attributes:true,attributeFilter:['class']});
addEventListener('resize',updateContinue);
updateContinue();
}catch(e){console.error('guide.js:',e)}
})();