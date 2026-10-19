/* learnmode.js — Learn tab toggles a compact panel anchored beside the collapsed left rail.
   Loads last, after guide.js.

   States
     off     normal Explore layout
     open    rail collapsed, panel visible
     shut    rail still collapsed, panel hidden (canvas uses the freed space)
   Learn tab:  off → open · open → off · shut → open
   ✕ / Esc / click outside:  open → shut          Esc while shut:  shut → off
   Switching to another tab, or leaving Explore mode, always returns to off. */
(function(){
'use strict';
try{
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
if(typeof MODEUX==='undefined'||typeof rightUI!=='function'){
  console.warn('learnmode.js: expected globals missing, skipping');return;
}

let state='off', lastFocus=null, resizeT=0, trackRAF=null;
const isOn=()=>state!=='off', isOpen=()=>state==='open';
const FOCUSABLE='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/* ---------- CSS ---------- */
const css=document.createElement('style');css.id='learnmode-css';css.textContent=`
body.learn-mode{
  --lm-rail:72px; --lm-gap:8px; --lm-reserve:320px; 
  --lm-w:460px; --lm-h:380px; /* Further reduced size */
}
#learnmode-live{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* panel shell (shared by desktop and mobile; geometry is set per breakpoint below) */
body.learn-mode:not(.guided) #tb{
  position:fixed !important;
  bottom:auto !important;
  height:auto !important;
  overflow-y:auto;
  overscroll-behavior:contain;
  padding:0 var(--s4) var(--s4) !important;
  z-index:var(--z-modal,40) !important;
  animation:none !important;
  border:0 !important;
  border-radius:var(--r-lg) !important;
  background:var(--glass) !important;
  box-shadow:var(--shadow-2) !important;
}
/* sticky close button; only the panel body scrolls */
body.learn-mode:not(.guided) #tb > .fly-x{
  position:sticky !important;
  top:8px !important;
  right:auto !important;
  display:block;
  margin:8px 8px 8px auto;
  width:36px;height:36px;line-height:34px;text-align:center;
  padding:0;
  border:1px solid var(--line);border-radius:50%;
  background:#fff;color:var(--muted);
  font-size:var(--fs-md);
  z-index:10;flex-shrink:0;
  box-shadow:var(--shadow-1);
  cursor:pointer;
}
body.learn-mode:not(.guided) #tb > .fly-x:hover{background:var(--accent-s);color:var(--accent)}
body.learn-mode:not(.guided) #tb > .fly-x:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

@media(min-width:861px){
  /* collapsed rail: icons only */
  body.learn-mode:not(.guided){ --rail:72px; }
  body.learn-mode .panels>.molbtn{padding:var(--s2) !important}
  body.learn-mode .molbtn .nm,
  body.learn-mode .molbtn .chg,
  body.learn-mode .molbtn .mol-exp,
  body.learn-mode .molbtn .mol-prev{display:none !important}
  body.learn-mode .molbtn .mol-open{display:flex;align-items:center;justify-content:center;width:100%;min-height:56px;padding:0}
  body.learn-mode .tabs button{justify-content:center !important;padding:0 !important;gap:0 !important}
  body.learn-mode .tabs button .lb{display:none}
  body.learn-mode .tabs button::after{display:none !important}
  body.learn-mode #colbtn{display:none !important}
  body.learn-mode .tabs button.on{background:var(--accent) !important;color:#fff !important}

  /* geometry set by JS alignModal(), fallback for initial paint */
  body.learn-mode:not(.guided) #tb{
    top:72px !important;
    left:96px !important;
    right:auto !important;
    width:min(var(--lm-w), calc(100vw - var(--margin,16px) - var(--lm-rail) - var(--lm-gap) - 24px - var(--lm-reserve))) !important;
    max-height:min(calc(100vh - 72px - 24px), var(--lm-h)) !important;
    transition:left 200ms ease-in-out, width 200ms ease-in-out !important;
  }

  /* animated rail; opt out with body.no-st-transition or prefers-reduced-motion */
  body:not(.guided) .panels>.molbtn{transition:width 200ms ease-in-out, padding 200ms ease-in-out}
  body:not(.guided) #tour>#tb{transition:left 200ms ease-in-out, width 200ms ease-in-out}
}

@media(max-width:860px){
  body.learn-mode .molbtn{display:none !important}
  body.learn-mode .scene{visibility:hidden}
  body.learn-mode:not(.guided) #tb{
    left:16px !important; right:16px !important;
    top:24px !important;
    width:auto !important; max-width:none !important;
    max-height:calc(100vh - 48px) !important;
  }
}

body.no-st-transition *{transition:none !important;animation:none !important}

@media(prefers-reduced-motion:reduce){
  body.learn-mode #tb,
  body.learn-mode #tour>#tb,
  body.learn-mode .panels>.molbtn{transition:none !important;animation:none !important}
}
`;document.head.appendChild(css);

/* ---------- helpers ---------- */
const live=document.createElement('div');live.id='learnmode-live';live.setAttribute('aria-live','polite');document.body.appendChild(live);
function announce(m){
  try{if(typeof window.announce==='function'){window.announce(m);return}}catch(e){}
  live.textContent='';setTimeout(()=>{live.textContent=m},30);
}
function relayout(){
  if(typeof layout==='function')try{layout()}catch(e){}
  clearTimeout(relayout._t);
  relayout._t=setTimeout(()=>{try{if(typeof layout==='function')layout()}catch(e){}},240);
}
function wrapLabels(){
  $$('.tabs button[data-tab]').forEach(b=>{
    [...b.childNodes].forEach(n=>{
      if(n.nodeType===3&&n.textContent.trim()){
        const s=document.createElement('span');
        s.className='lb';
        s.textContent=n.textContent.trim();
        b.replaceChild(s,n);
      }
    });
    if(!b.getAttribute('aria-label')){
      const lb=b.querySelector('.lb');
      if(lb&&lb.textContent.trim())b.setAttribute('aria-label',lb.textContent.trim());
    }
  });
}
function updateAria(){
  const b=$('.tabs [data-tab="learn"]');
  if(b)b.setAttribute('aria-expanded',String(isOpen()));
}
function ensureCloseButton(){
  const tb=$('#tb');if(!tb)return;
  if(!tb.querySelector(':scope > .fly-x')){
    tb.insertAdjacentHTML('afterbegin','<button class="fly-x" type="button" aria-label="Close panel">✕</button>');
  }
}
const visible=el=>!el.hidden&&el.type!=='hidden'&&el.getClientRects().length>0;
function focusFirstInModal(){
  const tb=$('#tb');if(!tb)return;
  const f=[...tb.querySelectorAll(FOCUSABLE)].find(el=>visible(el)&&!el.matches('.fly-x'))||tb.querySelector(':scope > .fly-x');
  if(f)try{f.focus({preventScroll:true})}catch(e){}
}
function focusLearnTab(){
  const t=$('.tabs [data-tab="learn"]');
  if(t)try{t.focus({preventScroll:true});return true}catch(e){}
  return false;
}
function closeSidePicker(){                       
  const p=$('#pick');
  if(p&&!p.hidden&&p.classList.contains('side')&&typeof closePick==='function')try{closePick()}catch(e){}
}

/* Measure the exact position of the rail and apply it directly to the modal */
function alignModal(){
  const tb=document.getElementById('tb');
  if(!tb||!document.body.classList.contains('learn-mode'))return;
  const cands=[document.getElementById('tour'),document.getElementById('molbtn')]
    .filter(el=>el&&el.offsetParent!==null);
  if(!cands.length)return;
  let top=Infinity, railRight=0;
  cands.forEach(el=>{
    const rr=el.getBoundingClientRect();
    if(rr.top < top) top = rr.top;
    if(rr.right > railRight) railRight = rr.right;
  });
  tb.style.setProperty('top', top + 'px', 'important');
  tb.style.setProperty('left', (railRight + 8) + 'px', 'important');
}

/* Follow the rail's width transition frame-by-frame */
function trackRail(dur){
  if(trackRAF) cancelAnimationFrame(trackRAF);
  const start=performance.now();
  function tick(now){
    alignModal();
    if(now-start<dur) trackRAF=requestAnimationFrame(tick);
    else trackRAF=null;
  }
  trackRAF=requestAnimationFrame(tick);
}

/* ---------- state transitions ---------- */
function enterLearn(){
  if(isOn())return;
  state='open';
  lastFocus=document.activeElement;
  closeSidePicker();
  document.body.classList.add('learn-mode');
  document.body.classList.remove('tour-closed');
  if(typeof TAB!=='undefined'&&TAB!=='learn'){TAB='learn';try{rightUI()}catch(e){}}
  ensureCloseButton();
  wrapLabels();updateAria();relayout();
  
  alignModal();      // Measure and align top/left instantly
  trackRail(300);    // Follow animation

  announce('Learn mode on. Press Escape or click outside to close the panel.');
  setTimeout(focusFirstInModal,0);
}
function closeModal(){
  if(!isOpen())return;
  state='shut';
  document.body.classList.add('tour-closed');       
  updateAria();relayout();
  focusLearnTab();
  announce('Panel closed. Learn mode stays on.');
}
function openModal(){
  if(state!=='shut')return;
  state='open';
  document.body.classList.remove('tour-closed');
  ensureCloseButton();
  updateAria();relayout();

  alignModal();      // Re-align on open
  trackRail(100);

  setTimeout(focusFirstInModal,0);
}
function exitLearn(silent){
  if(!isOn())return;
  state='off';
  document.body.classList.remove('learn-mode');
  if(MODEUX==='explore')document.body.classList.add('tour-closed');   
  updateAria();relayout();
  if(!silent){
    if(!focusLearnTab()&&lastFocus&&lastFocus.focus)try{lastFocus.focus({preventScroll:true})}catch(e){}
    announce('Learn mode off');
  }
  lastFocus=null;
}

/* ---------- handlers ---------- */
document.addEventListener('click',e=>{
  if(MODEUX!=='explore')return;
  const learnBtn=e.target.closest('.tabs [data-tab="learn"]');
  if(learnBtn){
    e.preventDefault();e.stopPropagation();
    if(state==='off')enterLearn();
    else if(state==='open')exitLearn();     
    else openModal();                       
    return;
  }
  if(!isOn())return;
  if(e.target.closest('.tabs [data-tab]:not([data-tab="learn"])'))exitLearn(true);
},true);

document.addEventListener('click',e=>{
  if(!isOpen())return;
  if(e.target.closest('#tb > .fly-x')){
    e.preventDefault();e.stopPropagation();
    closeModal();
  }
},true);

document.addEventListener('click',e=>{
  if(!isOpen())return;
  if(!e.target.isConnected)return;
  if(e.target.closest('#tb, .tabs, #pick, #namecard'))return;
  closeModal();
},false);

document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!isOn())return;
  if(document.querySelector('#helppanel:not([hidden]),#coach:not([hidden]),#pick:not([hidden]),#map:not([hidden]),#namecard:not([hidden])'))return;
  e.preventDefault();e.stopPropagation();
  if(isOpen())closeModal();else exitLearn();
},true);

document.addEventListener('keydown',e=>{
  if(!isOpen()||e.key!=='Tab')return;
  const tb=$('#tb');if(!tb)return;
  const tab=$('.tabs [data-tab="learn"]');
  const f=[...(tab?[tab]:[]),...[...tb.querySelectorAll(FOCUSABLE)].filter(visible)];
  if(!f.length)return;
  const first=f[0],last=f[f.length-1],active=document.activeElement;
  if(!f.includes(active)){e.preventDefault();(e.shiftKey?last:first).focus();return}
  if(e.shiftKey&&active===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&active===last){e.preventDefault();first.focus()}
},true);

window.addEventListener('resize',()=>{
  document.body.classList.add('no-st-transition');
  clearTimeout(resizeT);
  resizeT=setTimeout(()=>document.body.classList.remove('no-st-transition'),250);
  relayout();
  if(isOn()){ alignModal(); trackRail(120); }
});

if(window.ResizeObserver){
  const ro=new ResizeObserver(()=>{if(isOn())alignModal()});
  const t=document.getElementById('tour'), m=document.getElementById('molbtn');
  if(t)ro.observe(t);
  if(m)ro.observe(m);
}

const _rightUI=window.rightUI;
window.rightUI=function(){
  const r=_rightUI.apply(this,arguments);
  try{
    wrapLabels();updateAria();
    if(isOn()){
      if(MODEUX!=='explore'||(typeof TAB!=='undefined'&&TAB!=='learn'))exitLearn(true);
      else{
        ensureCloseButton();
        alignModal();
        trackRail(80);
      }
    }
  }catch(e){}
  return r;
};

wrapLabels();updateAria();
}catch(e){console.error('learnmode.js:',e)}
})();