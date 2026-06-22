import { writeFileSync, readFileSync } from "node:fs";
const BASE="https://www.mmca.go.kr/collections/AjaxCollectionsList.do";
const PU=1000, H={"User-Agent":"Mozilla/5.0","X-Requested-With":"XMLHttpRequest"};
const titleCase=s=>s.replace(/\b[A-Z]{2,}\b/g,w=>w[0]+w.slice(1).toLowerCase());
const map={}; let page=1,total=null,seen=0;
while(true){
  let j;
  try{ const r=await fetch(`${BASE}?pageIndex=${page}&pageUnit=${PU}`,{headers:H}); j=await r.json(); }
  catch(e){ console.log("fetch fail page",page,e.message); break; }
  total=j.totCnt;
  for(const c of j.collectionsList||[]){
    const ko=(c.artistnm||"").trim(), en=(c.artistnmEng||"").trim();
    if(ko && en && !map[ko]) map[ko]=titleCase(en);
  }
  seen+=(j.collectionsList||[]).length;
  if(page%4===0||seen>=total) console.log(`  page ${page}, ${seen}/${total}, 작가 ${Object.keys(map).length}`);
  if(seen>=total || !(j.collectionsList||[]).length) break;
  page++;
}
writeFileSync("crawl-archive/mmca/artist_romanization.json", JSON.stringify(map,null,1));
console.log(`\nMMCA 맵: ${Object.keys(map).length} 작가 → crawl-archive/mmca/artist_romanization.json`);
// 711 매칭
const wd=JSON.parse(readFileSync("reports/miner/wikidata-romanization.json","utf8"));
const al=(JSON.parse(readFileSync("crawl-archive/altpool/en_romanization_20260613.json","utf8")).romanization)||{};
let mmcaHit=0,alHit=0,none=0; const plan=[];
for(const x of wd.nomatch){
  const ko=x.ko;
  if(map[ko]){ plan.push({ko,en:map[ko],src:"mmca"}); mmcaHit++; }
  else if(al[ko]&&al[ko].en){ plan.push({ko,en:al[ko].en,src:"altpool",url:al[ko].source}); alHit++; }
  else none++;
}
writeFileSync("reports/miner/longtail-romanize-plan.json", JSON.stringify(plan,null,1));
console.log(`\n711 롱테일 매칭: MMCA ${mmcaHit} + altpool ${alHit} = ${mmcaHit+alHit} 로마자화 / 미커버 ${none}`);
console.log("MMCA 샘플:", plan.filter(p=>p.src==="mmca").slice(0,8).map(p=>p.ko+"→"+p.en).join(" | "));
