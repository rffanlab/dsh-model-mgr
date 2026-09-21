# dsh-model-mgr

中文 | [English](README.en.md)

> [!IMPORTANT]
> **本项目已停止维护。**
>
> DeepSeek Harness 已在新版中原生集成本插件最主要的能力，包括：
>
> - 模型输入类型配置（Text / Image）；
> - Context Window；
> - Max Tokens；
> - 自定义 Provider 的模型发现；
> - 本地 / OpenAI-compatible 端点的模型容量识别。
>
> 因此 `dsh-model-mgr` 已完成阶段性使命，**不再继续适配后续 DeepSeek Harness 版本**。
>
> **建议直接使用最新版 DeepSeek Harness 自带的「设置 → 模型」功能，不再安装本插件。**
>
> 本仓库保留作为历史实现与参考。如果旧版本插件曾写入过 `contextWindow`、`maxTokens`、`defaultInput` 等显式覆盖，卸载前建议先在 DSH 原生模型设置中确认并清理不再需要的覆盖项。

## 项目状态

- 状态：**停止维护 / Maintenance stopped**
- 最后版本：**0.1.7**
- 推荐替代：**DeepSeek Harness 原生 Models 设置**
- 仓库用途：历史实现、问题排查与设计参考

## 历史说明

0.1.7 是本插件停止维护前的最后版本。

0.1.7 修复了一个会影响本地模型上下文识别的重要问题：旧版插件读取的是 DSH 已经补完默认值后的 `snapshot.value`，保存模型能力时可能把 DSH 自动解析得到的 `contextWindow` / `maxTokens` 反写进用户配置，导致这些值被固定下来。DSH 后续升级或重新识别模型时，显式容量配置优先级更高，因此看起来像“DSH 识别上下文失效”。

0.1.7 开始：

- `snapshot.value` 只用于显示 **DSH 当前解析结果**；
- 写入以 `snapshot.user` 的 **原始用户配置** 为基准；
- 没有手工填写过 `contextWindow` / `maxTokens` 时，输入框保持空白；
- 空白容量字段不会被反写，继续交给 DSH / catalog 自动解析；
- 如果检测到历史显式容量覆盖，会提示并提供 **“清除容量覆盖，恢复 DSH 自动识别”**；
- 原生 **设置 → 模型** 页面仍完全保持 DSH 默认界面，插件只在 **设置 → 插件 → 模型能力** 中出现。

## 入口

```text
设置
→ 插件
→ 模型能力
```

插件不会再向 `settings.models.provider-card` 注入 UI。

## 功能

- 按模型配置 `继承 / 纯文本 / 文本 + 图片`；
- 可选手工配置 `Context Window` 与 `Max Tokens`；
- 容量字段留空时完全继承 DSH / catalog 的解析结果；
- 显示 DSH 当前解析到的 Context / Max Tokens；
- 检测显式容量覆盖并支持一键清理；
- Provider 与模型行默认收起；
- 文本连通性测试；
- 视觉通路测试；
- 视觉失败区分 DSH 图片准入层、Provider/推理服务层、模型识别层；
- 只读写 DSH 原生 `llm-pi-ai` settings，不创建第二份配置；
- API Key 不进入插件前端。

## 历史安装方式（不再推荐）

> [!WARNING]
> 以下安装命令仅作为历史记录保留。新版 DeepSeek Harness 已原生提供相关功能，不建议新安装本插件。

Web profile：

```bash
dsh plugin --profile web add github:rffanlab/dsh-model-mgr
```

已安装时更新：

```bash
dsh plugin --profile web update dsh-model-mgr
```

如果插件装在 default profile：

```bash
dsh plugin --profile default update dsh-model-mgr
```

更新后重启 DSH Web Host，并执行一次浏览器强制刷新（Ctrl+F5）。

## 上下文 / Max Tokens 继承规则

DSH 的模型容量解析有明确优先级：

```text
模型条目显式 contextWindow / maxTokens
        ↓
同 ID 的 catalog 模型容量
        ↓
Provider defaultContextWindow / defaultMaxTokens
```

因此，只要用户配置里已经存在：

```yaml
models:
  - id: local-qwen
    contextWindow: 128000
    maxTokens: 32000
```

DSH 就会优先使用这些显式值，不再采用后续 catalog / 默认解析结果。

0.1.7 的 UI 会把两类值分开显示：

- **输入框里的值**：用户真正显式写入的 override；
- **DSH 当前解析值**：只读提示，不会因为你保存多模态能力而被写回配置。

如果你从 0.1.6 或更早版本升级，并发现本地模型上下文仍然不对，请展开对应模型；看到“有手工容量覆盖”时，点击：

```text
清除容量覆盖，恢复 DSH 自动识别
```

该操作只删除该模型的 `contextWindow` / `maxTokens` 显式覆盖，**不会删除 `input`、`compat`、reasoning 等其他字段**。

## 单模型输入能力

| UI | 原生 DSH 写入语义 |
|---|---|
| 继承 DSH 默认/目录 | 清除模型自己的 `input` |
| 纯文本 | `input: [text]` |
| 多模态（文本 + 图片） | `input: [text, image]` |

插件不会根据 `Qwen-VL`、`Vision` 等名字自动猜能力。

## 显式 models Provider

DSH 的 settings wire path 只允许 `string[]`，因此显式 `models` 数组不能用数字下标作为 Remote path。插件会以**用户原始 models 数组**为基准，只修改目标行，然后一次性写回整个 `models` 数组。

关键点是：0.1.7 不再拿“DSH 已解析后的 models”作为写入基准，所以不会把自动解析出来的容量顺手固化。

示例：用户原始配置只有：

```yaml
models:
  - id: local-qwen
```

仅开启视觉后会变成：

```yaml
models:
  - id: local-qwen
    input: [text, image]
```

**不会**额外生成 `contextWindow` / `maxTokens`。

## Catalog Provider

使用内置 catalog 的 Provider 继续采用最小 `modelOverrides`：

```yaml
llm-pi-ai:
  providers:
    nvidia:
      modelOverrides:
        vision-model:
          input: [text, image]
```

容量字段留空时，对应 override 会保持不存在，继续使用 catalog 容量。

## Provider 默认能力

插件不提供 Provider 级 `defaultInput` 编辑器。

如果旧版本留下：

```yaml
defaultInput: [text, image]
```

插件页会显示“清除系列级多模态默认”按钮，由用户明确清理，不会自动修改。

## 文本测试

点击 **测试文本** 后，通过当前 DSH `ctx.llm` 路由请求模型只回复：

```text
MODEL_OK
```

## 视觉测试

点击 **测试视觉** 后：

1. 确认 DSH 当前把该模型解析为支持 `image` 输入；
2. 使用插件运行时生成的合法 PNG 测试图；
3. 图片内容包含 `VISION_427`；
4. 图片通过当前 Harness attachment 服务准入；
5. 再经当前 DSH LLM 路由发送给目标模型；
6. 根据结果区分 DSH、Provider 和模型识别三层问题。

视觉测试兼容：

```text
admitPromptContent() → saveImages() → saveImage()
```

## 安全边界

- 不在前端读取、保存或展示 API Key；
- 不读取 `.credentials.yaml` 明文；
- 测试请求复用 DSH 当前 Provider / credential 通路；
- 不自动扫描并测试所有 Provider；
- 不按模型名自动开启多模态；
- 不自动上传用户本地图片；
- 不自动删除历史容量覆盖，必须由用户明确点击清理。

Host 诊断接口：

```text
/plugins/dsh-model-mgr/probe
```

## 开发

Node.js 20+：

```bash
npm run check
npm test
npm run packcheck
```

回归测试覆盖：

- 只注册 `settings.plugins.tab`；
- Provider / 模型默认收起；
- `settings/mutate` 路径全部为字符串；
- 显式 `models` 更新保留未知字段和兄弟模型；
- **解析容量不能被反写到用户层**；
- 容量清理只移除 `contextWindow` / `maxTokens`；
- 视觉测试 PNG 完整性与可解压性。

## License

MIT
