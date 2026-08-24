# dsh-plugin-text-quote

Codex-style text annotation for DeepSeek Harness conversations. Select any text in the chat, add a quote with your comment, and it becomes an annotation card in the composer. On send, the annotation is injected into the message and rendered back as an expandable "N 条注释" pill.

对话文字批注插件（Codex 风格）：在对话里选中任意文本，添加引用与评论，形成输入侧的批注卡片；发送时批注随消息注入，发送后以「N 条注释」胶囊展开查看。

## Features / 功能

- **选区注释**：选中对话文本后弹出菜单 → 「添加到对话」打开批注框，保存所选原文 + 用户评论
- **输入侧批注坞**：批注列表显示在输入框左侧，可展开查看、编辑、删除
- **引用注入**：发送时自动把批注块（`<!-- dsh-annotations -->`）注入消息，模型可见
- **发送后胶囊**：已发送消息中的批注块被折叠为「N 条注释」胶囊，点击展开原文与评论
- **快捷键**：批注框内 **Enter = 保存**，**Shift+Enter = 换行**（Ctrl/Cmd+Enter 亦保存）
- 全本地运行，无遥测，无外部请求

## Install / 安装

```bash
dsh plugin --profile web add dsh-plugin-text-quote
```

或从市场（设置 → 插件市场）搜索 `dsh-plugin-text-quote` 一键安装。

## Usage / 用法

1. 在对话中拖动选择一段文本
2. 点击弹出的「添加到对话」
3. 在批注框输入评论（Enter 保存，Shift+Enter 换行）
4. 发送消息：批注块自动注入，消息以「N 条注释」胶囊展示，点击可展开

## Compatibility / 兼容性

- DeepSeek Harness Web（dsh web），客户端插件（`dsh.client.platform = web`）
- 依赖宿主提供 `@deepseek-ai/dsh-client-ui-slots`

## License

MIT © sunnystarye-ui
