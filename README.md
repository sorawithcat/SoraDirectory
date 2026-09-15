# SoraDirectory

本地优先的目录化内容编辑器与离线网页生成工具。支持方法交互、关系与字段、可复用内容、受控组件、Markdown/Obsidian 互操作，以及单 HTML、静态目录和可选 PWA 发布。

## 验证

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:browser
```

`test:browser` 会启动隔离的本地服务和 Edge/Chromium 无头实例，分别运行桌面与 320px 移动回归；失败时在 `.artifacts/browser-e2e` 保留 DOM、截图和控制台信息。

## 项目文档

- [优化规划](docs/优化规划.md)
- [优化验收记录](docs/优化验收记录.md)
- [二次优化与扩展审计](docs/二次优化与扩展审计-2026-09-15.md)
