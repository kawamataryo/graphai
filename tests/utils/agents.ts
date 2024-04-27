import { AgentFunctionDictonary } from "@/graphai";
import {
  sleeperAgent,
  sleeperAgentDebug,
  stringTemplateAgent,
  nestedAgent,
  mapAgent,
  totalAgent,
  bypassAgent,
  echoAgent,
  copyMessageAgent,
  mergeNodeIdAgent,
  countingAgent,
  copy2ArrayAgent,
  pushAgent,
  popAgent,
} from "@/experimental_agents";

export const defaultTestAgents: AgentFunctionDictonary = {
  bypassAgent,
  echoAgent,
  copyMessageAgent,
  mergeNodeIdAgent,
  sleeperAgent,
  sleeperAgentDebug,
  stringTemplateAgent,
  nestedAgent,
  mapAgent,
  totalAgent,
  countingAgent,
  copy2ArrayAgent,
  pushAgent,
  popAgent,
};
