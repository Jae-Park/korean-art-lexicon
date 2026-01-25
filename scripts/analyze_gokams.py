#!/usr/bin/env python3
"""
GOKAMS 한국미술 다국어 용어사전 심층 분석 스크립트

사용법:
  pip install playwright
  playwright install chromium
  python scripts/analyze_gokams.py
"""

import asyncio
from playwright.async_api import async_playwright
import json
import os

async def analyze_gokams():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        os.makedirs('output', exist_ok=True)
        results = {}

        # 네트워크 요청 모니터링
        requests_log = []
        page.on('request', lambda req: requests_log.append({
            'url': req.url,
            'method': req.method,
            'post_data': req.post_data
        }))

        # 1. 메인 페이지
        print("1. 메인 페이지...")
        await page.goto('https://www.gokams.or.kr:442/visual-art/art-terms/index.asp')
        await page.wait_for_load_state('networkidle')
        await page.screenshot(path='output/01_main.png', full_page=True)

        # 2. 미술용어 목록 페이지
        print("\n2. 미술용어 목록 페이지...")
        await page.goto('https://www.gokams.or.kr:442/visual-art/art-terms/glossary/art_list.asp')
        await page.wait_for_load_state('networkidle')
        await page.screenshot(path='output/02_art_list.png', full_page=True)

        # 목록 구조 분석
        art_list_structure = await page.evaluate('''() => {
            const items = document.querySelectorAll('table tr, .list-item, li a, .item');
            const links = document.querySelectorAll('a[href*="view"], a[href*="detail"]');
            return {
                url: window.location.href,
                itemCount: items.length,
                links: Array.from(links).slice(0, 20).map(a => ({
                    text: a.textContent.trim(),
                    href: a.href
                })),
                pageText: document.body.innerText.substring(0, 3000)
            };
        }''')
        results['art_list'] = art_list_structure
        print(f"   Items found: {art_list_structure['itemCount']}")

        # 3. 인명 목록 페이지
        print("\n3. 인명 목록 페이지...")
        await page.goto('https://www.gokams.or.kr:442/visual-art/art-terms/glossary/person_list.asp')
        await page.wait_for_load_state('networkidle')
        await page.screenshot(path='output/03_person_list.png', full_page=True)

        person_list_structure = await page.evaluate('''() => {
            const items = document.querySelectorAll('table tr, .list-item, li a, .item');
            const links = document.querySelectorAll('a[href*="view"], a[href*="detail"]');
            return {
                url: window.location.href,
                itemCount: items.length,
                links: Array.from(links).slice(0, 20).map(a => ({
                    text: a.textContent.trim(),
                    href: a.href
                })),
                pageText: document.body.innerText.substring(0, 3000)
            };
        }''')
        results['person_list'] = person_list_structure
        print(f"   Items found: {person_list_structure['itemCount']}")

        # 4. 단체/기관 목록 페이지
        print("\n4. 단체/기관 목록 페이지...")
        await page.goto('https://www.gokams.or.kr:442/visual-art/art-terms/glossary/group_list.asp')
        await page.wait_for_load_state('networkidle')
        await page.screenshot(path='output/04_group_list.png', full_page=True)

        group_list_structure = await page.evaluate('''() => {
            const items = document.querySelectorAll('table tr, .list-item, li a, .item');
            const links = document.querySelectorAll('a[href*="view"], a[href*="detail"]');
            return {
                url: window.location.href,
                itemCount: items.length,
                links: Array.from(links).slice(0, 20).map(a => ({
                    text: a.textContent.trim(),
                    href: a.href
                })),
                pageText: document.body.innerText.substring(0, 3000)
            };
        }''')
        results['group_list'] = group_list_structure
        print(f"   Items found: {group_list_structure['itemCount']}")

        # 5. 번역 표기 권고안 페이지
        print("\n5. 번역 표기 권고안 페이지...")
        await page.goto('https://www.gokams.or.kr:442/visual-art/art-terms/glossary/recommendation.asp')
        await page.wait_for_load_state('networkidle')
        await page.screenshot(path='output/05_recommendation.png', full_page=True)

        recommendation_structure = await page.evaluate('''() => {
            return {
                url: window.location.href,
                pageText: document.body.innerText.substring(0, 5000)
            };
        }''')
        results['recommendation'] = recommendation_structure

        # 6. 미술용어 상세 페이지 (첫 번째 항목 클릭)
        print("\n6. 미술용어 상세 페이지...")
        await page.goto('https://www.gokams.or.kr:442/visual-art/art-terms/glossary/art_list.asp')
        await page.wait_for_load_state('networkidle')

        first_item = await page.query_selector('a[href*="art_view"], .list-item a, table a')
        if first_item:
            await first_item.click()
            await page.wait_for_load_state('networkidle')
            await page.screenshot(path='output/06_art_detail.png', full_page=True)

            art_detail = await page.evaluate('''() => {
                return {
                    url: window.location.href,
                    pageText: document.body.innerText
                };
            }''')
            results['art_detail'] = art_detail
            print(f"   Detail URL: {art_detail['url']}")

        # 7. 인명 상세 페이지
        print("\n7. 인명 상세 페이지...")
        await page.goto('https://www.gokams.or.kr:442/visual-art/art-terms/glossary/person_list.asp')
        await page.wait_for_load_state('networkidle')

        first_person = await page.query_selector('a[href*="person_view"], .list-item a, table a')
        if first_person:
            await first_person.click()
            await page.wait_for_load_state('networkidle')
            await page.screenshot(path='output/07_person_detail.png', full_page=True)

            person_detail = await page.evaluate('''() => {
                return {
                    url: window.location.href,
                    pageText: document.body.innerText
                };
            }''')
            results['person_detail'] = person_detail
            print(f"   Detail URL: {person_detail['url']}")

        # 8. 용어사전 소개 페이지
        print("\n8. 용어사전 소개 페이지...")
        await page.goto('https://www.gokams.or.kr:442/visual-art/art-terms/intro/info.asp')
        await page.wait_for_load_state('networkidle')
        await page.screenshot(path='output/08_intro.png', full_page=True)

        intro_structure = await page.evaluate('''() => {
            return {
                url: window.location.href,
                pageText: document.body.innerText
            };
        }''')
        results['intro'] = intro_structure

        # 9. 일러두기 페이지
        print("\n9. 일러두기 페이지...")
        await page.goto('https://www.gokams.or.kr:442/visual-art/art-terms/intro/point.asp')
        await page.wait_for_load_state('networkidle')
        await page.screenshot(path='output/09_point.png', full_page=True)

        point_structure = await page.evaluate('''() => {
            return {
                url: window.location.href,
                pageText: document.body.innerText
            };
        }''')
        results['point'] = point_structure

        # 결과 저장
        results['api_requests'] = [r for r in requests_log if '.asp' in r['url']]

        with open('output/gokams_deep_analysis.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        print("\n=== 분석 완료 ===")
        print("출력 파일:")
        print("  - output/01_main.png ~ 09_point.png")
        print("  - output/gokams_deep_analysis.json")

        input("\nEnter 키를 누르면 브라우저 종료...")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(analyze_gokams())
