import { test, expect } from '@playwright/test';
import { comparisonFacts } from '../../server/comparison.js';
import { comparisonSentences } from '../../src/comparison-view.js';
import { storeCalendar } from '../../server/ask-facts.js';

test('custom comparison displays evidence, supports bilingual follow-ups and forgets other accounts',async({page})=>{
  const periods=[{start:'2026-10-12',end:'2026-10-12'},{start:'2026-10-13',end:'2026-10-13'}];
  const query={metric:'compare',period:null,periods,fields:['cash','opening','actual','reconciliation'],useContext:false,reason:'none'};
  const record={opening:10000,cash:5000,card:2000,expenses:500,withdrawals:1000};
  const facts=comparisonFacts([{...record,date:'2026-10-12',actual:0},{...record,date:'2026-10-13',opening:80000,cash:9000}],query,storeCalendar('America/New_York',new Date('2026-10-18T16:00Z')));
  const cardFacts=comparisonFacts([{...record,date:'2026-10-12',actual:0},{...record,date:'2026-10-13',opening:80000,cash:9000}],{...query,fields:['card']},storeCalendar('America/New_York',new Date('2026-10-18T16:00Z')));
  const answers={en:Object.values(comparisonSentences(facts,'en')).join('\n\n'),ne:Object.values(comparisonSentences(cardFacts,'ne')).join('\n\n')};
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('#ask-status')).toContainText('Sign in');
  await page.evaluate(async({facts,cardFacts,answers,periods})=>{
    const {createAskLedgerUI}=await import('/src/ask-ledger.js');
    window.comparisonUser={uid:'alice',ready:true,version:1,empty:false};window.comparisonRequests=[];
    window.comparisonFixture=createAskLedgerUI({context:()=>window.comparisonUser,request:async body=>{window.comparisonRequests.push(body);const selected=body.language==='ne'?cardFacts:facts;return {status:'answered',language:body.language,answer:answers[body.language],facts:selected,comparisonContext:'11111111-1111-4111-8111-111111111111',confirmedComparison:{periods,fields:selected.query.fields}};}});
  },{facts,cardFacts,answers,periods});
  await page.locator('#ask-question').fill('Hey, compare October 12 with October 13. Which day had more cash sales, and by how much?');
  await page.locator('#ask-submit').click();await expect(page.locator('#ask-answer')).toContainText('B is higher');await expect(page.locator('#ask-evidence')).toContainText('counted $0.00');
  await expect(page.locator('#ask-evidence')).toContainText('first recorded opening');await expect(page.locator('#ask-context')).toContainText('2026-10-12');
  await expect(page.locator('#ask-forget')).toBeVisible();
  await page.locator('#ask-language').selectOption('ne');await page.locator('#ask-question').fill('ती दिनको कार्ड बिक्री कस्तो थियो?');await page.locator('#ask-submit').focus();await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>window.comparisonRequests[1].comparisonContext)).toBe('11111111-1111-4111-8111-111111111111');await expect(page.locator('#ask-answer')).toHaveAttribute('lang','ne');
  await page.locator('.ask-panel').screenshot({path:'test-results/comparison-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});await page.locator('.ask-panel').screenshot({path:'test-results/comparison-desktop.png'});
  await page.evaluate(()=>{window.comparisonUser.uid='bob';window.comparisonFixture.refresh();});await expect(page.locator('#ask-context')).toHaveText('');await expect(page.locator('#ask-answer')).toHaveText('');
  await page.locator('#ask-submit').click();expect(await page.evaluate(()=>window.comparisonRequests.at(-1).comparisonContext)).toBeUndefined();
  await page.locator('#ask-forget').click();await expect(page.locator('#ask-context')).toHaveText('');
});
