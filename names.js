/* names.js — the Names tab, redesigned as a "Name lab" (loads after lessonui.js, before explore.js)

   Three ways to learn that a name is a code:
     Build     tap carbon beads, pick a family card, pick the position: the name and the 3D model update live.
               Hover or focus any piece of the name to light up what it means in 3D.
     Decode    type any name and watch it being solved step by step (with a Play button).
     Missions  a target name appears; build the molecule that has it. Streaks, stars, hints and confetti.

   It re-assigns namesUI() and reuses the existing name logic (DEC, decSet, analyse, parseName, meaning, runSolve). */
(function(){
'use strict';
if(typeof namesUI!=='function'||typeof DEC==='undefined'||typeof analyse!=='function'){console.warn('names.js: lesson code not found, skipping');return}
try{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let NMODE='build',PLAY=null,KEEP=null,WHY=null;
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const ST=Object.assign({solved:0,best:0},store.get('cl.names',{}));
const MS={quizOn:false,target:null,kind:'build',streak:0,hints:0,done:false,stars:0,recent:[],focusStep:null,hintText:'',lastHint:0,wrong:[],opts:null,shake:null,fresh:false};
const GLYPH={an:'C–C',en:'C=C',yn:'C≡C',ol:'–OH',al:'–CHO',one:'C=O',oic:'–COOH'};
const FAMILY=e=>{const m=/\(an? ([^)]+)\)/.exec(ENDS.find(x=>x[0]==e)[2]);return m?m[1]:''};
const minN=e=>{for(let n=1;n<=8;n++)if(decOk(e,n))return n;return 9};
const STEMS_NOTE=n=>n<=4?'Trick: <b>M</b>onkeys <b>E</b>at <b>P</b>eeled <b>B</b>ananas = meth, eth, prop, but.'
  :'Same number words as pentagon, hexagon, heptagon and octagon.';
const REAL={methane:'The main part of natural gas, used for cooking and heating.',propane:'The fuel in camping stoves and gas braais.',butane:'The fuel in lighters and portable stoves.',
  ethene:'Fruit ripens faster around it, and it is the starting material for polythene.',ethyne:'Burned in welding torches (it is called acetylene).',
  methanol:'A solvent and fuel. It is poisonous to drink.',ethanol:'The alcohol in drinks and in hand sanitiser.','propan-2-ol':'Rubbing alcohol (isopropanol), used to clean skin and screens.',
  methanal:'Formaldehyde, used to preserve biological specimens.',ethanal:'Made in the body when ethanol is broken down.',propanone:'Nail polish remover (acetone).',
  'ethanoic acid':'Vinegar is a dilute solution of it.','methanoic acid':'The acid in ant stings and nettle stings.',octane:'One of the hydrocarbons in petrol.',hexane:'A solvent used to extract cooking oils.'};
const realHTML=name=>REAL[name]?`<p class="nl-real"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg><span><b>In real life:</b> ${REAL[name]}</span></p>`:'';
const DICE='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/></svg>';
const cur=()=>{const[n,o,s,p]=decState();return{n,o,s,p,name:analyse(n,o,s).name}};

/* ---------- pieces shared by all modes ---------- */
function tilesHTML(comps,hl){
  return comps.map(c=>`<span class="nl-tile k-${c.k} ${hl&&hl(c)?'hot':''}" tabindex="0" data-k="${c.k}" role="button" aria-label="${c.t}: what does this part mean?">${c.t}</span>`).join('');
}
function whyHTML(name){
  const ms=meaning(name);if(!ms.length)return'';
  return`<div class="nl-mean">${ms.map(m=>`<span class="mc ${m[0]}">${m[1]}</span>`).join('')}</div>`;
}
function nameCard(label){
  const c=cur(),p=parseName(c.name),comps=p.error?[{k:'stem',t:c.name}]:p.comps;
  return`<div class="nl-card nl-namecard stick"><span class="nl-lab">${label||'Your name'}<button type="button" class="nl-dice" id="dice" title="Try a random molecule">${DICE}Surprise me</button></span><div class="nl-name" aria-live="polite">${tilesHTML(comps)}</div>
    <p class="nl-why" id="nl-why">Hover a piece of the name to light it up in 3D.</p>${realHTML(c.name)}</div>`;   // the meaning chips already sit above the model, so they are not repeated here
}
function builderHTML(){
  const c=cur(),r=posRange(DEC.end,DEC.stem),f=MS.focusStep;
  const beads=STEMW.map((w,i)=>`<button type="button" class="bead ${i<DEC.stem?'on':''} ${i+1==DEC.stem?'cur':''}" data-st="${i+1}" role="radio" aria-checked="${i+1==DEC.stem}" aria-label="${w}-, ${i+1} carbon${i?'s':''}"><i style="--d:${i*28}ms">${i+1}</i><small>${w}</small></button>`).join('');
  const cards=ENDS.map(e=>{const ok=decOk(e[0],DEC.stem);return`<button type="button" class="fam ${DEC.end==e[0]?'on':''}" data-en="${e[0]}" aria-pressed="${DEC.end==e[0]}" ${ok?'':'disabled'} ${ok?'':`title="Needs ${minN(e[0])}+ carbons"`}>
      <span class="g">${GLYPH[e[0]]}</span><span class="t"><b>${e[1]}</b><small>${ok?FAMILY(e[0]):'needs '+minN(e[0])+'+ carbons'}</small></span></button>`}).join('');
  let pos='';
  if(r&&r[1]>r[0]){
    const bond=DEC.end=='en'||DEC.end=='yn',p=c.p;
    pos=`<section class="nl-step ${f==3?'nudge':''}"><h4><span class="nl-n">3</span>Where on the chain?</h4><div class="chain" role="radiogroup">${Array.from({length:DEC.stem},(_,i)=>{const k=i+1,valid=k>=r[0]&&k<=r[1],on=bond?(k==p||k==p+1):k==p;
      return`<button type="button" class="bead sq ${on?'on':''} ${valid?'':'off'}" data-ps="${k}" ${valid?'':'disabled'} role="radio" aria-checked="${k==p}" aria-label="Carbon ${k}"><i>${k}</i></button>`}).join('<u></u>')}</div>
      <p class="nl-tip">${bond?'The number is the <b>first carbon</b> of the double or triple bond.':'The number is the <b>carbon</b> that carries the group.'}</p></section>`;
  }
  return`<section class="nl-step ${f==1?'nudge':''}"><h4><span class="nl-n">1</span>How many carbons?<button type="button" class="nl-link" id="cnt">▶ Count</button></h4><div class="beads" role="radiogroup" aria-label="Number of carbons">${beads}</div>
      <p class="nl-tip">${STEMS_NOTE(DEC.stem)}</p><div id="cnote" class="nl-cnote"></div></section>
    <section class="nl-step ${f==2?'nudge':''}"><h4><span class="nl-n">2</span>What kind of molecule?</h4><div class="fams">${cards}</div></section>${pos}`;
}
function bindBuilder(){
  const set=(o,part,sel)=>{KEEP=sel;stop();decSet(o,part)};
  $$('[data-st]').forEach(b=>b.onclick=()=>set({stem:+b.dataset.st},'stem',`[data-st="${b.dataset.st}"]`));
  $$('[data-en]').forEach(b=>b.onclick=()=>set({end:b.dataset.en},'end',`[data-en="${b.dataset.en}"]`));
  $$('[data-ps]').forEach(b=>b.onclick=()=>set({pos:+b.dataset.ps},'end',`[data-ps="${b.dataset.ps}"]`));
  const c=$('#cnt');if(c)c.onclick=countAnim;
  const dice=$('#dice');if(dice)dice.onclick=surprise;
  $$('.beads,.chain').forEach(g=>g.onkeydown=e=>{                       // arrow keys walk along the beads
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft'&&e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
    const bs=[...g.querySelectorAll('.bead:not(:disabled)')],i=bs.indexOf(document.activeElement);if(i<0)return;
    const nx=bs[Math.max(0,Math.min(bs.length-1,i+((e.key=='ArrowRight'||e.key=='ArrowDown')?1:-1)))];if(nx&&nx!==bs[i]){e.preventDefault();nx.click()}});
}
function surprise(){
  const all=candidates(),mine=cur().name,p=all.filter(c=>c.name!==mine),c=p[Math.floor(Math.random()*p.length)];
  KEEP='#dice';stop();decSet({stem:c.stem,end:c.end,pos:c.pos},'stem');
}
function bindTiles(){
  $$('.nl-tile').forEach(t=>{
    const on=()=>{const part=t.dataset.k=='stem'?'stem':'end';FOC=decFocus(part);const name=cur().name,ms=meaning(name),m=ms.find(x=>x[0]=='k-'+t.dataset.k)||ms[0];
      const w=$('#nl-why');if(w&&m)w.innerHTML=`<b>${t.textContent}</b> → ${m[1]}`};
    t.onmouseenter=on;t.onfocus=on;
  });
}
const stop=()=>{clearInterval(PLAY);PLAY=null};

/* ---------- Build ---------- */
function buildHTML(){return nameCard('Your name')+builderHTML()}

/* ---------- Decode (typed name, solved step by step) ---------- */
function playSteps(){
  if(!SOL||SOL.error)return;stop();if(SOL.i>=SOL.steps.length-1){SOL.i=0;applySol()}
  PLAY=setInterval(()=>{if(TAB!=='names'||NMODE!=='decode'||!SOL||SOL.i>=SOL.steps.length-1){stop();if(TAB==='names')rightUI();return}SOL.i++;applySol()},2400);rightUI();
}
function decodeHTML(){
  const ex=['propan-2-ol','2-methylbutane','but-2-ene','ethanoic acid','1,2-dibromoethane','methyl ethanoate','pentan-2-one'];
  let out=`<div class="nl-card"><span class="nl-lab">Type any name</span><div class="inp"><input id="nmi" value="${SOL?SOL.raw.replace(/"/g,''):''}" placeholder="e.g. 2-methylbutane" autocomplete="off" spellcheck="false" aria-label="Chemical name"><button class="btn" id="go" type="button">Show me</button></div>
    <details class="nl-more" ${SOL?'':'open'}><summary>Examples</summary><div class="nl-ex">${ex.map(x=>`<button type="button" class="nl-chip" data-ex="${x}">${x}</button>`).join('')}</div></details></div>`;
  if(!SOL)return out+`<div class="nl-empty"><b>Try one of the examples.</b><p>I will build the molecule in 3D one part of the name at a time, and explain each part.</p></div>`;
  if(SOL.error)return out+`<div class="fb no">${SOL.error}</div>`;
  const s=SOL.steps[SOL.i],hl=c=>s.k=='res'||(s.k=='suf'?(c.k=='suf'||c.k=='ester'):s.k=='pre'?(c.k=='pre'&&c.i==s.pi):c.k==s.k),last=SOL.i==SOL.steps.length-1;
  return out+`<div class="nl-card nl-namecard"><span class="nl-lab">Step ${SOL.i+1} of ${SOL.steps.length}</span><div class="nl-name">${tilesHTML(SOL.comps,hl)}</div>
    <ol class="nl-road">${SOL.steps.map((_,i)=>`<li><button type="button" class="sn ${i<SOL.i?'d':''} ${i==SOL.i?'cur':''}" data-sx="${i}" aria-label="Go to step ${i+1}">${i+1}</button></li>`).join('')}</ol>
    <div class="fb">${s.cap}</div>
    <div class="nav"><button class="btn g" id="sb" type="button" ${SOL.i==0?'disabled':''}>Back</button><button class="btn g" id="sp" type="button">${PLAY?'Pause':'▶ Play'}</button><button class="btn" id="sn" type="button" ${last?'disabled':''}>Next</button></div></div>`;
}
function bindDecode(){
  const go=()=>{stop();runSolve($('#nmi').value)};$('#go').onclick=go;$('#nmi').onkeydown=e=>{if(e.key=='Enter')go()};
  $$('[data-ex]').forEach(b=>b.onclick=()=>{stop();runSolve(b.dataset.ex)});
  const sb=$('#sb');if(sb){sb.onclick=()=>{stop();SOL.i--;applySol()};$('#sn').onclick=()=>{stop();SOL.i++;applySol()};$('#sp').onclick=()=>{if(PLAY){stop();rightUI()}else playSteps()};
    $$('[data-sx]').forEach(b=>b.onclick=()=>{stop();SOL.i=+b.dataset.sx;applySol()})}
}

/* ---------- Missions ---------- */
let CAND=null;
function candidates(){
  if(CAND)return CAND;const save={...DEC},seen=new Set();CAND=[];
  for(let n=1;n<=8;n++)ENDS.forEach(e=>{if(!decOk(e[0],n))return;const r=posRange(e[0],n);
    for(let p=r?r[0]:1;p<=(r?r[1]:1);p++){DEC={stem:n,end:e[0],pos:p};const[nn,o,s]=decState(),name=analyse(nn,o,s).name;if(!seen.has(name)){seen.add(name);CAND.push({stem:n,end:e[0],pos:p,name})}}});
  DEC=save;return CAND;
}
const level=()=>Math.min(3,1+Math.floor(ST.solved/4));
const pool=()=>{const L=level();return candidates().filter(c=>L==1?['an','en','yn'].includes(c.end)&&c.stem<=5:L==2?['an','en','yn','ol','al'].includes(c.end)&&c.stem<=6:true)};
function options(t){                                                     // 3 believable wrong answers + the right one, shuffled
  const score=c=>(c.stem==t.stem?2:0)+(c.end==t.end?2:0)+(c.pos==t.pos?.5:0)+Math.random()*1.5;
  const wrong=candidates().filter(c=>c.name!==t.name).sort((a,b)=>score(b)-score(a)).slice(0,3).map(c=>c.name);
  return[...wrong,t.name].sort(()=>Math.random()-.5);
}
function startMission(){
  const L=pool().filter(c=>!MS.recent.includes(c.name)),mine=cur().name,p=(L.length?L:pool()).filter(c=>c.name!==mine),t=p[Math.floor(Math.random()*p.length)];
  MS.kind=ST.solved<2?'build':((window.NamesLab&&window.NamesLab.forceKind)||(Math.random()<.5?'spot':'build'));                      // the first two missions teach the builder
  MS.target=t;MS.recent=[t.name,...MS.recent].slice(0,5);MS.hints=0;MS.done=false;MS.stars=0;MS.focusStep=null;MS.hintText='';MS.lastHint=0;MS.wrong=[];MS.opts=MS.kind=='spot'?options(t):null;
  if(MS.kind=='spot'){decSet({stem:t.stem,end:t.end,pos:t.pos},'stem');MS.quizOn=true;setQuiz(true)}   // mystery molecule on stage, with its name hidden (the app's quiz mode)
  else rightUI();
}
function win(){MS.done=true;MS.stars=Math.max(1,3-MS.hints);MS.streak++;ST.solved++;ST.best=Math.max(ST.best,MS.streak);store.set('cl.names',ST);MS.fresh=true}
function checkWin(){if(MS.kind=='build'&&MS.target&&!MS.done&&cur().name===MS.target.name)win()}
function hint(){
  const t=MS.target;MS.hints++;
  if(MS.kind=='spot'){                                                    // take away one wrong option
    const w=MS.opts.filter(o=>o!==t.name&&!MS.wrong.includes(o));if(w.length)MS.wrong.push(w[Math.floor(Math.random()*w.length)]);MS.hintText='One wrong answer removed.';rightUI();return;
  }
  const d={stem:DEC.stem,end:DEC.end,pos:cur().p},step=d.stem!==t.stem?1:d.end!==t.end?2:3;
  MS.focusStep=step;
  MS.hintText=MS.lastHint===step?(step==1?`Try <b>${STEMW[t.stem-1]}-</b>: that is ${t.stem} carbon${t.stem>1?'s':''}.`:step==2?`Try <b>${ENDS.find(e=>e[0]==t.end)[1]}</b>.`:`Try carbon <b>${t.pos}</b>.`):
    (step==1?'Check step 1: how many carbons?':step==2?'Check step 2: what kind of molecule?':'Check step 3: which carbon?');
  MS.lastHint=step;rightUI();
}
function pick(name){
  if(MS.done||MS.wrong.includes(name))return;
  if(name===MS.target.name)win();else{MS.wrong.push(name);MS.hints++;MS.shake=name}
  rightUI();
}
const confetti=()=>`<span class="nl-conf" aria-hidden="true">${Array.from({length:26},(_,i)=>`<i style="--x:${(Math.random()*2-1)*150|0}px;--y:${-(30+Math.random()*130)|0}px;--r:${(Math.random()*720-360)|0}deg;--c:${['#2f5bea','#f5b942','#12a37a','#e0483b','#7a3fd0'][i%5]};--d:${(Math.random()*.22).toFixed(2)}s"></i>`).join('')}</span>`;
const starsHTML=n=>[1,2,3].map(i=>`<svg class="star ${i<=n?'on':''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>`).join('');
const nameTiles=(name,extra)=>{const p=parseName(name);return(p.error?[{k:'stem',t:name}]:p.comps).map(c=>`<span class="nl-tile plain ${extra||''}">${c.t}</span>`).join('')};
function missionsHTML(){
  if(!MS.target){startMissionSoon();return'<div class="nl-empty"><b>Getting your first mission…</b></div>'}
  checkWin();
  const t=MS.target,fresh=MS.fresh;MS.fresh=false;
  const toNext=level()<3?4-ST.solved%4:0;
  const head=`<div class="nl-stats"><span class="nl-stat"><b>${MS.streak}</b> streak</span><span class="nl-stat"><b>${ST.best}</b> best</span><span class="nl-stat"><b>${ST.solved}</b> solved</span><span class="nl-stat lvl">Level ${level()}</span></div>
    ${level()<3?`<div class="nl-lv" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${4-toNext}" aria-label="Progress to the next level"><i style="width:${(4-toNext)*25}%"></i><small>${toNext} more to reach Level ${level()+1}</small></div>`:''}`;
  const win_=MS.done?`<div class="nl-win" role="status"><div class="stars">${starsHTML(MS.stars)}</div><b>${MS.stars==3?'Perfect!':MS.stars==2?'Nice work!':'You got it!'}</b><p>${t.name} ${MS.kind=='spot'?'is the right name':'is built'}. ${MS.hints?'You used '+MS.hints+(MS.kind=='spot'?' hint or wrong guess':' hint')+(MS.hints>1?'s':'')+'.':'No hints needed.'}</p>${realHTML(t.name)}</div>${fresh?confetti():''}`:'';
  const nav=`<div class="nav"><button class="btn g" id="msk" type="button" ${MS.done?'disabled':''}>Skip</button><button class="btn g" id="mht" type="button" ${MS.done||(MS.kind=='spot'&&MS.opts.filter(o=>o!==t.name&&!MS.wrong.includes(o)).length<1)?'disabled':''}>${MS.kind=='spot'?'Remove one':'Hint'}${MS.hints&&MS.kind=='build'?' ('+MS.hints+')':''}</button>${MS.done?'<button class="btn" id="mnx" type="button">Next mission</button>':''}</div>`;
  if(MS.kind=='spot'){
    return head+`<div class="nl-card nl-target ${MS.done?'won':''}"><span class="nl-lab">Mission: what is this molecule called?</span>
      <p class="nl-tip" style="margin-top:0">Look at the 3D model and the drawing, then pick its name.</p>
      <div class="opts" role="group" aria-label="Answers">${MS.opts.map(o=>{const bad=MS.wrong.includes(o),ok=MS.done&&o===t.name;
        return`<button type="button" class="opt ${bad?'bad':''} ${ok?'good':''} ${MS.shake===o?'shake':''}" data-o="${o.replace(/"/g,'&quot;')}" ${(bad||MS.done)?'disabled':''}><span class="otiles">${nameTiles(o,'xs')}</span></button>`}).join('')}</div>
      ${MS.hintText&&!MS.done?`<p class="nl-why">${MS.hintText}</p>`:''}${win_}${nav}</div>`;
  }
  const mine=`<div class="nl-card nl-namecard stick"><span class="nl-lab">Your molecule is called</span><div class="nl-name sm" aria-live="polite">${(()=>{const c=cur(),p=parseName(c.name);return tilesHTML(p.error?[{k:'stem',t:c.name}]:p.comps)})()}</div>
      <p class="nl-why" id="nl-why">${MS.done?'Match!':(MS.hintText||'Change the blocks below until the two names match.')}</p></div>`;
  return head+`<div class="nl-card nl-target ${MS.done?'won':''}"><span class="nl-lab">Mission: build the molecule called</span><div class="nl-name plain sm">${nameTiles(t.name)}</div>${win_}${nav}</div>`+mine+builderHTML();
}
let soon=0;const startMissionSoon=()=>{if(soon)return;soon=setTimeout(()=>{soon=0;startMission()},0)};
function bindMissions(){
  const nx=$('#mnx');if(nx)nx.onclick=startMission;
  const s=$('#msk');if(s)s.onclick=()=>{MS.streak=0;startMission()};
  const h=$('#mht');if(h)h.onclick=hint;
  $$('[data-o]').forEach(b=>b.onclick=()=>pick(b.dataset.o));
  setTimeout(()=>{MS.shake=null},700);
}

/* the name stays hidden only while a molecule-naming mission is open and unanswered */
const _rightUI=window.rightUI;
window.rightUI=function(){
  const r=_rightUI.apply(this,arguments);
  if(MS.quizOn&&(TAB!=='names'||NMODE!=='missions'||MS.kind!=='spot'||MS.done)){MS.quizOn=false;try{setQuiz(false)}catch(e){}}
  return r;
};
/* ---------- the tab ---------- */
window.namesUI=function(){
  const modes=[['build','Build'],['decode','Decode'],['missions','Missions']];
  const body=NMODE=='build'?buildHTML():NMODE=='decode'?decodeHTML():missionsHTML();
  $('#tb').innerHTML=`<div class="nl"><div class="nl-head"><b>Name lab</b><span>Every chemical name is a code. Crack it.</span></div>
    <div class="nl-modes" role="tablist" aria-label="Name lab modes">${modes.map(([k,t])=>`<button type="button" role="tab" aria-selected="${NMODE==k}" class="${NMODE==k?'on':''}" data-nm="${k}">${t}</button>`).join('')}</div>${body}</div>`;
  $$('[data-nm]').forEach(b=>b.onclick=()=>{stop();NMODE=b.dataset.nm;KEEP=`[data-nm="${NMODE}"]`;rightUI()});
  if(NMODE=='decode')bindDecode();else{if(NMODE=='build'||(MS.kind=='build'&&MS.target))bindBuilder();bindTiles();if(NMODE=='missions')bindMissions()}
  if(KEEP){const e=$(KEEP);KEEP=null;if(e)e.focus({preventScroll:true})}
};

/* ---------- look ---------- */
const css=document.createElement('style');css.id='names-css';css.textContent=`
.nl{display:flex;flex-direction:column;gap:var(--s3)}
.nl-head b{display:block;font-size:var(--fs-lg)}.nl-head span{font-size:var(--fs-sm);color:var(--muted)}
.nl-modes{display:flex;gap:var(--s1);padding:var(--s1);border-radius:var(--r-pill);background:#eef3f9}
.nl-modes button{flex:1;min-height:40px;border:0;border-radius:var(--r-pill);background:none;font-size:var(--fs-sm);font-weight:700;color:var(--muted);transition:background .15s,color .15s}
.nl-modes button.on{background:#fff;color:var(--ink);box-shadow:0 1px 4px rgba(20,33,61,.14)}
.nl-card{position:relative;padding:var(--s3) var(--s4) var(--s4);border:1px solid var(--line);border-radius:var(--r-lg);background:#fff;overflow:hidden}
.nl-lab{display:block;margin-bottom:var(--s2);font-size:var(--fs-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.nl-name{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:var(--s1) 0 var(--s2)}
.nl-tile{padding:2px var(--s3);border:2px solid transparent;border-radius:var(--r-md);font-size:clamp(24px,calc(28px * var(--k)),38px);font-weight:800;line-height:1.25;cursor:help;transition:transform .15s,box-shadow .15s;animation:nlpop .35s cubic-bezier(.3,1.6,.5,1) both}
.nl-tile:hover,.nl-tile:focus-visible,.nl-tile.hot{transform:translateY(-3px) scale(1.04);box-shadow:0 8px 18px rgba(20,33,61,.16)}
.nl-tile.k-stem{background:#e8f0ff;border-color:#b5cbff;color:#1f45c4}.nl-tile.k-unsat{background:#f1e8ff;border-color:#d3b8ff;color:#6a2fc0}
.nl-tile.k-suf{background:#dff5ea;border-color:#a6dcc0;color:#0a6446}.nl-tile.k-ester{background:#d8f3f3;border-color:#9bd6d6;color:#0a6262}.nl-tile.k-pre{background:#ffeedb;border-color:#f3c996;color:#8a4000}
.nl-namecard.stick{position:sticky;top:0;z-index:3;box-shadow:0 8px 16px rgba(20,33,61,.08)}
.nl-mean .mc{font-size:var(--fs-xs)}
.nl-why{min-height:0}
.nl-name.sm .nl-tile{font-size:calc(21px * var(--k))}
.nl-card.nl-target{padding-bottom:var(--s3)}
.nl-step h4 .nl-link{margin-left:auto;font-size:var(--fs-xs)}
.nl-more>summary{cursor:pointer;list-style:none;margin-top:var(--s2);font-size:var(--fs-sm);font-weight:700;color:var(--accent)}
.nl-more>summary::-webkit-details-marker{display:none}
.nl-more>summary::after{content:" ▾"}.nl-more[open]>summary::after{content:" ▴"}
.nl-tile.plain{background:#f1f4f9;border-color:#d3dce9;color:var(--ink);cursor:default}
@keyframes nlpop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
.nl-mean{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:var(--s1) 0}
.nl-why{margin:var(--s1) 0 0;font-size:var(--fs-sm);line-height:1.4;color:#22314a;text-align:center}
.nl-step{padding:var(--s3) var(--s4) var(--s4);border:1px solid var(--line);border-radius:var(--r-lg);background:#fff}
.nl-step h4{display:flex;align-items:center;gap:var(--s2);white-space:nowrap;margin:0 0 var(--s3);font-size:var(--fs-md)}
.nl-n{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;font-size:var(--fs-sm);font-weight:700}
.nl-step.nudge{animation:nlnudge .9s ease 2;border-color:#e0a21b;box-shadow:0 0 0 3px #fff0d1}
@keyframes nlnudge{50%{transform:translateX(4px)}}
.beads{display:grid;grid-template-columns:repeat(8,1fr);gap:var(--s1)}
.bead{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;padding:0;border:0;background:none;font-size:var(--fs-xs);color:var(--muted)}
.bead i{display:grid;place-items:center;width:100%;max-width:34px;aspect-ratio:1;border:2px solid #cdd8e8;border-radius:50%;background:#fff;font-style:normal;font-size:var(--fs-sm);font-weight:700;color:var(--muted);transition:background .2s,transform .2s,border-color .2s;transition-delay:var(--d,0ms)}
.bead.on i{border-color:#3b4252;background:#3b4252;color:#fff}
.bead.cur i{transform:scale(1.14);border-color:var(--accent);background:var(--accent);box-shadow:0 0 0 3px var(--accent-s)}
.bead:hover:not(:disabled) i{border-color:var(--accent)}
.bead.cur small{font-weight:700;color:var(--accent)}
.chain{display:flex;align-items:center}
.chain u{flex:1;height:3px;min-width:6px;background:#cdd8e8}
.bead.sq i{width:36px;max-width:36px;border-radius:50%}
.bead.sq.off{opacity:.35}
.nl-tip{margin:var(--s3) 0 var(--s1);font-size:var(--fs-sm);line-height:1.45;color:#22314a}
.nl-link{min-height:36px;padding:0;border:0;background:none;font-size:var(--fs-sm);font-weight:700;color:var(--accent)}
.nl-cnote{min-height:1.4em;font-size:var(--fs-sm);color:#22314a}
.fams{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2)}
.fam{display:flex;align-items:center;gap:var(--s2);min-height:52px;padding:var(--s1) var(--s2);border:2px solid var(--line);border-radius:var(--r-md);background:#fff;text-align:left;transition:transform .15s,border-color .15s,background .15s}
.fam:hover:not(:disabled){transform:translateY(-1px);border-color:var(--accent)}
.fam.on{border-color:var(--accent);background:var(--accent-s)}
.fam:disabled{opacity:.5}
.fam .g{flex:none;min-width:44px;padding:2px var(--s1);border-radius:8px;background:#eef3f9;font-size:var(--fs-sm);font-weight:800;text-align:center;color:var(--ink);white-space:nowrap}
.fam .t{display:flex;flex-direction:column;min-width:0;line-height:1.2}.fam .t b{font-size:var(--fs-sm)}.fam .t small{font-size:var(--fs-xs);color:var(--muted)}
.nl-stats{display:flex;flex-wrap:wrap;gap:var(--s2)}
.nl-stat{padding:2px var(--s3);border:1px solid var(--line);border-radius:var(--r-pill);background:#fff;font-size:var(--fs-sm);color:var(--muted)}.nl-stat b{color:var(--ink)}
.nl-stat.lvl{border-color:var(--accent);background:var(--accent-s);color:var(--accent);font-weight:700}
.nl-target{border:2px dashed #b5cbff;background:linear-gradient(180deg,#fff,#f4f8ff)}
.nl-target.won{border-style:solid;border-color:#0f7a55;background:linear-gradient(180deg,#fff,#e9f8f0)}
.nl-win{margin:var(--s2) 0;text-align:center}.nl-win b{display:block;font-size:var(--fs-lg);color:#0a6446}.nl-win p{margin:var(--s1) 0 0;font-size:var(--fs-sm);color:#22314a}
.stars{display:flex;justify-content:center;gap:var(--s1)}
.star{width:34px;height:34px;fill:#dfe7f2;stroke:#cdd8e8;stroke-width:1.5;stroke-linejoin:round}
.star.on{fill:#f5b942;stroke:#c98a10;animation:nlstar .5s cubic-bezier(.3,1.6,.5,1) both}.star.on:nth-child(2){animation-delay:.12s}.star.on:nth-child(3){animation-delay:.24s}
@keyframes nlstar{from{transform:scale(0) rotate(-40deg)}to{transform:none}}
.nl-conf{position:absolute;left:50%;top:38%;pointer-events:none}
.nl-conf i{position:absolute;width:8px;height:12px;border-radius:2px;background:var(--c);opacity:0;animation:nlconf 1.2s ease-out var(--d) forwards}
@keyframes nlconf{0%{opacity:1;transform:translate(0,0)}45%{opacity:1;transform:translate(var(--x),var(--y)) rotate(var(--r))}100%{opacity:0;transform:translate(calc(var(--x) * 1.15),100px) rotate(calc(var(--r) * 1.4))}}
.nl-ex{display:flex;flex-wrap:wrap;gap:var(--s2);margin-top:var(--s3)}
.nl-chip{min-height:36px;padding:0 var(--s3);border:1px solid var(--line);border-radius:var(--r-pill);background:#fff;font-size:var(--fs-sm);font-weight:600;color:var(--ink)}
.nl-chip:hover{border-color:var(--accent);color:var(--accent)}
.nl-empty{padding:var(--s4);border:1px dashed #cdd8e8;border-radius:var(--r-lg);text-align:center;color:#22314a}.nl-empty p{margin:var(--s1) 0 0;font-size:var(--fs-sm)}
.nl-road{display:flex;gap:var(--s1);margin:var(--s2) 0 var(--s3);padding:0;list-style:none}
.nl-road li{position:relative;flex:1;min-width:0}.nl-road li+li::before{content:"";position:absolute;left:-50%;right:50%;top:50%;height:2px;background:#dfe7f2}
.nl-road .sn{position:relative;z-index:1;display:grid;place-items:center;width:100%;max-width:30px;height:30px;margin:0 auto;padding:0;border:2px solid #cdd8e8;border-radius:50%;background:#fff;font-size:var(--fs-xs);font-weight:700;color:var(--muted)}
.nl-road .sn.d{border-color:var(--accent);background:var(--accent-s);color:var(--accent)}.nl-road .sn.cur{border-color:var(--accent);background:var(--accent);color:#fff;box-shadow:0 0 0 3px var(--accent-s)}
.nl .nav{display:flex;gap:var(--s2);margin-top:var(--s3)}.nl .nav .btn{flex:1;min-height:var(--target);font-size:var(--fs-sm)}
.nl .inp{display:flex;gap:var(--s2)}.nl .inp input{flex:1;min-width:0;min-height:var(--target);padding:0 var(--s3);border:1px solid var(--line);border-radius:var(--r-md);font:inherit;font-size:var(--fs-md)}
.nl .inp input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-s)}

.nl-lab{display:flex;align-items:center;justify-content:space-between}
.nl-dice{display:inline-flex;align-items:center;gap:var(--s1);min-height:32px;padding:0 var(--s3) 0 var(--s2);border:1px solid var(--line);border-radius:var(--r-pill);background:#fff;font-size:var(--fs-xs);font-weight:700;letter-spacing:0;text-transform:none;color:var(--accent)}
.nl-dice svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;transition:transform .4s}
.nl-dice:hover{border-color:var(--accent);background:var(--accent-s)}.nl-dice:hover svg{transform:rotate(180deg)}
.nl-real{display:flex;gap:var(--s2);align-items:flex-start;margin:var(--s2) 0 0;padding:var(--s2) var(--s3);border-radius:var(--r-md);background:#fff8e6;font-size:var(--fs-sm);line-height:1.4;color:#4a3000;text-align:left}
.nl-real svg{flex:none;width:20px;height:20px;margin-top:1px;fill:none;stroke:#9a6200;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nl-lv{position:relative;height:20px;overflow:hidden;border-radius:var(--r-pill);background:#dfe7f2}
.nl-lv i{position:absolute;inset:0 auto 0 0;border-radius:var(--r-pill);background:linear-gradient(90deg,var(--accent),#7aa2ff);transition:width .5s}
.nl-lv small{position:relative;display:block;padding:0 var(--s3);font-size:var(--fs-xs);font-weight:600;line-height:20px;color:var(--ink)}
.opts{display:grid;gap:var(--s2);margin-bottom:var(--s2)}
.opt{display:flex;align-items:center;justify-content:center;min-height:56px;padding:var(--s1) var(--s2);border:2px solid var(--line);border-radius:var(--r-md);background:#fff;transition:transform .15s,border-color .15s,background .15s}
.opt .otiles{display:flex;flex-wrap:wrap;justify-content:center;gap:4px}
.opt:hover:not(:disabled){transform:translateY(-1px);border-color:var(--accent)}
.opt.bad{border-color:#e0a09a;background:#fdeceb;opacity:.6}
.opt.good{border-color:#0f7a55;background:#e2f6ec}
.opt.shake{animation:nlshake .4s}
@keyframes nlshake{20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.nl-tile.xs{padding:0 var(--s2);font-size:calc(18px * var(--k));cursor:inherit;animation:none}
`;
document.head.appendChild(css);
window.NamesLab={target:()=>MS.target,kind:()=>MS.kind,mode:m=>{NMODE=m},forceKind:null};   // forceKind is only for testing
}catch(e){console.error('names.js:',e)}
})();