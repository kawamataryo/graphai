[**graphai**](../README.md)

***

[graphai](../globals.md) / AgentFilterFunction

# Type Alias: AgentFilterFunction()\<ParamsType, ResultType, NamedInputDataType\>

> **AgentFilterFunction**\<`ParamsType`, `ResultType`, `NamedInputDataType`\>: (`context`, `agent`) => `Promise`\<[`ResultData`](ResultData.md)\<`ResultType`\>\>

Defined in: [packages/graphai/src/type.ts:137](https://github.com/kawamataryo/graphai/blob/d1a2c5ee2f62deae7af78fb66f65face3cfa29fb/packages/graphai/src/type.ts#L137)

## Type Parameters

• **ParamsType** = [`DefaultParamsType`](DefaultParamsType.md)

• **ResultType** = [`DefaultResultData`](DefaultResultData.md)

• **NamedInputDataType** = [`DefaultInputData`](DefaultInputData.md)

## Parameters

### context

[`AgentFunctionContext`](AgentFunctionContext.md)\<`ParamsType`, `NamedInputDataType`\>

### agent

[`AgentFunction`](AgentFunction.md)

## Returns

`Promise`\<[`ResultData`](ResultData.md)\<`ResultType`\>\>
