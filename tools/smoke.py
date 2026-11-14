"""Test dymny: konto, seria, wszystkie zakładki, tryb offline. Uruchom na zbudowanej wersji (dist na :4173)."""
import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    errs=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for (w,h,mob) in [(390,844,True),(1280,800,False)]:
            ctx = await b.new_context(viewport={'width':w,'height':h}, is_mobile=mob, has_touch=mob)
            await ctx.add_init_script("const g=Storage.prototype.getItem;Storage.prototype.getItem=function(k){return String(k).startsWith('mt_tour_done_')?'1':g.call(this,k)}")
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:4173/', wait_until='networkidle')
            await pg.get_by_placeholder('np. Kuba, Zosia, Mistrz7').fill('Smoke')
            await pg.get_by_placeholder('np. 1234').fill('1234')
            await pg.get_by_role('button', name='Utwórz konto i zacznij trening').click()
            await pg.wait_for_timeout(1500)
            # pomiń przewodnik
            for _ in range(3):
                sk = pg.get_by_role('button', name='Pomiń')
                if await sk.count(): await sk.first.click(); await pg.wait_for_timeout(300)
            await pg.locator('[data-testid=next-step]').click()
            await pg.wait_for_timeout(600)
            if await pg.locator('[data-testid=lesson-intro-start]').count():
                await pg.locator('[data-testid=lesson-intro-start]').click(); await pg.wait_for_timeout(300)
            for i in range(10):
                txt = await pg.locator('body').inner_text()
                import re
                m = re.search(r'(\d+)\s*([×÷:])\s*(\d+)\s*\|?\s*=', txt)
                if not m: break
                a,op,b2 = int(m.group(1)), m.group(2), int(m.group(3))
                ans = a*b2 if op=='×' else a//b2
                for ch in str(ans): await pg.keyboard.press(ch)
                await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1300)
            await pg.wait_for_timeout(800)
            await pg.screenshot(path=f'/tmp/smoke_{w}_end.png')
            done = await pg.locator('body').inner_text()
            print(w, 'po serii:', 'OK' if ('zaliczona' in done or 'Wynik' in done or 'poprawn' in done.lower()) else done[:200].replace('\n',' | '))
            for nm in ['Dalej po ścieżce', 'Wróć do panelu']:
                bt = pg.get_by_role('button', name=nm)
                if await bt.count():
                    await bt.first.click(); break
            await pg.wait_for_timeout(700)
            for tab in ['Turnieje','Statystyki','Szablony','Konto','Trening']:
                t = pg.get_by_role('button', name=tab).first
                await t.click(); await pg.wait_for_timeout(900)
                await pg.screenshot(path=f'/tmp/smoke_{w}_{tab}.png')
            await ctx.set_offline(True); await pg.reload(); await pg.wait_for_timeout(2500)
            await pg.get_by_role('button', name='Statystyki').first.click(); await pg.wait_for_timeout(1200)
            off = await pg.locator('body').inner_text()
            print(w, 'offline statystyki:', 'OK' if 'Wczytywanie' not in off and len(off)>200 else 'BŁĄD')
            await ctx.close()
        await b.close()
    print('pageerrors:', errs[:5] or 'brak')
    sys.exit(1 if errs else 0)
asyncio.run(main())
