
import * as T from './vendor/three.module.min.js';
import {compassDegrees,signedAngle} from './flight.js';
import {SORTIES,bearingToTarget,targetForSortie} from './missions.js';
import {STRIP} from './airspace.js';

const item=id=>document.getElementById(id);
const put=(el,value)=>{if(el.textContent!==String(value)) el.textContent=value;};
const pad=n=>String(n).padStart(2,'0');
const pct=value=>Math.round(value*100);
const CARDS=['N','NE','E','SE','S','SW','W','NW'];

function drawLocalizer(ctx,flight,sortie,target) {
  const {width:w,height:h}=ctx.canvas;
  const cx=w/2,cy=h-19,k=.27;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#536f68';ctx.lineWidth=1;
  ctx.setLineDash([3,4]);
  ctx.beginPath();
  for(const r of [25,49,74,99]){
    ctx.moveTo(cx+r,cy);ctx.arc(cx,cy,r,0,2*Math.PI);
  }
  ctx.moveTo(cx,0);ctx.lineTo(cx,h);
  ctx.moveTo(0,cy);ctx.lineTo(w,cy);
  ctx.stroke();ctx.setLineDash([]);
  const sin=Math.sin(flight.heading),cos=Math.cos(flight.heading);
  const point=(x,z)=>[cx+((x-flight.x)*cos+(z-flight.z)*sin)*k,cy+(-(x-flight.x)*sin+(z-flight.z)*cos)*k];
  const near=point(STRIP.x,STRIP.near),far=point(STRIP.x,STRIP.far);
  ctx.strokeStyle='#94beac';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...near);ctx.lineTo(...far);ctx.stroke();
  for(const [i,gate] of SORTIES[sortie.id].gates.entries()){
    const p=point(gate.x,gate.z);
    ctx.strokeStyle=i<sortie.index?'#6ac5a2':i===sortie.index?'#ffda99':'#9a9d79';
    ctx.lineWidth=i===sortie.index?2:1;
    ctx.strokeRect(p[0]-4,p[1]-4,8,8);
  }
  if(target){
    const [x,y]=point(target.x,target.z);
    const px=Math.max(7,Math.min(w-7,x)),py=Math.max(7,Math.min(h-7,y));
    ctx.fillStyle='#ffda99';
    ctx.beginPath();ctx.moveTo(px,py-3);ctx.lineTo(px+3,py);ctx.lineTo(px,py+3);ctx.lineTo(px-3,py);ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(cx,cy-7);ctx.lineTo(cx-5,cy+5);ctx.lineTo(cx,cy+2);ctx.lineTo(cx+5,cy+5);ctx.closePath();
  ctx.fillStyle='#e7fff4';ctx.fill();
}

function landingInstruction(flight,sortie) {
  if(flight.grounded) return 'HOLD SPACE TO BRAKE';
  if(sortie.id!=='courier') return '';
  if(sortie.index===0 && !flight.flaps && flight.z>=SORTIES.courier.gates[0].z)
    return 'SET FLAPS [F] · STAY LEVEL THROUGH GATE';
  if(sortie.index!==1) return '';
  if(Math.abs(flight.x-STRIP.x)>17 || Math.abs(signedAngle(flight.heading))>.19)
    return 'LINE UP WITH RUNWAY 36';
  if(flight.y<=10.2 && flight.z<STRIP.near+10 && flight.z>STRIP.far)
    return 'FLARE NOW · RELEASE S / DOWN';
  if(flight.y<19 && flight.z<92 && flight.z>STRIP.far)
    return 'AT 32 FT · RELEASE S / DOWN TO FLARE';
  return 'DESCEND [S / DOWN] · AIM AT THE CENTERLINE';
}

export function bindFlightInstruments() {
  const ids=['speed','altitude','heading','cardinal','vertical','flight-config','attitude','marker','caution',
    'flight-number','mission-title','objective','progress','progress-label','radio','flight-time',
    'scope','target-range','scope-label','power','fuel','hull','power-value','fuel-value','hull-value',
    'status-panel','status-tag','status-title','status-copy','action','route','courier','help','sound','camera','review-flight'];
  const e=Object.fromEntries(ids.map(id=>[id,item(id)]));
  const ctx=e.scope.getContext('2d'), vector=new T.Vector3();
  let lastStage='',lastIndex=-1,lastMission='';
  function showStage(sortie) {
    const stage=sortie.status;
    const stageChanged=stage!==lastStage || sortie.id!==lastMission;
    if(!stageChanged) return;
    e['status-panel'].hidden=stage==='active';
    e['review-flight'].hidden=stage!=='success' && stage!=='failure';
    e['status-panel'].className='status-panel '+stage;
    e.help.setAttribute('aria-expanded',String(stage==='paused'));
    const labels={
      ready:['KESTREL ARCHIPELAGO · 18:42 LOCAL','Ready to fly','The coast is clear. Take the controls.','SPACE','Take controls'],
      paused:['RADIO BRIEFING','Flight paused','Drag to steer, or use W A S D. Shift / Ctrl sets power. F toggles landing flaps; hold Space to brake on the runway.','ESC','Resume flight'],
      success:['SORTIE COMPLETE',sortie.id==='courier'?'Cargo delivered':'Circuit complete',sortie.reason,'R','Fly again'],
      failure:['SORTIE ABORTED','Aircraft lost',sortie.reason+' · Reset the aircraft and try again.','R','Retry sortie']
    };
    const label=labels[stage];
    if(label) {
      put(e['status-tag'],label[0]);put(e['status-title'],label[1]);put(e['status-copy'],label[2]);
      put(e.action.querySelector('kbd'),label[3]);put(e.action.querySelector('span'),label[4]);
    }
    lastStage=stage;
  }
  return {
    update(flight,sortie){
      const config=SORTIES[sortie.id],target=flight.grounded?null:targetForSortie(sortie);
      const {distance,bearing}=bearingToTarget(flight,target);
      const heading=compassDegrees(flight.heading);
      put(e.speed,Math.round(flight.speed*1.94384));
      put(e.altitude,Math.round(flight.y*3.28084));
      put(e.heading,String(heading).padStart(3,'0'));
      put(e.cardinal,CARDS[Math.round(heading/45)%8]);
      const fpm=flight.grounded?0:Math.round(-flight.sink*196.85/10)*10;
      put(e.vertical,fpm>0?'+'+fpm:fpm);
      put(e['flight-config'],flight.grounded?'ON RUNWAY':flight.flaps?'FLAPS DOWN':'CLEAN CONFIG');
      put(e['target-range'],target?(distance/1852).toFixed(2)+' NM':flight.grounded?'RWY 36':'—');
      put(e['scope-label'],target?target.name.toUpperCase():flight.grounded?'KESTREL AIRFIELD':sortie.status==='success'?'ROUTE COMPLETE':'NO ACTIVE TARGET');
      put(e['flight-time'],pad(Math.floor(flight.seconds/60))+':'+pad(Math.floor(flight.seconds%60)));
      for(const [id,value] of [['power',flight.throttle],['fuel',flight.fuel],['hull',1-flight.damage]]){
        if(e[id].value!==pct(value)) e[id].value=pct(value);
        put(e[id+'-value'],pct(value)+'%');
      }
      const radioCall=flight.seconds<sortie.noticeUntil?sortie.notice:'';
      const info=flight.warning || (radioCall.includes('MISSED')?radioCall:landingInstruction(flight,sortie) || radioCall);
      e.caution.hidden=!info || sortie.status!=='active';
      if(info) put(e.caution,info);
      if(lastIndex!==sortie.index || lastMission!==sortie.id){
        put(e['flight-number'],'SORTIE '+config.number);
        put(e['mission-title'],config.label);
        put(e.radio,config.call.toUpperCase());
        put(e.objective,sortie.id==='courier' && sortie.index===1
          ? 'Runway 36 · Hold 55–85 kt, wings level. Flare at 32 ft, then brake.'
          : config.description);
        e.route.setAttribute('aria-pressed',String(sortie.id==='route'));
        e.courier.setAttribute('aria-pressed',String(sortie.id==='courier'));
        const count=sortie.id==='courier'?2:config.gates.length;
        const cleared=sortie.status==='success'?count:sortie.index;
        e.progress.replaceChildren(...Array.from({length:count},(_,i)=>{
          const el=document.createElement('i');el.className=i<cleared?'done':i===cleared?'active':'';return el;
        }));
        put(e['progress-label'],sortie.id==='route'?cleared+' / '+count+' GATES':cleared===2?'CARGO SECURED':cleared===1?'LANDING CLEARED':'ON APPROACH');
        lastIndex=sortie.index;
      }
      showStage(sortie);
      if(sortie.status==='success' && sortie.id==='courier'){
        put(e['progress-label'],'CARGO SECURED');
        e.progress.lastElementChild?.classList.replace('active','done');
      }
      lastMission=sortie.id;
      drawLocalizer(ctx,flight,sortie,target);
      const relative=target?signedAngle(bearing-flight.heading):0;
      e.scope.setAttribute('aria-label',target?'Localizer: '+target.name+', bearing '+compassDegrees(bearing)+' degrees':flight.grounded?'Localizer: Kestrel Airfield, Runway 36':'Localizer: no active target');
      return {target,relative};
    },
    situate(flight,target,relative,camera,w,h){
      e.attitude.style.rotate=(-flight.bank*19).toFixed(1)+'deg';
      if(!target){e.marker.hidden=true;return;}
      vector.set(target.x,target.y+(target.r?target.r+8:8),target.z).project(camera);
      const inFront=Math.abs(relative)<1.52;
      if(inFront && vector.y<1 && vector.y>-.88 && Math.abs(vector.x)<.94){
        e.marker.hidden=false;
        e.marker.style.left=(w*(.5+vector.x*.5))+'px';
        e.marker.style.top=(h*(.5-vector.y*.5))+'px';
        put(e.marker.firstElementChild,target.r?target.name.toUpperCase():'RUNWAY 36');
      }else{
        e.marker.hidden=false;
        e.marker.style.left=relative>0?'68%':'32%';e.marker.style.top='27%';
        put(e.marker.firstElementChild,(relative<0?'◀ ':'')+'TARGET'+(relative>0?' ▶':''));
      }
    },
    setSound(enabled){
      e.sound.setAttribute('aria-pressed',String(enabled));
      e.sound.lastChild.textContent=enabled?' Sound on':' Sound off';
    },
    setCamera(wide){
      e.camera.setAttribute('aria-pressed',String(wide));
      e.camera.lastChild.textContent=wide?' Wide':' Chase';
    }
  };
}
