/* MoldCheck 사이트 — 고정 화면 + 스크롤 연동 3D 소개 (three.js r128)
   순서: 점으로 된 몰드베이스 → 흩어짐 → 2D 부품도 → 3D 판·몰드베이스(판 역할, 홀 종류) → 규격 대조(오류 홀) → 주석·수정.
   화면의 판·홀·수치는 아래 "30초 체험" 구간과 같은 설명용 예시다 (고정측 형판 400 × 250 × 60, 홀 12개 + 냉각수로).
   WebGL 을 못 쓰거나 '동작 줄이기' 설정이면 아무 것도 하지 않는다 → CSS 의 정적 배치(글 + 4단계 카드)가 그대로 보인다. */
(function(){
'use strict';
var doc=document, html=doc.documentElement;
function off(){ if(window.__storyStatic) window.__storyStatic();          // head 의 정리 함수: 클래스·인라인 값을 걷고, 보던 자리를 맞춘다
  else { html.classList.remove('story-on'); html.classList.remove('story-ready'); window.__storyOff=true; } }
function boot(){
var root=doc.getElementById('story');
if(!root){ off(); return; }
if(window.__storyOff||!html.classList.contains('story-on')) return;          // head 의 사전 검사에서 정적 모드로 결정됨
var THREE=window.THREE; if(!THREE){ off(); return; }
var stage=doc.getElementById('stStage'), canvas=doc.getElementById('stCanvas');
var renderer;
try{ renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true,powerPreference:'high-performance'}); }
catch(e){ off(); return; }
renderer.setClearColor(0x000000,0);

// ---------- 유틸 ----------
function clamp01(x){ return x<0?0:x>1?1:x; }
function seg01(p,a,b){ return clamp01((p-a)/(b-a)); }
function sm(t){ return t*t*(3-2*t); }
function eio(t){ return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
function eout(t){ return 1-Math.pow(1-t,3); }
function eback(t){ var c1=1.4,c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); }
function lerp(a,b,t){ return a+(b-a)*t; }
function vis(p,a,b,f){ f=f||.026; return sm(seg01(p,a,a+f))*(1-sm(seg01(p,b-f,b))); }
var seed=20261006; function rnd(){ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }   // 결정적 난수 — 매번 같은 모양
function $(id){ return doc.getElementById(id); }

var COL={ink:0xF5F4EF,soft:0xC9C4B8,mute:0x8A867D,acc:0xD97757,gold:0xC4A56A,blue:0x5BA7DD,green:0x5CC48E,cyan:0x6FB3E6,err:0xE5484D,ok:0x5CC48E};
function css(c){ return '#'+('000000'+c.toString(16)).slice(-6); }

// ---------- 예시 부품: 고정측 형판 400 × 250 × 60 (아래 체험 구간과 같은 판) ----------
var PW=400, PD=250, PT=60, CBD=6.5;
function X(u){ return u-PW/2; } function Z(v){ return v-PD/2; }
// 세로 홀 11개 (번호·규격·위치는 체험 구간과 동일). #4 = 카운터보어 지름 부족(Ø9.5 < 볼트 머리 Ø10) — 이야기의 오류 홀
var HOLES=[
 {id:1,u:40, v:40, d:6.6, cb:11,  t:'cb'}, {id:2,u:360,v:40, d:6.6, cb:11, t:'cb'},
 {id:3,u:360,v:210,d:6.6, cb:11,  t:'cb'}, {id:4,u:40, v:210,d:6.6, cb:9.5,t:'cb',bad:true},
 {id:5,u:120,v:80, d:8.5, maj:10, dep:9,  t:'tap'}, {id:6,u:200,v:80, d:8.5, maj:10, dep:15, t:'tap'},
 {id:7,u:280,v:80, d:11,  t:'clr'}, {id:8,u:200,v:125,d:10, t:'ej'},
 {id:9,u:130,v:170,d:13.5,t:'clr'}, {id:10,u:270,v:170,d:10.2,t:'clr'}, {id:11,u:392,v:125,d:6, t:'clr'}];
var BAD=HOLES[3];
var H12={u:100, v0:0, v1:200, d:8, z:45};      // #12 횡 심공 Ø8 × 200 (뒷면에서 드릴)
var COOL={v:117, d:12, z:30};                   // 냉각수로 Ø12 · Z30 — #8 이젝터핀 홀과 겹친다(수로-홀 간섭)
var TCOL={cb:COL.gold,tap:COL.blue,clr:COL.soft,ej:COL.green,cool:COL.cyan};

// 몰드베이스 판 구성 (고정측 형판 윗면 = y 0, 아래로 −). ex = 분해 보기에서의 이동량
var PARTS=[
 {k:'tcp',name:'고정측 설치판',  w:400,h:30,d:300,top:30,  ex:70,  z:0,   fly:240,  order:5},
 {k:'a',  name:'고정측 형판',    w:400,h:60,d:250,top:0,   ex:0,   z:0,   fly:0,    order:0},
 {k:'b',  name:'가동측 형판',    w:400,h:50,d:250,top:-60, ex:-30, z:0,   fly:-200, order:1},
 {k:'sup',name:'받침판',         w:400,h:40,d:250,top:-110,ex:-55, z:0,   fly:-220, order:2},
 {k:'sp1',name:'스페이서 블록',  w:400,h:80,d:48, top:-150,ex:-80, z:101, fly:-240, order:3},
 {k:'sp2',name:null,             w:400,h:80,d:48, top:-150,ex:-80, z:-101,fly:-240, order:3},
 {k:'ejr',name:'이젝터 플레이트',w:400,h:15,d:148,top:-195,ex:-150,z:0,   fly:-260, order:4},
 {k:'ejb',name:null,             w:400,h:20,d:148,top:-210,ex:-150,z:0,   fly:-260, order:4},
 {k:'bcp',name:'가동측 설치판',  w:400,h:30,d:300,top:-230,ex:-185,z:0,   fly:-280, order:6}];

// ---------- 2D 부품도 (XZ 평면, y=0) ----------
var MAIN=[],HID=[],CTR=[],DIM=[],TXT=[];
function S(a,x1,z1,x2,z2){ a.push(x1,z1,x2,z2); }
function arc(a,cx,cz,r,a0,a1){ var n=Math.min(72,Math.max(12,Math.ceil(Math.abs(a1-a0)*r/1.5))); for(var i=0;i<n;i++){ var t0=a0+(a1-a0)*i/n,t1=a0+(a1-a0)*(i+1)/n; a.push(cx+r*Math.cos(t0),cz+r*Math.sin(t0),cx+r*Math.cos(t1),cz+r*Math.sin(t1)); } }
function dash(a,x1,z1,x2,z2,pat){ var L=Math.hypot(x2-x1,z2-z1),dx=(x2-x1)/L,dz=(z2-z1)/L,d=0,i=0; while(d<L-1e-6){ var e=Math.min(L,d+pat[i%pat.length]); if(i%2===0) a.push(x1+dx*d,z1+dz*d,x1+dx*e,z1+dz*e); d=e; i++; } }
function tick(x,z){ S(DIM,x-2.6,z+2.6,x+2.6,z-2.6); }
function dimH(x1,x2,zFrom,zd,label){ var s=zd>zFrom?1:-1; S(DIM,x1,zFrom+s*3,x1,zd+s*4); S(DIM,x2,zFrom+s*3,x2,zd+s*4); S(DIM,x1,zd,x2,zd); tick(x1,zd); tick(x2,zd); TXT.push({s:label,x:(x1+x2)/2,z:zd-6.2,h:8.5,rot:0,al:'c',c:COL.gold}); }
function dimV(z1,z2,xFrom,xd,label){ var s=xd>xFrom?1:-1; S(DIM,xFrom+s*3,z1,xd+s*4,z1); S(DIM,xFrom+s*3,z2,xd+s*4,z2); S(DIM,xd,z1,xd,z2); tick(xd,z1); tick(xd,z2); TXT.push({s:label,x:xd-6.2,z:(z1+z2)/2,h:8.5,rot:1,al:'c',c:COL.gold}); }
(function buildDrawing(){
  var x0=X(0),x1=X(PW),z0=Z(0),z1=Z(PD), TAU=Math.PI*2, i,h,e;
  S(MAIN,x0,z0,x1,z0); S(MAIN,x1,z0,x1,z1); S(MAIN,x1,z1,x0,z1); S(MAIN,x0,z1,x0,z0);
  for(i=0;i<HOLES.length;i++){ h=HOLES[i];
    arc(MAIN,X(h.u),Z(h.v),h.d/2,0,TAU);
    if(h.cb) arc(MAIN,X(h.u),Z(h.v),h.cb/2,0,TAU);
    if(h.maj) arc(MAIN,X(h.u),Z(h.v),h.maj/2,Math.PI*.5,Math.PI*2);            // 탭: 호칭 지름 3/4 원호
    e=(h.cb||h.maj||h.d)/2+4.5; S(CTR,X(h.u)-e,Z(h.v),X(h.u)+e,Z(h.v)); S(CTR,X(h.u),Z(h.v)-e,X(h.u),Z(h.v)+e); }
  // 냉각수로 (숨은선) + 중심선
  dash(HID,x0,Z(COOL.v-COOL.d/2),x1,Z(COOL.v-COOL.d/2),[7,3.5]); dash(HID,x0,Z(COOL.v+COOL.d/2),x1,Z(COOL.v+COOL.d/2),[7,3.5]);
  dash(CTR,x0-9,Z(COOL.v),x1+9,Z(COOL.v),[15,3,2.5,3]);
  // #12 횡 심공 (숨은선)
  dash(HID,X(H12.u-H12.d/2),Z(H12.v0),X(H12.u-H12.d/2),Z(H12.v1),[7,3.5]); dash(HID,X(H12.u+H12.d/2),Z(H12.v0),X(H12.u+H12.d/2),Z(H12.v1),[7,3.5]);
  S(HID,X(H12.u-H12.d/2),Z(H12.v1),X(H12.u),Z(H12.v1)+2.4); S(HID,X(H12.u+H12.d/2),Z(H12.v1),X(H12.u),Z(H12.v1)+2.4);
  dash(CTR,X(H12.u),Z(H12.v0)-9,X(H12.u),Z(H12.v1)+9,[15,3,2.5,3]);
  // 치수
  dimH(x0,x1,z1,z1+34,'400'); dimV(z0,z1,x1,x1+34,'250');
  dimH(x0,X(40),z0,z0-20,'40'); dimH(X(40),X(360),z0,z0-20,'320'); dimH(X(360),x1,z0,z0-20,'40');
  dimV(z0,Z(40),x0,x0-20,'40'); dimV(Z(40),Z(210),x0,x0-20,'170'); dimV(Z(210),z1,x0,x0-20,'40');
  // 지시선 + 주기 (오류 홀 #4 의 주기는 도면에 그대로 적혀 있다 — 사람 눈에는 잘 안 띈다)
  S(DIM,X(360)-4.2,Z(40)-4.2,X(342),Z(26)); S(DIM,X(342),Z(26),X(254),Z(26)); TXT.push({s:'3-M6 C.B Ø11×6.5',x:X(340),z:Z(26)-5.6,h:7.6,rot:0,al:'r',c:COL.gold});
  S(DIM,X(40)+3.6,Z(210)+3.6,X(56),Z(228)); S(DIM,X(56),Z(228),X(138),Z(228)); TXT.push({s:'M6 C.B Ø9.5×6.5',x:X(58),z:Z(228)-5.6,h:7.6,rot:0,al:'l',c:COL.gold});
  S(DIM,X(200)+3.4,Z(80)-3.6,X(212),Z(64)); S(DIM,X(212),Z(64),X(262),Z(64)); TXT.push({s:'2-M10 TAP',x:X(214),z:Z(64)-5.6,h:7.6,rot:0,al:'l',c:COL.gold});
  TXT.push({s:'Ø12 냉각수로',x:X(300),z:Z(COOL.v-COOL.d/2)-6,h:7.6,rot:0,al:'l',c:COL.cyan});
  TXT.push({s:'고정측 형판  400 × 250 × 60',x:x0,z:z1+66,h:10,rot:0,al:'l',c:COL.ink});
})();

// ---------- 장면 ----------
var scene=new THREE.Scene();
var camera=new THREE.PerspectiveCamera(30,1,5,9000);
scene.add(new THREE.HemisphereLight(0xffffff,0x24211d,.62));
var key=new THREE.DirectionalLight(0xffffff,.5); key.position.set(-300,640,560); scene.add(key);
var rim=new THREE.DirectionalLight(0xffb89a,.22); rim.position.set(520,180,-460); scene.add(rim);

// --- 선: 굵기를 화면 픽셀로 정한다 (GL 기본 선은 1 기기픽셀이라 고해상도 화면에서 너무 가늘다) ---
var fatMats=[];
function fatLines(a3,color,wpx,op){ // a3: [x1,y1,z1, x2,y2,z2, ...]
  var n=a3.length/6, A=new Float32Array(n*12), B=new Float32Array(n*12), Sd=new Float32Array(n*8), idx=new (n*4>65535?Uint32Array:Uint16Array)(n*6), i, k, o;
  for(i=0;i<n;i++){ for(k=0;k<4;k++){ o=(i*4+k)*3; A[o]=a3[i*6]; A[o+1]=a3[i*6+1]; A[o+2]=a3[i*6+2]; B[o]=a3[i*6+3]; B[o+1]=a3[i*6+4]; B[o+2]=a3[i*6+5]; Sd[(i*4+k)*2]=k>>1; Sd[(i*4+k)*2+1]=(k&1)?1:-1; }
    idx[i*6]=i*4; idx[i*6+1]=i*4+1; idx[i*6+2]=i*4+2; idx[i*6+3]=i*4+2; idx[i*6+4]=i*4+1; idx[i*6+5]=i*4+3; }
  var g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(A,3)); g.setAttribute('aB',new THREE.BufferAttribute(B,3)); g.setAttribute('aS',new THREE.BufferAttribute(Sd,2)); g.setIndex(new THREE.BufferAttribute(idx,1));
  var m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uRes:{value:new THREE.Vector2(1,1)},uW:{value:wpx},uCol:{value:new THREE.Color(color)},opacity:{value:0}},
    vertexShader:'uniform vec2 uRes; uniform float uW; attribute vec3 aB; attribute vec2 aS; void main(){ vec4 a=projectionMatrix*modelViewMatrix*vec4(position,1.0); vec4 b=projectionMatrix*modelViewMatrix*vec4(aB,1.0); vec2 d=(b.xy/b.w-a.xy/a.w)*uRes; float l=length(d); d=l>1e-5?d/l:vec2(1.0,0.0); vec4 p=mix(a,b,aS.x); p.xy+=vec2(-d.y,d.x)*aS.y*uW/uRes*p.w; gl_Position=p; }',
    fragmentShader:'uniform vec3 uCol; uniform float opacity; void main(){ gl_FragColor=vec4(uCol,opacity); }'});
  m.userData.op=op; m.userData.w=wpx; fatMats.push(m);
  Object.defineProperty(m,'opacity',{get:function(){ return m.uniforms.opacity.value; },set:function(v){ m.uniforms.opacity.value=v; }});
  var mesh=new THREE.Mesh(g,m); mesh.frustumCulled=false; mesh.userData.n=n; return mesh; }
function to3(a,y){ var o=[]; for(var i=0;i<a.length;i+=4) o.push(a[i],y,a[i+1],a[i+2],y,a[i+3]); return o; }
// --- 부품도 선 ---
var dwg=new THREE.Group(); dwg.position.y=.4; scene.add(dwg);
function lineObj(a,color,w,op){ var o=fatLines(to3(a,0),color,w,op); dwg.add(o); return o; }
var lMain=lineObj(MAIN,COL.ink,1.5,1), lHid=lineObj(HID,COL.mute,1.1,.95), lCtr=lineObj(CTR,COL.acc,1,.8), lDim=lineObj(DIM,COL.gold,1,.9);
var texts=[];
function textPlane(t){ var c=doc.createElement('canvas'), tex=new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter; tex.generateMipmaps=false;
  var mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  var mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat); mesh.rotation.set(-Math.PI/2,0,t.rot?Math.PI/2:0); mesh.frustumCulled=false; dwg.add(mesh);
  function paint(){ var px=56, g=c.getContext('2d'), font='500 '+px+'px "IBM Plex Mono","IBM Plex Sans KR","Malgun Gothic",monospace'; g.font=font;
    var w=Math.ceil(g.measureText(t.s).width)+12, hgt=Math.ceil(px*1.3); c.width=w; c.height=hgt; g=c.getContext('2d'); g.font=font; g.textBaseline='middle'; g.fillStyle=css(t.c); g.fillText(t.s,6,hgt/2+2);
    var hm=t.h*1.3, wm=hm*w/hgt; mesh.scale.set(wm,hm,1);
    var off=t.al==='l'?wm/2:t.al==='r'?-wm/2:0; if(t.rot) mesh.position.set(t.x,0,t.z-off); else mesh.position.set(t.x+off,0,t.z);
    tex.needsUpdate=true; }
  paint(); texts.push({mesh:mesh,mat:mat,paint:paint}); }
TXT.forEach(textPlane);
if(doc.fonts&&doc.fonts.ready) doc.fonts.ready.then(function(){ texts.forEach(function(t){ t.paint(); }); if(KEYS&&!window.__storyOff) buildKeys(); need=true; });   // 글꼴이 늦게 오면 글 높이가 바뀐다 → 자리도 다시 잰다

// --- 판(솔리드) ---
function steel(c){ return new THREE.MeshLambertMaterial({color:c,transparent:true,opacity:0,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}); }
function edgesOf(geom,ang){ var p=new THREE.EdgesGeometry(geom,ang).attributes.position.array; return Array.prototype.slice.call(p); }
function plateShape(rad){ var s=new THREE.Shape(); s.moveTo(-PW/2,-PD/2); s.lineTo(PW/2,-PD/2); s.lineTo(PW/2,PD/2); s.lineTo(-PW/2,PD/2); s.lineTo(-PW/2,-PD/2);
  for(var i=0;i<HOLES.length;i++){ var p=new THREE.Path(); p.absarc(X(HOLES[i].u),Z(HOLES[i].v),rad[i],0,Math.PI*2,true); s.holes.push(p); } return s; }
function slab(rad,depth,y){ var g=new THREE.ExtrudeGeometry(plateShape(rad),{depth:depth,bevelEnabled:false,curveSegments:22}); g.rotateX(Math.PI/2); g.translate(0,y,0); return g; }
var model=new THREE.Group(); scene.add(model);
var parts={};
PARTS.forEach(function(P){
  var g=new THREE.Group(), mat=steel(P.k==='a'?0xBCC2C9:0x99A0A8), eop=P.k==='a'?.6:.36, mesh, e, em;
  if(P.k==='a'){
    var rTop=HOLES.map(function(h){ return (h.cb||h.d)/2; }), rFix=HOLES.map(function(h){ return h.bad?5.5:(h.cb||h.d)/2; }), rLow=HOLES.map(function(h){ return h.d/2; });
    var l1a=new THREE.Mesh(slab(rTop,CBD,0),mat), l1b=new THREE.Mesh(slab(rFix,CBD,0),mat), l2=new THREE.Mesh(slab(rLow,PT-CBD,-CBD),mat);
    l1b.visible=false; g.add(l1a); g.add(l1b); g.add(l2); P.l1a=l1a; P.l1b=l1b;
    // 모서리선 (직접 만든다 — 두 층 사이 이음선이 보이지 않게)
    var a=[], x0=-PW/2,x1=PW/2,z0=-PD/2,z1=PD/2;
    var E=function(ax,ay,az,bx,by,bz){ a.push(ax,ay,az,bx,by,bz); };
    [0,-PT].forEach(function(y){ E(x0,y,z0,x1,y,z0); E(x1,y,z0,x1,y,z1); E(x1,y,z1,x0,y,z1); E(x0,y,z1,x0,y,z0); });
    E(x0,0,z0,x0,-PT,z0); E(x1,0,z0,x1,-PT,z0); E(x1,0,z1,x1,-PT,z1); E(x0,0,z1,x0,-PT,z1);
    var ring=function(cx,cz,r,y){ var n=40; for(var i=0;i<n;i++){ var t0=i/n*Math.PI*2,t1=(i+1)/n*Math.PI*2; E(cx+r*Math.cos(t0),y,cz+r*Math.sin(t0),cx+r*Math.cos(t1),y,cz+r*Math.sin(t1)); } };
    HOLES.forEach(function(h){ if(!h.bad) ring(X(h.u),Z(h.v),(h.cb||h.d)/2,0); if(h.cb) ring(X(h.u),Z(h.v),h.d/2,-CBD); });
    e=fatLines(a,COL.ink,1,eop); em=e.material; g.add(e);
    // 옆면에 뚫린 횡 홀(#12)·냉각수로 입구: 어두운 원판으로 표시
    var dark=new THREE.MeshBasicMaterial({color:0x0B0A09,transparent:true,opacity:0}); P.dark=dark;
    var d1=new THREE.Mesh(new THREE.CircleGeometry(H12.d/2,28),dark); d1.position.set(X(H12.u),-H12.z,-PD/2-.06); d1.rotation.y=Math.PI; g.add(d1);
    var d2=new THREE.Mesh(new THREE.CircleGeometry(COOL.d/2,28),dark); d2.position.set(-PW/2-.06,-COOL.z,Z(COOL.v)); d2.rotation.y=-Math.PI/2; g.add(d2);
    var d3=new THREE.Mesh(new THREE.CircleGeometry(COOL.d/2,28),dark); d3.position.set(PW/2+.06,-COOL.z,Z(COOL.v)); d3.rotation.y=Math.PI/2; g.add(d3);
  } else {
    mesh=new THREE.Mesh(new THREE.BoxGeometry(P.w,P.h,P.d),mat); mesh.position.set(0,-P.h/2,P.z); g.add(mesh);
    var ea=edgesOf(mesh.geometry,1);
    if(P.k==='tcp'){ // 로케이트 링 (위쪽 설치판의 표식)
      var rs=new THREE.Shape(); rs.absarc(0,0,50,0,Math.PI*2,false); var rh=new THREE.Path(); rh.absarc(0,0,18,0,Math.PI*2,true); rs.holes.push(rh);
      var rg=new THREE.ExtrudeGeometry(rs,{depth:8,bevelEnabled:false,curveSegments:40}); rg.rotateX(-Math.PI/2);
      var rm=new THREE.Mesh(rg,mat); g.add(rm); var ra=edgesOf(rg,30); for(var ri=0;ri<ra.length;ri+=3){ ea.push(ra[ri],ra[ri+1]+P.h/2,ra[ri+2]-P.z); } }
    e=fatLines(ea,COL.ink,1,eop); e.position.copy(mesh.position); em=e.material; g.add(e);
  }
  g.visible=false; model.add(g); P.g=g; P.mat=mat; P.em=em; parts[P.k]=P;
});
var A=parts.a;

// --- 홀 종류 표시: 윗면 고리 + 투시 체적 ---
var typeGroup=new THREE.Group(); A.g.add(typeGroup);
var typeItems=[];
function xrayMat(c){ return new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0,depthTest:false,depthWrite:false}); }
HOLES.forEach(function(h,i){ var c=TCOL[h.t], rT=(h.cb||h.maj||h.d)/2;
  var rm=new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
  var ring=new THREE.Mesh(new THREE.RingGeometry(rT+1.3,rT+3.5,44),rm); ring.rotation.x=-Math.PI/2; ring.position.set(X(h.u),.3,Z(h.v)); ring.renderOrder=5; typeGroup.add(ring);
  var vm=xrayMat(c), len=h.dep||PT, cyl=new THREE.Mesh(new THREE.CylinderGeometry(h.d/2,h.d/2,len,24),vm); cyl.position.set(X(h.u),-len/2,Z(h.v)); cyl.renderOrder=4; typeGroup.add(cyl);
  if(h.cb){ var cc=new THREE.Mesh(new THREE.CylinderGeometry(h.cb/2,h.cb/2,CBD,24),vm); cc.position.set(X(h.u),-CBD/2,Z(h.v)); cc.renderOrder=4; typeGroup.add(cc); }
  typeItems.push({h:h,ring:ring,rm:rm,vm:vm,i:i}); });
(function(){ // 횡 심공 #12, 냉각수로
  var m12=xrayMat(TCOL.clr), L=H12.v0-H12.v1, c12=new THREE.Mesh(new THREE.CylinderGeometry(H12.d/2,H12.d/2,L,20),m12); c12.rotation.x=Math.PI/2; c12.position.set(X(H12.u),-H12.z,Z((H12.v0+H12.v1)/2)); c12.renderOrder=4; typeGroup.add(c12);
  typeItems.push({h:{t:'clr'},ring:null,rm:null,vm:m12,i:11});
  var mc=xrayMat(TCOL.cool), cc=new THREE.Mesh(new THREE.CylinderGeometry(COOL.d/2,COOL.d/2,PW,24),mc); cc.rotation.z=Math.PI/2; cc.position.set(0,-COOL.z,Z(COOL.v)); cc.renderOrder=4; typeGroup.add(cc);
  typeItems.push({h:{t:'cool'},ring:null,rm:null,vm:mc,i:12}); })();
var badItem=typeItems[3];
// 오류 홀 #4 의 윗면 테두리 (지름 9.5 → 11 로 넓어진다)
var badRim=(function(){ var n=48,a=[]; for(var i=0;i<n;i++){ var t0=i/n*Math.PI*2,t1=(i+1)/n*Math.PI*2; a.push(Math.cos(t0),0,Math.sin(t0),Math.cos(t1),0,Math.sin(t1)); }
  var o=fatLines(a,COL.ink,1,.6); o.position.set(X(BAD.u),.05,Z(BAD.v)); A.g.add(o); return o; })();
// 강조 고리(맥박)
var pulse=(function(){ var m=new THREE.MeshBasicMaterial({color:COL.err,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}); var o=new THREE.Mesh(new THREE.RingGeometry(.86,1,56),m); o.rotation.x=-Math.PI/2; o.position.set(X(BAD.u),.35,Z(BAD.v)); o.renderOrder=6; A.g.add(o); return o; })();

// --- 볼트 M6 (머리 Ø10 × 6, ISO 4762) ---
var bolt=new THREE.Group(); A.g.add(bolt); bolt.position.set(X(BAD.u),60,Z(BAD.v));
var boltMat=new THREE.MeshStandardMaterial({color:0x565C64,metalness:.35,roughness:.5,transparent:true,opacity:0,emissive:COL.err,emissiveIntensity:0});
(function(){ var pts=[[0,6],[4.35,6],[5,5.35],[5,0],[3,0],[3,-26],[2.6,-27],[0,-27]].map(function(p){ return new THREE.Vector2(p[0],p[1]); });
  bolt.add(new THREE.Mesh(new THREE.LatheGeometry(pts,44),boltMat));
  var sm2=new THREE.MeshBasicMaterial({color:0x08080A,transparent:true,opacity:0}); bolt.userData.sock=sm2;
  var s=new THREE.Mesh(new THREE.CircleGeometry(2.9,6),sm2); s.rotation.x=-Math.PI/2; s.position.y=6.04; bolt.add(s); })();

// --- 바닥 그림자 ---
var shadow=(function(){ var c=doc.createElement('canvas'); c.width=c.height=128; var g=c.getContext('2d'), gr=g.createRadialGradient(64,64,6,64,64,64); gr.addColorStop(0,'rgba(0,0,0,.85)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128);
  var m=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,opacity:0,depthWrite:false}); var o=new THREE.Mesh(new THREE.PlaneGeometry(900,720),m); o.rotation.x=-Math.PI/2; scene.add(o); return o; })();

// --- 점(파티클): P0 몰드베이스 → P1 흩어짐 → P2 부품도 ---
var points, pMat;
(function buildPoints(){
  var small=Math.min(innerWidth,innerHeight)<700;
  var c0=[], c2=[], i, k;                                  // [x,y,z,size,alpha,accent]
  // P0: 닫힌 몰드베이스의 모서리 + 보이는 면의 점 격자
  var es=small?6.5:4.6, fs=small?17:13;
  PARTS.forEach(function(P){ var x0=-P.w/2,x1=P.w/2,y1=P.top,y0=P.top-P.h,z0=P.z-P.d/2,z1=P.z+P.d/2, n,t, u,v;
    var edge=function(ax,ay,az,bx,by,bz){ var L=Math.hypot(bx-ax,by-ay,bz-az), ac=(ay===-PT&&by===-PT)?1:0; n=Math.max(2,Math.round(L/es)); for(k=0;k<=n;k++){ t=k/n; c0.push([ax+(bx-ax)*t,ay+(by-ay)*t,az+(bz-az)*t,2.5,1,ac]); } };   // 파팅 라인(형판 사이)은 강조색
    [y0,y1].forEach(function(y){ edge(x0,y,z0,x1,y,z0); edge(x1,y,z0,x1,y,z1); edge(x1,y,z1,x0,y,z1); edge(x0,y,z1,x0,y,z0); });
    edge(x0,y0,z0,x0,y1,z0); edge(x1,y0,z0,x1,y1,z0); edge(x1,y0,z1,x1,y1,z1); edge(x0,y0,z1,x0,y1,z1);
    var face=function(f){ var nu=Math.max(1,Math.round(f.lu/fs)), nv=Math.max(1,Math.round(f.lv/fs)); for(u=0;u<nu;u++) for(v=0;v<nv;v++){ var a=(u+.5)/nu, b=(v+.5)/nv; c0.push(f.at(a,b).concat([1.7,.55,0])); } };
    if(P.k==='tcp') face({lu:P.w,lv:P.d,at:function(a,b){ return [x0+P.w*a,y1,z0+P.d*b]; }});
    if(P.k!=='ejr'&&P.k!=='ejb'&&P.k!=='sp2') face({lu:P.w,lv:P.h,at:function(a,b){ return [x0+P.w*a,y0+P.h*b,z1]; }});
    face({lu:P.d,lv:P.h,at:function(a,b){ return [x0,y0+P.h*b,z0+P.d*a]; }}); });
  (function(){ var n,t; [50,18].forEach(function(r){ n=Math.round(2*Math.PI*r/3.2); for(k=0;k<n;k++){ t=k/n*Math.PI*2; c0.push([r*Math.cos(t),38.5,r*Math.sin(t),2.6,1,1]); } }); })();   // 로케이트 링 (강조색)
  for(i=0;i<(small?160:320);i++) c0.push([(rnd()-.5)*1500,(rnd()-.62)*760,(rnd()-.5)*1300,1.6+rnd()*1.6,.16+rnd()*.3,0]);          // 먼지
  // P2: 부품도 선 위의 점 + 모눈 점
  var N=c0.length, nLine=Math.round(N*.74), segs=[MAIN,HID,CTR,DIM], tot=0;
  segs.forEach(function(a){ for(i=0;i<a.length;i+=4) tot+=Math.hypot(a[i+2]-a[i],a[i+3]-a[i+1]); });
  var step=tot/nLine;
  segs.forEach(function(a,si){ for(i=0;i<a.length;i+=4){ var L=Math.hypot(a[i+2]-a[i],a[i+3]-a[i+1]), n=Math.max(1,Math.round(L/step)); for(k=0;k<n;k++){ var t=(k+.5)/n; c2.push([a[i]+(a[i+2]-a[i])*t,.4,a[i+1]+(a[i+3]-a[i+1])*t,si===0?1.9:1.5,si===0?1:.8,si===2?1:0]); } } });
  var gs=Math.sqrt(580*400/Math.max(1,N-c2.length));
  for(var gx=X(-80);gx<=X(500)&&c2.length<N;gx+=gs) for(var gz=Z(-70);gz<=Z(330)&&c2.length<N;gz+=gs) c2.push([gx,.2,gz,1.25,.2,0]);
  while(c2.length<N){ k=(rnd()*c2.length)|0; c2.push(c2[k].slice()); } c2.length=N;
  var sh=function(a){ for(var j=a.length-1;j>0;j--){ var r=(rnd()*(j+1))|0, t=a[j]; a[j]=a[r]; a[r]=t; } }; sh(c0); sh(c2);
  var p0=new Float32Array(N*3),p1=new Float32Array(N*3),p2=new Float32Array(N*3),misc=new Float32Array(N*4),look=new Float32Array(N*4);
  for(i=0;i<N;i++){ var a=c0[i], b=c2[i];
    p0[i*3]=a[0]; p0[i*3+1]=a[1]; p0[i*3+2]=a[2]; p2[i*3]=b[0]; p2[i*3+1]=b[1]; p2[i*3+2]=b[2];
    var th=rnd()*Math.PI*2, ph=Math.acos(2*rnd()-1), rr=Math.pow(rnd(),.45);
    p1[i*3]=(a[0]+b[0])*.5+Math.sin(ph)*Math.cos(th)*rr*640; p1[i*3+1]=-60+Math.cos(ph)*rr*330; p1[i*3+2]=(a[2]+b[2])*.5+Math.sin(ph)*Math.sin(th)*rr*520;
    misc[i*4]=rnd(); misc[i*4+1]=a[3]; misc[i*4+2]=b[3]; misc[i*4+3]=rnd();
    look[i*4]=a[4]; look[i*4+1]=b[4]; look[i*4+2]=a[5]; look[i*4+3]=b[5]; }
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(p0,3)); g.setAttribute('aP1',new THREE.BufferAttribute(p1,3)); g.setAttribute('aP2',new THREE.BufferAttribute(p2,3));
  g.setAttribute('aMisc',new THREE.BufferAttribute(misc,4)); g.setAttribute('aLook',new THREE.BufferAttribute(look,4));
  pMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
    uniforms:{uA:{value:0},uB:{value:0},uTime:{value:0},uScale:{value:1000},uOp:{value:1},uCol:{value:new THREE.Color(COL.ink)},uAcc:{value:new THREE.Color(COL.acc)}},
    vertexShader:[
      'uniform float uA,uB,uTime,uScale,uOp; attribute vec3 aP1,aP2; attribute vec4 aMisc,aLook; varying float vAl; varying float vAc;',
      'float ez(float t){ return t*t*(3.0-2.0*t); }',
      'void main(){ float s=aMisc.x; float a=ez(clamp((uA-s*0.42)/0.58,0.0,1.0)); float b=ez(clamp((uB-s*0.42)/0.58,0.0,1.0));',
      '  vec3 p=mix(position,aP1,a);',
      '  float sw=a*(1.0-b); p+=sw*vec3(sin(uTime*0.55+s*41.0),cos(uTime*0.47+s*29.0),sin(uTime*0.39+s*17.0))*30.0;',
      '  p=mix(p,aP2,b);',
      '  p.y+=(1.0-a)*sin(uTime*0.9+position.x*0.011+position.z*0.014)*1.4;',
      '  vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;',
      '  float tw=0.82+0.18*sin(uTime*1.3+aMisc.w*60.0);',
      '  gl_PointSize=max(1.3,mix(aMisc.y,aMisc.z,b)*uScale/-mv.z);',
      '  vAl=mix(aLook.x,aLook.y,b)*uOp*mix(tw,1.0,b); vAc=mix(aLook.z,aLook.w,b); }'].join('\n'),
    fragmentShader:[
      'uniform vec3 uCol,uAcc; varying float vAl; varying float vAc;',
      'void main(){ float d=length(gl_PointCoord-0.5); float m=smoothstep(0.5,0.3,d); if(m*vAl<0.012) discard; gl_FragColor=vec4(mix(uCol,uAcc,vAc),m*vAl); }'].join('\n')});
  points=new THREE.Points(g,pMat); points.frustumCulled=false; points.renderOrder=10; scene.add(points);
})();

// ---------- 화면 위 요소 ----------
var elVeil=doc.querySelector('#story .st-veil'), elHero=doc.querySelector('#story .st-hero-in'), capsIn=doc.querySelector('#story .st-caps-in'), caps=[].slice.call(doc.querySelectorAll('#story .st-cap')), elCard=$('stCard'), elNote=$('stNote'), elHint=$('stHint'), elDisc=doc.querySelector('#story .st-disc'),
    elRail=$('stRail'), railBtns=elRail?[].slice.call(elRail.querySelectorAll('[data-go]')):[], railBar=elRail?elRail.querySelector('.st-bar i'):null,
    leadCard=$('stLeadCard'), leadNote=$('stLeadNote'), leadDot=$('stDot'), elLabels=$('stLabels'), elSkip=doc.querySelector('#story .st-skip'),
    legend=[].slice.call(doc.querySelectorAll('#story .st-legend li')), chips=[].slice.call(doc.querySelectorAll('#story .st-chips li')), elBadge=$('stBadge');
var labels=[];
PARTS.forEach(function(P){ if(!P.name||!elLabels) return; var d=doc.createElement('div'); d.className='st-lab mono'; d.innerHTML='<i></i>'+P.name; elLabels.appendChild(d); labels.push({P:P,el:d}); });
function setO(el,o,ty,keep){ if(!el) return; o=o<.004?0:o>.996?1:o; var k=Math.round(o*250)+'|'+(ty===undefined?'':Math.round(ty*2)); if(el.__k===k) return; el.__k=k; el.style.opacity=o; if(!keep) el.style.visibility=o?'visible':'hidden'; if(ty!==undefined) el.style.setProperty('--ty',ty.toFixed(1)+'px'); }   // keep: 투명하게만 한다(숨기지 않는다) — 화면낭독기가 읽을 수 있게
function place(el,x,y){ el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)'; }

// ---------- 시간표 (p = 구간 진행률 0~1) ----------
var T={ heroOut:[.04,.10], scat:[.05,.155], conv:[.14,.235], lines:[.21,.26], dims:[.235,.285],
        cap:[[.19,.335],[.375,.60],[.63,.785],[.79,.94]],
        dimOut:[.325,.375], dwgOut:[.36,.42], rise:[.345,.41], asm:.42, ghost:[.505,.53], types:[.51,.565], labelsOut:[.585,.605],
        close:[.60,.65], tyOut:[.60,.64], bolt:[.655,.695], bad:[.685,.70], card:[.69,.72], note:[.775,.805], fix:[.82,.86], chips:.845,
        out:[.92,.945], back:[.925,.97], shut:[.94,1], end:[.955,1] };
var CH=[.295,.575,.745,.895];      // 단계별 '머무는' 위치 (옆 단계 버튼이 이동하는 곳)
var KEYS, NAVH=62, capH=[170,170,170,170], footH=78;
function buildKeys(){ var m=mobile, bt=[X(BAD.u)+2,2,Z(BAD.v)], k;
  for(k=0;k<caps.length;k++) capH[k]=caps[k].offsetHeight||170;      // 글 높이는 여기서 한 번만 잰다 (그릴 때마다 재면 느려진다)
  footH=capsIn?(parseFloat(getComputedStyle(capsIn).marginBottom)||78):78;
  if(!m){ KEYS=[
   {p:0,   az:-35,el:21,  t:[0,-115,0],  hw:265,hh:232, cx:.72,cy:.53, fx:.38,fy:.62},
   {p:.05, az:-35,el:21,  t:[0,-115,0],  hw:265,hh:232, cx:.72,cy:.53, fx:.38,fy:.62},
   {p:.215,az:0,  el:89.4,t:[16,0,14],   hw:272,hh:196, cx:.64,cy:.50, fx:.52,fy:.60},
   {p:.32, az:0,  el:89.4,t:[16,0,14],   hw:272,hh:196, cx:.64,cy:.50, fx:.52,fy:.60},
   {p:.43, az:-35,el:30,  t:[0,-172,0],  hw:262,hh:362, cx:.61,cy:.50, fx:.34,fy:.80},
   {p:.59, az:-37,el:30,  t:[0,-172,0],  hw:262,hh:362, cx:.61,cy:.50, fx:.34,fy:.80},
   {p:.68, az:-12,el:28,  t:bt,          hw:64, hh:40,  cx:.60,cy:.55, fx:.50,fy:.60},
   {p:.915,az:-5, el:26,  t:bt,          hw:64, hh:40,  cx:.60,cy:.55, fx:.50,fy:.60},
   {p:1,   az:-41,el:22,  t:[0,-115,0],  hw:265,hh:232, cx:.60,cy:.50, fx:.40,fy:.60}]; return; }
  // 모바일: 화면 높이와 글 줄 수가 기기마다 다르므로, 글·카드가 차지하고 남은 자리를 재서 그 한가운데에 모델을 둔다
  var foot=footH, ch=function(i){ return capH[i]; },
      reg=function(top,bot,k){ if(bot<top+80) bot=top+80; return {cy:(top+bot)/2/H, fy:Math.max(.12,(bot-top)*k/H)}; },
      heroBot=elHero?elHero.offsetHeight:H*.6, cardH=elCard?elCard.offsetHeight:180,
      g0=reg(heroBot+14,H-52,.94), g1=reg(NAVH+14,H-foot-ch(0)-18,.86), g2=reg(NAVH+4,H-foot-ch(1)-6,1),
      g3=reg(NAVH+6,H-foot-ch(2)-14-cardH-4,1), g4=reg(NAVH+70,H-foot-ch(3)-10,1), g5=reg(NAVH+24,H-40,.62);
  KEYS=[
   {p:0,   az:-35,el:21,  t:[0,-115,0],  hw:265,hh:232, cx:.5, cy:g0.cy, fx:.80,fy:g0.fy},
   {p:.05, az:-35,el:21,  t:[0,-115,0],  hw:265,hh:232, cx:.5, cy:g0.cy, fx:.80,fy:g0.fy},
   {p:.215,az:0,  el:89.4,t:[16,0,14],   hw:272,hh:196, cx:.5, cy:g1.cy, fx:.95,fy:g1.fy},
   {p:.32, az:0,  el:89.4,t:[16,0,14],   hw:272,hh:196, cx:.5, cy:g1.cy, fx:.95,fy:g1.fy},
   {p:.43, az:-35,el:30,  t:[0,-172,0],  hw:262,hh:362, cx:.5, cy:g2.cy, fx:.74,fy:g2.fy},
   {p:.59, az:-37,el:30,  t:[0,-172,0],  hw:262,hh:362, cx:.5, cy:g2.cy, fx:.74,fy:g2.fy},
   {p:.68, az:-12,el:28,  t:bt,          hw:64, hh:26,  cx:.46,cy:g3.cy, fx:.96,fy:g3.fy},
   {p:.765,az:-9.5,el:27.3,t:bt,         hw:64, hh:26,  cx:.46,cy:g3.cy, fx:.96,fy:g3.fy},
   {p:.805,az:-8.3,el:27, t:bt,          hw:64, hh:26,  cx:.46,cy:g4.cy, fx:.96,fy:g3.fy},   // 카드가 빠지고 주석이 들어올 자리를 낸다
   {p:.915,az:-5, el:26,  t:bt,          hw:64, hh:26,  cx:.46,cy:g4.cy, fx:.96,fy:g3.fy},
   {p:1,   az:-41,el:22,  t:[0,-115,0],  hw:265,hh:232, cx:.5, cy:g5.cy, fx:.80,fy:g5.fy}]; }
var W=1,H=1,mobile=false,need=true, tanF=Math.tan(15*Math.PI/180), cam={az:0,el:0,dist:1,tx:0,ty:0,tz:0,cx:.5,cy:.5};
function camAt(p,time){ var i=0; while(i<KEYS.length-2&&p>KEYS[i+1].p) i++; var a=KEYS[i], b=KEYS[i+1], t=eio(seg01(p,a.p,b.p)), asp=W/H;
  var da=Math.max(a.hh/(tanF*a.fy), a.hw/(tanF*asp*a.fx)), db=Math.max(b.hh/(tanF*b.fy), b.hw/(tanF*asp*b.fx));
  cam.az=lerp(a.az,b.az,t); cam.el=lerp(a.el,b.el,t); cam.dist=lerp(da,db,t); cam.tx=lerp(a.t[0],b.t[0],t); cam.ty=lerp(a.t[1],b.t[1],t); cam.tz=lerp(a.t[2],b.t[2],t); cam.cx=lerp(a.cx,b.cx,t); cam.cy=lerp(a.cy,b.cy,t);
  var hero=1-seg01(p,.02,.09), flat=Math.cos(cam.el*Math.PI/180);
  var az=(cam.az+Math.sin(time*.23)*6*hero+Math.sin(time*.31)*.9*flat+mx*2.6*flat)*Math.PI/180, el=(Math.min(89.4,cam.el+my*-1.4*flat))*Math.PI/180;
  camera.position.set(cam.tx+cam.dist*Math.cos(el)*Math.sin(az), cam.ty+cam.dist*Math.sin(el), cam.tz+cam.dist*Math.cos(el)*Math.cos(az));
  camera.up.set(0,1,0); camera.lookAt(cam.tx,cam.ty,cam.tz);
  camera.setViewOffset(W,H,(.5-cam.cx)*W,(.5-cam.cy)*H,W,H); camera.updateMatrixWorld(true); }
var V=new THREE.Vector3();
function proj(x,y,z){ V.set(x,y,z).project(camera); return [(V.x*.5+.5)*W,(-V.y*.5+.5)*H]; }

var mx=0,my=0,mxT=0,myT=0;
function R(p,r){ return seg01(p,r[0],r[1]); }
function update(p,time){
  var i,it,s,P;
  // --- 점 ---
  var outro=sm(R(p,T.end)), lines=sm(R(p,T.lines));
  pMat.uniforms.uA.value=outro>0?0:R(p,T.scat); pMat.uniforms.uB.value=outro>0?0:R(p,T.conv); pMat.uniforms.uTime.value=time;
  pMat.uniforms.uOp.value=outro>0?outro*.9:(1-.5*lines)*(1-sm(seg01(p,.33,.40)));
  points.visible=pMat.uniforms.uOp.value>.004;
  // --- 부품도 선·치수·글자 ---
  var dOut=1-sm(R(p,T.dwgOut)), dimIn=R(p,T.dims), dimOut=1-sm(R(p,T.dimOut));
  lMain.material.opacity=lines*dOut; lHid.material.opacity=lines*lHid.material.userData.op*dimOut; lCtr.material.opacity=lines*lCtr.material.userData.op*dimOut;
  lDim.material.opacity=lDim.material.userData.op*dimOut*(dimIn>0?1:0); lDim.geometry.setDrawRange(0,Math.floor(DIM.length/4*eout(dimIn))*6);
  for(i=0;i<texts.length;i++) texts[i].mat.opacity=sm(seg01(dimIn,.1+i*.04,.34+i*.04))*dimOut;
  dwg.visible=lines>0&&(dOut>0||dimOut>0);
  // --- 판 ---
  var rise=eout(R(p,T.rise)), ex=1-eio(R(p,T.shut)), close=sm(R(p,T.close)), back=sm(R(p,T.back)), ghost=sm(R(p,T.ghost))*(1-back), far=close*(1-back);
  for(i=0;i<PARTS.length;i++){ P=PARTS[i]; var base, mo, eo, y=P.top+P.ex*ex;
    if(P.k==='a'){ base=sm(seg01(p,T.rise[0],T.rise[0]+.03)); mo=base; eo=1; P.g.scale.y=Math.max(.002,rise); }
    else { var d0=T.asm+P.order*.008, tt=seg01(p,d0,d0+.042); base=sm(tt)*(1-far); y+=P.fly*(1-eout(tt)); mo=base*(P.k==='tcp'?1-.93*ghost:1); eo=P.k==='tcp'?1+.9*ghost:1; }
    P.g.position.y=y; P.g.visible=base>.004; P.mat.opacity=mo; P.em.opacity=Math.min(1,P.em.userData.op*base*eo); P.mat.depthWrite=mo>.6; if(P.dark) P.dark.opacity=mo; }
  shadow.position.y=-263-185*ex; shadow.material.opacity=.5*sm(seg01(p,T.asm+.02,T.asm+.09))*(1-far);
  // --- 홀 종류 (윗면 고리 + 투시 체적) ---
  var ty=R(p,T.types), tyOut=1-sm(R(p,T.tyOut)), fix=R(p,T.fix), badOn=sm(R(p,T.bad)), endOut=1-sm(R(p,T.out)), fx=eio(seg01(fix,.15,.6));
  for(i=0;i<typeItems.length;i++){ it=typeItems[i]; s=sm(seg01(ty,it.i*.05,it.i*.05+.3)); it.vm.opacity=.42*s*tyOut;
    if(it.rm){ it.rm.opacity=.95*s*(it===badItem?1:.2+.8*tyOut)*endOut; it.ring.scale.setScalar((.6+.4*eback(seg01(ty,it.i*.05,it.i*.05+.3)))*(it===badItem?lerp(1,(5.5+1.3)/(BAD.cb/2+1.3),fx):1)); } }
  // 오류 홀: 고리 색(종류색 → 빨강 → 초록), 테두리 지름 9.5 → 11, 맥박
  badItem.rm.color.setHex(fix>.5?COL.ok:(badOn>.5?COL.err:TCOL.cb));
  var rimR=lerp(BAD.cb/2,5.5,fx); badRim.scale.set(rimR,1,rimR); badRim.material.opacity=.6*A.mat.opacity;
  A.l1a.visible=fx<.5; A.l1b.visible=fx>=.5;
  var pu=(time*.9)%1, pOn=badOn*(1-seg01(fix,0,.2))*endOut; pulse.material.opacity=pOn*(1-pu)*.9; pulse.scale.setScalar(7+pu*13);
  // --- 볼트: 떨어져서 머리가 걸린다(Ø10 > Ø9.5) → 수정 후 자리에 앉는다 ---
  var bd=R(p,T.bolt), bo=sm(seg01(p,T.bolt[0],T.bolt[0]+.018))*endOut, seat=eio(seg01(fix,.3,1)), q=bd<.75?bd/.75:1, by=64*Math.pow(1-q,2);
  if(bd>=.75){ var w=(bd-.75)/.25; by=1.5*Math.sin(w*Math.PI)*(1-w); }
  bolt.position.y=by-CBD*seat; boltMat.opacity=bo; bolt.userData.sock.opacity=bo; bolt.visible=bo>.004;
  boltMat.emissiveIntensity=.42*badOn*(1-seg01(fix,.2,.7));
  // --- 카메라 ---
  camAt(p,time);
  // --- 화면 위 글 ---
  if(elVeil){ var vo=mobile?sm(seg01(p,.12,.19)):1; if(elVeil.__o!==vo){ elVeil.__o=vo; elVeil.style.opacity=vo; } }   // 모바일: 첫 화면에서는 아래쪽 가림막을 걷는다
  var ho=R(p,T.heroOut); setO(elHero,1-sm(ho),-40*ho);
  if(elHero) elHero.style.pointerEvents=p<T.heroOut[0]+.03?'auto':'none';
  setO(elHint,1-sm(seg01(p,.01,.035)));
  var veilH=0;
  for(i=0;i<caps.length;i++){ var c=T.cap[i], cv=vis(p,c[0],c[1]); setO(caps[i],cv,(1-sm(seg01(p,c[0],c[0]+.03)))*26,true); caps[i].style.pointerEvents=cv>.6?'auto':'none'; if(cv*capH[i]>veilH) veilH=cv*capH[i]; }
  if(mobile&&elVeil){ veilH=Math.round(footH+veilH); if(elVeil.__vh!==veilH){ elVeil.__vh=veilH; elVeil.style.setProperty('--vh',veilH+'px'); } }   // 모바일: 아래쪽 가림막을 지금 보이는 글 높이에 맞춘다 (글 뒤로 모델이 비치지 않게)
  for(i=0;i<legend.length;i++) setO(legend[i],sm(seg01(p,T.types[0]+.005+i*.005,T.types[0]+.027+i*.005)),undefined,true);
  for(i=0;i<chips.length;i++) setO(chips[i],sm(seg01(p,T.chips+i*.005,T.chips+.02+i*.005)),undefined,true);
  setO(elDisc,sm(seg01(p,.2,.24))*(1-sm(R(p,T.end))));
  setO(elSkip,sm(seg01(p,.02,.06))*(1-sm(seg01(p,.9,.95))));
  // 단계 표시
  var cur=p<(T.cap[0][1]+T.cap[1][0])/2?0:p<(T.cap[1][1]+T.cap[2][0])/2?1:p<(T.cap[2][1]+T.cap[3][0])/2?2:3, on=p>T.cap[0][0]-.02&&p<T.cap[3][1]+.02;
  setO(elRail,sm(seg01(p,T.cap[0][0]-.02,T.cap[0][0]+.02))*(1-sm(seg01(p,T.cap[3][1],T.cap[3][1]+.035))));
  for(i=0;i<railBtns.length;i++){ var act=on&&i===cur; if(railBtns[i].__on!==act){ railBtns[i].__on=act; railBtns[i].className=act?'on':''; railBtns[i].setAttribute('aria-current',act?'step':'false'); } }
  if(railBar) railBar.style.transform='scaleX('+seg01(p,T.cap[0][0],T.cap[3][1]).toFixed(3)+')';
  // 판 역할 이름표
  var lv=1-sm(R(p,T.labelsOut));
  if(elLabels){ var show=!mobile&&p>T.asm&&lv>.004; setO(elLabels,show?1:0);
    if(show) for(i=0;i<labels.length;i++){ var L=labels[i], Q=L.P, d1=T.asm+Q.order*.008+.03, qq=proj(Q.w/2,Q.g.position.y-Q.h/2,Q.z+Q.d/2); place(L.el,qq[0],qq[1]); L.el.style.opacity=(sm(seg01(p,d1,d1+.03))*lv).toFixed(3); } }
  // 속성 카드 + 지시선
  var cardIn=sm(R(p,T.card)), cardO=cardIn*(mobile?1-sm(seg01(p,T.cap[2][1]-.03,T.cap[2][1])):endOut);                   // 모바일: 카드는 03 단계에서만 (04 에서는 주석이 주인공)
  if(mobile&&cardO>.004){ var ch=capH[2]; if(ch&&stage.__ch!==ch){ stage.__ch=ch; stage.style.setProperty('--capH',ch+'px'); } }   // 모바일: 카드를 자막 바로 위에
  setO(elCard,cardO,(1-cardIn)*18);
  var fixed=fix>.55; if(elCard&&elCard.__fx!==fixed){ elCard.__fx=fixed; elCard.classList.toggle('fixed',fixed); if(elBadge) elBadge.textContent=fixed?'수정됨':'오류'; }
  var hp=proj(X(BAD.u),bolt.position.y+3,Z(BAD.v)), sr=stage.getBoundingClientRect(), tone=fixed?css(COL.ok):css(COL.err);
  if(leadCard){ if(cardO>.004&&elCard){ var r=elCard.getBoundingClientRect(), tx=mobile?Math.max(r.left-sr.left+24,Math.min(r.right-sr.left-24,hp[0])):r.left-sr.left, tyy=mobile?r.top-sr.top:Math.max(r.top-sr.top+26,Math.min(r.bottom-sr.top-26,hp[1]+30));
      leadCard.setAttribute('d','M'+hp[0].toFixed(1)+' '+hp[1].toFixed(1)+' L'+tx.toFixed(1)+' '+tyy.toFixed(1));
      leadCard.style.opacity=cardO; leadCard.style.stroke=tone; leadDot.setAttribute('cx',hp[0].toFixed(1)); leadDot.setAttribute('cy',hp[1].toFixed(1)); leadDot.style.opacity=cardO; leadDot.style.fill=tone; }
    else { leadCard.style.opacity=0; leadDot.style.opacity=0; } }
  // 검토 주석 (한국어 + 중국어) + 지시선
  var noteO=sm(R(p,T.note))*endOut;
  setO(elNote,noteO);
  if(elNote&&noteO>.004){ var nw=elNote.offsetWidth, nh=elNote.offsetHeight, nx=Math.max(16,Math.min(W-nw-16,hp[0]-nw*(mobile?.5:.6))), ny=Math.max(NAVH+8,hp[1]-nh-(mobile?74:132)), g2=proj(X(BAD.u)-2,1,Z(BAD.v)-8.5);
    place(elNote,nx,ny); var ax=Math.max(nx+18,Math.min(nx+nw-18,g2[0]-12)), ay=ny+nh+2, dl=eout(R(p,T.note));
    leadNote.setAttribute('d','M'+ax.toFixed(1)+' '+ay.toFixed(1)+' L'+lerp(ax,g2[0],dl).toFixed(1)+' '+lerp(ay,g2[1],dl).toFixed(1)); leadNote.style.opacity=noteO; }
  else if(leadNote) leadNote.style.opacity=0;
}

// ---------- 크기·스크롤·그리기 ----------
var lastW=0,lastH=0,lastDpr=0,dprCap=2,slowN=0;
function resize(){ if(window.__storyOff) return; var w=stage.clientWidth, h=stage.clientHeight; if(!w||!h) return;
  if(h<540){ stop(); off(); return; }    // 너무 낮은 화면(가로로 눕힌 휴대폰 등)에는 글과 모델이 함께 들어가지 않는다 → 정적 배치
  W=w; H=h; mobile=w<=800;
  html.classList.toggle('story-short',mobile&&h<620);    // 낮은 휴대폰 화면: 머리글·카드를 더 줄인다 (CSS). 아래 buildKeys 가 줄어든 높이를 다시 잰다
  var dpr=Math.max(1,Math.min(window.devicePixelRatio||1,mobile?Math.min(1.75,dprCap):dprCap,Math.sqrt(4.6e6/(w*h))));   // 그릴 픽셀 수에 상한(약 460만) — 4K·고배율 화면에서 내장 그래픽이 버거워지지 않게
  if(w!==lastW||h!==lastH||dpr!==lastDpr){ lastW=w; lastH=h; lastDpr=dpr;       // 크기가 그대로면 캔버스를 다시 잡지 않는다 (모바일 주소창이 접힐 때마다 resize 가 온다)
    renderer.setPixelRatio(dpr); renderer.setSize(w,h,false);
    camera.aspect=w/h; camera.updateProjectionMatrix(); pMat.uniforms.uScale.value=h*dpr/(2*tanF);
    for(var i=0;i<fatMats.length;i++){ fatMats[i].uniforms.uRes.value.set(w*dpr,h*dpr); fatMats[i].uniforms.uW.value=fatMats[i].userData.w*dpr; } }
  buildKeys(); need=true; }
var pT=0,pC=-1,last=0,running=false,rafId=0,ready=false;
function measure(){ if(window.__storyOff) return; var r=root.getBoundingClientRect(), total=root.offsetHeight-H; pT=total>0?clamp01(-r.top/total):0; need=true; }   // H = 고정 화면 높이(100svh)
var frames=0, clockT=null;      // clockT: 시험·미리보기 촬영용 고정 시각 (보통은 null → 실제 시각)
function frame(ms){ rafId=0; if(!running) return; var time=clockT===null?ms/1000:clockT, raw=time-last, dt=Math.min(.1,Math.max(.001,raw)); last=time;
  if(raw>.045&&raw<.5){ if(++slowN>=30&&dprCap>1){ dprCap=1; slowN=0; resize(); } } else slowN=0;      // 1.5초쯤 계속 느리면(초당 22장 미만) 해상도를 한 단계 낮춘다
  if(pC<0) pC=pT; else pC+=(pT-pC)*(1-Math.exp(-dt*9)); if(Math.abs(pT-pC)<.00008) pC=pT;
  mx+=(mxT-mx)*(1-Math.exp(-dt*4)); my+=(myT-my)*(1-Math.exp(-dt*4));
  try{ update(pC,time); renderer.render(scene,camera); }
  catch(e){ stop(); off(); if(window.console&&console.error) console.error('[story]',e); return; }   // 그리다 실패 → 정적 배치로
  frames++;
  if(!ready){ ready=true; html.classList.add('story-ready'); }
  rafId=requestAnimationFrame(frame); }
function start(){ if(running||window.__storyOff) return; running=true; if(!rafId) rafId=requestAnimationFrame(frame); }
function stop(){ running=false; if(rafId){ cancelAnimationFrame(rafId); rafId=0; } }
addEventListener('scroll',measure,{passive:true});
addEventListener('resize',function(){ resize(); measure(); });
if('ResizeObserver' in window) new ResizeObserver(function(){ resize(); measure(); }).observe(stage);
if('IntersectionObserver' in window) new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting&&!doc.hidden) start(); else stop(); }); },{rootMargin:'120px'}).observe(root); else start();
doc.addEventListener('visibilitychange',function(){ if(doc.hidden) stop(); else { var r=root.getBoundingClientRect(); if(r.bottom>-120&&r.top<(window.innerHeight||H)+120) start(); } });
if(window.matchMedia&&matchMedia('(hover:hover)').matches) stage.addEventListener('mousemove',function(e){ var r=stage.getBoundingClientRect(); mxT=((e.clientX-r.left)/r.width-.5)*2; myT=((e.clientY-r.top)/r.height-.5)*2; });
// WebGL 컨텍스트를 잃었을 때(모바일에서 다른 앱에 다녀오면 흔하다): three.js 가 복구 때 GL 자원을 다시 만들므로 잠깐 기다린다.
// 그 동안에도 글은 스크롤을 따라간다(render 만 건너뜀). 화면이 보이는 채로 4초가 지나도 돌아오지 않으면 정적 배치로 바꾼다.
var lost=false, lostT=0;
function armLost(){ clearTimeout(lostT); lostT=setTimeout(function(){ if(!lost) return; if(doc.hidden){ armLost(); return; } stop(); off(); },4000); }
canvas.addEventListener('webglcontextlost',function(e){ e.preventDefault(); lost=true; armLost(); });
canvas.addEventListener('webglcontextrestored',function(){ lost=false; clearTimeout(lostT); need=true; });
window.__storyFail=function(){ stop(); off(); };   // head 의 8초 안전장치도 같은 정리를 거치게 한다
// 단계 버튼 → 그 단계가 머무는 위치로
function seek(p,smooth){ var total=root.offsetHeight-H, y=root.getBoundingClientRect().top+(window.pageYOffset||0)+total*p; window.scrollTo({top:y,behavior:smooth?'smooth':'instant'}); }
railBtns.forEach(function(b){ b.addEventListener('click',function(){ seek(CH[+b.getAttribute('data-go')],true); }); });
resize(); measure(); start();
// 시험·점검용 (tests/pw_story.py)
window.__story={seek:function(p){ seek(p,false); measure(); pC=pT; },get p(){ return pC; },get target(){ return pT; },settle:function(){ pC=pT; },get ready(){ return ready; },
  get running(){ return running; },get frames(){ return frames; },get lost(){ return lost; },clock:function(t){ clockT=(t===null||t===undefined)?null:+t; },draw:function(){ update(pC,clockT===null?last:clockT); renderer.render(scene,camera); },count:points.geometry.attributes.position.count,chapters:CH.slice(),
  data:{plate:[PW,PD,PT],bad:BAD.id,holes:HOLES.map(function(h){ return {id:h.id,x:h.u,y:h.v,d:h.d,cb:h.cb||0,t:h.t}; }),side:{x:H12.u,d:H12.d,len:H12.v1-H12.v0},cool:{y:COOL.v,d:COOL.d,z:COOL.z}}};
}
function go(){ try{ boot(); }catch(e){ off(); if(window.console&&console.error) console.error('[story]',e); } }
if(doc.readyState==='loading') doc.addEventListener('DOMContentLoaded',go); else go();
})();
