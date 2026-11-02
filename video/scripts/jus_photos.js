const { chromium } = require('playwright');
const fs = require('fs');
const D = [
 { id:'souffle', c:'#bcd56c', c2:'#8fae3c', ing:['🍈','🍏','🌿','🍋'], top:'foam', foam:'#e6ec9a' },
 { id:'jardin', c:'#cfa896', c2:'#9b6f5c', ing:['🍌','🌰','🍫','🥛'], top:'choc' },
 { id:'tutti', c:'#f08c93', c2:'#d45d6a', ing:['🍓','🍌','🍎'], top:'rim', rim:'🍓' },
 { id:'zen', c:'#c3ad3c', c2:'#8f8a26', ing:['🍍','🥭','🌿','🍏'] },
 { id:'greenshake', c:'#a7b850', c2:'#6f8a2e', ing:['🍌','🥭','🍈','🥥'] },
 { id:'extragreen', c:'#679a42', c2:'#3f6e2a', ing:['🍏','🥒','🍐','🌿'] },
 { id:'greensour', c:'#d0744f', c2:'#a44a35', ing:['🍑','🍓','🍋'] , top:'rim', rim:'🍋'},
 { id:'greensweet', c:'#82a05a', c2:'#56763a', ing:['🍌','🥥','🌿'] },
 { id:'halva', c:'#e3b886', c2:'#bf8a55', ing:['🍌','🌰','🥛'], top:'crumbs' },
 { id:'chaperon', c:'#cf3a55', c2:'#9a2238', ing:['🍓','🫐','🍒'], top:'berries' },
];
function mix(hex, w, a){ const h=hex.replace('#',''); const n=[0,2,4].map(i=>parseInt(h.substr(i,2),16)); const m=n.map(v=>Math.round(v*(1-a)+w*a)); return `rgb(${m.join(',')})`; }
function rnd(seed){ let s=seed; return ()=> (s = (s*16807)%2147483647)/2147483647; }
function svg(d, k, nobg){
  const r = rnd(1000+k*77);
  const W=640,H=448, cx=320, ty=92, by=404, tw=118, bw=80; // demi-largeurs
  const xAt=(y,side)=>{ const t=(y-ty)/(by-ty); const hw=tw+(bw-tw)*t; return cx+side*hw; };
  const ly=128; // niveau du liquide
  let specks='';
  for(let i=0;i<170;i++){ const y=ly+8+r()*(by-ly-14); const x0=xAt(y,-1)+6, x1=xAt(y,1)-6; const x=x0+r()*(x1-x0); const rr=0.8+r()*2.2; const dark=r()<0.65; specks+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}" fill="${dark?d.c2:'#fff'}" opacity="${dark?0.35:0.25}"/>`; }
  let ribs=''; for(let y=ty+40;y<by;y+=7){ ribs+=`<line x1="${xAt(y,-1)}" y1="${y}" x2="${xAt(y,1)}" y2="${y}" stroke="#fff" stroke-opacity=".07" stroke-width="1.2"/>`; }
  const cup=`M${xAt(ty,-1)},${ty} L${xAt(ty,1)},${ty} L${xAt(by,1)},${by} Q${cx},${by+10} ${xAt(by,-1)},${by} Z`;
  const liq=`M${xAt(ly,-1)+4},${ly} Q${cx},${ly-8} ${xAt(ly,1)-4},${ly} L${xAt(by,1)-3},${by-2} Q${cx},${by+7} ${xAt(by,-1)+3},${by-2} Z`;
  let top='';
  if(d.top==='foam') top=`<path d="M${xAt(ly,-1)+4},${ly} Q${cx},${ly-8} ${xAt(ly,1)-4},${ly} L${xAt(ly+26,1)-4},${ly+26} Q${cx},${ly+20} ${xAt(ly+26,-1)+4},${ly+26} Z" fill="${d.foam}" opacity=".9"/>`;
  if(d.top==='choc'){ for(let i=0;i<4;i++){ const x=cx-75+i*50; const y2=ly+120+r()*120; top+=`<path d="M${x},${ly} C${x+18},${ly+50} ${x-18},${(ly+y2)/2+20} ${x+6},${y2}" stroke="#4a2618" stroke-width="${8+r()*3}" fill="none" stroke-linecap="round" opacity=".8"/>`; } top+=`<path d="M${xAt(ly,-1)+4},${ly} Q${cx},${ly-8} ${xAt(ly,1)-4},${ly} L${xAt(ly+12,1)-4},${ly+12} Q${cx},${ly+6} ${xAt(ly+12,-1)+4},${ly+12} Z" fill="#4a2618" opacity=".85"/>`; }
  if(d.top==='crumbs'){ for(let i=0;i<40;i++){ const x=cx-95+r()*190, y=ly-6+r()*10; top+=`<circle cx="${x}" cy="${y}" r="${1.5+r()*2.5}" fill="#f6e2b8"/>`; } }
  const shadow=`<ellipse cx="${cx}" cy="${by+6}" rx="120" ry="16" fill="#000" opacity=".16" filter="url(#bl${k})"/>`;
  const straw=`<g transform="rotate(14 ${cx+40} ${ty})"><rect x="${cx+28}" y="${ty-52}" width="17" height="224" rx="8" fill="#fff"/><rect x="${cx+28}" y="${ty-52}" width="17" height="224" rx="8" fill="url(#stripes${k})"/></g>`;
  const bg1=mix(d.c,255,.84), bg2=mix(d.c,255,.66);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg${k}" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".45" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></radialGradient>
    <linearGradient id="liq${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(d.c,255,.12)}"/><stop offset="1" stop-color="${d.c2}"/></linearGradient>
    <linearGradient id="side${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".22" stop-color="#fff" stop-opacity=".22"/><stop offset=".32" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
    <pattern id="stripes${k}" width="17" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><rect width="17" height="9" fill="#FF6A13"/></pattern>
    <clipPath id="lc${k}"><path d="${liq}"/></clipPath>
    <filter id="bl${k}"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  ${nobg?"":`<rect width="${W}" height="${H}" fill="url(#bg${k})"/><rect y="${by-6}" width="${W}" height="${H-by+6}" fill="${mix(d.c2,255,.7)}" opacity=".35"/>`}
  ${shadow}
  ${straw}
  <path d="${cup}" fill="#fff" fill-opacity=".28" stroke="#fff" stroke-opacity=".75" stroke-width="2.5"/>
  <g clip-path="url(#lc${k})"><path d="${liq}" fill="url(#liq${k})"/>${specks}${top}${ribs}</g>
  <path d="${cup}" fill="url(#side${k})"/>
  <path d="M${xAt(ty+18,-1)+16},${ty+18} L${xAt(by-20,-1)+14},${by-20}" stroke="#fff" stroke-opacity=".55" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="${cx}" cy="${ty}" rx="${tw+4}" ry="10" fill="#fff" fill-opacity=".35" stroke="#fff" stroke-width="3"/>
  </svg>`;
}
function html(d,k){
  const r=rnd(500+k*31);
  const spots=[[70,330,96,-12],[168,372,74,10],[478,372,78,-8],[566,322,94,14]];
  const n=d.ing.length; const use = n===3? [0,2,3] : [0,1,2,3];
  const ings=d.ing.map((e,i)=>{ const s=spots[use[i]]; return `<span style="left:${s[0]}px;top:${s[1]}px;font-size:${s[2]}px;transform:translate(-50%,-50%) rotate(${s[3]}deg)">${e}</span>`; }).join('');
  let extra='';
  if(d.top==='berries') extra=['🍓','🫐','🍒','🫐','🍓'].map((e,i)=>`<span style="left:${250+i*35}px;top:${86-(i%2)*10}px;font-size:${i%2?40:50}px;transform:translate(-50%,-50%) rotate(${i*17-30}deg)">${e}</span>`).join('');
  if(d.top==='rim') extra=`<span style="left:420px;top:96px;font-size:62px;transform:translate(-50%,-50%) rotate(20deg)">${d.rim}</span>`;
  return `<!doctype html><meta charset="utf-8"><style>body{margin:0}#w{position:relative;width:640px;height:448px;overflow:hidden}span{position:absolute;font-family:'Noto Color Emoji';line-height:1;filter:drop-shadow(0 8px 8px rgba(0,0,0,.18))}</style><div id="w">${svg(d,k)}${ings}${extra}</div>`;
}
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:640,height:448},deviceScaleFactor:1});
  for(let k=0;k<D.length;k++){ await p.setContent(html(D[k],k)); await p.waitForTimeout(150); await p.screenshot({path:`${D[k].id}.png`}); }
  // Couverture : 5 verres alignés
  const pick=[0,9,2,5,8];
  const cups=pick.map((i,j)=>`<div style="position:absolute;left:${600+(j-2)*196-228}px;top:${j===2?40:66}px;transform:scale(${j===2?.76:.72});transform-origin:0 0">${svg(D[i],i,true)}</div>`).join('');
  const fr=[['🍓',250,370,66,-10],['🍍',450,382,68,8],['🍌',700,388,62,-6],['🥭',860,380,66,10],['🍋',1020,368,62,-12]].map(f=>`<span style="left:${f[1]}px;top:${f[2]}px;font-size:${f[3]}px;transform:translate(-50%,-50%) rotate(${f[4]}deg)">${f[0]}</span>`).join('');
  await p.setViewportSize({width:1200,height:500});
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0}#w{position:relative;width:1200px;height:500px;overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#fff 0,#fbeee0 40%,#f6d9bd 100%)}span{position:absolute;font-family:'Noto Color Emoji';line-height:1;filter:drop-shadow(0 8px 8px rgba(0,0,0,.18))}svg{display:block}</style><div id="w">${cups}${fr}</div>`);
  await p.waitForTimeout(200); await p.screenshot({path:'cover.png'});
  // Logo : verre sur bleu nuit + HOP!
  await p.setViewportSize({width:400,height:400});
  const cup=svg(D[5],50,true).replace('width="640" height="448"','width="352" height="246"');
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0}#w{position:relative;width:400px;height:400px;overflow:hidden;background:#0F1F3D}#c{position:absolute;left:24px;top:26px}#t{position:absolute;left:0;right:0;bottom:58px;text-align:center;font:900 76px/1 Inter,Arial,sans-serif;color:#fff;letter-spacing:-1px}#t i{font-style:normal;color:#FF6A13}#s{position:absolute;left:0;right:0;bottom:28px;text-align:center;font:800 24px/1 Inter,Arial,sans-serif;color:#FF6A13;letter-spacing:4px}</style><div id="w"><div id="c">${cup}</div><div id="t">HOP<i>!</i></div><div id="s">JUS · מיצים</div></div>`);
  await p.waitForTimeout(200); await p.screenshot({path:'logo.png'});
  await b.close();
})();
