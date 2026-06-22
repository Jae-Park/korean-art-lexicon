const BASE="https://www.mmca.go.kr/collections/AjaxCollectionsList.do";
const H={"User-Agent":"Mozilla/5.0","X-Requested-With":"XMLHttpRequest"};
const byKo={}; let page=1,total=null,seen=0;
while(true){ let j; try{const r=await fetch(`${BASE}?pageIndex=${page}&pageUnit=1000`,{headers:H});j=await r.json();}catch(e){break;}
  total=j.totCnt; for(const c of j.collectionsList||[]){ const ko=(c.artistnm||"").trim();
    if(ko&&!byKo[ko])byKo[ko]={en:(c.artistnmEng||"").trim(),sq:c.wrkinfoSeqno}; }
  seen+=(j.collectionsList||[]).length; if(seen>=total||!(j.collectionsList||[]).length)break; page++; }
for(const k of ["전수천","강익중","김인겸","곽훈","이형우","윤형근"]){
  const v=byKo[k]; console.log(`  ${k}: ${v?`소장품 seqno=${v.sq} (${v.en})`:"소장품 없음 → 검색 필요"}`);
}
