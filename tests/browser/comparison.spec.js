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
  await page.locator('#ask-submit').click();await expect(page.locator('#ask-answer')).toContainText('October 13 had $40 more in cash sales');await expect(page.locator('#ask-evidence')).toBeHidden();
  await page.locator('#ask-evidence-title').click();await expect(page.locator('#ask-evidence')).toBeVisible();await expect(page.locator('#ask-evidence')).toContainText('counted $0.00');
  await expect(page.locator('#ask-evidence')).toContainText('first recorded opening');await expect(page.locator('#ask-context')).toContainText('2026-10-12');
  await expect(page.locator('#ask-forget')).toBeVisible();
  await page.locator('#ask-language').selectOption('ne');await page.locator('#ask-question').fill('ती दिनको कार्ड बिक्री कस्तो थियो?');await page.locator('#ask-submit').focus();await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>window.comparisonRequests[1].comparisonContext)).toBe('11111111-1111-4111-8111-111111111111');await expect(page.locator('#ask-answer')).toHaveAttribute('lang','ne');
  await expect(page.locator('#ask-evidence')).toBeHidden();await expect(page.locator('#ask-evidence-title')).toHaveText('प्रमाण');
  await page.locator('.ask-panel').screenshot({path:'test-results/comparison-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});await page.locator('.ask-panel').screenshot({path:'test-results/comparison-desktop.png'});
  await page.evaluate(()=>{window.comparisonUser.uid='bob';window.comparisonFixture.refresh();});await expect(page.locator('#ask-context')).toHaveText('');await expect(page.locator('#ask-answer')).toHaveText('');
  await page.locator('#ask-submit').click();expect(await page.evaluate(()=>window.comparisonRequests.at(-1).comparisonContext)).toBeUndefined();
  await page.locator('#ask-forget').click();await expect(page.locator('#ask-context')).toHaveText('');
});

test('comparison renders a single natural answer with collapsed keyboard-accessible evidence and conditional warning',async({page})=>{
  const periods=[{start:'2026-10-12',end:'2026-10-12'},{start:'2026-10-13',end:'2026-10-13'}];
  const q={metric:'compare',period:null,periods,fields:['total_sales'],useContext:false,reason:'none'},calendar=storeCalendar('America/New_York',new Date('2026-10-18T16:00Z'));
  const base={opening:0,card:0,expenses:0,withdrawals:0};
  const records=[{...base,date:'2026-10-12',cash:164600},{...base,date:'2026-10-13',cash:145000}];
  const facts=comparisonFacts(records,q,calendar),missing=comparisonFacts(records,{...q,periods:[periods[0],{start:'2026-10-14',end:'2026-10-14'}]},calendar);
  const responses=[facts,missing].map(f=>({status:'answered',language:'en',facts:f,answer:Object.values(comparisonSentences(f,'en')).join('\n\n')}));
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('#ask-status')).toContainText('Sign in');
  await page.evaluate(async responses=>{
    const {createAskLedgerUI}=await import('/src/ask-ledger.js');window.presentationIndex=0;
    createAskLedgerUI({context:()=>({uid:'fixture',ready:true,empty:false,version:1}),request:async()=>responses[window.presentationIndex]});
  },responses);
  await page.locator('#ask-question').fill('Compare October 12 with October 13 for total sales');await page.locator('#ask-submit').click();
  const answer='October 12 had $196 more in sales than October 13. Sales decreased by 11.91%, from $1,646 to $1,450.';
  await expect(page.locator('#ask-answer')).toHaveText(answer);await expect(page.locator('#ask-answer')).not.toContainText('incomplete');
  await expect(page.locator('#ask-evidence')).toBeHidden();await expect(page.locator('#ask-evidence-panel')).not.toHaveAttribute('open','');
  await page.locator('.ask-panel').screenshot({path:'test-results/comparison-answer-mobile.png'});
  await page.locator('#ask-evidence-title').focus();await page.keyboard.press('Enter');await expect(page.locator('#ask-evidence')).toBeVisible();
  await expect(page.locator('#ask-evidence')).toContainText('1/1');await expect(page.locator('#ask-evidence')).not.toContainText(answer);
  expect(await page.locator('.ask-panel').innerText()).toContain(answer);expect((await page.locator('.ask-panel').innerText()).split(answer)).toHaveLength(2);
  await page.setViewportSize({width:1440,height:1000});await page.locator('.ask-panel').screenshot({path:'test-results/comparison-answer-desktop.png'});
  await page.locator('#ask-submit').click();await expect(page.locator('#ask-answer')).toHaveText(answer);await expect(page.locator('#ask-evidence')).toBeHidden();expect(await page.locator('#ask-answer').count()).toBe(1);
  await page.evaluate(()=>window.presentationIndex=1);await page.locator('#ask-question').fill('Compare October 12 with October 14');await page.locator('#ask-submit').click();await expect(page.locator('#ask-answer')).toContainText('incomplete records');
  await page.locator('#ask-evidence-title').click();await expect(page.locator('#ask-evidence')).toContainText('0/1');
});
