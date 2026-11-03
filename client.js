/**
 * dsh-local-radiance-server-controller — Client half.
 *
 * Registers a global main panel (`main` slot, key `local-radiance-server`)
 * plus its sidebar icon (`sidebar.panellist`), and drives this package's Host
 * HTTP API at `/dsh-local-radiance-server-controller/*`.
 */
window.__ModuleLoader__.load({
  id: 'dsh-local-radiance-server-controller',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useEffect = React.useEffect;

    const PANEL_ID = 'local-radiance-server';
    const BASE = '/dsh-local-radiance-server-controller';
    const DEFAULTS = {
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

    const DICT = {
      zh: {
        nav: '推理服务器',
        title: '本地radiance推理服务器控制器',
        subtitle: '通过 SSH 远程控制局域网推理服务器：显卡功率限制、Radiance 推理服务、镜像更新、硬件状态、关机与重启。',
        notConfigured: '未配置',
        settingsTitle: 'SSH 连接设置',
        settingsDesc: '保存后本插件即可远程登录该服务器（密码保存在本机 ~/.dsh/dsh-local-radiance-server-controller.json）。',
        host: '主机 IP',
        port: '端口',
        username: '用户名',
        password: '密码',
        useSudo: '需要 sudo（自动输入登录密码）',
        composeDir: 'Compose 目录',
        composeFile: '默认 Compose 文件',
        imageName: 'Radiance 镜像名',
        powerLimitWatts: '功率限制 (W)',
        save: '保存',
        saveTest: '保存并测试',
        saved: '已保存。',
        test: '测试连接',
        powerTitle: 'AMD 显卡功率限制',
        powerDesc: '开启执行 sudo amd-smi set -o {w}，关闭执行 sudo amd-smi reset -o。',
        powerOn: '开启限制（{w}W）',
        powerReset: '恢复默认',
        serviceTitle: 'Radiance 推理服务',
        serviceDesc: 'cd {dir} && sudo docker compose -f <文件> up -d / down。',
        composeFileLabel: 'Compose 配置文件',
        refreshList: '刷新列表',
        up: '启动推理引擎',
        down: '关闭推理引擎',
        noFilesSelect: '（未找到 yaml 文件）',
        noFiles: '未找到 yaml 文件，请检查 Compose 目录设置或 SSH 连接后点击“刷新列表”。',
        imageTitle: '更新 Radiance 镜像',
        imageDesc: '先执行 sudo docker compose -f {file} down 关闭当前推理引擎，再执行 sudo docker pull {image}。',
        pull: '停止并拉取镜像',
        diagTitle: '显卡信息',
        diagDesc: '执行 amd-smi 读取服务器 AMD 显卡状态。',
        diag: '获取 amd-smi 信息',
        dangerTitle: '危险操作',
        shutdownHint: '执行 sudo shutdown -h now 立即关闭服务器，请确保已保存服务器上的工作。',
        shutdown: '关机',
        shutdownConfirm: '再次点击以确认关机',
        shutdownSent: '关机指令已发送，服务器即将下线。',
        reboot: '重启',
        rebootConfirm: '再次点击以确认重启',
        rebootSent: '重启指令已发送，服务器正在重启。',
        rebootHint: '执行 sudo reboot 立即重启服务器，容器会随系统自动拉起，约需 1-2 分钟。',
        dangerDesc: '关机与重启都会立即执行，请先确认服务器上的工作已保存。',
        running: '执行中…',
        done: '完成',
        failed: '失败',
        error: '错误',
        jobLost: '任务状态丢失，请检查服务器上的结果。',
        stateRunning: '运行中',
        stateStopped: '已停止',
        stateUnknown: '状态未知',
        powerStateLimited: '当前：已限制 {c}W（默认 {d}W）',
        powerStateDefault: '当前：默认 {d}W（未限制）',
        powerStateUnknown: '当前功率限制状态未知',
        connected: '已连接',
        unreachable: '不可达',
        statusNote: '打开页面时自动探测服务器状态，每 20 秒刷新一次',
        metricsTitle: '服务器实时状态',
        metricsGpu: 'GPU',
        metricsCpu: 'CPU',
        metricsDecode: '解码',
        metricsPrefill: '预填',
        metricsEngineUp: '引擎运行中',
        metricsEngineDown: '引擎离线',
        metricsUnreachable: '服务器不可达',
        metricsNotConfigured: '未配置服务器',
      },
      en: {
        nav: 'Inference Server',
        title: 'Local Radiance Inference Server Controller',
        subtitle: 'Remote-control the LAN inference server over SSH: GPU power limit, Radiance inference service, image updates, hardware info, shutdown and reboot.',
        notConfigured: 'not configured',
        settingsTitle: 'SSH Connection',
        settingsDesc: 'Credentials are stored on this machine at ~/.dsh/dsh-local-radiance-server-controller.json.',
        host: 'Host IP',
        port: 'Port',
        username: 'Username',
        password: 'Password',
        useSudo: 'Use sudo (feeds the login password)',
        composeDir: 'Compose directory',
        composeFile: 'Default compose file',
        imageName: 'Radiance image',
        powerLimitWatts: 'Power limit (W)',
        save: 'Save',
        saveTest: 'Save & Test',
        saved: 'Saved.',
        test: 'Test connection',
        powerTitle: 'AMD GPU Power Limit',
        powerDesc: 'On runs sudo amd-smi set -o {w}; off runs sudo amd-smi reset -o.',
        powerOn: 'Enable limit ({w}W)',
        powerReset: 'Reset to default',
        serviceTitle: 'Radiance Inference Service',
        serviceDesc: 'cd {dir} && sudo docker compose -f <file> up -d / down.',
        composeFileLabel: 'Compose file',
        refreshList: 'Refresh list',
        up: 'Start engine',
        down: 'Stop engine',
        noFilesSelect: '(no yaml files found)',
        noFiles: 'No yaml files found. Check the compose directory or the SSH connection, then click “Refresh list”.',
        imageTitle: 'Update Radiance Image',
        imageDesc: 'Runs sudo docker compose -f {file} down first, then sudo docker pull {image}.',
        pull: 'Stop & pull image',
        diagTitle: 'GPU Info',
        diagDesc: 'Runs amd-smi on the server.',
        diag: 'Fetch amd-smi output',
        dangerTitle: 'Danger Zone',
        shutdownHint: 'Runs sudo shutdown -h now to power the server off immediately; save any work on the server first.',
        shutdown: 'Shutdown',
        shutdownConfirm: 'Click again to confirm shutdown',
        shutdownSent: 'Shutdown command sent; the server is going down.',
        reboot: 'Reboot',
        rebootConfirm: 'Click again to confirm reboot',
        rebootSent: 'Reboot command sent; the server is restarting.',
        rebootHint: 'Runs sudo reboot to restart the server immediately; containers auto-start after boot (about 1-2 min).',
        dangerDesc: 'Shutdown and reboot take effect immediately; save any work on the server first.',
        running: 'Running…',
        done: 'Done',
        failed: 'Failed',
        error: 'Error',
        jobLost: 'Job state lost; check the result on the server.',
        stateRunning: 'running',
        stateStopped: 'stopped',
        stateUnknown: 'unknown',
        powerStateLimited: 'Now: limited to {c}W (default {d}W)',
        powerStateDefault: 'Now: default {d}W (no limit)',
        powerStateUnknown: 'Power limit state unknown',
        connected: 'connected',
        unreachable: 'unreachable',
        statusNote: 'Probes the server automatically when the page opens and every 20 seconds',
        metricsTitle: 'Live server metrics',
        metricsGpu: 'GPU',
        metricsCpu: 'CPU',
        metricsDecode: 'decode',
        metricsPrefill: 'prefill',
        metricsEngineUp: 'engine running',
        metricsEngineDown: 'engine offline',
        metricsUnreachable: 'server unreachable',
        metricsNotConfigured: 'server not configured',
      },
    };

    function makeT(ctx) {
      let locale = 'zh';
      let service;
      try {
        service = ctx.locale;
      } catch {
        service = undefined;
      }
      if (!service && typeof ctx.get === 'function') {
        try {
          service = ctx.get('locale');
        } catch {}
      }
      const read = () => {
        try {
          const snap = service?.getLocale?.();
          const id = (snap && (snap.language ?? snap.locale ?? snap.id)) || 'zh';
          locale = String(id).toLowerCase().startsWith('zh') ? 'zh' : 'en';
        } catch {}
      };
      read();
      const t = (key, params) => {
        let text = (DICT[locale] && DICT[locale][key]) || DICT.en[key] || key;
        if (params) {
          for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
        }
        return text;
      };
      t.read = read;
      return t;
    }

    const msg = (error) => String((error && error.message) || error || 'unknown error');
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function api(pathname, body) {
      const init = { cache: 'no-store' };
      if (body !== undefined) {
        init.method = 'POST';
        init.headers = { 'content-type': 'application/json' };
        init.body = JSON.stringify(body);
      }
      const response = await fetch(BASE + pathname, init);
      if (!response.ok) {
        let detail = '';
        try {
          detail = String((await response.json()).error ?? '');
        } catch {
          detail = String(response.statusText ?? '');
        }
        throw new Error(detail || `HTTP ${response.status}`);
      }
      return await response.json();
    }

    // ---- live metrics: one shared poller feeding the sidebar widget ----
    const METRICS_MS = 5_000;
    const metricsStore = { snapshot: { data: null, reachable: null }, inFlight: false, timer: null, listeners: new Set() };

    function emitMetrics() {
      for (const listener of metricsStore.listeners) {
        try {
          listener(metricsStore.snapshot);
        } catch {
          /* one dead listener must not stop the poll */
        }
      }
    }

    async function pollMetrics() {
      if (metricsStore.inFlight) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      metricsStore.inFlight = true;
      try {
        const boot = await api('/state');
        if (!boot || !boot.settings || !boot.settings.host) {
          metricsStore.snapshot = { data: null, reachable: null };
        } else {
          const result = await api('/action', { action: 'metrics' });
          if (result && result.ok) {
            metricsStore.snapshot = { data: { cpu: result.cpu, gpus: result.gpus, engine: result.engine }, reachable: true };
          } else {
            metricsStore.snapshot = { ...metricsStore.snapshot, reachable: false };
          }
        }
      } catch {
        metricsStore.snapshot = { ...metricsStore.snapshot, reachable: false };
      } finally {
        metricsStore.inFlight = false;
        emitMetrics();
      }
    }

    function subscribeMetrics(listener) {
      if (!metricsStore.timer) {
        metricsStore.timer = setInterval(() => {
          pollMetrics();
        }, METRICS_MS);
        pollMetrics();
      }
      listener(metricsStore.snapshot);
      metricsStore.listeners.add(listener);
      return () => metricsStore.listeners.delete(listener);
    }

    function useLiveMetrics() {
      const [snap, setSnap] = useState(metricsStore.snapshot);
      useEffect(() => subscribeMetrics(setSnap), []);
      return snap;
    }

    // ---- fast engine speed: 0.5 s cadence over the host's persistent SSH connection ----
    const FAST_MS = 500;
    const fastStore = { snapshot: { engine: null }, inFlight: false, timer: null, listeners: new Set() };

    function emitFast() {
      for (const listener of fastStore.listeners) {
        try {
          listener(fastStore.snapshot);
        } catch {
          /* keep the poll alive even if one listener throws */
        }
      }
    }

    function sameEngine(a, b) {
      if (a === b) return true;
      if (!a || !b) return false;
      return a.up === b.up && a.decodeTps === b.decodeTps && a.prefillTps === b.prefillTps && a.model === b.model;
    }

    async function pollFast() {
      if (fastStore.inFlight) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      fastStore.inFlight = true;
      try {
        const result = await api('/fast');
        if (result && result.ok) {
          if (!sameEngine(fastStore.snapshot.engine, result.engine)) {
            fastStore.snapshot = { engine: result.engine || { up: false } };
          }
        } else if (!result || !result.cooling) {
          // Unconfigured or unreachable (not a cooldown): show dashes rather than stale numbers.
          if (fastStore.snapshot.engine !== null) fastStore.snapshot = { engine: null };
        }
      } catch {
        if (fastStore.snapshot.engine !== null) fastStore.snapshot = { engine: null };
      } finally {
        fastStore.inFlight = false;
        emitFast();
      }
    }

    function subscribeFast(listener) {
      if (!fastStore.timer) {
        fastStore.timer = setInterval(() => {
          pollFast();
        }, FAST_MS);
        pollFast();
      }
      listener(fastStore.snapshot);
      fastStore.listeners.add(listener);
      return () => fastStore.listeners.delete(listener);
    }

    function useFastEngine() {
      const [snap, setSnap] = useState(fastStore.snapshot);
      useEffect(() => subscribeFast(setSnap), []);
      return snap;
    }

    const inputStyle = {
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 8,
      padding: '7px 10px',
      fontSize: 13,
      background: 'var(--dsw-alias-bg-base)',
      color: 'var(--dsw-alias-label-primary)',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box',
    };

    // Sidebar footer widget: live engine speed + GPU/CPU utilisation, always visible.
    function MetricsWidget({ t, wide }) {
      const snap = useLiveMetrics();
      const fast = useFastEngine();
      const okColor = 'var(--dsw-alias-state-success-primary)';
      const warnColor = 'var(--dsw-alias-state-warn-primary)';
      const badColor = 'var(--dsw-alias-state-error-primary)';
      const idleColor = 'var(--dsw-alias-label-secondary)';
      const d = snap.data;
      const engine = fast.engine || (d && d.engine) || null;
      const up = !!(engine && engine.up);
      const gpu = d && Array.isArray(d.gpus) && d.gpus.length
        ? Math.round((d.gpus.reduce((sum, value) => sum + value, 0) / d.gpus.length) * 10) / 10
        : null;
      const cpu = d && typeof d.cpu === 'number' ? d.cpu : null;
      const fmt = (value) => (typeof value === 'number' ? String(Math.round(value)) : '-');
      const stateColor = snap.reachable === false ? badColor : up ? okColor : snap.reachable === null ? idleColor : warnColor;
      const head = up
        ? engine.model || t('metricsEngineUp')
        : snap.reachable === false
          ? t('metricsUnreachable')
          : d || fast.engine
            ? t('metricsEngineDown')
            : t('metricsNotConfigured');
      const level = (value) => (value >= 85 ? badColor : value >= 60 ? warnColor : 'var(--dsw-alias-label-primary)');
      const cell = (label, valueText, valueColor) =>
        h(
          'span',
          { style: { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } },
          `${label} `,
          h('span', { style: { color: valueColor, fontWeight: 600 } }, valueText),
        );
      if (!wide) {
        return h(
          'div',
          {
            style: {
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: '1px solid var(--dsw-alias-border-l1)',
              background: 'var(--dsw-alias-bg-layer-1)',
            },
          },
          h('span', { style: { width: 8, height: 8, borderRadius: 999, background: stateColor, display: 'inline-block' } }),
        );
      }
      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 10px',
            borderRadius: 8,
            border: '1px solid var(--dsw-alias-border-l1)',
            background: 'var(--dsw-alias-bg-layer-1)',
            fontSize: 11.5,
            color: 'var(--dsw-alias-label-secondary)',
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
          },
        },
        h('span', { style: { width: 8, height: 8, borderRadius: 999, background: stateColor, display: 'inline-block', flexShrink: 0 } }),
        d
          ? h(
              'span',
              { style: { display: 'flex', gap: 9, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' } },
              cell(t('metricsGpu'), gpu === null ? '-' : `${Math.round(gpu)}%`, gpu === null ? 'var(--dsw-alias-label-secondary)' : level(gpu)),
              cell(t('metricsCpu'), cpu === null ? '-' : `${Math.round(cpu)}%`, cpu === null ? 'var(--dsw-alias-label-secondary)' : level(cpu)),
              cell(t('metricsDecode'), fmt(up ? engine.decodeTps : null), up ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)'),
              cell(t('metricsPrefill'), fmt(up ? engine.prefillTps : null), up ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)'),
            )
          : h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, head),
      );
    }

    function Icon({ size = 16, active }) {
      const color = active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)';
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: color,
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('rect', { x: 2, y: 4, width: 8.5, height: 6, rx: 1.6 }),
        h('rect', { x: 2, y: 13.5, width: 8.5, height: 6, rx: 1.6 }),
        h('path', { d: 'M15.6 2.2 9.6 12.4h3.2L11 21.8l6.8-10.6h-3.3l1.7-5.6z' }),
      );
    }

    function Button({ tone = 'default', disabled, onClick, title, children }) {
      const primary = tone === 'primary';
      const danger = tone === 'danger';
      return h(
        'button',
        {
          onClick,
          disabled,
          title,
          style: {
            appearance: 'none',
            border: `1px solid ${primary ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)'}`,
            borderRadius: 8,
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: primary ? 600 : 500,
            cursor: disabled ? 'default' : 'pointer',
            background: danger ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-bg-layer-2)',
            color: danger ? '#ffffff' : 'var(--dsw-alias-label-primary)',
            opacity: disabled ? 0.55 : 1,
            whiteSpace: 'nowrap',
          },
        },
        children,
      );
    }

    function Badge({ kind = 'muted', children }) {
      const color =
        kind === 'ok'
          ? 'var(--dsw-alias-state-success-primary)'
          : kind === 'bad'
            ? 'var(--dsw-alias-state-error-primary)'
            : 'var(--dsw-alias-label-secondary)';
      return h(
        'span',
        { style: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color } },
        h('span', { style: { width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' } }),
        children,
      );
    }

    function Field({ label, children }) {
      return h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 } },
        h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, label),
        children,
      );
    }

    function Output({ out }) {
      if (!out) return null;
      const color =
        out.kind === 'error'
          ? 'var(--dsw-alias-state-error-primary)'
          : out.kind === 'ok'
            ? 'var(--dsw-alias-state-success-primary)'
            : 'var(--dsw-alias-label-secondary)';
      return h(
        'div',
        { style: { borderTop: '1px solid var(--dsw-alias-border-l1)', paddingTop: 10 } },
        h('div', { style: { fontSize: 12, fontWeight: 600, color } }, out.title ?? ''),
        out.text
          ? h(
              'pre',
              {
                style: {
                  margin: '8px 0 0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: 'var(--dsw-alias-label-secondary)',
                  background: 'var(--dsw-alias-bg-base)',
                  border: '1px solid var(--dsw-alias-border-l1)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  maxHeight: out.tall ? 420 : 240,
                  overflow: 'auto',
                  fontFamily: 'ui-monospace, Consolas, Menlo, monospace',
                },
              },
              out.text,
            )
          : null,
      );
    }

    function Section({ title, desc, children, out, t }) {
      return h(
        'section',
        {
          style: {
            background: 'var(--dsw-alias-bg-layer-1)',
            border: '1px solid var(--dsw-alias-border-l1)',
            borderRadius: 12,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          },
        },
        h(
          'div',
          {},
          h('h2', { style: { margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, title),
          desc
            ? h('p', { style: { margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' } }, desc)
            : null,
        ),
        children,
        out ? h(Output, { out }) : null,
      );
    }

    function App({ t }) {
      const [settings, setSettings] = useState(null);
      const [form, setForm] = useState(null);
      const [files, setFiles] = useState([]);
      const [file, setFile] = useState('');
      const [busy, setBusy] = useState({});
      const [out, setOut] = useState({});
      const [armed, setArmed] = useState(null); // name of the danger action awaiting a second click
      const [status, setStatus] = useState(null);
      const [statusOk, setStatusOk] = useState(null);
      const settingsRef = React.useRef(null);
      const inFlight = React.useRef({ status: false });

      useEffect(() => {
        if (!armed) return undefined;
        const timer = setTimeout(() => setArmed(null), 4000);
        return () => clearTimeout(timer);
      }, [armed]);

      const setBusyKey = (key, value) => setBusy((current) => ({ ...current, [key]: value }));
      const setOutEntry = (key, entry) => setOut((current) => ({ ...current, [key]: entry }));
      const patchForm = (patch) => setForm((current) => ({ ...(current ?? {}), ...patch }));

      async function loadFiles(source) {
        setBusyKey('files', true);
        try {
          const result = await api('/action', { action: 'listFiles' });
          const list = Array.isArray(result.files) ? result.files : [];
          setFiles(list);
          const want = (source && source.composeFile) || DEFAULTS.composeFile;
          setFile((current) => {
            if (current && list.includes(current)) return current;
            if (list.includes(want)) return want;
            return list[0] ?? '';
          });
          if (!list.length) setOutEntry('service', { kind: 'info', title: t('serviceTitle'), text: t('noFiles') });
        } catch (error) {
          setOutEntry('service', { kind: 'error', title: t('error'), text: msg(error) });
        } finally {
          setBusyKey('files', false);
        }
      }

      async function refreshStatus(quiet) {
        const current = settingsRef.current;
        if (!current || !current.host) return;
        if (inFlight.current.status) return;
        inFlight.current.status = true;
        setBusyKey('status', true);
        try {
          const result = await api('/action', { action: 'status' });
          if (result && result.ok) {
            setStatus({ power: result.power || { known: false }, compose: result.compose || {} });
            setStatusOk(true);
          } else {
            setStatusOk(false);
            if (!quiet) setOutEntry('service', { kind: 'error', title: t('failed'), text: String((result && result.error) || t('unreachable')) });
          }
        } catch (error) {
          setStatusOk(false);
          if (!quiet) setOutEntry('service', { kind: 'error', title: t('error'), text: msg(error) });
        } finally {
          inFlight.current.status = false;
          setBusyKey('status', false);
        }
      }

      useEffect(() => {
        const timer = setInterval(() => {
          refreshStatus(true);
        }, 20_000);
        return () => clearInterval(timer);
      }, []);

      useEffect(() => {
        let disposed = false;
        (async () => {
          try {
            const boot = await api('/state');
            if (disposed) return;
            setSettings(boot.settings);
            settingsRef.current = boot.settings;
            setForm({ ...DEFAULTS, ...boot.settings });
            if (boot.settings && boot.settings.host) await Promise.all([loadFiles(boot.settings), refreshStatus(true)]);
          } catch (error) {
            if (!disposed) setOutEntry('settings', { kind: 'error', title: t('error'), text: msg(error) });
          }
        })();
        return () => {
          disposed = true;
        };
      }, []);

      async function waitJob(jobId, card) {
        for (let attempt = 0; attempt < 1600; attempt += 1) {
          await delay(1500);
          let job;
          try {
            job = (await api(`/job?id=${encodeURIComponent(jobId)}`)).job;
          } catch (error) {
            if (/404/.test(msg(error))) throw new Error(t('jobLost'));
            continue;
          }
          if (!job) throw new Error(t('jobLost'));
          if (job.done) return { ok: job.ok, output: job.output, error: job.error };
        }
        throw new Error(t('jobLost'));
      }

      async function runAction(action, card, extra) {
        setBusyKey(action, true);
        setOutEntry(card, { kind: 'info', title: t('running') });
        try {
          let result = await api('/action', { action, file: file || undefined, ...(extra ?? {}) });
          if (result.started) result = await waitJob(result.jobId, card);
          if (result.ok) {
            const title = action === 'shutdown' ? t('shutdownSent') : action === 'reboot' ? t('rebootSent') : t('done');
            setOutEntry(card, { kind: 'ok', title, text: String(result.output ?? ''), tall: action === 'amdSmi' });
          } else {
            setOutEntry(card, {
              kind: 'error',
              title: t('failed'),
              text: [result.error, result.output].filter(Boolean).join('\n'),
              tall: action === 'amdSmi',
            });
          }
          if (result && result.ok && ['powerOn', 'powerReset', 'composeUp', 'composeDown', 'pullImage'].includes(action)) refreshStatus(true);
          return result;
        } catch (error) {
          setOutEntry(card, { kind: 'error', title: t('error'), text: msg(error) });
          return { ok: false };
        } finally {
          setBusyKey(action, false);
        }
      }

      async function saveSettings(withTest) {
        setBusyKey('save', true);
        try {
          const saved = await api('/settings', {
            ...(form ?? {}),
            port: Number(form?.port) || 22,
            powerLimitWatts: Number(form?.powerLimitWatts) || 210,
          });
          setSettings(saved.settings);
          setForm({ ...DEFAULTS, ...saved.settings });
          setOutEntry('settings', { kind: 'ok', title: t('saved') });
          if (saved.settings && saved.settings.host) await loadFiles(saved.settings);
          if (withTest) await runAction('test', 'settings');
        } catch (error) {
          setOutEntry('settings', { kind: 'error', title: t('error'), text: msg(error) });
        } finally {
          setBusyKey('save', false);
        }
      }

      async function dangerAction(name) {
        if (armed !== name) {
          setArmed(name);
          return;
        }
        setArmed(null);
        await runAction(name, 'danger');
      }

      const watts = Number(settings?.powerLimitWatts) || 210;
      const composeDir = settings?.composeDir || DEFAULTS.composeDir;
      const activeFile = file || settings?.composeFile || DEFAULTS.composeFile;
      const statusMap = (status && status.compose) || {};
      const activeRunning = activeFile ? statusMap[activeFile] === 'running' : false;
      const powerState = (status && status.power) || { known: false };

      return h(
        'div',
        {
          style: {
            height: '100%',
            overflowY: 'auto',
            background: 'var(--dsw-alias-bg-base)',
            color: 'var(--dsw-alias-label-primary)',
          },
        },
        h(
          'div',
          {
            style: {
              maxWidth: 860,
              margin: '0 auto',
              padding: '28px 24px 56px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            },
          },
          h(
            'header',
            { style: { display: 'flex', alignItems: 'flex-start', gap: 12 } },
            h(Icon, { size: 30, active: true }),
            h(
              'div',
              { style: { flex: 1, minWidth: 0 } },
              h('h1', { style: { margin: 0, fontSize: 20, fontWeight: 700 } }, t('title')),
              h(
                'p',
                { style: { margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' } },
                t('subtitle'),
              ),
              settings?.host
                ? h(
                    'p',
                    { style: { margin: '2px 0 0', fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)', opacity: 0.75 } },
                    t('statusNote'),
                  )
                : null,
            ),
            h(
              'span',
              {
                style: {
                  flexShrink: 0,
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--dsw-alias-border-l1)',
                  background: 'var(--dsw-alias-bg-layer-1)',
                  color: settings?.host ? 'var(--dsw-alias-label-secondary)' : 'var(--dsw-alias-state-warn-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                },
              },
              settings?.host
                ? [
                    h('span', {
                      key: 'dot',
                      style: {
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        display: 'inline-block',
                        background:
                          statusOk === true
                            ? 'var(--dsw-alias-state-success-primary)'
                            : statusOk === false
                              ? 'var(--dsw-alias-state-error-primary)'
                              : 'var(--dsw-alias-state-idle-primary)',
                      },
                    }),
                    `${settings.username}@${settings.host}:${settings.port}`,
                    statusOk === true ? t('connected') : statusOk === false ? t('unreachable') : '',
                  ]
                : t('notConfigured'),
            ),
          ),
          // --- SSH settings -------------------------------------------------
          h(
            Section,
            { title: t('settingsTitle'), desc: t('settingsDesc'), out: out.settings, t },
            form
              ? h(
                  'div',
                  {
                    style: {
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                      gap: 12,
                    },
                  },
                  h(
                    Field,
                    { label: t('host') },
                    h('input', { style: inputStyle, value: form.host ?? '', placeholder: '192.168.1.10', onChange: (e) => patchForm({ host: e.target.value }) }),
                  ),
                  h(
                    Field,
                    { label: t('port') },
                    h('input', { style: inputStyle, value: String(form.port ?? 22), inputMode: 'numeric', onChange: (e) => patchForm({ port: e.target.value }) }),
                  ),
                  h(
                    Field,
                    { label: t('username') },
                    h('input', { style: inputStyle, value: form.username ?? '', autoComplete: 'username', onChange: (e) => patchForm({ username: e.target.value }) }),
                  ),
                  h(
                    Field,
                    { label: t('password') },
                    h('input', { style: inputStyle, type: 'password', value: form.password ?? '', autoComplete: 'off', onChange: (e) => patchForm({ password: e.target.value }) }),
                  ),
                  h(
                    Field,
                    { label: t('composeDir') },
                    h('input', { style: inputStyle, value: form.composeDir ?? '', onChange: (e) => patchForm({ composeDir: e.target.value }) }),
                  ),
                  h(
                    Field,
                    { label: t('composeFile') },
                    h('input', { style: inputStyle, value: form.composeFile ?? '', onChange: (e) => patchForm({ composeFile: e.target.value }) }),
                  ),
                  h(
                    Field,
                    { label: t('imageName') },
                    h('input', { style: inputStyle, value: form.imageName ?? '', onChange: (e) => patchForm({ imageName: e.target.value }) }),
                  ),
                  h(
                    Field,
                    { label: t('powerLimitWatts') },
                    h('input', { style: inputStyle, value: String(form.powerLimitWatts ?? 210), inputMode: 'numeric', onChange: (e) => patchForm({ powerLimitWatts: e.target.value }) }),
                  ),
                  h(
                    'label',
                    { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dsw-alias-label-secondary)', alignSelf: 'end', paddingBottom: 6 } },
                    h('input', { type: 'checkbox', checked: form.useSudo !== false, onChange: (e) => patchForm({ useSudo: e.target.checked }) }),
                    t('useSudo'),
                  ),
                )
              : h('p', { style: { margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } }, t('running')),
            h(
              'div',
              { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
              h(Button, { tone: 'primary', disabled: busy.save, onClick: () => saveSettings(false) }, busy.save ? t('running') : t('save')),
              h(Button, { disabled: busy.save || busy.test, onClick: () => saveSettings(true) }, t('saveTest')),
              h(Button, { disabled: busy.test, onClick: () => runAction('test', 'settings') }, busy.test ? t('running') : t('test')),
            ),
          ),
          // --- GPU power limit ----------------------------------------------
          h(
            Section,
            { title: t('powerTitle'), desc: t('powerDesc', { w: watts }), out: out.power, t },
            h(
              Badge,
              { kind: powerState.enabled === true ? 'ok' : 'muted' },
              powerState.known
                ? powerState.enabled
                  ? t('powerStateLimited', { c: powerState.currentW, d: powerState.defaultW })
                  : t('powerStateDefault', { d: powerState.defaultW })
                : t('powerStateUnknown'),
            ),
            h(
              'div',
              { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
              h(
                Button,
                { tone: 'primary', disabled: busy.powerOn || powerState.enabled === true, onClick: () => runAction('powerOn', 'power') },
                busy.powerOn ? t('running') : (powerState.enabled === true ? '✓ ' : '') + t('powerOn', { w: watts }),
              ),
              h(
                Button,
                {
                  disabled: busy.powerReset || (powerState.known === true && powerState.enabled === false),
                  onClick: () => runAction('powerReset', 'power'),
                },
                busy.powerReset ? t('running') : (powerState.known === true && powerState.enabled === false ? '✓ ' : '') + t('powerReset'),
              ),
            ),
          ),
          // --- inference service --------------------------------------------
          h(
            Section,
            { title: t('serviceTitle'), desc: t('serviceDesc', { dir: composeDir }), out: out.service, t },
            h(
              Badge,
              { kind: activeRunning ? 'ok' : 'muted' },
              statusMap[activeFile] === 'running'
                ? t('stateRunning')
                : statusMap[activeFile] === 'exited' || statusOk === true
                  ? t('stateStopped')
                  : t('stateUnknown'),
            ),
            h(
              'div',
              { style: { display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' } },
              h(
                Field,
                { label: t('composeFileLabel') },
                h(
                  'select',
                  { style: { ...inputStyle, minWidth: 220 }, value: file, onChange: (e) => setFile(e.target.value) },
                  files.length
                    ? files.map((name) => {
                        const st = statusMap[name];
                        const suffix = st === 'running' ? ` · ${t('stateRunning')}` : st === 'exited' ? ` · ${t('stateStopped')}` : '';
                        return h('option', { key: name, value: name }, `${name}${suffix}`);
                      })
                    : h('option', { value: '' }, t('noFilesSelect')),
                ),
              ),
              h(Button, { disabled: busy.files || busy.status, onClick: () => Promise.all([loadFiles(settings), refreshStatus(false)]) }, busy.files || busy.status ? t('running') : t('refreshList')),
              h(
                Button,
                { tone: 'primary', disabled: busy.composeUp || (statusOk === true && activeRunning), onClick: () => runAction('composeUp', 'service') },
                busy.composeUp ? t('running') : (statusOk === true && activeRunning ? '✓ ' : '') + t('up'),
              ),
              h(
                Button,
                { disabled: busy.composeDown || (statusOk === true && !activeRunning), onClick: () => runAction('composeDown', 'service') },
                busy.composeDown ? t('running') : (statusOk === true && !activeRunning ? '✓ ' : '') + t('down'),
              ),
            ),
          ),
          // --- image update ---------------------------------------------------
          h(
            Section,
            { title: t('imageTitle'), desc: t('imageDesc', { file: activeFile, image: settings?.imageName || DEFAULTS.imageName }), out: out.image, t },
            h(
              'div',
              { style: { display: 'flex', gap: 10 } },
              h(Button, { tone: 'primary', disabled: busy.pullImage, onClick: () => runAction('pullImage', 'image') }, busy.pullImage ? t('running') : t('pull')),
            ),
          ),
          // --- diagnostics -----------------------------------------------------
          h(
            Section,
            { title: t('diagTitle'), desc: t('diagDesc'), out: out.smi, t },
            h(
              'div',
              { style: { display: 'flex', gap: 10 } },
              h(Button, { disabled: busy.amdSmi, onClick: () => runAction('amdSmi', 'smi') }, busy.amdSmi ? t('running') : t('diag')),
            ),
          ),
          // --- danger ------------------------------------------------------------
          h(
            Section,
            { title: t('dangerTitle'), desc: t('dangerDesc'), out: out.danger, t },
            h(
              'div',
              { style: { display: 'flex', gap: 10 } },
              h(
                Button,
                { tone: 'danger', disabled: busy.shutdown, title: t('shutdownHint'), onClick: () => dangerAction('shutdown') },
                busy.shutdown ? t('running') : armed === 'shutdown' ? t('shutdownConfirm') : t('shutdown'),
              ),
              h(
                Button,
                { tone: 'danger', disabled: busy.reboot, title: t('rebootHint'), onClick: () => dangerAction('reboot') },
                busy.reboot ? t('running') : armed === 'reboot' ? t('rebootConfirm') : t('reboot'),
              ),
            ),
          ),
        ),
      );
    }

    function Panel({ t }) {
      t.read();
      return h(App, { t });
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = makeT(ctx);
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID }, () => h(Panel, { t })),
        );
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => t('nav') },
            (owner = {}) => h(Icon, { size: owner.size ?? 16, active: !!owner.active }),
          ),
        );
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            { name: 'sidebar.footer.action', id: 'local-radiance-server-metrics', order: 30, label: () => t('metricsTitle') },
            (owner = {}) => h(MetricsWidget, { t, wide: owner.wide === undefined ? true : !!owner.wide }),
          ),
        );
      },
    };
  },
});
