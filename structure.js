/* structure.js — live structural drawings inside every lesson step and the Name lab.
   Wraps learnUI/namesUI/dockUI/hovUI/selSet/goTour and injects a compact "Structure" card.
   Pure DOM add-on: no existing file is edited except the one <script> line in index.html.

   How refreshes work: dockUI/selSet/goTour can fire several times per click, so refreshes are
   coalesced into one microtask, and the drawing and the challenge are only re-rendered (and
   re-bound) when their HTML actually changed. That keeps keyboard focus and hover state intact. */
(function(){
'use strict';
try{
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
if(typeof MODS==='undefined'||typeof learnUI!=='function'||typeof repHTML!=='function'||typeof desc!=='function'||typeof struct2D!=='function'){
  console.warn('structure.js: expected globals are missing, skipping');return;
}

/* ---------- state ---------- */
const ST={lit:[],live:''};
const EX={};
const shuffle=a=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]);
const K=()=>{try{return (typeof MODS!=='undefined'&&MODS[mod])?MODS[mod].key:-1}catch(e){return -1}};
const rep=()=>{try{return typeof REP!=='undefined'?REP:0}catch(e){return 0}};
const drawSmall=(n,o,s)=>{const old=(typeof SEL!=='undefined')?SEL:null;try{if(typeof SEL!=='undefined')SEL=null;return struct2D(n,o,s,{small:true})}finally{if(typeof SEL!=='undefined')SEL=old}};
const REPS=[['Structural','Structural'],['Semi','Semi-structural'],['Condensed','Condensed'],['Molecular','Molecular formula']];   // [visible, accessible]
const CHAL='<span class="st-chal">Challenge</span>';

function announce(m){                                        // clear first so a repeated message is read again
  ST.live=m;
  $$('.st-card [data-st-live]').forEach(l=>{l.textContent='';setTimeout(()=>{l.textContent=m},30)});
}
function setHTML(el,html){if(el.__h===html)return false;el.innerHTML=html;el.__h=html;return true}
function clearFocusIf(ids){try{if(ids&&typeof FOC!=='undefined'&&FOC===ids)FOC=null}catch(e){}}

/* ---------- exercise helpers ---------- */
function hasFG(){try{return SUB.some(g=>g.some(c=>c!=='CH3'))||ORD.some(o=>o>1)}catch(e){return false}}
function groupIds(){const ids=[];try{SUB.forEach((g,i)=>g.forEach(c=>{if(c!=='CH3')ids.push('S'+i+'_'+c)}));ORD.forEach((o,i)=>{if(o>1)ids.push('C'+i,'C'+(i+1))})}catch(e){}return ids}
function idsForPart(kind){
  const ids=[];
  try{
    if(kind==='stem'){for(let i=0;i<N;i++)ids.push('C'+i)}
    else if(kind==='unsat'){ORD.forEach((o,i)=>{if(o>1)ids.push('C'+i,'C'+(i+1))})}
    else if(kind==='suf'||kind==='ester'){SUB.forEach((g,i)=>g.forEach(c=>{if(c!=='CH3')ids.push('S'+i+'_'+c)}))}
    else if(kind==='pre'){SUB.forEach((g,i)=>g.forEach(c=>{if(c==='CH3'||c==='Cl'||c==='Br')ids.push('S'+i+'_'+c)}))}
  }catch(e){}
  return ids;
}
function bondParts(i){
  const id='C'+i, by={}; let tot=0;
  try{
    Object.values(B).forEach(b=>{
      if(!b.alive)return; if(b.a!==id&&b.b!==id)return;
      const other=A[b.a===id?b.b:b.a]; if(!other)return;
      by[other.el]=(by[other.el]||0)+b.o; tot+=b.o;
    });
  }catch(e){}
  const names={C:'carbon',H:'hydrogen',O:'oxygen',Cl:'chlorine',Br:'bromine'};
  const text=Object.keys(by).map(el=>`${by[el]} to ${names[el]||el}`).join(' + ');
  return{tot,text};
}
function atomLabel(id){                                      // screen-reader name for a drawing target
  let m=/^C(\d+)$/.exec(id);if(m)return 'Carbon '+(+m[1]+1);
  m=/^S(\d+)_(.+?)\d*$/.exec(id);if(m)return `${m[2].replace('=O','C=O')} group on carbon ${+m[1]+1}`;
  return 'Atom '+id;
}

/* ---------- exercises ---------- */
function exBonds(){
  const e=EX[0]||(EX[0]={});
  const nm=desc().name;
  if(e.mol!==nm){e.mol=nm;e.tapped=null;ST.lit=[]}
  if(e.tapped==null)return `${CHAL}<p class="st-q">Tap a carbon in the drawing. Count the lines around it (a double bond counts as two).</p>`;
  const {tot,text}=bondParts(e.tapped);
  return `${CHAL}<p class="st-q">Carbon ${e.tapped+1} has <b>${tot} lines</b>: ${text}. ${tot===4?'Every carbon has exactly 4 lines.':''}</p>`;
}
function exGroup(){
  const e=EX[1]||(EX[1]={});
  const nm=desc().name;
  if(e.mol!==nm){clearFocusIf(e.ids);e.mol=nm;e.done=false;e.ids=null;e.msg='';ST.lit=[]}   // new molecule: drop the old spotlight too
  if(!hasFG())return `${CHAL}<p class="st-q">This molecule is an alkane: it has no functional group, only C–C and C–H bonds.</p>`;
  if(e.done)return `${CHAL}<p class="st-q st-ok">Found it! That is the functional group. It stays lit in the drawing and in 3D.</p>`;
  return `${CHAL}<p class="st-q">Tap the functional group in the drawing: the atoms that are not part of the plain carbon chain.</p>${e.msg?`<p class="st-hint">${e.msg}</p>`:''}`;
}
function makeOpts(){
  const m=desc();
  const right={n:N,o:ORD.slice(),s:SUB.map(g=>g.slice()),name:m.name};
  let pool=LIBFLAT.filter(x=>x.mf==m.mf&&analyse(x.n,x.o,x.s).name!==m.name);
  if(pool.length<2)pool=LIBFLAT.filter(x=>x.n===N&&analyse(x.n,x.o,x.s).name!==m.name);
  if(pool.length<2)pool=LIBFLAT.filter(x=>analyse(x.n,x.o,x.s).name!==m.name);
  const wrong=shuffle(pool).slice(0,2).map(x=>({n:x.n,o:x.o,s:x.s,name:analyse(x.n,x.o,x.s).name}));
  return shuffle([right,...wrong]);
}
function exMatch(){
  const e=EX[6]||(EX[6]={});
  const nm=desc().name;
  if(e.mol!==nm||!e.opts){e.mol=nm;e.chosen=null;e.done=false;e.msg='';e.opts=makeOpts()}
  const target=cond(N,ORD,SUB);
  return `${CHAL}<p class="st-q">Which drawing matches this condensed formula?<br><b class="st-cond">${target}</b></p>
    <div class="st-opts">${e.opts.map((o,i)=>{
      const good=e.done&&o.name===nm, bad=e.chosen===i&&o.name!==nm;
      return `<button type="button" class="st-opt ${good?'on':''} ${bad?'bad':''}" data-st-opt="${i}" aria-label="Drawing ${i+1}${good?' (correct)':bad?' (not this one)':''}"><span class="st-opt-draw">${drawSmall(o.n,o.o,o.s)}</span></button>`}).join('')}</div>
    ${e.msg?`<p class="st-hint">${e.msg}</p>`:''}
    <button type="button" class="st-btn" data-st-another>Another one</button>`;
}
function exNameTiles(){
  const p=parseName(desc().name);
  if(p.error)return '';
  return `${CHAL}<p class="st-q">Hover or focus a piece of the name: the matching atoms light up in the drawing and in 3D.</p>
    <div class="st-tiles">${p.comps.map(c=>`<button type="button" class="st-tile k-${c.k}" data-st-part="${c.k}">${c.t}</button>`).join('')}</div>`;
}
function exIsomers(){
  const m=desc(), list=LIBFLAT.filter(x=>x.mf==m.mf);
  if(list.length<2)return `${CHAL}<p class="st-q">No other isomers in the library for ${m.mf}.</p>`;
  return `${CHAL}<p class="st-q">Same atoms, joined differently. Tap a drawing to build that isomer in 3D.</p>
    <div class="st-gal">${list.map(x=>{const nm=analyse(x.n,x.o,x.s).name;return `<button type="button" class="st-gal-i ${nm===m.name?'on':''}" data-st-iso="${x.name}" aria-label="${nm}${nm===m.name?' (showing now)':''}"><span class="st-gal-d">${drawSmall(x.n,x.o,x.s)}</span><b>${nm}</b></button>`}).join('')}</div>
    <p class="st-hint">Same formula (${m.mf}), different structure: isomers.</p>`;
}
function exRx(){
  const L=(typeof LAST!=='undefined')?LAST:null;
  if(!L)return `${CHAL}<p class="st-q">Press the reaction button above, then compare the drawings: which bonds changed?</p>`;
  if(!L.before||!L.after)return `${CHAL}<p class="st-q">Nothing reacted, so the drawing did not change. Why not?</p>`;
  if($('#tb .ba'))return `${CHAL}<p class="st-q">Compare the two drawings above. Count the lines on each carbon before and after: which bonds changed?</p>`;   // the lesson already shows before/after
  let bn='',an='';
  try{bn=analyse(L.before[0],L.before[1],L.before[2]).name}catch(e){}
  try{an=analyse(L.after[0],L.after[1],L.after[2]).name}catch(e){}
  return `${CHAL}
    <div class="st-ba"><div><span class="st-ba-l">Before</span>${drawSmall(L.before[0],L.before[1],L.before[2])}<b>${bn}</b></div><span class="st-arrow" aria-hidden="true">→</span><div><span class="st-ba-l">After</span>${drawSmall(L.after[0],L.after[1],L.after[2])}<b>${an}</b></div></div>
    <p class="st-hint">${L.type||''} reaction. Compare the drawings: which bonds changed?</p>`;
}
function exHTML(){
  try{
    const k=K(); if(k<0)return '';
    if(k===0)return exBonds();
    if(k===1)return exGroup();
    if(k===6)return exMatch();
    if(k===5)return exNameTiles();
    if(k===2)return exIsomers();
    if(k===3)return exRx();
    return '';
  }catch(e){console.warn('structure.js exercise',e);return''}
}

/* ---------- card ---------- */
function stCardHTML(lab){
  return `<section class="st-card" aria-label="Structure" ${lab?'data-st-lab':''}>
    <div class="st-head"><span class="st-lab">Structure</span>
      <div class="st-tabs" role="tablist" aria-label="Structure notation">${REPS.map(([t,full],i)=>`<button type="button" role="tab" aria-label="${full}" data-st-rep="${i}">${t}</button>`).join('')}</div></div>
    <div class="st-draw" data-st-draw></div>
    <div class="sr-only" data-st-live aria-live="polite">${ST.live||''}</div>
    ${lab?'':'<div class="st-ex" data-st-ex></div>'}
  </section>`;
}
function syncHov(){
  const id=(typeof HOV!=='undefined')?HOV:null;
  const lit=ST.lit||[];
  $$('.st-card .st-draw [data-id]').forEach(g=>{
    const gid=g.dataset.id;
    const on=(id&&gid===id)||lit.some(p=>gid===p||(typeof p==='string'&&p[0]==='S'&&gid.startsWith(p)));
    g.classList.toggle('hov',!!on);
  });
}
function hlCard(ids){ST.lit=ids||[];syncHov()}
function reapplyEx(){
  try{
    if(K()===1){const e=EX[1];if(e&&e.done&&e.ids){ST.lit=e.ids;if(typeof FOC!=='undefined')FOC=e.ids;syncHov()}}
  }catch(e){}
}
function exTap(id){
  const k=K(); if(k<0)return;
  if(k===0){
    if(/^C\d+$/.test(id)){
      const e=EX[0]||(EX[0]={}); e.mol=desc().name; e.tapped=+id.slice(1);
      const {tot,text}=bondParts(e.tapped); announce(`Carbon ${e.tapped+1} has ${tot} lines: ${text}.`);
      refreshAllCards();
    }
    return;
  }
  if(k===1){
    const e=EX[1]||(EX[1]={}); if(e.done||!hasFG())return;
    let ok=false;
    if(/^S/.test(id)&&!id.includes('CH3'))ok=true;
    if(ORD.some(o=>o>1)){
      const m=/^C(\d+)$/.exec(id);
      if(m){const i=+m[1];if((i>0&&ORD[i-1]>1)||(i<ORD.length&&ORD[i]>1))ok=true}
    }
    if(ok){e.done=true;e.ids=groupIds();e.msg='';announce('Correct. That is the functional group.')}
    else{e.msg='That is part of the carbon chain. Look for atoms that are not C or H (or a carbon on a double/triple bond).';announce(e.msg)}
    refreshAllCards();
  }
}
function chooseOpt(i){
  const e=EX[6]; if(!e||!e.opts||e.done)return;
  const o=e.opts[i]; if(!o)return;
  if(o.name===desc().name){e.done=true;e.chosen=i;e.msg='Yes: same atoms, same bonds, same molecule.';announce(e.msg)}
  else{e.chosen=i;e.msg='Not this one. Count the carbons and the groups, then try again.';announce(e.msg)}
  refreshAllCards();
}
function anotherMatch(){
  try{
    const m=desc(), pool=LIBFLAT.filter(x=>analyse(x.n,x.o,x.s).name!==m.name);
    if(pool.length){const x=pool[Math.floor(Math.random()*pool.length)];EX[6]={};load(x.name);return}
  }catch(e){}
  EX[6]={};refreshAllCards();
}

/* ---------- binding ---------- */
function activate(id){
  try{if(typeof select==='function')select(id)}catch(e){}
  exTap(id);
}
function bindDraw(root){                                     // works for SVG <g> and for the condensed-formula <span>s
  root.querySelectorAll('[data-id]').forEach(g=>{
    const id=g.dataset.id;
    if(/^C\d+$/.test(id)||/^S/.test(id)){g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',atomLabel(id))}
    const on=()=>{try{if(typeof HOV!=='undefined'){HOV=id;hovUI()}}catch(e){}};
    const off=()=>{try{if(typeof HOV!=='undefined'){HOV=null;hovUI()}}catch(e){}};
    g.addEventListener('mouseenter',on);g.addEventListener('mouseleave',off);
    g.addEventListener('focusin',on);g.addEventListener('focusout',off);
    g.addEventListener('click',()=>activate(id));
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(id)}});
  });
}
function bindEx(root){
  root.querySelectorAll('[data-st-opt]').forEach(b=>b.onclick=()=>chooseOpt(+b.dataset.stOpt));
  const an=root.querySelector('[data-st-another]');if(an)an.onclick=anotherMatch;
  root.querySelectorAll('[data-st-iso]').forEach(b=>b.onclick=()=>{try{load(b.dataset.stIso)}catch(e){}});
  root.querySelectorAll('[data-st-part]').forEach(b=>{
    const on=()=>{try{const ids=idsForPart(b.dataset.stPart);hlCard(ids);if(typeof FOC!=='undefined')FOC=ids;announce(b.textContent)}catch(e){}};
    const off=()=>{try{if(typeof FOC!=='undefined')FOC=null;hlCard([])}catch(e){}};
    b.addEventListener('mouseenter',on);b.addEventListener('focus',on);
    b.addEventListener('mouseleave',off);b.addEventListener('blur',off);
  });
}
function setRepSafe(i){try{if(typeof setRep==='function')setRep(i)}catch(e){}}
function bindRep(card){                                      // once per card: the tab buttons are never re-rendered
  const tabs=[...card.querySelectorAll('[data-st-rep]')];
  tabs.forEach((b,i)=>{
    b.onclick=()=>setRepSafe(i);
    b.onkeydown=e=>{
      let j=-1;
      if(e.key==='ArrowRight')j=(i+1)%tabs.length;
      else if(e.key==='ArrowLeft')j=(i+tabs.length-1)%tabs.length;
      else if(e.key==='Home')j=0;
      else if(e.key==='End')j=tabs.length-1;
      if(j<0)return;
      e.preventDefault();setRepSafe(j);tabs[j].focus();
    };
  });
}
function syncRepTabs(card){
  const r=rep();
  card.querySelectorAll('[data-st-rep]').forEach(b=>{
    const on=+b.dataset.stRep===r;
    b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;
  });
}

/* ---------- refresh ---------- */
function focusKey(){                                         // how to find the focused control again after a re-render
  const a=document.activeElement;
  if(!a||!a.closest||!a.closest('.st-card'))return null;
  for(const attr of ['data-id','data-st-opt','data-st-iso','data-st-part','data-st-another']){
    if(a.hasAttribute(attr))return `.st-card [${attr}="${CSS.escape(a.getAttribute(attr))}"]`;
  }
  return null;
}
function fill(card){
  const draw=card.querySelector('[data-st-draw]'), ex=card.querySelector('[data-st-ex]');
  if(draw&&setHTML(draw,repHTML(desc())))bindDraw(draw);
  if(ex&&setHTML(ex,exHTML()))bindEx(ex);
  syncRepTabs(card);
}
function refreshNow(){
  try{
    if(typeof QUIZ!=='undefined'&&QUIZ){$$('.st-card').forEach(e=>e.remove());return}
    const prev=document.activeElement, fk=focusKey();
    $$('.st-card').forEach(fill);
    reapplyEx();syncHov();
    if(fk&&prev&&!prev.isConnected){const el=$(fk);if(el)try{el.focus({preventScroll:true})}catch(e){}}
  }catch(e){console.warn('structure.js refresh',e)}
}
let pending=false;
function refreshAllCards(){if(pending)return;pending=true;queueMicrotask(()=>{pending=false;refreshNow()})}

/* ---------- injection ---------- */
function mountCard(lab){
  const tpl=document.createElement('template');tpl.innerHTML=stCardHTML(lab).trim();
  const card=tpl.content.firstElementChild;bindRep(card);return card;
}
function injectLesson(){
  const tb=$('#tb'); if(!tb)return;
  const old=tb.querySelector('.st-card'); if(old)old.remove();
  if(typeof QUIZ!=='undefined'&&QUIZ)return;
  if(!tb.querySelector('.lz-top, .kick'))return;             // .lz-top from the guided markup, .kick from lessons.js
  if(typeof MODS==='undefined'||typeof mod==='undefined')return;
  const S=MODS[mod]&&MODS[mod].steps, s=S&&S[tourStep];
  if(s&&s.q&&(typeof answered==='undefined'||answered[mod+'.'+tourStep]==null))return;   // don't give away a prediction
  ST.lit=[];ST.live='';
  const card=mountCard(false);
  const anchor=tb.querySelector('div.try, .do, #act, .nav');  // above the task, below the explanation
  if(anchor)anchor.before(card);else tb.append(card);
  fill(card);reapplyEx();syncHov();
}
function bindNameTiles(){
  const tb=$('#tb'); if(!tb)return;
  tb.querySelectorAll('.nl-tile[data-k]').forEach(t=>{
    const on=()=>{try{hlCard(idsForPart(t.dataset.k))}catch(e){}};
    const off=()=>{try{hlCard([])}catch(e){}};
    t.addEventListener('mouseenter',on);t.addEventListener('focus',on);
    t.addEventListener('mouseleave',off);t.addEventListener('blur',off);
  });
}
function injectNames(){
  const tb=$('#tb'); if(!tb)return;
  const old=tb.querySelector('.st-card'); if(old)old.remove();
  if(typeof QUIZ!=='undefined'&&QUIZ)return;
  const nc=tb.querySelector('.nl-namecard, .nmrow'); if(!nc)return;   // .nmrow from lessons.js
  ST.lit=[];ST.live='';
  const card=mountCard(true);
  nc.after(card);
  fill(card);bindNameTiles();
}

/* ---------- styles ---------- */
const css=document.createElement('style');css.id='structure-css';css.textContent=`
.st-card{margin:var(--s3) 0;border:1px solid var(--line);border-radius:var(--r-lg);background:#fff;padding:var(--s3);display:flex;flex-direction:column;gap:var(--s2)}
.st-card .sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.st-head{display:flex;align-items:center;justify-content:space-between;gap:var(--s2);flex-wrap:wrap}
.st-lab{font-size:var(--fs-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.st-tabs{display:flex;gap:2px;padding:2px;border-radius:var(--r-pill);background:#eef3f9}
.st-tabs button{min-height:32px;padding:0 var(--s2);border:0;border-radius:var(--r-pill);background:none;font-size:var(--fs-xs);font-weight:600;color:var(--muted)}
.st-tabs button.on{background:#fff;color:var(--accent);box-shadow:0 1px 3px rgba(20,33,61,.12)}
.st-draw{display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:72px;max-height:160px}
.st-draw svg{width:100%!important;height:auto!important;max-height:150px;display:block}
.st-draw .big{font-size:calc(22px * var(--k,1));font-weight:700;text-align:center;line-height:1.4}
.st-card .hb2{cursor:pointer;border-radius:6px;padding:0 2px}
.st-card .hb2.hov{background:var(--accent-s)}
.st-card g.hov .hb{fill:#dbe7ff}
.st-ex{margin-top:var(--s2);padding-top:var(--s2);border-top:1px dashed var(--line);display:flex;flex-direction:column;gap:var(--s2)}
.st-ex:empty{display:none}
.st-chal{display:inline-block;align-self:flex-start;padding:1px var(--s2);border-radius:var(--r-pill);background:#fff0d1;color:#7a4b00;font-size:var(--fs-xs);font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.st-q{margin:0;font-size:var(--fs-sm);line-height:1.45;color:#22314a}
.st-ok{color:#0a6446;font-weight:700}
.st-hint{margin:0;font-size:var(--fs-sm);color:#6b4200;line-height:1.4}
.st-cond{font-size:var(--fs-md);color:var(--ink)}
.st-tiles{display:flex;flex-wrap:wrap;gap:var(--s1)}
.st-tile{min-height:32px;padding:0 var(--s2);border:1px solid var(--line);border-radius:var(--r-md);background:#fff;font-size:var(--fs-sm);font-weight:700}
.st-opts{display:grid;grid-template-columns:1fr;gap:var(--s2)}
.st-opt{display:flex;flex-direction:column;align-items:center;gap:2px;min-height:64px;padding:var(--s1);border:2px solid var(--line);border-radius:var(--r-md);background:#fff;transition:border-color .15s,background .15s}
.st-opt.on{border-color:#0f7a55;background:#e2f6ec}
.st-opt.bad{border-color:#c0392b;background:#fdeceb}
.st-opt-draw{display:block;width:100%;height:64px;overflow:hidden}
.st-opt-draw svg{width:100%!important;height:100%!important;max-height:none!important}
.st-btn{min-height:32px;padding:0 var(--s3);border:1px solid var(--line);border-radius:var(--r-pill);background:#fff;font-size:var(--fs-sm);font-weight:600;color:var(--ink)}
.st-gal{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2)}
.st-gal-i{display:flex;flex-direction:column;align-items:center;gap:2px;padding:var(--s1);border:2px solid var(--line);border-radius:var(--r-md);background:#fff}
.st-gal-i.on{border-color:var(--accent);background:var(--accent-s)}
.st-gal-d{display:block;width:100%;height:64px;overflow:hidden}
.st-gal-d svg{width:100%!important;height:100%!important;max-height:none!important}
.st-gal-i b{font-size:var(--fs-xs);line-height:1.2;text-align:center;overflow-wrap:anywhere}
.st-ba{display:flex;align-items:center;gap:var(--s2);overflow-x:auto}
.st-ba>div{display:flex;flex-direction:column;align-items:center;min-width:0}
.st-ba svg{max-height:90px!important;width:auto!important}
.st-ba-l{font-size:var(--fs-xs);font-weight:700;text-transform:uppercase;color:var(--muted)}
.st-ba b{font-size:var(--fs-xs);text-align:center;line-height:1.2;overflow-wrap:anywhere}
.st-arrow{font-size:var(--fs-lg);color:var(--muted)}
.st-card [data-id]{cursor:pointer;outline:none}
.st-card g[data-id]:focus-visible .hb{stroke:var(--accent);stroke-width:2}
.st-card .hb2:focus-visible,.st-tabs button:focus-visible,.st-tile:focus-visible,.st-opt:focus-visible,.st-gal-i:focus-visible,.st-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#wg .wg-view .wg-chips[aria-label="Drawing"]{display:none!important}
@media(pointer:coarse){.st-tabs button,.st-tile,.st-btn,.st-opt,.st-gal-i{min-height:var(--target)}}
@media(prefers-reduced-motion:reduce){.st-card *{transition:none!important;animation:none!important}}
`;document.head.appendChild(css);

/* ---------- wrappers ---------- */
const _learnUI=window.learnUI;
if(typeof _learnUI==='function')window.learnUI=function(){const r=_learnUI.apply(this,arguments);try{injectLesson()}catch(e){console.warn('structure.js learnUI',e)}return r};
const _namesUI=window.namesUI;
if(typeof _namesUI==='function')window.namesUI=function(){const r=_namesUI.apply(this,arguments);try{injectNames()}catch(e){console.warn('structure.js namesUI',e)}return r};
const _dockUI=window.dockUI;
if(typeof _dockUI==='function')window.dockUI=function(){const r=_dockUI.apply(this,arguments);try{refreshAllCards()}catch(e){console.warn('structure.js dockUI',e)}return r};
const _hovUI=window.hovUI;
if(typeof _hovUI==='function')window.hovUI=function(){const r=_hovUI.apply(this,arguments);try{syncHov()}catch(e){}return r};
const _selSet=window.selSet;
if(typeof _selSet==='function')window.selSet=function(){const r=_selSet.apply(this,arguments);try{refreshAllCards()}catch(e){}return r};
const _goTour=window.goTour;
if(typeof _goTour==='function')window.goTour=function(i){
  try{const k=K();if(k>=0){EX[k]={};ST.lit=[];ST.live='';if(typeof FOC!=='undefined')FOC=null}}catch(e){}   // the step's own go() sets any focus it needs afterwards
  const r=_goTour.apply(this,arguments);
  try{refreshAllCards()}catch(e){}
  return r;
};

/* ---------- first paint of the already-rendered view ---------- */
try{
  if(document.querySelector('#tb .lz-top, #tb .kick'))injectLesson();
  else if(document.querySelector('#tb .nl-namecard, #tb .nmrow'))injectNames();
  refreshAllCards();
}catch(e){console.warn('structure.js init',e)}

}catch(e){console.error('structure.js:',e)}
})();