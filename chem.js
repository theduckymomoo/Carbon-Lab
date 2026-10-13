/* chem.js — molecular geometry, IUPAC naming, library, name parser and reaction rules.
   Pure logic and data. Loaded first; provides functions used by model3d.js and lessons.js. */
const $=s=>document.querySelector(s),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),D2R=Math.PI/180;
const V={add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len:a=>Math.hypot(a[0],a[1],a[2]),unit:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]}};
const sb=n=>String(n).split('').map(d=>'₀₁₂₃₄₅₆₇₈₉'[d]).join('');
const cap=s=>s[0].toUpperCase()+s.slice(1),EN={C:'carbon',H:'hydrogen',O:'oxygen',Cl:'chlorine',Br:'bromine'};
const PRE=['meth','eth','prop','but','pent','hex','hept','oct'],ORDN=['','single','double','triple'];

/* ---------- molecular geometry (real bond lengths and angles) ---------- */
const BL={1:1.54,2:1.34,3:1.20},CH=1.09,TH={4:109.5,3:120,2:180};
const SV={OH:1,'=O':2,Cl:1,Br:1,CH3:1,OCH3:1},LEN={OH:1.43,'=O':1.21,Cl:1.77,Br:1.94,CH3:1.54,OCH3:1.43};
const TET=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(V.unit);
const perp=u=>V.unit(V.cross(u,Math.abs(u[2])<.9?[0,0,1]:[0,1,0]));
function tetraH(u){const p1=perp(u),p2=V.cross(u,p1);return[0,120,240].map(f=>{const r=f*D2R;return V.add(V.mul(u,-.3338),V.mul(V.add(V.mul(p1,Math.cos(r)),V.mul(p2,Math.sin(r))),.9426))})}
const csum=(i,n,o)=>(i>0?o[i-1]:0)+(i<n-1?o[i]:0);
const ndOf=(i,n,o,s)=>4-(i>0?o[i-1]-1:0)-(i<n-1?o[i]-1:0)-s[i].filter(c=>c=='=O').length;
const hOf=(i,n,o,s)=>4-csum(i,n,o)-s[i].reduce((a,c)=>a+SV[c],0);
function dirs(i,n,P,nd){
 const up=i>0?V.unit(V.sub(P[i-1],P[i])):null,un=i<n-1?V.unit(V.sub(P[i+1],P[i])):null,c=(up?1:0)+(un?1:0),f=nd-c,nz=[0,0,1];if(f<=0)return[];
 if(!c)return nd==4?TET:nd==3?[0,120,240].map(a=>[Math.cos(a*D2R),Math.sin(a*D2R),0]):[[1,0,0],[-1,0,0]];
 if(c==2){const b=V.unit(V.mul(V.add(up,un),-1));if(f==1)return[b];const cs=Math.cos(54.75*D2R),k=Math.sin(54.75*D2R);return[V.add(V.mul(b,cs),V.mul(nz,k)),V.add(V.mul(b,cs),V.mul(nz,-k))]}
 const u=up||un,p1=[-u[1],u[0],0];
 if(nd==2)return[V.mul(u,-1)];
 if(nd==3)return[V.add(V.mul(u,-.5),V.mul(p1,.866)),V.add(V.mul(u,-.5),V.mul(p1,-.866))];
 return[0,120,240].map(f=>{const r=f*D2R;return V.add(V.mul(u,-.3338),V.mul(V.add(V.mul(p1,Math.cos(r)),V.mul(nz,Math.sin(r))),.9426))})}
function build(n,ord,sub){
 const P=[[0,0,0]];let a=0;
 for(let i=0;i<n-1;i++){if(i>0)a+=(i%2?1:-1)*(180-TH[ndOf(i,n,ord,sub)])*D2R;P.push(V.add(P[i],[BL[ord[i]]*Math.cos(a),BL[ord[i]]*Math.sin(a),0]))}
 const at=[],bo=[],add=(id,el,p,par,on=1)=>at.push({id,el,p,par,on});
 for(let i=0;i<n;i++)add('C'+i,'C',P[i],i?'C'+(i-1):'C0');
 for(let i=0;i<n;i++){const g=sub[i],D=dirs(i,n,P,ndOf(i,n,ord,sub)),f=D.length,h=Math.max(0,f-g.length),c='C'+i;
  for(let k=0;k<4;k++){const on=k<h;add('H'+i+'_'+k,'H',on?V.add(P[i],V.mul(D[k],CH)):P[i],c,on?1:0);if(on)bo.push([c,'H'+i+'_'+k,1])}
  g.forEach((code,j)=>{const d=D[f-1-j];if(!d)return;const oc=g.slice(0,j).filter(c=>c==code).length,q=V.add(P[i],V.mul(d,LEN[code])),id='S'+i+'_'+code+(oc?oc:''),u=V.mul(d,-1);bo.push([c,id,SV[code]]);
   if(code=='OH'){add(id,'O',q,c);const hd=V.add(V.mul(u,-.3256),V.mul(perp(u),.9455));add(id+'h','H',V.add(q,V.mul(hd,.96)),id);bo.push([id,id+'h',1])}
   else if(code=='=O')add(id,'O',q,c);
   else if(code=='Cl'||code=='Br')add(id,code,q,c);
   else if(code=='CH3'){add(id,'C',q,c);tetraH(u).forEach((t,k)=>{add(id+'h'+k,'H',V.add(q,V.mul(t,CH)),id);bo.push([id,id+'h'+k,1])})}
   else{add(id,'O',q,c);const d2=V.add(V.mul(u,-.3746),V.mul(perp(u),.9272)),q2=V.add(q,V.mul(d2,1.43)),u2=V.unit(V.sub(q,q2));add(id+'c','C',q2,id);bo.push([id,id+'c',1]);
    tetraH(u2).forEach((t,k)=>{add(id+'ch'+k,'H',V.add(q2,V.mul(t,CH)),id+'c');bo.push([id+'c',id+'ch'+k,1])})}})}
 for(let i=0;i<n-1;i++)bo.push(['C'+i,'C'+(i+1),ord[i]]);
 return{at,bo}}

/* ---------- naming, formulas (IUPAC, CAPS scope) ---------- */
const MULT=['','','di','tri','tetra'],BASE={acid:'oic acid',ester:'oate',ald:'al',ket:'one',ol:'ol'},RANK=['acid','ester','ald','ket','ol'];
function analyse(n,ord,sub){
 const F=[];for(let i=0;i<n;i++){const g=sub[i],term=i==0||i==n-1;
  if(g.includes('=O'))F.push({t:term?(g.includes('OH')?'acid':g.includes('OCH3')?'ester':'ald'):'ket',i});
  else{if(g.includes('OH'))F.push({t:'ol',i});if(g.includes('OCH3'))F.push({t:'pre',i,w:'methoxy'})}
  [['Cl','chloro'],['Br','bromo'],['CH3','methyl']].forEach(([c,w])=>g.filter(x=>x==c).forEach(()=>F.push({t:'pre',i,w})))} 
 const P=RANK.find(r=>F.some(f=>f.t==r)),dbl=[],tri=[];ord.forEach((o,i)=>o==2?dbl.push(i):o==3&&tri.push(i));
 const pre=F.map(f=>f.t=='pre'?f:f.t==P?null:{t:'pre',i:f.i,w:f.t=='ol'?'hydroxy':'oxo'}).filter(Boolean);
 const cmp=(a,b)=>{for(let k=0;k<Math.max(a.length,b.length);k++)if(a[k]!==b[k])return(a[k]||0)-(b[k]||0);return 0},asc=(a,b)=>a-b;
 const cand=[0,1].map(rev=>{const Ln=i=>rev?n-i:i+1,Bn=i=>rev?n-1-i:i+1;return{rev,Ln,Bn,p:F.filter(f=>f.t==P).map(f=>Ln(f.i)).sort(asc),m:[...dbl,...tri].map(Bn).sort(asc),x:pre.map(f=>Ln(f.i)).sort(asc)}});
 cand.sort((a,b)=>cmp(a.p,b.p)||cmp(a.m,b.m)||cmp(a.x,b.x));const c=cand[0],stem=PRE[n-1],d=dbl.length,t=tri.length,ml=(arr)=>arr.map(c.Bn).sort(asc);
 const res=name=>({name,p:P,dbl:d,tri:t,rev:c.rev});
 let un;if(!d&&!t)un='an';else if(d==1&&!t)un=(n>=4?'-'+ml(dbl)[0]+'-':'')+'en';else if(t==1&&!d)un=(n>=4?'-'+ml(tri)[0]+'-':'')+'yn';else if(d==2&&!t)un='a-'+ml(dbl).join(',')+'-dien';else return res('(more than one multiple bond)');
 const core=stem+un,grp={};pre.forEach(f=>(grp[f.w]=grp[f.w]||[]).push(c.Ln(f.i)));
 const inc=n>=3||(n==2&&(pre.length>1||!!P)),ps=Object.keys(grp).sort().map(w=>{const l=grp[w].sort(asc);return(inc?l.join(',')+'-':'')+MULT[l.length]+w}).join('-');
 let name;if(!P)name=ps+core+'e';else{const l=c.p,mult=l.length>1,need=(P=='ol'||P=='ket')&&(mult||(P=='ol'?n>=3:n>=4)),seg=need?'-'+l.join(',')+'-':'';
  name=ps+(mult?core+'e'+seg+MULT[l.length]+BASE[P]:core+seg+BASE[P]);if(P=='ester')name='methyl '+name}
 return res(name)}
function group(a,sub){const m={acid:'carboxylic acid',ester:'ester',ald:'aldehyde',ket:'ketone',ol:'alcohol'};if(a.p)return m[a.p];if(sub.some(g=>g.includes('Cl')||g.includes('Br')))return'haloalkane';return a.tri?'alkyne · unsaturated':a.dbl?'alkene · unsaturated':'alkane · saturated'}
function mfOf(n,o,s){const c={};build(n,o,s).at.forEach(a=>{if(a.on)c[a.el]=(c[a.el]||0)+1});return['C','H','Br','Cl','O'].filter(e=>c[e]).map(e=>e+(c[e]>1?sb(c[e]):'')).join('')}
function cond(n,ord,sub){const gt={OH:'OH','=O':'O',Cl:'Cl',Br:'Br',CH3:'CH3',OCH3:'OCH3'};let s='';
 for(let i=0;i<n;i++){const g=sub[i],h=hOf(i,n,ord,sub);let t='C'+(h?'H'+(h>1?h:''):'');
  if(g.includes('=O'))t+='O'+g.filter(c=>c!='=O').map(c=>gt[c]).join('');else g.forEach(c=>t+=(i==n-1&&g.length==1)?gt[c]:'('+gt[c]+')');s+=t}
 return s.replace(/\d+/g,sb)}
const desc=()=>{const a=analyse(N,ORD,SUB);return{name:a.name,rev:a.rev,group:group(a,SUB),mf:mfOf(N,ORD,SUB),cond:cond(N,ORD,SUB)}};

/* ---------- library of molecules ---------- */
const mk=(name,n,o,s)=>({name,n,o,s:Array.from({length:n},(_,i)=>(s&&s[i])||[])});
const LIB={'Alkanes':[mk('Methane',1,[]),mk('Ethane',2,[1]),mk('Propane',3,[1,1]),mk('Butane',4,[1,1,1]),mk('2-methylpropane',3,[1,1],{1:['CH3']}),mk('Pentane',5,[1,1,1,1]),mk('Hexane',6,[1,1,1,1,1]),mk('2-methylbutane',4,[1,1,1],{1:['CH3']})],
 'Alkenes and alkynes':[mk('Ethene',2,[2]),mk('Propene',3,[2,1]),mk('But-1-ene',4,[2,1,1]),mk('Pent-1-ene',5,[2,1,1,1]),mk('Pent-2-ene',5,[1,2,1,1]),mk('But-2-ene',4,[1,2,1]),mk('Ethyne',2,[3]),mk('But-1-yne',4,[3,1,1])],
 'Alcohols':[mk('Methanol',1,[],{0:['OH']}),mk('Ethanol',2,[1],{0:['OH']}),mk('Propan-1-ol',3,[1,1],{0:['OH']}),mk('Propan-2-ol',3,[1,1],{1:['OH']}),mk('Butan-1-ol',4,[1,1,1],{0:['OH']}),mk('Pentan-2-ol',5,[1,1,1,1],{1:['OH']})],
 'Aldehydes and ketones':[mk('Methanal',1,[],{0:['=O']}),mk('Ethanal',2,[1],{0:['=O']}),mk('Propanal',3,[1,1],{0:['=O']}),mk('Propanone',3,[1,1],{1:['=O']}),mk('Butan-2-one',4,[1,1,1],{1:['=O']})],
 'Acids and esters':[mk('Methanoic acid',1,[],{0:['=O','OH']}),mk('Ethanoic acid',2,[1],{0:['=O','OH']}),mk('Propanoic acid',3,[1,1],{0:['=O','OH']}),mk('Butanoic acid',4,[1,1,1],{0:['=O','OH']}),mk('Methyl methanoate',1,[],{0:['=O','OCH3']}),mk('Methyl ethanoate',2,[1],{0:['=O','OCH3']})],
 'Haloalkanes':[mk('Chloromethane',1,[],{0:['Cl']}),mk('Bromoethane',2,[1],{0:['Br']}),mk('1-bromopropane',3,[1,1],{0:['Br']}),mk('2-bromopropane',3,[1,1],{1:['Br']}),mk('2-bromobutane',4,[1,1,1],{1:['Br']}),mk('1,2-dibromoethane',2,[1],{0:['Br'],1:['Br']})]};
const LIBFLAT=Object.values(LIB).flat();LIBFLAT.forEach(m=>m.mf=mfOf(m.n,m.o,m.s));
const load=(name,opt)=>{const m=LIBFLAT.find(x=>x.name.toLowerCase()==name.toLowerCase());setMol(m.n,m.o,m.s,opt)};
const same=m=>m.n==N&&m.o.join()==ORD.join()&&JSON.stringify(m.s)==JSON.stringify(SUB);
const BPT={'methane':-161.5,'hexane':68.7,'pent-1-ene':30,'butanoic acid':163.5,'ethane':-88.6,'propane':-42.1,'butane':-0.5,'pentane':36.1,'2-methylpropane':-11.7,'2-methylbutane':27.8,'ethene':-103.7,'propene':-47.6,'but-1-ene':-6.3,'but-1-yne':8.1,
 'methanol':64.7,'ethanol':78.4,'propan-1-ol':97.2,'propan-2-ol':82.6,'butan-1-ol':117.7,'methanal':-19,'ethanal':20.2,'propanal':48,'propanone':56,'butan-2-one':79.6,
 'methanoic acid':100.8,'ethanoic acid':118,'propanoic acid':141,'methyl methanoate':32,'methyl ethanoate':57,'chloromethane':-24,'bromoethane':38.4,'1-bromopropane':71,'2-bromopropane':59.4,'1,2-dibromoethane':131};
const fmtT=v=>String(v).replace('-','−')+' °C';

/* ---------- reaction rules (logic only; UI is in lessons.js) ---------- */
const hc=i=>hOf(i,N,ORD,SUB),cl=()=>SUB.map(g=>g.slice());
const mb=()=>{const s=selC();if(s>=0){const c=[s-1,s].filter(k=>k>=0&&k<N-1&&ORD[k]>1);if(c.length)return c[0]}return ORD.findIndex(o=>o>1)};
function cands(codes){const r=[];SUB.forEach((g,i)=>{if(g.includes('=O')||!codes.some(c=>g.includes(c)))return;[i-1,i+1].forEach(j=>{if(j>=0&&j<N&&hc(j)>=1&&ORD[Math.min(i,j)]<3)r.push([i,j])})});const s=selC();return r.sort((a,b)=>(a[0]==s?0:1)-(b[0]==s?0:1)||hc(a[1])-hc(b[1]))}
const elim=codes=>cands(codes)[0]||null;
function fg(codes){const s=selC(),L=SUB.map((g,i)=>[g,i]).filter(([g])=>!g.includes('=O')&&codes.some(c=>g.includes(c))).map(x=>x[1]);return L.includes(s)?s:(L.length?L[0]:-1)}
function pickSub(){const s=selC();return s>=0&&hc(s)>=1?s:SUB.findIndex((_,i)=>hc(i)>=1)}
function combEq(){const c={C:0,H:0,O:0};build(N,ORD,SUB).at.forEach(a=>{if(a.on&&c[a.el]!==undefined)c[a.el]++});const a=c.C+c.H/4-c.O/2;let m=1;for(const k of[1,2,4])if(Number.isInteger(a*k)){m=k;break}
 const o2=a*m,co2=c.C*m,h2o=c.H/2*m,cf=x=>x>1?x+' ':'',f=mfOf(N,ORD,SUB);
 return{eq:`${cf(m)}${f} + ${cf(o2)}O₂ → ${cf(co2)}CO₂ + ${cf(h2o)}H₂O`,tally:`<table class="tally"><tr><th></th><th>Left</th><th>Right</th></tr><tr><td>C</td><td>${m*c.C}</td><td>${co2}</td></tr><tr><td>H</td><td>${m*c.H}</td><td>${2*h2o}</td></tr><tr><td>O</td><td>${m*c.O+2*o2}</td><td>${2*co2+h2o}</td></tr></table>`}}
const addX=(l,re,why,ext)=>({t:'Addition',l,ok:()=>mb()>=0,run(){const k=mb(),o=ORD.slice(),s=cl();o[k]--;ext(s,k);return{o,s,re,why}}});
const mk2=(s,k)=>hc(k)<=hc(k+1)?k:k+1,subX=(code,re,by,nm)=>({t:'Substitution',l:re+' in light',ok:()=>pickSub()>=0,run(){const i=pickSub(),s=cl();s[i].push(code);return{o:ORD.slice(),s,re,by,cond:'light',why:`One hydrogen is replaced by a ${nm} atom and leaves as ${by}. The carbon–carbon bonds do not change: that is substitution, not addition.`}}});
const RX={
 br2:{t:'Addition',l:'Br₂ (bromine water test)',ok:()=>true,run(){const k=mb();if(k<0)return{none:1,vial:'stay',why:'There is no C=C or C≡C to open, so the bromine is not used up and the water stays orange. Saturated compounds do not react like this.'};const o=ORD.slice(),s=cl();o[k]--;s[k].push('Br');s[k+1].push('Br');
  return{o,s,re:'Br₂',vial:'clear',why:'One bond of the multiple bond breaks. Each carbon uses the freed bond to bond to a bromine atom, so the orange Br₂ is used up and the mixture turns colourless.'}}},
 h2:addX('H₂ (hydrogenation)','H₂','One bond of the multiple bond breaks and each carbon bonds to a hydrogen. The product is more saturated.',()=>{}),
 hbr:addX('HBr','HBr','Br adds to the carbon that already has fewer hydrogens (the major product) and H adds to the other carbon.',(s,k)=>s[mk2(s,k)].push('Br')),
 h2o:addX('H₂O (hydration)','H₂O','OH adds to the carbon with fewer hydrogens (the major product) and H adds to the other carbon, giving an alcohol.',(s,k)=>s[mk2(s,k)].push('OH')),
 cl2:subX('Cl','Cl₂','HCl','chlorine'),br2s:subX('Br','Br₂','HBr','bromine'),
 hyd:{t:'Substitution',l:'NaOH(aq): haloalkane to alcohol',ok:()=>fg(['Cl','Br'])>=0,run(){const i=fg(['Cl','Br']),h=SUB[i].includes('Br')?'Br':'Cl',s=cl();s[i]=s[i].filter(c=>c!=h);s[i].push('OH');return{o:ORD.slice(),s,re:'NaOH(aq)',by:'Na'+h,cond:'heat',why:`The ${h} is swapped for an –OH group. The carbon skeleton is unchanged, so this is substitution.`}}},
 hx:{t:'Substitution',l:'HBr: alcohol to bromoalkane',ok:()=>fg(['OH'])>=0,run(){const i=fg(['OH']),s=cl();s[i]=s[i].filter(c=>c!='OH');s[i].push('Br');return{o:ORD.slice(),s,re:'HBr',by:'H₂O',cond:'heat',why:'The –OH is swapped for –Br and leaves with an H as water. The skeleton is unchanged: substitution.'}}},
 elO:{t:'Elimination',l:'Dehydration (remove H₂O)',ok:()=>!!elim(['OH']),run(){const[i,j]=elim(['OH']),o=ORD.slice(),s=cl();s[i]=s[i].filter(c=>c!='OH');o[Math.min(i,j)]++;return{o,s,re:'',by:'H₂O',cond:'heat, conc. H₂SO₄',why:'The –OH and one H from the neighbouring carbon leave as water, and the two carbons form a double bond.'}}},
 elB:{t:'Elimination',l:'Dehydrohalogenation (remove HBr)',ok:()=>!!elim(['Br']),run(){const[i,j]=elim(['Br']),o=ORD.slice(),s=cl();s[i]=s[i].filter(c=>c!='Br');o[Math.min(i,j)]++;return{o,s,re:'',by:'HBr',cond:'KOH in ethanol, heat',why:'The Br and one H from the neighbouring carbon leave as HBr, and the two carbons form a double bond.'}}},
 est:{t:'Other',l:'Esterification (acid + methanol)',ok:()=>SUB.some(g=>g.includes('=O')&&g.includes('OH')),run(){const i=SUB.findIndex(g=>g.includes('=O')&&g.includes('OH')),s=cl();s[i]=s[i].map(c=>c=='OH'?'OCH3':c);return{o:ORD.slice(),s,re:'CH₃OH',by:'H₂O',cond:'conc. H₂SO₄, heat',why:'The –OH of the acid and the H of the alcohol leave as water. The acid chain and the alcohol chain join through an oxygen: an ester.'}}},
 comb:{t:'Other',l:'Complete combustion',ok:()=>!SUB.some(g=>g.includes('Cl')||g.includes('Br')),run(){const q=combEq();return{none:1,eq:q.eq,tally:q.tally,why:'Burning in plenty of oxygen turns every carbon into CO₂ and every hydrogen into H₂O. Atoms are only rearranged, so each element must balance: check the table.'}}},
 crk:{t:'Other',l:'Cracking (long chain to shorter)',ok:()=>N>=4&&mb()<0&&SUB.every(g=>!g.length),run(){return{n:N-2,o:Array(N-3).fill(1),s:Array.from({length:N-2},()=>[]),re:'',by:'ethene',cond:'heat, catalyst',why:'A long alkane breaks into a shorter alkane and a small alkene. Two carbons fly off as ethene, the shorter alkane stays.'}}}};
function rxTarget(k){const c=i=>'C'+i;let ids=[];
 if(['br2','h2','hbr','h2o'].includes(k)){const m=mb();if(m>=0)ids=[c(m),c(m+1)]}
 else if(k=='cl2'||k=='br2s'){const i=pickSub();if(i>=0)ids=[c(i)]}
 else if(k=='hyd'){const i=fg(['Cl','Br']);if(i>=0)ids=[c(i),'S'+i+'_Cl','S'+i+'_Br']}
 else if(k=='hx'){const i=fg(['OH']);if(i>=0)ids=[c(i),'S'+i+'_OH']}
 else if(k=='elO'||k=='elB'){const e=elim([k=='elO'?'OH':'Br']);if(e)ids=[c(e[0]),c(e[1]),'S'+e[0]+'_OH','S'+e[0]+'_Br']}
 else if(k=='est'){const i=SUB.findIndex(g=>g.includes('=O')&&g.includes('OH'));if(i>=0)ids=[c(i),'S'+i+'_=O','S'+i+'_OH']}
 else if(k=='comb')ids=SUB.map((_,i)=>c(i));else if(k=='crk')ids=[c(N-2),c(N-1)];
 return ids.length?ids:null}
function diffHl(b,a){const f=(n,o,s,i)=>JSON.stringify([i>0?o[i-1]:0,i<n-1?o[i]:0,s[i]]),hb=new Set(),ha=new Set();if(b[0]==a[0])for(let i=0;i<b[0];i++)if(f(...b,i)!==f(...a,i)){hb.add(i);ha.add(i)}return[hb,ha]}

/* ---------- name decoder: data + helpers ---------- */
const STEMW=['meth','eth','prop','but','pent','hex','hept','oct'];let DEC={stem:3,end:'an',pos:1};
const ENDS=[['an','-ane','single bonds only: every bond between carbons is single (an alkane)'],['en','-ene','a C=C double bond (an alkene)'],['yn','-yne','a C≡C triple bond (an alkyne)'],['ol','-ol','an –OH group (an alcohol)'],['al','-al','a C=O on the end carbon with one H (an aldehyde)'],['one','-one','a C=O inside the chain (a ketone)'],['oic','-oic acid','a –COOH group (a carboxylic acid)']];
const decOk=(e,n)=>e=='an'||e=='ol'||e=='al'||e=='oic'||((e=='en'||e=='yn')&&n>=2)||(e=='one'&&n>=3),posRange=(e,n)=>e=='en'||e=='yn'?[1,n-1]:e=='ol'?[1,n]:e=='one'?[2,n-1]:null;
function decState(){const n=DEC.stem,e=DEC.end,ord=Array(n-1).fill(1),sub=Array.from({length:n},()=>[]),r=posRange(e,n),ps=r?clamp(DEC.pos,r[0],r[1]):1;
 if(e=='en')ord[ps-1]=2;if(e=='yn')ord[ps-1]=3;if(e=='ol')sub[ps-1].push('OH');if(e=='one')sub[ps-1].push('=O');if(e=='al')sub[0].push('=O');if(e=='oic')sub[0].push('=O','OH');return[n,ord,sub,ps]}
function decFocus(part){const n=DEC.stem,all=[...Array(n).keys()].map(i=>'C'+i),[,,,ps]=decState(),e=DEC.end;if(part=='stem'||e=='an')return all;
 return e=='en'||e=='yn'?['C'+(ps-1),'C'+ps]:e=='ol'?['C'+(ps-1),'S'+(ps-1)+'_OH']:e=='one'?['C'+(ps-1),'S'+(ps-1)+'_=O']:e=='al'?['C0','S0_=O']:['C0','S0_=O','S0_OH']}

/* ---------- name -> 3D parser and step solver ---------- */
const STEMS=['meth','eth','prop','but','pent','hex','hept','oct'],MW={di:2,tri:3,tetra:4};
const PW={chloro:['Cl','a chlorine atom takes the place of a hydrogen'],bromo:['Br','a bromine atom takes the place of a hydrogen'],methyl:['CH3','a CH₃ branch (an alkyl group) hangs off the main chain'],
 hydroxy:['OH','an –OH group hangs off the chain (a prefix, because a higher-ranking group is in the name)'],oxo:['=O','a C=O hangs off the chain (a prefix, because a higher-ranking group is in the name)'],methoxy:['OCH3','an –O–CH₃ group hangs off the chain']};
const nums=s=>s?s.split(',').map(Number):[],E=m=>({error:m}),tidy=s=>s.toLowerCase().replace(/[–−]/g,'-').replace(/\s+/g,' ').trim();
function parseName(raw){
 let s=tidy(raw);const comps=[],notes=[];
 if(!s)return E('Type a name first, for example pent-2-ene.');
 if(/(^|[^m])ethyl|propyl|butyl|cyclo|benz|phenyl|amine|amide/.test(s))return E('That name uses a group or ring outside this topic. Here I can build straight chains with methyl branches, halogens, –OH, C=O, –COOH and methyl esters.');
 let ester=false;
 if(/^methyl /.test(s)){if(!/oate$/.test(s))return E('Names that start with "methyl " are esters and must end in -oate, for example methyl ethanoate.');ester=true;comps.push({t:'methyl ',k:'ester'});s=s.slice(7)}
 else if(/oate$/.test(s))return E('An ester name starts with the alkyl group, for example methyl ethanoate.');
 const pre=[],rx=/^(\d+(?:,\d+)*)?-?(di|tri|tetra)?(chloro|bromo|methyl|hydroxy|oxo|methoxy)-?/;let m;
 while((m=s.match(rx))){pre.push({w:m[3],locs:nums(m[1]),mult:m[2]?MW[m[2]]:1});comps.push({t:m[0],k:'pre',i:pre.length-1});s=s.slice(m[0].length)}
 const pm=s.match(/^(meth|eth|prop|but|pent|hex|hept|oct)(a(?=-\d))?(?:-(\d+(?:,\d+)*)-)?(an|en|yn|dien)(e)?(?:-?(\d+(?:,\d+)*)-?)?((?:di|tri)?(?:ol|al|one|oic acid|oate))?$/);
 if(!pm)return E(`I could not read "${raw}". Try forms like pent-2-ene, 2-methylbutane, propan-2-ol, ethanoic acid or 1,2-dibromoethane. One kind of multiple bond at a time is supported.`);
 const n=STEMS.indexOf(pm[1])+1,un=pm[4],ul=nums(pm[3]),sl=nums(pm[6]),sw=pm[7]||'',mm=sw.match(/^(di|tri)?(.*)$/),smult=mm[1]?MW[mm[1]]:1,stype=sw?mm[2]:null;
 if(!stype&&!pm[5])return E('A hydrocarbon name must end in -e, for example pentane or pent-2-ene.');
 if(stype=='oate'&&!ester)return E('-oate is the ester ending, so the name needs an alkyl part first, e.g. methyl ethanoate.');
 if(ester&&stype!='oate')return E('This looks like an ester because it starts with "methyl ", so it must end in -oate.');
 comps.push({t:pm[1]+(pm[2]||''),k:'stem'});if(pm[3])comps.push({t:'-'+pm[3]+'-',k:'unsat'});comps.push({t:un+(pm[5]||''),k:'unsat'});if(sw)comps.push({t:(pm[6]?'-'+pm[6]+'-':'')+sw,k:'suf'});
 const ord=Array(n-1).fill(1),sub=Array.from({length:n},()=>[]),pos=k=>k<1||k>n?`Position ${k} does not exist: this chain has ${n} carbon${n>1?'s':''}, numbered 1 to ${n}.`:null;
 let uloc=[];
 if(un=='en'||un=='yn'){uloc=ul.length?ul:[1];if(!ul.length&&n>=4)notes.push(`No position was given for the ${un=='en'?'double':'triple'} bond, so I assumed carbon 1.`);if(uloc.length>1)return E('One -ene or -yne ending means one multiple bond. For two double bonds use -diene, e.g. buta-1,3-diene.')}
 if(un=='dien'){uloc=ul;if(ul.length!=2)return E('-diene needs two positions, for example buta-1,3-diene.')}
 if(un!='an'&&n<2)return E('A double or triple bond needs at least 2 carbons.');
 for(const k of uloc){if(k<1||k>n-1)return E(`There is no bond ${k}: a chain of ${n} carbon${n>1?'s':''} has bonds numbered 1 to ${n-1} (bond k sits between carbon k and k+1).`);ord[k-1]=un=='yn'?3:2}
 let sloc=[],code=[];
 if(stype){
  if(stype=='ol'||stype=='one'){sloc=sl.length?sl:(smult==1?[stype=='one'?2:1]:[]);if(!sl.length&&n>=4)notes.push(`No position was given for the ${stype=='ol'?'–OH':'C=O'}, so I assumed carbon ${stype=='one'?2:1}.`);code=stype=='ol'?['OH']:['=O']}
  else if(stype=='al'||stype=='oic acid'){sloc=smult==1?[1]:[1,n];code=stype=='al'?['=O']:['=O','OH']}
  else{sloc=[1];code=['=O','OCH3']}
  if(sloc.length!=smult)return E(`"${sw}" needs ${smult} position${smult>1?'s':''}, for example ${smult>1?'1,2':'2'}.`);
  for(const k of sloc){const e=pos(k);if(e)return E(e);if(stype=='one'&&(k==1||k==n))return E('A ketone C=O cannot sit on an end carbon: a C=O on the end carbon with an H is an aldehyde (-al).');sub[k-1].push(...code)}}
 for(const p of pre){const cd=PW[p.w][0];let locs=p.locs;if(!locs.length){locs=p.mult==1?[1]:(n==1?Array(p.mult).fill(1):[]);if(p.mult==1&&n>=3)notes.push(`No position was given for ${p.w}, so I assumed carbon 1.`)}
  if(locs.length!=p.mult)return E(`"${p.w}" with that multiplier needs ${p.mult} positions, for example 2,3-dimethyl.`);
  for(const k of locs){const e=pos(k);if(e)return E(e);if(sub[k-1].includes(cd)&&!['Cl','Br','CH3'].includes(cd))return E(`Carbon ${k} already has a ${p.w} group.`);sub[k-1].push(cd)}p.code=cd;p.locs=locs}
 for(let i=0;i<n;i++)if(hOf(i,n,ord,sub)<0)return E(`Carbon ${i+1} would need more than 4 bonds with that name. Remember: bonds to carbon (a double bond counts 2) plus bonds to groups cannot exceed 4.`);
 let n2=n,o2=ord.slice(),s2=sub.map(g=>g.slice()),norm=false;
 for(let t=0;t<4;t++){if(s2[0].includes('CH3')&&n2<8){s2[0]=s2[0].filter(c=>c!='CH3');s2.unshift([]);o2.unshift(1);n2++;norm=true}else if(s2[n2-1].includes('CH3')&&n2<8){s2[n2-1]=s2[n2-1].filter(c=>c!='CH3');s2.push([]);o2.push(1);n2++;norm=true}else break}
 return{raw,n,ord,sub,n2,o2,s2,norm,comps,pre,un,uloc,stype,sloc,smult,ester,notes,stem:pm[1]+(pm[2]||'')}}
function solveSteps(p){
 const n=p.n,ord=Array(n-1).fill(1),sub=Array.from({length:n},()=>[]),cp=()=>[n,ord.slice(),sub.map(g=>g.slice())],S=[],ch=[...Array(n).keys()].map(i=>'C'+i);
 S.push({k:'stem',st:cp(),focus:ch,cap:`<b>${p.stem}</b> tells you the main chain has <b>${n} carbon${n>1?'s':''}</b> (meth 1, eth 2, prop 3, but 4, pent 5, hex 6, hept 7, oct 8). Draw the chain first. Every carbon needs 4 bonds, so hydrogens fill whatever is left.`});
 if(p.un=='an')S.push({k:'unsat',st:cp(),focus:ch,cap:'<b>-ane</b> means every bond between carbons is a single bond. The carbons hold as many hydrogens as possible: they are saturated. This is an alkane.'});
 else{p.uloc.forEach(k=>ord[k-1]=p.un=='yn'?3:2);const f=[],ks=p.uloc.join(' and ');p.uloc.forEach(k=>f.push('C'+(k-1),'C'+k));
  S.push({k:'unsat',st:cp(),focus:f,cap:p.un=='yn'?`<b>-yne</b>: a C≡C triple bond between carbon ${ks} and the next carbon. Those carbons share 3 bonds, so each has just 2 neighbours and the shape is a straight line (180°).`:`<b>-${p.un=='dien'?'diene':'ene'}</b>: C=C double bond${p.uloc.length>1?'s':''} starting at carbon ${ks}. Carbons that share 2 bonds each hold one fewer hydrogen, and the shape around them is flat (120°). The molecule is unsaturated.`})}
 if(p.stype){p.sloc.forEach(k=>{const c=p.stype=='ol'?['OH']:p.stype=='one'||p.stype=='al'?['=O']:p.stype=='oic acid'?['=O','OH']:['=O','OCH3'];sub[k-1].push(...c)});
  const f=[];p.sloc.forEach(k=>{f.push('C'+(k-1),'S'+(k-1)+'_=O','S'+(k-1)+'_OH','S'+(k-1)+'_OCH3')});
  const L=p.sloc.join(' and '),cap={ol:`<b>-ol</b>: an –OH (hydroxyl) group on carbon ${L}. This makes it an alcohol. The suffix takes the place of the final -e.`,al:'<b>-al</b>: carbon 1 has a C=O and one H, the –CHO group of an aldehyde. It is always at the end of the chain, so it is always carbon 1.',one:`<b>-one</b>: a C=O inside the chain, on carbon ${L}. A carbonyl that is not at the end of the chain is a ketone.`,'oic acid':'<b>-oic acid</b>: carbon 1 carries a C=O and an –OH together. That is the carboxyl group, –COOH, the carboxylic acid group.',oate:'<b>Ester</b>: the part before the space (methyl) is the alkyl group attached through the oxygen. The -oate part is the chain with the C=O. Carbon 1 carries =O and –O–CH₃.'}[p.stype];
  S.push({k:'suf',st:cp(),focus:f,cap:cap+(p.smult>1?` The multiplier shows there are ${p.smult} of them.`:'')})}
 p.pre.forEach((q,i)=>{q.locs.forEach(k=>sub[k-1].push(q.code));const f=[];q.locs.forEach(k=>f.push('C'+(k-1),'S'+(k-1)+'_'+q.code));
  S.push({k:'pre',pi:i,st:cp(),focus:f,cap:`<b>${q.locs.length?q.locs.join(',')+'-':''}${q.mult>1?Object.keys(MW).find(x=>MW[x]==q.mult):''}${q.w}</b>: ${PW[q.w][1]}${q.locs.length?` (on carbon${q.locs.length>1?'s':''} ${q.locs.join(' and ')})`:''}.`})});
 const fin=analyse(p.n2,p.o2,p.s2).name,ok=fin==tidy(p.raw),why=p.norm?'A branch on an end carbon is really part of a longer main chain, so always pick the longest continuous chain.':'Number the chain from the end that gives the lowest numbers: first to the main functional group, then to double or triple bonds, then to branches. List branches alphabetically.';
 S.push({k:'res',st:[p.n2,p.o2,p.s2],focus:null,cap:(ok?`✓ <b>${fin}</b> is the correct IUPAC name for this molecule.`:`This name describes the molecule, but the correct IUPAC name is <b>${fin}</b>. ${why}`)+` Molecular formula: <b>${mfOf(p.n2,p.o2,p.s2)}</b>.`+(p.notes.length?'<br><small>'+p.notes.join(' ')+'</small>':'')});
 return S}