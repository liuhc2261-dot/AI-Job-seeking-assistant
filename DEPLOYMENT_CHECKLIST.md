# 当前状态版部署清单

这份清单用于当前仓库的首次内测上线，不再假设项目是从 0 开始搭建。

## 1. 仓库内已完成

- [x] Next.js + TypeScript + Tailwind 基础设施
- [x] Prisma schema 与核心数据表设计
- [x] NextAuth 认证与受保护工作台
- [x] 用户建档 CRUD
- [x] 母版简历生成、编辑与预览
- [x] JD 解析、岗位优化与版本化保存
- [x] 简历诊断、建议应用与审计日志
- [x] Markdown / PDF 导出与导出历史
- [x] GitHub 远端仓库已存在
- [x] Prisma Migrate 初始基线已提交到 `prisma/migrations`
- [x] 本地 `npm test`、`npm run build`、`npm run lint` 可通过

## 2. 首次上线前还需要做

- [ ] 新建一个干净的 Neon PostgreSQL 数据库
- [ ] 准备 `DATABASE_URL`
- [ ] 准备 `AUTH_SECRET`
- [ ] 在 Railway 导入 GitHub 仓库
- [ ] 使用根目录 `Dockerfile` 触发首次部署
- [ ] 在 Railway 配置最小必需环境变量
- [ ] 对目标数据库执行 `npm run db:deploy`

## 3. Railway 最小环境变量

```env
DATABASE_URL=你的 Neon 连接串
AUTH_SECRET=你的随机密钥
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL=https://你的-railway-域名
```

下面这些可以在首发后补：

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_POSTHOG_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## 4. 线上手工验收

- [ ] 能访问首页、注册页、登录页
- [ ] 能完成建档
- [ ] 能生成母版简历
- [ ] 能生成诊断结果
- [ ] 能导出 Markdown
- [ ] 能导出 PDF
- [ ] 能解析 JD 并生成岗位定制版
- [ ] 能保存新版本并再次导出 PDF
- [ ] 第二个账号无法访问第一个账号的数据

## 5. 当前默认决策

- [x] 首发平台使用 Railway，Render 作为备选
- [x] 首发数据库使用 Neon
- [x] 首发阶段不以 Vercel 作为完整 MVP 部署方案
- [x] 首发允许暂时不接 OpenAI、Sentry、PostHog
- [x] 当前 PDF 仍写入容器内 `.tmp/exports`
- [ ] 上线后把 PDF 存储迁移到 R2 或 S3
