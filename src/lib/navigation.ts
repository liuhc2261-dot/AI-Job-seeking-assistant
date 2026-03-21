export type NavItem = {
  href: string;
  label: string;
};

export const publicNav: NavItem[] = [
  { href: "/", label: "产品首页" },
  { href: "/login", label: "登录" },
  { href: "/register", label: "注册" },
];

export const workspaceNav: NavItem[] = [
  { href: "/dashboard", label: "工作台" },
  { href: "/onboarding", label: "新手引导" },
  { href: "/profile", label: "资料建档" },
  { href: "/resumes", label: "简历中心" },
  { href: "/settings", label: "设置" },
];

