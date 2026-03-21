# AI 求职简历助手

面向中国高校学生、应届生和实习求职者的岗位导向型 AI 求职简历助手。

当前仓库已经完成 MVP 主链路，并补齐了里程碑 7 的监控与收尾能力：

- 里程碑 1：Next.js 16 + TypeScript + Tailwind CSS 4 基础设施
- 里程碑 2：资料建档与 Profile Snapshot
- 里程碑 3：AI 母版简历生成、编辑与预览
- 里程碑 4：JD 解析、岗位定制优化与差异展示
- 里程碑 5：简历诊断、建议应用与真实性守卫
- 里程碑 6：版本管理、Markdown / PDF 导出与导出历史
- 里程碑 7：Sentry、PostHog、请求日志、审计日志与集成自检

## 当前能力

- Next.js 16 + TypeScript + Tailwind CSS 4
- App Router 工作台与 API 路由
- Prisma + PostgreSQL 数据模型与版本化资产
- NextAuth Credentials 认证、注册、忘记密码、重置密码
- `src/features` / `src/services` / `src/ai` 分层目录
- 建档、母版生成、JD 优化、诊断、版本管理、导出等核心页面
- Sentry、PostHog、请求日志、`x-request-id` 与集成检查脚本

## 开始开发

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```powershell
Copy-Item .env.example .env.local
```

3. 生成 Prisma Client

```bash
npm run db:generate
```

4. 初始化数据库

```bash
npm run db:migrate -- --name init
```

5. 启动开发服务器

```bash
npm run dev
```

6. 可选：检查关键集成是否就绪

```bash
npm run verify:integrations
```

## 目录结构

```text
src
  app
  components
  features
    auth
    profile
    resume
    jd
    diagnosis
    export
  lib
  services
  types
  utils
  ai
    prompts
    schemas
    parsers
    orchestrators
prisma
```

## 对齐文档

- 功能范围：`PRD.md`
- 技术方案：`TechDesign.md`
- 实现规则：`AGENTS.md`
- 用户定位与非目标：`RESEARCH.md`

## 监控与收尾

- API 路由会返回并记录 `x-request-id`
- 关键业务动作会写入 `audit_logs`
- 已接入 Sentry 与 PostHog 基础埋点
- `scripts/verify-integrations.mjs` 可检查 OpenAI、Sentry、PostHog 和 PDF 浏览器依赖
