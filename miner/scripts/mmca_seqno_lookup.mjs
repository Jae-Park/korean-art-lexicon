const BASE="https://www.mmca.go.kr/collections/AjaxCollectionsList.do";
const H={"User-Agent":"Mozilla/5.0","X-Requested-With":"XMLHttpRequest"};
const byKo={}, byEn={}; let page=1,total=null,seen=0;
while(true){ let j; try{const r=await fetch(`${BASE}?pageIndex=${page}&pageUnit=1000`,{headers:H});j=await r.json();}catch(e){break;}
  total=j.totCnt; for(const c of j.collectionsList||[]){ const ko=(c.artistnm||"").trim(),en=(c.artistnmEng||"").trim(),sq=c.wrkinfoSeqno;
    if(ko&&!byKo[ko])byKo[ko]={en,sq}; if(en&&!byEn[en.toLowerCase()])byEn[en.toLowerCase()]={ko,sq}; }
  seen+=(j.collectionsList||[]).length; if(seen>=total||!(j.collectionsList||[]).length)break; page++; }
console.log("소장품 인덱스: 작가(ko)",Object.keys(byKo).length,"/ (en)",Object.keys(byEn).length);
// 조회 대상: 외국 거장 + 전시링크 공유 현대/근대
const TKO=["안중식","고희동","박수근","앤디워홀","크리스토","A.R. 펭크","짐다인","바이런 킴","양 푸동","히와 케이","쉬린 네샤트","하딤 알리"];
const TEN=["A.R. Penck","Christo","Andy Warhol","Jim Dine","Byron Kim","Yang Fudong","Hiwa K","Shirin Neshat","Khadim Ali"];
console.log("\n=== 한글명 매칭 ===");
for(const k of TKO){ const v=byKo[k]; console.log(`  ${k}: ${v?`seqno=${v.sq} (${v.en})`:"소장품 없음"}`); }
console.log("\n=== 영문명 매칭 ===");
for(const k of TEN){ const v=byEn[k.toLowerCase()]; console.log(`  ${k}: ${v?`seqno=${v.sq} (${v.ko})`:"매칭없음 — 부분검색"}`);
  if(!v){ const hit=Object.keys(byEn).find(x=>x.includes(k.toLowerCase().split(" ")[0])&&x.includes(k.toLowerCase().split(" ").pop())); if(hit)console.log(`     ~ ${hit} → seqno=${byEn[hit].sq}`); }
}
