import {STRIP} from './airspace.js';
import {signedAngle} from './flight.js';
import {SORTIES} from './missions.js';

const FEET=3.28084, KNOTS=1.94384;
const GATE=SORTIES.courier.gates[0];
const FLARE_DISTANCE=45;
const FLARE_ALTITUDE=32/FEET;
const DESCENT_START=49;
const DESCENT_GRADE=(DESCENT_START-FLARE_ALTITUDE)/(GATE.z-STRIP.near+FLARE_DISTANCE);

export function profileAltitude(distance) {
  // Indicated altitude above sea level, not height above the runway.
  return FLARE_ALTITUDE+DESCENT_GRADE*Math.max(0,distance+FLARE_DISTANCE);
}

function finalApproach(flight,distance) {
  const offset=flight.x-STRIP.x;
  const heading=signedAngle(flight.heading);
  const bank=Math.abs(flight.bank);
  const speed=flight.speed*KNOTS;
  const tolerance=Math.max(STRIP.width*.25,Math.max(0,distance)*.085);
  const altitudeDelta=(flight.y-profileAltitude(distance))*FEET;
  const onStrip=distance<=0 && Math.abs(offset)<=STRIP.width/2;
  const phase=onStrip?'OVER STRIP':'FINAL';
  const lateral=offset>tolerance?'LEFT OF NOSE':offset< -tolerance?'RIGHT OF NOSE':'CENTERED';
  const vertical=altitudeDelta>14?'HIGH':altitudeDelta< -14?'LOW':'ON PROFILE';
  const airspeed=speed<55?'SLOW':speed>85?'FAST':'IN BAND';
  const course=bank>.18?'BANKED':Math.abs(heading)>.15?'OFF HEADING':lateral;
  let hint;
  if(bank>.18) hint='Level the wings.';
  else if(lateral!=='CENTERED') hint=offset>0?'Ease left to intercept the centerline.':'Ease right to intercept the centerline.';
  else if(Math.abs(heading)>.15) hint='Align to heading 000°.';
  else if(airspeed==='SLOW') hint='Add power. Avoid raising the nose sharply.';
  else if(airspeed==='FAST') hint=flight.flaps?'Reduce power toward 55–85 kt.':'Reduce power; set flaps when stable.';
  else if(!flight.flaps) hint='Set flaps [F] for the approach.';
  else if(vertical==='LOW' && !onStrip) hint='Ease off descent; add power if needed.';
  else if(vertical==='HIGH') hint='Lower the nose gently to regain the profile.';
  else if(flight.sink>5.7 && distance<35) hint='Ease off descent near the threshold.';
  else hint=onStrip?'Hold centerline. Flare at 32 ft.':'Track the centerline; keep 55–85 kt.';
  return {phase,distance,course,vertical,airspeed,hint};
}

export function readApproach(flight,sortie) {
  if(sortie.id!=='courier' || sortie.status!=='active' || flight.grounded || !flight.intact) return null;
  const distance=flight.z-STRIP.near;
  const heading=signedAngle(flight.heading);
  const thresholdAhead=Math.cos(heading)>0;
  if(sortie.index===0) {
    const passed=flight.z<GATE.z;
    return {
      phase:passed?'REJOIN GATE':'APPROACH GATE',distance,
      hint:passed?'Climb clear and re-enter the gate heading north.':
        !thresholdAhead?'Turn toward the gate before descending.':
        flight.flaps?'Stay level through the amber gate.':'Set flaps [F]; stay level through the gate.'
    };
  }
  if(distance>650 || !thresholdAhead || distance< -145 ||
    (distance<0 && Math.abs(flight.x-STRIP.x)>STRIP.width/2)) {
    return {phase:'REPOSITION',distance,hint:'Climb clear. Rejoin south of Runway 36.'};
  }
  return finalApproach(flight,distance);
}

export function rangeToThreshold(distance) {
  return distance>=0?Math.round(distance)+' M TO THR':Math.round(-distance)+' M PAST THR';
}
