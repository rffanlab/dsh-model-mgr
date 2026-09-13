# dsh-model-mgr

中文 | [English](README.en.md)

给 DeepSeek Harness 的原生模型配置补一个轻量 GUI：**按模型**管理输入模态、Context Window、Max Tokens，并直接验证文本与视觉通路。

> “文本 + 图片”只是向 DSH 声明这个模型/端点接受图片输入，不会让原本不支持视觉的模型或推理服务凭空获得 Vision。

## 当前版本

当前版本：**0.1.6**。

0.1.6 开始，插件**不再修改或扩展「设置 → 模型」页面**。原生模型页面完全交还给 DeepSeek Harness；所有 `dsh-model-mgr` 配置统一放在：

```text
设置
→ 插件
→ 模型能力
```

这样安装插件以后，原生 Provider 卡片、编辑按钮、模型目录等界面都保持 DSH 默认样式，不再出现 `模型能力 · dsh-model-mgr` 的嵌入块。

## 功能

- 只在 **设置 → 插件 → 模型能力** 提供管理界面；
- 按模型配置 `继承 / 纯文本 / 文本 + 图片`；
- 按模型配置 `Context Window` 与 `Max Tokens`；
- Provider 与模型行均默认收起；
- 文本连通性测试；
- 视觉通路测试；
- 视觉失败区分 DSH 图片准入层、Provider/推理服务层、模型识别层；
- 只读写 DSH 原生 `llm-pi-ai` settings，不创建第二份配置；
- API Key 不进入插件前端。

## 安装 / 更新

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

## 使用

打开：

```text
设置
→ 插件
→ 模型能力
```

页面会列出当前 `llm-pi-ai.providers.*` Provider。每个 Provider 默认收起，展开后再按模型进行配置。

### 单模型输入能力

| UI | 原生 DSH 写入语义 |
|---|---|
| 继承 DSH 默认/目录 | 清除模型自己的 `input` |
| 纯文本 | `input: [text]` |
| 多模态（文本 + 图片） | `input: [text, image]` |

插件不会根据 `Qwen-VL`、`Vision` 等名字自动猜能力。

### 显式 models Provider

DSH 的 settings wire path 只允许 `string[]`，不能把数组下标作为 path 段发送。因此对于自定义 Provider 的显式 `models` 数组，插件会复制完整数组、只修改目标模型并保留其他未知字段，然后一次性写回 `models`：

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

这样不会丢失该模型的 `compat`、reasoning 等插件未编辑字段，也不会影响其他模型行。

### Catalog Provider

使用内置 catalog 的 Provider 继续采用最小覆盖：

```yaml
llm-pi-ai:
  providers:
    nvidia:
      modelOverrides:
        vision-model:
          input: [text, image]
```

## Provider 默认能力

插件不提供 Provider 级 `defaultInput` 编辑器。

DSH 的 `defaultInput` 本身是 fallback；这个插件只负责按模型声明能力，避免把整个 Provider 一次性改成多模态。

如果旧版本留下：

```yaml
defaultInput: [text, image]
```

插件页会显示“清除系列级多模态默认”按钮，由用户明确清理，不会自动修改。

## 文本测试

点击 **测试文本** 后，插件通过当前 DSH `ctx.llm` 路由请求模型只回复：

```text
MODEL_OK
```

用于确认 Provider / Model 路由是否可用。

## 视觉测试

点击 **测试视觉** 后：

1. 先确认 DSH 当前把该模型解析为支持 `image` 输入；
2. 使用插件运行时生成的合法 PNG 测试图；
3. 图片内容包含 `VISION_427`；
4. 图片通过当前 Harness attachment 服务准入；
5. 再经当前 DSH LLM 路由发送给目标模型；
6. 根据结果区分 DSH、Provider 和模型识别三层问题。

视觉测试兼容 attachment API：

```text
admitPromptContent() → saveImages() → saveImage()
```

CI 会解析 PNG chunk 并解压 IDAT 数据，防止损坏测试图再次进入版本。

## 安全边界

- 不在前端读取、保存或展示 API Key；
- 不读取 `.credentials.yaml` 明文；
- 测试请求复用 DSH 当前 Provider / credential 通路；
- 不自动扫描并测试所有 Provider；
- 不按模型名自动开启多模态；
- 不自动上传用户本地图片；
- 所有模型能力修改都需要用户明确保存。

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

- Web bundle 只能注册 `settings.plugins.tab`，禁止再次注入 `settings.models.provider-card`；
- Provider / 模型默认收起；
- 单模型配置；
- `settings/mutate` 路径必须全部是字符串；
- 显式 `models` 更新保留未知字段和其他模型；
- 视觉测试 PNG 完整性与可解压性。

## License

MIT
