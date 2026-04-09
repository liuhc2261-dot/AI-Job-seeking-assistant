export type NavItem = {
  href: string;
  label: string;
  description?: string;
  matchPrefixes?: string[];
  section?: "workflow" | "system";
};

export const publicNav: NavItem[] = [
  { href: "/#workflow", label: "使用流程" },
  { href: "/#scenarios", label: "适合谁用" },
  { href: "/#pricing", label: "套餐说明" },
];

export const workspaceNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "工作台",
    description: "查看当前进度、下一步动作和最近简历资产。",
    section: "workflow",
  },
  {
    href: "/onboarding",
    label: "新手引导",
    description: "先看主流程和建档准备项，再开始填写资料。",
    section: "workflow",
  },
  {
    href: "/profile",
    label: "资料建档",
    description: "沉淀基础信息、教育、项目、实习、奖项和技能。",
    section: "workflow",
  },
  {
    href: "/resumes",
    label: "简历中心",
    description: "生成母版、做 JD 定制、管理版本并继续导出。",
    matchPrefixes: ["/resumes"],
    section: "workflow",
  },
  {
    href: "/billing",
    label: "套餐中心",
    description: "查看试用额度、升级权益和订单状态。",
    section: "system",
  },
  {
    href: "/settings",
    label: "系统设置",
    description: "检查环境配置、账号信息和系统可用性。",
    section: "system",
  },
];

export const workspaceFlow = [
  "建档",
  "生成母版",
  "JD 定制",
  "简历诊断",
  "版本管理",
  "导出投递",
] as const;
