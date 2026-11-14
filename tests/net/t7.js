// real Chromium, real WebRTC, local PeerServer: the lobby from the buttons
const {chromium}=require('playwright');
const ROOT=process.env.ROOT||'http://127.0.0.1:8771';
const RH=process.env.ROOT_H||ROOT,RJ=process.env.ROOT_J||ROOT,Q='/index.html?peer=127.0.0.1:9000';
const which=(process.env.ONLY||'').split(',').filter(Boolean);
async function mk(b,qs,root){const c=await b.newContext({viewport:{width:1280,height:720},permissions:['microphone']});const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_|404/.test(m.text()))p.errs.push('CONSOLE '+m.text().slice(0,160));});await p.goto(root+Q+qs);await p.waitForFunction(()=>window.KKNet&&document.getElementById('btnOnline'));return p;}
const members=(p)=>p.evaluate(()=>document.querySelectorAll('#netMembers .net-m:not(.empty)').length);
async function pair(b,label,qh,qj,opt){
  opt=opt||{}; const H=await mk(b,qh,RH),J=await mk(b,qj,RJ); const out=[]; let pass=true;
  try{
    await H.click('#btnOnline');
    if(opt.pub){await H.waitForFunction(()=>/empty/.test(document.querySelector('#netRooms .net-room-b').textContent),null,{timeout:15000});await H.click('#netRooms .net-room-b');}
    else await H.click('#netCreate');
    await H.waitForSelector('#net.v-room',{timeout:15000});
    const code=(await H.textContent('#netRoomCode')).trim();
    await J.click('#btnOnline');const t0=Date.now();
    if(opt.pub){await J.waitForFunction(()=>/1 \/ 4|no answer/.test(document.querySelector('#netRooms .net-room-b').textContent),null,{timeout:25000});out.push('list shows "'+(await J.textContent('#netRooms .net-room-b')).replace(/\s+/g,' ')+'" after '+(Date.now()-t0)+'ms');
      const pcs=await J.evaluate(()=>{const p=window.KKNet.state.peer;return p&&p._connections?[...p._connections.values()].reduce((a,x)=>a+x.length,0):-1;});out.push('joiner connections after list: '+pcs);await J.click('#netRooms .net-room-b');}
    else{await J.fill('#netCode',code);await J.click('#netJoin');}
    const t1=Date.now();
    await J.waitForSelector('#net.v-room',{timeout:30000});out.push('joined in '+(Date.now()-t1)+'ms');
    await H.waitForFunction(()=>document.querySelectorAll('#netMembers .net-m:not(.empty)').length===2,null,{timeout:8000});
    const jr=await J.evaluate(()=>!!window.KKNet.state.hostConn.relay);out.push(jr?'via relay':'direct');
    if(opt.want&&((opt.want==='relay')!==jr))throw new Error('expected '+opt.want);
    out.push('members H/J '+await members(H)+'/'+await members(J));
    await J.click('#netSab');await H.waitForFunction(()=>/INTRUDER/.test(document.getElementById('netMembers').textContent),null,{timeout:8000});out.push('seat change reached host');
    await J.click('#netTower');await H.waitForFunction(()=>!document.getElementById('netStart').disabled,null,{timeout:8000});
    if(!jr){await H.waitForFunction(()=>Object.keys(window.KKNet.state.calls).length===1,null,{timeout:12000}).then(()=>out.push('voice call up'),()=>{out.push('NO voice call');});}
    await H.click('#netStart',{timeout:90000,noWaitAfter:true});
    await J.waitForSelector('#net.v-tower',{timeout:20000});
    await J.waitForFunction(()=>/\d:\d\d/.test(document.getElementById('twTime').textContent),null,{timeout:30000});
    const a=await J.textContent('#twTime');await J.waitForFunction((x)=>document.getElementById('twTime').textContent!==x,a,{timeout:40000});const c2=await J.textContent('#twTime');out.push('tower clock '+a+' -> '+c2+', pilot phase '+await H.evaluate(()=>window.__kk.G&&window.__kk.G.phase));
    out.push('host view '+await H.evaluate(()=>window.KKNet.state.view));
    await J.click('#twLeave');
    await H.waitForFunction(()=>/left the lobby/.test(document.getElementById('netToast').textContent),null,{timeout:50000});out.push('host saw the leave');
  }catch(e){pass=false;out.push('FAIL '+String(e.message).split('\n')[0]);
    out.push('J: '+await J.evaluate(()=>(document.getElementById('netStatus')||{}).textContent+' | '+(document.getElementById('netDiag')||{}).textContent+' | '+document.getElementById('net').className).catch(()=>''));}
  console.log((pass?'PASS ':'FAIL ')+label+': '+out.join(' · ')+(H.errs.length||J.errs.length?'\n   ERRS H:'+[...new Set(H.errs)].slice(0,5).join(' | ')+' J:'+[...new Set(J.errs)].slice(0,5).join(' | '):''));
  await H.context().close();await J.context().close();
}
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const S=[['direct','direct host, direct joiner','','',{want:'direct'}],['relay','relay host, relay joiner','&relay=1','&relay=1',{want:'relay'}],['mixed','direct host, relay joiner','','&relay=1',{want:'relay'}],['public','public room from the list (direct)','','',{pub:1,want:'direct'}],['pubrelay','public room from the list (relay joiner)','','&relay=1',{pub:1,want:'relay'}]];
 for(const s of S){if(which.length&&which.indexOf(s[0])<0)continue;await pair(b,s[1],s[2],s[3],s[4]);}
 await b.close();})();
