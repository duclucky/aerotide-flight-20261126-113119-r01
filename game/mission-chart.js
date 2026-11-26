import {SHOALS,STRIP} from './airspace.js';
import {SORTIES} from './missions.js';
import {compassDegrees} from './flight.js';
import {formatFlightTime,reviewFlight} from './flight-log.js';

const NS='http://www.w3.org/2000/svg';
const W=600,H=422;

function chartElement(tag,attributes,text) {
  const el=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(attributes)) el.setAttribute(key,value);
  if(text!==undefined) el.textContent=text;
  return el;
}

function fitFlightArea(points) {
  const x=points.map(point=>point.x),z=points.map(point=>point.z);
  const left=Math.min(...x),right=Math.max(...x),top=Math.min(...z),bottom=Math.max(...z);
  const zoom=Math.min((W-110)/Math.max(right-left,450),(H-100)/Math.max(bottom-top,580));
  return {zoom, project(x,z){
    return [W/2+(x-(left+right)/2)*zoom,H/2+(z-(top+bottom)/2)*zoom];
  }};
}

export function plotMissionChart(svg,flight,sortie,log) {
  const gates=SORTIES[sortie.id].gates;
  const threshold={x:STRIP.x,z:STRIP.near},end={x:STRIP.x,z:STRIP.far};
  const plan=[log.start,...gates,...(sortie.id==='courier'?[threshold]:[])];
  const trace=[...log.trail,flight];
  const {zoom,project}=fitFlightArea([...plan,...trace,threshold,end]);
  const coords=points=>points.map(p=>project(p.x,p.z).map(n=>n.toFixed(1)).join(',')).join(' ');
  const plot=document.createDocumentFragment();
  const draw=(tag,attrs,text)=>plot.append(chartElement(tag,attrs,text));
  const line=(x1,y1,x2,y2,cls)=>draw('line',{x1,y1,x2,y2,class:cls});
  const label=(x,y,txt,cls='plot-label')=>draw('text',{x,y,class:cls},txt);
  const scale=[25,50,100,250,500,1000,2000].findLast(m=>m*zoom<90)??25;
  const spacing=scale*zoom;
  const [originX,originY]=project(0,0);
  for(let x=(originX%spacing+spacing)%spacing;x<W;x+=spacing) line(x,0,x,H,'chart-grid');
  for(let y=(originY%spacing+spacing)%spacing;y<H;y+=spacing) line(0,y,W,y,'chart-grid');
  for(const [x,z,rx,rz] of SHOALS) {
    const [cx,cy]=project(x,z);
    if(cx+rx*zoom<0 || cx-rx*zoom>W || cy+rz*zoom<0 || cy-rz*zoom>H) continue;
    const shore=[];
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12;
      const r=1+.10*Math.sin(3*a)+.06*Math.cos(5*a);
      shore.push({x:x+rx*r*Math.cos(a),z:z+rz*r*Math.sin(a)});
    }
    draw('polygon',{points:coords(shore),class:'chart-land'});
  }
  const [rx,ry]=project(threshold.x,threshold.z),[ex,ey]=project(end.x,end.z);
  line(rx,ry,ex,ey,'chart-runway');
  const bounds=Math.max(7,STRIP.width*zoom);
  line(rx-bounds,ry,rx+bounds,ry,'chart-threshold');
  draw('polyline',{points:coords(plan),class:'chart-plan'});
  draw('polyline',{points:coords(trace),class:'chart-trail'});
  label(rx+13,(ry+ey)/2+5,'RWY 36');
  for(const [i,gate] of gates.entries()) {
    const [x,y]=project(gate.x,gate.z);
    const status=i<sortie.index?'cleared':i===sortie.index && sortie.status!=='failure'?'current':'future';
    draw('circle',{cx:x,cy:y,r:11,class:'chart-gate '+status});
    label(x,y+4,String(i+1),'chart-gate-number');
    label(x+(x>W-145?-18:18),y-9,gate.name,x>W-145?'plot-label align-left':'plot-label');
  }
  const [px,py]=project(flight.x,flight.z);
  draw('path',{d:'M0 -13 L9 9 L0 5 L-9 9 Z',class:'chart-plane',
    transform:'translate('+px+' '+py+') rotate('+compassDegrees(flight.heading)+')'});
  label(W-32,25,'N','chart-gate-number');
  draw('path',{d:'M568 31l-6 13 6-3 6 3Z',class:'chart-plane'});
  line(20,H-24,20+spacing,H-24,'chart-threshold');
  line(20,H-28,20,H-20,'chart-threshold');
  line(20+spacing,H-28,20+spacing,H-20,'chart-threshold');
  label(20,H-8,scale+' m');
  svg.replaceChildren(plot);
}

export function connectMissionChart({snapshot,onOpen,onClose}) {
  const get=id=>document.getElementById(id);
  const dialog=get('mission-chart'),close=get('close-chart'), trigger=get('chart-button');
  const ledger=get('chart-ledger'),map=get('chart-plot'), splits=get('chart-splits');
  let restoreFocus=null;

  function write(id,content) {
    get(id).textContent=content;
  }

  function renderChart() {
    const {flight,sortie,log,records}=snapshot();
    const config=SORTIES[sortie.id],terminal=['failure','success'].includes(sortie.status);
    const result=log.summary(flight,sortie), history=records.forMission(sortie.id);
    write('chart-title',terminal?'Flight debrief':'Mission chart');
    write('chart-kicker',config.call.toUpperCase()+' / SORTIE '+config.number);
    write('chart-subtitle',config.label+' · '+(terminal?sortie.reason:sortie.status==='ready'?'Preflight':'Flight suspended'));
    const remaining=config.gates.length-sortie.index;
    write('chart-progress',sortie.index+' / '+config.gates.length+(sortie.id==='courier'?' approach':' gates'));
    write('chart-distance',(sortie.distance/1852).toFixed(2)+' NM');
    write('chart-time',formatFlightTime(result.seconds));
    write('chart-fuel',(result.fuelUsed*100).toFixed(1)+' pp');
    write('chart-hull',Math.round(result.hull*100)+'%');
    write('chart-feedback',terminal?reviewFlight(result):remaining
      ? 'Follow the numbered route. Amber marks the next gate; the mint line traces your flight.'
      : 'Approach cleared. Align north along Runway 36 and brake after touchdown.');
    const touch=result.touchdown;
    write('chart-contact',touch
      ? 'Runway contact: '+Math.round(touch.speed*1.944)+' kt · '+Math.round(touch.sink*196.85)+' fpm down · '+
          Math.round(Math.abs(touch.bank)*180/Math.PI)+'° bank · '+compassDegrees(touch.heading)+'° heading.'
      : sortie.id==='courier'?'No runway contact observed.':'');
    get('chart-contact').hidden=sortie.id!=='courier';
    splits.replaceChildren(...config.gates.map((gate,i)=>{
      const item=document.createElement('li');
      const name=document.createElement('span'),time=document.createElement('span');
      name.textContent=(i+1)+' · '+gate.name;
      time.textContent=log.splits[i]===undefined?(terminal?'Not reached':'—'):formatFlightTime(log.splits[i]);
      item.append(name,time);
      return item;
    }));
    write('chart-record-mode',records.sessionOnly?'SESSION RECORDS':'LOCAL RECORDS');
    write('chart-best',history.best?'Best · '+formatFlightTime(history.best.seconds):'No completion recorded');
    ledger.replaceChildren(...history.recent.map((entry)=>{
      const item=document.createElement('li');
      item.textContent=(entry.status==='success'?'Complete':'Aborted')+' · '+formatFlightTime(entry.seconds)+
        ' · '+entry.cleared+'/'+config.gates.length;
      return item;
    }));
    if(!history.recent.length) {
      const empty=document.createElement('li');
      empty.textContent='No completed or aborted flights yet.';
      ledger.append(empty);
    }
    plotMissionChart(map,flight,sortie,log);
  }

  function open() {
    if(dialog.open) return;
    restoreFocus=document.activeElement;
    onOpen();
    renderChart();
    dialog.showModal();
    close.focus();
    trigger.setAttribute('aria-expanded','true');
  }
  dialog.addEventListener('close',()=>{
    trigger.setAttribute('aria-expanded','false');
    onClose();
    if(restoreFocus instanceof HTMLElement && restoreFocus!==document.body) restoreFocus.focus();
  });
  close.addEventListener('click',()=>dialog.close());
  trigger.addEventListener('click',open);
  get('review-flight').addEventListener('click',open);
  return {open, get visible(){return dialog.open;}, close:()=>dialog.close()};
}
