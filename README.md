# dsh-model-mgr

中文 | [English](README.en.md)

给 DeepSeek Harness 的原生模型配置补一个轻量 GUI：**按模型**管理输入模态、Context Window、Max Tokens，并直接验证文本与视觉通路。

> “文本 + 图片”只是向 DSH 声明这个模型/端点接受图片输入，不会让原本不支持视觉的模型或推理服务凭空获得 Vision。

## 当前版本

当前版本：**0.1.4**。

0.1.4 的重点是降低侵入性并修复视觉测试：

- 不再提供 Provider 级“默认多模态”常规开关；
- 只对单个模型写 `input`；
- Provider 能力区默认收起，模型行也默认收起；
- 检测旧版本留下的 `defaultInput: [text, image]` 时，只显示清理提示，不会自动修改；
- 替换了之前被截断的测试 PNG；
- CI 会校验 PNG chunk 和 IDAT 解压，避免再次发布坏图片。

## 入口

主入口：

```text
设置
→ 模型
→ 展开一个 llm-pi-ai Provider
→ 模型能力 · dsh-model-mgr
```

兼容入口：

```text
设置
→ 插件
→ 模型能力
```

两个入口编辑的是同一份 DSH 原生 `llm-pi-ai` settings，没有第二份配置。

## 交互

插件采用两级折叠：

```text
模型能力 · dsh-model-mgr                         >
```

点开后才看到模型列表：

```text
qwen3.8-27b · 继承 DSH 默认/目录                >
qwen-vl      · 文本 + 图片                      >
```

再点某个模型，才显示：

- 输入能力
- Context Window
- Max Tokens
- 测试文本
- 测试视觉
- 保存 / 恢复继承

## 单模型输入能力

| UI | 原生 DSH 写入语义 |
|---|---|
| 继承 DSH 默认/目录 | `unset` 模型自己的 `input` |
| 纯文本 | `input: [text]` |
| 多模态（文本 + 图片） | `input: [text, image]` |

插件不会根据 `Qwen-VL`、`Vision` 等名字自动猜能力。

对于显式 `models` 的自建 Provider，会写目标模型本身：

```yaml
llm-pi-ai:
  providers:
    local-vllm:
      models:
        - id: qwen-model
          input: [text, image]
          contextWindow: 131072
          maxTokens: 32768
```

对于使用内置 catalog 的 Provider，会使用最小 `modelOverrides`：

```yaml
llm-pi-ai:
  providers:
    my-provider:
      modelOverrides:
        qwen-model:
          input: [text, image]
          contextWindow: 131072
```

插件使用 nested path patch，不会为了改 `input` 把 `compat`、reasoning 或其他未编辑字段抹掉。

## Provider 默认能力

0.1.4 开始，插件**不再提供 Provider 级 `defaultInput` 编辑器**。

DSH 自己的 `defaultInput` 默认是 `[text]`，而且只是 fallback。这个插件的目标是“按模型声明能力”，所以不再鼓励把整个 Provider 一次性改成多模态。

如果旧版本已经写入：

```yaml
defaultInput: [text, image]
```

能力面板会显示一次警告，并提供：

```text
清除系列级多模态默认
```

这个按钮会 `unset defaultInput`，恢复 DSH 原生默认/目录行为；插件不会自动替你修改。

## 文本测试

点击 **测试文本** 后，Host 通过当前 DSH `ctx.llm` 路由发送最小请求：

```text
只回复 MODEL_OK
```

UI 会显示连接是否成功、耗时以及 Provider 错误。

## 视觉测试

点击 **测试视觉** 后：

1. `ctx.llm.resolveModelInfo(provider, model)` 先确认 DSH 是否声明 `image`；
2. 没有 `image` 时直接返回 DSH 层失败，不发送图片；
3. 使用插件内置、CI 校验过的 320×96 RGB PNG，图片内容是 `VISION_427`；
4. 图片准入兼容以下 DSH attachment API：
   - `admitPromptContent()`
   - `saveImages()`
   - `saveImage()`
5. 再通过同一 Provider / Model 路由发送视觉请求；
6. 根据结果区分 DSH、Provider 和模型识别三个层次。

诊断语义：

- **DSH 层失败**：模型未声明图片输入，或图片在 DSH attachment 准入/持久化阶段失败；
- **Provider 层失败**：图片已经交给 DSH，但推理服务器 / endpoint 拒绝或中断请求；
- **模型层识别异常**：请求成功，图片通路已经走通，但回答没有识别出 `VISION_427`；
- **视觉通路正常**：模型成功返回 `VISION_427`。

旧版出现过：

```text
Unsupported or malformed image data
```

原因是插件内置 PNG 数据被截断。0.1.4 已替换为完整 PNG，并新增解压级回归测试。

## 保存与并发

浏览器端只绑定 DSH 原生 namespace：

```text
settingsScope.bind({ namespace: "llm-pi-ai" })
```

保存通过：

```text
settingsScope.mutate(ops, expectedRevision)
```

所以：

- 恢复继承是真正的 `unset`；
- 不整块覆盖 Provider；
- revision 过期时由 DSH 拒绝旧写入；
- 未编辑字段保持原样。

## 安全边界

- 不在前端读取、保存或展示 API Key；
- 不读取 `.credentials.yaml` 明文；
- 测试请求复用 DSH 现有 Provider / credential 通路；
- 不扫描或偷偷测试所有 Provider；
- 不按模型名自动开启多模态；
- 视觉测试只使用插件自带固定 PNG；
- 不自动上传用户本地文件；
- 所有模型能力修改都必须由用户明确保存。

Host 诊断接口：

```text
/plugins/dsh-model-mgr/probe
```

只接受 `provider`、`model` 和 `kind: text|vision`。

## 安装 / 升级

Web profile：

```bash
dsh plugin --profile web add github:rffanlab/dsh-model-mgr
```

升级：

```bash
dsh plugin --profile web update dsh-model-mgr
```

如果安装在 default profile：

```bash
dsh plugin --profile default update dsh-model-mgr
```

升级后建议重启 DSH Web Host，并浏览器 `Ctrl+F5` 强制刷新。

## 开发

Node.js 20+：

```bash
npm test
npm run check
npm run packcheck
```

当前测试覆盖：

- inherit / text / text+image 映射；
- 显式 `models` nested path；
- catalog `modelOverrides`；
- 正整数校验；
- 两个 UI slot 的 bundle smoke test；
- Provider / 模型默认折叠；
- 禁止普通 Provider 级“保存默认值”控件；
- 内置 PNG 的 signature、chunk 完整性和 IDAT 解压。

## 项目结构

```text
dsh-model-mgr/
├─ src/
│  ├─ core.js
│  ├─ vision-fixture.js
│  ├─ probe.js
│  └─ plugin.js
├─ lib/
│  └─ client.js
├─ test/
│  ├─ core.test.js
│  ├─ client-bundle.test.js
│  └─ vision-fixture.test.js
├─ README.md
├─ README.en.md
└─ package.json
```

## 设计原则

1. **DSH 原生 settings 是唯一事实源。**
2. **模型能力默认按单模型声明，不扩大到整个 Provider。**
3. **声明能力与实际测试结果分开。**
4. **默认保守。**
5. **不 Fork DSH，不 hack React DOM，不创建 shadow config。**

## License

MIT
