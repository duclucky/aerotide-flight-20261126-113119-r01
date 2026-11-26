
export const STRIP = { x:-26,near:35,far:-405,width:24,level:6 };
export const SHOALS = [
  [-22,-167,143,370,23,.9],[-304,-298,241,272,183,2.9],
  [-539,-700,290,294,235,1.1],[305,-466,208,227,154,3.4],
  [478,-848,294,229,218,4.4],[-188,-1154,216,248,146,5.2],
  [111,-1540,373,317,246,4.3],[-801,-1594,336,260,244,4.7],
  [761,-1546,388,406,266,2.7],[-1250,-2260,529,349,338,2.7],
  [660,-2460,703,514,425,2],[-329,-2350,310,331,305,3.2],
  [-279,345,146,131,85,3.8],[262,291,147,192,81,2.4]
];

function ease(a,b,value) {
  const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
  return t*t*(3-2*t);
}

export function islandHeight(island,x,z) {
  const [cx,cz,rx,rz,peak,seed]=island;
  const u=(x-cx)/rx,v=(z-cz)/rz, angle=Math.atan2(v,u);
  const r=Math.hypot(u,v)/(1+.11*Math.sin(3*angle+seed)+.08*Math.sin(5*angle-seed));
  if(r>1.19) return -10;
  const ribs=.79+.17*Math.sin(u*8+v*4+seed)+.12*Math.cos(v*7-u*6);
  let h=peak*Math.pow(Math.max(1-r,0),.88)*ribs+5.5*Math.exp(-Math.pow((r-.79)*6,2))-4;
  if(island===SHOALS[0]) {
    const side=1-ease(16,43,Math.abs(x-STRIP.x));
    const end=ease(STRIP.far-37,STRIP.far-7,z)*(1-ease(STRIP.near+6,STRIP.near+57,z));
    h+=(STRIP.level-h)*side*end;
  }
  return h;
}

export function groundAt(x,z) {
  let ground=0;
  for(const island of SHOALS) {
    if(Math.abs(x-island[0])<island[2]*1.3 && Math.abs(z-island[1])<island[3]*1.3) {
      ground=Math.max(ground,islandHeight(island,x,z));
    }
  }
  return ground;
}

export function onRunway(x,z) {
  return Math.abs(x-STRIP.x)<=STRIP.width/2 && z<=STRIP.near && z>=STRIP.far;
}
