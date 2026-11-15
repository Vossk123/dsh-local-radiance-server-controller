# MAINTENANCE.md — 维护笔记（面向维护者与 AI 编码代理）

给后续接手维护本插件的人 / AI 会话：读这一份就能恢复现场。用户界面与 README 为中英双语，代码注释英文。

## 项目速览

- **是什么**：DSH（DeepSeek Harness）桌面插件，通过 SSH 远程控制局域网 AMD 推理服务器（docker compose 部署的 Radiance 推理引擎 + `amd-smi` 功率限制）。
- **形态**：Cordis bundle 插件 = Host 半区 + Client 半区，详见文件结构。
- **核心设计原则（不可妥协）**：全插件对服务器**只维持 1 条 SSH 长连接**（`sshLane`，keepalive 15s，断线自愈 + 冷却退避），所有流量走 ssh2 多路复用的 exec 通道。任何新功能都不得另开连接。
- **依赖铁律（不可妥协）**：依赖图（含传递依赖）必须 **0 个 lifecycle 脚本**（install/postinstall/preinstall）。pnpm 10+ 默认拒跑依赖编译脚本并以 `ERR_PNPM_IGNORED_BUILDS` 退出码 1 拒绝安装，用户一键装插件直接卡死，且 override 只能在用户 profile 根声明（非根 package.json#pnpm 一律不读）——插件侧无药可救，只能从根上不引入带脚本的包。**新增/升级任何依赖后必须跑一遍 clean-room 验证**：空目录 `package.json` + `pnpm add file:<插件目录>`，要求 exit 0 且无 ignored-builds 提示；再扫 `node_modules/.pnpm/**/package.json` 确认无 install 脚本。当前依赖：`@electerm/ssh2`（electerm 项目维护的 ssh2 纯 JS 分支，MIT，零脚本，API 与 ssh2 相同）。

## 文件结构

```
index.js          # Host 半区：HTTP 路由 + SSH 泳道 + 所有远端动作（actions 表驱动）
ssh-client.js     # SshClient：@electerm/ssh2 之上的薄封装，只暴露 connect/isConnected/dispose/execCommand 四法（替代 node-ssh，见依赖铁律）
client.js         # Client 半区：面板 UI（手写 h() 渲染，无 JSX）+ 侧栏图标 + 常驻指标小部件
cordis.patch.yml  # Loader 补丁（把 client 注入 web）
package.json      # dsh.bundle.patch + dsh.client manifest；版本号在这里
locale/{zh,en}.json
```

## Host 端要点（index.js）

- **路由**：前缀 `/dsh-local-radiance-server-controller`，`GET state/job/fast` + `POST settings/action {action,file?}`。动作全部走 `actions` 表：`{ long, run(settings, body) }`；`long: true` 进后台 job（40min 上限），client 轮询 `/job`。
- **三条探测节奏**（都复用同一条 lane）：
  | 周期 | 内容 | 端点 |
  |---|---|---|
  | 0.5s | `curl localhost:<PORT>/stats`（PORT/API key 现场读 `<dir>/.env`；响应含 `version`，驱动引擎版本显示） | `GET fast` |
  | 5s | `/proc/stat` 双采样 CPU + `amd-smi metric -u` GPU | `action metrics` |
  | 20s | `docker compose ls --format json` + `amd-smi static -l`（功率限制状态） | `action status` |
- **⚠️ sudo 命令铁律**（历史事故：`sudo: cd: command not found`、`cd: can't cd to /root/...`）：所有 sudo 载荷必须经 `sudoExec()` 单点执行，其产物形如：
  ```sh
  printf '%s' <b64密码> | base64 -d | sudo -S -p '' env HOME="$HOME" sh -c '<复合命令>'
  ```
  每个部件都有存在理由：base64 = 密码不进 argv；`sh -c '...'` = `cd && ...` 复合语法不被外层 shell 拆走；`env HOME="$HOME"` = 外层登录 shell 先展开 HOME，root 壳里 `~` 才指用户家目录而非 /root。**新动作要执行任何需要 sudo 的命令，直接调用 sudoExec，不要手拼。**
- 字符串进 shell 一律 `quoteShell()`（POSIX 单引号转义）；目录/文件名/镜像名/主机名先过 `require*` 白名单校验。
- `openWeb` 动作：SSH 读 `.env` 的 PORT → 本机 `cmd /c start` / `open` / `xdg-open` 打开 `http://<host>:<port>`（在运行 DSH 的电脑上看浏览器）。
- `ssh-client.js` 行为契约（lane 代码依赖它，改前必读）：`connect(options)` ssh2 配置直通、'ready' 才 resolve；'error'/'close' 常驻监听——ready 前 reject connect、ready 后只翻 `isConnected()=false`（绝不允许 unhandled 'error' 崩进程）；`dispose()` = end+destroy 幂等；`execCommand()` 对已启动命令**总是 resolve** `{stdout,stderr,code,signal}`（非零退出码是结果不是异常），未连接时 reject "Not connected"（laneBroken 正则匹配此文案）。

## Client 端要点（client.js）

- 非 JSX：一切用 `h(type, props, ...children)`；文案全走 DICT（zh/en 两本字典，改 UI 必须双语同改）。
- 两个模块级 store（组件外、闭包内）：`metricsStore`（5s）与 `fastStore`（0.5s，`sameEngine` 去重后才通知订阅者——**engine 对象加新字段时记得同步加进 sameEngine 比较**，否则 UI 不刷新）。
- 面板里的小部件（如 `EngineVersionLine`）单独订阅 store，避免整个 App 每 0.5s 重渲染。

## 改代码后的生效仪式（必做，否则改动"不生效"）

| 改了什么 | 生效方式 |
|---|---|
| `index.js` / `ssh-client.js`（Host） | **重启 DSH 应用**（Host 模块缓存只在 app 启动时刷新） |
| `client.js` / `cordis.patch.yml`（Client） | 插件 toggle 关→开 + 页面刷新（若同轮已重启应用则只需刷新） |
| `package.json` manifest | 同 Host，重启应用 |

- 官方安装形态下（见"官方安装形态"节）改源码不会生效，需重发版重装；只有开发 junction 模式才"改完即装好"。
- 本机重装依赖/重建 bundle 时，本地目录 bundle 必须 `pnpm install --node-linker=hoisted`，否则依赖装不上。

## 修改后的最低验证

用 DSH 自带 node（`%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`）：

```
node --check index.js
node --check ssh-client.js
node --check client.js
node --input-type=module -e "await import('<本目录 index.js 的 file:// URL>')"   # 应无报错
```

依赖变更后另跑"依赖铁律"里的 clean-room 验证。

需要在真实服务器上探查时（如看 `/stats` 返回结构）：**写临时 `.mjs` 脚本**（凭据读 `~/.dsh/dsh-local-radiance-server-controller.json`；SSH 直接用插件 node_modules 里的 `@electerm/ssh2` 的 `Client`，或 import 本目录 `ssh-client.js`），跑完即删。不要在 PowerShell 里内联拼远端命令——转义地狱 + `$()` 会被 pwsh 吃掉。

## 发版流程

1. `package.json` 版本号 + 两份 README 功能表同步更新。
2. 用户经 GitHub Desktop 提交并推送（commit message 由维护者起草）。
3. 打注释 tag 并推送：`git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`（PowerShell 会把 git 的 stderr 误报为 NativeCommandError，看到 `* [new tag]` 即成功）。
4. 生成预填发布链接（无 gh CLI 环境下的正解）：`https://github.com/<owner>/<repo>/releases/new?tag=...&title=...&body=...`（body 用 node `encodeURIComponent` 编码），Release notes 双语；**emoji 用字面字符**（`:plug:` 短码在 release 页不渲染），用户点 Publish 完成。

## 官方安装形态（普通用户从 GitHub 装本插件时）

- DSH 官方安装 = 在 profile 根目录跑 `pnpm add github:<owner>/<repo>`（pnpm 11、nodeLinker: hoisted），装出来是**真实目录**，与源目录无关；tarball 按 package.json 的 `files` 打包（MAINTENANCE.md 不在内）。
- **v1.0.2 起零门槛**：依赖图无 lifecycle 脚本，一键装完、不弹任何编译审批。以下是 v1.0.1 时代的历史坑（老用户环境可能还留着遗迹）：
  - 旧依赖 node-ssh→ssh2 全版本带 install 脚本 → `ERR_PNPM_IGNORED_BUILDS` 拒绝安装；当年解法是把 profile `pnpm-workspace.yaml` 的 `allowBuilds:` 里 ssh2/cpu-features 占位符改成 `false`（本机残留条目现已 inert，无害）。
  - **开发 junction 会挡住官方安装**：profile `node_modules` 下若残留指向别处的同名 Junction，`pnpm add` 报 `ERR_PNPM_EPERM`（UI 显示"没有写入权限"）。切官方安装前先 `cmd /c rmdir <junction>`（只删链接）。
  - **开发模式 ↔ 官方安装切换口诀**：开发模式 = 卸载官方 bundle 后在 `profiles/<p>/node_modules/` 建 junction 指向源目录；官方安装 = 先删 junction 再走 plugin_manager / UI。两者互斥，别混。

## 已知历史（防止重蹈覆辙）

- v1.0.0 发布带了一个 compose 动作的 sudo bug（sudoExec 直拼复合命令），v1.0.1 修复。所有复合命令路径：composeUp / composeDown / pullImage 的 down 步骤——它们共享 sudoExec，一处修全好。
- `~` 展开陷阱、`&&` 绑外层 shell 陷阱均已由 sudoExec 的 `env HOME + sh -c` 组合封死。
- 引擎版本号来自 `/stats` 的 `version` 字段，不要用镜像 tag/digest 冒充。
- v1.0.1 的依赖 node-ssh→ssh2 让外部用户被 pnpm 编译门卡死安装，v1.0.2 换 @electerm/ssh2 + 自写 ssh-client.js 薄封装根治。教训：依赖选择是发布物的一部分，clean-room 安装验证已纳入验证仪式。
