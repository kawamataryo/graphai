
## GraphAI apiDoc

https://receptron.github.io/graphai/apiDoc/

in graphai/packages/graphai

```
yarn run doc
```

typedoc used.

## agentDoc

https://github.com/receptron/graphai/blob/main/docs/agentDocs/README.md

in graphai/packages/cli

```
yarn run doc
```

This script generates a document from the AgentFunctionInfo of all agents.

Github Action automatically run this script.

## GraphData examples from graphData on Test each each packages

```
yarn run examplesDoc
```

It then reads test GraphData and writes markdown files.
These markdown files use the agent doc command.

- agentDir/docs/GraphDataJSON.md
- agentDir/docs/GraphDataYAML.md



## agentDoc for each agents

```
npx agentdoc
```

(bin/agentdoc of @graphai/agentdoc)

read from package.json and docs/*.md and source code,

writes to README.md in each package

The implementation of this script is `graphai/packages/agentdoc/src/agentdoc.ts`.
