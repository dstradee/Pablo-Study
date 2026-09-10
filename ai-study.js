(function(){
  const STYLE=`.ai-session-modal{position:fixed;inset:0;background:rgba(12,16,24,.62);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px}.ai-session-modal[hidden]{display:none!important}.ai-session-panel{position:relative;width:min(900px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.22)}.ai-session-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.ai-session-head h2{margin:4px 0 8px}.ai-session-close{display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 40px;width:40px;height:40px;padding:0!important;border:0!important;background:#f1f2f5!important;border-radius:12px!important;font-size:22px!important;line-height:1!important;cursor:pointer!important}.ai-session-meta{color:#68707d;margin-bottom:20px}.ai-summary{font-size:16px;line-height:1.65}.ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}.ai-box{background:#f7f8fa;border-radius:16px;padding:18px}.ai-box h3{margin:0 0 10px;font-size:15px}.ai-box ul{margin:0;padding-left:20px;line-height:1.6}.ai-full{grid-column:1/-1}.ai-status{padding:14px 16px;border-radius:12px;background:#f3f5f7;margin:15px 0}.ai-questions{display:grid;gap:10px}.ai-q{padding:12px 14px;background:#fff;border:1px solid #e3e6ea;border-radius:12px}.ai-error{background:#fff0f0;color:#a32626}.ai-progress{height:7px;background:#e7e9ed;border-radius:99px;overflow:hidden}.ai-progress i{display:block;height:100%;width:0;background:#111;transition:width .3s}@media(max-width:700px){.ai-grid{grid-template-columns:1fr}.ai-full{grid-column:auto}}`;
  const style=document.createElement('style');style.textContent=STYLE;document.head.appendChild(style);
  const modal=document.createElement('div');modal.className='ai-session-modal';modal.hidden=true;modal.innerHTML=`<div class="ai-session-panel" role="dialog" aria-modal="true"><div class="ai-session-head"><div><p class="label">PABLO STUDY · IA</p><h2 id="aiTitle">Preparando tu sesión</h2><div id="aiMeta" class="ai-session-meta"></div></div><button type="button" class="ai-session-close" id="aiClose" aria-label="Cerrar sesión">×</button></div><div id="aiBody"></div></div>`;document.body.appendChild(modal);
  const title=document.getElementById('aiTitle'),meta=document.getElementById('aiMeta'),body=document.getElementById('aiBody'),closeBtn=document.getElementById('aiClose');
  function close(){modal.hidden=true;document.body.style.overflow='';}
  closeBtn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();close();});
  modal.addEventListener('click',function(e){if(e.target===modal)close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)close();});
  function showLoading(text){body.innerHTML=`<div class="ai-status">${text}</div><div class="ai-progress"><i id="aiProg"></i></div>`;}
  function progress(n){const x=document.getElementById('aiProg');if(x)x.style.width=n+'%';}
  function esc2(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function list(items){return `<ul>${(items||[]).map(x=>`<li>${esc2(x)}</li>`).join('')}</ul>`;}
  async function getPdfBlob(subject){
    if(subject.pdf_chunks?.length){
      const parts=[];const ordered=[...subject.pdf_chunks].sort((a,b)=>a.index-b.index);
      for(const p of ordered){const r=await state.sb.storage.from('study-pdfs').download(p.path);if(r.error)throw r.error;parts.push(await r.data.arrayBuffer());}
      return new Blob(parts,{type:'application/pdf'});
    }
    if(subject.pdf_path){const r=await state.sb.storage.from('study-pdfs').download(subject.pdf_path);if(r.error)throw r.error;return r.data;}
    throw new Error('Esta asignatura no tiene PDF guardado.');
  }
  async function extractPdf(blob){
    if(!window.pdfjsLib)throw new Error('No se ha cargado el lector PDF. Recarga la página e inténtalo de nuevo.');
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;
    let text='';
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);const content=await page.getTextContent();
      const pageText=content.items.map(x=>x.str||'').join(' ').replace(/\s+/g,' ').trim();
      if(pageText)text+=`\n\n[PÁGINA ${i}]\n${pageText}`;
      if(i%10===0)progress(Math.min(70,Math.round(i/pdf.numPages*70)));
    }
    if(!text.trim())throw new Error('No he podido extraer texto de este PDF. Si es un PDF escaneado necesitaremos OCR.');
    return text.slice(0,180000);
  }
  async function prepare(session){
    const subject=state.subjects.find(s=>s.id===session.subject_id);if(!subject)return;
    modal.hidden=false;document.body.style.overflow='hidden';title.textContent=subject.name;meta.textContent=`${new Date(session.scheduled_for).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})} · ${session.duration_minutes} min`;
    showLoading('Descargando tu PDF privado…');progress(5);
    try{
      const blob=await getPdfBlob(subject);progress(15);
      body.querySelector('.ai-status').textContent='Leyendo páginas del PDF…';
      const text=await extractPdf(blob);progress(75);
      body.querySelector('.ai-status').textContent='Gemini está preparando exactamente lo que debes aprender hoy…';
      const {data,error}=await state.sb.functions.invoke('study-ai',{body:{text,subject:subject.name,session_date:session.scheduled_for,duration_minutes:session.duration_minutes}});
      if(error)throw error;if(data?.error)throw new Error(data.error);if(!data?.result)throw new Error('La IA no devolvió una sesión válida.');
      progress(100);const r=data.result;
      const saved=await state.sb.from('study_sessions').update({ai_content:r,ai_generated_at:new Date().toISOString()}).eq('id',session.id).eq('user_id',state.user.id);
      if(saved.error)console.warn('No se pudo guardar el contenido IA:',saved.error);
      body.innerHTML=`<div class="ai-summary"><h3>Qué tienes que aprender</h3><p>${esc2(r.summary)}</p></div><div class="ai-grid"><div class="ai-box"><h3>🎯 Objetivos</h3>${list(r.objectives)}</div><div class="ai-box"><h3>🧠 Conceptos clave</h3>${list(r.key_concepts)}</div><div class="ai-box ai-full"><h3>⏱️ Plan de ${session.duration_minutes} minutos</h3>${list(r.study_steps)}</div><div class="ai-box ai-full"><h3>🔁 Comprueba que lo sabes</h3><div class="ai-questions">${(r.active_recall_questions||[]).map((q,i)=>`<div class="ai-q"><b>${i+1}.</b> ${esc2(q)}</div>`).join('')}</div></div></div><div class="ai-status"><b>Páginas:</b> ${esc2(r.pages)} · <b>Dificultad:</b> ${esc2(r.estimated_difficulty)}</div>`;
      session.ai_content=r;session.ai_generated_at=new Date().toISOString();
    }catch(e){console.error(e);body.innerHTML=`<div class="ai-status ai-error"><b>No he podido preparar la sesión.</b><br>${esc2(e.message||e)}</div><p>La sesión se puede cerrar con la X, haciendo clic fuera de la ventana o pulsando Escape.</p>`;}
  }
  function startCurrent(){const s=state.sessions.filter(x=>x.status==='planned').sort((a,b)=>new Date(a.scheduled_for)-new Date(b.scheduled_for))[0];if(s)prepare(s);else toast('No hay ninguna sesión preparada.');}
  function wire(){
    const btn=document.getElementById('startBtn');if(btn&&!btn.dataset.aiWired){btn.dataset.aiWired='1';btn.textContent='Preparar sesión';btn.onclick=function(e){e.preventDefault();startCurrent();};}
  }
  setInterval(wire,800);wire();
})();