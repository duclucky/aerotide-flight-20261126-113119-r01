
import * as T from './vendor/three.module.min.js';
import {constructArchipelago,buildBeaconGate} from './world.js';
import {buildCourierAircraft} from './aircraft.js';
import {createFlightCamera} from './camera.js';
import {launchAircraft,advanceFlight} from './flight.js';
import {SORTIES,startSortie,updateSortie} from './missions.js';
import {connectPilotControls} from './input.js';
import {bindFlightInstruments} from './hud.js';
import {buildRadioSound} from './audio.js';

function openFlightDeck() {
  const viewport=document.getElementById('viewport');
  const query=id=>document.getElementById(id);
  const scene=new T.Scene();
  let renderer;
  try {
    renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  } catch {
    query('graphics-error').hidden=false;
    return;
  }
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.NoToneMapping;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
  viewport.append(renderer.domElement);
  const coast=constructArchipelago(scene), model=buildCourierAircraft(scene);
  const view=createFlightCamera(),hud=bindFlightInstruments(),radio=buildRadioSound();
  const gates=Object.fromEntries(Object.entries(SORTIES).map(([id,config])=>[id,config.gates.map(gate=>buildBeaconGate(scene,gate))]));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let flight=launchAircraft('route'),sortie=startSortie('route');
  let width=1,height=1,last=0,simTime=0,elapsed=0,frameBudget=0;
  const before={x:0,y:0,z:0};
  const fixedStep=1/100;
  let readings;

  function resize() {
    width=Math.max(1,viewport.clientWidth);height=Math.max(1,viewport.clientHeight);
    renderer.setSize(width,height,false);
    view.resize(width,height);
  }
  new ResizeObserver(resize).observe(viewport);
  resize();

  function chooseSortie(id,active=false) {
    flight=launchAircraft(id);
    sortie=startSortie(id);
    sortie.status=active?'active':'ready';
    input.clear();
    view.reset();
    elapsed=0;frameBudget=0;
  }

  function handleCommand(action) {
    const stage=sortie.status;
    if(action==='mute'){
      hud.setSound(radio.toggle());return;
    }
    if(action==='camera'){
      hud.setCamera(view.toggle());return;
    }
    if(action==='restart'){
      chooseSortie(sortie.id,stage!=='ready');return;
    }
    if(action==='idle'){
      if(stage==='active') sortie.status='paused';
      return;
    }
    if(action==='pause'){
      if(stage==='active' || stage==='ready'){sortie.status='paused';input.clear();}
      else if(stage==='paused'){sortie.status='active';query('help').blur();}
      frameBudget=0;
      return;
    }
    if(action==='launch' || action==='steer'){
      if(stage==='ready') sortie.status='active';
      return;
    }
    if(action==='flaps' && !flight.grounded && ['active','ready'].includes(stage)){
      flight.flaps=!flight.flaps;
    }
  }

  const input=connectPilotControls(viewport,handleCommand);
  for(const id of Object.keys(SORTIES)) query(id).addEventListener('click',()=>{
    chooseSortie(id);query(id).blur();
  });
  for(const [id,action] of [['help','pause'],['sound','mute'],['camera','camera'],['restart','restart']]){
    query(id).addEventListener('click',()=>{handleCommand(action);query(id).blur();});
  }
  query('action').addEventListener('click',()=>{
    if(sortie.status==='paused') handleCommand('pause');
    else if(sortie.status==='ready') handleCommand('launch');
    else chooseSortie(sortie.id,true);
    query('action').blur();
  });

  function runSimulation(dt) {
    frameBudget+=dt;
    while(frameBudget>=fixedStep && sortie.status==='active'){
      frameBudget-=fixedStep;
      before.x=flight.x;before.y=flight.y;before.z=flight.z;
      const failure=advanceFlight(flight,input.read(fixedStep),fixedStep);
      const progress=sortie.index;
      const success=failure?null:updateSortie(sortie,before,flight);
      if(failure || success){
        sortie.status=failure?'failure':'success';sortie.reason=failure??success;
        if(failure){flight.damage=1;flight.intact=false;flight.bank=Math.sign(flight.bank||1)*.38;}
        radio.signal(sortie.status);
        input.clear();
      }else if(progress!==sortie.index){
        radio.signal('gate');
      }
    }
  }

  function showActiveGate() {
    for(const [id,list] of Object.entries(gates)) list.forEach((gate,i)=>{
      gate.visible=id===sortie.id && i>=sortie.index && i<=sortie.index+1;
      gate.scale.setScalar(i===sortie.index?1:.95);
    });
  }

  function render(now) {
    const dt=last?Math.min(.082,Math.max(0,(now-last)*.001)):0;
    last=now;
    if(sortie.status==='active') runSimulation(dt);
    if(!reduced.matches && !['paused','failure'].includes(sortie.status)) simTime+=dt;
    model(flight,simTime);
    view.follow(flight,dt);
    coast(view.camera,simTime);
    showActiveGate();
    elapsed+=dt;
    if(!readings || elapsed>=.055 || sortie.status!=='active'){
      readings=hud.update(flight,sortie);elapsed=0;
    }
    hud.situate(flight,readings.target,readings.relative,view.camera,width,height);
    radio.drive(flight,sortie.status==='active');
    renderer.render(scene,view.camera);
  }
  renderer.setAnimationLoop(render);
}

openFlightDeck();
