
export function connectPilotControls(field,command) {
  const keys=new Set();
  const captured=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
    'ShiftLeft','ShiftRight','ControlLeft','ControlRight','Space','KeyF','KeyM','KeyR','Escape','KeyC','KeyN']);
  let stick=null,wheel=0;
  const limit=value=>Math.max(-1,Math.min(1,value));
  const clear=()=>{keys.clear();stick=null;wheel=0;field.classList.remove('steering');};
  window.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();command('idle');}});
  window.addEventListener('keydown',event=>{
    if(event.altKey || event.metaKey || (event.ctrlKey && !event.code.startsWith('Control') &&
      !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))) return;
    if(event.target.closest?.('dialog[open]') && event.code!=='KeyN') return;
    if(!captured.has(event.code) || (event.target.closest?.('button') && event.code==='Space')) return;
    event.preventDefault();
    keys.add(event.code);
    if(event.repeat) return;
    const actions={KeyF:'flaps',KeyM:'mute',KeyR:'restart',Escape:'pause',KeyC:'camera',KeyN:'chart',Space:'launch'};
    if(actions[event.code]) command(actions[event.code]);
    else if(!event.target.closest?.('button')) command('steer');
  });
  window.addEventListener('keyup',event=>keys.delete(event.code));
  field.addEventListener('pointerdown',event=>{
    if(event.button!==0) return;
    stick={id:event.pointerId,homeX:event.clientX,homeY:event.clientY,x:0,y:0};
    field.setPointerCapture(event.pointerId);
    field.classList.add('steering');
    command('steer');
  });
  field.addEventListener('pointermove',event=>{
    if(event.pointerId!==stick?.id) return;
    stick.x=limit((event.clientX-stick.homeX)/95);
    stick.y=limit((event.clientY-stick.homeY)/95);
  });
  const release=event=>{
    if(stick?.id===event.pointerId){stick=null;field.classList.remove('steering');}
  };
  for(const event of ['lostpointercapture','pointerup','pointercancel']) field.addEventListener(event,release);
  field.addEventListener('wheel',event=>{
    event.preventDefault();
    wheel=limit(wheel-Math.sign(event.deltaY)*.54);
    command('steer');
  },{passive:false});
  const down=(...codes)=>codes.some(code=>keys.has(code))?1:0;
  return {
    clear,
    read(dt){
      const power=limit(down('ShiftLeft','ShiftRight')-down('ControlLeft','ControlRight')+wheel);
      wheel*=Math.exp(-dt*9);
      return {
        power,brake:!!down('Space'),
        roll:limit(down('KeyD','ArrowRight')-down('KeyA','ArrowLeft')+(stick?.x??0)),
        pitch:limit(down('KeyW','ArrowUp')-down('KeyS','ArrowDown')-(stick?.y??0))
      };
    }
  };
}
