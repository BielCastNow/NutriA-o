/* ==================== CONFIGURAÇÃO (edite aqui) ==================== */
const BLOG = "NutriAção";
const SUPABASE_URL = "https://wvycyzhqkqgccxheiwrg.supabase.co/rest/v1/"; // Supabase > Project Settings > API > Project URL
const SUPABASE_KEY = "sb_publishable_a_Wtz2BOfmJ1Kg_uixNchw_wIOz51E9"; // mesma tela: chave "anon" "public"
const CATEGORIAS = [
    { id: "noticias", nome: "Notícias" },
    { id: "dicas", nome: "Dicas" },
    { id: "alimentacao", nome: "Alimentação" },
    { id: "treino", nome: "Treino" }
];
const POR_PAGINA = 8; // quantos artigos aparecem a cada "Carregar mais"
/* ==================================================================== */

const $ = id => document.getElementById(id);
const app = $("app"),
    menu = $("menu"),
    busca = $("busca");
const configurado = !SUPABASE_URL.includes("SEU-PROJETO");
const db = configurado ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const nomeCat = id => (CATEGORIAS.find(c => c.id === id) || {}).nome || "";
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtData = d => new Date(d).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const minutos = t => Math.max(1, Math.round(t.split(/\s+/).length / 200));

/* Texto do artigo: parágrafos separados por linha em branco; "## " = título; "- " = lista;
   [texto](https://link) = link; **negrito**. HTML digitado é mostrado como texto (mais seguro). */
function inline(s) {
    return s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function formatar(txt) {
    return txt.replace(/\r/g, "").split(/\n{2,}/).map(b => {
        const t = esc(b.trim());
        if (!t) return "";
        if (t.startsWith("## ")) return `<h2>${inline(t.slice(3))}</h2>`;
        const ls = t.split("\n");
        if (ls.every(l => l.startsWith("- "))) return "<ul>" + ls.map(l => `<li>${inline(l.slice(2))}</li>`).join("") + "</ul>";
        return `<p>${inline(ls.join("<br>"))}</p>`;
    }).join("");
}

function montarMenu(ativa) {
    menu.innerHTML = `<a href="#/" ${ativa === "home" ? 'aria-current="page"' : ""}>Tudo</a>` +
        CATEGORIAS.map(c => `<a href="#/c/${c.id}" ${ativa === c.id ? 'aria-current="page"' : ""}>${c.nome}</a>`).join("") +
        `<a href="#/sobre" ${ativa === "sobre" ? 'aria-current="page"' : ""}>Sobre</a>`;
}

function avisoConfig() {
    return `<h1>Falta conectar o banco de dados</h1>
  <div class="aviso"><p>Para o blog mostrar e salvar artigos, conecte o Supabase:</p>
  <ol><li>Crie um projeto grátis em supabase.com.</li>
  <li>No <strong>SQL Editor</strong>, rode o arquivo <code>supabase.sql</code>.</li>
  <li>Em <strong>Project Settings &gt; API</strong>, copie a URL e a chave <em>anon public</em> e cole no começo do script, em <code>SUPABASE_URL</code> e <code>SUPABASE_KEY</code>.</li>
  <li>Em <strong>Authentication</strong>, crie o usuário administrador e desative novos cadastros.</li></ol></div>`;
}

/* ---------- Lista de artigos (página inicial e categorias) ---------- */
const cartao = p => `<a class="item" href="#/p/${p.id}">
  <div class="meta"><span class="tag">${esc(nomeCat(p.categoria))}</span> · ${fmtData(p.criado_em)}</div>
  <h2>${esc(p.titulo)}</h2><p>${esc(p.resumo)}</p></a>`;

async function buscar(cat, q, pagina) {
    let r = db.from("posts").select("id,titulo,resumo,categoria,criado_em").eq("publicado", true)
        .order("criado_em", { ascending: false }).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    if (cat) r = r.eq("categoria", cat);
    if (q) {
        const s = q.replace(/[,()%*\\]/g, " ");
        r = r.or(`titulo.ilike.%${s}%,resumo.ilike.%${s}%`);
    }
    const { data, error } = await r;
    if (error) throw error;
    return data;
}

function telaLista(cat) {
    const q = busca.value.trim();
    const titulo = cat ? nomeCat(cat) : (q ? "Resultados da busca" : "Últimos artigos");
    app.innerHTML = `<h1>${esc(titulo)}</h1><p class="lead">Notícias, dicas e ajuda sobre treino e nutrição.</p>
    <div id="feed"></div><div id="rodape-feed"></div>${caixaEmail()}`;
    const feed = $("feed"),
        rod = $("rodape-feed");
    let pag = 0;
    async function mais() {
        rod.innerHTML = '<p class="empty">Carregando…</p>';
        try {
            const d = await buscar(cat, q, pag++);
            feed.insertAdjacentHTML("beforeend", d.map(cartao).join(""));
            if (pag === 1 && !d.length) { rod.innerHTML = '<p class="empty">Nenhum artigo encontrado.</p>'; return; }
            rod.innerHTML = d.length === POR_PAGINA ? '<button class="mais" id="mais">Carregar mais</button>' : "";
            if (d.length === POR_PAGINA) $("mais").onclick = mais; // carrega mais artigos sem sair da página
        } catch (e) { rod.innerHTML = '<p class="empty erro">Não foi possível carregar os artigos. Tente de novo.</p>'; }
    }
    mais();
}

/* ---------- Artigo ---------- */
async function telaPost(id) {
    app.innerHTML = '<p class="empty">Carregando…</p>';
    const { data: p } = await db.from("posts").select("*").eq("id", id).maybeSingle();
    if (!p) { app.innerHTML = '<h1>Artigo não encontrado</h1><p class="lead"><a href="#/">Voltar ao início</a></p>'; return; }
    document.title = p.titulo + " – " + BLOG;
    montarMenu(p.categoria);
    app.innerHTML = `<a class="back" href="#/c/${esc(p.categoria)}">← ${esc(nomeCat(p.categoria))}</a>
    <article><h1>${esc(p.titulo)}</h1>
    <p class="meta"><span class="tag">${esc(nomeCat(p.categoria))}</span> · ${fmtData(p.criado_em)} · ${minutos(p.texto)} min de leitura${p.publicado ? "" : " · <strong>Rascunho</strong>"}</p>
    <div class="post">${formatar(p.texto)}</div></article>${caixaEmail()}`;
    ligarEmail();
}

function caixaEmail() {
    return `<div class="box"><h3>Receba as novidades</h3><p>Deixe seu e-mail para receber os próximos artigos.</p>
    <form id="form-email"><input class="campo" type="email" required placeholder="seu@email.com" aria-label="E-mail" autocomplete="email">
    <button class="btn" type="submit">Inscrever</button></form><p id="msg-email" role="status" style="margin:.75rem 0 0"></p></div>`;
}

function ligarEmail() {
    const f = $("form-email");
    if (!f) return;
    // TODO: ainda não envia a lugar nenhum. Conecte a um serviço (Brevo, MailerLite, Formspree etc.)
    f.addEventListener("submit", e => {
        e.preventDefault();
        $("msg-email").textContent = "Obrigado! Você receberá as novidades por e-mail.";
        f.reset();
    });
}

/* ---------- Administrador ---------- */
async function telaAdmin() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        app.innerHTML = `<div class="admin"><h1>Área do administrador</h1>
      <form id="login"><label for="le">E-mail</label><input class="campo" id="le" type="email" required autocomplete="username">
      <label for="ls">Senha</label><input class="campo" id="ls" type="password" required autocomplete="current-password">
      <div class="barra"><button class="btn" type="submit">Entrar</button></div><p id="lm" role="status" class="erro"></p></form></div>`;
        $("login").onsubmit = async e => {
            e.preventDefault();
            const { error } = await db.auth.signInWithPassword({ email: $("le").value, password: $("ls").value });
            if (error) $("lm").textContent = "E-mail ou senha incorretos.";
            else telaAdmin();
        };
        return;
    }
    app.innerHTML = `<div class="admin">
    <div class="linha" style="border:0;padding-top:0"><h1 style="margin:0">Painel</h1><button class="btn sec" id="sair">Sair</button></div>
    <h2 id="ftitulo" style="font-size:1.3rem;margin:1rem 0 0">Novo artigo</h2>
    <form id="form"><input type="hidden" id="fid">
      <label for="ft">Título</label><input class="campo" id="ft" required maxlength="160">
      <label for="fc">Categoria</label><select class="campo" id="fc">${CATEGORIAS.map(c => `<option value="${c.id}">${c.nome}</option>`).join("")}</select>
      <label for="fr">Resumo (aparece na lista)</label><input class="campo" id="fr" maxlength="240">
      <label for="fx">Texto</label><textarea class="campo" id="fx" required></textarea>
      <p class="dica">Separe parágrafos com uma linha em branco. Use <code>## Título</code> para subtítulos, <code>- item</code> para listas, <code>[texto](https://link)</code> para links e <code>**negrito**</code>.</p>
      <label class="ck"><input type="checkbox" id="fp" checked> Publicar agora (desmarque para salvar como rascunho)</label>
      <div class="barra"><button class="btn" type="submit">Salvar</button><button class="btn sec" type="button" id="cancelar" hidden>Cancelar edição</button></div>
      <p id="fm" role="status"></p></form>
    <h2 style="font-size:1.3rem;margin:2.5rem 0 0">Seus artigos</h2><div id="lista"><p class="empty">Carregando…</p></div></div>`;

  const msg = (t, cls) => { $("fm").textContent = t; $("fm").className = cls || ""; };
  const limpar = () => { $("form").reset(); $("fid").value = ""; $("ftitulo").textContent = "Novo artigo"; $("cancelar").hidden = true; $("fp").checked = true; };

  async function carregarLista() {
    const { data, error } = await db.from("posts").select("id,titulo,categoria,publicado,criado_em").order("criado_em", { ascending: false }).limit(100);
    if (error) { $("lista").innerHTML = '<p class="empty erro">Não foi possível carregar a lista.</p>'; return; }
    $("lista").innerHTML = data.length ? data.map(p => `<div class="linha"><div><a href="#/p/${p.id}">${esc(p.titulo)}</a>
      <div class="meta">${esc(nomeCat(p.categoria))} · ${fmtData(p.criado_em)}${p.publicado ? "" : " · Rascunho"}</div></div>
      <div class="acoes"><button class="btn sec" data-ed="${p.id}">Editar</button><button class="btn perigo" data-ex="${p.id}">Excluir</button></div></div>`).join("")
      : '<p class="empty">Você ainda não criou nenhum artigo.</p>';
  }

  $("sair").onclick = async () => { await db.auth.signOut(); telaAdmin(); };
  $("cancelar").onclick = () => { limpar(); msg(""); };
  $("form").onsubmit = async e => {
    e.preventDefault();
    const reg = { titulo: $("ft").value.trim(), categoria: $("fc").value, resumo: $("fr").value.trim(), texto: $("fx").value, publicado: $("fp").checked };
    const id = $("fid").value;
    const { error } = id ? await db.from("posts").update(reg).eq("id", id) : await db.from("posts").insert(reg);
    if (error) { msg("Não foi possível salvar: " + error.message, "erro"); return; }
    limpar(); msg("Artigo salvo.", "ok"); carregarLista();
  };
  $("lista").onclick = async e => {
    const ed = e.target.dataset.ed, ex = e.target.dataset.ex;
    if (ed) {
      const { data: p } = await db.from("posts").select("*").eq("id", ed).maybeSingle();
      if (!p) return;
      $("fid").value = p.id; $("ft").value = p.titulo; $("fc").value = p.categoria; $("fr").value = p.resumo;
      $("fx").value = p.texto; $("fp").checked = p.publicado;
      $("ftitulo").textContent = "Editando artigo"; $("cancelar").hidden = false; msg("");
      $("form").scrollIntoView({ behavior: "smooth" });
    }
    if (ex && confirm("Excluir este artigo? Isso não pode ser desfeito.")) {
      const { error } = await db.from("posts").delete().eq("id", ex);
      if (error) msg("Não foi possível excluir: " + error.message, "erro"); else { msg("Artigo excluído.", "ok"); carregarLista(); }
    }
  };
  carregarLista();
}

/* ---------- Rotas ---------- */
function render() {
  const rota = location.hash.replace(/^#/, "") || "/";
  let ativa = "home", titulo = BLOG;
  if (rota === "/sobre") {
    ativa = "sobre"; titulo = "Sobre – " + BLOG;
    app.innerHTML = `<h1>Sobre</h1><div class="post">
      <p>Oi, eu sou [seu nome]. Este blog traz notícias, dicas e ajuda sobre treino e nutrição.</p>
      <p>[Conte quem você é, sua experiência e o que o leitor vai encontrar aqui. Se não for profissional de saúde, diga isso com clareza.]</p>
      <p>Contato: <a href="mailto:contato@seudominio.com.br">contato@seudominio.com.br</a></p></div>`;
  } else if (!configurado) {
    app.innerHTML = avisoConfig();
  } else if (rota === "/admin") {
    ativa = ""; titulo = "Administrador – " + BLOG; telaAdmin();
  } else if (rota.startsWith("/p/")) {
    telaPost(rota.slice(3)); return montarMenu("");
  } else if (rota.startsWith("/c/") && CATEGORIAS.some(c => c.id === rota.slice(3))) {
    ativa = rota.slice(3); titulo = nomeCat(ativa) + " – " + BLOG; telaLista(ativa);
  } else {
    telaLista(null);
  }
  document.title = titulo; montarMenu(ativa); ligarEmail();
}

let espera;
addEventListener("hashchange", () => { render(); scrollTo(0, 0); });
busca.addEventListener("input", () => {
  clearTimeout(espera);
  espera = setTimeout(() => {
    const r = location.hash.replace(/^#/, "") || "/";
    if (r === "/" || r.startsWith("/c/")) render(); else location.hash = "#/";
  }, 300);
});
render();