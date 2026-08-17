import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
import { isBlacklisted } from "../src/blacklist.js";
const REPO=process.env.HOME+"/Developer/korean-art-lexicon/";
const DIR=REPO+"data/persons/";
const BASE="https://www.mmca.go.kr/collections/AjaxCollectionsList.do";
const H={"User-Agent":"Mozilla/5.0","X-Requested-With":"XMLHttpRequest"};
const titleCase=s=>s.replace(/\b[A-Z]{2,}\b/g,w=>w[0]+w.slice(1).toLowerCase());
const APPLY=process.argv.includes("--apply");
const mmca={}; let page=1,total=null,seen=0;
while(true){ let j; try{ const r=await fetch(`${BASE}?pageIndex=${page}&pageUnit=1000`,{headers:H}); j=await r.json(); }catch(e){break;}
  total=j.totCnt; for(const c of j.collectionsList||[]){ const ko=(c.artistnm||"").trim(),en=(c.artistnmEng||"").trim();
    if(ko&&en&&!mmca[ko]) mmca[ko]={en:titleCase(en),seqno:c.wrkinfoSeqno}; }
  seen+=(j.collectionsList||[]).length; if(seen>=total||!(j.collectionsList||[]).length)break; page++; }
const al=(JSON.parse(readFileSync(REPO+"crawl-archive/altpool/en_romanization_20260613.json","utf8")).romanization)||{};
const wd=JSON.parse(readFileSync(REPO+"reports/miner/wikidata-romanization.json","utf8"));
const existKo=new Set(), existSlug=new Set();
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){ existSlug.add(f.replace(".yaml",""));
  const m=readFileSync(DIR+f,"utf8").match(/full:\s*([가-힣A-Za-z·]+)/); if(m)existKo.add(m[1]); }
const slugify=s=>s.normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
// ponytail: 2026-08-17 버그수정 — 첫음절=family 슬라이스가 외국이름/콜렉티브를 깨뜨림(reference: project_korean_art_lexicon_miner.md).
// 공백구분 서구식=마지막 토큰이 family, 무공백 5음절+=콜렉티브 추정으로 family/given 생략(strip), 2음절 한국성은 TWO로 우선매치.
const TWO=["남궁","황보","제갈","사공","선우","독고","동방","서문"];
const splitKo=ko=>{
  if(ko.includes(" ")){ const t=ko.split(" "); return {full:ko, given:t.slice(0,-1).join(" "), family:t[t.length-1]}; }
  const two=TWO.find(f=>ko.startsWith(f));
  if(two) return {full:ko, family:two, given:ko.slice(two.length)};
  if(ko.length>=5) return {full:ko}; // 콜렉티브 추정 — family/given 생략
  return {full:ko, family:ko.slice(0,1), given:ko.slice(1)};
};
let strong=0,moderate=0,bl=0,dup=0,skip=0; const recs=[], promote=[];
for(const x of wd.nomatch){
  const ko=x.ko;
  if(isBlacklisted(ko)){bl++;continue;}
  if(existKo.has(ko)){dup++;continue;}
  let en,url,note,tier;
  if(mmca[ko]){ en=mmca[ko].en; url=`https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=${mmca[ko].seqno}`;
    const inst=(x.institutions||[]); tier=inst.includes("국립현대미술관")?"strong":"moderate";
    note="MMCA 소장품 artistnmEng — 기관 표기"+(tier==="strong"?" · 교차검증(국립현대 전시맥락), 승격후보":" · 동음이의 검증필요");
  } else if(al[ko]&&al[ko].en){ en=al[ko].en; url=al[ko].source; tier="strong";
    note="아트스페이스 풀 영문판(전시 동시발행) — 기관 표기 · 승격후보"; }
  else { skip++; continue; }
  if(!en||en.length<2){skip++;continue;}
  let slug=slugify(en); if(existSlug.has(slug)||recs.some(r=>r.slug===slug)) slug=slug+"-"+slugify(ko);
  if(!slug){skip++;continue;}
  if(tier==="strong"){strong++;promote.push(slug);}else moderate++;
  recs.push({slug, rec:{ id:`person.${slug}`, name:{ko:splitKo(ko), latn:{preferred:en}},
    role:[{aat:"300025103"}], sources:[{url,name_used:en,note,accessed:"2026-06-22"}], status:"pending_review" }});
}
console.log(`매칭 ${recs.length} | strong(승격후보) ${strong} + moderate(동음검증) ${moderate} | 블랙 ${bl} | 중복 ${dup} | 미커버 ${skip}`);
if(APPLY){
  for(const {slug,rec} of recs) writeFileSync(DIR+`${slug}.yaml`, yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  writeFileSync(REPO+"reports/miner/longtail-promote-candidates.json", JSON.stringify(promote,null,1));
  writeFileSync(REPO+"crawl-archive/mmca/artist_romanization.json", JSON.stringify(Object.fromEntries(Object.entries(mmca).map(([k,v])=>[k,v.en])),null,1));
  console.log(`→ ${recs.length} 레코드 생성 + 승격후보 ${strong}건 리포트 + MMCA맵 갱신`);
} else console.log("(dry-run)");
