/* Camada de dados das reservas.
   Modo "live": Supabase (configurar em config.js). Modo "demo": tudo no navegador. */
(function () {
  const C = window.TASCA;
  const LIVE = !!(C.supabaseUrl && C.supabaseAnonKey);
  const KEY = 'tasca-demo-reservas-v1';
  const KEY_CFG = 'tasca-demo-config-v1';
  let sb = null, cfgCache = null;

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36));

  async function client() {
    if (sb) return sb;
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = mod.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true } });
    return sb;
  }

  // ---------- modo demonstração ----------
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  };
  // ocupação de exemplo, sempre igual para o mesmo dia (para o site não parecer vazio na demonstração)
  function seeded(dateStr, q, h) {
    let x = 2166136261; const s = dateStr + ':' + q + ':' + h;
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
    x ^= x >>> 15; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489909) >>> 0; x ^= x >>> 16;
    const r = (x >>> 0) / 4294967296;
    const dow = parse(dateStr).getDay();
    let p = 0.18;
    if (h >= 18) p += 0.22;
    if (dow === 6) p += 0.12;
    if (dow === 5) p += 0.08;
    return r < p;
  }
  function demoRows(dateStr) {
    const cfg = demoCfg();
    const rows = store.get().filter(r => r.data === dateStr);
    const taken = new Set(rows.filter(r => r.status !== 'cancelada').map(r => r.quadra + '-' + r.hora));
    const salvos = new Set(rows.map(r => r.id)); // exemplos que o painel já alterou ficam no store
    const faixa = cfg.horarios[parse(dateStr).getDay()];
    if (faixa) for (let q = 1; q <= cfg.quadras; q++) for (let h = faixa[0]; h < faixa[1]; h++) {
      const ex = exemplo(dateStr, q, h);
      if (!taken.has(q + '-' + h) && !salvos.has(ex.id) && seeded(dateStr, q, h)) rows.push(ex);
    }
    return rows;
  }
  const exemplo = (dateStr, q, h) => ({ id: `ex-${dateStr}-${q}-${h}`, quadra: q, data: dateStr, hora: h, esporte: 'volei', nome: 'Reserva de exemplo', telefone: '', status: 'confirmada', exemplo: true });
  function demoCfg() {
    let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY_CFG) || 'null'); } catch (e) {}
    return Object.assign({ precoHora: C.precoHora, quadras: C.quadras, horarios: C.horarios, diasAntecedencia: C.diasAntecedencia }, saved || {});
  }

  function validar(cfg, p) {
    const tel = String(p.telefone || '').replace(/\D/g, '');
    if (!p.horas || !p.horas.length) throw new Error('Escolha pelo menos um horário.');
    if (p.horas.length > 4) throw new Error('Escolha até 4 horários.');
    if (String(p.nome || '').trim().length < 2) throw new Error('Informe seu nome.');
    if (tel.length < 10 || tel.length > 13) throw new Error('Informe um WhatsApp com DDD.');
    const faixa = cfg.horarios[parse(p.data).getDay()];
    if (!faixa) throw new Error('O clube não abre neste dia.');
    for (const h of p.horas) if (h < faixa[0] || h >= faixa[1]) throw new Error('Horário fora do funcionamento.');
    return tel;
  }

  const api = {
    LIVE, iso, parse, pad,

    async config() {
      if (cfgCache) return cfgCache;
      if (!LIVE) return (cfgCache = demoCfg());
      try {
        const s = await client();
        const { data, error } = await s.from('config').select('*').eq('id', 1).single();
        if (error) throw error;
        const h = {}; for (let d = 0; d < 7; d++) h[d] = data.horarios[d] ?? data.horarios[String(d)] ?? null;
        cfgCache = { precoHora: +data.preco_hora, quadras: data.quadras, horarios: h, diasAntecedencia: data.dias_antecedencia };
      } catch (e) { console.warn('config padrão', e); cfgCache = demoCfg(); }
      return cfgCache;
    },

    // Set com "quadra-hora" ocupados no dia
    async ocupados(dateStr) {
      if (!LIVE) return new Set(demoRows(dateStr).filter(r => r.status !== 'cancelada').map(r => r.quadra + '-' + r.hora));
      const s = await client();
      const { data, error } = await s.rpc('horarios_ocupados', { d: dateStr });
      if (error) throw error;
      return new Set((data || []).map(r => r.quadra + '-' + r.hora));
    },

    async reservar(p) {
      const cfg = await api.config();
      const tel = validar(cfg, p);
      if (!LIVE) {
        const busy = await api.ocupados(p.data);
        if (p.horas.some(h => busy.has(p.quadra + '-' + h))) throw new Error('Alguém acabou de reservar esse horário. Escolha outro.');
        const g = uid(), all = store.get();
        p.horas.forEach(h => all.push({ id: uid(), grupo: g, quadra: p.quadra, data: p.data, hora: h, esporte: p.esporte, nome: p.nome.trim(), telefone: tel, status: 'pendente', criado_em: new Date().toISOString() }));
        store.set(all);
        return g;
      }
      const s = await client();
      const { data, error } = await s.rpc('reservar', { p_quadra: p.quadra, p_data: p.data, p_horas: p.horas, p_esporte: p.esporte, p_nome: p.nome, p_telefone: tel });
      if (error) throw new Error(error.message || 'Não deu para reservar agora. Tente de novo.');
      return data;
    },

    // ---------- área do clube ----------
    async session() {
      if (!LIVE) { try { return sessionStorage.getItem('tasca-demo-admin') ? { demo: true } : null; } catch (e) { return null; } }
      const s = await client(); const { data } = await s.auth.getSession(); return data.session;
    },
    async login(email, senha) {
      if (!LIVE) {
        if (senha !== 'demo') throw new Error('No modo demonstração a senha é: demo');
        try { sessionStorage.setItem('tasca-demo-admin', '1'); } catch (e) {}
        return { demo: true };
      }
      const s = await client();
      const { data, error } = await s.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error('E-mail ou senha incorretos.');
      return data.session;
    },
    async logout() {
      if (!LIVE) { try { sessionStorage.removeItem('tasca-demo-admin'); } catch (e) {} return; }
      const s = await client(); await s.auth.signOut();
    },
    async listar(de, ate) {
      if (!LIVE) {
        const out = []; const d0 = parse(de), d1 = parse(ate);
        for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) out.push(...demoRows(iso(d)));
        return out.sort((a, b) => (a.data + pad(a.hora) + a.quadra).localeCompare(b.data + pad(b.hora) + b.quadra));
      }
      const s = await client();
      const { data, error } = await s.from('reservas').select('*').gte('data', de).lte('data', ate).order('data').order('hora').order('quadra');
      if (error) throw error;
      return data;
    },
    async status(ids, status) {
      if (!LIVE) {
        const all = store.get();
        ids.filter(id => id.startsWith('ex-') && !all.some(r => r.id === id)).forEach(id => {
          const m = id.match(/^ex-(\d{4}-\d{2}-\d{2})-(\d+)-(\d+)$/);
          if (m) all.push(exemplo(m[1], +m[2], +m[3]));
        });
        all.forEach(r => { if (ids.includes(r.id)) r.status = status; }); store.set(all); return;
      }
      const s = await client();
      const { error } = await s.from('reservas').update({ status }).in('id', ids);
      if (error) throw error;
    },
    async bloquear(quadra, data, horas, obs) {
      if (!LIVE) {
        const all = store.get(); const g = uid();
        horas.forEach(h => all.push({ id: uid(), grupo: g, quadra, data, hora: h, esporte: 'bloqueio', nome: obs || 'Bloqueio do clube', telefone: '', status: 'bloqueio' }));
        store.set(all); return;
      }
      const s = await client(); const g = uid();
      const { error } = await s.from('reservas').insert(horas.map(h => ({ quadra, data, hora: h, esporte: 'bloqueio', nome: obs || 'Bloqueio do clube', status: 'bloqueio', grupo: g })));
      if (error) throw new Error(error.code === '23505' ? 'Já existe reserva em um desses horários.' : error.message);
    },
    async salvarConfig(cfg) {
      cfgCache = null;
      if (!LIVE) { try { localStorage.setItem(KEY_CFG, JSON.stringify(cfg)); } catch (e) {} return; }
      const s = await client();
      const { error } = await s.from('config').update({ preco_hora: cfg.precoHora, quadras: cfg.quadras, horarios: cfg.horarios, dias_antecedencia: cfg.diasAntecedencia, atualizado_em: new Date().toISOString() }).eq('id', 1);
      if (error) throw error;
    }
  };
  window.TascaBooking = api;
})();
