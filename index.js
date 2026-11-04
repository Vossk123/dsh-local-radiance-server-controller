/**
 * dsh-local-radiance-server-controller — Host half.
 *
 * Remote control for a local-LAN Radiance inference server over SSH.
 * Exposes a package-private HTTP API on the local web server
 * (`/dsh-local-radiance-server-controller/*`, consumed by this package's
 * Client half) and executes the server operations with `node-ssh`.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { NodeSSH } from 'node-ssh';

const ROUTE_PREFIX = '/dsh-local-radiance-server-controller';
const SETTINGS_PATH = path.join(os.homedir(), '.dsh', 'dsh-local-radiance-server-controller.json');

const DEFAULT_SETTINGS = {
  host: '',
  port: 22,
  username: '',
  password: '',
  useSudo: true,
  composeDir: '~/radiance-compose',
  composeFile: 'flashnext-tp2.yaml',
  imageName: 'stilldeadcode/radiance',
  powerLimitWatts: 210,
};

// Module-level state survives a plugin fiber reload (e.g. after an HMR bump).
const state = {
  settings: undefined,
  loading: undefined,
  jobs: new Map(),
};

const QUICK_TIMEOUT_MS = 25_000;
const LONG_TIMEOUT_MS = 40 * 60_000;

// Base/extension-only compose files that can't run alone; hidden from the picker.
const HIDDEN_COMPOSE_FILES = new Set(['common.yaml']);

function isSafeDir(dir) {
  return /^[A-Za-z0-9_~][A-Za-z0-9_./~-]*$/.test(dir) && !dir.includes('..');
}

function isSafeComposeFile(file) {
  return /^[A-Za-z0-9][A-Za-z0-9 ._@+-]*\.ya?ml$/i.test(file) && !file.includes('..');
}

function quoteShell(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function errorMessage(error) {
  const text = String((error && error.message) || error || 'unknown error');
  if (/all configured authentication methods failed/i.test(text)) {
    return `SSH 认证失败，请检查用户名和密码 / SSH authentication failed; check the username and password`;
  }
  if (/timed? ?out|etimedout/i.test(text)) {
    return `SSH 连接超时，请检查主机地址与网络 / SSH connection timed out; check the host address and network`;
  }
  if (/econnrefused/i.test(text)) {
    return `SSH 连接被拒绝，请确认端口 / SSH connection refused; check the port`;
  }
  if (/ehostunreach|enetunreach|enotfound|eai_again|econnreset/i.test(text)) {
    return `无法连接到 SSH 主机，请检查 IP 与网络 / Cannot reach the SSH host; check the IP and network`;
  }
  return text;
}

async function loadSettings() {
  if (state.settings) return state.settings;
  if (!state.loading) {
    state.loading = (async () => {
      let stored = {};
      try {
        stored = JSON.parse(await fs.readFile(SETTINGS_PATH, 'utf8')) || {};
      } catch {
        stored = {};
      }
      state.settings = { ...DEFAULT_SETTINGS, ...stored };
      return state.settings;
    })();
  }
  return state.loading;
}

async function saveSettings(patch) {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  state.settings = next;
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function pickSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  const patch = {};
  if (typeof source.host === 'string') patch.host = source.host.trim();
  if (typeof source.username === 'string') patch.username = source.username.trim();
  if (typeof source.password === 'string') patch.password = source.password;
  if (typeof source.composeDir === 'string') patch.composeDir = source.composeDir.trim() || DEFAULT_SETTINGS.composeDir;
  if (typeof source.composeFile === 'string') patch.composeFile = source.composeFile.trim();
  if (typeof source.imageName === 'string') patch.imageName = source.imageName.trim();
  if (source.port !== undefined) {
    const port = Number(source.port);
    if (Number.isInteger(port) && port > 0 && port < 65536) patch.port = port;
  }
  if (source.powerLimitWatts !== undefined) {
    const watts = Number(source.powerLimitWatts);
    if (Number.isFinite(watts) && watts > 0 && watts <= 1000) patch.powerLimitWatts = watts;
  }
  if (typeof source.useSudo === 'boolean') patch.useSudo = source.useSudo;
  return patch;
}

function withTimeout(ssh, promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        ssh.dispose();
      } catch {}
      const error = new Error(`命令执行超时（${Math.round(timeoutMs / 1000)}s）/ Command timed out after ${Math.round(timeoutMs / 1000)}s`);
      error.timedOut = true;
      reject(error);
    }, timeoutMs);
  });
  timeout.unref?.();
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Runs a task on the persistent connection; it stays warm between calls. */
async function withSsh(settings, task, timeoutMs = QUICK_TIMEOUT_MS) {
  const ssh = await getLaneClient(sshLane, settings, Math.min(15_000, timeoutMs));
  try {
    return await withTimeout(ssh, task(ssh), timeoutMs);
  } catch (error) {
    if (laneBroken(error)) {
      // Transport-level failure (timeout / dead channel): drop the warm connection so
      // the next call reconnects. Ordinary "command exited non-zero" never throws here.
      resetLane(sshLane, 1000);
    }
    throw error;
  }
}

async function exec(ssh, command) {
  return await ssh.execCommand(command);
}

/** Runs a command through sudo when enabled, feeding the password through a pipe into `sudo -S`. */
async function sudoExec(settings, ssh, command) {
  if (settings.useSudo === false) return await exec(ssh, command);
  if (!settings.password) {
    throw new Error(
      'sudo 密码为空：请先在上方「SSH 连接设置」里填写密码并保存（sudo 用的就是登录密码）/ sudo password is empty; enter and save the login password in the SSH settings above',
    );
  }
  // node-ssh's `stdin` option closes the channel before sudo reads it, so feed the
  // password through a pipe instead; base64 keeps the plaintext out of the process argv.
  // The payload goes through `sudo sh -c '<command>'` as ONE quoted argument: handing the
  // raw command to sudo would break shell syntax (`cd dir && docker …` → "sudo: cd: command
  // not found") and let `&&` bind at the outer shell level, escaping sudo for the tail.
  // `env HOME="$HOME"` re-points HOME at the LOGIN user's home for the root shell:
  // otherwise `cd ~/foo` inside the payload expands against /root and misses.
  const encoded = Buffer.from(`${settings.password}\n`, 'utf8').toString('base64');
  return await exec(
    ssh,
    `printf '%s' ${quoteShell(encoded)} | base64 -d | sudo -S -p '' env HOME="$HOME" sh -c ${quoteShell(command)}`,
  );
}

function check(result) {
  const stdout = String(result?.stdout ?? '').trim();
  const stderr = String(result?.stderr ?? '').trim();
  const output = [stdout, stderr].filter(Boolean).join('\n');
  if (result?.code === 0) return { ok: true, output };
  return {
    ok: false,
    output,
    error: `命令失败（退出码 ${result?.code}）/ Command failed (exit ${result?.code})`,
  };
}

function requireComposeDir(settings) {
  const dir = settings.composeDir || DEFAULT_SETTINGS.composeDir;
  if (!isSafeDir(dir)) throw new Error(`非法的 Compose 目录 / Invalid compose directory: ${dir}`);
  return dir;
}

function requireComposeFile(settings, body) {
  const file = String((body && body.file) || settings.composeFile || '').trim();
  if (!isSafeComposeFile(file)) throw new Error(`非法的 Compose 文件名 / Invalid compose file name: ${file}`);
  return file;
}

function requireImageName(settings) {
  const image = settings.imageName || DEFAULT_SETTINGS.imageName;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/:-]*$/.test(image)) throw new Error(`非法的镜像名 / Invalid image name: ${image}`);
  return image;
}

async function composeRun(settings, body, tail, timeoutMs) {
  const dir = requireComposeDir(settings);
  const file = requireComposeFile(settings, body);
  return await withSsh(settings, async (ssh) => {
    return check(await sudoExec(settings, ssh, `cd ${dir} && docker compose -f ${quoteShell(file)} ${tail}`));
  }, timeoutMs);
}

// ---- persistent SSH connection ----
// Exactly ONE long-lived connection for the whole plugin: the 0.5 s engine probe,
// the 5 s CPU/GPU metrics, the 20 s status checks and every user action share it
// through ssh2's multiplexed exec channels. No short-lived connections anywhere.
function makeLane(name) {
  return { name, ssh: null, signature: '', coolingUntil: 0, connecting: null };
}
const sshLane = makeLane('main');

function laneSignature(settings) {
  return `${settings.host}|${settings.port}|${settings.username}|${crypto
    .createHash('sha1')
    .update(String(settings.password || ''))
    .digest('hex')}`;
}

function laneBroken(error) {
  if (error && error.timedOut) return true;
  return /not connected|econnreset|ehostunreach|enetunreach|econnrefused|etimedout|connection reset|connection closed|channel closed|no response|socket hang ?up|broken pipe/i.test(
    String((error && error.message) || error || ''),
  );
}

function resetLane(lane, cooldownMs = 3000) {
  try {
    lane.ssh?.dispose();
  } catch {}
  lane.ssh = null;
  lane.signature = '';
  lane.connecting = null;
  lane.coolingUntil = Date.now() + cooldownMs;
}

/** Returns a warm node-ssh client for the lane, dialing (once) if it is not connected. */
async function getLaneClient(lane, settings, connectTimeoutMs) {
  if (!settings.host || !settings.username) {
    throw new Error('尚未配置 SSH 连接，请先在面板填写主机、用户名和密码 / SSH is not configured; fill in the host and username in the panel first');
  }
  const signature = laneSignature(settings);
  if (lane.ssh && lane.signature !== signature) {
    // Target/credentials changed: drop the old connection and dial a fresh one.
    try {
      lane.ssh.dispose();
    } catch {}
    lane.ssh = null;
    lane.connecting = null;
  }
  if (lane.ssh && !lane.ssh.isConnected()) {
    // node-ssh clears its handle once ssh2 reports close/error: adopt that signal.
    lane.ssh = null;
  }
  if (lane.ssh) return lane.ssh;
  if (lane.connecting) return await lane.connecting;
  if (Date.now() < lane.coolingUntil) {
    const error = new Error('SSH 重连退避中 / SSH reconnect is backing off');
    error.cooling = true;
    throw error;
  }
  const ssh = new NodeSSH();
  const dial = (async () => {
    try {
      await withTimeout(
        ssh,
        ssh.connect({
          host: settings.host,
          port: Number(settings.port) || 22,
          username: settings.username,
          password: settings.password || undefined,
          readyTimeout: Math.min(10_000, connectTimeoutMs),
          keepaliveInterval: 15_000,
          keepaliveCountMax: 3,
        }),
        connectTimeoutMs,
      );
      lane.ssh = ssh;
      lane.signature = signature;
      lane.coolingUntil = 0;
      return ssh;
    } catch (error) {
      try {
        ssh.dispose();
      } catch {}
      lane.coolingUntil = Date.now() + 5000;
      throw error;
    } finally {
      lane.connecting = null;
    }
  })();
  lane.connecting = dial;
  return await dial;
}

function parseEngineStats(stdout) {
  try {
    const stats = JSON.parse(String(stdout || ''));
    if (!stats || stats.error) return { up: false };
    return {
      up: true,
      model: String(stats.model ?? ''),
      version: String(stats.version ?? ''),
      prefillTps: Math.round((Number(stats.prefill_tps) || 0) * 10) / 10,
      decodeTps: Math.round((Number(stats.decode_tps) || 0) * 10) / 10,
    };
  } catch {
    return { up: false };
  }
}

function statsProbe(dir) {
  return (
    `PORT=$(sed -n 's/^PORT=//p' ${dir}/.env 2>/dev/null | head -1 | tr -d '"'); ` +
    `KEY=$(sed -n 's/^RADIANCE_API_KEY=//p' ${dir}/.env 2>/dev/null | head -1 | tr -d '"'); ` +
    `curl -s -m 2 localhost:\${PORT:-8000}/stats -H "Authorization: Bearer $KEY"`
  );
}

async function fastStats(settings) {
  const dir = requireComposeDir(settings);
  const ssh = await getLaneClient(sshLane, settings, 9000);
  let result;
  try {
    result = await withTimeout(ssh, exec(ssh, statsProbe(dir)), 4000);
  } catch (error) {
    // The warm connection died or stalled; drop it and back off before reconnecting.
    if (laneBroken(error)) resetLane(sshLane, 4000);
    throw error;
  }
  // curl exiting non-zero just means the engine is not answering: a normal "offline" reading.
  return parseEngineStats(result.stdout);
}

const actions = {
  /** SSH smoke test: reports the remote hostname. */
  test: {
    long: false,
    async run(settings) {
      return await withSsh(settings, async (ssh) => check(await exec(ssh, 'echo "[ok] $(hostname) $(uname -srm)"')));
    },
  },

  /** Lists the docker-compose yaml files under the compose directory. */
  listFiles: {
    long: false,
    async run(settings) {
      const dir = requireComposeDir(settings);
      return await withSsh(settings, async (ssh) => {
        const result = await exec(ssh, `ls -1 ${dir} 2>/dev/null | grep -Ei '[.]ya?ml$' | sort`);
        const files = String(result?.stdout ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .filter((name) => !HIDDEN_COMPOSE_FILES.has(name.toLowerCase()));
        return { ok: true, files };
      });
    },
  },

  /** Live metrics for the sidebar widget: CPU busy %, GPU busy %, engine prefill/decode t/s. */
  metrics: {
    long: false,
    async run(settings) {
      const dir = requireComposeDir(settings);
      return await withSsh(settings, async (ssh) => {
        // One connection, no sudo: /proc/stat twice, amd-smi usage, then the engine's /stats
        // (radiance binds the host network; PORT + API key come from the compose .env).
        const script =
          "echo '###CPU1###'; grep '^cpu ' /proc/stat; sleep 0.5; echo '###CPU2###'; grep '^cpu ' /proc/stat; " +
          "echo '###GPU###'; amd-smi metric -u 2>/dev/null | grep 'GFX_ACTIVITY'; " +
          "echo '###STATS###'; " +
          `PORT=$(sed -n 's/^PORT=//p' ${dir}/.env 2>/dev/null | head -1 | tr -d '"'); ` +
          `KEY=$(sed -n 's/^RADIANCE_API_KEY=//p' ${dir}/.env 2>/dev/null | head -1 | tr -d '"'); ` +
          `curl -s -m 4 localhost:\${PORT:-8000}/stats -H "Authorization: Bearer $KEY"`;
        const result = await exec(ssh, script);
        const text = String(result.stdout ?? '');
        const grab = (name) => {
          const start = text.indexOf(`###${name}###`);
          if (start < 0) return '';
          const from = start + name.length + 6;
          const next = text.indexOf('###', from);
          return (next < 0 ? text.slice(from) : text.slice(from, next)).trim();
        };
        const nums = (sectionName) => {
          const line = grab(sectionName).split('\n').find((entry) => entry.trim().startsWith('cpu '));
          return line ? line.trim().split(/\s+/).slice(1, 9).map(Number) : null;
        };
        const a = nums('CPU1');
        const b = nums('CPU2');
        let cpu = null;
        if (a && b && a.length === 8 && b.length === 8) {
          const total = b.reduce((sum, value, index) => sum + (value - a[index]), 0);
          const idle = b[3] - a[3] + (b[4] - a[4]); // idle + iowait
          if (total > 0) cpu = Math.max(0, Math.min(100, Math.round((1000 * (total - idle)) / total) / 10));
        }
        const gpus = [...grab('GPU').matchAll(/GFX_ACTIVITY:\s*(\d+)\s*%/g)].map((m) => Number(m[1]));
        let engine = { up: false };
        try {
          const stats = JSON.parse(grab('STATS'));
          if (stats && !stats.error) {
            engine = {
              up: true,
              model: String(stats.model ?? ''),
              version: String(stats.version ?? ''),
              prefillTps: Math.round((Number(stats.prefill_tps) || 0) * 10) / 10,
              decodeTps: Math.round((Number(stats.decode_tps) || 0) * 10) / 10,
            };
          }
        } catch {
          engine = { up: false };
        }
        return { ok: true, cpu, gpus, engine };
      });
    },
  },

  /** One-shot server status: compose project states + current GPU power limit vs default. */
  status: {
    long: false,
    async run(settings) {
      return await withSsh(settings, async (ssh) => {
        const compose = await sudoExec(settings, ssh, 'docker compose ls --format json 2>/dev/null');
        const limit = await sudoExec(settings, ssh, 'amd-smi static -l 2>&1');
        let projects = [];
        try {
          projects = JSON.parse(String(compose.stdout || '[]'));
        } catch {
          projects = [];
        }
        const byFile = {};
        for (const project of projects) {
          const files = String(project.ConfigFiles || '')
            .split(',')
            .map((entry) => entry.trim().split('/').pop())
            .filter(Boolean);
          const running = /^running\(/i.test(String(project.Status || ''));
          for (const file of files) byFile[file] = running ? 'running' : 'exited';
        }
        const limitText = `${limit.stdout || ''}\n${limit.stderr || ''}`;
        const socketLimits = [...limitText.matchAll(/SOCKET_POWER_LIMIT:\s*(\d+)\s*W/g)].map((m) => Number(m[1]));
        const maxLimits = [...limitText.matchAll(/MAX_POWER_LIMIT:\s*(\d+)\s*W/g)]
          .map((m) => Number(m[1]))
          .filter((n) => n > 0);
        let power = { known: false, enabled: null, currentW: null, defaultW: null };
        if (socketLimits.length && maxLimits.length) {
          const currentW = Math.min(...socketLimits);
          const defaultW = Math.max(...maxLimits);
          power = { known: true, enabled: currentW < defaultW, currentW, defaultW };
        }
        return { ok: true, compose: byFile, power };
      });
    },
  },

  /** Reads the AMD GPU status. */
  amdSmi: {
    long: false,
    async run(settings) {
      return await withSsh(settings, async (ssh) => check(await exec(ssh, 'amd-smi 2>&1')));
    },
  },

  /** Enables the GPU power limit: sudo amd-smi set -o <watts> */
  powerOn: {
    long: true,
    async run(settings) {
      const watts = Number(settings.powerLimitWatts) || DEFAULT_SETTINGS.powerLimitWatts;
      return await withSsh(settings, async (ssh) => check(await sudoExec(settings, ssh, `amd-smi set -o ${watts}`)), LONG_TIMEOUT_MS);
    },
  },

  /** Resets the GPU power limit: sudo amd-smi reset -o */
  powerReset: {
    long: true,
    async run(settings) {
      return await withSsh(settings, async (ssh) => check(await sudoExec(settings, ssh, 'amd-smi reset -o')), LONG_TIMEOUT_MS);
    },
  },

  /** Starts the inference engine: cd <composeDir> && sudo docker compose -f <file> up -d */
  composeUp: {
    long: true,
    run(settings, body) {
      return composeRun(settings, body, 'up -d', LONG_TIMEOUT_MS);
    },
  },

  /** Stops the inference engine: sudo docker compose -f <file> down */
  composeDown: {
    long: true,
    run(settings, body) {
      return composeRun(settings, body, 'down', LONG_TIMEOUT_MS);
    },
  },

  /** Opens the engine web UI in this machine's default browser; the port is read live from the server .env. */
  openWeb: {
    long: false,
    async run(settings) {
      const dir = requireComposeDir(settings);
      const host = String(settings.host || '').trim();
      if (!/^[\w.-]+$/.test(host)) throw new Error(`非法的主机地址，无法拼出 Web 地址 / Invalid host for the web URL: ${host}`);
      const port = await withSsh(settings, async (ssh) => {
        const result = await exec(ssh, `sed -n 's/^PORT=//p' ${dir}/.env 2>/dev/null | head -1 | tr -d '"'`);
        const value = Number(String(result.stdout || '').trim());
        return Number.isInteger(value) && value > 0 && value <= 65535 ? value : 8000;
      });
      const url = `http://${host}:${port}`;
      const [command, commandArgs] =
        process.platform === 'win32'
          ? ['cmd.exe', ['/c', 'start', '', url]]
          : process.platform === 'darwin'
            ? ['open', [url]]
            : ['xdg-open', [url]];
      const child = spawn(command, commandArgs, { detached: true, stdio: 'ignore' });
      child.on('error', () => {});
      child.unref();
      return { ok: true, output: url };
    },
  },

  /** Stops the current engine, then pulls the latest Radiance image. */
  pullImage: {
    long: true,
    async run(settings, body) {
      const dir = requireComposeDir(settings);
      const file = requireComposeFile(settings, body);
      const image = requireImageName(settings);
      return await withSsh(
        settings,
        async (ssh) => {
          const down = check(await sudoExec(settings, ssh, `cd ${dir} && docker compose -f ${quoteShell(file)} down`));
          if (!down.ok) {
            return { ok: false, output: `docker compose down:\n${down.output}`, error: `${down.error}（docker compose down）` };
          }
          const pull = check(await sudoExec(settings, ssh, `docker pull ${quoteShell(image)}`));
          return {
            ok: pull.ok,
            output: `docker compose down:\n${down.output || '(ok)'}\n\ndocker pull ${image}:\n${pull.output}`,
            error: pull.error,
          };
        },
        LONG_TIMEOUT_MS,
      );
    },
  },

  /** Powers the server off immediately: sudo shutdown -h now */
  shutdown: {
    long: true,
    async run(settings) {
      const outcome = await withSsh(settings, async (ssh) => {
        try {
          const result = await sudoExec(settings, ssh, 'shutdown -h now');
          // sshd goes down with the machine, so the channel often closes without an exit status.
          if (result.code === null || result.code === 0 || result.code === 255) {
            return { ok: true, output: String(result.stdout ?? '').trim() || '关机指令已发出，服务器正在断电。 / Shutdown initiated.' };
          }
          return check(result);
        } catch (error) {
          // The channel dying mid-command right after `shutdown -h now` means the box went down.
          return { ok: true, output: `关机指令已发出，SSH 连接已随服务器关闭 / Shutdown initiated; the SSH connection closed with the server（${errorMessage(error)}）` };
        }
      }, LONG_TIMEOUT_MS);
      if (outcome.ok) {
        // The machine is going away: drop the warm connection up front so pollers
        // wait out the cooldown instead of hammering the shutting-down sshd.
        resetLane(sshLane, 20_000);
      }
      return outcome;
    },
  },

  /** Reboots the server immediately: sudo reboot */
  reboot: {
    long: true,
    async run(settings) {
      const outcome = await withSsh(settings, async (ssh) => {
        try {
          const result = await sudoExec(settings, ssh, 'reboot');
          // sshd goes down with the reboot, so the channel often closes without an exit status.
          if (result.code === null || result.code === 0 || result.code === 255) {
            return { ok: true, output: String(result.stdout ?? '').trim() || '重启指令已发出，服务器正在重启。 / Reboot initiated.' };
          }
          return check(result);
        } catch (error) {
          // The channel dying mid-command right after `reboot` means the box went down.
          return { ok: true, output: `重启指令已发出，SSH 连接已随服务器重启中断 / Reboot initiated; the SSH connection closed with the reboot（${errorMessage(error)}）` };
        }
      }, LONG_TIMEOUT_MS);
      if (outcome.ok) {
        // The machine is rebooting: hold the pollers off for longer than a shutdown,
        // since a full boot cycle has to finish before sshd answers again.
        resetLane(sshLane, 30_000);
      }
      return outcome;
    },
  },
};

function startJob(label, task) {
  const id = crypto.randomUUID();
  const job = { id, label, done: false, ok: false, output: '', error: null };
  state.jobs.set(id, job);
  (async () => {
    try {
      const result = await task();
      job.ok = result.ok === true;
      job.output = String(result.output ?? '');
      if (!job.ok) job.error = String(result.error ?? '命令未成功 / Command did not succeed');
    } catch (error) {
      job.ok = false;
      job.error = errorMessage(error);
    } finally {
      job.done = true;
      const timer = setTimeout(() => state.jobs.delete(id), 30 * 60_000);
      timer.unref?.();
    }
  })();
  return job;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('body too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function createHandler(connection) {
  return async function handle(req, res) {
    try {
      const rejection = connection?.requestRejection?.(req);
      if (rejection !== undefined) {
        res.writeHead(rejection);
        res.end(rejection === 401 ? 'unauthorized' : 'forbidden');
        return;
      }
      const url = new URL(req.url ?? '/', 'http://dsh.internal');
      const endpoint = url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+/, '');

      if (req.method === 'GET') {
        if (endpoint === 'state') {
          const settings = await loadSettings();
          writeJson(res, 200, { settings });
          return;
        }
        if (endpoint === 'job') {
          const job = state.jobs.get(url.searchParams.get('id') ?? '');
          if (!job) {
            writeJson(res, 404, { error: 'job not found' });
            return;
          }
          writeJson(res, 200, {
            job: { id: job.id, label: job.label, done: job.done, ok: job.ok, output: job.output, error: job.error },
          });
          return;
        }
        if (endpoint === 'fast') {
          const settings = await loadSettings();
          try {
            const engine = await fastStats(settings);
            writeJson(res, 200, { ok: true, engine });
          } catch (error) {
            writeJson(res, 200, { ok: false, cooling: !!error.cooling });
          }
          return;
        }
        writeJson(res, 404, { error: 'not found' });
        return;
      }

      if (req.method !== 'POST') {
        writeJson(res, 405, { error: 'method not allowed' });
        return;
      }

      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        writeJson(res, 400, { error: 'body is not valid JSON' });
        return;
      }

      if (endpoint === 'settings') {
        const saved = await saveSettings(pickSettings(body));
        writeJson(res, 200, { ok: true, settings: saved });
        return;
      }

      if (endpoint === 'action') {
        const name = String(body?.action ?? '');
        const spec = actions[name];
        if (!spec) {
          writeJson(res, 400, { error: `unknown action: ${name || '(empty)'}` });
          return;
        }
        const settings = await loadSettings();
        if (!spec.long) {
          try {
            const result = await spec.run(settings, body);
            writeJson(res, 200, { started: false, ...result });
          } catch (error) {
            writeJson(res, 200, { started: false, ok: false, error: errorMessage(error) });
          }
          return;
        }
        const job = startJob(name, () => spec.run(settings, body));
        writeJson(res, 200, { started: true, jobId: job.id });
        return;
      }

      writeJson(res, 404, { error: 'not found' });
    } catch (error) {
      try {
        writeJson(res, 500, { error: errorMessage(error) });
      } catch {}
    }
  };
}

export const inject = ['webServer'];

export function apply(ctx) {
  const connection = ctx.get('connection');
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: createHandler(connection),
    });
    return () => {
      dispose?.();
      try {
        sshLane.ssh?.dispose();
      } catch {}
      sshLane.ssh = null;
    };
  }, 'dsh-local-radiance-server-controller: http routes');
}
