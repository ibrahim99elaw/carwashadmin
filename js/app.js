const $app = document.getElementById('app');
const S = { user: null, settings: null, tab: 'dash', from: today(), to: today() };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function today() { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
const $ = id => document.getElementById(id);
const money = n => Math.round(n).toLocaleString('ar-EG') + ' ج';

async function init() { S.settings = await DB.getSettings(); loginView(); }

function loginView() {
  $app.innerHTML = `<div class="wrap login"><div class="card">
    <h1>🚗 لوحة المالك</h1><div class="mut">الوضع: ${DB.mode}</div>
    <label>الرقم السري</label><input id="pin" type="password" inputmode="numeric">
    <button class="full" id="go">دخول</button><div id="err" class="alert"></div>
    <p class="mut">أول مرة: الرقم 1234 (غيّره من الإعدادات)</p></div></div>`;
  $('go').onclick = () => {
    if ($('pin').value !== S.settings.ownerPin) return $('err').textContent = 'رقم سري غلط';
    S.user = { role: 'owner' }; ownerView();
  };
}

const header = t => `<header><h1>${t}</h1><button class="sec" onclick="S.user=null;loginView()">خروج</button></header>`;

async function ownerView() {
  const tabs = [['dash', 'التقارير'], ['workers', 'العمال'], ['set', 'الإعدادات']];
  $app.innerHTML = `<div class="wrap">${header('لوحة المالك')}<div class="tabs">${tabs.map(t => `<button class="${S.tab === t[0] ? 'on' : ''}" onclick="S.tab='${t[0]}';ownerView()">${t[1]}</button>`).join('')}</div><div id="body"></div></div>`;
  ({ dash: dashTab, workers: workersTab, set: setTab })[S.tab]();
}

const DEFAULT_FOLLOW = 'أهلاً بحضرتك 🌟 معاك إدارة غسيل العربيات. حبينا نطمّن على خدمة غسيل عربيتك ({plate}) - {service}. إيه رأيك في الخدمة؟ وعندك أي ملاحظات أو اقتراحات؟ رأيك يهمنا جداً.';
function followWa(x) {
  let p = x.phone.replace(/\D/g, ''); if (p.startsWith('0')) p = '2' + p;
  const msg = (S.settings.followMsg || DEFAULT_FOLLOW).replace('{plate}', x.plate).replace('{service}', x.service);
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

async function dashTab() {
  const workers = await DB.list('workers');
  const inR = x => x.date >= S.from && x.date <= S.to;
  const washes = (await DB.list('washes')).filter(inR).sort((a, b) => b.ts - a.ts);
  const refills = (await DB.list('refills')).filter(inR);
  const lpw = S.settings.litersPerWash || 40;
  const rows = workers.map(w => {
    const ws = washes.filter(x => x.workerId === w.id), rev = ws.reduce((s, x) => s + x.price, 0);
    const cash = ws.filter(x => x.pay === 'cash').reduce((s, x) => s + x.price, 0);
    const lit = refills.filter(x => x.workerId === w.id).reduce((s, x) => s + x.liters, 0);
    const exp = Math.floor(lit / lpw), gap = exp - ws.length;
    return { w, n: ws.length, rev, cash, lit, exp, gap, share: rev * w.pct / 100 };
  });
  const T = k => rows.reduce((s, r) => s + r[k], 0);
  $('body').innerHTML = `<div class="card"><div class="row"><div><label>من</label><input type="date" id="f" value="${S.from}"></div>
    <div><label>إلى</label><input type="date" id="t" value="${S.to}"></div></div></div>
  <div class="card"><div class="grid"><div class="stat">عدد الغسلات<b>${washes.length}</b></div>
    <div class="stat">الإيراد<b>${money(T('rev'))}</b></div><div class="stat">كاش مفروض يتسلم<b>${money(T('cash'))}</b></div>
    <div class="stat">نصيب العمال<b>${money(T('share'))}</b></div><div class="stat">صافي لك<b>${money(T('rev') - T('share'))}</b></div></div></div>
  <div class="card"><h2>كل عامل</h2><div class="tw"><table><tr><th>العامل</th><th>العربة</th><th>غسلات</th><th>إيراد</th><th>كاش</th><th>مياه (لتر)</th><th>غسلات متوقعة من المياه</th></tr>
  ${rows.map(r => `<tr><td>${esc(r.w.name)}</td><td>${esc(r.w.cart)}</td><td>${r.n}</td><td>${r.rev}</td><td>${r.cash}</td><td>${r.lit}</td>
  <td class="${r.gap >= 2 ? 'alert' : 'ok'}">${r.exp}${r.gap >= 2 ? ` ⚠️ ناقص ${r.gap} غسلة غير مسجلة` : ''}</td></tr>`).join('')}</table></div>
  <p class="mut">المتوقع = لترات المياه المعبّاة ÷ ${lpw} لتر للغسلة. لو أكبر بكتير من المسجل، في غسيل مش متسجل.</p></div>
  <div class="card"><h2>سجل الغسلات</h2><div class="tw"><table><tr><th>#</th><th>تاريخ</th><th>عامل</th><th>عربية</th><th>خدمة</th><th>سعر</th><th>دفع</th><th></th></tr>
  ${washes.map(x => `<tr><td>${x.no}</td><td>${x.date}</td><td>${esc(x.workerName)}</td><td>${esc(x.plate)}</td><td>${esc(x.service)}</td><td>${x.price}</td>
  <td>${x.pay === 'cash' ? 'كاش' : 'رقمي'}</td><td>${x.phone ? `<a class="wa" target="_blank" href="${followWa(x)}">📲 متابعة العميل</a>` : '<span class="mut">لا يوجد رقم</span>'} <button class="del" data-id="${x.id}">حذف</button></td></tr>`).join('') || '<tr><td colspan="8" class="mut">لا يوجد</td></tr>'}</table></div></div>`;
  $('f').onchange = e => { S.from = e.target.value; dashTab(); };
  $('t').onchange = e => { S.to = e.target.value; dashTab(); };
  document.querySelectorAll('.del').forEach(b => b.onclick = async () => { if (confirm('حذف الغسلة؟')) { await DB.remove('washes', b.dataset.id); dashTab(); } });
}

async function workersTab() {
  const workers = await DB.list('workers');
  $('body').innerHTML = `<div class="card"><h2>إضافة عامل</h2>
    <label>الاسم</label><input id="n"><label>اسم/رقم العربة</label><input id="c">
    <label>الرقم السري للعامل</label><input id="p" inputmode="numeric"><label>نسبة العامل % من كل غسلة</label><input id="pc" type="number" value="35">
    <button class="full" id="add">إضافة</button></div>
  <div class="card"><h2>العمال</h2>${workers.map(w => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--bd)">
  <span>${esc(w.name)} - ${esc(w.cart)} (${w.pct}%)</span><button class="del" data-id="${w.id}">حذف</button></div>`).join('') || '<div class="mut">لا يوجد</div>'}</div>`;
  $('add').onclick = async () => {
    const o = { name: $('n').value.trim(), cart: $('c').value.trim(), pin: $('p').value.trim(), pct: +$('pc').value };
    if (!o.name || !o.pin) return alert('الاسم والرقم السري مطلوبين');
    await DB.add('workers', o); workersTab();
  };
  document.querySelectorAll('.del').forEach(b => b.onclick = async () => { if (confirm('حذف العامل؟')) { await DB.remove('workers', b.dataset.id); workersTab(); } });
}

function setTab() {
  const s = S.settings;
  $('body').innerHTML = `<div class="card"><h2>الإعدادات</h2>
    <label>الخدمات والأسعار (سطر لكل خدمة: الاسم:السعر)</label>
    <textarea id="sv" rows="4">${s.services.map(x => x.name + ':' + x.price).join('\n')}</textarea>
    <label>لترات المياه المستهلكة في الغسلة الواحدة (تقريبي)</label><input id="l" type="number" value="${s.litersPerWash}">
    <label>رسالة متابعة العميل على واتساب (استخدم {plate} للعربية و{service} للخدمة)</label>
    <textarea id="fm" rows="4">${esc(s.followMsg || DEFAULT_FOLLOW)}</textarea>
    <label>الرقم السري للمالك</label><input id="op" value="${esc(s.ownerPin)}">
    <button class="full" id="sv2">حفظ</button></div>`;
  $('sv2').onclick = async () => {
    S.settings = { ...s, litersPerWash: +$('l').value || 40, ownerPin: $('op').value || '1234', followMsg: $('fm').value.trim(),
      services: $('sv').value.split('\n').map(r => r.split(':')).filter(r => r[0] && +r[1]).map(r => ({ name: r[0].trim(), price: +r[1] })) };
    await DB.saveSettings(S.settings); alert('تم الحفظ');
  };
}

init();
