
export function buildRadioSound() {
  let context,master,engine,pulse,engineGain;
  let enabled=false;
  function connect() {
    context=new AudioContext();
    master=context.createGain();
    master.gain.value=0;
    master.connect(context.destination);
    engineGain=context.createGain();
    engineGain.gain.value=.10;
    engineGain.connect(master);
    engine=context.createOscillator();
    engine.type='triangle';
    engine.frequency.value=54;
    engine.connect(engineGain);
    engine.start();
    pulse=context.createOscillator();
    pulse.frequency.value=12;
    const modulation=context.createGain();
    modulation.gain.value=.019;
    pulse.connect(modulation).connect(engineGain.gain);
    pulse.start();
  }
  return {
    toggle(){
      enabled=!enabled;
      if(enabled){
        if(!context) connect();
        context.resume().catch(()=>{});
      }
      return enabled;
    },
    drive(state,active){
      if(!context) return;
      const now=context.currentTime;
      master.gain.setTargetAtTime(enabled?(active?.48:.12):0,now,.14);
      engine.frequency.setTargetAtTime(36+state.speed*.42+state.throttle*23,now,.13);
      pulse.frequency.setTargetAtTime(8+state.throttle*11,now,.12);
    },
    signal(outcome){
      if(!context || !enabled) return;
      const notes=outcome==='failure'?[230,147,93]:outcome==='success'?[392,523,659,784]:[659,988];
      notes.forEach((hz,i)=>{
        const time=context.currentTime+i*.095;
        const tone=context.createOscillator();
        const gain=context.createGain();
        tone.frequency.value=hz;
        gain.gain.setValueAtTime(.001,time);
        gain.gain.exponentialRampToValueAtTime(.25,time+.025);
        gain.gain.exponentialRampToValueAtTime(.001,time+.22);
        tone.connect(gain).connect(master);
        tone.start(time);
        tone.stop(time+.24);
      });
    }
  };
}
