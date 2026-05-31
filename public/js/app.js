/* ── STATE ── */
const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
let horarioSel = '';
let adminData = { agendamentos: [], bloqueados: [] };

/* ── API ── */
const API = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  },
  async put(url) {
    const r = await fetch(url, { method: 'PUT' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  }
};

/* ── TOAST ── */
function toast(msg, dur = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('show'), dur);
}

/* ── HAMBURGER ── */
function toggleMenu() {
  const links = document.querySelector('.nav-links');
  const btn = document.querySelector('.hamburger');
  links.classList.toggle('open');
  btn.classList.toggle('active');
}

document.addEventListener('click', function (e) {
  const links = document.querySelector('.nav-links');
  const hamburger = document.querySelector('.hamburger');
  if (window.innerWidth <= 768 && links.classList.contains('open') && !e.target.closest('nav')) {
    links.classList.remove('open');
    hamburger.classList.remove('active');
  }
});

/* ── AGENDAMENTO ── */
function selecionarServico(nome) {
  const sel = document.getElementById('ag-servico');
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].text.startsWith(nome.split('—')[0].trim())) {
      sel.selectedIndex = i; break;
    }
  }
  document.getElementById('agendar').scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', function () {
  const dateInput = document.getElementById('ag-data');
  const today = new Date().toISOString().split('T')[0];
  dateInput.setAttribute('min', today);
});

async function atualizarHorarios() {
  const data = document.getElementById('ag-data').value;
  const grid = document.getElementById('horarios-grid');
  if (!data) {
    grid.innerHTML = '<div class="horarios-placeholder">Selecione uma data para ver os horários</div>';
    return;
  }

  const container = document.getElementById('agendamento-box');
  container.classList.add('loading');
  document.getElementById('loading-overlay').style.display = 'flex';

  try {
    const { horarios } = await API.get(`/api/horarios?data=${data}`);
    horarioSel = '';
    document.getElementById('ag-horario-display').value = '';
    grid.innerHTML = '';

    horarios.forEach(h => {
      const btn = document.createElement('button');
      btn.className = 'horario-btn';
      btn.textContent = h.hora;
      btn.type = 'button';

      if (h.status === 'ocupado') {
        btn.classList.add('ocupado');
        btn.title = 'Horário ocupado';
      } else if (h.status === 'bloqueado') {
        btn.classList.add('bloqueado');
        btn.title = h.motivo || 'Horário bloqueado';
      } else {
        btn.onclick = () => {
          document.querySelectorAll('.horario-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          horarioSel = h.hora;
          document.getElementById('ag-horario-display').value = h.hora;
        };
      }
      grid.appendChild(btn);
    });
  } catch (e) {
    toast('⚠ Erro ao carregar horários');
  } finally {
    container.classList.remove('loading');
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

async function enviarAgendamento() {
  const nome = document.getElementById('ag-nome').value.trim();
  const tel = document.getElementById('ag-tel').value.trim();
  const servico = document.getElementById('ag-servico').value;
  const data = document.getElementById('ag-data').value;
  const obs = document.getElementById('ag-obs').value.trim();

  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));

  let hasError = false;
  if (!nome) { document.getElementById('ag-nome').classList.add('field-error'); hasError = true; }
  if (!tel) { document.getElementById('ag-tel').classList.add('field-error'); hasError = true; }
  if (!servico) { document.getElementById('ag-servico').classList.add('field-error'); hasError = true; }
  if (!data) { document.getElementById('ag-data').classList.add('field-error'); hasError = true; }

  if (!horarioSel) {
    toast('⚠ Selecione um horário disponível');
    return;
  }

  if (hasError) {
    toast('⚠ Preencha todos os campos obrigatórios');
    return;
  }

  const btn = document.querySelector('.form-submit .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    await API.post('/api/agendamentos', { data, hora: horarioSel, nome, telefone: tel, servico, observacoes: obs });

    document.getElementById('form-error').style.display = 'none';
    const msg = document.getElementById('form-success');
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 6000);

    ['ag-nome', 'ag-tel', 'ag-obs', 'ag-horario-display'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('ag-servico').selectedIndex = 0;
    document.getElementById('ag-data').value = '';
    horarioSel = '';
    document.getElementById('horarios-grid').innerHTML = '<div class="horarios-placeholder">Selecione uma data para ver os horários</div>';

    toast('✓ Agendamento realizado com sucesso!');
  } catch (e) {
    document.getElementById('form-error').textContent = '⚠ ' + e.message;
    document.getElementById('form-error').style.display = 'block';
    toast('⚠ ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Agendamento →';
  }
}

/* ── LOGIN ── */
function abrirLogin() {
  document.getElementById('modal-login').classList.add('open');
  setTimeout(() => document.getElementById('login-user')?.focus(), 100);
}

function fecharLogin() {
  document.getElementById('modal-login').classList.remove('open');
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
}

async function fazerLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();

  if (!u || !p) {
    document.getElementById('login-error').textContent = 'Preencha usuário e senha.';
    document.getElementById('login-error').style.display = 'block';
    return;
  }

  const btn = document.querySelector('.modal .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    await API.post('/api/login', { username: u, password: p });
    fecharLogin();
    document.getElementById('admin-panel').classList.add('open');
    carregarAdmin();
    toast('✓ Bem-vinda, Rosane!');
  } catch (e) {
    document.getElementById('login-error').textContent = 'Usuário ou senha incorretos.';
    document.getElementById('login-error').style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar no Painel →';
  }
}

function fecharAdmin() {
  document.getElementById('admin-panel').classList.remove('open');
}

/* ── TABS ── */
function trocarTab(btn, tab) {
  document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  if (tab === 'agenda') renderAgendaDia();
}

/* ── ADMIN CARREGAR ── */
async function carregarAdmin() {
  try {
    const [agendamentos, bloqueados] = await Promise.all([
      API.get('/api/agendamentos'),
      API.get('/api/bloqueados')
    ]);
    adminData = { agendamentos, bloqueados };
    carregarDashboard();
    carregarTodos();
    carregarBloqueados();
    carregarRelatorio();
  } catch (e) {
    toast('⚠ Erro ao carregar dados do painel');
  }
}

/* ── DASHBOARD ── */
async function carregarDashboard() {
  try {
    const d = await API.get('/api/dashboard');

    document.getElementById('kpi-fat').textContent = 'R$ ' + parseFloat(d.faturamento).toFixed(2).replace('.', ',');
    document.getElementById('kpi-ags').textContent = d.agendamentos;
    document.getElementById('kpi-ticket').textContent = d.agendamentos > 0
      ? 'R$ ' + parseFloat(d.ticketMedio).toFixed(2).replace('.', ',') : '—';
    document.getElementById('kpi-pend').textContent = d.pendentes;
    document.getElementById('kpi-top').textContent = d.servicoTop;

    document.getElementById('chart-servicos').innerHTML = d.servicosChart.map(s => `
      <div class="chart-row">
        <div class="chart-label">${s.nome}</div>
        <div class="chart-track"><div class="chart-fill" style="width:${s.pct}%"></div></div>
        <div class="chart-val">${s.qtd}x</div>
      </div>
    `).join('') || '<div class="empty-state">Sem dados este mês</div>';

    document.getElementById('tbody-proximos').innerHTML = d.proximos.map(a => `
      <tr>
        <td>${fmtData(a.data)}</td><td>${a.hora}</td>
        <td><strong>${a.nome_cliente}</strong></td>
        <td>${a.servico.split('—')[0].trim()}</td>
        <td>R$ ${a.valor ? a.valor.toFixed(2).replace('.', ',') : '—'}</td>
        <td><span class="badge ${badgeCls(a.status)}">${a.status}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty-state">Nenhum agendamento próximo</td></tr>';
  } catch (e) {
    toast('⚠ Erro ao carregar dashboard');
  }
}

/* ── TODOS ── */
function carregarTodos() {
  const sorted = [...adminData.agendamentos].sort((a, b) => b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora));
  document.getElementById('tbody-todos').innerHTML = sorted.map(a => `
    <tr>
      <td>${fmtData(a.data)}</td><td>${a.hora}</td>
      <td><strong>${a.nome_cliente}</strong></td><td>${a.telefone}</td>
      <td>${a.servico.split('—')[0].trim()}</td>
      <td>${a.observacoes || '—'}</td>
      <td><span class="badge ${badgeCls(a.status)}">${a.status}</span></td>
      <td class="actions">
        ${a.status === 'pendente' ? `<button class="btn-action btn-confirmar" onclick="confirmarAg(${a.id})">✓ Confirmar</button>` : ''}
        ${a.status !== 'cancelado' ? `<button class="btn-action btn-cancelar" onclick="cancelarAg(${a.id})">✕ Cancelar</button>` : ''}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8" class="empty-state">Nenhum agendamento</td></tr>';
}

async function confirmarAg(id) {
  try {
    await API.put(`/api/agendamentos/${id}/confirmar`);
    await carregarAdmin();
    toast('✓ Agendamento confirmado!');
  } catch (e) { toast('⚠ ' + e.message); }
}

async function cancelarAg(id) {
  if (!confirm('Cancelar este agendamento?')) return;
  try {
    await API.put(`/api/agendamentos/${id}/cancelar`);
    await carregarAdmin();
    toast('Agendamento cancelado.');
  } catch (e) { toast('⚠ ' + e.message); }
}

/* ── AGENDA DO DIA ── */
function irParaHoje() {
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('agenda-data-view').value = hoje;
  renderAgendaDia();
}

async function renderAgendaDia() {
  const data = document.getElementById('agenda-data-view').value;
  const grid = document.getElementById('agenda-dia-grid');
  if (!data) { grid.innerHTML = '<div class="empty-state">Selecione uma data</div>'; return; }

  try {
    const { agendamentos, bloqueados } = await API.get(`/api/agenda/${data}`);

    grid.innerHTML = HORARIOS.map(h => {
      const ag = agendamentos.find(a => a.hora === h);
      const blq = bloqueados.find(b => b.hora === h);
      if (ag) {
        return `<div class="agenda-slot ocupado-ag">
          <div class="agenda-slot-hora">🔴 ${h}</div>
          <div class="agenda-slot-info">${ag.nome_cliente}</div>
          <div class="agenda-slot-info" style="opacity:0.55;font-size:0.7rem;">${ag.servico.split('—')[0].trim()}</div>
        </div>`;
      }
      if (blq) {
        return `<div class="agenda-slot bloqueado-slot">
          <div class="agenda-slot-hora">⚠ ${h}</div>
          <div class="agenda-slot-info">Bloqueado</div>
          <div class="agenda-slot-info" style="opacity:0.55;font-size:0.7rem;">${blq.motivo || '—'}</div>
        </div>`;
      }
      return `<div class="agenda-slot livre">
        <div class="agenda-slot-hora">🟢 ${h}</div>
        <div class="agenda-slot-info">Disponível</div>
      </div>`;
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state">Erro ao carregar agenda</div>';
  }
}

/* ── BLOQUEIOS ── */
function carregarBloqueados() {
  document.getElementById('tbody-bloqueados').innerHTML = adminData.bloqueados.map((b, i) => `
    <tr>
      <td>${fmtData(b.data)}</td><td>${b.hora}</td><td>${b.motivo || '—'}</td>
      <td><button class="btn-action btn-desbloquear" onclick="desbloquear(${b.id})">🔓 Desbloquear</button></td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="empty-state">Nenhum horário bloqueado</td></tr>';
}

async function bloquearHorario() {
  const data = document.getElementById('blq-data').value;
  const hora = document.getElementById('blq-hora').value;
  const motivo = document.getElementById('blq-motivo').value.trim();
  if (!data) { toast('⚠ Selecione uma data.'); return; }

  try {
    await API.post('/api/bloqueados', { data, hora, motivo: motivo || 'Bloqueado' });
    adminData.bloqueados = await API.get('/api/bloqueados');
    carregarBloqueados();
    document.getElementById('blq-data').value = '';
    document.getElementById('blq-motivo').value = '';
    toast('🔒 Horário bloqueado com sucesso!');
  } catch (e) { toast('⚠ ' + e.message); }
}

async function desbloquear(id) {
  try {
    await API.del(`/api/bloqueados/${id}`);
    adminData.bloqueados = await API.get('/api/bloqueados');
    carregarBloqueados();
    toast('🔓 Horário desbloqueado!');
  } catch (e) { toast('⚠ ' + e.message); }
}

/* ── RELATÓRIO ── */
async function carregarRelatorio() {
  try {
    const rel = await API.get('/api/relatorio');
    document.getElementById('tbody-relatorio').innerHTML = rel.servicos.map(s => `
      <tr>
        <td>${s.nome}</td><td>${s.qtd}</td>
        <td>R$ ${s.fat.toFixed(2).replace('.', ',')}</td>
        <td>${s.pct}%</td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="empty-state">Sem dados</td></tr>';

    document.getElementById('chart-semanas').innerHTML = rel.semanas.map(s => `
      <div class="chart-row">
        <div class="chart-label">${s.label}</div>
        <div class="chart-track"><div class="chart-fill" style="width:${s.pct}%"></div></div>
        <div class="chart-val">R$${s.total}</div>
      </div>
    `).join('');
  } catch (e) { toast('⚠ Erro ao carregar relatório'); }
}

/* ── UTILS ── */
function badgeCls(s) {
  return s === 'confirmado' ? 'badge-ok' : s === 'pendente' ? 'badge-pending' : 'badge-cancel';
}

function fmtData(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

/* ── MODAL ── */
document.getElementById('modal-login')?.addEventListener('click', function (e) {
  if (e.target === this) fecharLogin();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (document.getElementById('modal-login').classList.contains('open')) fecharLogin();
  }
});

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', function () {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('ag-data')?.setAttribute('min', today);
  document.getElementById('blq-data')?.setAttribute('min', today);
  document.getElementById('agenda-data-view')?.setAttribute('min', today);

  const agendaView = document.getElementById('agenda-data-view');
  if (agendaView) {
    agendaView.value = today;
  }
});
