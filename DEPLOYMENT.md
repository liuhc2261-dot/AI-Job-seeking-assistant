# 部署说明

这份说明面向第一次部署网站的开发者，目标是让当前项目以最少折腾的方式上线。

## 推荐方案

当前仓库最适合你的首个上线方案是：

- 应用：Railway 或 Render，使用仓库根目录的 `Dockerfile`
- 数据库：Neon PostgreSQL
- 域名：先用平台赠送域名，后续再绑定自己的域名

这样选的原因很简单：

- 当前项目的 PDF 导出依赖服务端浏览器内核
- 当前项目会把导出的 PDF 临时写到本地文件系统
- Docker 容器更容易安装 Chromium 和中文字体

如果只是想做“最快预览”，Vercel 也能部署 Next.js 本体；但以当前代码形态来看，Vercel 不是最适合你的第一套“完整 MVP 部署”方案。

## 当前上线前提

部署前，你至少要准备好这些变量：

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `NEXT_PUBLIC_APP_URL`

下面这些是可选的：

- `OPENAI_API_KEY`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

容器里已经默认设置了：

- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`

## 第 1 步：准备数据库

推荐使用 Neon。

你要做的事：

1. 注册 Neon
2. 创建一个 Postgres 数据库
3. 在控制台点击 `Connect`
4. 复制连接串
5. 把它填到部署平台的 `DATABASE_URL`

建议优先使用带 `-pooler` 的连接串。

## 第 2 步：准备密钥

生成 `AUTH_SECRET`：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

然后把生成结果填到部署平台的 `AUTH_SECRET`。

## 第 3 步：部署到 Railway

最适合你现在阶段的做法是把仓库推到 GitHub，然后在 Railway 里直接连仓库部署。

操作顺序：

1. 把当前仓库推到 GitHub
2. 在 Railway 创建新项目
3. 选择你的 GitHub 仓库
4. Railway 会自动识别根目录的 `Dockerfile`
5. 在 `Variables` 页面粘贴环境变量
6. 触发第一次部署

建议填这些变量：

```env
DATABASE_URL=你的 Neon 连接串
AUTH_SECRET=你的随机密钥
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL=https://你的 Railway 域名
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_POSTHOG_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## 第 4 步：初始化生产数据库

第一次部署完成后，还需要把 Prisma 的表结构同步到线上数据库。

你可以在本地执行：

```bash
npm run db:push
```

前提是你本地当前的 `DATABASE_URL` 指向的就是线上数据库。

如果你不想改本地 `.env.local`，也可以临时新建一个 `.env.production.local` 或直接在终端里设置环境变量后再执行。

## 第 5 步：上线后手工验收

至少走一遍这条链路：

1. 注册
2. 登录
3. 建档
4. 生成母版
5. 诊断
6. 导出 Markdown
7. 导出 PDF

如果你还没配置 `OPENAI_API_KEY`，生成/优化/诊断会走 fallback 规则模式，这是正常的。

## 当前已知限制

这部分很重要，先说明白：

1. 当前 PDF 文件会写到容器内的 `.tmp/exports`
2. 如果平台重启实例或重新部署，历史 PDF 文件可能丢失
3. Markdown 导出不受这个问题影响，因为它直接来自数据库内容

所以当前版本适合：

- 内测
- 演示
- 小范围试运行

如果你要做更稳的正式上线，下一步应该把 PDF 文件从本地磁盘迁移到对象存储，例如 R2 或 S3。

## Render 备选方案

如果你更喜欢 Render，也可以直接使用同一个 `Dockerfile`。

适合 Render 的原因：

- 支持用 Dockerfile 构建
- 可以保留 OS 级依赖
- 适合安装 Chromium 这类运行时包

## 我建议你的上线顺序

1. 先把首页和主流程再手工走一遍
2. 推到 GitHub
3. 先上 Railway
4. 用 Neon 作为数据库
5. 暂时不接 OpenAI、Sentry、PostHog
6. 上线成功后再补对象存储和监控
