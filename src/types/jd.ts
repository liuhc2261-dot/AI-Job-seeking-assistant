export type JDAnalysisRecord = {
  id: string;
  resumeVersionId: string;
  rawJdText: string;
  jobTitle: string;
  companyName: string;
  parsedKeywords: string[];
  responsibilities: string[];
  requiredSkills: string[];
  matchGaps: string[];
  modelName: string | null;
  createdAt: string;
};

export type ResumeDiffChangeKind = "added" | "removed" | "updated";

export type ResumeDiffSection = {
  id: string;
  section: string;
  title: string;
  changeKind: ResumeDiffChangeKind;
  before: string[];
  after: string[];
};
