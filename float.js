/* float.js — Explore-mode behaviour (loads after lessons.js)

   What lives here, in the order of the file:
     1. helpers
     2. molecule card  (identity + "Change", optional previews, live 3D snapshot)
     3. picker         (Library | Build your own, with a large preview pane)
     4. hover card     (facts about the molecule, opens from its name)
     5. rail           (collapse handle, flyout open/close, tab semantics)
     6. wiring         (wraps titleUI / rightUI / leftUI; keyboard; resize)
   lessons.js itself is untouched except for text and the lesson markup. */
(function(){
'use strict';

/* ---------- 1. helpers ---------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const MASS={C:12.011,H:1.008,O:15.999,Cl:35.45,Br:79.904};
const CPK={C:'#3b4252',H:'#dde5ef',O:'#e0483b',Cl:'#2fa34a',Br:'#a0522d'};
const ICON={
 learn:'<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
 names:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
 react:'<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
 prop:'<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
 prac:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>'};
const ascii=s=>s.replace(/[₀-₉]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x2080+48));
const counts=mf=>(ascii(mf).match(/[A-Z][a-z]?\d*/g)||[]).map(t=>{const e=t.match(/[A-Z][a-z]?/)[0];return[e,+t.slice(e.length)||1]});
const desktopExplore=()=>MODEUX=='explore'&&innerWidth>860;
const body=document.body, root=document.documentElement;
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const flyOpen=()=>!body.classList.contains('tour-closed');
function setFly(open){body.classList.toggle('tour-closed',!open);layout();pinHandle();syncTabs()}

/* ---------- 2. molecule card ---------- */
const mb=$('#molbtn');
let lastSnap='',lastName='',lastKey='',molOpen=store.get('cl.prev','0')==='1',snapT=0;
const CHEV='<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';

function paintMolCard(){
  if(!mb)return;
  const M=QUIZ?null:desc(), key=QUIZ?'quiz':M.name+'|'+molOpen;
  if(key===lastKey)return;                                  // same molecule, same state: don't rebuild (keeps keyboard focus)
  lastKey=key;
  if(QUIZ){
    mb.innerHTML='<button class="mol-open" id="molopen" type="button" aria-haspopup="dialog"><span class="nm"><b>Pick a molecule</b><small>Open the library</small></span><span class="chg">Open ›</span></button>';
  }else{
    if(M.name!==lastName){lastName=M.name;lastSnap=''}
    const img=lastSnap?'<img alt="" src="'+lastSnap+'">':'';
    mb.innerHTML=`<button class="mol-open" id="molopen" type="button" aria-haspopup="dialog" aria-label="Molecule: ${M.name}. Change molecule">
        <span class="pv pv3">${img}</span><span class="nm"><b>${cap(M.name)}</b><small>${M.mf}</small></span><span class="chg">Change ›</span></button>
      <button class="mol-exp" id="molexp" type="button" aria-expanded="${molOpen}" aria-controls="molprev"><span>${molOpen?'Hide previews':'Show previews'}</span>${CHEV}</button>
      <div class="mol-prev" id="molprev" ${molOpen?'':'hidden'}><span class="pv pv3" data-l="3D model">${img}</span><span class="pv pv2" data-l="Structure">${struct2D(N,ORD,SUB)}</span></div>`;
    $('#molexp').onclick=()=>{molOpen=!molOpen;store.set('cl.prev',molOpen?'1':'0');
      $('#molprev').hidden=!molOpen;$('#molexp').setAttribute('aria-expanded',molOpen);$('#molexp span').textContent=molOpen?'Hide previews':'Show previews';
      lastKey=M.name+'|'+molOpen;pinHandle();queueSnap()};
  }
  $('#molopen').onclick=()=>{pick.hidden?openPicker('lib'):closePick()};
  queueSnap();
}
/* A live picture of the 3D model, cropped to the molecule. */
function snap(){
  const cvs=$('#cv'),boxes=$$('#molbtn .pv3');if(!cvs||!boxes.length||!desktopExplore()||QUIZ)return;
  try{
    const sw=cvs.width,sh=cvs.height,q=document.createElement('canvas');q.width=360;q.height=Math.max(40,Math.round(360*sh/sw));
    const qc=q.getContext('2d');qc.drawImage(cvs,0,0,sw,sh,0,0,q.width,q.height);
    const d=qc.getImageData(0,0,q.width,q.height).data;let x0=q.width,y0=q.height,x1=0,y1=0;
    for(let y=0;y<q.height;y++)for(let x=0;x<q.width;x++)if(d[(y*q.width+x)*4+3]>110){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    if(x1<=x0||y1<=y0)return;
    const asp=1.25,u=sw/q.width;let bw=(x1-x0)*u,bh=(y1-y0)*u;const pad=Math.max(bw,bh)*.12;bw+=pad*2;bh+=pad*2;
    if(bw/bh<asp)bw=bh*asp;else bh=bw/asp;
    const c2=document.createElement('canvas');c2.width=360;c2.height=Math.round(360/asp);
    c2.getContext('2d').drawImage(cvs,(x0+x1)/2*u-bw/2,(y0+y1)/2*u-bh/2,bw,bh,0,0,c2.width,c2.height);
    lastSnap=c2.toDataURL('image/png');boxes.forEach(b=>b.innerHTML='<img alt="" src="'+lastSnap+'">');
  }catch(e){}
}
const queueSnap=()=>{clearTimeout(snapT);snapT=setTimeout(snap,1100)};

/* ---------- 3. picker ---------- */
const pick=$('#pick');let lastOpener=null;
pick.innerHTML=`<div class="mapcard pkm" role="dialog" aria-modal="true" aria-label="Molecule picker">
  <div class="pkm-head"><div class="pkm-tabs" role="tablist"><button data-pt="lib" class="on" role="tab">Library</button><button data-pt="build" role="tab">Build your own</button></div>
    <button class="pkm-x" id="pkx" type="button" aria-label="Close">✕</button></div>
  <div class="pkm-body"><div class="pkm-lib">
    <label class="pkm-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
      <input id="pks" type="search" placeholder="Search a name or formula, e.g. bromo or C4H10" autocomplete="off" spellcheck="false" aria-label="Search molecules"></label>
    <div class="pkm-cats" id="pkc"></div>
    <div class="pkm-grid" id="pkl"></div><div class="pkm-empty" id="pke" hidden>No match. Try a formula such as C3H8.</div>
  </div><aside class="pkm-pv" id="pkpv" aria-live="polite"></aside></div>
  <div class="pkm-build" hidden><div id="buildslot"></div></div>
</div>`;
let CAT='',PVSEL=null;const CATOF={},BYNAME={};
const canHover=()=>innerWidth>860&&matchMedia('(hover:hover)').matches;
function paintPV(m){
  const bp=BPT[m.name],cs=counts(m.mf),cur=same(m),c=cond(m.n,m.o,m.s);
  $('#pkpv').innerHTML=`<div class="pv-box">${struct2D(m.n,m.o,m.s)}</div>
    <div class="pv-name">${cap(m.name)}</div><div class="pv-cat">${CATOF[m.name]||'Your molecule'}</div>
    <div class="pv-atoms">${cs.map(([e,n])=>`<span class="ball" style="--c:${CPK[e]||'#999'}"><i></i>${e}<b>${n}</b></span>`).join('')}</div>
    <dl class="pv-dl"><dt>Condensed</dt><dd>${c}</dd><dt>Formula</dt><dd>${m.mf}</dd><dt>Boiling point</dt><dd>${bp!=null?fmtT(bp):'n/a'}</dd></dl>
    <button class="pv-go" id="pvgo" type="button" ${cur?'disabled':''}>${cur?'Showing now':'Show in 3D'}</button>`;
  const go=$('#pvgo');if(go)go.onclick=()=>{closePick();load(m.name)};
}
function fillLib(){
  const cur=LIBFLAT.find(same)||{name:desc().name,mf:desc().mf,n:N,o:ORD,s:SUB};
  PVSEL=cur;
  $('#pkc').innerHTML=`<button class="on" data-cat="">All</button>`+Object.keys(LIB).map(g=>`<button data-cat="${g}">${g}</button>`).join('');
  $('#pkl').innerHTML=Object.entries(LIB).map(([g,a])=>a.map(m=>{CATOF[m.name]=g;BYNAME[m.name]=m;return(
    `<button class="pkt${cur.name==m.name?' on':''}" type="button" data-p="${m.name}" data-cat="${g}" data-s="${(m.name+' '+m.mf+' '+cond(m.n,m.o,m.s)).toLowerCase()}">
       <span class="th">${struct2D(m.n,m.o,m.s,{small:true})}</span><b>${m.name}</b><small>${m.mf}</small></button>`)}).join('')).join('');
  CAT='';$('#pks').value='';$('#pke').hidden=true;paintPV(cur);
  $$('#pkl [data-p]').forEach(b=>{const m=BYNAME[b.dataset.p];
    b.onmouseenter=b.onfocus=()=>{if(innerWidth>860)paintPV(m)};
    b.onclick=()=>{if(canHover()||innerWidth<=860){closePick();load(m.name)}else{PVSEL=m;$$('#pkl .pkt').forEach(x=>x.classList.toggle('on',x==b));paintPV(m)}};
  });
  $('#pkl').onmouseleave=()=>paintPV(PVSEL);
  $$('#pkc [data-cat]').forEach(b=>b.onclick=()=>{CAT=b.dataset.cat;$$('#pkc button').forEach(x=>x.classList.toggle('on',x==b));filt()});
}
function filt(){
  const q=$('#pks').value.trim().toLowerCase();let n=0;
  $$('#pkl .pkt').forEach(b=>{const ok=(!CAT||b.dataset.cat==CAT)&&(!q||b.dataset.s.includes(q));b.hidden=!ok;if(ok)n++});
  $('#pke').hidden=n>0;
}
$('#pks').oninput=filt;
$('#pkx').onclick=()=>closePick();
pick.onclick=e=>{if(e.target===pick&&!pick.classList.contains('side'))closePick()};
function placeSheet(){                                       // Build tab: same slot as the flyout (right of the tab bar); under the rail on narrow windows
  if(!pick.classList.contains('side'))return;
  const t=$('#tour').getBoundingClientRect();
  if(innerWidth>=1100){pick.style.setProperty('--sl',(t.right+16)+'px');pick.style.setProperty('--sy',t.top+'px');pick.style.setProperty('--sx','var(--flyout)')}
  else{pick.style.setProperty('--sl','var(--margin)');pick.style.setProperty('--sx',$('#tour').offsetWidth+'px');pick.style.setProperty('--sy',Math.min(t.bottom+16,innerHeight-260)+'px')}
}
function setPT(t){
  pick.classList.toggle('side',t=='build');
  $$('[data-pt]').forEach(b=>{b.classList.toggle('on',b.dataset.pt==t);b.setAttribute('aria-selected',b.dataset.pt==t)});
  placeSheet();
  $('.pkm-lib').hidden=t!='lib';$('#pkpv').hidden=t!='lib';$('.pkm-build').hidden=t!='build';
  if(t=='build'&&desktopExplore()&&flyOpen())body.classList.add('tour-closed');   // one side panel at a time
  if(!pick.hidden){layout();pinHandle();syncTabs()}                                // the stage re-centres around the open panel
}
$$('[data-pt]').forEach(b=>b.onclick=()=>setPT(b.dataset.pt));
function openPicker(t){
  lastOpener=document.activeElement;
  fillLib();
  const slotted=desktopExplore();
  $('[data-pt="build"]').hidden=!slotted;
  setPT(t=='build'&&slotted?'build':'lib');
  if(pick.classList.contains('side')&&desktopExplore()&&flyOpen())body.classList.add('tour-closed');   // one side panel at a time
  pick.hidden=false;placeSheet();layout();pinHandle();syncTabs();
  if(!pick.classList.contains('side'))setTimeout(()=>{try{$('#pks').focus({preventScroll:true})}catch(e){}},40);
}
window.pickUI=()=>openPicker('lib');                         // anything that used to open the old picker opens this one
const _close=window.closePick;
window.closePick=function(){_close&&_close.apply(this,arguments);pick.hidden=true;layout();if(lastOpener&&document.contains(lastOpener)){try{lastOpener.focus({preventScroll:true})}catch(e){}}lastOpener=null};
/* In desktop Explore the "Build your own" controls (the old #left card) live inside the picker */
function placeLeft(){
  const L=$('#left'),slot=$('#buildslot'),panels=$('.panels');
  if(desktopExplore()){if(L.parentNode!==slot)slot.appendChild(L)}
  else if(L.parentNode!==panels)panels.insertBefore(L,$('#tour'));
  if(!desktopExplore()&&!pick.hidden&&pick.classList.contains('side'))setPT('lib');
}

/* ---------- 4. hover card on the molecule's name ---------- */
const nc=document.createElement('div');nc.id='namecard';nc.setAttribute('role','dialog');nc.setAttribute('aria-label','About this molecule');nc.hidden=true;document.body.appendChild(nc);
let hideT=0,pinned=false;
function showName(){
  const T=$('#title');if(!T||QUIZ||innerWidth<=860){nc.hidden=true;return}
  const M=desc(),bp=BPT[M.name],iso=LIBFLAT.filter(m=>m.mf==M.mf&&!same(m)),cs=counts(M.mf),grp=(T.querySelector('.tg')||{}).textContent||'',
    pos=v=>Math.max(0,Math.min(100,(v+170)/320*100)).toFixed(1);
  nc.innerHTML=`<div class="nc-h"><b>${cap(M.name)}</b>${grp?`<span>${grp}</span>`:''}</div>
    <div class="nc-row"><div><small>Formula</small><b>${M.mf}</b></div><div><small>Condensed</small><b>${M.cond}</b></div></div>
    <div class="nc-atoms">${cs.map(([e,n])=>`<span class="ball" style="--c:${CPK[e]||'#999'}"><i></i>${e}<b>${n}</b></span>`).join('')}</div>
    ${bp!=null?`<div class="nc-bp"><small>Boiling point</small><b>${fmtT(bp)}</b><em>${bp<25?'A gas at room temperature':'A liquid at room temperature'}</em>
      <div class="therm sm"><span style="left:${pos(bp)}%"></span></div></div>`:''}
    <div class="nc-iso"><small>Isomers</small>${iso.length?`<div class="chips">${iso.slice(0,5).map(m=>`<button class="c" type="button" data-fi="${m.name}">${m.name}</button>`).join('')}</div>`:'<em>None in the library</em>'}</div>`;
  const r=T.getBoundingClientRect(),st=getComputedStyle(root),cl=parseFloat(st.getPropertyValue('--cl'))||16,cr=parseFloat(st.getPropertyValue('--cr'))||84;
  nc.hidden=false;const hw=nc.offsetWidth/2;
  nc.style.left=Math.max(cl+hw,Math.min(innerWidth-cr-hw,r.left+r.width/2))+'px';nc.style.top=(r.bottom+8)+'px';
  $$('[data-fi]').forEach(b=>b.onclick=()=>{hideName();load(b.dataset.fi)});
}
const hideName=()=>{nc.hidden=true;pinned=false};
const tt=$('#title');
tt.addEventListener('mouseover',e=>{if(e.target.closest('.tn')){clearTimeout(hideT);showName()}});
tt.addEventListener('mouseout',e=>{if(e.target.closest('.tn'))hideT=setTimeout(()=>{if(!pinned)hideName()},260)});
tt.addEventListener('click',e=>{if(e.target.closest('.tn')){pinned=!pinned;pinned?showName():hideName()}});
tt.addEventListener('keydown',e=>{if(e.target.closest('.tn')&&(e.key=='Enter'||e.key==' ')){e.preventDefault();pinned=!pinned;pinned?showName():hideName()}});
tt.addEventListener('focusin',e=>{if(e.target.closest('.tn')){clearTimeout(hideT);showName()}});
nc.onmouseenter=()=>clearTimeout(hideT);nc.onmouseleave=()=>{if(!pinned)hideT=setTimeout(hideName,220)};

/* ---------- 5. rail: collapse handle, flyout, tab semantics ---------- */
const col=document.createElement('button');col.id='colbtn';col.type='button';col.setAttribute('aria-label','Hide or show the side panel');col.title='Hide / show the side panel';
col.innerHTML='<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';document.body.appendChild(col);
col.onclick=()=>{body.classList.toggle('col-off');layout();pinHandle()};
function pinHandle(){
  const r=$('#tour').getBoundingClientRect(),m=mb?mb.getBoundingClientRect():r;
  if(!r.height)return;
  root.style.setProperty('--tt',r.top+'px');
  col.style.top=(m.top+m.height/2)+'px';
  col.style.left=(body.classList.contains('col-off')?m.right+8:r.right+8)+'px';
}
/* the tab bar is a tablist; the flyout is its panel */
function syncTabs(){
  const open=flyOpen();
  $$('.tabs [data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(open&&b.classList.contains('on')));b.tabIndex=(b.classList.contains('on')||!$('.tabs .on'))?0:-1});
}
$('#tour').addEventListener('click',e=>{                     // click a tab: open it. Click the open tab again: close it.
  const b=e.target.closest('.tabs [data-tab]');if(!b||!desktopExplore())return;
  if(!pick.hidden&&pick.classList.contains('side'))closePick();      // opening a tab replaces the Build sheet
  if(!flyOpen()){body.classList.remove('tour-closed')}
  else if(b.classList.contains('on')){body.classList.add('tour-closed');e.stopPropagation();e.preventDefault()}
  setTimeout(()=>{layout();pinHandle();syncTabs()},0);
},true);
$('#tour').addEventListener('click',e=>{if(e.target.closest('.fly-x'))setFly(false)});
$('#tour').addEventListener('keydown',e=>{                   // arrow keys move between tabs
  const b=e.target.closest('.tabs [data-tab]');if(!b||(e.key!=='ArrowRight'&&e.key!=='ArrowLeft'))return;
  const all=$$('.tabs [data-tab]'),i=all.indexOf(b),n=all[(i+(e.key=='ArrowRight'?1:all.length-1))%all.length];n.focus();e.preventDefault();
});
body.classList.add('tour-closed');
let lastTab=TAB;

/* ---------- 6. wiring ---------- */
function decorate(){
  $$('.tabs [data-tab]').forEach(b=>{if(!b.querySelector('svg'))b.insertAdjacentHTML('afterbegin',`<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[b.dataset.tab]||''}</svg>`);b.setAttribute('role','tab');b.setAttribute('aria-controls','tb')});
  const tabs=$('.tabs');if(tabs)tabs.setAttribute('role','tablist');
  const tb=$('#tb');if(tb){tb.setAttribute('role','tabpanel');if(desktopExplore()&&!tb.querySelector('.fly-x'))tb.insertAdjacentHTML('afterbegin','<button class="fly-x" type="button" aria-label="Close panel">✕</button>')}
  const br=$('#browse');if(br){br.onclick=()=>openPicker('lib');if(!br.querySelector('.thumb'))br.insertAdjacentHTML('afterbegin',`<span class="thumb">${struct2D(N,ORD,SUB,{small:true})}</span>`)}
  const sp=$('.stepper span');if(sp&&!sp.querySelector('.cdots'))sp.insertAdjacentHTML('afterbegin',`<span class="cdots">${'<i></i>'.repeat(N)}</span>`);
  syncTabs();
}
let hintT=0;
function sync(){
  pinHandle();placeLeft();paintMolCard();if(!nc.hidden)showName();col.hidden=!desktopExplore();
  const tn=$('#title .tn');if(tn&&!tn.hasAttribute('tabindex')){tn.tabIndex=0;tn.setAttribute('role','button');tn.setAttribute('aria-haspopup','true');tn.setAttribute('aria-label','About this molecule')}
  if(desktopExplore()&&!hintT)hintT=setTimeout(()=>{const h=$('#hint');h&&h.classList.add('off')},9000);   // the hint has done its job after 9 s
}
function wrap(name,fn){const o=window[name];if(typeof o!=='function')return;window[name]=function(){const r=o.apply(this,arguments);try{fn()}catch(e){console.warn('float.js',name,e)}return r}}
wrap('titleUI',sync);
wrap('rightUI',()=>{decorate();if(TAB!==lastTab){lastTab=TAB;body.classList.remove('tour-closed');layout()}pinHandle()});
['learnUI','namesUI','reactUI','propUI','pracUI'].forEach(n=>wrap(n,decorate));
wrap('leftUI',()=>{decorate()});
addEventListener('resize',()=>{lastKey='';sync();queueSnap()});
if(window.ResizeObserver)new ResizeObserver(()=>{pinHandle();placeSheet()}).observe($('#tour'));
/* Esc closes the top-most thing: hover card, then picker, then the flyout */
addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(!nc.hidden){hideName();return}
  if(!pick.hidden){closePick();return}
  if(desktopExplore()&&flyOpen())setFly(false);
});
try{decorate();sync()}catch(e){console.warn('float.js init',e)}
})();