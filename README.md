# Personal Homepage

这是一个使用 Bun 构建的个人主页项目。

## 什么是 Bun

Bun 是一个现代化的 JavaScript 运行时和工具链，它具有以下特点：

- **高性能**：使用 Zig 语言编写，比 Node.js 快 3-4 倍
- **全能工具链**：内置打包器、测试运行器、包管理器
- **兼容性**：支持 Node.js 和 npm 包的大部分功能
- **开发体验**：启动速度快，内置 TypeScript/JSX 支持
- **现代特性**：内置 .env 支持，提供 SQLite3 等 API

## 项目设置

### 前置要求

- 安装 [Bun](https://bun.sh)：

  ```bash
   curl -fsSL https://bun.sh/install | bash
  ```

- 安装依赖

  ```bash
  bun install
  ```

- 开发模式

  ```bash
  bun dev
  ```

- 构建项目

  ```bash
  bun run build
  ```

### 项目结构

```
├── src/           # 源代码目录
├── public/        # 静态资源目录
├── scripts/       # 脚本文件
├── types.d.ts     # TypeScript 类型定义
└── tsconfig.json  # TypeScript 配置
```

### 技术栈

- Bun - JavaScript 运行时和工具链
- TypeScript - 类型安全的 JavaScript 超集

##  Todo

- [x] 完成个人主页的基本功能
- [ ] 添加 sitemap

## 来源

[platane Homepage ( platane.github.io )](https://github.com/Platane/Platane.github.io)
