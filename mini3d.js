/* mini3d.js — a small, self-contained 3D ball-and-stick viewer.
   Needs only chem.js (for build()). It draws on its own <canvas>, so it keeps working
   no matter what the main 3D scene is doing.

     const v = Mini3D.mount(canvas, {n,o,s}, {spin:true, drag:true, labels:false, still:false});
     v.set({n,o,s});   // show another molecule
     v.destroy();                                                                         */
(function(){
'use strict';
const COL={C:['#8d97ad','#3b4252','#1f2735'],H:['#ffffff','#e3e9f2','#aab6c9'],O:['#ff9d92','#e0483b','#9c2a20'],
           Cl:['#93e3a6','#2fa34a','#1b6a2e'],Br:['#dc976f','#a0522d','#68341a']};
const RAD={C:.62,H:.36,O:.56,Cl:.8,Br:.9};
const TXT={C:'#fff',H:'#33415c',O:'#fff',Cl:'#fff',Br:'#fff'};
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const views=new Set();let raf=0,last=0;

function loop(t){
  raf=0;const dt=Math.min(50,t-(last||t));last=t;let any=false;
  views.forEach(v=>{if(!v.cv.isConnected){views.delete(v);return}if(v.active()){v.frame(dt);any=true}});
  if(any)raf=requestAnimationFrame(loop);else last=0;
}
const kick=()=>{if(!raf)raf=requestAnimationFrame(loop)};

function geometry(m){
  if(!m)return{at:[],bo:[],Rh:1,Rv:1};
  const g=build(m.n,m.o.slice(),m.s.map(x=>x.slice()));
  const at=g.at.filter(a=>a.on),idx={};at.forEach((a,i)=>idx[a.id]=i);
  const cen=at.reduce((s,a)=>[s[0]+a.p[0],s[1]+a.p[1],s[2]+a.p[2]],[0,0,0]).map(v=>v/at.length);
  const P=at.map(a=>({id:a.id,el:a.el,x:a.p[0]-cen[0],y:a.p[1]-cen[1],z:a.p[2]-cen[2]}));
  const bo=g.bo.filter(b=>idx[b[0]]!==undefined&&idx[b[1]]!==undefined).map(b=>[idx[b[0]],idx[b[1]],b[2]]);
  const rad=a=>RAD[a.el]||.6;
  const Rh=Math.max(...P.map(a=>Math.hypot(a.x,a.z)+rad(a))),Rv=Math.max(...P.map(a=>Math.abs(a.y)+Math.hypot(a.x,a.z)*.45+rad(a)));
  return{at:P,bo,Rh,Rv};
}

function mount(cv,mol,opt={}){
  const o=Object.assign({spin:true,drag:true,labels:false,still:false,pad:.9},opt),ctx=cv.getContext('2d');
  let G=geometry(mol),yaw=.7,pit=.32,dirty=true,drag=null,idleUntil=0,w=0,h=0,dpr=1;
  const spin=()=>o.spin&&!o.still&&!reduced;
  const v={cv,
    active(){return cv.offsetParent!==null&&(dirty||(spin()&&!drag&&performance.now()>idleUntil))},
    frame(dt){if(spin()&&!drag&&performance.now()>idleUntil)yaw+=dt*.00045;draw();dirty=false},
    set(m){G=geometry(m);dirty=true;kick()},
    redraw(){dirty=true;kick()},
    destroy(){views.delete(v);ro&&ro.disconnect()}};
  function size(){
    const r=cv.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);
    const W=Math.round(r.width),H=Math.round(r.height);
    if(W&&H&&(cv.width!==W*dpr||cv.height!==H*dpr)){cv.width=W*dpr;cv.height=H*dpr}
    w=W;h=H;
  }
  function draw(){
    size();if(!w||!h||!G.at.length)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const cy_=Math.cos(yaw),sy_=Math.sin(yaw),cp=Math.cos(pit),sp=Math.sin(pit),D=22;
    const sc=Math.min((w/2)/(G.Rh+.15),(h/2)/(G.Rv+.15))*o.pad*1.0;
    const P=G.at.map(a=>{
      const x1=a.x*cy_+a.z*sy_,z1=-a.x*sy_+a.z*cy_,y2=a.y*cp-z1*sp,z2=a.y*sp+z1*cp,k=D/(D-z2);
      return{x:w/2+x1*sc*k,y:h/2-y2*sc*k,z:z2,k,el:a.el,r:(RAD[a.el]||.6)*sc*k*.82}});
    const items=[];
    G.bo.forEach(([i,j,ord])=>{const a=P[i],b=P[j];items.push({z:(a.z+b.z)/2-.01,f:()=>bond(a,b,ord,sc)})});
    P.forEach(a=>items.push({z:a.z,f:()=>atom(a)}));
    items.sort((p,q)=>p.z-q.z).forEach(it=>it.f());
  }
  function bond(a,b,ord,sc){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,k=(a.k+b.k)/2,lw=Math.max(1.5,sc*k*.14);
    const offs=ord==1?[0]:ord==2?[-.6,.6]:[-1.1,0,1.1],thin=ord==1?1:.62;
    ctx.lineCap='round';
    offs.forEach(f=>{
      const ox=nx*lw*f*1.15,oy=ny*lw*f*1.15,g=ctx.createLinearGradient(a.x+ox,a.y+oy,b.x+ox,b.y+oy);
      g.addColorStop(0,'#aeb8c9');g.addColorStop(.5,'#8794ab');g.addColorStop(1,'#aeb8c9');
      ctx.strokeStyle=g;ctx.lineWidth=lw*thin;ctx.beginPath();ctx.moveTo(a.x+ox,a.y+oy);ctx.lineTo(b.x+ox,b.y+oy);ctx.stroke()});
  }
  function atom(a){
    const c=COL[a.el]||COL.C,g=ctx.createRadialGradient(a.x-a.r*.35,a.y-a.r*.4,a.r*.08,a.x,a.y,a.r);
    g.addColorStop(0,c[0]);g.addColorStop(.55,c[1]);g.addColorStop(1,c[2]);
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,7);ctx.fill();
    if(o.labels&&a.r>11){ctx.fillStyle=TXT[a.el]||'#fff';ctx.font='700 '+Math.round(a.r*.95)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(a.el,a.x,a.y+1)}
  }
  let ro=null;
  if(window.ResizeObserver){ro=new ResizeObserver(()=>{dirty=true;kick()});ro.observe(cv)}
  if(o.drag&&!o.still){
    cv.style.touchAction='none';cv.style.cursor='grab';
    cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing'});
    cv.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.012;pit=Math.max(-1.2,Math.min(1.2,pit+(e.clientY-drag.y)*.012));drag={x:e.clientX,y:e.clientY};dirty=true;kick()});
    const up=()=>{if(drag){drag=null;idleUntil=performance.now()+1800;cv.style.cursor='grab';kick()}};
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  }
  views.add(v);kick();return v;
}
window.Mini3D={mount};
})();