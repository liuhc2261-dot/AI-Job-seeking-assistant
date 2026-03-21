import Link from "next/link";

import { getAuthSession } from "@/auth";
import { SectionCard } from "@/components/section-card";
import { SiteHeader } from "@/components/site-header";

const productPillars = [
  {
    title: "建档资产化",
    description: "先沉淀母版资料，再驱动简历生成、优化和版本管理。",
  },
  {
    title: "岗位导向优化",
    description: "围绕 JD 关键词、职责和匹配差距做定制，而不是泛化改写。",
  },
  {
    title: "可解释与可回滚",
    description: "所有优化默认产生新版本，保留来源、改动说明和后续 diff 能力。",
  },
  {
    title: "稳定导出交付",
    description: "以 Markdown + JSON 双存为基础，为 HTML 转 PDF 铺好路。",
  },
];

const workflow = [
  "建档",
  "母版生成",
  "JD 定制",
  "简历诊断",
  "版本管理",
  "PDF/Markdown 导出",
];

export default async function HomePage() {
  const session = await getAuthSession();

  return (
    <div className="pb-12">
      <SiteHeader authenticated={Boolean(session?.user)} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <SectionCard
            eyebrow="MVP 初始化"
            title="岗位导向型 AI 求职简历助手"
            description="严格按照 PRD、TechDesign 和 AGENTS 约束初始化的单仓全栈项目骨架。当前重点放在里程碑 1：脚手架、认证基础、Prisma 数据模型和基础路由。"
            className="overflow-hidden"
          >
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {workflow.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[color:var(--border)] bg-white/70 px-3 py-2 text-sm text-[color:var(--muted)]"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={session?.user ? "/dashboard" : "/register"}
                  className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
                >
                  {session?.user ? "进入工作台" : "创建账号并开始"}
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                >
                  查看认证入口
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Tech Stack"
            title="Next.js + Prisma + NextAuth"
            description="技术选型完全对齐 TechDesign 的默认推荐路线，并预留 AI 编排、版本化数据与服务层边界。"
          >
            <ul className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
              <li>前端：Next.js 16 / React 19 / TypeScript / Tailwind CSS 4</li>
              <li>后端：App Router Route Handlers + Server Actions</li>
              <li>数据层：PostgreSQL + Prisma，核心实体一次性建模</li>
              <li>认证：NextAuth Credentials 模式，后续可继续扩展邮箱找回等流程</li>
            </ul>
          </SectionCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {productPillars.map((pillar) => (
            <SectionCard
              key={pillar.title}
              title={pillar.title}
              description={pillar.description}
              className="h-full"
            >
              <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--accent-strong)]">
                这部分在初始化阶段已经预留目录、字段或路由骨架，后续里程碑可以直接继续实现。
              </div>
            </SectionCard>
          ))}
        </section>
      </main>
    </div>
  );
}
