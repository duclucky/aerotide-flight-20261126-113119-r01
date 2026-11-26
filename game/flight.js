
import {groundAt,onRunway,STRIP} from './airspace.js';

const TAU=2*Math.PI;
const GEAR_HEIGHT=1.39;
export const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const ease=(from,to,rate,dt)=>from+(to-from)*(1-Math.exp(-rate*dt));
export const signedAngle=angle=>((angle+Math.PI)%TAU+TAU)%TAU-Math.PI;
export const compassDegrees=heading=>(Math.round(heading*180/Math.PI)+360)%360;

export function launchAircraft(mission) {
  const supply=mission==='courier';
  return {
    x:supply?STRIP.x:-18,y:supply?49:94,z:supply?475:420,
    heading:0,pitch:0,bank:0,speed:supply?43:53,sink:0,
    throttle:supply?.36:.54,fuel:supply?.68:.89,damage:0,
    flaps:false,grounded:false,intact:true,warning:'',seconds:0
  };
}

function resolveTouchdown(flight,formerHeight) {
  const {x,z,pitch,bank,heading,speed,sink}=flight;
  const land=groundAt(x,z), road=onRunway(x,z);
  const floor=(road?STRIP.level:land)+GEAR_HEIGHT;
  if(flight.y>floor) return null;
  flight.y=floor;
  if(!road) return land<.08?'Water impact':'Terrain impact';
  if(Math.abs(signedAngle(heading))>=.19) return 'Runway alignment lost';
  if(Math.abs(bank)>=.22 || pitch<=-.15 || pitch>=.22 ||
    speed>=47 || speed<=23 || sink>6.2 || formerHeight<floor-.5) return 'Hard landing';
  flight.damage=clamp(flight.damage+Math.max(0,sink-2.4)*.105,0,1);
  flight.grounded=true;
  flight.pitch=0;
  flight.bank=0;
  return null;
}

export function advanceFlight(flight,input,dt) {
  if(!flight.intact) return null;
  flight.seconds+=dt;
  const {flaps}=flight;
  flight.throttle=clamp(flight.throttle+input.power*dt*.38,0,1);
  flight.fuel=Math.max(0,flight.fuel-(.005+.013*flight.throttle*flight.throttle)*dt);
  const power=flight.fuel>0?flight.throttle:0;
  if(flight.grounded) {
    flight.speed=Math.max(0,flight.speed-dt*(3.7+(input.brake?10:0)));
    flight.z-=flight.speed*dt;
    return onRunway(flight.x,flight.z)?null:'Runway overrun';
  }
  const oldHeight=flight.y;
  flight.pitch=ease(flight.pitch,input.pitch*(flaps?.175:.23),3.2,dt);
  flight.bank=ease(flight.bank,input.roll*.88,3.7,dt);
  const stallSpeed=flaps?26:33;
  const drag=(flaps?8:0)+Math.abs(flight.bank)*5+flight.damage*12;
  const targetSpeed=power>0?25+power*52-flight.pitch*18-drag:20-flight.pitch*25-(flaps?2:0);
  flight.speed=ease(flight.speed,targetSpeed,flight.speed<targetSpeed?.52:.68,dt);
  const lift=clamp(flight.speed/stallSpeed,.45,1);
  const stall=clamp((stallSpeed-flight.speed)/10,0,1);
  flight.heading=signedAngle(flight.heading+Math.tan(flight.bank)*(.31+flight.speed*.003)*lift*dt);
  flight.sink=-Math.sin(flight.pitch)*flight.speed+stall*10+Math.max(0,Math.abs(flight.bank)-.48)*4.5;
  flight.y=Math.min(620,flight.y-flight.sink*dt);
  flight.x+=Math.sin(flight.heading)*flight.speed*dt;
  flight.z-=Math.cos(flight.heading)*flight.speed*dt;
  flight.warning=flight.fuel<=0?'FUEL EXHAUSTED':stall>.23?'STALL · LOWER NOSE':flight.fuel<.18?'LOW FUEL':'';
  if(Math.hypot(flight.x,flight.z)>3900) return 'Beyond the radio sector';
  return resolveTouchdown(flight,oldHeight);
}
