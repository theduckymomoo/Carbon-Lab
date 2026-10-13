/* lessonui.js — the lessons, redesigned (loads after lessons.js).

   * Roadmap: every lesson as a node on a path, with progress. Pick any lesson and start (or resume) there.
   * Lesson view: a step road, then each step broken into  Key idea -> What to notice -> Your turn,
     instead of a paragraph.
   * Interactive widgets that use the 3D model and the structural views:
       - "See it as": switch structural / semi-structural / condensed / formula and the 3D style
       - "Spotlight": light up the carbons, the multiple bond or the functional group in 3D AND in the drawing
       - lesson specific: bond counter (lesson 1), isomer chips (lesson 3), boiling-point meter (lesson 5)
   It replaces learnUI, finUI, showMap and startLesson by re-assigning them; nothing else in lessons.js changes. */
(function(){
'use strict';
if(typeof MODS==='undefined'||typeof learnUI!=='function'){console.warn('lessonui.js: lessons.js not found, skipping');return}
try{

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const NAME=m=>m.n.replace(/^\d+ · /,'');
let POS={};try{POS=JSON.parse(localStorage.getItem('carbonlab.pos')||'{}')}catch(e){}
const savePos=()=>{try{localStorage.setItem('carbonlab.pos',JSON.stringify(POS))}catch(e){}};
let LVIEW='road',SPOT=null,BPLOG=[],WGOPEN=false;

const IC={
 chev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
 back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
 check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 idea:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
 hand:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l5.5 15 2.4-6.1L19 10.5z"/></svg>',
 star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>'};

/* ---------- progress ---------- */
Object.keys(POS).forEach(k=>{if(typeof POS[k]==='number')POS[k]=[...Array(POS[k]).keys()]});   // older saves stored a count
const seen=i=>POS[MODS[i].key]||[];
const nSeen=i=>new Set(seen(i)).size;
const reached=i=>seen(i).length?Math.max(...seen(i))+1:0;
const firstTodo=()=>{const i=MODS.findIndex(m=>!DONE.has(m.key));return i<0?0:i};
const resumeIdx=()=>{const p=MODS.findIndex((m,i)=>!DONE.has(m.key)&&nSeen(i)>0);return p>=0?p:firstTodo()};
const _goTour=window.goTour;
window.goTour=function(i){SPOT=null;if(MODS[mod].key==4&&i===0)BPLOG=[];const r=_goTour.apply(this,arguments);
  const k=MODS[mod].key,a=POS[k]||(POS[k]=[]);if(!a.includes(tourStep))a.push(tourStep);savePos();return r};

/* ---------- the roadmap ----------
   Sections group the lessons; each lesson is a node on the spine. Left: what you'll learn. Right: its steps, one box each.
   Full (wide) version has the central spine and dotted branches; the compact version (side panel / narrow screens)
   keeps the spine on the left and folds the steps under each lesson. */
const SECTIONS=[
  {t:'Building a strong foundation',lessons:[0,1]},
  {t:'Speaking the language of molecules',lessons:[2,3]},
  {t:'Same atoms, different behaviour',lessons:[4,5]},
  {t:'Putting it to work',lessons:[6]}];
const PRACTICE=['Name it','Build it','Spot the group','Predict the product','Rank boiling points'];
let RCOPEN=null;
const stateOf=i=>{const x=MODS[i],d=DONE.has(x.key),cur=STARTED&&i==mod&&(MODEUX=='explore'?LVIEW=='lesson':!PRACMODE);
  return d?'done':cur?'cur':nSeen(i)>0?'part':i==firstTodo()?'next':'todo'};
const stepCls=(i,k)=>{const x=MODS[i],cur=STARTED&&i==mod&&k==tourStep&&(MODEUX=='explore'?LVIEW=='lesson':!PRACMODE);return(cur?'cur ':'')+((DONE.has(x.key)||seen(i).includes(k))?'f':'')};
const doneCount=()=>MODS.filter(m=>DONE.has(m.key)).length;

function roadFull(){
  let r=0;
  const stepsHTML=(i,x)=>x.steps.map((s,k)=>`<button type="button" class="rm-box step ${stepCls(i,k)}" data-open="${i}" data-at="${k}" title="Open this step">${(DONE.has(x.key)||seen(i).includes(k))?`<span class="rm-ck s">${IC.check}</span>`:''}${s.t}</button>`).join('');
  const tip=(id,tag,title,sum,list,foot)=>`<div class="rm-tip" id="tip-${id}" role="tooltip"><span class="rm-tag2">${tag}</span><b>${title}</b><p>${sum}</p>
      <span class="rm-tl">What you'll learn</span><ul>${list.map(t=>`<li>${t}</li>`).join('')}</ul><span class="rm-foot">${foot}</span></div>`;
  const row=i=>{
    const x=MODS[i],st=stateOf(i),n=x.steps.length,done=DONE.has(x.key),lab=st=='done'?'Review':st=='part'||st=='cur'?'Continue':'Start',flip=(r++)%2==1,
      steps=`<div class="rm-steps">${stepsHTML(i,x)}</div>`,
      t=tip(i,'Lesson '+(i+1),NAME(x),MODMETA[x.key].d,MODMETA[x.key].recap,`${n} steps · click to ${lab.toLowerCase()}`);
    return`<div class="rm-row ${flip?'flip':''}" data-l="${i}">
      <div class="rm-cell l">${flip?steps:t}</div>
      <button type="button" class="rm-node ${st}" data-open="${i}" aria-describedby="tip-${i}" aria-label="${lab} lesson ${i+1}: ${NAME(x)}">
        ${st=='next'?'<span class="rm-tag">Start here</span>':''}${done?`<span class="rm-ck">${IC.check}</span>`:''}
        <span class="rm-num">Lesson ${i+1}</span><b>${NAME(x)}</b><span class="rm-sum">${MODMETA[x.key].d}</span>
        <span class="rm-dots" aria-hidden="true">${x.steps.map((_,k)=>`<i class="${done||seen(i).includes(k)?'f':''}"></i>`).join('')}</span></button>
      <div class="rm-cell r">${flip?t:steps}</div></div>`};
  const secDone=s=>s.lessons.filter(i=>DONE.has(MODS[i].key)).length;
  const secs=SECTIONS.map(s=>`<div class="rm-label">${s.t}<small>${secDone(s)} of ${s.lessons.length} lessons done</small></div>${s.lessons.map(row).join('')}`).join('');   // rows first, so left/right alternation starts at lesson 1
  const flipP=(r++)%2==1,pSteps=`<div class="rm-steps">${PRACTICE.map(p=>`<button type="button" class="rm-box step blue" data-practice="1">${p}</button>`).join('')}</div>`,
    pTip=tip('p','Practice','Practice','Mixed questions that check what you know.',['Hints on every question','Walk-through explanations','Questions adapt to your weak spots'],`${PRACTICE.length} kinds of question · click to start`);
  return`<div class="rm" id="rm"><svg class="rm-lines" aria-hidden="true"></svg><div class="rm-spine" aria-hidden="true"><i class="fill"></i></div>
    <div class="rm-legend" aria-label="Legend"><b>Key</b><span><i class="k todo"></i>Not started</span><span><i class="k part"></i>In progress</span><span><i class="k done"></i>Done</span><span><i class="k cur"></i>You are here</span></div>
    <div class="rm-hint"><b>How to use this</b>Hover a lesson to see what it covers. Click a lesson to start it, or any box to jump straight to that step.</div>
    <div class="rm-top"><b>Organic chemistry</b><small>Grade 12 · ${MODS.length} lessons</small></div>
    ${secs}
    <div class="rm-label">Check what you know<small>When you're ready</small></div>
    <div class="rm-row ${flipP?'flip':''}" data-l="p"><div class="rm-cell l">${flipP?pSteps:pTip}</div>
      <button type="button" class="rm-node blue" data-practice="1" aria-describedby="tip-p"><b>Practice</b><span class="rm-num">Mixed questions</span><span class="rm-sum">Mixed questions that check what you know.</span></button>
      <div class="rm-cell r">${flipP?pTip:pSteps}</div></div>
    <div class="rm-row rm-end"><span></span><button type="button" class="rm-node blue" data-free="1"><b>Explore freely</b><span class="rm-num">Open every tool, build your own</span></button><span></span></div></div>`;
}
function roadCompact(){
  const open=RCOPEN||(RCOPEN=new Set([resumeIdx()]));
  const lesson=i=>{
    const x=MODS[i],st=stateOf(i),n=x.steps.length,ns=DONE.has(x.key)?n:nSeen(i),o=open.has(i);
    return`<div class="rc-l ${st} ${o?'open':''}" data-l="${i}" style="--p:${ns/n*100}%"><div class="rc-top">
      <button type="button" class="rc-node" data-open="${i}" title="${MODMETA[x.key].d.replace(/"/g,'&quot;')}"><span class="rc-dot">${st=='done'?IC.check:i+1}</span><span class="rc-t"><b>${NAME(x)}</b><small>${st=='next'?'Start here':ns+' of '+n+' steps'}</small></span></button>
      <button type="button" class="rc-tg" data-tg="${i}" aria-expanded="${o}" aria-label="Show the steps of ${NAME(x)}">${IC.chev}</button></div>
      <ul class="rc-steps">${x.steps.map((s,k)=>`<li><button type="button" class="rm-box step ${stepCls(i,k)}" data-open="${i}" data-at="${k}">${(DONE.has(x.key)||seen(i).includes(k))?`<span class="rm-ck s">${IC.check}</span>`:''}${s.t}</button></li>`).join('')}</ul></div>`};
  return`<div class="rc"><div class="rc-spine" aria-hidden="true"></div>
    ${SECTIONS.map(s=>`<h3 class="rc-sec">${s.t}</h3>${s.lessons.map(lesson).join('')}`).join('')}
    <h3 class="rc-sec">Check what you know</h3>
    <div class="rc-l blue"><div class="rc-top"><button type="button" class="rc-node" data-practice="1"><span class="rc-dot">${IC.star}</span><span class="rc-t"><b>Practice</b><small>${PRACTICE.length} kinds of question, with hints</small></span></button></div></div></div>`;
}
function drawLines(){
  const rm=$('#rm'),svg=rm&&rm.querySelector('.rm-lines');if(!svg)return;
  const R=rm.getBoundingClientRect(),W=Math.round(R.width),H=Math.round(R.height);
  svg.setAttribute('width',W);svg.setAttribute('height',H);svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const rel=e=>{const r=e.getBoundingClientRect();return{l:r.left-R.left,r:r.right-R.left,cy:(r.top+r.bottom)/2-R.top}};
  let d='',fillTo=0;
  rm.querySelectorAll('.rm-row[data-l]').forEach(row=>{
    const id=row.dataset.l,nodeEl=row.querySelector('.rm-node'),n=rel(nodeEl);
    if(/done|part|cur/.test(nodeEl.className))fillTo=Math.max(fillTo,n.cy);
    const curve=(x1,y1,x2,y2)=>{const m=(x1+x2)/2;return`M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`};
    const left=row.classList.contains('flip');
    row.querySelectorAll('.rm-steps .rm-box').forEach(bx=>{const q=rel(bx);d+=left?`<path data-r="${id}" d="${curve(n.l,n.cy,q.r,q.cy)}"/>`:`<path data-r="${id}" d="${curve(n.r,n.cy,q.l,q.cy)}"/>`});
  });
  svg.innerHTML=d;
  const f=rm.querySelector('.fill');if(f)f.style.height=fillTo+'px';
  rm.querySelectorAll('.rm-row[data-l]').forEach(row=>{
    const on=()=>{svg.classList.add('dim');svg.querySelectorAll(`[data-r="${row.dataset.l}"]`).forEach(p=>p.classList.add('on'))},
          off=()=>{svg.classList.remove('dim');svg.querySelectorAll('.on').forEach(p=>p.classList.remove('on'))};
    row.onmouseenter=on;row.onmouseleave=off;row.addEventListener('focusin',on);row.addEventListener('focusout',off);
  });
}
let rmRO=null;
function bindRoad(root){
  root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openLesson(+b.dataset.open,b.dataset.at!==undefined?+b.dataset.at:undefined));
  root.querySelectorAll('[data-practice]').forEach(b=>b.onclick=()=>{$('#map').hidden=true;if(MODEUX=='explore'){document.body.classList.remove('tour-closed');TAB='prac';rightUI();try{layout()}catch(e){}}else startPractice()});
  root.querySelectorAll('[data-free]').forEach(b=>b.onclick=()=>{LVIEW='road';$('#map').hidden=true;setUX('explore')});
  root.querySelectorAll('[data-tg]').forEach(b=>b.onclick=()=>{const i=+b.dataset.tg,L=b.closest('.rc-l');if(RCOPEN.has(i))RCOPEN.delete(i);else RCOPEN.add(i);L.classList.toggle('open');b.setAttribute('aria-expanded',RCOPEN.has(i))});
  root.querySelectorAll('[data-full]').forEach(b=>b.onclick=()=>window.showMap());
  if(rmRO){rmRO.disconnect();rmRO=null}
  if(root.querySelector('#rm')){requestAnimationFrame(()=>{drawLines();const t=root.querySelector('.rm-node.cur,.rm-node.part,.rm-node.next');if(t&&t.scrollIntoView)t.scrollIntoView({block:'center'})});
    if(window.ResizeObserver){rmRO=new ResizeObserver(()=>drawLines());rmRO.observe(root.querySelector('#rm'))}}
}
function openLesson(i,at){                                    // start at the beginning, resume where you left off, or jump to a chosen step
  const m=MODS[i],r=reached(i),st=at!==undefined?at:(DONE.has(m.key)?0:Math.min(Math.max(r-1,0),m.steps.length-1));
  mod=i;HIST=[];FIN=false;LVIEW='lesson';$('#map').hidden=true;STARTED=true;
  if(MODEUX!='explore'){PRACMODE=false;MODEUX='guided';$$('#mx button').forEach(b=>b.classList.toggle('on',b.dataset.ux=='guided'))}
  else{document.body.classList.remove('tour-closed');TAB='learn'}
  window.goTour(st);
  if(MODEUX=='explore')try{layout()}catch(e){}
}
window.startLesson=i=>openLesson(i);
window.showMap=function(){
  const m=$('#map'),wide=innerWidth>=900,cont=resumeIdx(),cn=NAME(MODS[cont]),started=nSeen(cont)>0;
  m.hidden=false;
  m.innerHTML=`<div class="mapcard road-card rmc" role="dialog" aria-label="Lessons roadmap"><div class="rmc-head"><div><h1>Lessons roadmap</h1>
      <p>${doneCount()} of ${MODS.length} lessons complete. Pick any box to start there.</p></div>
      <div class="rmc-actions"><button class="btn" type="button" data-open="${cont}">${started?'Continue':'Start'}: ${cn}</button><button class="btn g" type="button" data-free="1">Explore freely</button>
      ${STARTED?'<button class="rmc-x" id="mcl" type="button" aria-label="Close">✕</button>':''}</div></div>
    <div class="rmc-body" id="rmb">${wide?roadFull():roadCompact()}</div></div>`;
  bindRoad(m);const c=$('#mcl');if(c)c.onclick=()=>m.hidden=true;
};
$('#home').onclick=()=>window.showMap();
addEventListener('resize',()=>{const m=$('#map');if(m&&!m.hidden){const wide=innerWidth>=900,has=!!m.querySelector('#rm');if(wide!==has)window.showMap();else if(has)drawLines()}});

/* ---------- a lesson step, as a flow ---------- */
const IMP=/^(?:<b>)?(?:\{buildhow\}|(?:Tap|Drag|Press|Hover|Count|Try|Open|Use|Add|Watch|Look|Pick|Swap|Click|Switch|Keep|Read|Move|Change|Make|Show|Compare|Choose|Select|Rotate|Scroll|Type|Burn|Crack|Branch)\b)/;
function beats(c){
  const parts=c.replace(/([.!?])\s+(?=[A-Z<{“(])/g,'$1\u0001').split('\u0001').map(x=>x.trim()).filter(Boolean),idea=[],tries=[];
  parts.forEach(p=>(IMP.test(p)?tries:idea).push(p));
  return{idea:idea[0]||'',notice:idea.slice(1),tries};
}
const stepKind=s=>s.q?['predict','Predict']:(s.need||s.act)?['try','Try it']:['learn','Learn'];

function lessonHTML(){
  const g=MODEUX=='guided',m=MODS[mod],S=m.steps,s=S[tourStep],key=mod+'.'+tourStep,a=answered[key],
    done=s.q?a!=null:(s.need?tourTouched:true),last=tourStep==S.length-1,todo=s.q?'':s.need?NEEDTXT[s.need]:s.act?NEEDTXT.act:'',
    B=s.c?beats(s.c):null,[kc,kl]=stepKind(s),
    needShow=!g&&(SHOWN!==key||(!s.act&&!s.need&&!s.q&&desc().name!==SHOWNMOL));
  const road=S.map((st,i)=>`<li><button type="button" class="sn ${i<tourStep||DONE.has(m.key)?'d':''} ${i==tourStep?'cur':''}" data-s="${i}" title="Step ${i+1}: ${st.t}" aria-label="Go to step ${i+1}: ${st.t}" ${i==tourStep?'aria-current="step"':''}>${i<tourStep||(DONE.has(m.key)&&i!=tourStep)?IC.check:i+1}</button></li>`).join('');
  const tries=B&&B.tries.length?B.tries:[];
  return`<div class="lz-top"><button class="lz-back" id="rb" type="button">${IC.back}<span>All lessons</span></button>
      <div class="lz-title"><small>Lesson ${mod+1} of ${MODS.length}</small><b>${NAME(m)}</b></div></div>
    <ol class="lz-road">${road}</ol>
    <div class="kick"><span class="kt ${kc}">${kl}</span><span>Step ${tourStep+1} of ${S.length}</span></div>
    <h2>${s.t}</h2>
    ${needShow?'<button class="btn show" id="sh" type="button">Show this on the model</button>':''}
    ${B&&B.idea?`<div class="idea"><span class="ico">${IC.idea}</span><p>${B.idea}</p></div>`:''}
    ${B&&B.notice.length?`<ul class="notice">${B.notice.map(t=>`<li>${t}</li>`).join('')}</ul>`:''}
    ${s.q?`<div class="idea ask"><span class="ico">${IC.idea}</span><p>${s.q}</p></div><div class="q">${s.o.map((o,i)=>`<button class="c ${a!=null?(i==s.a?'right-a':i==a?'wrong-a':''):''}" data-a="${i}" ${a!=null?'disabled':''}>${o}</button>`).join('')}</div>${a!=null?`<div class="fb ${a==s.a?'ok':'no'}">${a==s.a?s.ok:s.no}</div>`:''}`:''}
    ${tries.length||(todo&&!done)?`<div class="try ${done&&todo?'is-done':''}"><span class="tl">${s.need||s.act?'Your turn':'Explore'}</span>
      ${tries.length?`<ul>${tries.map(t=>`<li><span class="ico">${IC.hand}</span><span>${t}</span></li>`).join('')}</ul>`:''}
      ${todo&&!done?`<div class="try-need">${todo}</div>`:''}${todo&&done&&(s.need||s.act)?`<div class="try-ok">${IC.check}<span>Done</span></div>`:''}</div>`:''}
    ${s.act?`<button class="btn g" id="act" type="button">${s.act[0]}</button>${lastHTML()}`:''}
    <div id="wg">${widgetsHTML(s,a)}</div>
    ${done?'':'<div class="skip"><button class="hint2" id="sk" type="button">Skip this step</button></div>'}
    <div class="nav"><button class="btn g" id="pv" type="button" ${tourStep==0?'disabled':''}>Back</button><button class="btn" id="nt" type="button" ${done?'':'disabled'}>${last?'Finish lesson':'Next'}</button></div>`;
}

/* ---------- widgets that use the 3D model and the structural views ---------- */
const STYLES=[['ball','Ball & stick'],['space','Space-filling'],['skel','Skeleton']];
const REPS=['Structural','Semi-structural','Condensed','Formula'];
function viewStrip(){
  return`<div class="wg wg-view"><span class="wg-l">See it as</span>
    <div class="wg-chips" role="group" aria-label="Drawing">${REPS.map((t,i)=>`<button type="button" data-rp2="${i}" class="${REP==i?'on':''}">${t}</button>`).join('')}</div>
    <div class="wg-chips" role="group" aria-label="3D style">${STYLES.map(([k,t])=>`<button type="button" data-m2="${k}" class="${MODE==k?'on':''}">${t}</button>`).join('')}</div></div>`;
}
const spotItems=()=>{const it=[['C','Carbons']];if(ORD.some(o=>o>1))it.push(['M','Multiple bond']);if(SUB.some(g=>g.some(c=>c!='CH3')))it.push(['G','Functional group']);return it};
function spotIds(k){
  if(k=='C')return[...Array(N).keys()].map(i=>'C'+i);
  const f=[];
  if(k=='M')ORD.forEach((o,i)=>o>1&&f.push('C'+i,'C'+(i+1)));
  if(k=='G')SUB.forEach((g,i)=>g.forEach(c=>{if(c!='CH3')f.push('C'+i,'S'+i+'_'+c)}));
  return f;
}
function hlDock(ids){$$('#dock [data-id]').forEach(g=>g.classList.toggle('hov',!!ids&&ids.includes(g.dataset.id)))}
function spotStrip(){
  return`<div class="wg wg-spot"><span class="wg-l">Spotlight</span><div class="wg-chips" role="group" aria-label="Spotlight">${spotItems().map(([k,t])=>`<button type="button" data-sp="${k}" class="${SPOT==k?'on':''}">${t}</button>`).join('')}</div>
    <small class="wg-h">Lights up in the 3D model and in the drawing below it.</small></div>`;
}
function bondCounter(){
  const el=SEL&&A[SEL]?A[SEL].el:null;
  if(el!='C')return`<div class="wg wg-bonds"><span class="wg-l">Bond counter</span><p class="wg-empty">Tap a carbon in the 3D model to count its bonds.</p></div>`;
  const bs=Object.values(B).filter(b=>b.alive&&(b.a==SEL||b.b==SEL)),slots=[];
  bs.forEach(b=>{const o=A[b.a==SEL?b.b:b.a].el;for(let k=0;k<Math.round(b.o);k++)slots.push(o)});
  const tally={};slots.forEach(e=>tally[e]=(tally[e]||0)+1);
  const txt=Object.entries(tally).map(([e,n])=>`${n} to ${e=='C'?'carbon':e=='H'?'hydrogen':e}`).join(' + ');
  return`<div class="wg wg-bonds"><span class="wg-l">Bonds on carbon ${+SEL.slice(1)+1}</span>
    <div class="slots">${[0,1,2,3].map(i=>`<i class="sl ${slots[i]?'on e-'+slots[i]:''}">${slots[i]||''}</i>`).join('')}<b>${slots.length} of 4</b></div><p class="wg-sum">${txt||'no bonds'}</p></div>`;
}
function isoStrip(){
  const M=desc(),iso=LIBFLAT.filter(m=>m.mf==M.mf&&!same(m)),names=[M.name,...iso.map(m=>m.name)];
  return`<div class="wg wg-iso"><span class="wg-l">Same formula, ${M.mf}</span><div class="wg-chips">${names.map(n=>`<button type="button" data-iso="${n}" class="${n==M.name?'on':''}">${n}</button>`).join('')}</div>${iso.length?'':'<small class="wg-h">No other isomers in the library for this one.</small>'}</div>`;
}
function bpMeter(){
  const M=desc(),bp=BPT[M.name];if(bp==null)return'';
  if(!BPLOG.length||BPLOG[BPLOG.length-1].name!==M.name)BPLOG=[...BPLOG,{name:M.name,bp}].slice(-2);
  const prev=BPLOG.length>1?BPLOG[0]:null,pos=v=>Math.max(0,Math.min(100,(v+170)/320*100)).toFixed(1);
  return`<div class="wg wg-bp"><span class="wg-l">Boiling point meter</span><div class="bp-row"><b>${fmtT(bp)}</b>${prev?`<em>${bp>prev.bp?'▲ up':'▼ down'} ${Math.abs(Math.round(bp-prev.bp))} °C from ${prev.name}</em>`:`<em>${M.name}</em>`}</div>
    <div class="therm sm"><span style="left:${pos(bp)}%"></span>${prev?`<i style="left:${pos(prev.bp)}%"></i>`:''}</div></div>`;
}
function widgetsHTML(s,a){
  if(s.q&&a==null)return'';                                    // never give away a prediction
  const k=MODS[mod].key;let h='';
  if(k==0)h+=bondCounter();
  if(k==2)h+=isoStrip();
  if(k==4)h+=bpMeter();
  const more=spotStrip()+((MODEUX=='explore'||UXS.dock)?viewStrip():'');
  h+=`<details class="wg-more" id="wgm" ${(WGOPEN||k==6||k==1)?'open':''}><summary><span>Look closer</span><small>spotlight · drawing · 3D style</small></summary>${more}</details>`;
  return h;
}
function bindWidgets(){
  const root=$('#wg');if(!root)return;
  const dm=$('#wgm');if(dm)dm.addEventListener('toggle',()=>{WGOPEN=dm.open});
  root.querySelectorAll('[data-rp2]').forEach(b=>b.onclick=()=>{const i=+b.dataset.rp2;$('#dock').hidden=false;setRep(i);layout();root.querySelectorAll('[data-rp2]').forEach(x=>x.classList.toggle('on',x==b));if(SPOT)setTimeout(()=>hlDock(spotIds(SPOT)),30)});
  root.querySelectorAll('[data-m2]').forEach(b=>b.onclick=()=>{const t=$('#tools [data-m="'+b.dataset.m2+'"]');if(t)t.click();else MODE=b.dataset.m2;root.querySelectorAll('[data-m2]').forEach(x=>x.classList.toggle('on',x==b))});
  root.querySelectorAll('[data-sp]').forEach(b=>{
    const k=b.dataset.sp,on=()=>{FOC=spotIds(k);hlDock(FOC)},off=()=>{FOC=SPOT?spotIds(SPOT):null;hlDock(FOC)};
    b.onmouseenter=on;b.onmouseleave=off;b.onfocus=on;b.onblur=off;
    b.onclick=()=>{SPOT=SPOT==k?null:k;root.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x.dataset.sp==SPOT));off()};
  });
  root.querySelectorAll('[data-iso]').forEach(b=>b.onclick=()=>{if(b.dataset.iso!==desc().name){load(b.dataset.iso);rightUI()}});
}
/* the bond counter follows whatever atom you tap */
const _selSet=window.selSet;
window.selSet=function(){const r=_selSet.apply(this,arguments);try{const w=$('.wg-bonds');if(w&&MODS[mod].key==0&&TAB=='learn'){const t=document.createElement('div');t.innerHTML=bondCounter();w.replaceWith(t.firstChild)}}catch(e){}return r};

/* ---------- learnUI / finUI ---------- */
window.learnUI=function(){
  if(FIN)return finUI();
  const ex=MODEUX=='explore';
  if(ex&&LVIEW=='road'){$('#tb').innerHTML=`<div class="rc-head"><div><b>All lessons</b><small>${doneCount()} of ${MODS.length} done</small></div><button class="btn g" type="button" data-full="1">Full view ↗</button></div>`+roadCompact();bindRoad($('#tb'));return}
  const m=MODS[mod],S=m.steps,s=S[tourStep],key=mod+'.'+tourStep,a=answered[key],done=s.q?a!=null:(s.need?tourTouched:true),last=tourStep==S.length-1;
  $('#tb').innerHTML=fx(lessonHTML());
  const sh=$('#sh');if(sh)sh.onclick=()=>window.goTour(tourStep);
  $('#rb').onclick=()=>{if(ex){LVIEW='road';rightUI()}else window.showMap()};
  $$('[data-s]').forEach(b=>b.onclick=()=>window.goTour(+b.dataset.s));
  $$('[data-a]').forEach(b=>b.onclick=()=>{answered[key]=+b.dataset.a;s.reveal();rightUI()});
  const ac=$('#act');if(ac)ac.onclick=()=>{s.act[1]();evt('act')};
  const next=()=>last?finishLesson():window.goTour(tourStep+1);
  $('#pv').onclick=()=>window.goTour(tourStep-1);$('#nt').onclick=next;const sk=$('#sk');if(sk)sk.onclick=next;
  bindWidgets();
  if(window.announce)window.announce(`Lesson ${mod+1}, step ${tourStep+1} of ${S.length}: ${s.t}`);
};
window.finUI=function(){
  const m=MODS[mod],meta=MODMETA[m.key],nx=nextAfter(mod),nm=nx>=0?NAME(MODS[nx]):'',ex=MODEUX=='explore';
  $('#tb').innerHTML=`<div class="recap"><span class="badge">Lesson complete</span><h2>${NAME(m)}</h2><p class="sub">What you learned</p>
    <ul class="recap-list">${meta.recap.map(x=>`<li>${IC.check}<span>${x}</span></li>`).join('')}</ul>
    <div class="nav stack"><button class="btn" id="nl" type="button">${nx>=0?'Next lesson: '+nm:'Start practice'}</button>
    <button class="btn g" id="ty" type="button">${ex?'Back to the roadmap':'Try it yourself'}</button>${ex?'':'<button class="hint2" id="bm" type="button">Back to the map</button>'}</div></div>`;
  $('#nl').onclick=()=>nx>=0?openLesson(nx):(ex?(FIN=false,TAB='prac',rightUI()):startPractice());
  $('#ty').onclick=()=>ex?(FIN=false,LVIEW='road',rightUI()):(TAB=meta.tab,FIN=false,setUX('explore'));
  const bm=$('#bm');if(bm)bm.onclick=()=>window.showMap();
};

window.LessonUI={
  resume(){const i=resumeIdx();return{i,name:NAME(MODS[i]),started:nSeen(i)>0&&!DONE.has(MODS[i].key),step:Math.min(reached(i),MODS[i].steps.length),total:MODS[i].steps.length}},
  open:(i,at)=>openLesson(i,at),map:()=>window.showMap(),
  reset(){Object.keys(POS).forEach(k=>delete POS[k]);savePos();DONE.clear();saveDone();STARTED=false;LVIEW='road';RCOPEN=null;FIN=false;
    try{progUI()}catch(e){}try{rightUI()}catch(e){}if(!$('#map').hidden)window.showMap()}};
/* the first screen was drawn before this file loaded: draw it again with the new design */
if(!$('#map').hidden)window.showMap();
try{rightUI()}catch(e){}
}catch(e){console.error('lessonui.js:',e)}
})();