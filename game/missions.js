
import {STRIP} from './airspace.js';

export const SORTIES={
  route:{
    label:'Beacon Circuit',number:'01',call:'Lumen Control',
    description:'Thread four tide beacons in order. Miss one? Either direction counts on a return pass.',
    gates:[
      {x:-18,y:94,z:162,r:28,name:'Breakwater'},
      {x:5,y:88,z:-106,r:31,name:'Sable Channel'},
      {x:-4,y:96,z:-375,r:29,name:'Needle Pass'},
      {x:-49,y:93,z:-652,r:27,name:'Last Light'}
    ]
  },
  courier:{
    label:'Last Light Delivery',number:'02',call:'Kestrel Tower',
    description:'Set flaps (F) and stay level through the gate. Then descend to Runway 36.',
    gates:[{x:STRIP.x,y:42,z:236,r:29,name:'Kestrel Approach'}]
  }
};

export function startSortie(id) {
  return {id,index:0,status:'ready',notice:'',noticeUntil:0,reason:'',distance:0};
}

export function targetForSortie(sortie) {
  if(sortie.status==='success' || sortie.status==='failure') return null;
  return SORTIES[sortie.id].gates[sortie.index]??(sortie.id==='courier'
    ?{x:STRIP.x,y:STRIP.level,z:STRIP.near,name:'Kestrel · Runway 36'}:null);
}

function crossedGatePlane(previous,flight,gate,allowReturn) {
  const northbound=previous.z>gate.z && flight.z<=gate.z;
  const southbound=previous.z<gate.z && flight.z>=gate.z;
  return northbound || (allowReturn && southbound);
}

function insideGate(previous,flight,gate) {
  const fraction=(previous.z-gate.z)/(previous.z-flight.z);
  const x=previous.x+(flight.x-previous.x)*fraction;
  const y=previous.y+(flight.y-previous.y)*fraction;
  return Math.hypot(x-gate.x,y-gate.y)<=gate.r;
}

export function updateSortie(sortie,previous,flight) {
  const gate=SORTIES[sortie.id].gates[sortie.index];
  sortie.distance+=Math.hypot(flight.x-previous.x,flight.z-previous.z);
  if(!gate || !crossedGatePlane(previous,flight,gate,sortie.id==='route')) {
    return flight.grounded && flight.speed<3 && sortie.id==='courier' && sortie.index===1
      ? 'Medical cargo delivered' : null;
  }
  if(insideGate(previous,flight,gate)) {
    sortie.index++;
    sortie.notice=sortie.id==='route'?'BEACON CONFIRMED':'APPROACH CLEARED';
    sortie.noticeUntil=flight.seconds+3;
    if(sortie.id==='route' && sortie.index===SORTIES.route.gates.length) return 'All four beacons logged';
  } else {
    sortie.notice=sortie.id==='route'
      ? 'BEACON MISSED · CIRCLE BACK'
      : 'GATE MISSED · RE-ENTER HEADING NORTH';
    sortie.noticeUntil=flight.seconds+6;
  }
  return null;
}

export function bearingToTarget(flight,target) {
  if(!target) return {bearing:0,distance:0};
  return {bearing:Math.atan2(target.x-flight.x,flight.z-target.z),distance:Math.hypot(target.x-flight.x,target.z-flight.z)};
}
