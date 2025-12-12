import { spawn } from "node:child_process";

function run(cmd, args, opts = {}) {
  return spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
}

function waitOn(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timeoutMs = 60_000;

    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {}
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout esperando ${url}`));
      }
      setTimeout(tick, 500);
    };

    tick();
  });
}

let server;
let client;

function killTree(proc) {
  if (!proc || !proc.pid) return Promise.resolve();

  // Windows: mata a árvore inteira
  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
        stdio: "ignore",
        shell: true,
      });
      killer.on("exit", () => resolve());
    });
  }

  // Linux/Mac: tenta SIGTERM e depois SIGKILL
  return new Promise((resolve) => {
    try { proc.kill("SIGTERM"); } catch {}
    setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch {}
      resolve();
    }, 1200);
  });
}

let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  await Promise.all([killTree(client), killTree(server)]);
  process.exit(code);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));
process.on("uncaughtException", (e) => {
  console.error("uncaughtException:", e);
  shutdown(1);
});
process.on("unhandledRejection", (e) => {
  console.error("unhandledRejection:", e);
  shutdown(1);
});

try {
  server = run("npm", ["run", "e2e:server"]);
  await waitOn("http://localhost:3001/api/health");

  client = run("npm", ["run", "e2e:client"]);
  await waitOn("http://localhost:5173");

  const test = run("npm", ["run", "e2e:test"]);
  test.on("exit", (code) => shutdown(code ?? 1));
} catch (e) {
  console.error(e);
  shutdown(1);
}
