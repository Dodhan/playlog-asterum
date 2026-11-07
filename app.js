(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const localDate = () => {
    const d = new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  };
  const catalog = window.PlaylogCatalog.songs;
  const state = {
    rows: [lockCount({id:'pending',title:'캡처를 올려 주세요',artist:'PLAVE',album:'',count:null,source:'empty',date:localDate()})],
    selected:'pending', theme:'noah', format:'portrait',
    generation:0, drawing:0, renderPromise:Promise.resolve(), busy:false, controller:null,
    originalUrl:null, originalFile:null
  };
  const fmt = value => Number.isSafeInteger(value) ? value.toLocaleString('ko-KR') : '—';
  const selected = () => state.rows.find(row => row.id === state.selected);
  const songInfo = () => selected();
  function lockCount(row) {
    const copy = {...row};
    const count = Number.isSafeInteger(row.count) && row.count >= 0 && row.count <= 999999999 ? row.count : null;
    Object.defineProperty(copy,'count',{value:count,enumerable:true,writable:false,configurable:false});
    return copy;
  }
  function countValue() { return selected()?.count ?? null; }
  function validation() {
    if(selected()?.source!=='ocr') return '원본 캡처를 올리고 카드에 담을 기록을 선택해 주세요.';
    if(selected()?.period==='기간 확인 필요')return '플로의 집계 기간이 보이는 원본 캡처를 올려 주세요.';
    if(countValue()===null) {
      const hints={clipped:'글자 일부가 잘렸을 수 있어요. ‘총 … 회 감상’ 한 줄 바깥에 여백을 남겨 다시 골라 주세요.',multiple_lines:'여러 줄이 함께 보여요. 선택한 곡의 ‘총 … 회 감상’ 한 줄만 골라 주세요.',non_numeric:'감상 횟수 줄을 찾지 못했어요. ‘총 … 회 감상’ 한 줄 전체를 골라 주세요.',empty:'선택한 영역에서 숫자를 찾지 못했어요. 숫자가 선명하게 보이도록 다시 골라 주세요.'};
      return hints[selected().recognitionIssue]||'횟수를 확실하게 읽지 못했어요. 아래 Google이 읽은 글자를 확인하거나 원본 캡처를 다시 올려 주세요.';
    }
    const date=selected().date;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) return '캡처 기준일을 선택해 주세요.';
    return '';
  }
  function data() {
    const song=songInfo(),row=selected();
    return {title:song.title,artist:song.artist,count:countValue(),nickname:$('nickname').value||'PLY',date:row.date,
      theme:state.theme,format:state.format,coverDataUrl:row.coverDataUrl,sourceLabel:({genie:'지니',bugs:'벅스',flo:'FLO'})[row.platform||$('platform').value],period:row.period||'',verified:$('verified').checked&&!validation()};
  }
  function updateDownload() { $('download-btn').disabled=!!validation()||!$('verified').checked||state.busy; }
  let toastTimer;
  function toast(message) { $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000); }
  function draw() {
    $('count').textContent=countValue()===null?(selected().source==='ocr'?'재인식 필요':'캡처를 읽어 주세요'):fmt(countValue())+'회';
    const generation=++state.drawing,input=data(),buffer=document.createElement('canvas');
    updateDownload();
    state.renderPromise=window.StreamCard.draw(buffer,input).then(()=>{
      if(generation!==state.drawing)return;
      const canvas=$('card-preview');canvas.width=buffer.width;canvas.height=buffer.height;canvas.getContext('2d').drawImage(buffer,0,0);
      canvas.setAttribute('aria-label',input.title+' · '+input.artist+' · '+fmt(input.count)+'회 감상 카드');
    }).catch(()=>{if(generation===state.drawing)toast('카드 미리보기를 불러오지 못했어요. 페이지를 새로 열어 주세요.');});
    return state.renderPromise;
  }
  function clearVerification() { $('verified').checked=false;$('form-error').hidden=true; }
  function renderSongs() {
    const list=$('song-list');list.replaceChildren();
    const query=$('song-search').value.trim().toLocaleLowerCase('ko-KR').replace(/\s+/g,'');
    const visible=state.rows.filter(row=>(row.title+' '+row.artist+' '+row.album).toLocaleLowerCase('ko-KR').replace(/\s+/g,'').includes(query));
    for(const row of visible) {
      const button=document.createElement('button');button.type='button';button.disabled=state.busy;
      button.className='song-option'+(row.id===state.selected?' selected':'');button.setAttribute('aria-pressed',String(row.id===state.selected));
      const cover=document.createElement('div');cover.textContent='♪';cover.className='song-cover';
      const meta=document.createElement('span');meta.className='song-meta';
      const title=document.createElement('strong');title.textContent=row.title;
      const album=document.createElement('small');album.textContent=row.album;meta.append(title,album);
      const count=document.createElement('span');count.className='song-count';count.textContent=Number.isSafeInteger(row.count)?fmt(row.count)+'회':row.source==='ocr'?'재인식':'기록 전';
      const radio=document.createElement('span');radio.className='song-radio';
      button.append(cover,meta,count,radio);button.addEventListener('click',()=>{if(!state.busy)select(row.id);});list.append(button);
    }
    if(!visible.length){const empty=document.createElement('p');empty.className='catalog-empty';empty.textContent='검색 결과가 없어요. 다른 제목이나 앨범명으로 찾아 주세요.';list.append(empty);}
    $('song-count').textContent=visible.length+'곡';
  }
  function showCapture(row) {
    const file=row.originalFile||null;
    if(file!==state.originalFile) {
      if(state.originalUrl)URL.revokeObjectURL(state.originalUrl);
      state.originalFile=file;state.originalUrl=file?URL.createObjectURL(file):null;
    }
    $('original-preview').hidden=!file;
    if(state.originalUrl){$('original-image').src=state.originalUrl;$('original-link').href=state.originalUrl;}
    else{$('original-image').removeAttribute('src');$('original-link').removeAttribute('href');}
    $('ocr-reading').hidden=typeof row.ocrText!=='string';
    $('ocr-reading').textContent=typeof row.ocrText==='string'?'Google이 읽은 글자: '+(row.ocrText||'(읽은 글자 없음)'):'';
    $('count-evidence').hidden=row.source!=='ocr';
    $('count-evidence-image').hidden=!row.countCropDataUrl;
    if(row.countCropDataUrl){$('count-evidence-image').src=row.countCropDataUrl;$('count-evidence-image').alt=row.title+' · 선택한 감상 횟수 숫자';}
    else $('count-evidence-image').removeAttribute('src');
  }
  function select(id) {
    if(state.busy||!state.rows.some(row=>row.id===id))return;
    state.selected=id;const row=selected(),song=songInfo();
    $('title').textContent=song.title;$('artist').textContent=song.artist;$('date').value=row.date;
    $('chosen-song').textContent=song.title;
    showCapture(row);clearVerification();renderSongs();draw();
    $('list-note').textContent=row.source==='ocr'?'선택한 곡의 숫자를 원본과 비교해 주세요. 다른 곡의 횟수는 따로 읽어요.':'지니 원본 캡처를 올려 주세요.';
    const error=validation();$('form-error').textContent=error;$('form-error').hidden=row.source==='empty'||!error;
  }
  function renderThemes() {
    const box=$('theme-options');box.replaceChildren();
    window.StreamCard.themes.forEach(theme=>{
      const button=document.createElement('button');button.type='button';button.className='theme-button'+(theme.id===state.theme?' selected':'');
      button.style.setProperty('--swatch',theme.color);button.setAttribute('aria-label',theme.name);button.setAttribute('aria-pressed',String(theme.id===state.theme));
      const swatch=document.createElement('i');swatch.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent=theme.name.split(' · ')[0];
      button.append(swatch,label);button.addEventListener('click',()=>{state.theme=theme.id;renderThemes();draw();});box.append(button);
    });
    $('theme-name').textContent=window.StreamCard.themes.find(t=>t.id===state.theme).name;
  }
  $('song-search').addEventListener('input',renderSongs);
  $('nickname').addEventListener('input',draw);
  $('date').addEventListener('input',()=>{if(state.busy)return;selected().date=$('date').value;clearVerification();draw();const error=validation();$('form-error').textContent=error;$('form-error').hidden=!error;});
  $('verified').addEventListener('change',draw);
  for(const format of ['portrait','square'])$(format+'-format').addEventListener('click',()=>{
    state.format=format;for(const f of ['portrait','square']){$(f+'-format').classList.toggle('active',f===format);$(f+'-format').setAttribute('aria-pressed',String(f===format));}draw();
  });
  $('download-btn').addEventListener('click',async()=>{
    if(validation()||!$('verified').checked||state.busy)return;
    $('download-btn').disabled=true;
    try {
      const canvas=document.createElement('canvas'),exportData=data();await window.StreamCard.draw(canvas,exportData);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('empty');
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
      a.download=exportData.title.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,60)+'_'+(selected().platform||$('platform').value)+'_'+exportData.count+'_'+exportData.date+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('카드 이미지 다운로드를 시작했어요.');
    }catch(error){toast('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');}finally{updateDownload();}
  });
  function imageFile(file) {
    if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error('JPG, PNG, WEBP 이미지를 골라 주세요.');
    if(file.size>15*1024*1024)throw new Error('15MB 이하의 이미지를 골라 주세요.');
  }
  async function coverUrl(file) {
    imageFile(file);const url=URL.createObjectURL(file);
    try{const img=new Image();img.src=url;await img.decode();const size=Math.min(img.naturalWidth,img.naturalHeight),canvas=document.createElement('canvas');canvas.width=canvas.height=Math.min(size,800);canvas.getContext('2d').drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');}
    finally{URL.revokeObjectURL(url);}
  }
  $('cover-input').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file||state.busy)return;
    const row=selected();const revision=row.coverRevision=(row.coverRevision||0)+1;
    try{const url=await coverUrl(file);if(row.coverRevision!==revision||!state.rows.includes(row))return;row.coverDataUrl=url;if(row===selected()){clearVerification();draw();}}
    catch(error){toast(error.message);}
  });
  $('remove-cover').addEventListener('click',()=>{if(state.busy)return;const row=selected();row.coverRevision=(row.coverRevision||0)+1;delete row.coverDataUrl;clearVerification();draw();});
  function lockEditing(locked) {
    for(const id of ['song-search','nickname','date','screenshot-input','cover-input','remove-cover','verified','crop-upload-btn','crop-input','recrop-btn','count-retry-btn','ocr-api-key','connect-ocr','disconnect-ocr','remember-ocr','platform'])$(id).disabled=locked;
    $('drop-zone').setAttribute('aria-disabled',String(locked));renderSongs();updateDownload();
  }
  function finishImport() {state.busy=false;state.controller=null;$('import-status').hidden=true;lockEditing(false);}
  function chooseReading(candidates,title,file){
    const dialog=$('reading-dialog'),list=$('reading-options');list.replaceChildren();$('reading-title').textContent='카드에 담을 기록을 선택해 주세요';
    const url=URL.createObjectURL(file);$('reading-original').src=url;
    return new Promise(resolve=>{let choice=null;dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);$('reading-original').removeAttribute('src');resolve(choice);},{once:true});
      candidates.forEach(c=>{
        const song=window.PlaylogMatch.find(c.label,catalog)||(c.title?{id:'ocr-'+c.title,title:c.title,artist:'PLAVE',album:''}:null),box=document.createElement('div');box.className='reading-entry';
        const detail=document.createElement('p');detail.textContent='읽힌 글자: '+c.label;box.append(detail);
        const b=document.createElement('button');b.type='button';b.className='reading-option';
        let chosen=song;
        const refresh=()=>{b.textContent=(chosen?chosen.title:'제목을 확인해 주세요')+' — '+fmt(c.count)+'회';b.disabled=!chosen;};
        if(!song){const label=document.createElement('label');label.textContent='곡명을 확인해 주세요 ';const sel=document.createElement('select');sel.setAttribute('aria-label','인식된 기록의 곡명');const empty=document.createElement('option');empty.value='';empty.textContent='곡 제목 선택';sel.append(empty);catalog.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.title;sel.append(o);});sel.onchange=()=>{chosen=catalog.find(t=>t.id===sel.value);refresh();};label.append(sel);box.append(label);}
        refresh();b.onclick=()=>{if(!chosen)return;choice={...c,song:chosen};dialog.close();};box.append(b);list.append(box);
      });dialog.showModal();
    });
  }
  async function cropAndRead(file) {
    if(state.busy||!file)return;
    try{imageFile(file);}catch(error){toast(error.message);return;}
    const generation=++state.generation;let songId=state.selected;
    state.busy=true;lockEditing(true);
    try {
      if(!window.GenieCloudOCR.isConfigured())throw new Error('원본 인식을 위해 위에서 Google OCR 키를 먼저 연결해 주세요.');
      const cropped=file;
      if(generation!==state.generation||!cropped)return;
      imageFile(cropped);state.controller=new AbortController();
      $('import-status').hidden=false;$('ocr-progress').value=0;$('status-text').textContent='선택한 숫자를 읽고 있어요…';
      const engine=window.GenieCloudOCR.isConfigured()?window.GenieCloudOCR:window.GenieOCR;
      const result=await engine.recognizeCount(cropped,{
        fullImage:true,platform:$('platform').value,
        signal:state.controller.signal,
        onProgress:value=>{if(generation===state.generation)$('ocr-progress').value=typeof value==='number'?value:(value.progress||0);},
        onStatus:message=>{if(generation===state.generation)$('status-text').textContent=message;}
      });
      if(generation!==state.generation)return;
      if(!result||typeof result!=='object')throw new Error('숫자를 읽지 못했어요. 다시 시도해 주세요.');
      if(result.candidates?.length){
        const choice=await chooseReading(result.candidates,songInfo().title,file);
        if(choice===null||generation!==state.generation)return;
        result.count=choice.count;result.diagnostic.reason='confirmed';
        songId=choice.song.id;
        if(!state.rows.some(row=>row.id===songId))state.rows.push(lockCount({...choice.song,count:null,source:'empty',date:localDate()}));
      }
      const index=state.rows.findIndex(row=>row.id===songId);
      const preview=result.selectedCropDataUrl||result.countCropDataUrl;
      const evidence=/^data:image\/(png|jpeg|webp);base64,/.test(preview||'')?preview:null;
      state.rows[index]=lockCount({...state.rows[index],count:result.count,source:'ocr',recognitionIssue:result.diagnostic?.reason,ocrText:result.diagnostic?.rawText,countCropDataUrl:evidence,originalFile:file,platform:$('platform').value,period:$('platform').value==='flo'?(result.diagnostic.rawText.match(/최근\s*\d+\s*개월/)?.[0]||'기간 확인 필요'):'',date:localDate()});
      finishImport();select(songId);
      toast(countValue()===null?'감상 횟수를 찾지 못했어요. 아래 Google이 읽은 글자를 확인해 주세요.':'숫자를 읽었어요. 선택한 곡의 횟수와 같은지 확인해 주세요.');
    }catch(error){if(generation===state.generation){const message=error.message||'인식에 실패했어요. 더 선명한 캡처로 다시 시도해 주세요.';toast(message);$('form-error').textContent=message;$('form-error').hidden=false;}}
    finally{if(generation===state.generation&&state.busy)finishImport();}
  }
  $('screenshot-input').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';if(file)cropAndRead(file);});
  $('crop-upload-btn').addEventListener('click',()=>{if(!state.busy)$('crop-input').click();});
  $('crop-input').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';if(file)cropAndRead(file);});
  $('recrop-btn').addEventListener('click',()=>cropAndRead(selected().originalFile));
  $('count-retry-btn').addEventListener('click',()=>cropAndRead(selected().originalFile));
  $('cancel-ocr').addEventListener('click',()=>{if(!state.controller)return;++state.generation;state.controller.abort();finishImport();toast('인식을 취소했어요.');});
  const drop=$('drop-zone');drop.tabIndex=0;drop.setAttribute('role','button');
  drop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!state.busy)$('screenshot-input').click();}});
  for(const type of ['dragenter','dragover'])drop.addEventListener(type,event=>{event.preventDefault();if(!state.busy)drop.classList.add('dragging');});
  for(const type of ['dragleave','drop'])drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('dragging');});
  drop.addEventListener('drop',event=>{if(event.dataTransfer.files[0])cropAndRead(event.dataTransfer.files[0]);});
  $('guide-btn').addEventListener('click',()=>$('guide-dialog').showModal());
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});

  function cloudState(){const ready=window.GenieCloudOCR.isConfigured();$('remember-ocr').checked=window.GenieCloudOCR.isRemembered();$('disconnect-ocr').hidden=!ready;$('cloud-status').textContent=ready?(window.GenieCloudOCR.isRemembered()?'저장된 키로 연결됐어요. 원본 캡처를 올려 주세요.':'이 탭에서 연결됐어요. 원본 캡처를 올려 주세요.'):'키 연결 후 원본 캡처를 올려 주세요.';$('privacy-note').textContent=ready?'Google OCR · 원본 캡처 전체를 Google로 전송해요':'원본 인식 · 키를 먼저 연결해 주세요';}
  $('connect-ocr').addEventListener('click',()=>{if(state.busy)return;try{window.GenieCloudOCR.configure($('ocr-api-key').value,$('remember-ocr').checked);$('ocr-api-key').value='';cloudState();}catch(e){toast(e.message);}});
  $('disconnect-ocr').addEventListener('click',()=>{if(state.busy)return;try{window.GenieCloudOCR.clear();$('ocr-api-key').value='';cloudState();}catch(e){toast(e.message);}});
  window.addEventListener('pageshow',cloudState);
  window.addEventListener('ocr-key-changed',cloudState);
  $('platform').addEventListener('change',()=>{clearVerification();draw();$('platform-help').textContent=$('platform').value==='flo'?'많이 들은 화면 · 최근 6개월 등 집계 기간까지 보이게 올려 주세요.':'곡명과 재생 횟수가 함께 보이는 원본 캡처를 올려 주세요.';});
  cloudState();
  renderThemes();select(state.selected);
}());
