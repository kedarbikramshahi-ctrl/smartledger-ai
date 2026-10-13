import { money, close, cashStatus, escapeText } from './ledger.js';

export function renderDashboard(records, dateRange) {
 const filteredRecords = () => records.filter(r => (!dateRange.start || r.date >= dateRange.start) && (!dateRange.end || r.date <= dateRange.end));
 function rangeLabel(){
 if(dateRange.start&&dateRange.end)return dateRange.start===dateRange.end?dateRange.start:dateRange.start+' to '+dateRange.end;
 if(dateRange.start)return 'From '+dateRange.start;
 if(dateRange.end)return 'Through '+dateRange.end;
 return 'All records';
}

 function render(){
 records.sort((a,b)=>b.date.localeCompare(a.date));
 const visible=filteredRecords(),label=rangeLabel(),sales=visible.reduce((a,r)=>a+r.cash+r.card,0),expenses=visible.reduce((a,r)=>a+r.expenses,0);
 for(const [id,title] of [['sales','Total sales'],['expenses','Cash expenses'],['closing','Latest closing cash'],['days','Days recorded']])document.querySelector('#'+id+'-label').textContent=title+' · '+label;
 document.querySelector('#chart-range').textContent=label;
 document.querySelector('#summary-range').textContent='Insights · '+label;
 document.querySelector('#sales').textContent=money(sales);
 document.querySelector('#expenses').textContent=money(expenses);
 document.querySelector('#closing').textContent=visible.length?money(close(visible[0])):'—';
 document.querySelector('#days').textContent=visible.length;
 document.querySelector('#filter-status').textContent=`Showing ${visible.length} of ${records.length} records · ${label}. Dashboard and CSV export use these records; backups include all records.`;
 document.querySelector('#rows').innerHTML=visible.map(r=>`<tr><td>${r.date}</td>${['opening','cash','card','expenses','withdrawals'].map(k=>`<td>${money(r[k])}</td>`).join('')}<td><strong>${money(close(r))}</strong></td><td>${r.actual===undefined?'—':money(r.actual)}</td><td>${cashStatus(r)}</td><td>${escapeText(r.notes||'—')}</td><td><button class="link" data-edit="${r.date}">Edit</button><button class="link" data-delete="${r.date}">Delete</button></td></tr>`).join('')||'<tr><td colspan="11">No records match this date range. Clear the filter or add a daily record.</td></tr>';
 const dates=[...visible].reverse(),max=Math.max(1,...dates.map(r=>r.cash+r.card));
 document.querySelector('#chart').innerHTML=dates.map(r=>`<div class="barwrap"><div title="${r.date}: ${money(r.cash+r.card)}" class="bar" style="height:${(r.cash+r.card)/max*135}px"></div>${r.date}</div>`).join('')||'<p>No recorded days in this date range.</p>';
 document.querySelector('#summary').textContent=visible.length?`For ${label}, you recorded ${visible.length} ${visible.length===1?'day':'days'}, with ${money(sales)} in total sales and ${money(expenses)} in cash expenses. Average recorded daily sales were ${money(Math.round(sales/visible.length))}. Your strongest recorded day was ${visible.reduce((best,r)=>r.cash+r.card>best.cash+best.card?r:best,visible[0]).date}. Card sales accounted for ${Math.round(visible.reduce((a,r)=>a+r.card,0)/Math.max(1,sales)*100)}% of recorded sales.`:`No records for ${label}. Add a daily record or change the date range to see your summary.`;
}

 render();
}
