(() => {
  const D = window.COFFEE_DATA;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const LS = {prefs:'coffeeDialer:prefs',history:'coffeeDialer:history',steps:'coffeeDialer:steps',recipe:'coffeeDialer:recipe',preset:'coffeeDialer:preset'};
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const presets = D.presets?.length ? D.presets : [{id:'baseline',label:'基準レシピ',...D.baseline}];
  const state = {
    activePresetId:localStorage.getItem(LS.preset)||presets[0].id,
    recipe:clone(D.baseline),
    steps:clone(D.baseline.steps),
    recommendation:null,
    timer:{running:false,startAt:0,elapsed:0,raf:0,lastCue:-1}
  };

  const secToClock = sec => {
    sec = Math.max(0,Math.round(Number(sec)||0));
    const m = Math.floor(sec/60), s = sec%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  const clockToSec = val => {
    if(!val) return 0;
    const p = val.split(':').map(Number);
    if(p.length===3) return p[0]*3600+p[1]*60+p[2];
    return p[0]*60+p[1];
  };
  const fmt = sec => {
    const t=Math.max(0,sec); const m=Math.floor(t/60); const s=(t-m*60).toFixed(1).padStart(4,'0');
    return `${m}:${s}`;
  };
  const safeNum=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;

  function currentPreset(){
    const id=$('#baselineSelect')?.value||state.activePresetId;
    return presets.find(x=>x.id===id)||presets[0];
  }

  function initSelect(sel, items, selected){
    sel.innerHTML=items.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${x.label}</option>`).join('');
  }
  function loadPrefs(){ try{return {...Object.fromEntries(D.preferences.map(x=>[x.id,x.default])),...JSON.parse(localStorage.getItem(LS.prefs)||'{}')}}catch{return Object.fromEntries(D.preferences.map(x=>[x.id,x.default]))} }
  function loadHistory(){ try{return JSON.parse(localStorage.getItem(LS.history)||'[]')}catch{return []} }
  function loadSavedRecipe(){ try{return JSON.parse(localStorage.getItem(LS.recipe)||'null')}catch{return null} }
  function loadSavedSteps(){ try{return JSON.parse(localStorage.getItem(LS.steps)||'null')}catch{return null} }

  function renderBaseline(presetId=state.activePresetId){
    const b=presets.find(x=>x.id===presetId)||presets[0];
    state.activePresetId=b.id;
    localStorage.setItem(LS.preset,b.id);
    $('#baselineSelect').value=b.id;
    $('#baselineTitle').textContent=b.label;
    $('#baselineStats').innerHTML=[['豆',`${b.dose}g`],['湯',`${b.water}g`],['C5 Pro',`${b.grind}`],['目安',`${fmt(b.drawdown)}`]].map(([k,v])=>`<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    $('#baselineNote').textContent=b.note||'この条件を出発点に、実際の味から1変数ずつ調整します。';
  }

  function renderPreferences(){
    const prefs=loadPrefs();
    $('#preferenceControls').innerHTML=D.preferences.map(p=>`<div class="slider-row"><span>${p.label}</span><input type="range" min="1" max="5" step="1" value="${prefs[p.id]}" data-pref="${p.id}"><span class="slider-value" data-pref-out="${p.id}">${prefs[p.id]}</span></div>`).join('');
    $$('[data-pref]').forEach(el=>el.addEventListener('input',()=>{document.querySelector(`[data-pref-out="${el.dataset.pref}"]`).textContent=el.value; updateRecommendation();}));
  }

  function renderTaste(){
    $('#tasteControls').innerHTML=D.taste.map(p=>`<div class="slider-row"><span>${p.label}</span><input type="range" min="1" max="5" step="1" value="${p.default}" data-taste="${p.id}"><span class="slider-value" data-taste-out="${p.id}">${p.default}</span></div>`).join('');
    $$('[data-taste]').forEach(el=>el.addEventListener('input',()=>{document.querySelector(`[data-taste-out="${el.dataset.taste}"]`).textContent=el.value;}));
  }

  function readRecipe(){
    return {
      beanName:$('#beanName').value.trim()||'コーヒー豆',roast:$('#roast').value,brewer:$('#brewer').value,grinder:$('#grinder').value,
      dose:safeNum($('#dose').value,10),water:safeNum($('#water').value,260),temp:safeNum($('#temp').value,93),grind:safeNum($('#grind').value,25),
      pourEnd:clockToSec($('#pourEnd').value),drawdown:clockToSec($('#drawdown').value)
    };
  }

  function syncReviewTimes(){
    $('#actualPourEnd').value=secToClock(state.recipe.pourEnd);
    $('#actualDrawdown').value=secToClock(state.recipe.drawdown);
  }

  function applyRecipe(r, save=true){
    state.recipe={...state.recipe,...r};
    $('#beanName').value=state.recipe.beanName; $('#roast').value=state.recipe.roast; $('#brewer').value=state.recipe.brewer; $('#grinder').value=state.recipe.grinder;
    $('#dose').value=state.recipe.dose; $('#water').value=state.recipe.water; $('#temp').value=state.recipe.temp; $('#grind').value=state.recipe.grind;
    $('#pourEnd').value=secToClock(state.recipe.pourEnd); $('#drawdown').value=secToClock(state.recipe.drawdown);
    if(save) localStorage.setItem(LS.recipe,JSON.stringify(state.recipe));
    updateComputed(); updateRecommendation(); syncReviewTimes();
  }

  function loadPreset(preset){
    state.activePresetId=preset.id;
    localStorage.setItem(LS.preset,preset.id);
    renderBaseline(preset.id);
    applyRecipe(clone(preset));
    state.steps=clone(preset.steps||[]);
    saveSteps(); renderSteps(); resetTimer();
  }

  function updateComputed(){
    const r=readRecipe(); state.recipe=r; localStorage.setItem(LS.recipe,JSON.stringify(r));
    const ratio=r.dose>0?r.water/r.dose:0; $('#ratioText').textContent=`1:${ratio.toFixed(1)}`;
    const g=D.grinders.find(x=>x.id===r.grinder); $('#grindHint').textContent=g?`${g.label}: ${g.hint}`:'';
  }

  function getPrefsFromUI(){ return Object.fromEntries($$('[data-pref]').map(x=>[x.dataset.pref,Number(x.value)])); }

  function generateRecommendation(){
    const r=readRecipe(), prefs=getPrefsFromUI();
    const rec={...r}; let title='まずは現状維持',body='現在の条件は基準として成立しています。味の評価を保存してから1変数ずつ調整します。',reason='抽出条件を同時に複数変えると、どの変更が味に効いたか判断しにくいためです。',changed=[];
    const ratio=r.water/r.dose;
    if(r.roast==='dark' && r.temp>=94 && prefs.bitterness<=2){ rec.temp=r.temp-2; title='湯温だけ2℃下げて比較'; body=`${r.temp}℃ → ${rec.temp}℃。豆量・挽き目・湯量は変えません。`;reason='深煎りで苦味を増やしたくない場合、まず温度だけを下げると比較が明確です。';changed.push(['湯温',`${r.temp}℃ → ${rec.temp}℃`]); }
    else if(r.brewer==='63metal' && ratio<20 && prefs.clarity>=4){ rec.dose=Math.max(4,Math.round((r.dose-.5)*2)/2); title='豆量だけ0.5g減らして比較';body=`${r.dose}g → ${rec.dose}g。挽き目と温度は維持します。`;reason='金属フィルターでは油分と微粉がカップに残りやすいため、すっきり感を上げたい場合は濃度を少し下げる比較が有効です。';changed.push(['豆量',`${r.dose}g → ${rec.dose}g`]); }
    else if(r.grinder==='c5pro' && r.grind<20 && r.brewer==='63metal'){ rec.grind=r.grind+2;title='挽き目だけ粗くして比較';body=`C5 Pro ${r.grind} → ${rec.grind}。`;reason='ロクサンの細かいメッシュでは細挽きほど流れが遅くなりやすいため、まず粗さだけを変えます。';changed.push(['挽き目',`${r.grind} → ${rec.grind}`]); }
    return {recipe:rec,title,body,reason,changed};
  }

  function updateRecommendation(){
    const rec=generateRecommendation(); state.recommendation=rec;
    $('#recommendTitle').textContent=rec.title; $('#recommendBody').textContent=rec.body; $('#recommendReason').textContent=rec.reason;
    $('#recommendDiff').innerHTML=rec.changed.length?rec.changed.map(([k,v])=>`<span class="chip changed">${k}: ${v}</span>`).join(''):'<span class="chip">変更なし</span>';
    $('#applyRecommendation').disabled=!rec.changed.length;
  }

  function renderSteps(){
    $('#stepsEditor').innerHTML=state.steps.map((s,i)=>`<div class="step-row"><label>時刻<input type="number" min="0" step="1" value="${s.time}" data-step-time="${i}"></label><label>内容<input type="text" value="${s.label}｜${s.target}" data-step-text="${i}"></label><button class="danger" data-step-del="${i}">削除</button></div>`).join('');
    $$('[data-step-time]').forEach(el=>el.onchange=()=>{state.steps[+el.dataset.stepTime].time=Math.max(0,+el.value||0);saveSteps();renderSteps();});
    $$('[data-step-text]').forEach(el=>el.onchange=()=>{const i=+el.dataset.stepText,[label,...rest]=el.value.split('｜');state.steps[i].label=label||'工程';state.steps[i].target=rest.join('｜')||'';saveSteps();});
    $$('[data-step-del]').forEach(el=>el.onclick=()=>{state.steps.splice(+el.dataset.stepDel,1);saveSteps();renderSteps();});
  }
  function saveSteps(){state.steps.sort((a,b)=>a.time-b.time);localStorage.setItem(LS.steps,JSON.stringify(state.steps));}

  let audioCtx=null;
  function beep(freq=880,dur=.08){
    try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;g.gain.value=.035;o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);}catch{}
  }
  function timerTick(now){
    if(!state.timer.running)return;
    const elapsed=state.timer.elapsed+(now-state.timer.startAt)/1000;
    $('#timerDisplay').textContent=fmt(elapsed);
    const stepTimes=state.steps.map(x=>x.time);
    const total=Math.max(...stepTimes,readRecipe().drawdown||1,1);
    $('#timerProgress').style.width=`${Math.min(100,elapsed/total*100)}%`;
    const next=state.steps.find(s=>s.time>elapsed);
    const current=[...state.steps].reverse().find(s=>s.time<=elapsed);
    $('#timerTarget').textContent=current?`${current.label}：${current.target}`:'準備';
    const second=Math.floor(elapsed);
    if(second!==state.timer.lastCue){
      state.timer.lastCue=second;
      if(next && Math.ceil(next.time-elapsed)===3) beep(660,.05);
      const exact=state.steps.find(s=>Math.abs(s.time-elapsed)<.12); if(exact){beep(980,.12); try{navigator.vibrate?.(100)}catch{}}
    }
    if(elapsed>total+30){stopTimer(true);return;}
    state.timer.raf=requestAnimationFrame(timerTick);
  }
  function startTimer(){
    if(state.timer.running)return; audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); audioCtx.resume?.();
    state.timer.running=true;state.timer.startAt=performance.now();state.timer.lastCue=-1;state.timer.raf=requestAnimationFrame(timerTick);
  }
  function pauseTimer(){ if(!state.timer.running)return; state.timer.elapsed+=(performance.now()-state.timer.startAt)/1000;state.timer.running=false;cancelAnimationFrame(state.timer.raf); }
  function stopTimer(auto=false){ pauseTimer(); if(auto) $('#timerTarget').textContent='終了'; }
  function resetTimer(){state.timer.running=false;cancelAnimationFrame(state.timer.raf);state.timer.elapsed=0;state.timer.lastCue=-1;$('#timerDisplay').textContent='0:00.0';$('#timerTarget').textContent='準備できたら開始';$('#timerProgress').style.width='0%';}

  function adviceFromTaste(taste, actualDrawdown){
    const r=readRecipe(); const target=r.drawdown||0; const delta=actualDrawdown-target;
    if(taste.bitterness>=4){
      if(delta>12) return {title:'次回は挽き目を1段粗く',body:`落ち切りが目標より${Math.round(delta)}秒遅く、苦味も強めです。まず C5 Pro ${r.grind} → ${r.grind+1} だけ変更。`,patch:{grind:r.grind+1}};
      if(r.roast==='dark' && r.temp>=90) return {title:'次回は湯温を2℃下げる',body:`苦味が強いので、${r.temp}℃ → ${r.temp-2}℃だけ変更。他条件は固定。`,patch:{temp:r.temp-2}};
      return {title:'次回は挽き目を1段粗く',body:`${r.grind} → ${r.grind+1}だけ変更し、苦味の変化を確認します。`,patch:{grind:r.grind+1}};
    }
    if(taste.aroma<=2 && taste.bitterness<=2){ return {title:'次回は湯温を1℃上げる',body:`香り不足で苦味は強くないため、${r.temp}℃ → ${Math.min(100,r.temp+1)}℃だけ変更。`,patch:{temp:Math.min(100,r.temp+1)}}; }
    if(taste.body<=2 && taste.bitterness<=2){ return {title:'次回は豆量を0.5g増やす',body:`${r.dose}g → ${r.dose+.5}gだけ変更し、コクが増えるか比較。`,patch:{dose:r.dose+.5}}; }
    if(taste.acidity>=4 && taste.sweetness<=2){ return {title:'次回は挽き目を1段細かく',body:`酸味が強く甘さが不足しているので、${r.grind} → ${Math.max(1,r.grind-1)}だけ変更。`,patch:{grind:Math.max(1,r.grind-1)}}; }
    if(taste.sweetness>=4 && taste.aroma>=3 && taste.bitterness<=2){ return {title:'この条件を基準レシピに',body:'大きく動かさず、再現性を確認する段階です。',patch:{}}; }
    return {title:'次回も同条件で再現確認',body:'味の偏りが大きくないため、まず同じ条件でもう一度淹れて再現性を確認します。',patch:{}};
  }

  function saveBrew(){
    const r=readRecipe(); const taste=Object.fromEntries($$('[data-taste]').map(x=>[x.dataset.taste,Number(x.value)]));
    const actualPour=clockToSec($('#actualPourEnd').value)||r.pourEnd; const actualDraw=clockToSec($('#actualDrawdown').value)||r.drawdown;
    const advice=adviceFromTaste(taste,actualDraw);
    const item={id:Date.now(),at:new Date().toISOString(),presetId:state.activePresetId,recipe:r,actualPourEnd:actualPour,actualDrawdown:actualDraw,taste,overall:Number($('#overall').value),memo:$('#memo').value.trim(),advice};
    const h=loadHistory();h.unshift(item);localStorage.setItem(LS.history,JSON.stringify(h.slice(0,100)));
    $('#reviewAdviceTitle').textContent=advice.title;$('#reviewAdviceBody').textContent=advice.body; renderHistory();
  }

  function renderHistory(){
    const h=loadHistory();
    if(!h.length){$('#historyList').innerHTML='<div class="empty">まだ履歴がありません。</div>';return;}
    $('#historyList').innerHTML=h.map(x=>{
      const d=new Date(x.at).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      const brewer=D.brewers.find(b=>b.id===x.recipe.brewer)?.label||x.recipe.brewer;
      return `<div class="history-item"><div class="history-top"><div><div class="history-title">${x.recipe.beanName} / ${x.recipe.dose}g : ${x.recipe.water}g</div><div class="history-meta">${brewer}・C5 Pro ${x.recipe.grind}・${x.recipe.temp}℃・落ち切り ${fmt(x.actualDrawdown)}</div></div><div class="score">${'★'.repeat(x.overall)}${'☆'.repeat(5-x.overall)}</div></div><div class="history-meta">苦味${x.taste.bitterness} / 酸味${x.taste.acidity} / 甘さ${x.taste.sweetness} / コク${x.taste.body} / 香り${x.taste.aroma}<br>${d}${x.memo?`・${x.memo}`:''}<br><b>次回:</b> ${x.advice.title}</div></div>`;
    }).join('');
  }

  function bind(){
    $$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.toggle('active',x===b));$$('.tabpage').forEach(p=>p.classList.toggle('active',p.id===b.dataset.tab));});
    ['beanName','roast','brewer','grinder','dose','water','temp','grind','pourEnd','drawdown'].forEach(id=>$('#'+id).addEventListener('change',()=>{updateComputed();updateRecommendation();}));
    $('#baselineSelect').onchange=()=>renderBaseline($('#baselineSelect').value);
    $('#loadBaseline').onclick=()=>loadPreset(currentPreset());
    $('#savePrefs').onclick=()=>{localStorage.setItem(LS.prefs,JSON.stringify(getPrefsFromUI()));updateRecommendation();};
    $('#applyRecommendation').onclick=()=>{if(state.recommendation?.changed.length)applyRecipe(state.recommendation.recipe);};
    $('#addStep').onclick=()=>{const last=state.steps.at(-1)?.time||0;state.steps.push({time:last+30,label:'新しい工程',target:''});saveSteps();renderSteps();};
    $('#resetSteps').onclick=()=>{state.steps=clone(currentPreset().steps||[]);saveSteps();renderSteps();};
    $('#startTimer').onclick=startTimer;$('#pauseTimer').onclick=pauseTimer;$('#resetTimer').onclick=resetTimer;
    $('#saveBrew').onclick=saveBrew;
    $('#clearHistory').onclick=()=>{if(confirm('抽出履歴をすべて削除しますか？')){localStorage.removeItem(LS.history);renderHistory();}};
  }

  function init(){
    initSelect($('#roast'),D.roasts,D.baseline.roast);initSelect($('#brewer'),D.brewers,D.baseline.brewer);initSelect($('#grinder'),D.grinders,D.baseline.grinder);
    initSelect($('#baselineSelect'),presets,state.activePresetId);
    if(!presets.some(x=>x.id===state.activePresetId)) state.activePresetId=presets[0].id;
    renderBaseline(state.activePresetId);renderPreferences();renderTaste();
    state.steps=loadSavedSteps()||clone(D.baseline.steps);renderSteps();
    applyRecipe(loadSavedRecipe()||clone(D.baseline),false);
    renderHistory();bind();updateRecommendation();
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  document.addEventListener('DOMContentLoaded',init);
})();
