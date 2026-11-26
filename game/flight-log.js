const MAX_POINTS = 192;
const MAX_RECENT = 4;
const STORAGE_KEY = 'aerotide-flight-log-v1';
const point = flight => ({x:flight.x,z:flight.z,t:flight.seconds});

export function beginFlightLog(flight,gateCount) {
  const start = point(flight);
  const trail = [start];
  const splits = [];
  const startFuel = flight.fuel;
  let interval = .35;
  let next = interval;
  let touchdown = null;

  return {
    start, trail, splits,
    sample(flight,cleared,finished=false) {
      if(cleared>splits.length && splits.length<gateCount) splits.push(flight.seconds);
      if(!finished && flight.seconds<next) return;
      if(trail.length>=MAX_POINTS-1) {
        const kept=trail.filter((_,i)=>i%2===0 || i===trail.length-1);
        trail.splice(0,trail.length,...kept);
        interval*=2;
      }
      trail.push(point(flight));
      next=flight.seconds+interval;
    },
    contact(sample) {
      touchdown ??= sample;
    },
    summary(flight,sortie) {
      return {
        status:sortie.status, reason:sortie.reason, seconds:flight.seconds,
        cleared:sortie.index, gateCount, distance:sortie.distance,
        fuelUsed:Math.max(0,startFuel-flight.fuel), hull:1-flight.damage,
        splits:[...splits], touchdown
      };
    }
  };
}

export function formatFlightTime(seconds) {
  const ticks=Math.round(seconds*10);
  return String(Math.floor(ticks/600)).padStart(2,'0')+':'+
    String(Math.floor(ticks%600/10)).padStart(2,'0')+'.'+ticks%10;
}

export function reviewFlight(result) {
  if(result.status==='success') {
    if(result.touchdown && result.hull<.99) return 'Release descent a little earlier to protect the hull.';
    if(result.touchdown) return 'Stable arrival. Match this sink rate on your next approach.';
    return 'All beacons logged. Use your splits to see where a cleaner line saves time.';
  }
  if(result.reason==='Runway overrun') return 'Hold Space as soon as the wheels contact the runway.';
  if(result.reason==='Hard landing') return 'Aim for 55–85 kt and release descent near 32 ft to flare.';
  if(result.reason==='Runway alignment lost') return 'Line up with heading 000° and level the wings before crossing the threshold.';
  if(result.reason==='Terrain impact' || result.reason==='Water impact') return 'Maintain altitude until the approach is clear; check the chart before turning low.';
  return 'Use the chart to rejoin the route before you leave the radio sector.';
}

function validFlight(record,limit) {
  return record && ['success','failure'].includes(record.status) &&
    Number.isFinite(record.seconds) && record.seconds>0 && record.seconds<86400 &&
    Number.isInteger(record.cleared) && record.cleared>=0 && record.cleared<=limit &&
    (record.status!=='success' || record.cleared===limit);
}

function readRecords(raw,id) {
  const limit=id==='route'?4:1;
  const old=raw?.[id];
  const compact=({status,seconds,cleared})=>({status,seconds,cleared});
  const recent=Array.isArray(old?.recent)?old.recent.slice(0,MAX_RECENT).filter(r=>validFlight(r,limit)).map(compact):[];
  const best=validFlight(old?.best,limit) && old.best.status==='success'?compact(old.best):null;
  return {recent,best};
}

export function openPilotRecords(getStorage=()=>window.localStorage) {
  let storage,raw;
  try {
    storage=getStorage();
    const saved=storage.getItem(STORAGE_KEY);
    if(saved?.length<=12000) {
      try { raw=JSON.parse(saved); } catch { /* Invalid data is not a flight. */ }
    }
  } catch { storage=null; }
  const records={route:readRecords(raw,'route'),courier:readRecords(raw,'courier')};
  return {
    forMission(id){return records[id];},
    get sessionOnly(){return !storage;},
    record(id,{status,seconds,cleared}){
      const ledger=records[id];
      const entry={status,seconds,cleared};
      if(!ledger || !validFlight(entry,id==='route'?4:1)) return;
      ledger.recent.unshift(entry);
      ledger.recent.length=Math.min(ledger.recent.length,MAX_RECENT);
      if(status==='success' && (!ledger.best || seconds<ledger.best.seconds)) ledger.best=entry;
      try { storage?.setItem(STORAGE_KEY,JSON.stringify(records)); } catch { storage=null; }
    }
  };
}
