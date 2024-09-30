"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.anthropicAgent = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const llm_utils_1 = require("@graphai/llm_utils");
const anthropicAgent = async ({ params, namedInputs, filterParams, }) => {
    const { model, system, temperature, max_tokens, prompt, messages, stream } = { ...params, ...namedInputs };
    const userPrompt = (0, llm_utils_1.getMergeValue)(namedInputs, params, "mergeablePrompts", prompt);
    const systemPrompt = (0, llm_utils_1.getMergeValue)(namedInputs, params, "mergeableSystem", system);
    const messagesCopy = messages ? messages.map((m) => m) : [];
    if (userPrompt) {
        messagesCopy.push({
            role: "user",
            content: userPrompt,
        });
    }
    const anthropic = new sdk_1.default({
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
        const content = message.content[0].text;
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
exports.anthropicAgent = anthropicAgent;
const anthropicAgentInfo = {
    name: "anthropicAgent",
    agent: exports.anthropicAgent,
    mock: exports.anthropicAgent,
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
exports.default = anthropicAgentInfo;
