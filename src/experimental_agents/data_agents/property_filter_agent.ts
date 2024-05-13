import { AgentFunction } from "@/graphai";

const applyFilter = (input: any, include: Array<string> | undefined, exclude: Array<string> | undefined, alter: Record<string, Record<string, string>> | undefined) => {
  const propIds = include ? include : Object.keys(input);
  const excludeSet = new Set(exclude ?? []);
  return propIds.reduce((tmp: Record<string, any>, propId) => {
    if (!excludeSet.has(propId)) {
      const mapping = alter && alter[propId];
      if (mapping && mapping[input[propId]]) {
        tmp[propId] = mapping[input[propId]];
      } else {
        tmp[propId] = input[propId];
      }
    }
    return tmp;
  }, {});
};

export const propertyFilterAgent: AgentFunction<{ include?: Array<string>; exclude?: Array<string>; alter?: Record<string, Record<string, string>> }> = async ({ inputs, params }) => {  const [input] = inputs;
  const { include, exclude, alter } = params;
  if (Array.isArray(input)) {
    return input.map((item) => applyFilter(item, include, exclude, alter));
  }
  return applyFilter(input, include, exclude, alter);
};

const testInputs = [[
  { color: "red", model: "Model 3", type: "EV", maker: "Tesla", range: 300 },
  { color: "blue", model: "Model Y", type: "EV", maker: "Tesla", range: 400 },
]];

const propertyFilterAgentInfo = {
  name: "propertyFilterAgent",
  agent: propertyFilterAgent,
  mock: propertyFilterAgent,
  samples: [
    {
      testInputs,
      params: { include: ["color", "model"] },
      result: [{ color: "red", model: "Model 3" }, { color: "blue", model: "Model Y" }],
    },
    {
      testInputs,
      params: { exclude: ["color", "model"] },
      result: [{ type: "EV", maker: "Tesla", range: 300 }, { type: "EV", maker: "Tesla", range: 400 }],
    },
    {
      testInputs,
      params: { alter: { color: { red:"blue", blue:"red" } } },
      result: [
        { color: "blue", model: "Model 3", type: "EV", maker: "Tesla", range: 300 },
        { color: "red", model: "Model Y", type: "EV", maker: "Tesla", range: 400 },
      ],
    },
  ],
  description: "Filter properties based on property name either with 'include' or 'exclude'",
  category: ["data"],
  author: "Receptron team",
  repository: "https://github.com/receptron/graphai",
  license: "MIT",
};
export default propertyFilterAgentInfo;
