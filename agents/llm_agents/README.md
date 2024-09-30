
# @graphai/llm_agents for GraphAI

LLM agents for GraphAI.

### Install

```sh
yarn add @graphai/llm_agents
```


### Usage

```typescript
import { GraphAI } from "graphai";
import { 
  anthropicAgent,
  geminiAgent,
  groqAgent,
  openAIAgent,
  openAIImageAgent,
  replicateAgent,
  slashGPTAgent,
  tokenBoundStringsAgent
 } from "@graphai/llm_agents";

const agents = { 
  anthropicAgent,
  geminiAgent,
  groqAgent,
  openAIAgent,
  openAIImageAgent,
  replicateAgent,
  slashGPTAgent,
  tokenBoundStringsAgent
 };

const graph = new GraphAI(graph_data, agents);
const result = await graph.run();
```

### Agents description
- anthropicAgent - Anthropic Agent
- geminiAgent - Gemini Agent
- groqAgent - Groq Agent
- openAIAgent - OpenAI Agent
- openAIImageAgent - OpenAI Image Agent
- replicateAgent - Replicate Agent
- slashGPTAgent - Slash GPT Agent
- tokenBoundStringsAgent - token bound Agent

### Input/Output/Params Schema & samples
 - [anthropicAgent](https://github.com/receptron/graphai/blob/main/docs/agentDocs/llm/anthropicAgent.md)
 - [geminiAgent](https://github.com/receptron/graphai/blob/main/docs/agentDocs/llm/geminiAgent.md)
 - [groqAgent](https://github.com/receptron/graphai/blob/main/docs/agentDocs/llm/groqAgent.md)
 - [openAIAgent](https://github.com/receptron/graphai/blob/main/docs/agentDocs/llm/openAIAgent.md)
 - [openAIImageAgent](https://github.com/receptron/graphai/blob/main/docs/agentDocs/llm/openAIImageAgent.md)
 - [replicateAgent](https://github.com/receptron/graphai/blob/main/docs/agentDocs/llm/replicateAgent.md)
 - [slashGPTAgent](https://github.com/receptron/graphai/blob/main/docs/agentDocs/llm/slashGPTAgent.md)
 - [tokenBoundStringsAgent](https://github.com/receptron/graphai/blob/main/docs/agentDocs/undefined/tokenBoundStringsAgent.md)

### Environment Variables
 - anthropicAgent
   - ANTHROPIC_API_KEY
 - geminiAgent
   - GOOGLE_GENAI_API_KEY
 - groqAgent
   - GROQ_API_KEY
 - openAIAgent
   - OPENAI_API_KEY
 - openAIImageAgent
   - OPENAI_API_KEY
 - replicateAgent
   - REPLICATE_API_TOKEN

### Related Agent Packages
 - [@graphai/anthropic_agent](https://www.npmjs.com/package/@graphai/anthropic_agent)
 - [@graphai/gemini_agent](https://www.npmjs.com/package/@graphai/gemini_agent)
 - [@graphai/groq_agent](https://www.npmjs.com/package/@graphai/groq_agent)
 - [@graphai/openai_agent](https://www.npmjs.com/package/@graphai/openai_agent)
 - [@graphai/replicate_agent](https://www.npmjs.com/package/@graphai/replicate_agent)
 - [@graphai/slashgpt_agent](https://www.npmjs.com/package/@graphai/slashgpt_agent)





