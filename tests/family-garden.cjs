// node tests/family-garden.cjs starts its own loopback server and disposable database.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomInt } = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const email = 'familia@example.test';
const password = 'Uma familia no jardim das somas';

async function credentials(page, submit) {
  await page.getByLabel('E-mail do adulto').fill(email);
  await page.getByLabel('Senha', { exact: false }).fill(password);
  await page.getByRole('button', { name: submit, exact: true }).click();
}

async function addChild(page, name, animal) {
  await page.getByLabel('Nome ou apelido').fill(name);
  await page.getByText(animal, { exact: true }).click();
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await page.getByRole('heading', { name: 'Quem vai brincar?' }).waitFor();
}

async function choose(page, name) {
  await page.locator('#panel button[data-child]').filter({ hasText: name }).click();
  await page.locator('#panel').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#profile-name').textContent(), name);
}

async function solve(page) {
  await page.locator('#play').click();
  await page.locator('[data-act="sound"]').click();
  for (let step = 1; step <= 2; step++) {
    await page.locator(`.scene[data-step="${step}"]`).waitFor();
    const blocks = await page.locator('[data-fig="T"] .nb-b.vazio').count();
    for (let i = 0; i < blocks; i++) await page.locator('.src').press('Enter');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  }
  await page.locator('[data-fig="A"]').press('Enter');
  const cells = page.locator('[data-fig="M"] .nb-b');
  await cells.first().waitFor();
  const total = await cells.count();
  // Even with reduced motion, merging disables taps for 40 ms after the blocks appear.
  await page.waitForTimeout(80);
  for (const cell of await cells.all()) await cell.click();
  await page.getByRole('button', { name: `Resposta ${total}`, exact: true }).click();
  await page.locator('.ans.ok').waitFor();
}

async function report(page, name, count) {
  await page.getByRole('button', { name: 'Para os pais' }).click();
  await page.getByRole('heading', { name: `Descobertas de ${name}` }).waitFor();
  assert.deepEqual(await page.locator('.stat strong').allTextContents(), [count, count]);
  const firstSkill = await page.locator('.skill-list li').first().textContent();
  assert.match(firstSkill, count === '1' ? /Praticando/ : /Próxima descoberta/);
}

async function check(browser, origin) {
  const errors = [];
  async function openGarden() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(origin + '/soma/');
    return page;
  }
  let page = await openGarden();
  await page.getByRole('button', { name: 'Para os pais' }).click();
  await page.getByRole('button', { name: 'Criar conta da família' }).click();
  await credentials(page, 'Criar minha conta');
  await addChild(page, 'Ana', 'Raposa');
  await page.getByRole('button', { name: 'Cadastrar criança' }).click();
  await addChild(page, 'Leo', 'Coelho');
  // A direct game URL in another tab must not silently play under a sibling.
  const direct = await page.context().newPage();
  await direct.goto(origin + '/numberblocks-somar/index.html?trilha=1');
  await direct.waitForURL('**/soma/#perfis');
  await direct.getByRole('button', {name:'Brincar como visitante'}).click();
  await direct.locator('#play').click();
  await direct.locator('.scene[data-step="1"]').waitFor();
  assert.equal(await direct.evaluate(() => window.SumJourney.child), null);
  await direct.close();
  await choose(page, 'Ana');
  await solve(page);
  await page.getByRole('link', { name: /Trocar criança/ }).click();
  await choose(page, 'Leo');
  await report(page, 'Leo', '0');
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
  await page.context().close();

  // A new context has no cookies, local queue, selected profile or cached progress.
  page = await openGarden();
  await page.getByRole('button', { name: 'Para os pais' }).click();
  await credentials(page, 'Entrar');
  await choose(page, 'Ana');
  await report(page, 'Ana', '1');
  let disconnected = true;
  await page.route('**/attempts', route => disconnected ? route.abort() : route.continue());
  const savedRound = await page.evaluate(async () => {
    const j = window.SumJourney;
    const round = j.problem('friends',1,3);
    await j.complete(round,{mistakes:1});
    return round.id;
  });
  disconnected = false;
  const nextRound = await page.evaluate(async () => {
    const j = window.SumJourney;
    const round = j.problem('friends',1,2);
    await j.complete(round,{mistakes:0});
    await j.refresh();
    return {id:round.id,order:j.progress.attempts.map(a => a.id)};
  });
  assert.deepEqual(nextRound.order.slice(-2),[savedRound,nextRound.id]);

  // Put Ana one independent round away from the second game, then earn the
  // invitation through the children's UI and follow it with the same profile.
  await page.evaluate(async () => {
    const journey = window.SumJourney;
    for (const [a,b] of [[1,1],[1,2],[1,3],[2,2], [1,5],[2,5],[3,5],[4,5], [5,6],[6,6],[6,7]]) {
      await journey.complete(journey.problem('friends',a,b),{});
    }
  });
  await page.reload();
  await solve(page);
  await page.getByRole('link', {name:/Descobrir as dezenas/}).click();
  await page.waitForURL('**/blocos-de-somar.html?trilha=1');
  await page.locator('#top .profile-link').waitFor();
  assert.equal(await page.locator('.profile-name').textContent(),'Ana');
  assert.equal(await page.evaluate(() => window.SumJourney.recommendedGame()),'blocks');
  assert.deepEqual(errors, []);
}

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-garden-test-'));
  const port = randomInt(20000, 45000);
  const server = spawn('python3', ['scripts/family_server.py', '--port', String(port)], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, FAMILY_DB: path.join(temporary, 'family.sqlite3') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exit = once(server, 'exit');
  let browser;
  try {
    const start = await Promise.race([once(server.stdout, 'data'), exit.then(() => { throw Error('O servidor local de teste não iniciou.'); })]);
    assert.match(String(start[0]), new RegExp(`http://localhost:${port}\\b`));
    browser = await chromium.launch();
    await check(browser, `http://127.0.0.1:${port}`);
    console.log('PASS family garden: registration, profiles, adaptive round, logout, fresh login and isolated progress');
  } finally {
    server.kill();
    await browser?.close();
    await exit;
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
