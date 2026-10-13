/* model3d.js — 3D molecule scene: state, camera, projection, drawing, pointer + keyboard interaction.
   Depends on chem.js for geometry and formulas (build, desc, V, D2R, $, clamp).
   Uses lessons.js at runtime for UI refresh (refreshUI, evt, hovUI, focusList, FOC, LAST, fz, HOV, NREV, EN, cap).

   Everything the other files already use keeps its name and behaviour. New in this version:
   · Rendering: cached shaded sphere sprites with specular + rim light, depth fade, soft contact shadows on a floor plane,
     a small "pop" overshoot when atoms appear, a selection ripple, crisper pill labels.
   · Interaction: tap a BOND to inspect it (type, length, what it means), hover tooltips for atoms and bonds,
     Shift+tap two or three atoms to MEASURE distance and angle, double-tap an atom to spotlight it, double-tap empty space to reset.
   · Camera: smooth zoom, animated view changes, frame-rate independent inertia, pauses auto-rotate while you point at something.
   · Keyboard: arrows rotate, + / − zoom, R reset, L labels, E electrons, S spotlight, N numbers, A angle guide,
     1 / 2 / 3 display style, Space pause rotation, Esc clear.
   · Robustness: ResizeObserver, a frame loop that survives errors, aria-label that follows the molecule.
   · Public API: window.Scene (reset, viewTo, focus, snapshot, setStyle, toggle, clearMeasure).                      */

/* ====================================================================================
   1. Scene state (names unchanged)
   ==================================================================================== */
const A={},B={};let N=1,ORD=[],SUB=[[]],SEL=null,AP=0,MODE='ball',OPT={lab:1,elec:0,shape:1,spot:1,num:0},HIST=[];
const MODES={
  ball :{C:.42,H:.27,O:.40,Cl:.50,Br:.58,t:.07},
  space:{C:1.7,H:1.2,O:1.52,Cl:1.75,Br:1.85,t:0},
  skel :{C:.11,H:.08,O:.11,Cl:.12,Br:.13,t:.03}};
const RC={...MODES.ball};
const FILL=1.12;
let yaw=.7,pit=.28,zoom=1,fit=60,C0=[0,0,0],CT=[0,0,0],vy=0,vp=0,idle=0,first=true;
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;

/* private extras (one object so nothing collides with the other files) */
const M3={
  spr:new Map(),shadow:null,         // sprite caches
  view:null,                         // running camera animation
  zT:1,zLast:1,yLast:.7,pLast:.28,   // detect writes made by other files (e.g. the Reset button sets yaw directly)
  auto:true,                         // auto-rotate on/off
  meas:[],                           // atom ids being measured (max 3)
  selB:null,hovB:null,               // selected / hovered bond key
  selId:null,selT:0,                 // selection ripple
  bhits:[],                          // bond hit segments for picking
  home:{yaw:.7,pit:.28,zoom:1}};

const BOND_INFO={
  1:['single bond','one shared pair of electrons'],
  2:['double bond','two shared pairs: shorter and stiffer than a single bond'],
  3:['triple bond','three shared pairs: the shortest, strongest and straightest']};

function setMol(n,ord,sub,opt={}){
  const prevN=N,lc=A['C'+(prevN-1)]?A['C'+(prevN-1)].p.slice():[0,0,0];
  N=n;ORD=ord.slice();SUB=sub.map(g=>g.slice());
  if(!opt.fly)LAST=null;FOC=null;
  const{at,bo}=build(n,ORD,SUB),
        ids=new Set(at.map(a=>a.id)),
        on=at.filter(a=>a.on),
        cen=V.mul(on.reduce((s,a)=>V.add(s,a.p),[0,0,0]),1/on.length),
        inst=opt.instant||first,
        out=p=>V.add(p,V.mul(V.unit(V.sub(p,cen)),5));           // "fly in / fly out" position for reactions
  at.forEach(a=>{
    let o=A[a.id];
    if(!o){
      const st=inst?a.p:(opt.fly&&a.on?out(a.p):(A[a.par]?A[a.par].p:lc));
      o=A[a.id]={id:a.id,el:a.el,par:a.par,p:st.slice(),s:inst?a.on:0};
    }else if(opt.fly&&a.on&&o.ts==0)o.p=out(a.p);
    o.par=a.par;o.t=a.p;o.ts=a.on;o.gone=false;
    if(opt.fly&&!a.on&&o.s>.5)o.t=out(o.p);
  });
  Object.values(A).forEach(o=>{if(!ids.has(o.id)){o.ts=0;o.gone=true;o.t=opt.fly?out(o.p):(A[o.par]?A[o.par].t:cen)}});
  Object.values(B).forEach(b=>b.alive=false);
  bo.forEach(([a,b,o])=>{const k=a+'|'+b;let x=B[k];if(!x)x=B[k]={a,b,o,cur:o,al:inst?1:0,sep:o>1?1:0};x.o=o;x.alive=true});
  CT=cen;CT.R=Math.max(...on.map(a=>V.len(V.sub(a.p,cen))));
  CT.Rh=Math.max(...on.map(a=>{const d=V.sub(a.p,cen);return Math.hypot(d[0],d[2])}));            // widest it can get sideways while turning
  CT.Rv=Math.max(...on.map(a=>{const d=V.sub(a.p,cen);return Math.abs(d[1])+Math.hypot(d[0],d[2])*.4}));   // tallest it gets at the usual tilt
  if(inst)C0=cen.slice();
  first=false;
  if(SEL&&!(A[SEL]&&ids.has(SEL)&&at.find(a=>a.id==SEL).on))SEL=null;
  M3.selB=null;M3.hovB=null;M3.meas=M3.meas.filter(id=>ids.has(id));
  try{cv.setAttribute('aria-label','Interactive 3D model of '+desc().name+'. Drag to rotate, scroll or pinch to zoom, tap an atom or bond to inspect it.')}catch(e){}
  refreshUI();
}
const nbrs=id=>Object.values(B).filter(b=>b.alive&&(b.a==id||b.b==id)).map(b=>b.a==id?b.b:b.a);

/* ====================================================================================
   2. Camera, layout and sizing
   ==================================================================================== */
const cv=$('#cv'),ctx=cv.getContext('2d');
if(!ctx.roundRect)CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
  r=Math.min(typeof r=='number'?r:0,w/2,h/2);
  this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);this.closePath()};
let W=0,H=0,dpr=1,cx=0,cy=0,half=200;
let tcx=0,tcy=0,thalf=200,rz0=true,thw=200,thh=200,hw=200,hh=200;                 // target centre / size (eased towards every frame)

function resize(){
  const r=$('#scene').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
  if(d!==dpr){dpr=d;M3.spr.clear()}
  W=r.width;H=r.height;
  cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
  layout();
}
function layout(){
  const st=document.documentElement.style,
    wide=innerWidth>860,
    vis=s=>!$(s).hidden,
    ex=wide&&typeof MODEUX!=='undefined'&&MODEUX=='explore',
    lv=wide&&vis('#left'),
    dv=wide&&vis('#dock'),
    fv=wide&&vis('#facts'),
    tw=wide?68:0,                                       // width of the vertical toolbar
    pl=ex?(document.body.classList.contains('col-off')?52:$('#tour').offsetWidth+32+(innerWidth>=1100?(!document.body.classList.contains('tour-closed')?$('#tb').offsetWidth+16:(document.querySelector('#pick.side:not([hidden])>.pkm')?document.querySelector('#pick.side:not([hidden])>.pkm').offsetWidth+16:0)):0)):lv?$('#left').offsetWidth+32:(wide?$('#tour').offsetWidth+32:16),      // Guided with no left card: the lesson card sits at the left; Explore: Learn card + Pick card stacked on the left
    pr=ex?tw+16:wide?(lv?$('#tour').offsetWidth+32+tw:tw+16):16,                   // Explore: right side only holds the tool bar
    cl=ex?pl:lv?pl:wide?pl:fv?204:16,
    cr=wide?pr:16,
    titleH=$('#title').offsetHeight,
    tp=ex?Math.max(104,titleH+70):Math.max(wide?124:152,titleH+(wide?64:124)),
    dh=dv?Math.max(ex?170:210,$('#dock').offsetHeight+28):(wide?24:12),
    bt=wide?(ex?dh+24:Math.max(dh,66)):68;                           // Explore: a little bleed behind the dock's rounded top
  tcx=cl+(W-cl-cr)/2;tcy=tp+(H-tp-bt)/2;
  thalf=Math.max(60,Math.min((W-cl-cr)/2*.97,(H-tp-bt)/2*.95));
  thw=Math.max(60,(W-cl-cr)/2);thh=Math.max(60,(H-tp-bt)/2);        // the free rectangle, half-width / half-height
  if(rz0){cx=tcx;cy=tcy;half=thalf;hw=thw;hh=thh;rz0=false}
  st.setProperty('--tw',tw+'px');st.setProperty('--pl',pl+'px');st.setProperty('--pr',pr+'px');
  st.setProperty('--cl',cl+'px');st.setProperty('--cr',cr+'px');st.setProperty('--dh',dh+'px');st.setProperty('--cx',tcx+'px');st.setProperty('--cy',tcy+'px');st.setProperty('--tp',tp+'px');st.setProperty('--fw',(W-cl-cr)+'px');
}
{ /* resize on window changes AND whenever the scene box itself changes (panels opening, mobile toolbars…) */
  let q=0;const rq=()=>{cancelAnimationFrame(q);q=requestAnimationFrame(resize)};
  addEventListener('resize',rq);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(rq).observe($('#scene'));
}
function proj(v,sc){
  const x=v[0]-C0[0],y=v[1]-C0[1],z=v[2]-C0[2],cyw=Math.cos(yaw),syw=Math.sin(yaw),cp=Math.cos(pit),sp=Math.sin(pit);
  const x1=x*cyw+z*syw,z1=-x*syw+z*cyw,y1=y*cp-z1*sp,z2=y*sp+z1*cp,k=24/(24-z2);
  return{x:cx+x1*k*sc,y:cy-y1*k*sc,z:z2,k};
}

/* animated camera: M3.view is cancelled automatically if anything else changes yaw/pit (a drag, a key press…) */
const wrapPi=d=>((d+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
function viewTo(o,ms=650){
  if(reduced){if(o.yaw!==undefined)yaw=o.yaw;if(o.pit!==undefined)pit=o.pit;if(o.zoom!==undefined)zoom=M3.zT=o.zoom;vy=vp=0;return}
  const y1=o.yaw!==undefined?o.yaw:yaw,p1=o.pit!==undefined?o.pit:pit,z1=o.zoom!==undefined?o.zoom:zoom;
  M3.view={t0:performance.now(),ms,y0:yaw,dy:wrapPi(y1-yaw),p0:pit,p1,z0:zoom,z1};vy=vp=0;idle=0;
}

/* ====================================================================================
   3. Drawing helpers: sprites, labels
   ==================================================================================== */
const COL={
  C :['#7a8cad','#1f2b44','#16203a'],
  H :['#ffffff','#c7d4e5','#9fb0c6'],
  O :['#ff9a9a','#b02a2a','#7a1a1a'],
  Cl:['#9be8a0','#238a3c','#17602a'],
  Br:['#e0957a','#82301c','#5e2314']};
const BCOL={C:'#44536e',H:'#b3c1d4',O:'#c46a6a',Cl:'#3f9a55',Br:'#9a4a36'};
let hits=[];

/* A shaded ball is drawn once per (element, size bucket) and then stamped with drawImage: faster and nicer
   (specular highlight, darker rim, soft bounce light) than a fresh gradient for every atom every frame. */
function sphereSprite(el,r){
  const rb=Math.max(4,Math.ceil(r/3)*3),key=el+rb;let o=M3.spr.get(key);if(o)return o;
  if(M3.spr.size>300)M3.spr.clear();
  const R=rb*dpr,s=Math.ceil(R*2)+6,m=s/2,c=document.createElement('canvas');c.width=c.height=s;const g=c.getContext('2d');
  const body=g.createRadialGradient(m-R*.35,m-R*.4,R*.08,m,m,R);body.addColorStop(0,COL[el][0]);body.addColorStop(1,COL[el][1]);
  g.beginPath();g.arc(m,m,R,0,7);g.fillStyle=body;g.fill();
  const rim=g.createRadialGradient(m,m,R*.55,m,m,R);rim.addColorStop(0,'rgba(0,0,0,0)');rim.addColorStop(1,'rgba(8,16,36,.22)');
  g.beginPath();g.arc(m,m,R,0,7);g.fillStyle=rim;g.fill();
  const bounce=g.createRadialGradient(m+R*.45,m+R*.55,0,m+R*.45,m+R*.55,R*.7);bounce.addColorStop(0,'rgba(180,210,255,.22)');bounce.addColorStop(1,'rgba(180,210,255,0)');
  g.save();g.beginPath();g.arc(m,m,R,0,7);g.clip();g.fillStyle=bounce;g.fillRect(0,0,s,s);g.restore();
  g.beginPath();g.ellipse(m-R*.34,m-R*.44,R*.2,R*.12,-.6,0,7);g.fillStyle='rgba(255,255,255,.6)';g.fill();
  g.beginPath();g.arc(m,m,R,0,7);g.lineWidth=Math.max(1,dpr*.8);g.strokeStyle=COL[el][2];g.globalAlpha=.5;g.stroke();
  o={c,rb,w:s/dpr};M3.spr.set(key,o);return o;
}
function drawBall(x,y,r,el){const o=sphereSprite(el,r),w=o.w*(r/o.rb);ctx.drawImage(o.c,x-w/2,y-w/2,w,w)}
/* kept for compatibility with older code that calls sphere() directly */
function sphere(x,y,r,el,sel){
  drawBall(x,y,Math.max(r,.5),el);
  if(sel){ctx.save();ctx.shadowColor='#2f5bea';ctx.shadowBlur=18;ctx.lineWidth=3;ctx.strokeStyle='#2f5bea';ctx.beginPath();ctx.arc(x,y,r+1.5,0,7);ctx.stroke();ctx.restore()}
}
function shadowSprite(){
  if(M3.shadow)return M3.shadow;
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(20,33,61,.55)');gr.addColorStop(.55,'rgba(20,33,61,.22)');gr.addColorStop(1,'rgba(20,33,61,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);return M3.shadow=c;
}
/* rounded label ("pill") used for bond lengths, angles and measurements */
function pill(t,x,y,o={}){
  ctx.font=`${o.bold?700:600} ${o.size||12}px "Avenir Next","Segoe UI",sans-serif`;
  const w=ctx.measureText(t).width+(o.pad||14),h=(o.size||12)+10;
  ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,h/2.4);ctx.fillStyle=o.bg||'rgba(20,33,61,.92)';ctx.fill();
  if(o.stroke){ctx.lineWidth=1.5;ctx.strokeStyle=o.stroke;ctx.stroke()}
  ctx.fillStyle=o.fg||'#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,x,y+.5);
}
const popScale=s=>s>=1?1:s<=0?0:s*(1+.22*Math.sin(Math.PI*s));     // slight overshoot as atoms appear
const dist2seg=(px,py,x1,y1,x2,y2)=>{const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy||1,t=clamp(((px-x1)*dx+(py-y1)*dy)/l,0,1);return Math.hypot(px-(x1+t*dx),py-(y1+t*dy))};

/* ====================================================================================
   4. The frame
   ==================================================================================== */
function draw(now){
  const dt=clamp((now-(frame.t||now))/1e3,0,.05),f60=dt*60,k=1-Math.exp(-dt*8);frame.t=now;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);

  /* --- ease layout, display style, atoms and bonds --- */
  cx+=(tcx-cx)*k;cy+=(tcy-cy)*k;half+=(thalf-half)*k;hw+=(thw-hw)*k;hh+=(thh-hh)*k;
  const mt=MODES[MODE];for(const q in mt)RC[q]+=(mt[q]-RC[q])*k;
  for(const id in A){const o=A[id];for(let i=0;i<3;i++)o.p[i]+=(o.t[i]-o.p[i])*k;o.s+=(o.ts-o.s)*k;if(o.gone&&o.s<.01){if(SEL==id)SEL=null;delete A[id]}}
  for(const key in B){const b=B[key];b.al+=((b.alive?1:0)-b.al)*k;
    if(b.cur!=b.o&&b.sep<.06)b.cur=b.o;
    b.sep+=(((b.cur==b.o&&b.o>1)?1:0)-b.sep)*Math.min(1,k*1.3);
    if(!b.alive&&b.al<.01)delete B[key]}

  /* --- camera: spotlight pan + zoom, view animation, smooth zoom, inertia, auto-rotate --- */
  const FO=focusList(),sp=!!(SEL&&OPT.spot&&A[SEL]&&!FOC),tg=sp?A[SEL].p:CT;
  for(let i=0;i<3;i++)C0[i]+=(tg[i]-C0[i])*k;
  fz+=((sp?1.45:1)-fz)*k;
  const isF=id=>!FO||FO.some(p=>id==p||(p[0]=='S'&&id.startsWith(p)));
  const ar=Math.max(RC.C,RC.Br)*.8+.25,eh=(CT.Rh||CT.R||1)+ar,ev=(CT.Rv||CT.R||1)+ar;
  fit+=(Math.min(hw/eh,hh/ev)*FILL-fit)*k;                                   // fill the free rectangle (not just a circle) so long chains stay big
  idle+=dt;
  if(zoom!==M3.zLast)M3.zT=zoom;                                            // someone else set zoom directly
  if(M3.view&&(yaw!==M3.yLast||pit!==M3.pLast))M3.view=null;                // a drag or key press cancels the animation
  if(M3.view){
    const v=M3.view,t=clamp((now-v.t0)/v.ms,0,1),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    yaw=v.y0+v.dy*e;pit=v.p0+(v.p1-v.p0)*e;zoom=M3.zT=v.z0+(v.z1-v.z0)*e;vy=vp=0;if(t>=1)M3.view=null;
  }else{
    zoom+=(M3.zT-zoom)*Math.min(1,k*1.5);if(Math.abs(M3.zT-zoom)<1e-4)zoom=M3.zT;
    if(!ptrs.size){
      yaw+=vy*f60;pit=clamp(pit+vp*f60,-1.45,1.45);const dm=Math.pow(.93,f60);vy*=dm;vp*=dm;
      if(idle>2.5&&!reduced&&M3.auto&&!HOV&&!M3.hovB)yaw+=(SEL?.12:.22)*dt;   // calm while you are pointing at something
    }
  }
  const sc=fit*zoom*fz,zr=(CT.R||1)+1,dep=z=>.8+.2*clamp((z/zr+1)/2,0,1);   // dep(): far atoms fade slightly
  const items=[];hits=[];M3.bhits=[];

  /* --- floor: soft contact shadows under every atom --- */
  {
    const fy=CT[1]-zr-.25,flat=clamp(Math.abs(Math.sin(pit))*.9+.12,.14,1),base=proj([CT[0],fy,CT[2]],sc),sh=shadowSprite();
    ctx.save();ctx.translate(base.x,base.y);ctx.scale(1,flat*.9);ctx.globalAlpha=.55;const R0=half*.95*zoom;ctx.drawImage(sh,-R0,-R0,R0*2,R0*2);ctx.restore();
    for(const id in A){const o=A[id];if(o.s<.2)continue;const q=proj([o.p[0],fy,o.p[2]],sc),rr=RC[o.el]*popScale(o.s)*sc*q.k*1.3;if(rr<2)continue;
      ctx.save();ctx.translate(q.x,q.y);ctx.scale(1,flat);ctx.globalAlpha=clamp(.32*(1-(o.p[1]-fy)/(2*zr)),.05,.32)*o.s;ctx.drawImage(sh,-rr,-rr,rr*2,rr*2);ctx.restore()}
  }

  /* --- shape guide + angle for the selected carbon --- */
  let overlay=null;
  if(SEL&&A[SEL]&&A[SEL].el=='C'){
    const nb=nbrs(SEL).filter(i=>A[i]),c=A[SEL];
    if(OPT.shape&&nb.length>=2){
      const Q=nb.map(i=>proj(A[i].p,sc));
      items.push({z:-1e3,f:()=>{
        ctx.save();ctx.fillStyle='rgba(47,91,234,.09)';ctx.strokeStyle='rgba(47,91,234,.55)';ctx.lineWidth=1.5;ctx.setLineDash([6,5]);
        const poly=ids=>{ctx.beginPath();ids.forEach((q,j)=>j?ctx.lineTo(Q[q].x,Q[q].y):ctx.moveTo(Q[q].x,Q[q].y));ctx.closePath();ctx.fill();ctx.stroke()};
        if(nb.length==4)[[0,1,2],[0,1,3],[0,2,3],[1,2,3]].forEach(poly);
        else if(nb.length==3)poly([0,1,2]);
        else{ctx.beginPath();ctx.moveTo(Q[0].x,Q[0].y);ctx.lineTo(Q[1].x,Q[1].y);ctx.stroke()}
        ctx.restore()}});
    }
    const prs=[];for(let i=0;i<nb.length;i++)for(let j=i+1;j<nb.length;j++)prs.push([nb[i],nb[j]]);
    if(prs.length){
      const[p,q]=prs[AP%prs.length],v1=V.unit(V.sub(A[p].p,c.p)),v2=V.unit(V.sub(A[q].p,c.p)),w=Math.acos(clamp(V.dot(v1,v2),-1,1));
      let e2=V.sub(v2,V.mul(v1,V.dot(v1,v2)));
      e2=V.len(e2)<.05?V.unit(V.cross(v1,Math.abs(v1[2])<.9?[0,0,1]:[0,1,0])):V.unit(e2);
      const pts=[];for(let t=0;t<=1.001;t+=.05){const a=w*t;pts.push(V.add(c.p,V.mul(V.add(V.mul(v1,Math.cos(a)),V.mul(e2,Math.sin(a))),.7)))}
      const mid=V.add(c.p,V.mul(V.add(V.mul(v1,Math.cos(w/2)),V.mul(e2,Math.sin(w/2))),1.15));
      overlay={pts,mid,deg:w/D2R};
    }
  }

  /* --- glows: spotlight, lesson focus, hover --- */
  const glow=(p,r,rgb)=>items.push({z:-2e3,f:()=>{const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,`rgba(${rgb},.72)`);g.addColorStop(1,`rgba(${rgb},0)`);ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill()}});
  if(FO)FO.forEach(id=>{const a=A[id];if(!a||a.el=='H'||(!FOC&&id!=SEL))return;const p=proj(a.p,sc);glow(p,RC[a.el]*sc*p.k*(FOC?3:4)+34,'255,214,102')});
  if(HOV&&A[HOV]){const a=A[HOV],p=proj(a.p,sc);glow(p,RC[a.el]*sc*p.k*2.4+22,'255,200,60')}

  /* --- atoms --- */
  for(const id in A){
    const o=A[id],p=proj(o.p,sc),r=RC[o.el]*popScale(o.s)*sc*p.k;if(r<.4)continue;
    items.push({z:p.z,f:()=>{
      ctx.globalAlpha=isF(id)?dep(p.z):.16;
      drawBall(p.x,p.y,r,o.el);
      if(id==SEL){ctx.save();ctx.shadowColor='#2f5bea';ctx.shadowBlur=18;ctx.lineWidth=3;ctx.strokeStyle='#2f5bea';ctx.beginPath();ctx.arc(p.x,p.y,r+1.5,0,7);ctx.stroke();ctx.restore()}
      if(OPT.lab&&MODE!='skel'&&r>9){ctx.fillStyle=o.el=='H'?'#14213d':'#fff';ctx.font=`600 ${Math.min(r*.9,22)}px "Avenir Next","Segoe UI",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(o.el,p.x,p.y+1)}
      if(id==HOV){ctx.lineWidth=3;ctx.strokeStyle='#f2a900';ctx.beginPath();ctx.arc(p.x,p.y,r+3,0,7);ctx.stroke()}
      if(OPT.num&&/^C\d+$/.test(id)&&r>6){
        const i=+id.slice(1),bx=p.x-r*.78-3,by=p.y-r*.9-3;
        ctx.fillStyle='#2f5bea';ctx.beginPath();ctx.arc(bx,by,9,0,7);ctx.fill();
        ctx.fillStyle='#fff';ctx.font='700 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(NREV?N-i:i+1,bx,by+.5)}
      ctx.globalAlpha=1}});
    hits.push({id,x:p.x,y:p.y,r:Math.max(r,12),z:p.z});
  }

  /* --- bonds --- */
  for(const key in B){
    const b=B[key],a=A[b.a],c=A[b.b];if(!a||!c)continue;
    const th=RC.t*Math.min(a.s,c.s)*b.al;if(th<.004)continue;
    const ax=V.sub(c.p,a.p),L=V.len(ax);if(L<1e-3)continue;
    const d=V.mul(ax,1/L),w=Math.abs(d[2])<.95?V.unit(V.cross(d,[0,0,1])):V.unit(V.cross(d,[0,1,0])),vv=V.cross(d,w),
          ra=RC[a.el]*a.s*.85,rc=RC[c.el]*c.s*.85;
    if(ra+rc>=L)continue;
    const offs=b.cur==1?[[0,0,0]]:b.cur==2?[V.mul(w,.17*b.sep),V.mul(w,-.17*b.sep)]
      :[90,210,330].map(g=>V.add(V.mul(w,Math.cos(g*D2R)*.21*b.sep),V.mul(vv,Math.sin(g*D2R)*.21*b.sep)));
    const lit=isF(b.a)&&isF(b.b),hot=SEL==b.a||SEL==b.b||(!!FOC&&lit);

    /* picking segment + hover / selected halo */
    const pa0=proj(a.p,sc),pc0=proj(c.p,sc),wd0=th*2*sc*(pa0.k+pc0.k)/2;
    if(b.al>.8&&th>.01)M3.bhits.push({key,x1:pa0.x,y1:pa0.y,x2:pc0.x,y2:pc0.y,r:Math.max(9,wd0*.6+5),z:(pa0.z+pc0.z)/2});
    if(M3.hovB===key||M3.selB===key)items.push({z:-1500,f:()=>{ctx.strokeStyle=M3.selB===key?'rgba(47,91,234,.34)':'rgba(47,91,234,.2)';ctx.lineWidth=wd0+12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(pa0.x,pa0.y);ctx.lineTo(pc0.x,pc0.y);ctx.stroke()}});

    offs.forEach(o=>{
      const S=V.add(V.add(a.p,V.mul(d,ra)),o),E=V.add(V.sub(c.p,V.mul(d,rc)),o),M=V.mul(V.add(S,E),.5),
            ps=proj(S,sc),pm=proj(M,sc),pe=proj(E,sc);
      [[ps,pm,a.el],[pm,pe,c.el]].forEach(([p,q,el])=>{
        const wd=th*2*sc*(p.k+q.k)/2;
        items.push({z:(p.z+q.z)/2,f:()=>{
          ctx.globalAlpha=lit?dep((p.z+q.z)/2):.12;ctx.lineCap='round';
          ctx.strokeStyle=hot?'#2f5bea':BCOL[el];ctx.lineWidth=wd;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
          ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=wd*.34;ctx.beginPath();ctx.moveTo(p.x-wd*.16,p.y-wd*.16);ctx.lineTo(q.x-wd*.16,q.y-wd*.16);ctx.stroke();
          ctx.globalAlpha=1}});
      });
      if(OPT.elec&&MODE=='ball'&&(b.sep>.5||b.cur==1)){
        const pa=proj(V.add(M,V.mul(d,.14)),sc),pb=proj(V.sub(M,V.mul(d,.14)),sc),rr=.085*sc*pm.k;
        items.push({z:pm.z+.05,f:()=>{ctx.globalAlpha=lit?1:.12;ctx.fillStyle='#f2a900';ctx.strokeStyle='#fff';ctx.lineWidth=1;
          [pa,pb].forEach(q=>{ctx.beginPath();ctx.arc(q.x,q.y,rr,0,7);ctx.fill();ctx.stroke()});ctx.globalAlpha=1}});
      }
    });
  }

  items.sort((p,q)=>p.z-q.z).forEach(i=>i.f());

  /* --- overlays drawn on top: angle, bond lengths, selection ripple, measurements --- */
  if(overlay){
    const P=overlay.pts.map(v=>proj(v,sc)),m=proj(overlay.mid,sc),cp=proj(A[SEL].p,sc);
    ctx.fillStyle='rgba(242,169,0,.35)';ctx.strokeStyle='#f2a900';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(cp.x,cp.y);P.forEach(q=>ctx.lineTo(q.x,q.y));ctx.closePath();ctx.fill();
    ctx.beginPath();P.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();
    pill(overlay.deg.toFixed(1).replace('.0','')+'°',m.x,m.y,{bg:'#fff',fg:'#14213d',stroke:'#f2a900',size:15,bold:1,pad:16});
  }
  if(SEL&&OPT.spot&&A[SEL]&&!FOC)Object.values(B).forEach(b=>{
    if(!b.alive||(b.a!=SEL&&b.b!=SEL))return;const a=A[b.a],c=A[b.b];if(!a||!c||a.s<.8||c.s<.8)return;
    const m=proj(V.mul(V.add(a.p,c.p),.5),sc);
    pill(`${a.el}–${c.el}  ${V.len(V.sub(a.p,c.p)).toFixed(2)} Å${b.o>1?' · '+(b.o==2?'double':'triple'):''}`,m.x,m.y-16);
  });
  if(SEL!==M3.selId){M3.selId=SEL;M3.selT=now}
  if(SEL&&A[SEL]){const t=(now-M3.selT)/700;if(t>=0&&t<1){const a=A[SEL],p=proj(a.p,sc),r0=RC[a.el]*a.s*sc*p.k;
    ctx.strokeStyle=`rgba(47,91,234,${.55*(1-t)})`;ctx.lineWidth=3*(1-t)+1;ctx.beginPath();ctx.arc(p.x,p.y,r0*(1.1+t*1.6),0,7);ctx.stroke()}}
  M3.meas=M3.meas.filter(id=>A[id]);
  if(M3.meas.length){
    const ids=M3.meas,P=ids.map(id=>proj(A[id].p,sc));
    ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle='#7a3fd0';ctx.lineWidth=2;
    for(let i=0;i<P.length-1;i++){ctx.beginPath();ctx.moveTo(P[i].x,P[i].y);ctx.lineTo(P[i+1].x,P[i+1].y);ctx.stroke()}ctx.restore();
    P.forEach((p,i)=>{ctx.lineWidth=2.5;ctx.strokeStyle='#7a3fd0';ctx.beginPath();ctx.arc(p.x,p.y,RC[A[ids[i]].el]*sc*p.k+4,0,7);ctx.stroke()});
    for(let i=0;i<P.length-1;i++){const d=V.len(V.sub(A[ids[i]].p,A[ids[i+1]].p));pill(d.toFixed(2)+' Å',(P[i].x+P[i+1].x)/2,(P[i].y+P[i+1].y)/2,{bg:'#7a3fd0'})}
    if(ids.length==3){
      const v1=V.unit(V.sub(A[ids[0]].p,A[ids[1]].p)),v2=V.unit(V.sub(A[ids[2]].p,A[ids[1]].p)),ang=Math.acos(clamp(V.dot(v1,v2),-1,1))/D2R;
      pill('∠ '+ang.toFixed(1).replace('.0','')+'°',P[1].x,P[1].y+30,{bg:'#fff',fg:'#7a3fd0',stroke:'#7a3fd0',bold:1,size:13});
    }
  }
  M3.yLast=yaw;M3.pLast=pit;M3.zLast=zoom;
}
/* the loop survives a bad frame instead of freezing the whole scene */
function frame(now){try{draw(now)}catch(err){console.error('model3d frame error:',err)}requestAnimationFrame(frame)}

/* ====================================================================================
   5. Pointer interaction: rotate, pinch, wheel, tap, hover, double-tap, measure
   ==================================================================================== */
const ptrs=new Map();let moved=0,downT=0,pinch=0;
const dist=()=>{const[a,b]=[...ptrs.values()];return Math.hypot(a[0]-b[0],a[1]-b[1])};
function touched(){idle=0;$('#hint').classList.add('off')}
const local=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
const atomAt=(x,y)=>hits.filter(q=>Math.hypot(q.x-x,q.y-y)<=q.r).sort((a,b)=>b.z-a.z)[0]||null;
const bondAt=(x,y)=>M3.bhits.filter(q=>dist2seg(x,y,q.x1,q.y1,q.x2,q.y2)<=q.r).sort((a,b)=>b.z-a.z)[0]||null;

cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);moved=0;downT=performance.now();vy=vp=0;M3.view=null;touched();
  if(ptrs.size==2)pinch=dist()});
cv.addEventListener('pointermove',e=>{
  const p=ptrs.get(e.pointerId);
  if(!p){hover(e);return}                                         // no button down: just hovering
  const dx=e.clientX-p[0],dy=e.clientY-p[1];ptrs.set(e.pointerId,[e.clientX,e.clientY]);moved+=Math.abs(dx)+Math.abs(dy);touched();tip.hidden=true;
  if(ptrs.size==1){yaw+=dx*.009;pit=clamp(pit+dy*.009,-1.45,1.45);vy=dx*.0035;vp=dy*.0035}
  else if(ptrs.size==2){const d=dist();M3.zT=clamp(M3.zT*d/pinch,.5,3.2);zoom=M3.zT;pinch=d}});
const up=e=>{ptrs.delete(e.pointerId);if(!ptrs.size&&moved<7&&performance.now()-downT<450)pick(e)};
cv.addEventListener('pointerup',up);
cv.addEventListener('pointercancel',e=>ptrs.delete(e.pointerId));
cv.addEventListener('wheel',e=>{e.preventDefault();M3.zT=clamp(M3.zT*Math.exp(-e.deltaY*(e.ctrlKey?.01:.0015)),.5,3.2);touched()},{passive:false});
cv.addEventListener('dblclick',e=>{
  const{x,y}=local(e),a=atomAt(x,y);
  if(a){FOC=null;M3.selB=null;selSet(a.id)}                         // spotlight this atom (a normal tap would toggle it off again)
  else if(!bondAt(x,y))Scene.reset()});

function pick(e){
  const{x,y}=local(e),a=atomAt(x,y);
  if(e.shiftKey&&a){measureToggle(a.id);return}                    // Shift + tap: measure
  if(a){M3.selB=null;select(a.id);return}
  const b=bondAt(x,y);if(b){selectBond(b.key);return}
  M3.selB=null;select(null)}
function measureToggle(id){
  const m=M3.meas,i=m.indexOf(id);
  if(i>=0)m.splice(i,1);else{if(m.length>=3)m.length=0;m.push(id)}
  showInfo()}

/* ====================================================================================
   6. Hover: atoms and bonds
   ==================================================================================== */
const tip=$('#tip');
function hover(e){
  if(ptrs.size){tip.hidden=true;return}
  const{x,y}=local(e),a=atomAt(x,y),b=a?null:bondAt(x,y),id=a?a.id:null,bk=b?b.key:null;
  if(id!==HOV){HOV=id;hovUI()}
  M3.hovB=bk;
  cv.style.cursor=a||b?'pointer':'';
  let text='';
  if(id&&A[id]){const cn=/^C\d+$/.test(id)?' '+(NREV?N-(+id.slice(1)):+id.slice(1)+1):'';text=cap(EN[A[id].el])+cn}
  else if(bk&&B[bk]){const bb=B[bk],pa=A[bb.a],pc=A[bb.b];if(pa&&pc)text=`${pa.el}–${pc.el} ${BOND_INFO[bb.o][0]} · ${V.len(V.sub(pa.p,pc.p)).toFixed(2)} Å`}
  if(text){tip.textContent=text;tip.style.left=e.clientX+14+'px';tip.style.top=e.clientY+14+'px';tip.hidden=false}else tip.hidden=true;
}
cv.addEventListener('pointerleave',()=>{HOV=null;M3.hovB=null;hovUI();tip.hidden=true;cv.style.cursor=''});

/* ====================================================================================
   7. Selection and the info chip
   ==================================================================================== */
function selSet(id){SEL=id;AP=0;showInfo()}
function select(id){FOC=null;selSet(id==SEL?null:id);if(SEL)evt('tap')}
function selectBond(key){
  const b=B[key];if(!b)return;
  SEL=null;AP=0;M3.selB=key;FOC=[b.a,b.b];                          // FOC dims everything else and glows both atoms
  showInfo();evt('tap')}
function showInfo(){
  const f=$('#info');
  /* a bond is selected */
  if(M3.selB&&B[M3.selB]){
    const b=B[M3.selB],a=A[b.a],c=A[b.b];
    if(a&&c){const info=BOND_INFO[b.o];f.hidden=false;
      f.innerHTML=`<span><b>${a.el}–${c.el} ${info[0]}</b> · ${V.len(V.sub(a.p,c.p)).toFixed(2)} Å · ${info[1]}</span>`;return}}
  /* measuring */
  if(M3.meas.length&&!SEL){
    const m=M3.meas.filter(id=>A[id]);
    f.hidden=false;f.innerHTML=`<span><b>Measuring</b> · ${m.length<2?'Shift + tap another atom':m.length<3?'Shift + tap a third atom for an angle':'distances and angle shown'} · <button id="mx0">Clear</button></span>`;
    const x=$('#mx0');if(x)x.onclick=()=>{M3.meas.length=0;showInfo()};return}
  if(!SEL||!A[SEL]){f.hidden=true;return}
  const o=A[SEL],by={};
  Object.values(B).filter(b=>b.alive&&(b.a==SEL||b.b==SEL)).forEach(b=>{const e=A[b.a==SEL?b.b:b.a];if(e)by[e.el]=(by[e.el]||0)+b.o});
  const parts=Object.keys(by).map(e=>`${by[e]} to ${EN[e]}`),tot=Object.values(by).reduce((a,b)=>a+b,0);
  f.hidden=false;
  if(o.el!='C'){f.innerHTML=`<span><b>${cap(EN[o.el])}</b> · ${parts.join(' + ')}</span>`;return}
  const nb=nbrs(SEL),shape=nb.length==4?'tetrahedral':nb.length==3?'flat (trigonal planar)':'straight line',
        num=/^C\d+$/.test(SEL)?' '+(+SEL.slice(1)+1):'';
  f.innerHTML=`<span><b>Carbon${num}</b> · ${tot} bonds = ${parts.join(' + ')} · ${shape}</span>${nb.length>2?'<button id="nx">Next angle</button>':''}`;
  const nx=$('#nx');if(nx)nx.onclick=()=>AP++;
}

/* ====================================================================================
   8. Keyboard
   ==================================================================================== */
cv.tabIndex=0;
function toggleOpt(k){const v=!OPT[k];if(typeof setOpt==='function')setOpt(k,v);else OPT[k]=v}
function setStyle(m){MODE=m;document.querySelectorAll('#tools [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m==m))}
addEventListener('keydown',e=>{
  const t=e.target;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;
  if(t!==document.body&&t!==cv)return;                                // leave buttons and links alone
  const key=e.key.length==1?e.key.toLowerCase():e.key;let used=true;
  switch(key){
    case'ArrowLeft':yaw-=.12;break;      case'ArrowRight':yaw+=.12;break;
    case'ArrowUp':pit=clamp(pit-.12,-1.45,1.45);break;   case'ArrowDown':pit=clamp(pit+.12,-1.45,1.45);break;
    case'+':case'=':M3.zT=clamp(M3.zT*1.15,.5,3.2);break;   case'-':case'_':M3.zT=clamp(M3.zT/1.15,.5,3.2);break;
    case'r':case'0':Scene.reset();break;
    case'l':toggleOpt('lab');break;      case'e':toggleOpt('elec');break;   case's':toggleOpt('spot');break;
    case'n':toggleOpt('num');break;      case'a':toggleOpt('shape');break;
    case'1':setStyle('ball');break;      case'2':setStyle('space');break;   case'3':setStyle('skel');break;
    case' ':M3.auto=!M3.auto;break;
    case'f':if(SEL)selSet(SEL);break;
    case'Escape':FOC=null;M3.selB=null;M3.meas.length=0;selSet(null);break;
    default:used=false}
  if(used){e.preventDefault();touched()}
});

/* ====================================================================================
   9. Public API
   ==================================================================================== */
window.Scene={
  reset:()=>viewTo({yaw:M3.home.yaw,pit:M3.home.pit,zoom:M3.home.zoom}),
  viewTo,
  focus:id=>{if(A[id]){FOC=null;M3.selB=null;selSet(id)}},
  setStyle,
  toggle:toggleOpt,
  clearMeasure:()=>{M3.meas.length=0;showInfo()},
  /* PNG of the current view on a soft background: Scene.snapshot().then(blob => …) */
  snapshot:(bg='#eaf1f8')=>new Promise(res=>{const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.drawImage(cv,0,0);c.toBlob(res)})
};