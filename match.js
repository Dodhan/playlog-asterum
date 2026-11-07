(function(global){
'use strict';
function find(label,catalog){
 const normalize=s=>String(s).normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const parts=String(label).split(/\n| · /).map(s=>s.trim()).filter(Boolean);
 const found=catalog.filter(song=>parts.some(part=>normalize(part)===normalize(song.title)));
 if(found.length===1)return found[0];
 if(found.length>1)return null;
 // Specific known OCR error: offer the catalog title only in PLAVE context.
 if(parts.includes('문')&&parts.some(p=>normalize(p)==='plave'))return catalog.find(s=>s.title==='꾼')||null;
 return null;
}
global.PlaylogMatch={find};
})(window);
