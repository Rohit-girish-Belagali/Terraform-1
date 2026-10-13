// TERRAFORM - generic engine. Every agricultural fact comes from kb/kb.json. Edit that file in your editor and refresh.
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STEPS = ['Input Echo','Missing Analysis','Fix Protocol','Readiness','Suitable Flora','Timeframe','Planting Method','Ongoing Care','Harvest'];
const SUB = ['Primary telemetry and visual feedback log','Soil archetype, deficiencies and environmental problems','Mandatory land remediation sequence','Hard readiness gate before planting','Environment-suitable flora catalog','Crop journey and harvest timeline','Planting directive for the active crop','Cultivation and defense directive','Harvest directive for the active crop'];
let KB = null, S = fresh(), busy = false;
function fresh(){return {step:1,done:{},seen:{},text:'',img:null,toggles:{},visual:{},an:null,editing:true,plot:'',ready:{},crop:null,err:'',note:false,sid:'S-'+Date.now().toString(36)}}
const term = m => { const e=$('#term'); if(e) e.textContent = m.toUpperCase(); };

async function boot(){
  try{ const r = await fetch('kb/kb.json?'+Date.now()); if(!r.ok) throw new Error('HTTP '+r.status); KB = dedupe(await r.json()); S = fresh(); $('#core').textContent='LOADED'; render(); term('knowledge base loaded'); }
  catch(e){ $('#view').innerHTML = `<section class="panel"><div class="pb"><div class="ln e">Could not load <b>kb/kb.json</b> (${esc(e.message)}). Run <b>python3 -m http.server 8765</b> in this folder and open http://localhost:8765. Check that the JSON is valid.</div></div></section>`; term('knowledge base load failed'); }
}
// Records pasted from several case files may repeat; keep the first copy of each id.
function dedupe(k){ for(const key of Object.keys(k)){ if(!Array.isArray(k[key])) continue; const seen=new Set(); k[key]=k[key].filter(o=>{ if(!o||!o.id) return true; if(seen.has(o.id)) return false; seen.add(o.id); return true; }); } return k; }

// ---------- engine ----------
const byId = (arr,id) => (arr||[]).find(x=>x.id===id);
function extract(){
  const feats = {}; const t = S.text.toLowerCase();
  KB.features.forEach(f=>{ if(!f.lexicon) return; const m = t.match(new RegExp(f.lexicon,'i')); if(m) feats[f.id]={src:'Reported in text',snip:m[0]}; });
  KB.features.forEach(f=>{ if(S.visual[f.id]) feats[f.id]={src:'Observed (user-confirmed from image)',snip:''}; });
  KB.toggles.forEach(tg=>{ if(!S.toggles[tg.id]) return;
    (tg.adds_features||[]).forEach(id=>{ if(!feats[id]) feats[id]={src:'Declared via toggle: '+tg.label,snip:''}; });
    (tg.cancels_features||[]).forEach(id=>delete feats[id]); });
  return feats;
}
function analyze(){
  const feats = extract(), has = id => !!feats[id], fired = [];
  KB.rules.filter(r=>r.type==='diagnostic').forEach(r=>{
    const w = r.when||{}, all=w.all||[], any=w.any||[], also=w.also_any||[];
    const ok = all.every(has) && (!any.length||any.some(has)) && (!also.length||also.some(has));
    const ev = [...all,...any,...also].filter(has);
    if(ok && ev.length >= (r.min_evidence||1)) fired.push({rule:r, evidence:ev});
  });
  const archs = [...new Set(fired.map(f=>f.rule.archetype))].map(id=>byId(KB.archetypes,id)).filter(Boolean);
  const stress = new Set(archs.flatMap(a=>a.stress_tags||[]));
  if(has('F-HIGH-HEAT')||has('F-NO-CANOPY')) stress.add('heat');
  const waterOk = !!S.toggles['T-WATER'] || (KB.meta.water_confirm_features||[]).some(has);
  const conflicts = (KB.meta.conflicts||[]).filter(p=>p.every(has));
  const missing = [];
  archs.forEach(a=>{ const e=a.typical_estimates||{}; if(e.ph_range==null) missing.push('Soil pH is not in the KB for '+a.name+'. Provide a lab value.'); });
  if(!waterOk) missing.push('Water access is unconfirmed; the water safety rule applies.');
  missing.push('Drainage is not measured; any drainage value shown is an estimate.');
  return {feats, fired, archs, stress:[...stress], waterOk, conflicts, missing, ts:new Date().toISOString()};
}
function procedures(){ const ids = S.an.archs.map(a=>a.id);
  return KB.procedures.filter(p=>p.applies_to.some(x=>ids.includes(x))).sort((a,b)=>(a.phase>b.phase)-(a.phase<b.phase)); }
function criteria(){ const ids = S.an.archs.map(a=>a.id); return KB.readiness_criteria.filter(c=>c.applies_to.some(x=>ids.includes(x))); }
function gate(){ const fails=[], unk=[];
  criteria().forEach(c=>{ const v=S.ready[c.id]; if(v==='fail') fails.push(c); else if(v!=='pass') unk.push(c); });
  return {state: fails.length?'NOT_READY':unk.length?'CONDITIONALLY_READY':'READY', fails, unk}; }
function crops(){
  const a = S.an, ids = a.archs.map(x=>x.id), out=[], ex=[];
  const sf = KB.rules.filter(r=>r.type==='safety_filter');
  KB.crops.forEach(c=>{ const why=[];
    if(c.status==='deprecated') why.push('Deprecated record');
    if(!c.soil_compat.some(x=>ids.includes(x))) why.push('Not compatible with the diagnosed archetype(s)');
    const bad = (c.avoid||[]).filter(x=>a.stress.includes(x)); if(bad.length) why.push('Avoids: '+bad.join(', ')+' (present on this land)');
    sf.forEach(r=>{ const cond=r.condition||{}, eff=r.effect_data||{}, tag=r.id+(r.legacy_name?' ('+r.legacy_name+')':'');
      if(cond.water_access && !a.waterOk && eff.require_water && !eff.require_water.includes(c.water)) why.push(tag+': water access unconfirmed, crop needs '+c.water+' water');
      if(cond.archetype_stress_any && cond.archetype_stress_any.some(x=>a.stress.includes(x)) && eff.exclude_feeder_class && eff.exclude_feeder_class.includes(c.feeder_class)) why.push(tag+': heavy feeder on depleted soil'); });
    if(why.length) ex.push({c,why}); else out.push({c, score:(c.tolerates||[]).filter(x=>a.stress.includes(x)).length});
  });
  out.sort((x,y)=>y.score-x.score); return {ok:out, ex};
}
const crop = () => S.crop ? byId(KB.crops, S.crop) : null;
const ruleTag = type => { const r = KB.rules.find(x=>x.type===type); return r ? (r.legacy_name||r.id) : ''; };

// ---------- UI helpers ----------
const tile = (k,v) => `<div class="tile"><small>${esc(k)}</small><b>${v}</b></div>`;
const ln = (tag,txt,cls='') => `<div class="ln ${cls}"><i>[${esc(tag)}]</i> ${txt}</div>`;
const miss = k => ln('KB DATA UNAVAILABLE', esc(KB.missing_data_messages[k]||'No verified KB data.'), 'w');
const stTag = s => s==='approved' ? '' : `<span class="unv">${esc(s.replace('_',' '))}</span>`;
const est = '<span class="est">ESTIMATE</span>';
function panel(n, body, stateOverride){
  const done = !!S.done[n], bad = stateOverride==='bad';
  return `<section class="panel"><div class="ph"><span class="stag">STEP 0${n}</span><div><h2>${STEPS[n-1].toUpperCase()}</h2><div class="sub">${esc(SUB[n-1])}</div></div>
   <span class="badge ${bad?'bad':done?'ok':'act'}">${bad?'BLOCKED':done?'&#10003; COMPLETED':'&#9679; ACTIVE'}</span></div><div class="pb">${body}</div></section>`;
}
function reach(){ let r=1; for(let n=1;n<=9;n++){ if(!S.done[n]) break; r=n+1; } return Math.min(9,r); }
function valid(n){ if(!S.an) return false;
  if(n===1||n===3) return true; if(n===2) return S.an.archs.length>0; if(n===4) return gate().state!=='NOT_READY'; if(n===5) return !!S.crop; return !!S.crop; }
function complete(n){ if(valid(n)) S.done[n]=true; else for(let k=n;k<=9;k++) delete S.done[k]; }
function inputChanged(){ S.done={}; S.seen={}; S.an=null; S.ready={}; S.crop=null; S.note=false; }

// ---------- navigation + loader ----------
const LOAD = {
 2:()=>['INPUT RECORD LOADED','RETRIEVING SOIL PROFILES FROM KB','MATCHING EVIDENCE AGAINST '+KB.rules.filter(r=>r.type==='diagnostic').length+' DIAGNOSTIC RULES','VALIDATING EVIDENCE THRESHOLDS'],
 3:()=>['RETRIEVING REMEDIATION PROCEDURES','CHECKING PREREQUISITES AND DEPENDENCIES','ORDERING PHASE A / PHASE B'],
 4:()=>['RETRIEVING READINESS CRITERIA','APPLYING HARD READINESS GATE ('+ruleTag('readiness')+')'],
 5:()=>['RETRIEVING CROP RECORDS','APPLYING SAFETY FILTERS ('+ruleTag('safety_filter')+')','RANKING VERIFIED CANDIDATES'],
 6:()=>['RECALIBRATING FOR '+(crop()?.name||'CROP').toUpperCase(),'RETRIEVING CROP CYCLE RECORD','BUILDING TIMELINE'],
 7:()=>['RECALIBRATING FOR '+(crop()?.name||'CROP').toUpperCase(),'RETRIEVING PLANTING PROTOCOL'],
 8:()=>['RECALIBRATING FOR '+(crop()?.name||'CROP').toUpperCase(),'RETRIEVING CARE PROTOCOL','RETRIEVING PEST AND DISEASE RECORDS'],
 9:()=>['RECALIBRATING FOR '+(crop()?.name||'CROP').toUpperCase(),'RETRIEVING HARVEST PROTOCOL']};
function runLoader(n, lines, then){
  busy = true; let i=0;
  $('#view').innerHTML = `<section class="panel"><div class="scan"></div><div class="ph"><span class="stag">STEP 0${n}</span><div><h2>${STEPS[n-1].toUpperCase()}</h2><div class="sub">Processing...</div></div><span class="badge act">&#9679; LOADING</span></div>
   <div class="load"><div class="lines" id="ll"></div><div class="bar"><i id="lb" style="width:0"></i></div></div></section>`;
  const t = setInterval(()=>{ if(i<lines.length){ $('#ll').insertAdjacentHTML('beforeend','<div>'+esc(lines[i])+'</div>'); term(lines[i]); i++; $('#lb').style.width = (i/lines.length*100)+'%'; }
    else { clearInterval(t); setTimeout(()=>{ busy=false; then(); }, 250); } }, 380);
}
function go(n){ if(busy || n>reach() || n===S.step && !S.editing) return; enter(n); }
function enter(n){
  S.step = n; if(n===1){ render(); return; }
  if(S.seen[n]){ complete(n); render(); return; }
  runLoader(n, LOAD[n](), ()=>{ S.seen[n]=true; S.typeNow=true; complete(n); render(); });
}
function proceed(){ if(busy||S.step>=9) return; const n=S.step+1; if(n>reach()) return; enter(n); }
function back(){ if(busy) return; if(S.step===1){ S.editing=true; render(); } else enter(S.step-1); }

// ---------- render ----------
function render(){
  if(!KB) return;
  $('#kbname').textContent = KB.meta.name+' v'+KB.meta.kb_version;
  $('#build').textContent = 'SYSTEM ANALYSIS RESULT // SESSION '+S.sid.toUpperCase();
  $('#flora').textContent = 'FLORA: '+(crop()?crop().name.toUpperCase():'NONE SELECTED');
  $('#crumb').textContent = S.step===1 && S.editing ? 'AWAKENING ▸ INPUT ▸ ANALYSIS' : 'STEP '+S.step+' OF 9';
  $('#packet').innerHTML = `◆ DATA PACKET ${Object.keys(S.done).length}/9 LOADED ◆`;
  const r = reach();
  $('#steps').innerHTML = STEPS.map((n,i)=>{ const k=i+1; return `<button class="${k===S.step&&!(k===1&&S.editing)?'on':S.done[k]?'dn':k>r?'lk':''}" onclick="go(${k})">${k}. ${n}</button>`; }).join('');
  const fn = [v1,v2,v3,v4,v5,v6,v7,v8,v9][S.step-1];
  $('#view').innerHTML = fn() + audit();
  if(S.step===1 && S.editing) bind1();
  if(S.typeNow){ S.typeNow=false; typeAll(); }
}
function typeAll(){ document.querySelectorAll('.type').forEach(el=>{ const t=el.textContent; el.textContent=''; let i=0; const id=setInterval(()=>{ el.textContent=t.slice(0,i+=3); if(i>=t.length){ el.textContent=t; clearInterval(id);} },12); }); }
function actions(prevOk=true, nextLabel='PROCEED ▸', nextOk){
  const last = S.step===9;
  return `<div class="act"><button class="btn alt" onclick="back()">◂ REVERT</button>${last?`<button class="btn" onclick="S=fresh();render();term('awaiting directive...')">RESTART WITH NEW LAND CASE</button>`
   :`<button class="btn" ${nextOk===undefined?(S.step+1<=reach()?'':'disabled'):(nextOk?'':'disabled')} onclick="proceed()">${nextLabel}</button>`}</div>`; }
function audit(){ if(!S.an) return '';
  const rec = {session:S.sid, kb:KB.meta.name, kb_version:KB.meta.kb_version, timestamp:S.an.ts, matched_rules:S.an.fired.map(f=>f.rule.id), archetypes:S.an.archs.map(a=>a.id),
    observations:Object.keys(S.an.feats), procedures:S.step>=3?procedures().map(p=>p.id):[], readiness:S.step>=4?gate().state:null, selected_crop:S.crop, missing_data_warnings:S.an.missing};
  return `<details><summary>AUDIT TRAIL</summary><pre>${esc(JSON.stringify(rec,null,1))}</pre></details>`; }

// ---------- step 1 ----------
function v1(){ return (S.an && !S.editing) ? echo() : input(); }
function input(){
  const lim = KB.meta.text_limit||3000, im = S.img, visual = KB.features.filter(f=>f.kind==='visual');
  return `<section class="panel"><div class="ph"><span class="stag">INPUT</span><div><h2>LAND OBSERVATION</h2><div class="sub">Describe the land, upload an image, or both</div></div><span class="badge act">&#9679; AWAITING</span></div><div class="pb">
  ${S.err?ln('INPUT ERROR',esc(S.err),'e'):''}
  <div class="two"><div class="box"><div class="hd"><span>&#62;_ [ OBSERVATION LOG ]</span><span>INPUT MODE: TEXT TELEMETRY</span></div>
    <textarea id="txt" placeholder="Describe the land. Terrain, soil feel, colour, moisture, surroundings, weather...">${esc(S.text)}</textarea>
    <div class="cnt"><span>[ CTRL / CMD + ENTER TO TRANSMIT ]</span><span>CHARS: <b id="cnt">${S.text.length}</b> / ${lim}</span></div></div>
   <div class="box"><div class="hd"><span>[ VISUAL FEED ]</span><span>INPUT MODE: OPTICAL TELEMETRY</span></div>
    ${im?`<div class="drop" style="cursor:default"><img src="${im.url}"></div><div class="meta"><span>FILE: ${esc(im.name)}</span><span>RES: ${im.w}x${im.h}</span><span>SIZE: ${(im.size/1024).toFixed(1)} KB</span></div>
      <div class="meta"><label class="btn sm alt" style="cursor:pointer">REPLACE<input id="img" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="btn sm alt" onclick="S.img=null;render()">PURGE IMAGE</button></div>`
     :`<label class="drop" id="drop"><b>[ UPLOAD OPTICAL FEED ]</b><span>PNG, JPEG or WebP. Click or drop a file.</span><input id="img" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>`}</div></div>
  ${im?`<div class="box" style="margin-top:14px"><div class="hd"><span>CONFIRM WHAT YOU CAN SEE IN THE IMAGE</span><span>(counted as observed)</span></div><div class="tg">${visual.map(f=>`<label class="${S.visual[f.id]?'sel':''}"><input type="checkbox" data-v="${f.id}" hidden ${S.visual[f.id]?'checked':''}>${esc(f.label)}</label>`).join('')}</div></div>`:''}
  <div class="box" style="margin-top:14px"><div class="hd"><span>AUXILIARY PARAMETERS (UI TOGGLES)</span></div><div class="tg">${KB.toggles.map(t=>`<label class="${S.toggles[t.id]?'sel':''}"><input type="checkbox" data-t="${t.id}" hidden ${S.toggles[t.id]?'checked':''}>${esc(t.label)}</label>`).join('')}</div>
   <div class="cnt" style="margin-top:10px"><span>PLOT AREA (m2, optional; used only with verified rates)</span><input type="number" id="plot" min="0" value="${esc(S.plot)}" style="width:110px;border:1px solid var(--line);padding:3px 6px;font:inherit"></div></div>
  <div class="act"><div class="status"><span>TEXT INPUT (<b id="tc" class="${S.text.trim()?'':'no'}">${S.text.length}/${lim}</b>)</span><span>VISUAL INPUT <b class="${im?'':'no'}">${im?'&#10003;':'&ndash;'}</b></span></div>
   <button class="btn" onclick="submit1()">&#10148; TRANSMIT TO SYSTEM</button></div></div></section>`;
}
function bind1(){
  const t=$('#txt'); if(t){ t.oninput=()=>{ S.text=t.value; $('#cnt').textContent=t.value.length; $('#tc').textContent=t.value.length+'/'+(KB.meta.text_limit||3000); $('#tc').className=t.value.trim()?'':'no'; }; t.onkeydown=e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter') submit1(); }; }
  document.querySelectorAll('[data-v]').forEach(c=>c.onchange=()=>{ S.visual[c.dataset.v]=c.checked; c.parentElement.classList.toggle('sel',c.checked); });
  document.querySelectorAll('[data-t]').forEach(c=>c.onchange=()=>{ S.toggles[c.dataset.t]=c.checked; c.parentElement.classList.toggle('sel',c.checked); });
  const p=$('#plot'); if(p) p.oninput=()=>S.plot=p.value;
  const f=$('#img'); if(f) f.onchange=()=>loadImg(f.files[0]);
  const d=$('#drop'); if(d){ d.ondragover=e=>{e.preventDefault();d.classList.add('hv')}; d.ondragleave=()=>d.classList.remove('hv'); d.ondrop=e=>{e.preventDefault(); loadImg(e.dataTransfer.files[0]);}; }
}
function loadImg(file){ if(!file) return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){ S.err='Unsupported image format. Use PNG, JPEG or WebP.'; render(); return; }
  const url=URL.createObjectURL(file), im=new Image();
  im.onload=()=>{ S.img={name:file.name,size:file.size,w:im.naturalWidth,h:im.naturalHeight,url}; S.err=''; render(); term('optical feed received'); };
  im.onerror=()=>{ S.err='Image upload failed: the file could not be read. Try another file.'; render(); }; im.src=url; }
function submit1(){
  if(busy) return; const t=$('#txt'); if(t) S.text=t.value;
  const vis = Object.values(S.visual).some(Boolean), lim = KB.meta.text_limit||3000;
  const fail = m => { S.err=m; render(); term('input error'); };
  if(!S.text.trim() && !S.img && !vis) return fail('No input: enter a land description and/or upload an image.');
  if(S.text.length>lim) return fail(`Text is ${S.text.length} characters; the limit is ${lim}. Shorten it and transmit again.`);
  if(S.img && !S.text.trim() && !vis) return fail('Image received, but no observations were confirmed. Tick what you can see in the image, or add a text description.');
  S.err=''; inputChanged();
  const lines = ['INPUT COLLECTED ('+S.text.length+' CHARS'+(S.img?', 1 IMAGE':'')+')','EXTRACTING OBSERVABLE FEATURES','RETRIEVING KB RECORDS (v'+KB.meta.kb_version+')','EVALUATING '+KB.rules.filter(r=>r.type==='diagnostic').length+' DIAGNOSTIC RULES','VALIDATING EVIDENCE'];
  runLoader(1, lines, ()=>{ try{ S.an=analyze(); S.done[1]=true; S.seen[1]=true; S.editing=false; S.typeNow=true; }catch(e){ S.err='Analysis failed: '+e.message+'. Retry or check the KB file.'; S.editing=true; } render(); term('data packet 1/9 loaded'); });
}
function echo(){ const a=S.an, im=S.img, ents=Object.entries(a.feats);
  const r14 = ruleTag('safety_filter');
  return panel(1, `<p class="dir"><b>&gt; TELEMETRY RECORD:</b> <span class="type">"${esc(S.text||'(no text provided)')}"</span></p>
  <p class="dir"><b>&gt; OPTICAL TELEMETRY:</b> ${im?`Optical feed [${esc(im.name)}] processed (${im.w}x${im.h}px, ${(im.size/1024).toFixed(1)} KB). Only features confirmed by the user count as observed.`:'No optical feed supplied.'}</p>
  <p class="dir"><b>&gt; AUDITABLE REASONING DIRECTIVE:</b> Observed features are recorded before any archetype classification. No archetype conclusion is drawn in Step 1.</p>
  <div class="tiles">${tile('Raw telemetry length',S.text.length+' characters')}${tile('Optical record',im?esc(im.name):'None')}${tile('External water access',a.waterOk?'Confirmed':'Unconfirmed'+(r14?' (rule '+esc(r14)+' applies)':''))}
   ${tile('Canopy exposure',a.feats['F-NO-CANOPY']?'Exposed':S.toggles['T-SHADE']?'Shaded (declared)':'Unknown')}${tile('Inference lock','Estimates stay labelled as estimates')}</div>
  <h3>OBSERVATIONS EXTRACTED</h3>${ents.length?ents.map(([id,f])=>ln(byId(KB.features,id)?.label||id, esc(f.src)+(f.snip?' &mdash; "'+esc(f.snip)+'"':''))).join(''):ln('NO FEATURES','No known features were found in the input.','w')}
  ${actions()}`); }

// ---------- step 2 ----------
function v2(){ const a=S.an;
  if(!a.archs.length) return panel(2, ln('INSUFFICIENT EVIDENCE',esc(KB.missing_data_messages.low_evidence),'e')+`<div class="act"><button class="btn alt" onclick="S.editing=true;S.step=1;render()">◂ EDIT INPUT</button><span></span></div>`,'bad');
  const x = a.archs, e = x.map(q=>q.typical_estimates||{});
  const j = k => [...new Set(e.map(o=>o[k]).filter(Boolean))].join(' / ');
  return panel(2, `${x.length>1?ln('MIXED CONDITIONS',x.length+' archetypes matched. They are not mutually exclusive.','o'):''}
  ${a.conflicts.map(c=>ln('CONFLICTING SIGNALS',c.map(id=>esc(byId(KB.features,id)?.label)).join(' + ')+'. Verify on site.','w')).join('')}
  <div class="tiles">${tile('Identified archetype',x.map(q=>esc(q.name)+' '+stTag(q.status)).join('<br>'))}${tile('Core gap summary',esc([...new Set(x.flatMap(q=>q.core_gaps||[]))].join(', ')))}
   ${j('texture_class')?tile('Texture class',esc(j('texture_class'))+est):''}${j('drainage')?tile('Drainage behavior',esc(j('drainage'))+est):''}
   ${tile('Estimated pH range',j('ph_range')?esc(j('ph_range'))+est:'Not in KB')}${j('organic_matter')?tile('Organic matter status',esc(j('organic_matter'))+est):''}${j('cec')?tile('CEC',esc(j('cec'))+est):''}</div>
  <h3>CLASSIFICATION CRITERIA</h3>${x.map(q=>ln(q.id,esc(q.criteria)+(q.variants?'<br>Variants in KB: '+esc(q.variants.join('; ')):''))).join('')}
  <h3>DECISION ENGINE RULES MATCHED</h3>${a.fired.map(f=>ln('MATCHED RULE '+f.rule.id,esc(f.rule.concludes)+'<br>Evidence: '+f.evidence.map(id=>esc(byId(KB.features,id)?.label)).join('; '))).join('')}
  <h3>MISSING ELEMENTS</h3>${a.missing.map(m=>ln('MISSING',esc(m),'w')).join('')}${actions()}`); }

// ---------- step 3 ----------
function v3(){ const ps=procedures(), area=parseFloat(S.plot);
  if(!ps.length) return panel(3, ln('KB DATA UNAVAILABLE','No remediation procedures in the KB for the diagnosed archetype(s).','w')+actions());
  let n=0;
  return panel(3, ['A','B'].map(ph=>{ const l=ps.filter(p=>p.phase===ph); if(!l.length) return '';
    return `<h3>FIX PHASE ${ph} — ${ph==='A'?'IMMEDIATE INTERVENTION':'BIOLOGICAL / SECONDARY AMELIORATION'}</h3>`+l.map(p=>{ n++; return `<div class="crop"><h4>SEQUENCE ${n}: ${esc(p.name)} ${stTag(p.status)}</h4>
     <div class="sub">${p.id} &middot; Targets: ${esc(p.targets.join(', '))} &middot; Materials: ${esc((p.materials||[]).join(', '))}</div>
     ${p.prerequisites?.length?ln('PREREQUISITES',esc(p.prerequisites.join('; '))):''}
     <ol>${p.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
     ${p.rate==null?miss('no_rate')+(p.rate_note?ln('NOTE',esc(p.rate_note)):''):ln('QUANTITY',esc((p.rate+' '+(p.unit||'')).trim())+(area>0&&typeof p.rate==='number'&&/per m2/.test(p.unit||'')?' &rarr; '+(p.rate*area).toFixed(1)+' '+esc(p.unit.split(' per m2')[0])+' total for '+area+' m2':''),'o')}
     ${p.safety?ln('SAFETY',esc(p.safety.join(' ')),'w'):''}${ln('VERIFY',esc((p.verification||[]).join('; ')||'none listed'))}</div>`; }).join(''); }).join('')+actions()); }

// ---------- step 4 ----------
function v4(){ const cs=criteria(), g=gate(), stab=byId(KB.readiness_criteria,'RC-STAB');
  const cls = g.state==='READY'?'o':g.state==='NOT_READY'?'e':'w';
  return panel(4, `${ln('HARD READINESS GATE','Planting recommendations from Step 5 onward are conditional on this gate. A check that has not been run is never assumed to pass.')}
  <div class="tiles">${tile('Gate status',g.state.replace(/_/g,' '))}${tile('Stabilization window',stab?(stab.window_days!=null?stab.window_days+' days':'Not in KB'):'Not required')}${tile('Succession logic','Rule '+esc(ruleTag('readiness')||'-')+' enforced')}</div>
  ${g.fails.map(c=>ln('FAILED: '+c.name,esc(c.if_failed),'e')).join('')}
  ${g.state==='CONDITIONALLY_READY'?ln('UNVERIFIED','Not assumed to pass: '+g.unk.map(c=>esc(c.name)).join(', '),'w'):''}
  ${g.state==='NOT_READY'?ln('BLOCKED','Planting is blocked. Correct the failed items, re-check, and the gate re-evaluates.','e'):''}
  <h3>READINESS CHECKS</h3>${cs.map(c=>`<div class="crop"><div class="row"><div><b>${esc(c.name)}</b> ${c.mandatory?'<span class="unv">mandatory</span>':''}<div class="sub">${esc(c.check)}</div>${c.id==='RC-STAB'&&c.window_days==null?miss('no_readiness_window'):''}</div>
    <div class="seg"><button class="p ${S.ready[c.id]==='pass'?'sel':''}" onclick="setR('${c.id}','pass')">PASS</button><button class="f ${S.ready[c.id]==='fail'?'sel':''}" onclick="setR('${c.id}','fail')">FAIL</button></div></div></div>`).join('')}
  ${actions(true,'PROCEED ▸', g.state!=='NOT_READY')}`, g.state==='NOT_READY'?'bad':undefined); }
function setR(id,v){ S.ready[id] = S.ready[id]===v ? '' : v; complete(4); term('readiness gate: '+gate().state.replace(/_/g,' ')); render(); }

// ---------- step 5 ----------
function v5(){ const r=crops(), tags=KB.rules.filter(x=>x.type==='safety_filter').map(x=>x.id+(x.legacy_name?' ('+x.legacy_name+')':'')).join(', ');
  return panel(5, `<div class="tiles">${tile('Suitable species count',r.ok.length)}${tile('Safety filters applied',esc(tags))}${tile('Active target flora',crop()?esc(crop().name):'None selected')}</div>
  ${gate().state==='CONDITIONALLY_READY'?ln('CONDITIONAL','Land is only conditionally ready. Complete the unverified checks before sowing.','w'):''}
  ${!r.ok.length?ln('NO CANDIDATES','No suitable crop candidates in the KB for these conditions. Add crop records or adjust inputs.','e'):''}
  <h3>VERIFIED CANDIDATES</h3>${r.ok.map(({c})=>`<div class="crop ${S.crop===c.id?'sel':''}"><div class="row"><div><h4>${esc(c.name)} ${stTag(c.status)}</h4><div class="sub"><i>${esc(c.scientific||'')}</i> &middot; ${esc(c.category)}</div></div>
    <button class="btn sm ${S.crop===c.id?'':'alt'}" onclick="pick('${c.id}')">${S.crop===c.id?'ACTIVE TARGET':'SELECT'}</button></div>
    <div>${esc(c.role)}</div><div class="sub">WATER: ${esc(c.water)} &middot; LIGHT: ${esc(c.light)} &middot; CYCLE: ${c.duration_days?c.duration_days.join('-')+' days':'not in KB'} &middot; TOLERATES: ${esc((c.tolerates||[]).join(', ')||'-')} &middot; AVOIDS: ${esc((c.avoid||[]).join(', ')||'-')}</div></div>`).join('')}
  ${r.ex.length?`<details><summary>EXCLUDED BY SAFETY FILTER / COMPATIBILITY (${r.ex.length})</summary>${r.ex.map(({c,why})=>`<p><b>${esc(c.name)}</b></p>${why.map(w=>ln('EXCLUDED',esc(w),'w')).join('')}`).join('')}</details>`:''}
  ${actions(true,'PROCEED ▸', !!S.crop)}`); }
function pick(id){ if(busy) return; const changed = S.crop && S.crop!==id; S.crop=id; S.note=!!changed; for(let k=6;k<=9;k++){ delete S.done[k]; delete S.seen[k]; } complete(5); term('active target flora: '+crop().name); render(); }

// ---------- steps 6-9 ----------
const needCrop = n => panel(n, ln('NO CROP','Select a crop in Step 05 first.','e'), 'bad');
const head = c => `<div class="tiles">${tile('Active target flora',esc(c.name)+' '+stTag(c.status))}${S.note?tile('Status','Recalculated after crop change'):''}</div>`;
function v6(){ const c=crop(); if(!c) return needCrop(6); const g=gate(), stab=byId(KB.readiness_criteria,'RC-STAB');
  return panel(6, head(c)+`<div class="tl"><div><b>1 REMEDIATION</b>${procedures().length} procedures<br>duration not in KB</div><div><b>2 STABILIZATION</b>${stab&&stab.window_days!=null?stab.window_days+' days':'window not in KB'}</div><div><b>3 READINESS</b>${g.state.replace(/_/g,' ')}</div><div><b>4 CROP CYCLE</b>${c.duration_days?c.duration_days.join('-')+' days':'not in KB'}</div></div>
  ${c.duration_days==null?miss('no_crop_duration'):ln('HARVEST WINDOW',c.duration_days[0]+'-'+c.duration_days[1]+' days after sowing'+(c.duration_note?'. '+esc(c.duration_note):'')+'. Counted from sowing, which only happens after remediation and a passed readiness gate. No fixed date is promised.','o')}
  <h3>CROP JOURNEY</h3>${KB.phases.journey.map(p=>ln('JOURNEY '+p.id+' — '+p.name.toUpperCase(), c.phase_days&&c.phase_days[p.id]?esc(c.phase_days[p.id]+' days'):'Phase duration not in KB for this crop.', c.phase_days&&c.phase_days[p.id]?'':'w')).join('')}${actions()}`); }
function v7(){ const c=crop(); if(!c) return needCrop(7); const p=c.planting||{}, g=gate();
  return panel(7, head(c)+ln('PLANTING READINESS','Gate status: '+g.state.replace(/_/g,' ')+(g.state!=='READY'?'. Do not sow until all readiness checks have passed.':''), g.state==='READY'?'o':'w')+
  `<div class="tiles">${tile('Planting depth',p.depth==null?'Not in KB':esc(p.depth))}${tile('Plant spacing',p.spacing==null?'Not in KB':esc(p.spacing))}${tile('Sowing method',p.method?esc(p.method):'Not in KB')}${tile('Water requirement',esc(c.water))}${tile('Light requirement',esc(c.light))}</div>
  ${p.depth==null||p.spacing==null?miss('no_planting_spec'):''}${actions()}`); }
function v8(){ const c=crop(); if(!c) return needCrop(8); const k=c.care||{};
  const list=(a,l,t)=>a&&a.length?a.map(x=>ln(t,esc(x))).join(''):ln('KB DATA UNAVAILABLE','No verified '+l+' in the KB for this crop.','w');
  return panel(8, head(c)+`<h3>FERTILIZER &amp; NUTRITION SCHEDULE</h3>${k.fertilizer?ln('PRIMARY FERTILIZER',esc(k.fertilizer)):ln('KB DATA UNAVAILABLE','No verified fertilizer schedule in the KB for this crop.','w')}
  <h3>DISEASE WATCH</h3>${list(k.diseases,'disease entries','DISEASE')}<h3>PEST SHIELD</h3>${list(k.pests,'pest entries','PEST')}
  <h3>BIO-PESTICIDES &amp; DEFENSE CONTROLS</h3>${list(k.controls,'controls','CONTROL')}<h3>LAND STRESSORS TO ACCOUNT FOR</h3>${ln('STRESSORS',esc(S.an.stress.join(', ')||'none identified'))}${actions()}`); }
function v9(){ const c=crop(); if(!c) return needCrop(9); const h=c.harvest||{};
  return panel(9, head(c)+`<div class="tiles">${tile('Harvest window',c.duration_days?c.duration_days.join('-')+' days after sowing':'Not in KB')}${tile('Harvest method',h.method?esc(h.method):'Not in KB')}</div>
  ${c.duration_days?'':miss('no_crop_duration')}<h3>MATURITY INDICATORS</h3>${h.indicators&&h.indicators.length?h.indicators.map(x=>ln('MATURITY',esc(x))).join(''):ln('KB DATA UNAVAILABLE','No verified indicators in the KB.','w')}${actions()}`); }
window.go=go; window.proceed=proceed; window.back=back; window.pick=pick; window.setR=setR; window.submit1=submit1;
boot();
