const express = require('express');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

function loadDB(SQL) {
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    return new SQL.Database(buf);
  }
  return new SQL.Database();
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'rosane-matos-studio-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

async function initDB() {
  const SQL = await initSqlJs();
  db = loadDB(SQL);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nome TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      hora TEXT NOT NULL,
      nome_cliente TEXT NOT NULL,
      telefone TEXT NOT NULL,
      servico TEXT NOT NULL,
      valor REAL DEFAULT 0,
      observacoes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','confirmado','cancelado')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS bloqueados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      hora TEXT NOT NULL,
      motivo TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { db.run('CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_bloqueados_data ON bloqueados(data)'); } catch {}

  const admin = get('SELECT id FROM usuarios WHERE username = ?', ['Rosane']);
  if (!admin) {
    const hash = bcrypt.hashSync('Judite157751', 10);
    run('INSERT INTO usuarios (username, password, nome) VALUES (?, ?, ?)', ['Rosane', hash, 'Rosane Matos']);
    console.log('✓ Admin user "Rosane" criado');
  }

  const count = get('SELECT COUNT(*) as c FROM agendamentos');
  if (count.c === 0) {
    const hoje = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    const seed = [
      { data: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1)), hora: '09:00', nome_cliente: 'Ana Paula', telefone: '(21) 98765-4321', servico: 'Escova + Prancha — R$ 35', valor: 35, observacoes: '', status: 'confirmado' },
      { data: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1)), hora: '11:00', nome_cliente: 'Fernanda Lima', telefone: '(21) 97654-3210', servico: 'Progressiva — a partir de R$ 110', valor: 110, observacoes: 'cabelo longo', status: 'confirmado' },
      { data: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 2)), hora: '14:00', nome_cliente: 'Camila Santos', telefone: '(21) 96543-2109', servico: 'Botox Capilar — a partir de R$ 80', valor: 80, observacoes: '', status: 'pendente' },
      { data: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 3)), hora: '10:00', nome_cliente: 'Juliana Mendes', telefone: '(21) 95432-1098', servico: 'Hidratação + Finalização — R$ 40', valor: 40, observacoes: '', status: 'confirmado' },
      { data: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 5)), hora: '15:00', nome_cliente: 'Patricia Oliveira', telefone: '(21) 94321-0987', servico: 'Reconstrução + Finalização — R$ 55', valor: 55, observacoes: 'cabelo danificado', status: 'confirmado' },
      { data: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 7)), hora: '09:00', nome_cliente: 'Marcia Costa', telefone: '(21) 93210-9876', servico: 'Cronograma Capilar (3 sessões) — a partir de R$ 170', valor: 170, observacoes: '', status: 'confirmado' },
      { data: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 10)), hora: '16:00', nome_cliente: 'Renata Silva', telefone: '(21) 92109-8765', servico: 'Coloração — R$ 20', valor: 20, observacoes: '', status: 'confirmado' },
      { data: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 12)), hora: '10:00', nome_cliente: 'Luciana Ferreira', telefone: '(21) 91098-7654', servico: 'Escova + Prancha — R$ 35', valor: 35, observacoes: '', status: 'confirmado' }
    ];
    for (const s of seed) {
      run('INSERT INTO agendamentos (data, hora, nome_cliente, telefone, servico, valor, observacoes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [s.data, s.hora, s.nome_cliente, s.telefone, s.servico, s.valor, s.observacoes, s.status]);
    }
    console.log('✓ Dados de exemplo inseridos');
  }

  saveDB();
}

/* ── MIDDLEWARE ── */
function isAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Não autenticado' });
}

function asyncWrap(fn) {
  return (req, res, next) => { try { fn(req, res, next); } catch (e) { next(e); } };
}

/* ── AUTH ── */
app.post('/api/login', asyncWrap((req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  const user = get('SELECT * FROM usuarios WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ success: true, user: { nome: user.nome, username: user.username } });
}));

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.userId) {
    const user = get('SELECT id, username, nome FROM usuarios WHERE id = ?', [req.session.userId]);
    return res.json({ authenticated: true, user });
  }
  res.json({ authenticated: false });
});

/* ── HORÁRIOS ── */
const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

app.get('/api/horarios', asyncWrap((req, res) => {
  const { data } = req.query;
  if (!data) return res.json({ horarios: HORARIOS.map(h => ({ hora: h, status: 'disponivel' })) });

  const ocupados = all("SELECT hora FROM agendamentos WHERE data = ? AND status != 'cancelado'", [data]).map(r => r.hora);
  const bloqueados = all('SELECT hora, motivo FROM bloqueados WHERE data = ?', [data]);

  const horarios = HORARIOS.map(h => {
    if (ocupados.includes(h)) return { hora: h, status: 'ocupado', motivo: 'Agendamento confirmado' };
    const blq = bloqueados.find(b => b.hora === h);
    if (blq) return { hora: h, status: 'bloqueado', motivo: blq.motivo || 'Horário bloqueado' };
    return { hora: h, status: 'disponivel' };
  });

  res.json({ horarios });
}));

/* ── AGENDAMENTOS (público) ── */
app.post('/api/agendamentos', asyncWrap((req, res) => {
  const { data, hora, nome, telefone, servico, observacoes } = req.body;

  if (!data || !hora || !nome || !telefone || !servico) {
    return res.status(400).json({ error: 'Campos obrigatórios: data, hora, nome, telefone, servico' });
  }

  if (!HORARIOS.includes(hora)) return res.status(400).json({ error: 'Horário inválido' });

  const conflito = get("SELECT id FROM agendamentos WHERE data = ? AND hora = ? AND status != 'cancelado'", [data, hora]);
  if (conflito) return res.status(409).json({ error: 'Horário indisponível' });

  const bloqueado = get('SELECT id FROM bloqueados WHERE data = ? AND hora = ?', [data, hora]);
  if (bloqueado) return res.status(409).json({ error: 'Horário bloqueado' });

  const match = servico.match(/R\$\s*(\d+)/);
  const valor = match ? parseInt(match[1]) : 0;

  run('INSERT INTO agendamentos (data, hora, nome_cliente, telefone, servico, valor, observacoes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [data, hora, nome, telefone, servico, valor, observacoes || '', 'pendente']);

  res.status(201).json({ success: true });
}));

/* ── AGENDAMENTOS (admin) ── */
app.get('/api/agendamentos', isAuth, asyncWrap((req, res) => {
  const agendamentos = all('SELECT * FROM agendamentos ORDER BY data DESC, hora DESC');
  res.json(agendamentos);
}));

app.put('/api/agendamentos/:id/confirmar', isAuth, asyncWrap((req, res) => {
  const existing = get('SELECT id FROM agendamentos WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
  run("UPDATE agendamentos SET status = 'confirmado' WHERE id = ?", [req.params.id]);
  res.json({ success: true });
}));

app.put('/api/agendamentos/:id/cancelar', isAuth, asyncWrap((req, res) => {
  const existing = get('SELECT id FROM agendamentos WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
  run("UPDATE agendamentos SET status = 'cancelado' WHERE id = ?", [req.params.id]);
  res.json({ success: true });
}));

/* ── BLOQUEADOS ── */
app.get('/api/bloqueados', isAuth, asyncWrap((req, res) => {
  const b = all('SELECT * FROM bloqueados ORDER BY data DESC, hora DESC');
  res.json(b);
}));

app.post('/api/bloqueados', isAuth, asyncWrap((req, res) => {
  const { data, hora, motivo } = req.body;
  if (!data || !hora) return res.status(400).json({ error: 'Data e hora obrigatórios' });

  const conflito = get("SELECT id, nome_cliente FROM agendamentos WHERE data = ? AND hora = ? AND status != 'cancelado'", [data, hora]);
  if (conflito) return res.status(409).json({ error: `Já existe agendamento: ${conflito.nome_cliente}` });

  const existente = get('SELECT id FROM bloqueados WHERE data = ? AND hora = ?', [data, hora]);
  if (existente) return res.status(409).json({ error: 'Horário já bloqueado' });

  run('INSERT INTO bloqueados (data, hora, motivo) VALUES (?, ?, ?)', [data, hora, motivo || 'Bloqueado']);
  res.status(201).json({ success: true });
}));

app.delete('/api/bloqueados/:id', isAuth, asyncWrap((req, res) => {
  const existing = get('SELECT id FROM bloqueados WHERE id = ?', [parseInt(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'Bloqueio não encontrado' });
  run('DELETE FROM bloqueados WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ success: true });
}));

/* ── DASHBOARD ── */
app.get('/api/dashboard', isAuth, asyncWrap((req, res) => {
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;
  const todayStr = hoje.toISOString().split('T')[0];

  const doMes = all("SELECT * FROM agendamentos WHERE data LIKE ? AND status = 'confirmado'", [mesStr + '%']);
  const faturamento = doMes.reduce((s, a) => s + a.valor, 0);
  const ticketMedio = doMes.length > 0 ? faturamento / doMes.length : 0;
  const pendentes = get("SELECT COUNT(*) as c FROM agendamentos WHERE status = 'pendente'").c;

  const servicos = {};
  doMes.forEach(a => {
    const k = a.servico.split('—')[0].trim();
    servicos[k] = (servicos[k] || 0) + 1;
  });
  const servicoTop = Object.entries(servicos).sort((a, b) => b[1] - a[1])[0];

  const todosServicos = all("SELECT servico, COUNT(*) as qtd FROM agendamentos WHERE status = 'confirmado' GROUP BY servico ORDER BY qtd DESC");
  const maxServ = todosServicos.length > 0 ? todosServicos[0].qtd : 1;
  const servicosChart = todosServicos.map(s => ({
    nome: s.servico.split('—')[0].trim(),
    qtd: s.qtd,
    pct: (s.qtd / maxServ * 100).toFixed(0)
  }));

  const proximos = all("SELECT * FROM agendamentos WHERE data >= ? AND status != 'cancelado' ORDER BY data ASC, hora ASC LIMIT 10", [todayStr]);

  res.json({
    faturamento: faturamento.toFixed(2),
    agendamentos: doMes.length,
    ticketMedio: ticketMedio.toFixed(2),
    pendentes,
    servicoTop: servicoTop ? servicoTop[0] : '—',
    servicosChart,
    proximos
  });
}));

/* ── RELATÓRIO ── */
app.get('/api/relatorio', isAuth, asyncWrap((req, res) => {
  const servicos = all("SELECT servico, COUNT(*) as qtd, SUM(valor) as fat FROM agendamentos WHERE status = 'confirmado' GROUP BY servico ORDER BY fat DESC");
  const totalFat = servicos.reduce((s, r) => s + r.fat, 0) || 1;
  const servicosRel = servicos.map(s => ({
    nome: s.servico.split('—')[0].trim(),
    qtd: s.qtd,
    fat: s.fat,
    pct: ((s.fat / totalFat) * 100).toFixed(1)
  }));

  const semanas = all("SELECT data, SUM(valor) as total FROM agendamentos WHERE status = 'confirmado' GROUP BY strftime('%Y-%W', data) ORDER BY data DESC LIMIT 8").reverse();
  const maxSem = semanas.reduce((m, s) => Math.max(m, s.total), 1);
  const semanasChart = semanas.map(s => {
    const d = new Date(s.data + 'T12:00');
    const inicioAno = new Date(d.getFullYear(), 0, 1);
    const diff = Math.ceil((d - inicioAno) / 86400000);
    const numSem = Math.ceil((diff + inicioAno.getDay() + 1) / 7);
    return { label: `Sem ${numSem} (${d.getFullYear()})`, total: s.total, pct: (s.total / maxSem * 100).toFixed(0) };
  });

  res.json({ servicos: servicosRel, semanas: semanasChart });
}));

app.get('/api/agenda/:data', isAuth, asyncWrap((req, res) => {
  const { data } = req.params;
  const ags = all("SELECT * FROM agendamentos WHERE data = ? AND status != 'cancelado' ORDER BY hora", [data]);
  const blqs = all('SELECT * FROM bloqueados WHERE data = ? ORDER BY hora', [data]);
  res.json({ agendamentos: ags, bloqueados: blqs });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ✦ Estúdio Rosane Matos ✦`);
    console.log(`  Servidor rodando em: http://localhost:${PORT}\n`);
  });
});
