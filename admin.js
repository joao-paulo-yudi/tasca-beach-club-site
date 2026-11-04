/* Área do clube: agenda, confirmações, bloqueios e configurações. */
(function () {
  const C = window.TASCA, B = window.TascaBooking;
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const ESP = { volei: 'Vôlei de praia', 'beach-tennis': 'Beach tennis', futevolei: 'Futevôlei', bloqueio: 'Bloqueio' };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fone = t => { const v = String(t || '').replace(/\D/g, ''); return v.length >= 10 ? `(${v.slice(0, 2)}) ${v.slice(2, v.length - 4)}-${v.slice(-4)}` : v; };
  let tab = 'agenda', dia = B.iso(new Date()), cfg = null;

  async function start() {
    const s = await B.session().catch(() => null);
    if (!s) return login();
    $('#out').hidden = false;
    $('#out').onclick = async () => { await B.logout(); location.reload(); };
    cfg = await B.config();
    render();
  }

  function login() {
    app.innerHTML = `<div class="card login">
      <p class="cap">Tasca Beach Club</p>
      <h1 class="h3" style="font-size:40px;margin-top:8px">Entrar</h1>
      ${B.LIVE ? '' : '<p class="note" style="margin-top:8px">Modo demonstração: use qualquer e-mail e a senha <b>demo</b>.</p>'}
      <form id="lf">
        <div class="f"><label for="em">E-mail</label><input id="em" type="email" autocomplete="username" required></div>
        <div class="f"><label for="pw">Senha</label><input id="pw" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-ink" style="margin-top:18px" type="submit">Entrar<span class="dot"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span></button>
        <div id="lm"></div>
      </form></div>`;
    $('#lf').onsubmit = async e => {
      e.preventDefault();
      try { await B.login($('#em').value, $('#pw').value); start(); }
      catch (err) { $('#lm').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
    };
  }

  function render() {
    app.innerHTML = `<div class="tabs" role="tablist">
      ${[['agenda', 'Agenda'], ['bloquear', 'Bloquear horário'], ['config', 'Preço e horários']].map(([k, t]) => `<button class="tab" role="tab" data-t="${k}" aria-selected="${tab === k}">${t}</button>`).join('')}
      </div><div id="pane"></div>`;
    app.querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    ({ agenda, bloquear, config: configPane })[tab]();
  }

  async function agenda() {
    const pane = $('#pane');
    pane.innerHTML = `<div class="card"><div class="row-h">
      <div class="f" style="margin:0;min-width:220px"><label for="dd">Dia</label><input id="dd" type="date" value="${dia}"></div>
      <div style="display:flex;gap:8px"><button class="mini" id="prev">Dia anterior</button><button class="mini" id="next">Próximo dia</button></div>
      </div><div class="counts" id="cnt"></div><div id="list" style="margin-top:16px;overflow-x:auto">Carregando...</div></div>`;
    $('#dd').onchange = e => { dia = e.target.value; agenda(); };
    const shift = n => { const d = B.parse(dia); d.setDate(d.getDate() + n); dia = B.iso(d); agenda(); };
    $('#prev').onclick = () => shift(-1); $('#next').onclick = () => shift(1);
    let rows = [];
    try { rows = await B.listar(dia, dia); } catch (e) { $('#list').innerHTML = `<div class="err">Não deu para carregar: ${esc(e.message)}</div>`; return; }
    const ativos = rows.filter(r => r.status !== 'cancelada');
    const pend = rows.filter(r => r.status === 'pendente');
    const conf = rows.filter(r => r.status === 'confirmada');
    $('#cnt').innerHTML = `<div><b>${pend.length}</b>horas pendentes</div><div><b>${conf.length}</b>horas confirmadas</div><div><b>R$ ${(conf.length * cfg.precoHora).toLocaleString('pt-BR')}</b>previsto confirmado</div>`;
    if (!rows.length) { $('#list').innerHTML = '<p class="note">Nenhuma reserva neste dia.</p>'; return; }
    // agrupa horas seguidas do mesmo pedido
    const groups = new Map();
    rows.forEach(r => { const k = r.grupo || r.id; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    const list = [...groups.values()].map(g => g.sort((a, b) => a.hora - b.hora)).sort((a, b) => a[0].hora - b[0].hora || a[0].quadra - b[0].quadra);
    $('#list').innerHTML = `<table><thead><tr><th>Horário</th><th>Quadra</th><th>Quem</th><th class="hide-sm">Esporte</th><th>Status</th><th></th></tr></thead><tbody>${list.map(g => {
      const r = g[0], ids = g.map(x => x.id).join(','), ex = g.some(x => x.exemplo);
      const quando = `quadra ${r.quadra}, ${B.parse(r.data).toLocaleDateString('pt-BR')} das ${g[0].hora}h às ${g[g.length - 1].hora + 1}h`;
      const msg = r.status === 'cancelada'
        ? `Olá, ${r.nome}! Aqui é do Tasca Beach Club. Sua reserva da ${quando} foi cancelada. Se quiser remarcar, é só responder aqui.`
        : `Olá, ${r.nome}! Aqui é do Tasca Beach Club. Sua reserva da ${quando} está confirmada. Até lá!`;
      const wa = r.telefone && r.status !== 'bloqueio' ? `https://wa.me/55${r.telefone.replace(/^55/, '')}?text=${encodeURIComponent(msg)}` : '';
      return `<tr><td><b>${g[0].hora}h às ${g[g.length - 1].hora + 1}h</b></td><td>Q${r.quadra}</td><td>${esc(r.nome)}<br><span class="note">${ex ? 'exemplo' : fone(r.telefone)}</span></td><td class="hide-sm">${ESP[r.esporte] || r.esporte}</td><td><span class="st ${r.status}">${r.status}</span></td><td style="white-space:nowrap">${
        (r.status === 'pendente' ? `<button class="mini ok" data-a="confirmada" data-ids="${ids}">Confirmar</button>` : '') +
        (r.status !== 'cancelada' ? `<button class="mini no" data-a="cancelada" data-ids="${ids}">${r.status === 'bloqueio' ? 'Liberar' : 'Cancelar'}</button>` : '') +
        (wa ? `<a class="mini" href="${wa}" target="_blank" rel="noopener">${r.status === 'cancelada' ? 'Avisar no WhatsApp' : 'WhatsApp'}</a>` : '')}</td></tr>`;
    }).join('')}</tbody></table>`;
    $('#list').querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      // cancelar pede um segundo toque, sem caixa de diálogo
      if (b.dataset.a === 'cancelada' && !b.dataset.sure) {
        const txt = b.textContent;
        b.dataset.sure = '1'; b.textContent = `Toque de novo para ${txt.toLowerCase()}`;
        setTimeout(() => { if (b.isConnected && !b.disabled) { delete b.dataset.sure; b.textContent = txt; } }, 4000);
        return;
      }
      b.disabled = true;
      try { await B.status(b.dataset.ids.split(','), b.dataset.a); agenda(); } catch (e) { b.disabled = false; b.textContent = 'Erro, tente de novo'; console.warn(e); }
    });
  }

  function bloquear() {
    const pane = $('#pane');
    const opts = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${h}h</option>`).join('');
    pane.innerHTML = `<div class="card"><p class="note">Use para torneios, aulas, manutenção ou reservas feitas por telefone. O horário some do site na hora.</p>
      <form id="bf" style="display:grid;gap:4px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
        <div class="f"><label for="bd">Dia</label><input id="bd" type="date" value="${dia}" required></div>
        <div class="f"><label for="bq">Quadra</label><select id="bq">${Array.from({ length: cfg.quadras }, (_, i) => `<option value="${i + 1}">Quadra ${i + 1}</option>`).join('')}<option value="all">Todas</option></select></div>
        <div class="f"><label for="b0">Das</label><select id="b0">${opts}</select></div>
        <div class="f"><label for="b1">Até</label><select id="b1">${opts}</select></div>
        <div class="f" style="grid-column:1/-1"><label for="bo">Motivo</label><input id="bo" placeholder="Ex.: Torneio de sábado, aula, reserva por telefone (nome)"></div>
        <div style="grid-column:1/-1"><button class="btn btn-ink" type="submit">Bloquear<span class="dot"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span></button></div>
      </form><div id="bm"></div></div>`;
    $('#b0').value = 16; $('#b1').value = 18;
    $('#bf').onsubmit = async e => {
      e.preventDefault();
      const d = $('#bd').value, a = +$('#b0').value, b = +$('#b1').value;
      if (b <= a) { $('#bm').innerHTML = '<div class="err">O horário final precisa ser depois do inicial.</div>'; return; }
      const horas = Array.from({ length: b - a }, (_, i) => a + i);
      const qs = $('#bq').value === 'all' ? Array.from({ length: cfg.quadras }, (_, i) => i + 1) : [+$('#bq').value];
      try { for (const q of qs) await B.bloquear(q, d, horas, $('#bo').value.trim()); $('#bm').innerHTML = `<div class="okm">Bloqueado: ${qs.length > 1 ? 'todas as quadras' : 'quadra ' + qs[0]}, ${a}h às ${b}h.</div>`; }
      catch (err) { $('#bm').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
    };
  }

  function configPane() {
    const pane = $('#pane');
    const row = d => { const f = cfg.horarios[d]; return `<div class="hrow"><b>${DIAS[d]}</b>
      <label class="f" style="margin:0"><span class="sr">Abre</span><input type="number" min="0" max="23" data-d="${d}" data-k="0" value="${f ? f[0] : 16}" ${f ? '' : 'disabled'}></label>
      <label class="f" style="margin:0"><span class="sr">Fecha</span><input type="number" min="1" max="24" data-d="${d}" data-k="1" value="${f ? f[1] : 22}" ${f ? '' : 'disabled'}></label>
      <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" data-c="${d}" ${f ? '' : 'checked'}> Fechado</label></div>`; };
    pane.innerHTML = `<div class="card"><form id="cf">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        <div class="f"><label for="cp">Preço por hora (R$)</label><input id="cp" type="number" min="0" step="5" value="${cfg.precoHora}"></div>
        <div class="f"><label for="cq">Quadras</label><input id="cq" type="number" min="1" max="20" value="${cfg.quadras}"></div>
        <div class="f"><label for="ca">Dias de antecedência</label><input id="ca" type="number" min="1" max="60" value="${cfg.diasAntecedencia}"></div>
      </div>
      <p class="cap" style="margin:24px 0 10px">Horário de cada dia (abre · fecha)</p>
      <div class="hours">${[1, 2, 3, 4, 5, 6, 0].map(row).join('')}</div>
      <button class="btn btn-ink" style="margin-top:20px" type="submit">Salvar<span class="dot"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span></button>
      <div id="cm"></div></form></div>`;
    pane.querySelectorAll('[data-c]').forEach(c => c.onchange = () => pane.querySelectorAll(`[data-d="${c.dataset.c}"]`).forEach(i => i.disabled = c.checked));
    $('#cf').onsubmit = async e => {
      e.preventDefault();
      const h = {};
      for (let d = 0; d < 7; d++) {
        const closed = pane.querySelector(`[data-c="${d}"]`).checked;
        const a = +pane.querySelector(`[data-d="${d}"][data-k="0"]`).value, b = +pane.querySelector(`[data-d="${d}"][data-k="1"]`).value;
        if (!closed && !(b > a)) { $('#cm').innerHTML = `<div class="err">${DIAS[d]}: o fechamento precisa ser depois da abertura.</div>`; return; }
        h[d] = closed ? null : [a, b];
      }
      const novo = { precoHora: +$('#cp').value, quadras: +$('#cq').value, diasAntecedencia: +$('#ca').value, horarios: h };
      try { await B.salvarConfig(novo); cfg = await B.config(); $('#cm').innerHTML = '<div class="okm">Salvo. O site já usa os novos valores.</div>'; }
      catch (err) { $('#cm').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
    };
  }

  start();
})();
