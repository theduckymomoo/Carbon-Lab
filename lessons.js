/* lessons.js — left panel + picker, dock, title, right-hand tabs (Learn/Names/React/Forces/Practice),
   lesson data and flow, reaction UI, practice questions and boot. Loads last. */

/* ---------- lesson state ---------- */
let TAB='learn',mod=0,tourStep=0,tourTouched=0,answered={},LAST=null;
const curStep=()=>MODS[mod].steps[tourStep];
function evt(k){const s=curStep();if(s&&s.need==k&&!tourTouched){tourTouched=1;rightUI()}}

/* ---------- left panel: pick and build ---------- */
const GR=[['OH','–OH','Alcohol (hydroxyl)'],['=O','C=O','Carbonyl: aldehyde or ketone'],['COOH','–COOH','Carboxylic acid'],['COOCH3','–COOCH₃','Ester'],['Cl','–Cl','Chloro'],['Br','–Br','Bromo'],['CH3','–CH₃','Methyl branch']];
const codes=g=>({COOH:['=O','OH'],COOCH3:['=O','OCH3']})[g]||[g],ordNames=['','single','double','triple'];
const validAll=(n,o,s)=>s.every((_,i)=>hOf(i,n,o,s)>=0);
function can(i,g){const cs=codes(g);if(cs.every(c=>SUB[i].includes(c)))return true;if(g=='CH3'&&!(N>=3&&i>0&&i<N-1))return false;
 const s=SUB.map(x=>x.slice());cs.forEach(c=>s[i].includes(c)||s[i].push(c));return validAll(N,ORD,s)}
const selC=()=>SEL&&/^C\d+$/.test(SEL)?+SEL.slice(1):-1;
function leftUI(){const sc=selC(),cur=LIBFLAT.find(same);
 $('#left').innerHTML=`<button class="browsebtn" id="browse"><b>Pick a molecule</b><small>${cur?cur.name+' · '+cur.mf:LIBFLAT.length+' molecules, with names, formulas and 3D models'}</small></button>
 <details open><summary>Build your own</summary><p class="sub">Chains of 1 to 8 carbons.</p><div class="stepper"><button id="mn" ${N<=1?'disabled':''} aria-label="Remove a carbon">−</button><span>${N} carbon${N>1?'s':''}</span><button id="pl" ${N>=8?'disabled':''} aria-label="Add a carbon">+</button></div>
 ${N>1?`<p class="sub" style="margin-top:10px">Tap a bond to change it.</p><div class="chips">${ORD.map((o,k)=>`<button class="c ${o==2?'dbl':o==3?'tri':''}" data-b="${k}">C${k+1}–C${k+2} · ${ordNames[o]}</button>`).join('')}</div>`:''}
 <p class="sub" style="margin-top:10px">${sc<0?'Tap a carbon in the 3D model, then add a group:':`Add a group to carbon ${sc+1}:`}</p>
 <div class="chips">${GR.map(g=>`<button class="c ${sc>=0&&codes(g[0]).every(c=>SUB[sc].includes(c))?'on':''}" title="${g[2]}" data-g="${g[0]}" ${sc<0||!can(sc,g[0])?'disabled':''}>${g[1]}</button>`).join('')}</div></details>`;
 $('#browse').onclick=pickUI;
 $('#mn').onclick=()=>setMol(N-1,ORD.slice(0,-1),SUB.slice(0,-1));$('#pl').onclick=()=>setMol(N+1,ORD.concat(1),SUB.concat([[]]));
 document.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{const k=+b.dataset.b;let v=ORD[k];for(let t=0;t<3;t++){v=v%3+1;const o=ORD.slice();o[k]=v;if(validAll(N,o,SUB)){setMol(N,o,SUB);evt('bond');return}}});
 document.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const cs=codes(b.dataset.g),s=SUB.map(x=>x.slice()),has=cs.every(c=>s[sc].includes(c));
  s[sc]=has?s[sc].filter(c=>!cs.includes(c)):s[sc].concat(cs.filter(c=>!s[sc].includes(c)));setMol(N,ORD,s);evt('group')})}

/* ---------- molecule picker overlay ---------- */
function closePick(){$('#pick').hidden=true}
function pickUI(){
 const el=$('#pick'),cur=LIBFLAT.find(same);
 el.innerHTML=`<div class="mapcard">
  <div class="pkhead"><div><h1>Pick a molecule</h1><p class="sub">${LIBFLAT.length} molecules · tap one to open it in the 3D model</p></div><button class="btn g" id="pkx">Close</button></div>
  <input id="pks" class="pks" type="search" placeholder="Search by name or formula, e.g. bromo, C4H10" autocomplete="off" spellcheck="false">
  <div id="pkl">${Object.entries(LIB).map(([g,a])=>`<section class="pkcat"><h3>${g}</h3><div class="pkgrid">${a.map(m=>`<button class="pk${cur&&cur.name==m.name?' on':''}" data-p="${m.name}" data-s="${(m.name+' '+m.mf+' '+cond(m.n,m.o,m.s)).toLowerCase()}"><b>${m.name}</b><small>${m.mf}</small><span class="pkc">${cond(m.n,m.o,m.s)}</span></button>`).join('')}</div></section>`).join('')}</div>
  <div class="mapfoot"><button class="hint2" id="pke">Close and explore freely</button></div></div>`;
 el.hidden=false;
 el.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{closePick();load(b.dataset.p)});
 $('#pkx').onclick=closePick;$('#pke').onclick=()=>{closePick();setUX('explore')};
 $('#pks').oninput=e=>{const q=e.target.value.trim().toLowerCase();
  el.querySelectorAll('#pkl .pk').forEach(b=>b.hidden=!!q&&!b.dataset.s.includes(q));
  el.querySelectorAll('#pkl .pkcat').forEach(s=>s.hidden=!Array.from(s.querySelectorAll('.pk')).some(b=>!b.hidden))};
 el.onclick=e=>{if(e.target===el)closePick()};
}

/* ---------- representations: structural, semi-structural, condensed, molecular ---------- */
let REP=0,HOV=null,NREV=false,CNT=null;
const REPCAP=['Every line is one bond (a shared pair of electrons). Each C has 4 lines in total; a double bond counts as 2. Hover an atom here and it lights up in 3D.','Semi-structural: the hydrogens are grouped on the carbon they belong to, and the bonds between carbons are still drawn.','Condensed: no bonds drawn. Read it left to right along the chain, one group per carbon.','Molecular formula: only how many atoms of each element. It does not show how they are arranged.'];
const KC={stem:'k-stem',unsat:'k-unsat',suf:'k-suf',ester:'k-ester',pre:'k-pre'};
const nameHTML=name=>{const p=parseName(name);return p.error?name:p.comps.map(c=>`<span class="tk on ${KC[c.k]}">${c.t}</span>`).join('')};
function meaning(name){const p=parseName(name);if(p.error)return[];const r=[['k-stem',`${p.stem} = ${p.n} carbon${p.n>1?'s':''}`],p.un=='an'?['k-unsat','-ane = single bonds only']:p.un=='yn'?['k-unsat','-yne = a C≡C triple bond']:['k-unsat',p.un=='dien'?'-diene = two C=C bonds':'-ene = a C=C double bond']];
 if(p.stype)r.push(['k-suf',{ol:'-ol = an –OH group',al:'-al = –CHO, a C=O at the end','one':'-one = a C=O inside the chain','oic acid':'-oic acid = a –COOH group',oate:'-oate = an ester'}[p.stype]]);
 p.pre.forEach(q=>r.push(['k-pre',`${q.w} = ${{chloro:'a Cl atom',bromo:'a Br atom',methyl:'a CH₃ branch',hydroxy:'an –OH group',oxo:'a C=O',methoxy:'an –OCH₃ group'}[q.w]}`]));return r}
function condParts(n,ord,sub){const gt={OH:'OH','=O':'O',Cl:'Cl',Br:'Br',CH3:'CH3',OCH3:'OCH3'},r=[];
 for(let i=0;i<n;i++){const g=sub[i],h=hOf(i,n,ord,sub);let t='C'+(h?'H'+(h>1?h:''):'');if(g.includes('=O'))t+='O'+g.filter(c=>c!='=O').map(c=>gt[c]).join('');else g.forEach(c=>t+=(i==n-1&&g.length==1)?gt[c]:'('+gt[c]+')');r.push(t.replace(/\d+/g,sb))}return r}
function struct2D(n=N,ord=ORD,sub=SUB,o={}){const semi=!!o.semi,X=semi?66:54,x0=semi?66:62,y0=64,w=x0*2+(n-1)*X,hl=o.hl||new Set(),da=id=>o.small?'':`data-id="${id}"`,
  col={H:'#7b8aa0',OH:'#c0392b','=O':'#c0392b',OCH3:'#c0392b',Cl:'#1f7a35',Br:'#8a3a28'};
 const ln=(x1,y1,x2,y2,k)=>{const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;return(k==1?[0]:k==2?[-2.6,2.6]:[-4.4,0,4.4]).map(m=>`<line x1="${x1+nx*m}" y1="${y1+ny*m}" x2="${x2+nx*m}" y2="${y2+ny*m}"/>`).join('')};
 let s=`<svg class="s2 ${o.small?'sm':''}" viewBox="0 0 ${w} 128" width="${w}" height="128" role="img" aria-label="Structural formula" stroke="#1d2d50" stroke-width="2" stroke-linecap="round" fill="none">`;
 for(let i=0;i<n-1;i++)s+=ln(x0+i*X+(semi?22:13),y0,x0+(i+1)*X-(semi?22:13),y0,ord[i]);
 for(let i=0;i<n;i++){const x=x0+i*X,g=sub[i],hn=Math.max(0,hOf(i,n,ord,sub)),its=g.map((c,j)=>({c,id:'S'+i+'_'+c+(g.slice(0,j).filter(z=>z==c).length||'')}));
  if(!semi)for(let k=0;k<hn;k++)its.push({c:'H',id:'H'+i+'_'+k});const sl=[];if(i==0)sl.push([-1,0]);if(i==n-1)sl.push([1,0]);sl.push([0,-1],[0,1]);
  its.forEach((it,k)=>{const d=sl[k],c=it.c;if(!d)return;const ex=x+d[0]*41,ey=y0+d[1]*41,e=c=='H'?8:11,r0=semi?20:11;s+=ln(x+d[0]*r0,y0+d[1]*r0,ex-d[0]*e,ey-d[1]*e,c=='=O'?2:1);
   const lab=c=='H'?'H':c=='=O'?'O':c=='OH'?(d[0]<0?'HO':'OH'):c=='CH3'?(d[0]<0?'H₃C':'CH₃'):c=='OCH3'?(d[0]<0?'H₃CO':'OCH₃'):c;
   s+=`<g ${da(it.id)}><circle class="hb" cx="${ex}" cy="${ey}" r="13" stroke="none"/><text x="${ex}" y="${ey}" stroke="none" fill="${col[c]||'#1d2d50'}" font-size="15" font-weight="600" text-anchor="middle" dominant-baseline="central">${lab}</text></g>`});
  const lab=semi?'C'+(hn?'H'+(hn>1?sb(hn):''):''):'C',sel=SEL=='C'+i||hl.has(i);
  s+=`<g ${da('C'+i)}><circle class="hb" cx="${x}" cy="${y0}" r="${semi?21:14}" stroke="none" style="${sel?'fill:#dbe7ff':''}"/><text x="${x}" y="${y0+1}" stroke="none" fill="#14213d" font-size="17" font-weight="700" text-anchor="middle" dominant-baseline="central">${lab}</text></g>`}
 return s+'</svg>'}
function repHTML(M){return REP<2?struct2D(N,ORD,SUB,{semi:REP==1}):REP==2?`<div class="big">${condParts(N,ORD,SUB).map((t,i)=>`<span data-id="C${i}" class="hb2">${t}</span>`).join('')}</div>`:`<div class="big">${M.mf}</div>`}
function hovUI(){document.querySelectorAll('#dock [data-id]').forEach(g=>g.classList.toggle('hov',g.dataset.id==HOV))}
function wireRep(){document.querySelectorAll('#dock [data-id]').forEach(g=>{const id=g.dataset.id;g.onmouseenter=()=>{HOV=id;hovUI()};g.onmouseleave=()=>{HOV=null;hovUI()};g.onclick=()=>select(id)});
 document.querySelectorAll('[data-rp]').forEach(b=>b.onclick=()=>{REP=+b.dataset.rp;dockUI()});document.querySelectorAll('#dock [data-i],#facts [data-i]').forEach(b=>b.onclick=()=>load(b.dataset.i))}
function factsHTML(M){const bp=BPT[M.name],iso=LIBFLAT.filter(m=>m.mf==M.mf&&!same(m));
 return`<div class="fc"><small>Molecular formula</small><b>${M.mf}</b></div><div class="fc"><small>Condensed formula</small><b>${M.cond}</b></div>${bp!=null?`<div class="fc"><small>Boiling point</small><b>${fmtT(bp)}</b></div>`:''}${iso.length?`<div class="fc"><small>Isomers (same formula)</small><div class="chips">${iso.map(m=>`<button class="c" data-i="${m.name}">${m.name}</button>`).join('')}</div></div>`:''}`}
function titleUI(){const t=$('#title');if(QUIZ){t.innerHTML='<div class="tn q">?</div><div class="tg">Name this molecule</div>';return}const M=desc(),mean=meaning(M.name);NREV=!!M.rev;
 t.innerHTML=`<div class="tn pop">${nameHTML(M.name)}</div><div class="tg">${M.group}</div>${MODEUX=='explore'||UXS.mean?`<div class="mean">${mean.map(m=>`<span class="mc ${m[0]}">${m[1]}</span>`).join('')}</div>`:''}`}
function dockUI(){const dk=$('#dock');
 if(QUIZ){dk.innerHTML=`<div class="rep"><div class="d2">${struct2D()}</div></div>`;$('#facts').innerHTML='';wireRep();return}
 const M=desc();NREV=!!M.rev;
 dk.innerHTML=`<div class="rep"><div class="seg2">${['Structural','Semi-structural','Condensed','Molecular'].map((t,i)=>`<button data-rp="${i}" class="${REP==i?'on':''}">${t}</button>`).join('')}</div><div class="d2">${repHTML(M)}</div><div class="cap2">${REPCAP[REP]}</div></div><div class="dt">${factsHTML(M)}</div>`;
 $('#facts').innerHTML=factsHTML(M);wireRep()}
function refreshUI(){leftUI();dockUI();titleUI();showInfo();rightUI();layout()}

/* ---------- reactions: UI wrapper ---------- */
function doRx(k){const r=RX[k];if(!r.ok())return;const before=[N,ORD.slice(),cl()],bn=desc().name,x=r.run();
 if(x.none)LAST={type:r.t,eq:x.eq||bn+' + Br₂ → no reaction',why:x.why,vial:x.vial,tally:x.tally};
 else{HIST.push(before);setMol(x.n||N,x.o,x.s,{fly:true});LAST={type:r.t,eq:`${bn}${x.re?' + '+x.re:''} → ${desc().name}${x.by?' + '+x.by:''}${x.cond?'  ('+x.cond+')':''}`,why:x.why,vial:x.vial||null,before,after:[N,ORD.slice(),cl()]}}
 evt('act');rightUI()}
function reactUI(){const G=[['Addition','A multiple bond opens and two atoms add on. One product.'],['Substitution','One atom or group swaps for another. The carbon–carbon bonds stay the same.'],['Elimination','A small molecule leaves and a multiple bond forms.'],['Other','']];
 let L='';if(LAST){const[hb,ha]=LAST.before?diffHl(LAST.before,LAST.after):[0,0];L=`<div class="fb ok"><span class="badge">${LAST.type}</span><br><b>${LAST.eq}</b><br>${LAST.why}</div>${LAST.before?`<div class="ba"><div>${struct2D(...LAST.before,{hl:hb,small:1})}</div><span>→</span><div>${struct2D(...LAST.after,{hl:ha,small:1})}</div></div>`:''}${LAST.tally||''}${LAST.vial?`<div class="vial ${LAST.vial}"><i></i><span>Bromine water: ${LAST.vial=='clear'?'orange to colourless':'stays orange'}</span></div>`:''}`}
 $('#tb').innerHTML=`<p class="sub">${N>3?'On a longer chain, tap a carbon first to choose where it happens. ':''}Hover a reaction to see where it acts, then press it.</p>${G.map(([g,d])=>`<h4>${g}</h4>${d?`<p class="sub">${d}</p>`:''}<div class="chips rx">${Object.keys(RX).filter(k=>RX[k].t==g).map(k=>`<button class="c" data-r="${k}" ${RX[k].ok()?'':'disabled'}>${RX[k].l}</button>`).join('')}</div>`).join('')}${L}
 <div class="nav" style="margin-top:10px"><button class="btn g" id="un" ${HIST.length?'':'disabled'}>Undo reaction</button></div>`;
 document.querySelectorAll('[data-r]').forEach(b=>{b.onclick=()=>doRx(b.dataset.r);const on=()=>{if(!b.disabled)FOC=rxTarget(b.dataset.r)},off=()=>{FOC=null};b.onmouseenter=on;b.onfocus=on;b.onmouseleave=off;b.onblur=off});
 $('#un').onclick=()=>{if(HIST.length){const h=HIST.pop();setMol(h[0],h[1],h[2],{fly:true});LAST=null;rightUI()}};setTimeout(()=>{const v=$('.vial');v&&v.classList.add('go')},60)}

/* ---------- names: decoder UI + typed-name solver ---------- */
function decSet(o,part){clearInterval(CNT);Object.assign(DEC,o);if(!decOk(DEC.end,DEC.stem))DEC.end='an';const[n,ord,sub,ps]=decState();DEC.pos=ps;setOpt('num',1);setMol(n,ord,sub);FOC=decFocus(part||(o.stem!==undefined&&o.end===undefined?'stem':'end'));rightUI()}
function countAnim(){clearInterval(CNT);const n=DEC.stem;let k=0;CNT=setInterval(()=>{k++;FOC=Array.from({length:k},(_,i)=>'C'+i);const c=$('#cnote');if(c)c.innerHTML=`Counting: ${Array.from({length:k},(_,i)=>i+1).join(' · ')}${k>=n?` → <b>${STEMW[n-1]}</b> = ${n}`:''}`;if(k>=n){clearInterval(CNT);setTimeout(()=>{FOC=decFocus('stem')},1100)}},600)}
function namesUI(){const[n,ord,sub,ps]=decState(),nm=analyse(n,ord,sub).name,en=ENDS.find(e=>e[0]==DEC.end),r=posRange(DEC.end,n);
 $('#tb').innerHTML=`<p class="sub">A name is a code. The <b class="k-stem">stem</b> counts carbons. The <b class="k-unsat">ending</b> tells you the bonds or group. Build one and watch the 3D model.</p>
 <p class="sub" style="margin-bottom:4px">1 · How many carbons?</p><div class="chips">${STEMW.map((w,i)=>`<button class="c ${DEC.stem==i+1?'on':''}" data-st="${i+1}">${w}- <small>${i+1}</small></button>`).join('')}</div>
 <p class="sub" style="margin:10px 0 4px">2 · Which bonds or group?</p><div class="chips">${ENDS.map(e=>`<button class="c ${DEC.end==e[0]?'on':''}" data-en="${e[0]}" ${decOk(e[0],n)?'':'disabled'}>${e[1]}</button>`).join('')}</div>
 ${r&&r[1]>r[0]?`<p class="sub" style="margin:10px 0 4px">3 · Which carbon? (the number in the name)</p><div class="chips">${Array.from({length:r[1]-r[0]+1},(_,i)=>r[0]+i).map(p=>`<button class="c ${ps==p?'on':''}" data-ps="${p}">${p}</button>`).join('')}</div>`:''}
 <div class="nmrow" style="margin-top:12px">${nameHTML(nm)}</div><div class="fb"><b class="k-stem">${STEMW[n-1]}</b> = ${n} carbon${n>1?'s':''}.<br><b class="k-unsat">${en[1]}</b> = ${en[2]}.<div id="cnote" style="margin-top:4px"></div></div>
 <div class="nav" style="margin-top:8px"><button class="btn g" id="cnt">Count the carbons</button><button class="btn g" id="nm1">Add a carbon</button></div><h4 style="margin-top:16px">Type a name instead</h4><div id="solv"></div>`;
 document.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>decSet({stem:+b.dataset.st},'stem'));document.querySelectorAll('[data-en]').forEach(b=>b.onclick=()=>decSet({end:b.dataset.en},'end'));
 document.querySelectorAll('[data-ps]').forEach(b=>b.onclick=()=>decSet({pos:+b.dataset.ps},'end'));$('#cnt').onclick=countAnim;$('#nm1').onclick=()=>decSet({stem:Math.min(8,DEC.stem+1)},'stem');solveUI()}

function setRep(i){REP=i;dockUI()}

/* ---------- properties ---------- */
function propUI(){const M=desc(),bp=BPT[M.name],has=c=>SUB.some(g=>g.includes(c)),hb=has('OH'),pol=hb||has('=O')||has('Cl')||has('Br')||has('OCH3'),br=has('CH3');
 const why=hb?'The –OH group lets molecules hydrogen-bond to each other. That is the strongest of these forces, so more energy is needed to pull molecules apart: a higher boiling point than a hydrocarbon of similar size.':
  br?'Branching makes the molecule more compact. Less surface touches its neighbours, so London forces are weaker and the boiling point is lower than for the straight-chain isomer.':
  pol?'Polar bonds (C–O, C=O or C–halogen) add dipole-dipole forces on top of London forces.':'Only London forces act. Longer chains have more surface contact, so the forces and the boiling point rise with chain length.';
 const iso=LIBFLAT.filter(m=>m.mf==M.mf).map(m=>({n:analyse(m.n,m.o,m.s).name})).filter(x=>BPT[x.n]!=null),pos=v=>((v+170)/320*100).toFixed(1);
 $('#tb').innerHTML=`<h2>${cap(M.name)}</h2><p class="sub">Forces between molecules decide the boiling point.</p><div class="chips" style="margin-bottom:10px"><span class="c on">London forces</span>${pol?'<span class="c on">Dipole-dipole</span>':''}${hb?'<span class="c on">Hydrogen bonding</span>':''}</div>
 <div class="fb">${why}</div>
 ${bp!=null?`<p style="margin:10px 0 4px"><b>Boiling point: ${fmtT(bp)}</b></p><div class="therm"><span style="left:${pos(bp)}%"></span>${iso.filter(x=>x.n!=M.name).map(x=>`<i style="left:${pos(BPT[x.n])}%"></i>`).join('')}</div><div class="scale"><span>−170 °C</span><span>150 °C</span></div>
 ${iso.length>1?`<p class="sub">Same formula (${M.mf}): ${iso.map(x=>`${x.n} ${fmtT(BPT[x.n])}`).join(' · ')}</p>`:''}`:'<p class="sub">No boiling point data for this molecule. Try one from the list on the left.</p>'}`}

/* ---------- display options + persistence ---------- */
const setOpt=(k,v)=>{OPT[k]=v;const b=$(`[data-t="${k}"]`);b&&b.classList.toggle('on',!!v)};
const flat=(msg)=>'Look at the model: '+msg;
let DONE=new Set();try{DONE=new Set(JSON.parse(localStorage.getItem('carbonlab.done')||'[]'))}catch(e){}
const saveDone=()=>{try{localStorage.setItem('carbonlab.done',JSON.stringify([...DONE]))}catch(e){}};

/* ---------- lesson content ---------- */
const MODS0=[
{n:'1 · Carbon\'s four bonds',steps:[
 {t:'Meet methane',c:'This is methane: one carbon (dark) joined to four hydrogens (light). Drag to turn it, scroll or pinch to zoom.',go(){load('Methane',{});selSet(null);setOpt('elec',0)}},
 {t:'Four bonds, spread apart',c:'Tap the carbon. Each bond is a pair of electrons shared with a hydrogen (the gold dots). Carbon always makes exactly 4 bonds, and they spread as far apart as they can: about 109.5°.',go(){load('Methane');setOpt('elec',1);setOpt('shape',1);selSet('C0')}},
 {t:'Carbon links to carbon',c:'Butane is a chain of four carbons. Tap any carbon and count its bonds (to carbon and to hydrogen). It always adds up to 4.',need:'tap',go(){load('Butane');setOpt('elec',0);selSet(null)}},
 {t:'Predict: a double bond',q:'Two carbons share a double bond. What shape do they make?',o:['Stays tetrahedral','Goes flat, 120°','Goes straight, 180°'],a:1,
  ok:'Yes. A double bond uses 2 of carbon\'s 4 bonds, so each carbon has only 3 neighbours. They spread out flat, 120° apart.',no:flat('it went flat, 120° apart. Each carbon now has only 3 neighbours, so they spread out in a plane.'),reveal(){load('Ethene');setOpt('shape',1);selSet('C0')},go(){load('Butane');selSet(null)}},
 {t:'Try it: change a bond',c:'{buildhow}, then tap a bond to make it double. Two hydrogens disappear and the shape flattens.',need:'bond',go(){load('Propane');setOpt('shape',1);selSet('C0')}},
 {t:'Predict: a triple bond',q:'A triple bond uses 3 of carbon\'s 4 bonds. What shape will the carbons take?',o:['Stays tetrahedral','Goes flat, 120°','Goes straight, 180°'],a:2,
  ok:'Yes. Each carbon has just 2 neighbours, so they sit opposite each other: a straight line.',no:flat('it is a straight line, 180°. Each carbon has only 2 neighbours, so they point in opposite directions.'),reveal(){load('Ethyne');setOpt('shape',1);selSet('C0')},go(){load('Ethene');selSet(null)}}]},
{n:'2 · Functional groups',steps:[
 {t:'The –OH group',c:'Ethanol is ethane with one hydrogen swapped for –OH. A functional group is the part of a molecule that decides how its whole family behaves. Tap the red oxygen.',need:'tap',go(){load('Ethanol');selSet(null)}},
 {t:'Predict: which family?',q:'Here the C=O sits in the middle of the chain (propanone). Which family is it?',o:['Aldehyde','Ketone','Carboxylic acid'],a:1,ok:'Yes. C=O inside the chain is a ketone.',no:'It is a ketone: C=O inside the chain. Moving C=O to the end of the chain (with an H) gives an aldehyde, as the model now shows.',reveal(){load('Propanal');selSet('C0')},go(){load('Propanone');selSet('C1')}},
 {t:'Two groups, one carbon',c:'Put a C=O and an –OH on the same end carbon and you get –COOH, the carboxyl group. Molecules that have it are carboxylic acids.',go(){load('Ethanoic acid');selSet('C0')}},
 {t:'Halogens',c:'In bromoethane, a bromine atom replaces a hydrogen. Try the space-filling view (the toolbar on the right) to see how much bigger Br is than H.',go(){load('Bromoethane');selSet(null)}},
 {t:'Build one yourself',c:'{buildhow}. Tap a carbon, then add a group. The name updates by itself. Try to make propan-2-ol.',need:'group',go(){load('Propane');selSet('C1')}}]},
{n:'3 · Isomers',steps:[
 {t:'Chain isomers',c:'Isomers have the same atoms, joined differently. Butane and 2-methylpropane are both C₄H₁₀, but one is a straight chain and the other is branched. Press the button.',need:'act',act:['Rearrange to 2-methylpropane',()=>load('2-methylpropane')],go(){load('Butane');selSet(null)}},
 {t:'Position isomers',c:'But-1-ene and but-2-ene are both C₄H₈ with one double bond, but the double bond sits in a different place.',need:'act',act:['Move the double bond',()=>load('But-2-ene')],go(){load('But-1-ene');selSet(null)}},
 {t:'Functional isomers',c:'Propanal and propanone are both C₃H₆O, but the C=O sits in a different place, so they are different families (aldehyde and ketone).',need:'act',act:['Move the C=O',()=>load('Propanone')],go(){load('Propanal');selSet(null)}},
 {t:'Explore more',c:'Hover over the molecule\'s name to see its isomers, then click one to morph into it.',go(){load('Propan-1-ol');selSet(null)}}]},
{n:'4 · Reactions',steps:[
 {t:'The bromine water test',c:'Bromine water is orange. Press the button to add Br₂ to ethene and watch the double bond open.',need:'act',act:['Add Br₂',()=>doRx('br2')],go(){load('Ethene');selSet(null)}},
 {t:'Predict: a saturated molecule',q:'Will bromine water change colour with ethane?',o:['Yes, goes colourless','No, stays orange'],a:1,ok:'Right. Ethane has no spare bond to open, so the bromine is not used up.',no:'It stays orange. Ethane has no multiple bond to break, so nothing reacts.',reveal(){load('Ethane');doRx('br2')},go(){load('Ethene');selSet(null)}},
 {t:'Addition: HBr to propene',c:'HBr adds across the double bond. The Br attaches to the carbon that already has fewer hydrogens: that is the major product.',need:'act',act:['Add HBr',()=>doRx('hbr')],go(){load('Propene');selSet(null)}},
 {t:'Elimination',c:'Elimination is the reverse of addition: take water out of propan-2-ol and a double bond forms.',need:'act',act:['Remove H₂O',()=>doRx('elO')],go(){load('Propan-2-ol');selSet(null)}},
 {t:'Substitution',c:'In substitution, one atom is swapped for another. Here, light lets chlorine replace a hydrogen. The carbon chain stays the same.',need:'act',act:['Add Cl₂ in light',()=>doRx('cl2')],go(){load('Ethane');selSet(null)}},
 {t:'Substitution: a haloalkane',c:'Swap the bromine for –OH. The carbon chain stays the same; only the attached group changes.',need:'act',act:['NaOH(aq)',()=>doRx('hyd')],go(){load('Bromoethane');selSet(null)}},
 {t:'Esterification',c:'An acid and an alcohol join and lose a molecule of water, making an ester. Press the button to add methanol.',need:'act',act:['Add methanol',()=>doRx('est')],go(){load('Ethanoic acid');selSet(null)}},
 {t:'Combustion',c:'Burning butane in plenty of oxygen makes CO₂ and H₂O. The atom table shows every element balances: atoms are never lost.',need:'act',act:['Burn it',()=>doRx('comb')],go(){load('Butane');selSet(null)}},
 {t:'Cracking',c:'Heat splits a long alkane into shorter molecules. Press the button and watch two carbons break away.',need:'act',act:['Crack it',()=>doRx('crk')],go(){load('Hexane');selSet(null)}},
 {t:'Longer chains',c:'Reactions work on longer chains too. Tap a carbon on the double bond to choose where HBr adds, then press the button.',need:'act',act:['Add HBr here',()=>doRx('hbr')],go(){load('Pent-2-ene');selSet('C1')}}]},
{n:'5 · Boiling points',steps:[
 {t:'Longer chain, higher boiling point',c:'Butane boils at about −0.5 °C (hover over its name to check). Add a carbon and compare. A longer chain touches its neighbours more, so the forces between molecules (London forces) are stronger.',need:'act',act:['Make pentane',()=>load('Pentane')],go(){load('Butane');selSet(null)}},
 {t:'Branching',c:'Pentane and 2-methylbutane are isomers. A branched molecule is more compact, so it touches its neighbours less and boils at a lower temperature.',need:'act',act:['Branch it',()=>load('2-methylbutane')],go(){load('Pentane');selSet(null)}},
 {t:'Predict: hydrogen bonding',q:'Propane boils at −42 °C. Propan-1-ol has a similar size. What happens to the boiling point?',o:['About the same','Much higher','Lower'],a:1,ok:'Yes, 97 °C. The –OH groups hydrogen-bond, the strongest force here.',no:'It rises to 97 °C. The –OH groups hydrogen-bond to each other, so it takes far more energy to separate the molecules.',reveal(){load('Propan-1-ol')},go(){load('Propane');selSet(null)}}]},
{n:'6 · Reading a name',steps:[
 {t:'meth-ane: a name is a code',c:'Look at the name above the model. <b>meth</b> counts the carbons: 1. <b>-ane</b> tells you the bond type: single bonds only. In the structural formula the carbon has 4 lines, one to each H.',go(){decSet({stem:1,end:'an'});setRep(0)}},
 {t:'Add a second carbon',c:'eth = 2 carbons. Watch H–C–C–H appear while each carbon still has 4 lines. Press the button.',need:'act',act:['Add a carbon',()=>decSet({stem:2},'stem')],go(){decSet({stem:1,end:'an'})}},
 {t:'Three, four and more',c:'prop = 3, but = 4, pent = 5, hex = 6, hept = 7, oct = 8. Keep pressing and watch the name and the formula change together.',need:'act',act:['Add a carbon',()=>decSet({stem:Math.min(8,DEC.stem+1)},'stem')],go(){decSet({stem:3,end:'an'})}},
 {t:'Predict: what does -ene mean?',q:'Ethane is H–C–C–H with single bonds. What does changing -ane to -ene do?',o:['Nothing','Makes a C=C double bond','Adds an –OH group'],a:1,ok:'Yes. -ene means a C=C double bond: two lines between the carbons.',no:'It makes a C=C double bond, as the model shows: ethene, H₂C=CH₂.',reveal(){decSet({stem:2,end:'en'})},go(){decSet({stem:2,end:'an'})}},
 {t:'-yne: a triple bond',c:'Same stem, new ending. -yne means a C≡C triple bond: three lines between the carbons, and the shape becomes a straight line.',need:'act',act:['Change -ene to -yne',()=>decSet({end:'yn'},'end')],go(){decSet({stem:2,end:'en'})}},
 {t:'Predict: what does -ol mean?',q:'Ethane becomes ethanol. What does -ol tell you?',o:['A triple bond','An –OH group (alcohol)','A C=O group'],a:1,ok:'Yes. -ol means an –OH group, the alcohol group.',no:'-ol means an –OH group: the alcohol group, as the model shows.',reveal(){decSet({stem:2,end:'ol'})},go(){decSet({stem:2,end:'an'})}},
 {t:'More endings',c:'-al: C=O at the end with an H (aldehyde). -one: C=O inside the chain (ketone). -oic acid: –COOH. Press to see propanone, then try the others in the Names tab.',need:'act',act:['Show -one',()=>decSet({stem:3,end:'one',pos:2},'end')],go(){decSet({stem:3,end:'an'})}},
 {t:'Now you try',c:'Open the Names tab (Explore mode): pick a stem and an ending and watch the 3D model, or type a name to see it solved step by step.',act:['Open the name builder',()=>{TAB='names';setUX('explore')}],go(){decSet({stem:4,end:'en',pos:1})}}]},
{n:'7 · Four ways to see a molecule',steps:[
 {t:'Molecular formula',c:'C₃H₈ says only how many atoms of each element: 3 carbons and 8 hydrogens. It does not say how they are joined.',go(){load('Propane');setRep(3);selSet(null)}},
 {t:'Condensed formula',c:'CH₃CH₂CH₃ groups each carbon with its hydrogens. Read it left to right along the chain. Hover a group and its carbon lights up in 3D.',go(){load('Propane');setRep(2);selSet(null)}},
 {t:'Semi-structural',c:'Now the bonds between carbons are drawn too: CH₃–CH₂–CH₃. The hydrogens are still grouped.',go(){load('Propane');setRep(1);selSet(null)}},
 {t:'Structural: every bond',c:'Every atom and every bond is drawn: H–C–C–C–H. Each line is one shared pair of electrons and each carbon has exactly 4 lines. Hover or tap an atom in the drawing.',need:'tap',go(){load('Propane');setRep(0);selSet(null)}},
 {t:'Why structure matters',c:'Butane and 2-methylpropane are both C₄H₁₀, but their structural formulas differ, so they are different molecules.',need:'act',act:['Show 2-methylpropane',()=>load('2-methylpropane')],go(){load('Butane');setRep(0);selSet(null)}},
 {t:'Multiple bonds in the drawing',c:'A double bond is two lines, a triple bond three. Count the lines at each carbon: always 4.',need:'act',act:['Show ethyne',()=>load('Ethyne')],go(){load('Ethene');setRep(0);selSet(null)}}]}];

/* ---------- focus + quiz flags ---------- */
let FOC=null,QUIZ=false,fz=1,busy=0;
function setQuiz(v){if(QUIZ!==v){QUIZ=v;dockUI();leftUI();titleUI()}}

/* ---------- typed-name solver UI ---------- */
let SOL=null;
function runSolve(raw){const p=parseName(raw);SOL=p.error?{raw,error:p.error}:Object.assign(p,{steps:solveSteps(p),i:0});if(!p.error)applySol();else{FOC=null;rightUI()}}
function applySol(){const s=SOL.steps[SOL.i];selSet(null);setOpt('num',1);setMol(s.st[0],s.st[1],s.st[2]);FOC=s.focus;rightUI()}
function solveUI(){
 $('#solv').innerHTML=`<p class="sub">Type an IUPAC name. I will build it in 3D one step at a time and explain each part of the name.</p><div class="inp"><input id="nmi" value="${SOL?SOL.raw.replace(/"/g,''):''}" placeholder="e.g. 2-methylbutane" autocomplete="off" spellcheck="false"><button class="btn" id="go">Show me</button></div>
 <div class="chips" style="margin:8px 0">${['propan-2-ol','2-methylbutane','but-2-ene','ethanoic acid','1,2-dibromoethane','methyl ethanoate','pentan-2-one'].map(x=>`<button class="c" data-ex="${x}">${x}</button>`).join('')}</div><div id="sv"></div>`;
 const go=()=>runSolve($('#nmi').value);$('#go').onclick=go;$('#nmi').onkeydown=e=>{if(e.key=='Enter')go()};
 document.querySelectorAll('[data-ex]').forEach(b=>b.onclick=()=>runSolve(b.dataset.ex));
 if(!SOL)return;const sv=$('#sv');
 if(SOL.error){sv.innerHTML=`<div class="fb no">${SOL.error}</div>`;return}
 const s=SOL.steps[SOL.i],hl=c=>s.k=='res'||(s.k=='suf'?(c.k=='suf'||c.k=='ester'):s.k=='pre'?(c.k=='pre'&&c.i==s.pi):c.k==s.k);
 sv.innerHTML=`<div class="nmrow">${SOL.comps.map(c=>`<span class="tk k-${c.k} ${hl(c)?'on':''}">${c.t}</span>`).join('')}</div><div class="dots">${SOL.steps.map((_,i)=>`<i class="${i<SOL.i?'d':i==SOL.i?'cur':''}"></i>`).join('')}</div>
 <div class="fb">${s.cap}</div><div class="nav" style="margin-top:10px"><button class="btn g" id="sb" ${SOL.i==0?'disabled':''}>Back</button><button class="btn" id="sn" ${SOL.i==SOL.steps.length-1?'disabled':''}>Next step</button></div>`;
 $('#sb').onclick=()=>{SOL.i--;applySol()};$('#sn').onclick=()=>{SOL.i++;applySol()}}

/* ---------- practice ---------- */
let PR={q:null,ok:0,n:0,typed:'',answered:false,fb:null,chosen:null,hint:0,st:{}};
const rnd=a=>a[Math.floor(Math.random()*a.length)],shuf=a=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]);
const nmOf=m=>analyse(m.n,m.o,m.s).name,famOf=m=>group(analyse(m.n,m.o,m.s),m.s).split(' · ')[0],tc=(a,b)=>V.len(V.sub(a,b));
function randMol(maxN){const n=3+Math.floor(Math.random()*(maxN-2)),o=Array(n-1).fill(1),s=Array.from({length:n},()=>[]),t=rnd(['ane','ene','yne','ol','one','al','acid','Cl','Br','CH3','ene+CH3','ol+Br']),
  bi=Math.floor(Math.random()*(n-1)),ci=Math.floor(Math.random()*n),ii=1+Math.floor(Math.random()*(n-2));
 if(t=='ene'||t=='ene+CH3')o[bi]=2;if(t=='yne')o[bi]=3;if(t=='ol'||t=='ol+Br')s[ci].push('OH');if(t=='one')s[ii].push('=O');if(t=='al')s[0].push('=O');if(t=='acid')s[0].push('=O','OH');
 if(t=='Cl'||t=='Br')s[ci].push(t);if(t=='CH3'||t=='ene+CH3')s[ii].push('CH3');if(t=='ol+Br')s[(ci+1+Math.floor(Math.random()*(n-1)))%n].push('Br');
 return validAll(n,o,s)?mk('',n,o,s):rnd(LIBFLAT)}
const FAMTXT={'alkane':'it has only C–C single bonds and C–H bonds (saturated)','alkene':'it has a C=C double bond','alkyne':'it has a C≡C triple bond','alcohol':'it has an –OH group on a carbon','aldehyde':'it has a C=O on the end carbon with one H (–CHO)','ketone':'it has a C=O inside the chain','carboxylic acid':'it has –COOH: a C=O and an –OH on the same end carbon','ester':'it has –COO– with a carbon chain on the oxygen','haloalkane':'it has a halogen atom (Cl or Br) in place of a hydrogen'};
const PB=[{r:'Ethene',rx:'br2',l:'bromine water (Br₂)',d:['bromoethane','ethane']},{r:'Propene',rx:'hbr',l:'HBr',d:['1-bromopropane','propane']},{r:'Propan-2-ol',rx:'elO',l:'conc. H₂SO₄ and heat',d:['propane','propanone']},
 {r:'Ethane',rx:'cl2',l:'Cl₂ in light',d:['ethene','1,2-dichloroethane']},{r:'But-1-ene',rx:'h2',l:'H₂ and a catalyst',d:['but-2-ene','ethane']},{r:'Propene',rx:'h2o',l:'H₂O (acid catalyst)',d:['propan-1-ol','propane']},{r:'2-bromopropane',rx:'elB',l:'KOH in ethanol and heat',d:['propane','1-bromopropane']}];
const forceOf=n=>{const m=LIBFLAT.find(x=>nmOf(x)==n),h=m&&m.s.some(g=>g.includes('OH')),p=m&&m.s.some(g=>g.includes('=O')||g.includes('Cl')||g.includes('Br')||g.includes('OCH3'));return h?'hydrogen bonding':p?'dipole-dipole':'London forces only'};
function groupFocus(m){const f=[];m.o.forEach((o,i)=>o>1&&f.push('C'+i,'C'+(i+1)));m.s.forEach((g,i)=>g.forEach(c=>{if(c!='CH3')f.push('C'+i,'S'+i+'_'+c)}));return f.length?f:m.s.map((_,i)=>'C'+i)}
function newQ(){busy=1;QUIZ=true;PR.answered=false;PR.fb=null;PR.typed='';PR.chosen=null;PR.hint=0;FOC=null;const t=rnd(['name','name','group','product','bp','iso','build']);let q;
 const pickM=()=>Math.random()<.5?rnd(LIBFLAT):randMol(7);
 if(t=='name'){const m=pickM();q={t,m,ans:nmOf(m),p:'Name this molecule using IUPAC rules. Rotate it and tap atoms to count the bonds.'};setMol(m.n,m.o,m.s)}
 else if(t=='group'){const m=pickM(),c=famOf(m);q={t,m,ans:c,opts:shuf([c,...shuf(Object.keys(FAMTXT).filter(x=>x!=c)).slice(0,3)]),p:'Which family does this molecule belong to?'};setMol(m.n,m.o,m.s)}
 else if(t=='product'){const b=rnd(PB);load(b.r);const x=RX[b.rx].run(),c=analyse(N,x.o,x.s).name;q={t,b,why:x.why,ans:c,opts:shuf([c,...b.d.filter(d=>d!=c)]),p:`What is the main product when ${b.r.toLowerCase()} reacts with ${b.l}?`}}
 else if(t=='bp'){const ks=Object.keys(BPT);let tr;for(let i=0;i<80;i++){tr=shuf(ks).slice(0,3).sort((a,b)=>BPT[b]-BPT[a]);if(BPT[tr[0]]-BPT[tr[1]]>=10&&BPT[tr[1]]-BPT[tr[2]]>=10)break}q={t,tr,ans:tr[0],opts:shuf(tr),p:'Which of these has the highest boiling point?'};load(rnd(tr))}
 else if(t=='iso'){const g={};LIBFLAT.forEach(m=>(g[m.mf]=g[m.mf]||[]).push(m));const [a,b]=shuf(rnd(Object.values(g).filter(x=>x.length>1))).slice(0,2),dis=shuf(LIBFLAT.filter(m=>m.mf!=a.mf)).slice(0,2);
  q={t,a,b,ans:nmOf(b),opts:shuf([nmOf(b),...dis.map(nmOf)]),p:`Which of these is an isomer of the molecule shown (${a.mf})?`};setMol(a.n,a.o,a.s)}
 else{const m=randMol(5);q={t:'build',m,ans:nmOf(m),p:`Build ${nmOf(m)} in the 3D model. Use the left panel: set the number of carbons, change bonds, then add groups to carbons.`};setMol(1,[],[[]])}
 PR.q=q;busy=0}
function answer(v){const q=PR.q;if(PR.answered)return;let ok=false,msg='';FOC=null;
 if(q.t=='name'){const p=parseName(v);if(p.error){PR.fb={ok:false,msg:p.error};rightUI();return}const cn=analyse(p.n2,p.o2||p.o2,p.s2).name;ok=cn==q.ans;
  msg=ok?(tidy(v)==q.ans?'Correct! Well named.':`That is the right molecule, but the IUPAC name is <b>${q.ans}</b>. ${p.norm?'Choose the longest continuous chain.':'Check the numbering: lowest numbers to the main group, then multiple bonds, then branches.'}`):`Not quite. Your name builds <b>${cn}</b> (${mfOf(p.n2,p.o2,p.s2)}), but the molecule shown is <b>${q.ans}</b> (${q.m.mf||mfOf(q.m.n,q.m.o,q.m.s)}). Press "Walk me through it" to see how to name it.`}
 else if(q.t=='build'){const cur=analyse(N,ORD,SUB).name;ok=cur==q.ans;msg=ok?'Correct! That molecule has the right structure.':`You built <b>${cur}</b> (${mfOf(N,ORD,SUB)}). The target is <b>${q.ans}</b> (${mfOf(q.m.n,q.m.o,q.m.s)}). ${mfOf(N,ORD,SUB)==mfOf(q.m.n,q.m.o,q.m.s)?'Same atoms, arranged differently: they are isomers.':'Compare the number of carbons and the groups.'} Press "Walk me through it" to see it built step by step.`}
 else{PR.chosen=v;ok=v==q.ans;
  if(q.t=='group'){msg=`${ok?'Correct! ':'Not quite. '}This is <b>${/^[aeiou]/.test(q.ans)?'an':'a'} ${q.ans}</b>: ${FAMTXT[q.ans]}. Look at the spotlight.`;FOC=groupFocus(q.m)}
  else if(q.t=='product'){msg=`${ok?'Correct! ':'Not quite. '}The product is <b>${q.ans}</b>. ${q.why}`;setTimeout(()=>doRx(q.b.rx),500)}
  else if(q.t=='bp'){msg=`${ok?'Correct! ':'Not quite. '}${q.tr.map(n=>`${n} ${fmtT(BPT[n])} (${forceOf(n)})`).join(' · ')}. Stronger forces between molecules mean a higher boiling point: hydrogen bonding is the strongest, then dipole-dipole, then London forces. With the same kind of force, bigger and less branched molecules boil higher.`;load(q.ans)}
  else{const A1=analyse(q.a.n,q.a.o,q.a.s),A2=analyse(q.b.n,q.b.o,q.b.s),ty=group(A1,q.a.s)!=group(A2,q.b.s)?'functional isomers: the same atoms form different functional groups':q.a.n!=q.b.n?'chain isomers: the carbon chain is arranged differently':'position isomers: the same group sits on a different carbon';
   msg=`${ok?'Correct! ':'Not quite. '}<b>${q.ans}</b> has the same formula (${q.a.mf}) but a different structure. These are ${ty}. Watch the atoms rearrange.`;setMol(q.b.n,q.b.o,q.b.s)}}
 PR.answered=true;PR.n++;if(ok)PR.ok++;const st=PR.st[q.t]=PR.st[q.t]||{ok:0,n:0};st.n++;if(ok)st.ok++;PR.fb={ok,msg};setQuiz(false);rightUI()}
const TYPE_MOD={name:2,build:2,group:3,product:6,bp:5,iso:4},TYPE_LBL={name:'naming',build:'building',group:'functional groups',product:'reaction products',bp:'boiling points',iso:'isomers'};
function weakType(){let w=null,r=.7;for(const t in PR.st){const s=PR.st[t];if(s.n>=2&&s.ok/s.n<r){r=s.ok/s.n;w=t}}return w}
function hintText(q){const L=PR.hint,ms=meaning(q.ans),chips=ms.map(m=>`<span class="mc ${m[0]}">${m[1]}</span>`).join(' ');if(!L)return'';
 if(q.t=='group')return'Look for a double or triple bond, an –OH group, a C=O, or a halogen atom.';
 if(q.t=='name')return['Find the <b>longest chain</b> of carbons. Its length gives the stem (meth, eth, prop, but, pent, hex, hept, oct). The numbers mark each carbon.','Now look for double or triple bonds and for groups such as –OH or C=O: they give the ending. The spotlight shows them.','The parts of the name are: '+chips][L-1];
 return['The stem tells you how many carbons to build: '+(ms[0]?ms[0][1]:'')+'.','Next, the bonds and groups from the ending: '+ms.slice(1).map(m=>m[1]).join(', ')+'.','Tap a carbon, then add a group from the left panel. Tap a bond to change it.'][L-1]}
function applyHint(q){if(q.t=='name'){if(PR.hint==1){FOC=[...Array(q.m.n).keys()].map(i=>'C'+i);setOpt('num',1)}else if(PR.hint==2)FOC=groupFocus(q.m);else FOC=null}}
function pracUI(){if(!PR.q)newQ();const q=PR.q,ws=weakType(),canHint=!PR.answered&&(q.t=='name'||q.t=='build'||q.t=='group')&&PR.hint<(q.t=='group'?1:3);setQuiz(!PR.answered);
 $('#tb').innerHTML=`<div class="score">Score ${PR.ok} / ${PR.n}</div><h2 style="font-size:17px;margin-bottom:10px">${q.p}</h2>
 ${q.t=='name'?`<div class="inp"><input id="ans" value="${PR.typed.replace(/"/g,'')}" placeholder="type the IUPAC name" autocomplete="off" spellcheck="false" ${PR.answered?'disabled':''}><button class="btn" id="chk" ${PR.answered?'disabled':''}>Check</button></div>`
  :q.t=='build'?`<button class="btn" id="chk" ${PR.answered?'disabled':''}>Check my molecule</button>`
  :`<div class="q">${q.opts.map(o=>`<button class="c ${PR.answered?(o==q.ans?'right-a':o==PR.chosen?'wrong-a':''):''}" data-o="${o}" ${PR.answered?'disabled':''}>${o}</button>`).join('')}</div>`}
 ${PR.hint&&!PR.answered?`<div class="fb" style="margin-top:10px"><b>Hint ${PR.hint}.</b> ${hintText(q)}</div>`:''}
 ${PR.fb?`<div class="fb ${PR.fb.ok?'ok':'no'}" style="margin-top:10px">${PR.fb.msg}</div>`:''}
 ${PR.answered&&!PR.fb.ok?`<div style="margin-top:8px"><button class="btn g" id="rv">Review: ${MODS[TYPE_MOD[q.t]].n}</button></div>`:''}
 ${PR.answered&&ws?`<p class="sub" style="margin-top:8px">You find <b>${TYPE_LBL[ws]}</b> questions harder. Try the lesson "${MODS[TYPE_MOD[ws]].n}".</p>`:''}
 <div class="nav" style="margin-top:10px">${PR.answered&&(q.t=='name'||q.t=='build')?'<button class="btn g" id="ex">Walk me through it</button>':canHint?'<button class="btn g" id="ht">Hint</button>':'<span></span>'}<button class="btn" id="nq">${PR.answered?'Next question':'Skip'}</button></div>`;
 const inp=$('#ans');if(inp){inp.oninput=e=>PR.typed=e.target.value;inp.onkeydown=e=>{if(e.key=='Enter')answer(inp.value)}}
 const ck=$('#chk');if(ck)ck.onclick=()=>answer(inp?inp.value:'');
 document.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>answer(b.dataset.o));
 const ex=$('#ex');if(ex)ex.onclick=()=>{TAB='names';setQuiz(false);setUX('explore');runSolve(q.ans)};
 const ht=$('#ht');if(ht)ht.onclick=()=>{PR.hint++;applyHint(q);rightUI()};
 const rv=$('#rv');if(rv)rv.onclick=()=>startLesson(TYPE_MOD[q.t]);
 $('#nq').onclick=()=>{newQ();rightUI();applyUI()}}

function focusList(){if(FOC)return FOC;if(SEL&&OPT.spot&&A[SEL])return[SEL,...nbrs(SEL)];return null}

/* ---------- lesson order + metadata ---------- */
const MODS=[0,6,5,1,2,4,3].map((o,i)=>{const m=MODS0[o];m.key=o;m.n=(i+1)+' · '+m.n.replace(/^\d+ · /,'');return m});
const MODMETA={0:{d:'See why carbon always makes four bonds, and how that decides the shape.',tab:'learn',recap:['Carbon has 4 valence electrons, so it forms 4 bonds.','Each bond is a shared pair of electrons.','More bonds between two carbons give a flatter or straighter shape: 109.5°, 120°, 180°.']},
 6:{d:'Read a molecule four ways: molecular, condensed, semi-structural and structural.',tab:'learn',recap:['The molecular formula only counts atoms.','Condensed and semi-structural formulas group the hydrogens on each carbon.','The structural formula shows every bond: each carbon has 4 lines.']},
 5:{d:'Decode a name: the stem counts carbons, the ending tells you the bonds or group.',tab:'names',recap:['meth, eth, prop, but, pent, hex, hept, oct mean 1 to 8 carbons.','-ane is single bonds, -ene a double bond, -yne a triple bond.','-ol, -al, -one and -oic acid name the functional group.']},
 1:{d:'Meet the groups that decide how a family of compounds behaves.',tab:'names',recap:['A functional group is the atom or group of atoms that decides how a family behaves.','–OH is an alcohol, C=O inside the chain a ketone, C=O at the end an aldehyde, –COOH a carboxylic acid.','A halogen in place of a hydrogen makes a haloalkane.']},
 2:{d:'Same formula, different structure: chain, position and functional isomers.',tab:'learn',recap:['Isomers share a molecular formula but have different structural formulas.','Chain isomers change the carbon chain, position isomers move a group or bond, functional isomers change the group.']},
 4:{d:'Link structure to boiling point through the forces between molecules.',tab:'prop',recap:['Longer chains have stronger London forces and boil higher.','Branching lowers the boiling point.','Hydrogen bonding (–OH, –COOH) raises it the most.']},
 3:{d:'Watch addition, substitution, elimination and more, atom by atom.',tab:'react',recap:['Addition opens a multiple bond. Substitution swaps an atom or group. Elimination removes a small molecule and forms a multiple bond.','Bromine water test: unsaturated compounds decolourise it, saturated ones do not.','Atoms are rearranged, never lost: every equation balances.']}};
const UIMAP={'0.0':{rep:0},'0.1':{rep:0,tools:['elec','shape','spot']},'0.2':{rep:0,tools:['spot','num']},'0.3':{rep:0,tools:['shape']},'0.4':{rep:0,tools:['shape'],left:true},'0.5':{rep:0,tools:['shape']},
 '6.0':{rep:3},'6.1':{rep:2},'6.2':{rep:1},'6.3':{rep:0,tools:['spot']},'6.4':{rep:0},'6.5':{rep:0},
 '5.*':{rep:0,mean:true,tools:['num']},'1.*':{mean:true,rep:0,tools:['spot']},'1.2':{mean:true,rep:0},'1.4':{mean:true,left:true,rep:0},
 '2.*':{facts:true,rep:0},'4.*':{facts:true,rep:0,tools:['style']},'3.*':{rep:0,tools:['spot']}};
const ALLT=['style','lab','elec','spot','num','shape','reset','save'],BASEUX={dock:false,left:false,facts:false,mean:false,tools:['reset']};
let MODEUX='guided',PRACMODE=false,FIN=false,UXS=BASEUX,STARTED=false;
function curUX(){if(MODEUX=='explore')return{dock:true,left:true,facts:false,mean:true,tools:ALLT};
 if(PRACMODE){const q=PR.q;return{dock:true,left:!!(q&&q.t=='build'&&!PR.answered),facts:false,mean:false,tools:['reset','spot','num','lab'],rep:0}}
 const m=MODS[mod],u=UIMAP[m.key+'.'+tourStep]||UIMAP[m.key+'.*']||{};return{...BASEUX,...u,tools:[...BASEUX.tools,...(u.tools||[])],dock:u.rep!==undefined}}
function applyUI(){UXS=curUX();const u=UXS;document.body.classList.toggle('guided',MODEUX=='guided');document.body.classList.toggle('facts-on',!!(u.facts&&u.dock));
 $('#dock').hidden=!u.dock;$('#left').hidden=!u.left;$('#facts').hidden=!u.facts;document.querySelectorAll('#tools [data-k]').forEach(e=>e.hidden=!u.tools.includes(e.dataset.k));
 if(u.rep!==undefined&&u.rep!==REP){REP=u.rep;dockUI()}progUI();titleUI();layout()}
function progUI(){const p=$('#prog');if(MODEUX=='explore'){p.innerHTML='<span>Free exploration · every tool is open</span>';return}if(PRACMODE){p.innerHTML='<span>Practice</span>';return}
 const m=MODS[mod],n=m.steps.length;p.innerHTML=`<span>Lesson ${mod+1} of ${MODS.length} · ${m.n.replace(/^\d+ · /,'')}</span><div class="bar"><i style="width:${FIN?100:(tourStep+1)/n*100}%"></i></div>`}
function setUX(m){MODEUX=m;PRACMODE=false;STARTED=true;$('#map').hidden=true;document.querySelectorAll('#mx button').forEach(b=>b.classList.toggle('on',b.dataset.ux==m));if(m=='explore')setQuiz(false);rightUI();applyUI()}
const nextAfter=i=>{for(let k=1;k<=MODS.length;k++){const j=(i+k)%MODS.length;if(!DONE.has(MODS[j].key))return j}return-1};
function startLesson(i){$('#map').hidden=true;STARTED=true;MODEUX='guided';PRACMODE=false;FIN=false;HIST=[];document.querySelectorAll('#mx button').forEach(b=>b.classList.toggle('on',b.dataset.ux=='guided'));mod=i;goTour(0)}
function startPractice(){$('#map').hidden=true;STARTED=true;MODEUX='guided';PRACMODE=true;document.querySelectorAll('#mx button').forEach(b=>b.classList.toggle('on',b.dataset.ux=='guided'));if(!PR.q)newQ();rightUI();applyUI()}
function showMap(){const m=$('#map'),nx=DONE.size?nextAfter(-1):0;m.hidden=false;
 m.innerHTML=`<div class="mapcard"><h1>Your learning path</h1><p class="sub">Organic molecules, Grade 12 Physical Sciences. Each lesson is short: look, predict, try, then explain.</p>
 <ol class="path">${MODS.map((x,i)=>`<li class="${DONE.has(x.key)?'done':''} ${i==nx?'next':''}"><span class="num">${DONE.has(x.key)?'✓':i+1}</span><div><b>${x.n.replace(/^\d+ · /,'')}</b><small>${MODMETA[x.key].d}</small></div><button class="btn ${i==nx?'':'g'}" data-l="${i}">${DONE.has(x.key)?'Review':i==nx?(DONE.size?'Continue':'Start'):'Open'}</button></li>`).join('')}
 <li><span class="num">★</span><div><b>Practice</b><small>Name molecules, build them, predict products and rank boiling points, with hints.</small></div><button class="btn g" id="mp">Start</button></li></ol>
 <div class="mapfoot"><button class="hint2" id="mex">Skip the path and explore freely</button>${STARTED?' · <button class="hint2" id="mcl">Close</button>':''}</div></div>`;
 m.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>startLesson(+b.dataset.l));$('#mp').onclick=startPractice;$('#mex').onclick=()=>setUX('explore');const c=$('#mcl');if(c)c.onclick=()=>m.hidden=true}
const NEEDTXT={tap:'Tap an atom in the 3D model.',bond:'{buildhow}, then tap a bond to change it.',group:'Tap a carbon, then add a group. ({buildhow}.)',act:'Press the button and watch the model.'};
function lastHTML(){if(!LAST)return'';const[hb,ha]=LAST.before?diffHl(LAST.before,LAST.after):[0,0];
 return`<div class="fb ok"><span class="badge">${LAST.type}</span><br><b>${LAST.eq}</b><br>${LAST.why}</div>${LAST.before?`<div class="ba"><div>${struct2D(...LAST.before,{hl:hb,small:1})}</div><span>→</span><div>${struct2D(...LAST.after,{hl:ha,small:1})}</div></div>`:''}${LAST.tally||''}${LAST.vial?`<div class="vial ${LAST.vial}"><i></i><span>Bromine water: ${LAST.vial=='clear'?'orange to colourless':'stays orange'}</span></div>`:''}`}
function finishLesson(){DONE.add(MODS[mod].key);saveDone();FIN=true;rightUI();progUI()}
function finUI(){const m=MODS[mod],meta=MODMETA[m.key],nx=nextAfter(mod),nm=nx>=0?MODS[nx].n.replace(/^\d+ · /,''):'';
 $('#tb').innerHTML=`<div class="recap"><span class="badge">Lesson complete</span><h2>${m.n.replace(/^\d+ · /,'')}</h2><p class="sub">What you learned</p><ul>${meta.recap.map(x=>`<li>${x}</li>`).join('')}</ul>
 <div class="nav stack" style="margin-top:12px"><button class="btn" id="nl">${nx>=0?'Next lesson: '+nm:'Start practice'}</button><button class="btn g" id="ty">Try it yourself</button><button class="hint2" id="bm">Back to the map</button></div></div>`;
 $('#nl').onclick=()=>nx>=0?startLesson(nx):startPractice();$('#ty').onclick=()=>{TAB=meta.tab;FIN=false;setUX('explore')};$('#bm').onclick=showMap}
let SHOWN='',SHOWNMOL='';
const fx=t=>t.replace(/\{buildhow\}/g,MODEUX=='explore'?'Open “Change” › “Build your own”':'Use the Build panel on the left');
function learnUI(){if(FIN)return finUI();const g=MODEUX=='guided',m=MODS[mod],S=m.steps,s=S[tourStep],key=mod+'.'+tourStep,a=answered[key],done=s.q?a!=null:(s.need?tourTouched:true),last=tourStep==S.length-1,
  todo=s.q?'':s.need?NEEDTXT[s.need]:s.act?NEEDTXT.act:'';
 $('#tb').innerHTML=`${g?`<div class="lh"><span>Lesson ${mod+1} of ${MODS.length}</span><b>${m.n.replace(/^\d+ · /,'')}</b></div>`:`<div class="lsw"><small>Lesson ${mod+1} of ${MODS.length}</small><select id="ms" aria-label="Choose a lesson">${MODS.map((x,i)=>`<option value="${i}" ${i==mod?'selected':''}>${DONE.has(x.key)?'✓ ':''}${x.n}</option>`).join('')}</select></div>`}
 <div class="dots">${S.map((_,i)=>`<i class="${i<tourStep?'d':i==tourStep?'cur':''}"></i>`).join('')}</div><div class="kick"><span class="kt ${s.q?'predict':(s.need||s.act)?'try':'learn'}">${s.q?'Predict':(s.need||s.act)?'Try it':'Learn'}</span><span>Step ${tourStep+1} of ${S.length}</span></div><h2>${s.t}</h2>${(!g&&(SHOWN!==key||(!s.act&&!s.need&&!s.q&&desc().name!==SHOWNMOL)))?'<button class="btn show" id="sh">Show this on the model</button>':''}
 ${s.c?`<p>${s.c}</p>`:`<p>${s.q}</p><div class="q">${s.o.map((o,i)=>`<button class="c ${a!=null?(i==s.a?'right-a':i==a?'wrong-a':''):''}" data-a="${i}" ${a!=null?'disabled':''}>${o}</button>`).join('')}</div>${a!=null?`<div class="fb ${a==s.a?'ok':'no'}">${a==s.a?s.ok:s.no}</div>`:''}`}
 ${todo&&!done?`<div class="do"><span>Your turn</span>${todo}</div>`:''}${s.act?`<button class="btn g" id="act" style="margin-bottom:10px">${s.act[0]}</button>`:''}${s.act?lastHTML():''}
 <div class="nav"><button class="btn g" id="pv" ${tourStep==0?'disabled':''}>Back</button><button class="btn" id="nt" ${done?'':'disabled'}>${last?'Finish lesson':'Next'}</button></div>${done?'':'<div style="text-align:center;margin-top:6px"><button class="hint2" id="sk">Skip this step</button></div>'}`;
 $('#tb').innerHTML=fx($('#tb').innerHTML);
 const sh=$('#sh');if(sh)sh.onclick=()=>goTour(tourStep);
 const ms=$('#ms');if(ms)ms.onchange=e=>{mod=+e.target.value;HIST=[];FIN=false;goTour(0)};
 document.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{answered[key]=+b.dataset.a;s.reveal();rightUI()});
 const ac=$('#act');if(ac)ac.onclick=()=>{s.act[1]();evt('act')};
 const next=()=>last?finishLesson():goTour(tourStep+1);$('#pv').onclick=()=>goTour(tourStep-1);$('#nt').onclick=next;const sk=$('#sk');if(sk)sk.onclick=next}
function goTour(i){tourStep=clamp(i,0,MODS[mod].steps.length-1);SHOWN=mod+'.'+tourStep;tourTouched=0;FIN=false;LAST=null;TAB='learn';setQuiz(false);clearInterval(CNT);MODS[mod].steps[tourStep].go();try{SHOWNMOL=desc().name}catch(e){}rightUI();applyUI()}
function rightUI(){if(busy)return;const g=MODEUX=='guided',view=g?(PRACMODE?'prac':'learn'):TAB;
 $('#tour').innerHTML=(g?(PRACMODE?'<div class="lh"><b>Practice</b><button class="hint2" id="xp">Back to the lessons</button></div>':''):`<div class="tabs">${[['learn','Learn'],['names','Names'],['react','React'],['prop','Forces'],['prac','Practice']].map(([k,l])=>`<button data-tab="${k}" class="${TAB==k?'on':''}">${l}</button>`).join('')}</div>`)+'<div id="tb"></div>';
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{TAB=b.dataset.tab;if(TAB!='prac')setQuiz(false);if(TAB!='names'){FOC=null;clearInterval(CNT)}rightUI()});
 const xp=$('#xp');if(xp)xp.onclick=()=>{PRACMODE=false;setQuiz(false);showMap();applyUI()};({learn:learnUI,names:namesUI,react:reactUI,prop:propUI,prac:pracUI})[view]()}

/* ---------- global controls ---------- */
$('#tools').onclick=e=>{const b=e.target.closest('button');if(!b)return;const m=b.dataset.m,t=b.dataset.t;
 if(m){MODE=m;document.querySelectorAll('#tools [data-m]').forEach(x=>x.classList.toggle('on',x==b));return}if(!t)return;
 if(t=='reset'){yaw=.7;pit=.28;zoom=1;vy=vp=0;return}
 if(t=='save'){const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');x.fillStyle='#eaf1f8';x.fillRect(0,0,c.width,c.height);x.drawImage(cv,0,0);c.toBlob(bl=>{const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='carbon-lab-'+(QUIZ?'molecule':desc().name.replace(/[^a-z0-9-]+/gi,'-'))+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)});return}
 OPT[t]=!OPT[t];b.classList.toggle('on',!!OPT[t])};
$('#mx').onclick=e=>{const u=e.target.dataset.ux;if(u)setUX(u)};$('#home').onclick=showMap;
addEventListener('keydown',e=>{if(e.key!='Escape')return;if(!$('#pick').hidden){closePick();return}if(STARTED)$('#map').hidden=true});

/* ---------- boot ---------- */
resize();setMol(1,[],[[]],{instant:true});goTour(0);showMap();requestAnimationFrame(frame);