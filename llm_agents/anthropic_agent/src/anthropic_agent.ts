import Anthropic from "@anthropic-ai/sdk";
import { AgentFunction, AgentFunctionInfo } from "graphai";

import { GraphAILLMInputBase, getMergeValue } from "@graphai/llm_utils";

type AnthropicInputs = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  // tools?: any;
  // tool_choice?: any;
  stream?: boolean;
  messages?: Array<Record<string, any>>;
} & GraphAILLMInputBase;

export const anthropicAgent: AgentFunction<AnthropicInputs, Record<string, any> | string, string | Array<any>, AnthropicInputs> = async ({
  params,
  namedInputs,
  filterParams,
}) => {
  const { model, system, temperature, max_tokens, prompt, messages, stream } = { ...params, ...namedInputs };

  const userPrompt = getMergeValue(namedInputs, params, "mergeablePrompts", prompt);
  const systemPrompt = getMergeValue(namedInputs, params, "mergeableSystem", system);

  const messagesCopy: Array<any> = messages ? messages.map((m) => m) : [];

  if (userPrompt) {
    messagesCopy.push({
      role: "user",
      content: userPrompt,
    });
  }

  const anthropic = new Anthropic({
    apiKey: process.env["ANTHROPIC_API_KEY"], // This is the default and can be omitted
  });

  const opt = {
    model: model || "claude-3-haiku-20240307", // "claude-3-opus-20240229",
    messages: messagesCopy,
    system: systemPrompt,
    temperature: temperature ?? 0.7,
    max_tokens: max_tokens ?? 1024,
  };
  if (!stream) {
    const message = await anthropic.messages.create(opt);
    // SDK bug https://github.com/anthropics/anthropic-sdk-typescript/issues/432
    const content = (message.content[0] as Anthropic.TextBlock).text;
    return { choices: [{ message: { role: message.role, content } }], text: content };
  }
  const chatStream = await anthropic.messages.create({
    ...opt,
    stream: true,
  });
  const contents = [];
  for await (const messageStreamEvent of chatStream) {
    // console.log(messageStreamEvent.type);
    if (messageStreamEvent.type === "content_block_delta" && messageStreamEvent.delta.type === "text_delta") {
      const token = messageStreamEvent.delta.text;
      contents.push(token);
      if (filterParams && filterParams.streamTokenCallback && token) {
        filterParams.streamTokenCallback(token);
      }
    }
  }
  return { choices: [{ message: { role: "assistant", content: contents.join("") } }], text: contents.join("") };
};

const anthropicAgentInfo: AgentFunctionInfo = {
  name: "anthropicAgent",
  agent: anthropicAgent,
  mock: anthropicAgent,
  inputs: {
    type: "object",
    properties: {
      model: { type: "string" },
      system: { type: "string" },
      max_tokens: { type: "number" },
      temperature: { type: "number" },
      prompt: {
        type: "string",
        description: "query string",
      },
      messages: {
        anyOf: [{ type: "string" }, { type: "integer" }, { type: "object" }, { type: "array" }],
        description: "chat messages",
      },
    },
  },
  output: {
    type: "object",
  },
  samples: [],
  description: "Anthropic Agent",
  category: ["llm"],
  author: "Receptron team",
  repository: "https://github.com/receptron/graphai",
  license: "MIT",
  // stream: true,
  environmentVariables: ["ANTHROPIC_API_KEY"],
  npms: ["@anthropic-ai/sdk"],
};

export default anthropicAgentInfo;
