import { AgentFunction, AgentFunctionInfo } from "graphai";
export declare const pushAgent: AgentFunction<null, {
    array: Array<unknown>;
}, null, {
    array: Array<unknown>;
    item?: unknown;
    items: Array<unknown>;
}>;
declare const pushAgentInfo: AgentFunctionInfo;
export default pushAgentInfo;
