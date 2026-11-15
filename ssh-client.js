/**
 * dsh-local-radiance-server-controller — minimal SSH client.
 *
 * A thin adapter over `@electerm/ssh2` (the maintained pure-JavaScript fork of
 * ssh2 used by the electerm project) exposing exactly the four methods the lane
 * code used from node-ssh: connect / isConnected / dispose / execCommand.
 *
 * Why not node-ssh: node-ssh depends on ssh2, and every ssh2 1.x ships an
 * `install` lifecycle script that compiles the native cpu-features addon.
 * pnpm 10+ refuses to run dependency build scripts by default (ERR_PNPM_IGNORED_BUILDS),
 * which stalls a plain `pnpm add github:...` install for every user, and
 * pnpm overrides cannot be declared from a non-root package. So the whole
 * dependency graph of this plugin must stay lifecycle-script-free — iron rule,
 * keep it that way.
 */
import { Client } from '@electerm/ssh2';

export class SshClient {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  /** Dials the server and resolves on 'ready'; the ssh2 config passes through. */
  connect(options) {
    return new Promise((resolve, reject) => {
      const client = new Client();
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        try {
          client.end();
        } catch {}
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      // Persistent listeners: once 'ready' has fired, errors/closes must never
      // crash the process (unhandled 'error' events do) and must flip the
      // warm-lane flag so the lane layer adopts the death signal, the way
      // node-ssh used to clear its handle.
      client.on('error', (error) => {
        this.connected = false;
        fail(error);
      });
      client.on('close', () => {
        this.connected = false;
        fail(new Error('SSH connection closed / SSH 连接已关闭'));
      });
      client.once('ready', () => {
        settled = true;
        this.client = client;
        this.connected = true;
        resolve();
      });
      try {
        client.connect(options);
      } catch (error) {
        fail(error);
      }
    });
  }

  isConnected() {
    return this.connected;
  }

  /** Force-closes the connection; safe to call repeatedly. */
  dispose() {
    this.connected = false;
    const client = this.client;
    this.client = null;
    if (!client) return;
    try {
      client.end();
    } catch {}
    try {
      client.destroy();
    } catch {}
  }

  /**
   * Runs a command on a fresh multiplexed exec channel. Resolves with
   * {stdout, stderr, code, signal} for every started command — a non-zero exit
   * code is a result, not an error. Rejects only when not connected or when the
   * channel itself fails (laneBroken() matches those messages).
   */
  execCommand(command) {
    return new Promise((resolve, reject) => {
      const client = this.client;
      if (!this.connected || !client) {
        reject(new Error('Not connected / SSH 未连接'));
        return;
      }
      try {
        client.exec(command, (error, stream) => {
          if (error) {
            reject(error);
            return;
          }
          let stdout = '';
          let stderr = '';
          stream.on('data', (chunk) => {
            stdout += chunk.toString('utf8');
          });
          stream.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf8');
          });
          stream.on('error', reject);
          stream.on('close', (code, signal) => resolve({ stdout, stderr, code, signal }));
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
