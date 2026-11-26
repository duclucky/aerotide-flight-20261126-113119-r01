
import * as T from './vendor/three.module.min.js';
import {groundAt} from './airspace.js';

export function createFlightCamera() {
  const camera=new T.PerspectiveCamera(53,1,.48,12800);
  const desired=new T.Vector3(),aim=new T.Vector3(),targetAim=new T.Vector3();
  let initialized=false,wider=false;
  function follow(state,dt) {
    const dx=Math.sin(state.heading),dz=-Math.cos(state.heading);
    const trail=wider?42:26.5,rise=wider?14.5:7.3;
    desired.set(state.x-dx*trail,state.y+rise,state.z-dz*trail);
    desired.y=Math.max(desired.y,groundAt(desired.x,desired.z)+3);
    targetAim.set(state.x+dx*46,state.y+(wider?-4:2)+state.pitch*17,state.z+dz*46);
    if(!initialized){
      camera.position.copy(desired);aim.copy(targetAim);initialized=true;
    }else{
      camera.position.lerp(desired,1-Math.exp(-dt*5.4));
      aim.lerp(targetAim,1-Math.exp(-dt*6.6));
    }
    camera.lookAt(aim);
    camera.updateMatrixWorld();
  }
  return {
    camera,follow,
    reset(){initialized=false;},
    toggle(){wider=!wider;return wider;},
    resize(w,h){camera.aspect=w/h;camera.updateProjectionMatrix();}
  };
}
