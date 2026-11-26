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
  assignedLegalOfficerId: string;
  applicationNumber: string | null;
  currentStage: PatentStage;
  currentStageHistoryId: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransitionPatentStageDto {
  newStage: PatentStage;
  comments: string;
}
