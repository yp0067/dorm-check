const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const contexts=[];const errors=[];
const out=process.env.SCREENSHOT_DIR || 'test-results';
await mkdir(out,{recursive:true});
async function enter(name){const context=await browser.newContext({viewport:{width:1360,height:1000},timezoneId:'Asia/Shanghai',permissions:['clipboard-read','clipboard-write']});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4180/dorm-test/');await page.getByLabel('姓名',{exact:true}).fill(name);await page.getByRole('button',{name:'进入查寝页面'}).click();await page.getByRole('button',{name:'退出姓名入口'}).waitFor();return page;}
try{
 const student=await enter('刘行');const date=await student.getByLabel('查寝日期').inputValue();
 await student.getByLabel('请假开始时间').fill(date+'T18:00');await student.getByLabel('请假原因',{exact:true}).fill('回家（测试示例）');await student.getByLabel('预计到寝室时间').fill(date+'T23:00');await student.getByRole('button',{name:'提交请假登记'}).click();await student.getByRole('status').waitFor();
 const head=await enter('黄睿鑫');assert.equal(await head.locator('.status-picker button').count(),6);assert.equal(await head.getByRole('button',{name:'待确认',exact:true}).count(),0);
 await head.getByRole('button',{name:'今晚无法查寝',exact:true}).click();await head.getByRole('status').waitFor();
 const waitingMonitor=await enter('胡运萍');await waitingMonitor.getByRole('region',{name:'待查寝寝室'}).waitFor();assert.equal(await waitingMonitor.getByRole('button',{name:'待查寝 3',exact:true}).count(),1);await waitingMonitor.getByRole('button',{name:'待查寝 3',exact:true}).click();assert.equal(await waitingMonitor.locator('.comparison tbody tr').count(),3);await waitingMonitor.screenshot({path:out+'/更新版-待查寝.png'});
 await head.getByRole('button',{name:'提交查寝结果'}).click();await head.getByRole('alert').filter({hasText:'每位同学'}).waitFor();
 for(const name of ['刘行','杜吉贺','黄睿鑫'])await head.getByRole('group',{name:name+'的查寝结果'}).getByRole('button',{name:name==='刘行'?'未归':'在寝',exact:true}).click();
 await head.getByRole('button',{name:'提交查寝结果'}).click();await head.getByRole('status').waitFor();await head.screenshot({path:out+'/GitHub版-寝室长.png'});
 const deputy=await enter('王诗琪');await deputy.getByLabel('刘行请假时间一致').check();await deputy.getByLabel('刘行请假原因一致').check();assert.equal(await deputy.locator('input[type=checkbox]').count(),2);await deputy.getByLabel('补充备注',{exact:false}).fill('杜吉贺，原计划回家，现已返寝。（测试示例）');await deputy.getByRole('button',{name:'提交给班长',exact:true}).click();await deputy.getByRole('status').waitFor();
 const monitor=await enter('胡运萍');assert.equal(await monitor.locator('.comparison tbody tr').count(),43);assert.deepEqual(await monitor.locator('thead th').allTextContents(),['01同学原始请假','02寝室长查寝','03副班核对 / 补充']);assert.match(await monitor.locator('.stat').nth(3).innerText(),/40/);assert.doesNotMatch(await monitor.locator('body').innerText(),/待确认/);
 assert.equal(await monitor.locator('.filter-buttons').getByRole('button',{name:'待核对',exact:true}).count(),0);assert.equal(await monitor.locator('.filter-buttons').getByRole('button',{name:'需关注',exact:true}).count(),0);
 assert.equal(await monitor.getByRole('region',{name:'待查寝寝室'}).count(),0);
 await monitor.getByRole('button',{name:'已登记 3',exact:true}).click();assert.equal(await monitor.locator('.comparison tbody tr').count(),3);
 await monitor.getByRole('button',{name:'未查寝 40',exact:true}).click();assert.equal(await monitor.locator('.comparison tbody tr').count(),40);
 await monitor.locator('.filter-buttons').getByRole('button',{name:'全部',exact:true}).click();
 await monitor.locator('.comparison tbody tr').filter({hasText:'刘行'}).getByRole('button',{name:'最终核验',exact:true}).click();await monitor.getByRole('button',{name:'确认核验通过'}).click();await monitor.getByRole('status').waitFor();
 await monitor.getByRole('button',{name:'生成查寝上报'}).click();const text=await monitor.getByRole('textbox',{name:'上报文字',exact:true}).inputValue();assert.match(text,/^1人未归\n刘行 回家（测试示例）/);assert.doesNotMatch(text,/未登记|食工261|副班补充/);await monitor.getByRole('note').filter({hasText:'40'}).waitFor();await monitor.getByRole('button',{name:'复制上报文字',exact:true}).click();assert.equal((await monitor.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),text);await monitor.screenshot({path:out+'/更新版-总结复制.png'});await monitor.getByRole('button',{name:'关闭上报文字'}).click();await monitor.screenshot({path:out+'/GitHub版-班长.png'});
 await head.setViewportSize({width:390,height:844});assert.equal(await head.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await head.screenshot({path:out+'/GitHub版-手机查寝.png'});
 await student.getByLabel('请假原因',{exact:true}).fill('就医（修改测试）');await student.getByRole('button',{name:'保存修改'}).click();await student.getByRole('alert').filter({hasText:'刷新'}).waitFor();assert.equal(await student.getByLabel('请假原因',{exact:true}).inputValue(),'就医（修改测试）');
 monitor.once('dialog',dialog=>dialog.accept());await monitor.getByRole('button',{name:'撤销刘行的请假',exact:true}).click();await monitor.getByRole('button',{name:'撤销刘行的请假',exact:true}).waitFor({state:'detached'});
 const cancelledRow=monitor.locator('.comparison tbody tr').filter({hasText:'刘行'});await cancelledRow.getByText('未填写请假',{exact:true}).waitFor();assert.equal(await cancelledRow.getByText('未归',{exact:true}).count(),1);assert.equal(await cancelledRow.getByText('无逐项核对记录',{exact:true}).count(),1);
 await deputy.getByRole('button',{name:'刷新记录',exact:true}).click();await deputy.getByText('今晚暂时没有同学填写请假。备忘录里有的同学，可以写在下面。',{exact:true}).waitFor();
 await monitor.getByRole('button',{name:'查看修改记录',exact:true}).click();await monitor.getByText('班长撤销同学请假',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: GitHub subdirectory assets/config, four independent clients, two attendance choices, no default presence, shared reports and stale edit protection.');
}finally{await browser.close();}
