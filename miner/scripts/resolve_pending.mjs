import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const AC="2026-06-22";
// pending 검수 2차: 정밀 검증 통과분 18 — 표기 교정 동반, reviewed 승격
const FIX={
"최대진":["Daejin Choi","https://sema.seoul.go.kr/en/whatson/exhibition/detail?exNo=548","SeMA 난지 'A Summer Place'2017"],
"정기호":["Jung Ki-Ho","http://jungkiho.com/jungkiho/","작가 공식 + SeMA 소장"],
"박성원":["Sung-Won Park","https://aaa.org.hk/en/collections/search/library/sung-won-park-glass-sculpture-solo-exhibition-casting-me-carving-you","Asia Art Archive — SeMA 남서울 개인전2016(유리조각)"],
"곽이브":["Eve Kwak","http://021gallery.com/bbs/board.php?bo_table=artists&wr_id=23&vi=biography","021갤러리 + MMCA고양2016 + SeMA신진2017"],
"서고운":["Goun Seo","https://sema.seoul.go.kr/kr/support/emerging_artist/detail_info?actNo=245","SeMA 신진2013 + 본인 사이트"],
"김태균":["Kim Tae-Kyun","https://m.mmca.go.kr/eng/pr/newsDetail.do?bdCId=201311080003660","MMCA 고양오픈스튜디오9 'KIM, Tae-Kyun'"],
"남경민":["Kyung-Min Nam","https://art.state.gov/personnel/kyungmin_nam/","美 국무부 Art in Embassies + MMCA 소장"],
"이경모":["Lee Gyeongmo","https://www.mmcaresearch.kr/terms/view.do?fid=1404","MMCA Research(기관형) — 언론 'Kyung-mo'는 매큔"],
"강상우":["Sangwoo Kang","https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1244756","SeMA 타이틀매치2023(≠영화감독 강상우)"],
"심승욱":["Sim Seungwook","https://sema.seoul.go.kr/kr/support/nanji_residency/detail_info?actNo=652656","SeMA 난지 '심승욱 SIM Seungwook'"],
"이웅배":["Ungbai Lee","http://www.massgallery.info/UngbaiLee","MASS Gallery(본인선호) + 경기MoMA 소장(Lee Woong-bae)"],
"장영규":["Young Gyu Jang","https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=573371","SeMA 타이틀매치2021 + MMCA 다다익선(사운드설치)"],
"정소연":["Soyoun Jeong","http://www.soyounjeong.com/profile/","작가 공식 도메인 + SeMA 소장2점"],
"박소영":["Park So-young","https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=484","SeMA 소장전2016 + MMCA레지(조각, ≠배우)"],
"김민정":["Kim Min-jung","https://www.mmca.go.kr/eng/exhibitions/exhibitionsDetail.do?exhId=201705110000604","MMCA 고양레지 INTRO2017(영상작가, ≠한지화가 Minjung Kim)"],
"이정민":["Yi Joungmin","https://sema.seoul.go.kr/en/support/nanji_residency/detail_info?actNo=652948","SeMA 난지 '이정민 Yi Joungmin' + MMCA고양(동양화/영상)"],
"황수현":["Hwang Soo Hyun","https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1494700","SeMA 서서울미술관 개관 《호흡》(퍼포먼스, ≠황수연)"],
"유영운":["Yung Wun Yoo","https://www.mmca.go.kr/artStudio/artistDetail.do?cinArtId=201311100000570","MMCA 창작스튜디오 '유영운 Yung Wun Yoo'(조각, ≠유영국)"],
};
const fileByKo={};
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*(.+?)\s*$/m);if(m&&!fileByKo[m[1].trim()])fileByKo[m[1].trim()]=f;}
const slugify=s=>s.normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
let n=0,renamed=0;
for(const [ko,[pref,url,note]] of Object.entries(FIX)){
  const f=fileByKo[ko]; if(!f){console.log("못찾음",ko);continue;}
  const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const old=rec.name.latn.preferred;
  if(old&&old!==pref){ const vs=(rec.name.variants||[]).filter(v=>v.form!==pref);
    vs.push({form:old,lang:"en",script:"Latn",type:"alternate",source:"이전 표기/RR",accessed:AC}); rec.name.variants=vs; }
  rec.name.latn.preferred=pref;
  rec.sources=[{url,name_used:pref,note:"검수 정밀검증 — "+note,accessed:AC},...(rec.sources||[])];
  rec.status="reviewed";
  const slug=slugify(pref); rec.id=`person.${slug}`;
  writeFileSync(DIR+`${slug}.yaml`,yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  if(f!==`${slug}.yaml`){rmSync(DIR+f);renamed++;}
  console.log(`✓ ${ko}  ${old}→${pref}${f!==slug+".yaml"?" (rename)":""}`); n++;
}
console.log(`\n승격 ${n} / 리네임 ${renamed}`);
