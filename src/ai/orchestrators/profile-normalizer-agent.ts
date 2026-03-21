import type { ProfileSnapshot } from "@/types/profile";

function cleanText(value: string | undefined | null) {
  return value?.trim() ?? "";
}

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function splitRawTextToBullets(value: string) {
  return uniqueValues(
    value
      .split(/\r?\n|[，；]+|(?<=[。！？?!])\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  ).slice(0, 5);
}

export type NormalizedProfileSnapshot = {
  basic: {
    fullName: string;
    phone: string;
    email: string;
    targetRole: string;
    city: string;
    homepageUrl: string;
    githubUrl: string;
    summary: string;
  };
  educations: Array<{
    schoolName: string;
    major: string;
    degree: string;
    startDate: string;
    endDate: string;
    highlights: string[];
  }>;
  projects: Array<{
    name: string;
    role: string;
    startDate: string;
    endDate: string;
    techStack: string[];
    sourceType: string;
    bullets: string[];
  }>;
  experiences: Array<{
    companyName: string;
    jobTitle: string;
    startDate: string;
    endDate: string;
    bullets: string[];
  }>;
  awards: Array<{
    title: string;
    issuer: string;
    awardDate: string;
    description: string;
  }>;
  skills: Array<{
    category: string;
    name: string;
    level: string;
  }>;
  completion: ProfileSnapshot["completion"];
};

class ProfileNormalizerAgent {
  normalize(snapshot: ProfileSnapshot): NormalizedProfileSnapshot {
    return {
      basic: {
        fullName: cleanText(snapshot.profile.fullName),
        phone: cleanText(snapshot.profile.phone),
        email: cleanText(snapshot.profile.email),
        targetRole: cleanText(snapshot.profile.targetRole),
        city: cleanText(snapshot.profile.city),
        homepageUrl: cleanText(snapshot.profile.homepageUrl),
        githubUrl: cleanText(snapshot.profile.githubUrl),
        summary: cleanText(snapshot.profile.summary),
      },
      educations: snapshot.educations.map((education) => {
        const highlights = uniqueValues([
          education.gpa ? `GPA：${cleanText(education.gpa)}` : "",
          education.ranking ? `排名：${cleanText(education.ranking)}` : "",
        ]);

        return {
          schoolName: cleanText(education.schoolName),
          major: cleanText(education.major),
          degree: cleanText(education.degree),
          startDate: cleanText(education.startDate),
          endDate: cleanText(education.endDate),
          highlights,
        };
      }),
      projects: snapshot.projects.map((project) => {
        const bullets = uniqueValues([
          ...splitRawTextToBullets(project.descriptionRaw),
          ...splitRawTextToBullets(project.contributionRaw),
          ...splitRawTextToBullets(project.resultRaw),
        ]);
        const techStack = uniqueValues(
          project.techStack
            .split(/[、,]/)
            .map((entry) => entry.trim())
            .filter(Boolean),
        );

        return {
          name: cleanText(project.name),
          role: cleanText(project.role),
          startDate: cleanText(project.startDate),
          endDate: cleanText(project.endDate),
          techStack,
          sourceType: cleanText(project.sourceType),
          bullets,
        };
      }),
      experiences: snapshot.experiences.map((experience) => ({
        companyName: cleanText(experience.companyName),
        jobTitle: cleanText(experience.jobTitle),
        startDate: cleanText(experience.startDate),
        endDate: cleanText(experience.endDate),
        bullets: uniqueValues([
          ...splitRawTextToBullets(experience.descriptionRaw),
          ...splitRawTextToBullets(experience.resultRaw),
        ]),
      })),
      awards: snapshot.awards.map((award) => ({
        title: cleanText(award.title),
        issuer: cleanText(award.issuer),
        awardDate: cleanText(award.awardDate),
        description: cleanText(award.description),
      })),
      skills: snapshot.skills.map((skill) => ({
        category: cleanText(skill.category),
        name: cleanText(skill.name),
        level: cleanText(skill.level),
      })),
      completion: snapshot.completion,
    };
  }
}

export const profileNormalizerAgent = new ProfileNormalizerAgent();
