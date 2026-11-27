import { z } from 'zod';
import { PatentStage } from '../constants/stages.constants.js';

export interface PatentStageHistoryDto {
  id: string;
  patentApplicationId: string;
  stage: PatentStage;
  transitionedBy: string;
  comments: string;
  createdAt: string;
}

export interface PatentApplicationDto {
  id: string;
  disclosureId: string;
  assignedLegalOfficerId: string | null;
  applicationNumber: string | null;
  currentStage: PatentStage;
  currentStageHistoryId: string | null;
  filingDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CreatePatentApplicationSchema = z.object({
  disclosureId: z.string().uuid(),
  assignedLegalOfficerId: z.string().uuid().optional()
}).strict();

export type CreatePatentApplicationDto = z.infer<typeof CreatePatentApplicationSchema>;

export const RecordPatentStageTransitionSchema = z.object({
  toStage: z.string().min(1).max(50),
  transitionReason: z.string().min(1).max(2000)
}).strict();

export type RecordPatentStageTransitionInputDto = z.infer<typeof RecordPatentStageTransitionSchema>;

export interface TransitionPatentStageDto {
  newStage: PatentStage;
  comments: string;
}
