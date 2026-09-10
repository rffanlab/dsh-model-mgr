# dsh-model-mgr

中文 | [English](README.en.md)

**给 DeepSeek Harness 原生模型配置补一个真正可用的 GUI：管理输入模态、Context Window、Max Tokens，并直接验证文本与视觉通路。**

`dsh-model-mgr` 不维护第二份模型数据库。它只在 Harness 的 **Settings → Models** Provider 卡片中增加能力编辑器，所有保存都通过 DSH `settingsScope` 写回原生 `llm-pi-ai` settings。

> 多模态开关的含义是：**向 DSH 声明这个模型/端点可以接收图片**。它不会让一个本身没有视觉能力的模型或推理服务凭空获得 Vision。

## 功能

当前版本实现规划中的 P0～P4：

- 在 `settings.models.provider-card` 扩展槽内工作，不修改 Harness Web 核心；
- Provider 默认输入能力：`[text]` / `[text, image]`；
- 模型输入能力：继承 / 纯文本 / 文本 + 图片；
- `contextWindow`；
- `maxTokens`；
- revision-aware 保存，避免静默覆盖并发修改；
- 一键文本连接测试；
- 一键视觉通路测试；
- 视觉失败分层：DSH 能力声明、Provider/推理服务、模型识别结果；
- 对内置 pi-ai catalog 使用 `modelOverrides`，不复制整份 catalog；
- 对显式 `models` 的自建 Provider，保留原模型条目的其他字段；
- API Key 不进入浏览器。

Reasoning / Thinking 暂不放进第一版。它在 DSH 中同时涉及 reasoning effort、thinking format、chat template kwargs 等协议行为，不能安全地简化成一个“开/关”。

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

插件声明了 `dsh.bundle.patch` 和 Web client，不需要手工修改 `cordis.yml`。

## 使用

打开：

```text
Settings
→ Models
→ 一个 llm-pi-ai Provider
→ 模型能力 · dsh-model-mgr
```

### Provider 默认输入能力

可以设置：

```yaml
defaultInput: [text]
```

或：

```yaml
defaultInput: [text, image]
```

`defaultInput` 只是 fallback，不会覆盖一个模型自己或 catalog 已经声明的输入能力。

### 单模型输入能力

编辑器提供三个状态：

| UI | 写入语义 |
|---|---|
| 继承默认值 | 不保留该模型自己的 `input` |
| 纯文本 | `input: [text]` |
| 多模态（文本 + 图片） | `input: [text, image]` |

插件不会根据 `Qwen-VL`、`Vision` 等模型名自动猜能力。

### 当前 DSH 的 `modelOverrides` 语义

当前 DeepSeek Harness 的 `llm-pi-ai` 已支持 `modelOverrides`。因此插件按 Provider 类型选择最小写入面：

**使用内置 pi-ai catalog、没有显式 `models` 列表：**

```yaml
llm-pi-ai:
  providers:
    my-provider:
      modelOverrides:
        qwen-model:
          input: [text, image]
          contextWindow: 131072
```

这样不会复制整份 catalog，未来升级 pi-ai catalog 时，其余模型仍可继续继承上游变化。

**已有显式 `models` 列表的自建 Provider：**

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

保存时会 clone 当前模型条目并只修改目标字段，不会把 `api`、`compat`、`reasoningEfforts` 等未编辑字段抹掉。

## 文本测试

点击 **测试文本** 后，Host 端通过当前 DSH `ctx.llm` 路由发送：

```text
只回复 MODEL_OK
```

测试关注：

- Provider / Model 是否能解析；
- 请求是否完成；
- 是否返回可见文本；
- 耗时；
- Provider 错误码 / HTTP status（如果 DSH 暴露）。

`MODEL_OK` 是否完全匹配只作为辅助信息，不把生成质量当作连接测试标准。

## 视觉测试

点击 **测试视觉** 后：

1. Host 先调用 DSH 的精确模型能力解析；
2. 如果 DSH 没有解析到 `image` 输入能力，**不会发送图片**；
3. 如果允许图片，插件把内置的 320×96 PNG 保存到 `ctx.attachments`；
4. 图片内容为：

```text
VISION_427
```

5. 再通过标准 `ctx.llm` 请求图片；
6. 期待模型返回 `VISION_427`。

### 诊断分层

**A. DSH 层失败**

示例：

```text
DSH 当前没有把该模型解析为图片输入模型；未发送测试图片。
```

先把模型输入能力改成“文本 + 图片”，或检查 catalog / Provider fallback。

**B. Provider / 推理服务拒绝**

如果 DSH 已经允许图片，但流最终返回 Provider 错误，界面会把它标记为 Provider 层问题。常见检查方向：

- vLLM 是否实际加载视觉组件；
- 是否以 language-model-only 模式启动；
- OpenAI-compatible endpoint 是否支持图片输入；
- gateway 是否接受对应图片格式。

**C. 请求成功但识别错误**

如果请求成功、模型也返回正文，但不是 `VISION_427`：

```text
通路成功 / 识别异常
```

说明 DSH → Provider 图片链路已经走通，应继续检查模型本身、量化、视觉 encoder / projector 或推理服务实现。

## 为什么视觉需要三层同时成立

```text
模型本身支持 Vision
        ↓
推理服务实际加载 Vision
        ↓
DSH 配置声明图片输入
```

缺任何一层都可能失败。

因此：

```yaml
input: [text, image]
```

只是能力声明，不是“开启视觉魔法”。

## 保存与冲突处理

插件不读取或字符串替换 `settings.yaml`。

浏览器端使用：

```text
settingsScope.bind({ namespace: "llm-pi-ai" })
settingsScope.mutate(..., expectedRevision)
```

所以保存具有以下行为：

- 使用 DSH 原生 revision；
- Provider 在编辑期间被删除时不会重建一个旧副本；
- revision 变化时阻止当前草稿继续覆盖；
- 保存后重新读取 scope 并校验目标值；
- 未修改字段保持原样。

## 测试通道与会话

为了不在浏览器创建第二套 LLM 凭据通路，按钮通过 Harness 已有的受认证 command Remote 执行 Host 命令：

```text
/model-mgr-probe text <provider> <model>
/model-mgr-probe vision <provider> <model>
```

所以执行测试时需要当前 Web App 有一个可用会话。测试请求本身直接调用 `ctx.llm`，不会把测试 prompt 加入模型对话历史；但 Harness 可能记录一次 command/run 与 command/done 事件。

## 安全边界

- 不在前端读取或展示 API Key；
- 不读取 `.credentials.yaml` 明文；
- 测试请求沿用 DSH 已配置的 Provider / credential 通路；
- 不扫描或自动探测所有 Provider；
- 不根据模型名字自动开启图片能力；
- 视觉测试只使用插件自带的 3.4 KB 小 PNG；
- 不自动上传用户本地文件；
- 所有能力修改都由用户点击保存后生效。

## 当前范围

MVP 只管理 `llm-pi-ai` family，包括常见的：

- OpenAI-compatible 自建服务；
- vLLM；
- LM Studio；
- 自建 gateway；
- 其他通过 pi-ai adapter 的路由。

暂不试图统一管理 Codex OAuth、DeepSeek 专用 adapter 或未来任意 adapter。

## 开发

要求 Node.js 20+。

```bash
npm test
npm run check
npm run packcheck
```

测试覆盖纯配置规则和 Host probe：

- inherit / text / text+image 映射；
- `modelOverrides` 最小 patch；
- 显式 `models` 保留其他字段；
- 恢复继承只删除目标能力字段；
- text probe 成功 / Provider 失败；
- vision preflight 拒绝；
- vision 成功；
- vision 请求成功但识别不匹配。

## 架构

详细设计见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

实现遵守两个原则：

1. **原生 DSH settings 是唯一事实源。**
2. **声明能力与实际测试结果分开。**

没有 `dsh-model-mgr.yaml`、`models.json` 或 shadow database。

## License

MIT
