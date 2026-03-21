import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { ProfileBuilder } from "@/features/profile/components/profile-builder";
import { profileService } from "@/services/profile-service";

export default async function ProfilePage() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const snapshot = await profileService.getProfileSnapshot(session.user.id);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Profile"
        title="资料建档"
        description="这里会把基础信息、教育、项目、实习、奖项和技能真实保存到数据库，为母版简历生成和后续 JD 定制提供可靠输入。"
      />
      <ProfileBuilder initialSnapshot={snapshot} />
    </div>
  );
}
