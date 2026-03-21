# AI 求职简历助手

面向中国高校学生、应届生和实习求职者的岗位导向型 AI 求职简历助手。当前仓库已完成里程碑 1 初始化骨架：

- Next.js 16 + TypeScript + Tailwind CSS 4
- App Router 路由骨架
- Prisma + PostgreSQL 数据模型
- NextAuth Credentials 认证基础能力
- `src/features` / `src/services` / `src/ai` 分层目录
- 首页、登录、注册、工作台、建档、简历与设置等基础页面

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
