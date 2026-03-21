# AI求职简历助手网站 - 技术设计文档（TechDesign.md）

## 1. 文档说明

本技术设计文档基于前两阶段文档制定：
- 《RESEARCH.md》明确了项目应服务中国高校学生、应届生、实习求职者，产品应围绕“岗位理解、简历生成、岗位定制优化、内容检查到导出交付”的真实求职链路展开。fileciteturn2file1
- 《PRD.md》明确了 MVP 主链路为“建档 → 生成 → JD 定制 → 诊断 → 导出”，并要求支持版本管理、可解释修改、基础安全与 PDF/Markdown 导出。fileciteturn2file0

本阶段目标是把产品需求转化为可开发、可部署、可迭代的系统方案。

---

## 2. 技术设计目标

本阶段需要解决以下问题：

1. 采用什么技术栈最适合小团队快速实现 MVP
2. 系统整体采用什么架构
3. 前端、后端、AI 模块如何拆分
4. 数据库如何设计，才能支持母版简历与多岗位版本
5. AI 调用链路如何设计，才能支持生成、优化、诊断三类能力
6. PDF 导出与模板渲染如何实现
7. 如何保证鉴权、隐私与基础安全
8. 如何为后续迭代预留空间

---

## 3. 设计原则

### 3.1 MVP 优先原则

技术方案必须优先保证：
- 快速开发
- 易于联调
- 易于部署
- 易于排查问题
- 易于后续扩展

### 3.2 低复杂度原则

首版尽量避免：
- 过早微服务化
- 复杂消息队列依赖
- 多数据库混用
- 过多第三方组件耦合

### 3.3 AI 与业务解耦原则

AI 提示词、AI 任务编排、结构化结果校验，不直接散落在业务代码中，而应集中管理，便于：
- 修改提示词
- 调整模型
- 排查结果问题
- 做 A/B 实验

### 3.4 数据资产化原则

本产品的核心资产不是“一次生成结果”，而是用户长期维护的：
- 母版资料
- 母版简历
- 岗位版本
- 修改历史
- 导出记录

因此数据结构必须支持版本化和可追踪。

### 3.5 安全与真实性原则

技术方案必须支持以下能力：
- 用户数据隔离
- AI 输出可回滚
- 原始资料可追踪
- 重要操作留痕
- 明确标识 AI 生成内容与人工修改内容

---

## 4. 技术栈选型

## 4.1 总体建议

MVP 推荐采用：

- 前端：Next.js（React）+ TypeScript + Tailwind CSS
- 后端：Next.js Route Handlers / Server Actions 或 Node.js API 层
- 数据库：PostgreSQL
- ORM：Prisma
- 身份认证：NextAuth 或 Clerk（MVP 更推荐 NextAuth）
- AI 调用：统一封装的 LLM Service（优先 OpenAI 兼容接口）
- 富文本/差异展示：Markdown + diff 库
- PDF 导出：HTML 模板 + Playwright / Puppeteer 导出 PDF
- 对象存储：本地开发用磁盘，生产可接 S3/R2
- 部署：Vercel（前端+轻后端） + Supabase/Postgres 或 Railway/Postgres
- 日志监控：Sentry + 基础应用日志
- 埋点分析：PostHog 或 Umami

---

## 5. 系统整体架构

## 5.1 架构概览

建议采用单仓全栈架构：

1. Web 前端层
2. BFF/API 层
3. 业务服务层
4. AI 编排层
5. 数据存储层
6. 导出渲染层
7. 监控日志层

### 逻辑分层图（文字版）

用户浏览器
→ Next.js 页面层
→ API / Server Actions
→ 业务服务（ResumeService / JDService / DiagnoseService / ExportService）
→ AI Service（Prompt Registry + LLM Client + Response Parser）
→ PostgreSQL / Object Storage
→ PDF Render Worker

---

## 5.2 模块划分

### A. 前端展示层
负责：
- 首页
- 登录注册
- 工作台
- 表单建档
- 简历编辑预览
- JD 输入与优化页面
- 诊断结果展示
- 版本管理
- 导出预览

### B. API / BFF 层
负责：
- 接收前端请求
- 做鉴权
- 参数校验
- 调用业务服务
- 返回前端需要的结构化响应

### C. 业务服务层
负责：
- 用户资料管理
- 简历版本管理
- JD 解析流程
- AI 生成任务组织
- 诊断规则与结果整合
- 导出任务生成

### D. AI 编排层
负责：
- 提示词管理
- 模型调用
- 结构化输出约束
- 失败重试与降级
- 结果清洗与校验

### E. 数据层
负责：
- 用户数据存储
- 简历版本存储
- JD 分析结果存储
- 导出记录存储
- 审计日志存储

### F. 导出层
负责：
- 模板渲染
- HTML 生成
- PDF 导出
- 文件存储

---

## 6. 前端技术设计

## 6.1 页面路由建议

```text
/
/login
/register
/onboarding
/dashboard
/profile
/resumes
/resumes/[resumeId]
/resumes/[resumeId]/edit
/resumes/[resumeId]/optimize
/resumes/[resumeId]/diagnose
/resumes/[resumeId]/versions
/resumes/[resumeId]/export
/settings
```

## 6.2 前端模块拆分

### 组件层
- UI 基础组件
- 表单组件
- 编辑器组件
- 简历预览组件
- 版本对比组件
- 诊断卡片组件
- JD 解析结果组件

### 状态层
建议：
- 服务器数据：TanStack Query
- 页面局部状态：React hooks / Zustand

### 表单方案
推荐：
- React Hook Form + Zod

适用场景：
- 建档表单字段多
- 需要校验时间、必填项、长度限制
- 需要保存草稿

## 6.3 前端页面职责

### 首页
- 品牌介绍
- 产品价值展示
- CTA 按钮

### 工作台
- 最近简历
- 最近版本
- 快速生成入口
- 最近导出记录

### 建档页
- 结构化录入用户资料
- 支持新增/编辑/删除条目
- 自动保存草稿

### 编辑页
- 左侧表单编辑 / 右侧预览
- 支持局部 AI 重写
- 支持保存与版本命名

### JD 优化页
- 左侧输入 JD
- 中间显示关键词与匹配分析
- 右侧显示优化后版本和差异说明

### 诊断页
- 显示风险分类
- 显示建议列表
- 允许用户逐条应用建议

### 导出页
- 模板预览
- 选择导出格式
- 生成导出文件

---

## 7. 后端技术设计

## 7.1 API 风格建议

MVP 阶段使用 REST 风格即可，原因：
- 简单直观
- 易于前后端分工
- 文档清晰
- 后续如需要可演进为 RPC 或 GraphQL

## 7.2 API 模块划分

### Auth API
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/forgot-password

### Profile API
- GET /api/profile
- PUT /api/profile
- POST /api/profile/educations
- POST /api/profile/projects
- POST /api/profile/experiences
- POST /api/profile/skills

### Resume API
- GET /api/resumes
- POST /api/resumes
- GET /api/resumes/:id
- PUT /api/resumes/:id
- DELETE /api/resumes/:id

### Version API
- GET /api/resumes/:id/versions
- POST /api/resumes/:id/versions
- GET /api/versions/:id
- PUT /api/versions/:id
- DELETE /api/versions/:id
- GET /api/versions/:id/diff

### JD API
- POST /api/jd/parse
- POST /api/versions/:id/optimize

### Diagnose API
- POST /api/versions/:id/diagnose
- POST /api/diagnose/apply

### Export API
- POST /api/versions/:id/export/pdf
- POST /api/versions/:id/export/md
- GET /api/exports/:id

---

## 7.3 服务层建议

不要把所有逻辑都写进路由处理函数。建议拆为：

- AuthService
- ProfileService
- ResumeService
- ResumeVersionService
- JDAnalysisService
- ResumeOptimizeService
- ResumeDiagnoseService
- ExportService
- AuditLogService

这样便于：
- 单元测试
- 后期迁移独立服务
- AI 逻辑复用

---

## 8. 数据库设计

## 8.1 核心实体

MVP 阶段建议核心实体如下：

1. users
2. user_profiles
3. educations
4. projects
5. experiences
6. awards
7. skills
8. resumes
9. resume_versions
10. jd_analyses
11. diagnosis_reports
12. exports
13. audit_logs

---

## 8.2 表结构建议

### 1. users

```text
id (uuid, pk)
email (unique)
password_hash
status
created_at
updated_at
last_login_at
```

### 2. user_profiles

```text
id (uuid, pk)
user_id (fk)
full_name
phone
email
target_role
city
homepage_url
github_url
summary
created_at
updated_at
```

### 3. educations

```text
id (uuid, pk)
user_id (fk)
school_name
major
degree
start_date
end_date
gpa
ranking
created_at
updated_at
```

### 4. projects

```text
id (uuid, pk)
user_id (fk)
name
role
start_date
end_date
description_raw
tech_stack
contribution_raw
result_raw
source_type
created_at
updated_at
```

说明：
- source_type 可标识课程项目 / 比赛项目 / 毕设 / 个人项目 / 实训项目

### 5. experiences

```text
id (uuid, pk)
user_id (fk)
company_name
job_title
start_date
end_date
description_raw
result_raw
created_at
updated_at
```

### 6. awards

```text
id (uuid, pk)
user_id (fk)
title
issuer
award_date
description
created_at
updated_at
```

### 7. skills

```text
id (uuid, pk)
user_id (fk)
category
name
level
created_at
updated_at
```

### 8. resumes

```text
id (uuid, pk)
user_id (fk)
name
base_profile_snapshot (jsonb)
status
created_at
updated_at
```

说明：
- resumes 表代表“简历资产容器”
- 一份 resume 下会有多个 version
- base_profile_snapshot 用于记录生成该母版时的原始资料快照

### 9. resume_versions

```text
id (uuid, pk)
resume_id (fk)
user_id (fk)
version_name
version_type
source_version_id (nullable)
job_target_title (nullable)
job_target_company (nullable)
content_markdown
content_json (jsonb)
change_summary (jsonb)
status
created_by
created_at
updated_at
```

说明：
- version_type：master / job_targeted / manual / ai_rewrite
- content_markdown：用于导出和编辑
- content_json：用于结构化渲染和差异对比
- change_summary：记录本次优化改动摘要

### 10. jd_analyses

```text
id (uuid, pk)
user_id (fk)
resume_version_id (fk)
raw_jd_text
parsed_keywords (jsonb)
responsibilities (jsonb)
required_skills (jsonb)
match_gaps (jsonb)
model_name
created_at
```

### 11. diagnosis_reports

```text
id (uuid, pk)
user_id (fk)
resume_version_id (fk)
input_jd_analysis_id (nullable)
score_overview (jsonb)
issues (jsonb)
suggestions (jsonb)
model_name
created_at
```

### 12. exports

```text
id (uuid, pk)
user_id (fk)
resume_version_id (fk)
export_type
template_name
file_url
file_size
status
created_at
```

### 13. audit_logs

```text
id (uuid, pk)
user_id (fk)
action_type
resource_type
resource_id
payload (jsonb)
created_at
ip_address
user_agent
```

---

## 8.3 数据关系说明

```text
users 1 --- 1 user_profiles
users 1 --- n educations
users 1 --- n projects
users 1 --- n experiences
users 1 --- n awards
users 1 --- n skills
users 1 --- n resumes
resumes 1 --- n resume_versions
resume_versions 1 --- n jd_analyses
resume_versions 1 --- n diagnosis_reports
resume_versions 1 --- n exports
users 1 --- n audit_logs
```

---

## 9. AI 能力设计

## 9.1 AI 能力拆分

MVP 阶段至少拆成四类 AI 任务：

1. 结构化资料转简历初稿
2. JD 解析
3. 简历岗位定制优化
4. 简历诊断

后续可新增：
- STAR 改写
- 自我介绍生成
- 求职信生成
- 英文版翻译与优化

---

## 9.2 AI 编排原则

### 原则 1：单任务单职责

不要让一个提示词同时做：
- 解析 JD
- 判断匹配
- 生成整份简历
- 输出诊断

应拆分为多个步骤，便于控制质量。

### 原则 2：优先输出结构化 JSON

模型输出尽量先是结构化结果，再由系统渲染成页面展示内容。

例如：
- JD 解析输出 keywords / responsibilities / required_skills / gaps
- 诊断输出 issue_type / severity / evidence / suggestion

### 原则 3：模型输出必须经过校验

需要做：
- JSON schema 校验
- 必填字段检查
- 结果长度裁剪
- 非法内容过滤
- 空结果兜底

### 原则 4：可解释性优先

AI 返回结果时，尽量要求每条建议包含：
- 原因
- 建议动作
- 是否涉及事实新增

---

## 9.3 AI 服务分层

建议拆成：

### PromptRegistry
管理所有任务提示词模板

### LLMClient
统一封装模型调用

### ResponseParser
负责 JSON 解析、容错与校验

### AIOrchestrator
负责多步任务编排

### GuardrailService
负责真实性提示、夸张表达检测、敏感内容过滤

---

## 9.4 AI 任务链路设计

### 任务 A：母版简历生成

输入：
- 用户资料快照
- 选定风格（稳健版 / 校招版 / 技术版）

处理流程：
1. 读取用户资料
2. 做字段标准化
3. 拼接简历生成提示词
4. 模型输出结构化简历 JSON
5. 解析并转换为 Markdown + JSON
6. 存为 master version

输出：
- content_json
- content_markdown
- 生成摘要

### 任务 B：JD 解析

输入：
- 原始 JD 文本

处理流程：
1. 清理文本
2. 提取岗位名/职责/技能/关键词
3. 输出结构化分析结果
4. 存表 jd_analyses

输出：
- parsed_keywords
- required_skills
- responsibilities
- match_gaps（初步）

### 任务 C：岗位定制优化

输入：
- 当前简历版本
- 已解析 JD

处理流程：
1. 读取现有简历内容
2. 读取 JD 解析结构
3. 让模型给出优化建议
4. 生成新的岗位版本
5. 生成改动摘要与说明
6. 保存为新版本，不覆盖原版本

输出：
- 新版本简历
- change_summary
- 可视化差异基础数据

### 任务 D：简历诊断

输入：
- 当前简历版本
- 可选 JD 分析结果

处理流程：
1. 规则引擎做基础检查
2. LLM 做语义层面的诊断
3. 合并结果
4. 输出问题清单和建议清单
5. 存表 diagnosis_reports

输出：
- issues
- suggestions
- score_overview（仅辅助）

---

## 9.5 规则引擎 + LLM 的组合策略

简历诊断不应完全依赖 LLM。

推荐组合：

### 规则引擎负责
- 字段缺失检查
- 文本长度检查
- 联系方式格式检查
- 是否缺教育经历/项目经历
- 是否缺时间区间
- 是否疑似大段空话

### LLM 负责
- 表达是否空泛
- 结果导向是否不足
- 关键词匹配是否弱
- 项目描述是否不够岗位化
- 是否存在学生场景下更优表达方式

这样可以降低：
- 成本
- 幻觉风险
- 不稳定性

---

## 10. 简历内容模型设计

## 10.1 为什么要同时存 Markdown 和 JSON

因为两种用途不同：

### Markdown
适合：
- 人工编辑
- 存储文本版本
- 导出为 PDF
- Diff 对比

### JSON
适合：
- 模块化渲染
- 精准 diff
- 字段级检查
- 模板切换

因此建议双存：
- content_markdown
- content_json

---

## 10.2 content_json 推荐结构

```json
{
  "basic": {
    "name": "张三",
    "phone": "138xxxx",
    "email": "xxx@example.com",
    "city": "杭州",
    "targetRole": "AI应用开发实习生"
  },
  "education": [
    {
      "school": "某大学",
      "major": "虚拟现实技术",
      "degree": "本科",
      "startDate": "2023-09",
      "endDate": "2027-06"
    }
  ],
  "projects": [
    {
      "name": "AI求职简历助手网站",
      "role": "项目负责人",
      "bullets": [
        "负责产品规划与功能拆分，完成需求研究、PRD 与技术设计文档输出",
        "设计岗位定制简历生成链路，支持 JD 解析、简历优化、诊断与 PDF 导出"
      ]
    }
  ],
  "skills": ["TypeScript", "Next.js", "PostgreSQL", "Prompt Engineering"]
}
```

---

## 11. 导出设计

## 11.1 导出方式建议

推荐流程：

1. 将 resume_version.content_json 渲染为 HTML 模板
2. 应用模板 CSS
3. 用 Playwright/Puppeteer 生成 PDF
4. 将 PDF 存入对象存储
5. 返回下载链接

---

## 11.2 为什么不用纯前端导出

纯前端导出虽然简单，但问题较多：
- 浏览器差异导致排版不稳定
- 用户本地环境不可控
- 中文字体渲染差异大
- 与服务端预览一致性较差

服务端导出更适合简历场景。

---

## 11.3 模板策略

MVP 先只做 1~2 个模板：

### 模板 A：标准 ATS 模板
- 黑白简洁
- 单栏布局
- 强调信息密度和稳定排版

### 模板 B：中文校招模板
- 更适配中文阅读顺序
- 教育/项目模块突出

首版目标不是模板多，而是模板稳。

---

## 12. 版本管理设计

## 12.1 版本来源关系

每个新版本都应记录：
- 来源版本 source_version_id
- 创建方式 created_by（manual / ai_generate / ai_optimize / ai_diagnose_apply）
- 改动摘要 change_summary

这样可以支持：
- 回滚
- 溯源
- Diff 展示
- 运营分析

## 12.2 Diff 设计

推荐两层 diff：

### 文本级 diff
用于展示 Markdown 改动

### 字段级 diff
用于展示：
- 哪一段项目经历被改写
- 哪些技能关键词被新增
- 哪些描述被精简

字段级 diff 更适合产品展示“为什么这样改”。

---

## 13. 鉴权与安全设计

## 13.1 鉴权方案

推荐：
- Session / JWT 均可
- 若使用 NextAuth，首版优先 session + httpOnly cookie

要求：
- 所有私人接口必须校验 user_id
- 数据查询必须带用户隔离条件
- 导出文件下载也必须做权限校验

---

## 13.2 数据安全要求

### 必做
- 密码哈希存储
- 敏感接口鉴权
- 数据库最小权限访问
- 服务端校验输入
- 防止越权访问

### 推荐
- 手机号等字段脱敏展示
- 文件 URL 设置有效期
- 审计关键操作

---

## 13.3 AI 安全与真实性控制

首版至少要做：
- 在生成页显示真实性提醒
- 在优化页标注“表达优化不等于事实新增”
- 对夸张表述做简单规则拦截
- 用户覆盖保存前提示确认

---

## 13.4 常见安全风险与防护

### 风险 1：越权访问他人简历
防护：
- 所有查询带 user_id
- 路由层和服务层双校验

### 风险 2：Prompt Injection via JD
防护：
- JD 文本只作为数据输入
- 系统提示中明确忽略 JD 中的指令性内容
- 限制最大长度并做清洗

### 风险 3：恶意超长输入导致成本和性能问题
防护：
- 长度限制
- 分段摘要
- 请求频率限制

### 风险 4：导出链接泄露
防护：
- 私有存储
- 临时签名 URL
- 访问鉴权

---

## 14. 日志、监控与埋点设计

## 14.1 应用日志

建议记录：
- 请求 ID
- user_id
- 接口耗时
- AI 调用任务类型
- AI 调用成功/失败
- 导出成功/失败

注意：
- 不记录明文密码
- 不在普通日志中完整打印用户简历内容

## 14.2 错误监控

建议接入 Sentry，监控：
- 前端页面异常
- 接口异常
- AI 解析异常
- PDF 导出失败

## 14.3 埋点设计落地

与 PRD 对齐，至少埋点：
- register_success
- onboarding_completed
- resume_generate_clicked
- resume_generate_success
- jd_parse_success
- resume_optimize_success
- diagnose_success
- export_pdf_success
- version_created

---

## 15. 性能设计

## 15.1 首版性能目标

建议目标：
- 首页首屏可接受
- 工作台数据加载 < 2 秒（常规条件下）
- AI 任务提供明确 loading 状态
- 导出任务可在合理时间内返回结果

## 15.2 AI 接口性能策略

可采用：
- 任务拆分
- 超时控制
- 失败重试一次
- 结果缓存（对 JD 解析可缓存）

## 15.3 后续优化点

后续如用户量增加，可逐步加入：
- Redis 缓存
- 队列异步导出
- 独立 AI worker
- 独立导出 worker

但 MVP 不必须。

---

## 16. 部署方案

## 16.1 开发环境

- 前端 + API：本地 Next.js
- 数据库：本地 PostgreSQL / Docker PostgreSQL
- 文件存储：本地磁盘
- 环境变量：.env.local

## 16.2 生产环境推荐方案 A（最省事）

- 前端/接口：Vercel
- 数据库：Supabase Postgres / Neon Postgres
- 文件存储：Cloudflare R2 / Supabase Storage
- 监控：Sentry
- 埋点：PostHog

适合：
- 小团队
- 快速上线
- 低运维成本

## 16.3 生产环境推荐方案 B（更统一）

- 应用：Railway / Render
- 数据库：Railway Postgres / Managed Postgres
- 对象存储：S3/R2

适合：
- 需要更灵活服务端执行环境
- 需要长时间 PDF 导出任务

---

## 17. 目录结构建议

```text
/apps
  /web
    /src
      /app
      /components
      /features
        /auth
        /profile
        /resume
        /jd
        /diagnosis
        /export
      /lib
      /services
      /stores
      /types
      /utils
/packages
  /ai
    /prompts
    /schemas
    /parsers
    /orchestrators
  /shared
    /types
    /constants
    /validators
```

如果当前团队规模小，也可以先不做 monorepo，只保留单仓目录：

```text
/src
  /app
  /components
  /features
  /lib
  /services
  /types
  /utils
  /ai
    /prompts
    /schemas
    /parsers
    /orchestrators
```

---

## 18. 开发阶段划分建议

## 18.1 第 5 阶段实现顺序建议

### 里程碑 1：脚手架与基础设施
- 初始化 Next.js + TS + Tailwind
- 接入 Prisma + PostgreSQL
- 完成认证基础能力
- 初始化页面路由

### 里程碑 2：用户建档与数据模型
- 完成 profile / education / project / skill 的 CRUD
- 完成工作台与建档页
- 完成基础校验

### 里程碑 3：母版简历生成
- 接入 AI 服务
- 完成母版简历生成
- 完成编辑与保存
- 完成 resume_versions 存储

### 里程碑 4：JD 解析与岗位优化
- 完成 JD 输入与解析
- 完成岗位版本生成
- 完成差异展示

### 里程碑 5：简历诊断
- 完成规则引擎基础检查
- 完成 LLM 诊断建议
- 完成建议展示

### 里程碑 6：导出与版本管理
- 完成 PDF/Markdown 导出
- 完成版本列表与回滚
- 完成导出记录

### 里程碑 7：监控、埋点与收尾
- 接入 Sentry
- 接入埋点
- 完成基础权限与审计日志
- 做一轮体验优化

---

## 19. 风险点与技术应对

## 19.1 风险：AI 输出结构不稳定

应对：
- 使用 JSON schema
- 解析失败自动重试
- 必要时降级为文本结果
- 对关键任务做模板兜底

## 19.2 风险：PDF 导出排版错乱

应对：
- 控制模板数量
- 固定字体与页面尺寸
- 单独做打印样式 CSS
- 先保证单模板稳定

## 19.3 风险：JD 优化结果夸张失真

应对：
- change_summary 明确展示修改类型
- Guardrail 检查夸大词
- 默认保存为新版本，不覆盖原版

## 19.4 风险：后期需求膨胀导致代码混乱

应对：
- 业务模块化
- AI 模块独立目录
- 数据模型先按版本化设计
- 提前区分“本期做”和“后续再做”

---

## 20. 当前阶段结论

本项目在技术上最合理的 MVP 路线是：

> **采用 Next.js + TypeScript + PostgreSQL + Prisma 的单仓全栈方案，以版本化数据模型承载简历资产，以 AI 编排层承载生成/优化/诊断能力，以 HTML 模板转 PDF 完成交付。**

这个方案的优点是：
- 开发速度快
- 技术复杂度可控
- 与产品主链路高度匹配
- 便于第 5 阶段真正落地实现
- 未来也能平滑升级

---

## 21. 为 AGENTS.md 提供的输入

下一阶段《AGENTS.md》需要基于本技术设计继续明确：

1. AI 系统角色定义
2. 各类任务提示词结构
3. JSON 输出格式约束
4. 真实性与安全约束指令
5. 局部改写、整份生成、诊断、JD 解析的分工规则
6. 失败重试与降级策略
7. 评估与人工校验规则

---

## 22. 下一阶段建议

下一步进入第 4 阶段：AI 代理指令文档《AGENTS.md》。该文档将把本阶段定义的 AI 编排结构，进一步细化为可直接供实现阶段调用的代理指令体系。
