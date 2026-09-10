# dsh-model-mgr

中文 | [English](README.en.md)

**给 DeepSeek Harness 原生模型配置补一个真正可用的 GUI：管理输入模态、Context Window、Max Tokens，并直接验证文本与视觉通路。**

`README.md` 是默认文档。英文版见 [`README.en.md`](README.en.md)。

> “多模态（文本 + 图片）”是**向 DSH 声明模型/端点支持图片输入**，不是给原本不支持视觉的模型或推理服务凭空增加 Vision。

## 功能

当前版本覆盖开发规划的 P0～P4：

- 使用官方 `settings.models.provider-card` keyed slot，不修改 Harness Web 核心；
- 只读写 DSH 原生 `llm-pi-ai` settings，不创建第二份模型数据库；
- Provider `defaultInput`：纯文本 / 文本 + 图片；
- 模型 `input`：继承 / 纯文本 / 文本 + 图片；
- `contextWindow` 与 `maxTokens`；
- `settingsScope.mutate(..., expectedRevision)` 的 revision-aware 保存；
- 对显式 `models` 只修改目标字段，保留其他字段；
- 对内置 catalog 优先写 `modelOverrides.<modelId>`，不复制整份 catalog；
- 一键文本连接测试；
- 一键视觉通路测试；
- 视觉失败区分 DSH 声明层、Provider/推理服务层、模型识别层；
- API Key 不进入插件前端。

Reasoning / Thinking 暂不加入第一版，因为 DSH 的推理能力还涉及 reasoning effort、thinking format、chat template kwargs 等协议行为，不能安全简化为一个开关。

## 安装

默认 profile：

```bash
dsh plugin --profile default add github:rffanlab/dsh-model-mgr
```

Web profile：

```bash
dsh plugin --profile web add github:rffanlab/dsh-model-mgr
```

升级：

```bash
dsh plugin --profile web update dsh-model-mgr
```

插件通过 `cordis.patch.yml` 激活 Host half，同时通过 `dsh.client` 加载 Web client。

## 使用

打开：

```text
Settings
→ Models
→ 一个 llm-pi-ai Provider
→ 模型能力 · dsh-model-mgr
```

### Provider 默认输入能力

可写为：

```yaml
defaultInput: [text]
```

或：

```yaml
defaultInput: [text, image]
```

`defaultInput` 是 fallback，不强制覆盖模型自己的 `input`。

### 单模型输入能力

| UI | 原生 DSH 写入语义 |
|---|---|
| 继承默认值 | `unset` 模型自己的 `input` |
| 纯文本 | `input: [text]` |
| 多模态（文本 + 图片） | `input: [text, image]` |

插件不会根据 `Qwen-VL`、`Vision` 等名称自动猜能力。

### Catalog 与自建模型

对于没有显式 `models` 列表、使用 pi-ai catalog 的 Provider，插件使用最小覆盖：

```yaml
llm-pi-ai:
  providers:
    my-provider:
      modelOverrides:
        qwen-model:
          input: [text, image]
          contextWindow: 131072
```

对于显式声明模型的自建 Provider：

```yaml
llm-pi-ai:
  providers:
    local-vllm:
      models:
        - id: qwen-model
          contextWindow: 131072
          maxTokens: 32768
          input: [text, image]
```

保存使用嵌套 path patch，不会为了改 `input` 把 `compat`、reasoning 配置或其他未编辑字段抹掉。

## 文本测试

点击 **测试文本** 后，Host 通过当前 DSH `ctx.llm` 路由发送一个最小请求：

```text
只回复 MODEL_OK
```

显示返回正文、耗时以及 Provider 错误信息。是否严格等于 `MODEL_OK` 只作为辅助信息，不把生成质量混进连接测试。

## 视觉测试

点击 **测试视觉** 后：

1. Host 先调用 `ctx.llm.resolveModelInfo(provider, model)`；
2. 若 `inputModalities` 没有 `image`，立即返回 **DSH 层失败**，不会发送测试图片；
3. 若已声明图片能力，通过现有 `ctx.attachments.admitPromptContent()` 接纳插件内置的小 PNG；
4. 图片内容为 `VISION_427`；
5. 再通过同一个 `ctx.llm` Provider/Model 路由请求模型读取图片；
6. 根据结果区分 Provider 拒绝与识别不匹配。

### 三层诊断

```text
模型本身支持 Vision
        ↓
推理服务实际加载 Vision
        ↓
DSH 配置声明 image 输入
```

- **DSH 层失败**：当前模型没有声明图片输入，图片根本不会发往 Provider；
- **Provider 层失败**：DSH 已允许图片，但推理服务 / endpoint 拒绝或中断；
- **模型层识别异常**：请求成功，说明图片通路已走通，但回答不是 `VISION_427`。

所以：

```yaml
input: [text, image]
```

只是能力声明，不是“开启视觉魔法”。

## 保存与冲突处理

插件不直接读取、正则修改或整文件覆盖 `settings.yaml`。浏览器端绑定：

```text
settingsScope.bind({ namespace: "llm-pi-ai" })
```

保存时提交结构化 nested path operations，并携带当前 revision：

```text
settingsScope.mutate(ops, expectedRevision)
```

这样恢复继承是真正的 `unset`，并发修改发生时由 DSH settings 机制拒绝旧 revision，再刷新当前配置。

## 安全边界

- 不在前端读取、保存或展示 API Key；
- 不读取 `.credentials.yaml` 明文；
- 测试请求复用 DSH 现有 Provider / credential 通路；
- 不扫描或偷偷测试所有 Provider；
- 不按模型名自动开启多模态；
- 视觉测试只使用插件自带的小型固定 PNG；
- 不自动上传用户本地文件；
- 所有能力修改都必须由用户明确保存。

Host 只注册一个同源 POST 诊断端点：

```text
/plugins/dsh-model-mgr/probe
```

它只接受 `provider`、`model` 和 `kind: text|vision`，凭据始终留在 Harness Host。

## 当前范围

MVP 只管理 `llm-pi-ai` family，适合 OpenAI-compatible 自建服务、vLLM、LM Studio、自建 gateway 以及其他 pi-ai 路由。

暂不统一管理 Codex OAuth、DeepSeek 专用 adapter 或所有未来 adapter。

## 开发

要求 Node.js 20+。

```bash
npm test
npm run check
npm run packcheck
```

当前单元测试覆盖：输入能力映射、继承 unset、显式 `models` 的 nested path、catalog `modelOverrides` 路径、正整数校验，以及视觉诊断分层。

在真实 Harness 环境发布前还应执行一次 Web smoke test：打开 Settings → Models，保存一个测试 Provider，再分别运行文本和视觉测试。

## 项目结构

```text
dsh-model-mgr/
├─ src/
│  ├─ core.js       # 配置路径/能力纯逻辑
│  ├─ probe.js      # Host 文本/视觉诊断
│  └─ plugin.js     # Host 插件入口
├─ lib/
│  └─ client.js     # DSH lazy-CJS Web client
├─ test/
│  └─ core.test.js
├─ README.md        # 默认中文
├─ README.en.md     # English
├─ package.json
└─ cordis.patch.yml
```

## 设计原则

1. **DSH 原生 settings 是唯一事实源。**
2. **声明能力与实际测试结果分开。**
3. **默认保守：不声明视觉就按纯文本处理。**
4. **不 Fork DSH，不 hack React DOM，不创建 shadow config。**

## License

MIT
