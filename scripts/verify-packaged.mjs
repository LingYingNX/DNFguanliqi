import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const projectRoot = resolve(import.meta.dirname, "..");
const artifacts = (await readdir(join(projectRoot, "dist"))).filter((name) =>
  name.endsWith("-portable.exe"),
);
if (artifacts.length !== 1) throw new Error(`Expected one portable EXE, found ${artifacts.length}`);
const artifactName = artifacts[0];
if (artifactName === undefined) throw new Error("Portable artifact name is unavailable");
const artifactPath = join(projectRoot, "dist", artifactName);
const sandbox = await mkdtemp(join(tmpdir(), "dnf-portable-runtime-"));
const executable = join(sandbox, basename(artifactPath));
const appData = join(sandbox, "AppData", "Roaming");
const localAppData = join(sandbox, "AppData", "Local");
const libraryRoot = join(sandbox, "patch-categories");

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Port allocation failed");
  await new Promise((resolveClose) => server.close(resolveClose));
  return address.port;
}

async function waitForEndpoint(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Packaged Chromium endpoint did not become ready");
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function waitForAppPage(context) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const candidate of context.pages()) {
      if (
        await candidate
          .locator(".app-shell")
          .isVisible()
          .catch(() => false)
      )
        return candidate;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  const pages = await Promise.all(
    context.pages().map(async (page) => ({ title: await page.title(), url: page.url() })),
  );
  throw new Error(`Packaged application page did not become ready: ${JSON.stringify(pages)}`);
}

function killProcessTree(pid) {
  return new Promise((resolveKill) => {
    if (globalThis.process.platform !== "win32") return resolveKill();
    execFile("taskkill", ["/pid", String(pid), "/t", "/f"], () => resolveKill());
  });
}

function killPackagedProcesses() {
  return new Promise((resolveKill) => {
    if (globalThis.process.platform !== "win32") return resolveKill();
    const command =
      "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'DNF*.exe' -and $_.ExecutablePath -like \"$env:TEMP\\*\" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
    execFile("powershell.exe", ["-NoProfile", "-Command", command], () => resolveKill());
  });
}

async function bounded(action) {
  await Promise.race([action, new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000))]);
}

let browser;
let process;
try {
  await bounded(killPackagedProcesses());
  await Promise.all([
    copyFile(artifactPath, executable),
    mkdir(appData, { recursive: true }),
    mkdir(localAppData, { recursive: true }),
    mkdir(libraryRoot, { recursive: true }),
  ]);
  await writeFile(join(libraryRoot, "portable-test.npk"), "portable-test-payload");
  const port = await availablePort();
  process = spawn(executable, [`--remote-debugging-port=${port}`], {
    cwd: sandbox,
    env: { ...globalThis.process.env, APPDATA: appData, LOCALAPPDATA: localAppData },
    stdio: "ignore",
  });
  await waitForEndpoint(port);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  if (context === undefined) throw new Error("Packaged browser context is unavailable");
  const page = await waitForAppPage(context);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page).toHaveTitle("");
  await expect(page.locator(".app-toolbar")).toHaveCount(0);
  await page.getByRole("button", { name: "调整外观" }).waitFor();
  await page.getByRole("button", { name: "portable-test.npk", exact: true }).waitFor();
  await mkdir(join(projectRoot, ".scratch", "portable"), { recursive: true });
  await page.screenshot({ path: join(projectRoot, ".scratch", "portable", "window-1280x720.png") });
  const dataEntries = await readdir(join(sandbox, "data"));
  const size = (await stat(artifactPath)).size;
  console.log(`PORTABLE_EXE=${artifactPath}`);
  console.log(`PORTABLE_SIZE=${size}`);
  console.log(`PORTABLE_SHA256=${await sha256(artifactPath)}`);
  console.log(`RUNTIME_ROOT=${sandbox}`);
  console.log(`DATA_ENTRIES=${dataEntries.sort().join(",")}`);
  console.log(`APPDATA_ENTRIES=${(await readdir(appData)).join(",")}`);
} finally {
  if (process !== undefined) await bounded(killProcessTree(process.pid));
  await bounded(killPackagedProcesses());
  if (browser !== undefined) await bounded(browser.close());
  await bounded(rm(sandbox, { force: true, recursive: true, maxRetries: 3, retryDelay: 200 }));
}
