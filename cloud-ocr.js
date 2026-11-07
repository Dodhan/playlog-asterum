(function(global){
'use strict';
let apiKey='';
function parseCount(annotation = {}) {
  const text = String(annotation.text || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
  // Google can split the prefix, number and unit into separate lines.
  // Join only comma formatting, never two separate digit groups.
  const normalized=text.replace(/\s*,\s*/g,',');
  const number='(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)';
  let value;
  const bare=new RegExp('^(?:총\\s*)?('+number+')\\s*(?:회\\s*감\\s*상)?$').exec(normalized);
  if(bare)value=bare[1];
  else {
    const matches=[...normalized.matchAll(new RegExp('(?:총\\s*)?('+number+')\\s*회\\s*감\\s*상','g'))];
    if(matches.length!==1)return null;
    const m=matches[0],before=normalized.slice(0,m.index),after=normalized.slice(m.index+m[0].length);
    // Other numbers, malformed comma groups and OCR substitutions stay rejected.
    if(/[0-9,.]/.test(before+after)||/[A-Za-z가-힣]$/.test(before.trimEnd())&&before&&!/\s$/.test(before))return null;
    value=m[1];
  }
  const count=Number(value.replaceAll(',',''));
  if(!Number.isSafeInteger(count)||count>999999999)return null;
  const symbols=(annotation.pages||[]).flatMap(p=>(p.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.words||[]).flatMap(w=>w.symbols||[]))));
  const scores=symbols.filter(s=>/[0-9]/.test(String(s.text).normalize('NFKC'))).map(s=>s.confidence).filter(Number.isFinite);
  // Confidence is diagnostic, not a hard rejection: user confirmation remains required.
  return {count,confidence:scores.length?Math.round(Math.min(...scores)*100):null};
}

function parseCandidates(annotation={},platform="genie"){
 if(platform!=="genie")return parseList(annotation);
 const text=String(annotation.text||'').normalize('NFKC').replace(/\s*,\s*/g,',');
 const candidates=[];let previous=0;
 const pattern=/(?:총\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*회\s*감\s*상/g;
 for(const m of text.matchAll(pattern)){
  const before=text.slice(0,m.index),last=before.slice(-1);
  if(/[\p{L}\p{N},.]/u.test(last))continue;
  const count=Number(m[1].replaceAll(',',''));if(!Number.isSafeInteger(count)||count>999999999)continue;
  const context=text.slice(previous,m.index).trim().split(/\n/).map(x=>x.trim()).filter(Boolean).slice(-3).join(' · ');
  candidates.push({count,label:context||'감상 기록 '+(candidates.length+1)});previous=m.index+m[0].length;
 }
 return candidates;
}
function parseList(annotation={}){
 const lines=String(annotation.text||'').normalize('NFKC').split(/\n/).map(s=>s.trim()).filter(Boolean),out=[];
 const number='([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)';
 const marker='[|｜▷▶▹>DＫKᐅ△]?';
 const artistCount=new RegExp('^(.*?)PLAVE\\s*'+marker+'\\s*'+number+'\\s*$','i');
 const countOnly=new RegExp('^'+marker+'\\s*'+number+'\\s*$','i');
 const artistOnly=new RegExp('^(.*?)PLAVE\\s*'+marker+'\\s*$','i');
 for(let i=0;i<lines.length;i++){
  let m=lines[i].match(artistCount),title,count;
  if(m){title=m[1].trim()||lines[i-1];count=m[2];}
  else {m=lines[i].match(countOnly);const artist=(lines[i-1]||'').match(artistOnly);if(!m||!artist)continue;title=artist[1].trim()||lines[i-2];count=m[1];}
  if(!title||/^(PLAVE|최근|많이|보관함|전체)/i.test(title))continue;
  const value=Number(count.replaceAll(',',''));if(!Number.isSafeInteger(value)||value>999999999)continue;
  out.push({count:value,label:title+' · PLAVE',title});
 }
 return out;
}
const storageKey='playlog.googleVisionKey';
function restore(){try{const saved=global.localStorage?.getItem(storageKey);if(saved&&/^[A-Za-z0-9_-]{20,200}$/.test(saved))apiKey=saved;}catch{}}
function isRemembered(){try{return !!global.localStorage?.getItem(storageKey);}catch{return false;}}
function configure(value,remember=false){const key=String(value||'').trim();if(!/^[A-Za-z0-9_-]{20,200}$/.test(key))throw Error('복사한 API 키 전체를 넣어 주세요.');
 try{if(remember){if(!global.localStorage)throw Error();global.localStorage.setItem(storageKey,key);}else global.localStorage?.removeItem(storageKey);}catch{throw Error('이 브라우저에서 키 저장을 변경하지 못했어요. 브라우저의 사이트 저장 설정을 확인해 주세요.');}apiKey=key;
}
function clear(){try{global.localStorage?.removeItem(storageKey);}catch{throw Error('저장된 키를 지우지 못했어요. 브라우저 설정에서 이 사이트의 데이터를 삭제해 주세요.');}apiKey='';}
restore();
async function recognizeCount(blob,options={}){
 if(!apiKey)throw Error('먼저 Google OCR 키를 연결해 주세요.');
 if(!(blob instanceof Blob)||blob.size>7*1024*1024)throw Error('원본이 7MB를 넘어요. 7MB 이하의 원본 캡처를 선택해 주세요. 화질을 낮추지는 않아요.');
 const signal=options.signal;if(signal?.aborted)throw new DOMException('인식 취소','AbortError');
 const image=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('이미지를 열지 못했어요.'));r.readAsDataURL(blob);});
 if(signal?.aborted)throw new DOMException('인식 취소','AbortError');
 options.onStatus?.('원본 캡처를 Google OCR로 읽고 있어요.');options.onProgress?.(.2);
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,25000);
 try{
 const response=await fetch('https://vision.googleapis.com/v1/images:annotate',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':apiKey},signal:controller.signal,body:JSON.stringify({requests:[{image:{content:image.split(',')[1]},features:[{type:'DOCUMENT_TEXT_DETECTION'}],imageContext:{languageHints:['ko','en']}}]})});
 if(!response.ok){if(response.status===400||response.status===401)throw Error('API 키를 확인해 주세요. Google Cloud에서 복사한 키를 다시 연결해 보세요.');if(response.status===403)throw Error('Google에서 접근을 거절했어요. Vision API 사용 설정·키의 API 제한·결제 계정 연결을 확인해 주세요.');if(response.status===429)throw Error('Google OCR 사용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.');throw Error('Google OCR 연결에 실패했어요. 잠시 후 다시 시도해 주세요.');}
 const body=await response.json(),result=body.responses?.[0];if(!result||result.error)throw Error('Google OCR이 이미지를 처리하지 못했어요. 원본 캡처로 다시 시도해 주세요.');
 const candidates=parseCandidates(result.fullTextAnnotation,options.platform);const answer=options.fullImage?null:parseCount(result.fullTextAnnotation);options.onProgress?.(1);
 return {candidates,count:answer?.count??null,selectedCropDataUrl:image,countCropDataUrl:image,diagnostic:{reason:answer?'confirmed':'unclear',confidence:answer?.confidence??0,provider:'google-vision',rawText:String(result.fullTextAnnotation?.text||'').slice(0,4000)}};
 }catch(error){if(signal?.aborted)throw new DOMException('인식 취소','AbortError');if(error.name==='AbortError')throw Error('인식 시간이 길어졌어요. 다시 시도해 주세요.');if(error instanceof TypeError)throw Error('Google OCR에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
global.GenieCloudOCR={configure,clear,isConfigured:()=>!!apiKey,isRemembered,recognizeCount,parseCandidates};
global.addEventListener('pagehide',()=>{apiKey='';});
global.addEventListener('pageshow',restore);
global.addEventListener('storage',event=>{if(event.key===storageKey){apiKey='';restore();global.dispatchEvent(new Event('ocr-key-changed'));}});
})(window);
