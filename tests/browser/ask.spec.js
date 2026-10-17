import { test, expect } from '@playwright/test';

test('Ask UI is keyboard/mobile usable; mocked answers, language, evidence and failures',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('#ask-submit')).toBeDisabled();await expect(page.locator('#ask-status')).toContainText('Sign in');
  // Isolate UI tests from real cloud/AI services. Authentication is tested separately.
  await page.evaluate(async()=>{
    const {createAskLedgerUI}=await import('/src/ask-ledger.js');
    window.askTestContext={uid:'fixture-owner',ready:true,busy:false,empty:false,emulator:false,version:1};
    window.askTestMode='answer';window.askRequests=[];
    window.askUIFixture=createAskLedgerUI({context:()=>window.askTestContext,request:async request=>{
      window.askRequests.push(request);
      if(window.askTestMode==='error')throw Error('AI service unavailable');
      if(window.askTestMode==='unsupported')return {status:'unsupported',answer:'Please ask about a supported ledger metric.',language:request.language};
      return {status:'answered',language:request.language,answer:request.language==='ne'?'रेकर्ड गरिएको बिक्री $50.00 छ।':'Recorded sales were $50.00.',facts:{query:{metric:'sales',period:'last_week'},timezone:'America/New_York',today:'2026-10-14',current:{start:'2026-10-05',end:'2026-10-11',recordedDays:1,expectedDays:7,missingDays:6,salesCents:5000,cardCents:3000,expensesCents:500,highest:[],differences:[]}}};
    }});
  });
  await page.getByRole('button',{name:"Last week's sales",exact:true}).click();await expect(page.locator('#ask-question')).toBeFocused();
  await expect(page.locator('#ask-question')).toHaveValue('What were my total sales last week?');
  await page.locator('#ask-submit').focus();await page.keyboard.press('Enter');await expect(page.locator('#ask-answer')).toContainText('$50.00');
  await expect(page.locator('#ask-evidence')).toContainText('2026-10-05 → 2026-10-11');
  await expect(page.locator('#ask-evidence')).toContainText('Missing days: 6');
  await page.locator('#ask-language').selectOption('ne');await expect(page.locator('#ask-answer')).toHaveText('');
  await page.locator('#ask-question').fill('गत हप्ताको बिक्री कति भयो?');await page.locator('#ask-submit').click();await expect(page.locator('#ask-answer')).toContainText('बिक्री');await expect(page.locator('#ask-answer')).toHaveAttribute('lang','ne');
  await page.locator('.ask-panel').screenshot({path:'test-results/ask-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});await page.locator('.ask-panel').screenshot({path:'test-results/ask-desktop.png'});await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.askTestMode='unsupported');await page.locator('#ask-submit').click();await expect(page.locator('#ask-status')).toContainText('outside');
  await expect(page.locator('#ask-evidence')).toHaveText('');
  await page.evaluate(()=>window.askTestMode='error');await page.locator('#ask-submit').click();await expect(page.locator('#ask-status')).toHaveText('AI service unavailable');await expect(page.locator('#ask-submit')).toBeEnabled();
  await page.evaluate(()=>{window.askTestContext.empty=true;window.askUIFixture.refresh();});await expect(page.locator('#ask-submit')).toBeDisabled();await expect(page.locator('#ask-answer')).toHaveText('');
  const width=await page.locator('.ask-panel').evaluate(el=>({panel:el.getBoundingClientRect().width,question:el.querySelector('textarea').getBoundingClientRect().width}));expect(width.question).toBeLessThanOrEqual(width.panel);
  expect(errors).toEqual([]);
});
