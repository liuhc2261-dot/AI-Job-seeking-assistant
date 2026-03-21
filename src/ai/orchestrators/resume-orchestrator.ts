import { promptRegistry } from "@/ai/prompts";
import { diagnosisSchema, jdAnalysisSchema, resumeContentSchema } from "@/ai/schemas";

export const resumeOrchestratorBlueprint = {
  generateMasterResume: {
    prompt: promptRegistry.resumeGenerator,
    schema: resumeContentSchema,
  },
  parseJobDescription: {
    prompt: promptRegistry.jdParser,
    schema: jdAnalysisSchema,
  },
  diagnoseResume: {
    prompt: promptRegistry.resumeDiagnoser,
    schema: diagnosisSchema,
  },
};
