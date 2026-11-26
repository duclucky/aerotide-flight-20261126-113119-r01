
import * as T from './vendor/three.module.min.js';
import {SHOALS,STRIP,groundAt,islandHeight} from './airspace.js';

const SUN=new T.Vector3(.34,.15,-.92).normalize();
const color=hex=>new T.Color(hex);
const flat=(hex,options={})=>new T.MeshLambertMaterial({color:hex,flatShading:true,...options});
const unitBox=new T.BoxGeometry(1,1,1);

function seeded(seed) {
  let n=seed>>>0;
  return ()=>((n=Math.imul(1664525,n)+1013904223>>>0)/4294967296);
}

function box(parent,mat,x,y,z,w,h,d) {
  const mesh=new T.Mesh(unitBox,mat);
  mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
  parent.add(mesh);
  return mesh;
}

function makeSky() {
  const material=new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    uniforms:{
      sun:{value:SUN},
      dusk:{value:color('#475a80')},zenith:{value:color('#354269')},
      haze:{value:color('#f1a881')},gold:{value:color('#ffc878')},
      pearl:{value:color('#fff2bc')},cloud:{value:color('#d49186')}
    },
    vertexShader:`
      varying vec3 ray;
      void main(){
        ray=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      varying vec3 ray;
      uniform vec3 sun,dusk,zenith,haze,gold,pearl,cloud;
      float waves(vec2 p) {
        return sin(p.x+cos(p.y*1.22))*.40+sin(p.x*1.73-p.y*1.31)*.25
          +sin(p.x*3.07+p.y*2.33)*.17+sin(p.x*6.13-p.y*3.2)*.09;
      }
      void main(){
        vec3 d=normalize(ray);
        float h=max(0.,d.y);
        float flare=max(0.,dot(d,sun)), glow=pow(flare,7.);
        vec3 base=mix(haze,dusk,smoothstep(.015,.44,h));
        base=mix(base,zenith,smoothstep(.38,.95,h));
        base=mix(base,gold,glow*.59*(1.-h*.65));
        float cover=smoothstep(.33,.68,waves(vec2(d.x*28.+d.z*4.,d.y*69.)));
        float shelf=smoothstep(.035,.13,h)*(1.-smoothstep(.35,.49,h));
        base=mix(base,mix(cloud,gold,glow*.52),cover*shelf*.38);
        base+=gold*pow(flare,85.)*.22;
        float sunDisc=smoothstep(.99913,.9993,flare);
        base=mix(base,pearl*1.12,sunDisc);
        gl_FragColor=vec4(base,1.);
        #include <colorspace_fragment>
      }`
  });
  const sky=new T.Mesh(new T.SphereGeometry(6200,24,16),material);
  sky.renderOrder=-20;
  sky.frustumCulled=false;
  return sky;
}

function makeTidalWater() {
  const water=new T.Mesh(new T.PlaneGeometry(11500,11500),new T.ShaderMaterial({
    uniforms:{
      sun:{value:SUN},clock:{value:0},deep:{value:color('#214f62')},
      shallow:{value:color('#3f8691')},mist:{value:color('#b48d89')},
      shine:{value:color('#ffc086')},foam:{value:color('#a1c1ae')}
    },
    vertexShader:`
      varying vec3 world;
      void main(){
        world=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
      }`,
    fragmentShader:`
      uniform float clock;
      uniform vec3 sun,deep,shallow,mist,shine,foam;
      varying vec3 world;
      void main(){
        vec2 p=world.xz;
        vec3 d=normalize(world-cameraPosition);
        float dist=length(p-cameraPosition.xz);
        float ripple=sin(p.x*.049+p.y*.104+clock*.84)*.35
          +sin(p.x*.128-p.y*.111-clock*.96)*.25
          +sin(p.x*.194+p.y*.377-clock*1.57)*.20
          +sin(p.x*.008+p.y*.021+clock*.17)*.40;
        float detail=1.-smoothstep(780.,2400.,dist);
        vec3 base=mix(deep,shallow,.41+ripple*.21*detail);
        float band=abs(normalize(d.xz).x-normalize(sun.xz).x);
        float beam=exp(-pow(band*8.5,2.))*max(.0,-d.z);
        float glint=smoothstep(.25,.98,ripple)*.56+.09;
        base=mix(base,shine,beam*glint*(.30+.65*smoothstep(170.,900.,dist)));
        base=mix(base,foam,smoothstep(.83,1.1,ripple)*detail*.21);
        base=mix(base,mist,smoothstep(750.,5100.,dist)*.82);
        gl_FragColor=vec4(base,1.);
        #include <colorspace_fragment>
      }`
  }));
  water.rotation.x=-Math.PI/2;
  water.position.y=.07;
  return water;
}

function islandPalette(y,slope,jitter) {
  if(y<1.5) return color('#add3ad').lerp(color('#79b5a4'),jitter);
  if(y<4.2) return color('#bea487').lerp(color('#e1c9a0'),jitter);
  if(y<9.5) return color('#677b60').lerp(color('#8c9470'),jitter);
  if(slope>.29 || y>112) return color('#5a6870').lerp(color('#989186'),jitter*.8+Math.min(y/280,.2));
  return color('#526958').lerp(color('#849266'),jitter);
}

function buildFacetedIsland(island,index) {
  const [cx,cz,rx,rz]=island;
  const rng=seeded(1430+index*211), divisions=index===0?[37,66]:[36,38];
  const [sx,sz]=divisions, verts=[];
  for(let z=0;z<=sz;z++) for(let x=0;x<=sx;x++){
    const u=(x/sx*2-1)*1.25, v=(z/sz*2-1)*1.25;
    const px=cx+(u+(rng()-.5)*.031)*rx, pz=cz+(v+(rng()-.5)*.027)*rz;
    verts.push([px,islandHeight(island,px,pz),pz]);
  }
  const positions=[],colors=[];
  function facet(a,b,c) {
    if(Math.max(a[1],b[1],c[1])<-.3) return;
    const min=Math.min(a[1],b[1],c[1]), average=(a[1]+b[1]+c[1])/3;
    const slope=(Math.max(a[1],b[1],c[1])-min)/Math.max(1,Math.hypot(a[0]-b[0],a[2]-b[2]));
    const tint=islandPalette(average,slope,rng());
    for(const p of [a,b,c]){positions.push(...p);colors.push(tint.r,tint.g,tint.b);}
  }
  for(let z=0;z<sz;z++) for(let x=0;x<sx;x++){
    const i=z*(sx+1)+x, a=verts[i],b=verts[i+1],c=verts[i+sx+1],d=verts[i+sx+2];
    if((z+x)%2){facet(a,c,b);facet(b,c,d);}else{facet(a,c,d);facet(a,d,b);}
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return new T.Mesh(geometry,flat('#ffffff',{vertexColors:true}));
}

function seedCoastalPines(scene) {
  const random=seeded(69121), sites=[];
  for(const [cx,cz,rx,rz] of SHOALS.slice(0,9)){
    for(let i=0;i<95;i++){
      const x=cx+(random()-.5)*rx*1.7,z=cz+(random()-.5)*rz*1.7,y=groundAt(x,z);
      if(y<10 || y>98 || (Math.abs(x-STRIP.x)<30 && z>STRIP.far-12 && z<STRIP.near+20)) continue;
      sites.push([x,y,z,3.3+random()*6,random()*6.28]);
    }
  }
  const positions=new T.InstancedMesh(new T.ConeGeometry(1,1,5),flat('#ffffff'),sites.length*2);
  const temp=new T.Object3D(), rng=seeded(412);
  sites.forEach(([x,y,z,h,yaw],i)=>{
    for(let j=0;j<2;j++){
      temp.position.set(x,y+h*(.50+j*.27),z);
      temp.rotation.set(0,yaw+j*.5,0);
      temp.scale.setScalar(1);
      temp.scale.set(h*(.25-j*.06),h*.77,h*(.25-j*.06));
      temp.updateMatrix();
      positions.setMatrixAt(i*2+j,temp.matrix);
      positions.setColorAt(i*2+j,color('#304d44').lerp(color('#78956b'),rng()*.66));
    }
  });
  scene.add(positions);
}

function paintMarking(parent,text,x,z,w,d) {
  const canvas=document.createElement('canvas');
  canvas.width=256;canvas.height=128;
  const brush=canvas.getContext('2d');
  brush.fillStyle='#eee8c8';
  brush.textAlign='center';
  brush.textBaseline='middle';
  brush.font='bold 108px monospace';
  brush.fillText(text,128,67);
  const map=new T.CanvasTexture(canvas);
  map.colorSpace=T.SRGBColorSpace;
  const mesh=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(x,STRIP.level+.27,z);
  parent.add(mesh);
}

function buildKestrelField(scene) {
  const {x,near,far,width,level}=STRIP;
  const length=near-far,center=(near+far)/2;
  const asphalt=flat('#424a51'),concrete=flat('#707267'),white=flat('#e7debb');
  const glow=new T.MeshBasicMaterial({color:'#ffe1a0'}),green=new T.MeshBasicMaterial({color:'#95f4a7'});
  const base=level+.08;
  box(scene,concrete,x,base-.05,center,width+5,.15,length+4);
  box(scene,asphalt,x,base,center,width,.18,length);
  for(const side of [-1,1]){
    box(scene,white,x+side*(width/2-1.3),base+.107,center,.25,.06,length-5);
    for(let z=near-12;z>far+4;z-=21) box(scene,glow,x+side*(width/2+.6),base+.28,z,.67,.43,.67);
  }
  for(let z=near-56;z>far+17;z-=24) box(scene,white,x,base+.112,z,.67,.05,10);
  for(let i=-4;i<=4;i++){
    if(i!==0) box(scene,white,x+i*2.03,base+.12,near-9,.91,.05,7.2);
    box(scene,green,x+i*2.7,base+.27,near+1,.55,.40,.65);
  }
  paintMarking(scene,'36',x,near-32,13,9);
  box(scene,concrete,x+29,base+.01,-186,38,.09,48);
  const walls=flat('#9baca0'),roof=flat('#c36c52'),steel=flat('#53636a');
  for(const [hx,hz] of [[x+33,-194],[x+40,-154]]){
    const y=Math.max(groundAt(hx,hz),level);
    box(scene,walls,hx,y+2.7,hz,14,5.4,18);
    box(scene,roof,hx,y+5.7,hz,15,.8,19);
    box(scene,steel,hx-7.12,y+2.3,hz,.26,4,12);
  }
  for(const [lx,lz] of [[72,-106],[-217,-411],[181,-581]]){
    const y=groundAt(lx,lz);
    const tower=new T.Mesh(new T.CylinderGeometry(2.1,3.75,16,8),white);
    tower.position.set(lx,y+8,lz);scene.add(tower);
    box(scene,roof,lx,y+16,lz,6,2,6);
    box(scene,glow,lx,y+17.8,lz,3.7,1.6,3.7);
    const spire=new T.Mesh(new T.ConeGeometry(4.4,3.5,8),roof);
    spire.position.set(lx,y+20,lz);scene.add(spire);
  }
}

function hangClouds(scene) {
  const random=seeded(5733), shape=new T.IcosahedronGeometry(1,1), model=new T.Object3D();
  const clouds=new T.InstancedMesh(shape,flat('#fff6e7'),60);
  for(let i=0;i<12;i++){
    const x=(random()-.5)*5600,z=-680-random()*4700,y=185+random()*260;
    for(let j=0;j<5;j++){
      model.position.set(x+(j-2)*51,y+random()*15,z+(random()-.5)*100);
      model.rotation.y=random()*6.28;
      model.scale.set(40+random()*65,10+random()*16,23+random()*46);
      model.updateMatrix();
      clouds.setMatrixAt(i*5+j,model.matrix);
      clouds.setColorAt(i*5+j,color('#c99c90').lerp(color('#fff0d6'),random()*.88));
    }
  }
  scene.add(clouds);
}

export function constructArchipelago(scene) {
  scene.fog=new T.FogExp2('#998c9c',.00043);
  const sky=makeSky(),water=makeTidalWater();
  scene.add(sky,water,new T.HemisphereLight('#ffe6cc','#70888b',1.72));
  const sunlight=new T.DirectionalLight('#ffc991',2.23);
  sunlight.position.copy(SUN).multiplyScalar(860);
  scene.add(sunlight);
  SHOALS.forEach((island,index)=>scene.add(buildFacetedIsland(island,index)));
  seedCoastalPines(scene);
  buildKestrelField(scene);
  hangClouds(scene);
  return (camera,time)=>{
    sky.position.copy(camera.position);
    water.material.uniforms.clock.value=time;
  };
}

export function buildBeaconGate(scene,gate) {
  const group=new T.Group();
  group.position.set(gate.x,gate.y,gate.z);
  const dim=new T.MeshBasicMaterial({color:'#704b34',fog:false});
  const lamp=new T.MeshBasicMaterial({color:'#ffd88b',fog:false});
  const hot=new T.MeshBasicMaterial({color:'#fff2ba',fog:false});
  const halo=new T.MeshBasicMaterial({color:'#ffb956',transparent:true,opacity:.16,depthWrite:false,fog:false});
  const rings=[new T.Mesh(new T.TorusGeometry(gate.r,1.31,8,72),dim),
    new T.Mesh(new T.TorusGeometry(gate.r,2.65,8,72),halo)];
  rings[1].position.z=-.12;
  group.add(...rings);
  for(let i=0;i<12;i++){
    const segment=new T.Mesh(new T.TorusGeometry(gate.r,1.37,8,8,Math.PI/6-.066),i%3===0?hot:lamp);
    segment.rotation.z=i*Math.PI/6+.035;segment.position.z=.19;
    group.add(segment);
  }
  const guide=new T.Mesh(new T.RingGeometry(gate.r*.78,gate.r*.81,56),new T.MeshBasicMaterial({
    color:'#ffcd8e',opacity:.44,transparent:true,depthWrite:false,side:T.DoubleSide,fog:false
  }));
  group.add(guide);
  for(const dir of [-1,1]){
    box(group,hot,dir*(gate.r+2.8),0,.3,5.6,.52,.65);
    box(group,lamp,0,dir*(gate.r+2.7),.3,.52,5.5,.65);
  }
  scene.add(group);
  return group;
}
