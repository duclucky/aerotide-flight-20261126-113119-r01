
import * as T from './vendor/three.module.min.js';

const paint=(color,extra={})=>new T.MeshLambertMaterial({color,flatShading:true,...extra});
const cabin=paint('#e7dac3'), coral=paint('#b43f2d'), brass=paint('#ffd080');
const navy=paint('#263439'), rubber=paint('#1e2226'), metal=paint('#777d71');
const glass=paint('#345b64',{emissive:'#19343a',emissiveIntensity:.8});
const beacon=(color)=>new T.MeshBasicMaterial({color});
const boxShape=new T.BoxGeometry(1,1,1);

function put(group,geometry,mat,x,y,z) {
  const mesh=new T.Mesh(geometry,mat);
  mesh.position.set(x,y,z);
  group.add(mesh);
  return mesh;
}
function plate(group,mat,x,y,z,w,h,d) {
  const mesh=put(group,boxShape,mat,x,y,z);
  mesh.scale.set(w,h,d);return mesh;
}

function skinHull(parent,sections,mat) {
  const vertices=[],indices=[],sides=10;
  for(const [z,w,h,cy] of sections){
    for(let i=0;i<sides;i++){
      const a=(i+.5)*2*Math.PI/sides;
      vertices.push(Math.cos(a)*w,cy+Math.sin(a)*h,z);
    }
  }
  for(let s=0;s<sections.length-1;s++) for(let i=0;i<sides;i++){
    const a=s*sides+i,b=s*sides+(i+1)%sides;
    indices.push(a,b,b+sides,a,b+sides,a+sides);
  }
  for(let i=1;i<sides-1;i++){
    const end=(sections.length-1)*sides;
    indices.push(0,i+1,i,end,end+i,end+i+1);
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  return put(parent,geo,mat,0,0,0);
}

function airfoil(parent,plan,depth,mat) {
  const coords=[],tri=[];
  for(const [x,y,z] of plan) coords.push(x,y,z);
  for(const [x,y,z] of plan) coords.push(x,y-depth,z);
  const points=plan.length;
  for(let i=1;i<points-1;i++) tri.push(0,i,i+1,points,points+i+1,points+i);
  for(let i=0;i<points;i++){
    const j=(i+1)%points;
    tri.push(i,i+points,j,j,i+points,j+points);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(coords,3));
  g.setIndex(tri);g.computeVertexNormals();
  return put(parent,g,mat,0,0,0);
}

function tieRod(parent,mat,a,b,radius) {
  const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from);
  const mesh=put(parent,new T.CylinderGeometry(radius,radius,delta.length(),6),mat,0,0,0);
  mesh.position.copy(from).lerp(to,.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
}

function drawRegistration(group) {
  const canvas=document.createElement('canvas');
  canvas.width=320;canvas.height=100;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#273539';ctx.font='bold 73px monospace';ctx.textBaseline='middle';
  ctx.fillText('AT—07',12,52);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const tag=put(group,new T.PlaneGeometry(2.6,.81),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}),-3.25,1.435,.11);
  tag.rotation.x=-Math.PI/2;
}

export function buildCourierAircraft(scene) {
  const group=new T.Group();
  scene.add(group);
  skinHull(group,[[-3.95,.43,.46,-.05],[-3.37,.76,.7,0],[-2.25,1.01,.88,.06],
    [1.42,.91,.91,.05],[3.82,.51,.53,.16],[5.13,.24,.25,.27],[5.62,.08,.09,.33]],cabin);
  skinHull(group,[[-4.08,.42,.44,-.04],[-3.87,.48,.50,-.04],[-3.34,.77,.71,0]],coral);
  skinHull(group,[[1.18,.925,.92,.05],[1.56,.9,.88,.06]],coral);
  // Glazing sits above the cabin and wraps its leading, side and aft faces.
  skinHull(group,[[-2.69,.56,.16,.61],[-1.99,.91,.30,.87],[-.19,.90,.33,.89],
    [.62,.67,.23,.78],[.92,.5,.10,.72]],glass);
  for(const side of [-1,1]){
    const s=side;
    const wing=[[s*.48,1.43,-1.12],[s*.78,1.43,1.14],[s*3.9,1.43,1.02],[s*7.54,1.46,.78],
      [s*8.02,1.44,.10],[s*7.48,1.44,-.89],[s*3.35,1.43,-1.1]];
    airfoil(group,s>0?wing:wing.slice().reverse(),.24,cabin);
    const tip=[[s*6.8,1.455,-.92],[s*6.8,1.455,.84],[s*7.54,1.47,.78],[s*8.035,1.46,.10],[s*7.49,1.455,-.90]];
    airfoil(group,s>0?tip:tip.slice().reverse(),.17,coral);
    plate(group,brass,s*6.74,1.453,.012,.13,.04,1.7);
    plate(group,navy,s*4.2,1.36,.96,2.84,.21,.29);
    tieRod(group,metal,[s*.67,-.54,-.71],[s*4.44,1.19,-.23],.072);
    tieRod(group,metal,[s*.62,-.58,.62],[s*4.44,1.19,-.23],.057);
    tieRod(group,navy,[s*.64,-.44,-.28],[s*1.60,-1.07,.04],.13);
    const wheel=put(group,new T.CylinderGeometry(.35,.35,.28,14),rubber,s*1.61,-1.03,.03);
    wheel.rotation.z=Math.PI/2;
    const hub=put(group,new T.CylinderGeometry(.18,.18,.29,10),metal,s*1.62,-1.03,.03);
    hub.rotation.z=Math.PI/2;
    const tail=[[s*.1,.52,4.04],[s*.16,.52,5.45],[s*2.96,.54,5.43],
      [s*3.20,.56,5.02],[s*2.63,.56,4.51]];
    airfoil(group,s>0?tail:tail.slice().reverse(),.15,coral);
    put(group,new T.SphereGeometry(.114,7,6),beacon(s<0?'#ff684a':'#77ffd3'),s*7.87,1.46,.22);
    plate(group,metal,s*.91,.86,-.7,.08,.54,.067);
    plate(group,navy,s*.74,-.47,3.13,.10,.16,.5);
  }
  // Center fin, its trailing contrast stripe and a tail position light.
  const fin=new T.Shape();
  fin.moveTo(3.57,.33);fin.lineTo(4.72,2.33);fin.lineTo(5.14,2.42);
  fin.lineTo(5.75,.53);fin.lineTo(5.5,.29);fin.closePath();
  const rudder=put(group,new T.ExtrudeGeometry(fin,{depth:.14,bevelEnabled:false}),coral,-.07,0,0);
  rudder.rotation.y=-Math.PI/2;
  put(group,new T.SphereGeometry(.10,7,6),beacon('#ffe2b1'),0,.44,5.62);
  drawRegistration(group);
  const propeller=new T.Group();propeller.position.set(0,-.042,-4.17);group.add(propeller);
  const spinner=put(propeller,new T.ConeGeometry(.27,.48,12),brass,0,0,-.13);
  spinner.rotation.x=-Math.PI/2;
  const blur=put(propeller,new T.CircleGeometry(1.49,28),new T.MeshBasicMaterial({
    color:'#d1b685',transparent:true,opacity:.17,side:T.DoubleSide,depthWrite:false
  }),0,0,0);
  for(const angle of [0,Math.PI*2/3,Math.PI*4/3]){
    const blade=plate(propeller,navy,Math.sin(angle)*.72,Math.cos(angle)*.72,-.022,.13,1.34,.075);
    blade.rotation.z=-angle;
  }
  return (state,visualTime)=>{
    group.position.set(state.x,state.y,state.z);
    group.rotation.set(state.pitch,-state.heading,-state.bank,'YXZ');
    propeller.rotation.z=visualTime*(state.intact?16+state.throttle*34:0);
    blur.visible=state.intact;
    return group;
  };
}
