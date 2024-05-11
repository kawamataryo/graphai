import type { GraphAI, GraphData } from "@/graphai";
import { strIntentionalError } from "@/utils/utils";

import {
  NodeDataParams,
  ResultData,
  DataSource,
  ComputedNodeData,
  StaticNodeData,
  NodeState,
  AgentFunctionContext,
  AgentFunction,
  AgentFilterInfo,
  AgentFilterParams,
  DefaultParamsType,
  DefaultInputData,
} from "@/type";
import { parseNodeName, assert } from "@/utils/utils";
import { TransactionLog } from "@/transaction_log";

export class Node {
  public readonly nodeId: string;
  public readonly waitlist = new Set<string>(); // List of nodes which need data from this node.
  public state = NodeState.Waiting;
  public result: ResultData | undefined = undefined;

  protected graph: GraphAI;
  protected log: TransactionLog;

  constructor(nodeId: string, graph: GraphAI) {
    this.nodeId = nodeId;
    this.graph = graph;
    this.log = new TransactionLog(nodeId);
  }

  public asString() {
    return `${this.nodeId}: ${this.state} ${[...this.waitlist]}`;
  }

  // This method is called either as the result of computation (computed node) or
  // injection (static node).
  protected onSetResult() {
    this.waitlist.forEach((waitingNodeId) => {
      const waitingNode = this.graph.nodes[waitingNodeId];
      if (waitingNode.isComputedNode) {
        waitingNode.removePending(this.nodeId);
        this.graph.pushQueueIfReadyAndRunning(waitingNode);
      }
    });
  }
}

export class ComputedNode extends Node {
  public readonly graphId: string;
  public readonly isResult: boolean;
  public readonly params: NodeDataParams; // Agent-specific parameters
  private readonly filterParams: AgentFilterParams;
  private readonly dynamicParams: Record<string, DataSource>;
  public readonly nestedGraph?: GraphData;
  public readonly retryLimit: number;
  public retryCount: number = 0;
  private readonly agentId?: string;
  private readonly agentFunction?: AgentFunction<any, any, any>;
  public readonly timeout?: number; // msec
  public readonly priority: number;
  public error?: Error;
  public transactionId: undefined | number; // To reject callbacks from timed-out transactions

  public readonly anyInput: boolean; // any input makes this node ready
  public dataSources: Array<DataSource>; // data sources, the order is significant.
  public pendings: Set<string>; // List of nodes this node is waiting data from.
  private ifSource?: DataSource; // conditional execution

  public readonly isStaticNode = false;
  public readonly isComputedNode = true;

  constructor(graphId: string, nodeId: string, data: ComputedNodeData, graph: GraphAI) {
    super(nodeId, graph);
    this.graphId = graphId;
    this.params = data.params ?? {};
    this.filterParams = data.filterParams ?? {};
    this.nestedGraph = data.graph;
    if (typeof data.agent === "string") {
      this.agentId = data.agent;
    } else {
      assert(typeof data.agent === "function", "agent must be either string or function");
      const agent = data.agent;
      this.agentFunction = async ({ inputs }) => {
        return agent(...inputs);
      };
    }
    this.retryLimit = data.retry ?? graph.retryLimit ?? 0;
    this.timeout = data.timeout;
    this.isResult = data.isResult ?? false;
    this.priority = data.priority ?? 0;

    this.anyInput = data.anyInput ?? false;
    this.dataSources = (data.inputs ?? []).map((input) => parseNodeName(input, graph.version));
    this.pendings = new Set(this.dataSources.filter((source) => source.nodeId).map((source) => source.nodeId!));
    if (data.if) {
      this.ifSource = parseNodeName(data.if, graph.version);
      assert(!!this.ifSource.nodeId, `Invalid data source ${data.if}`);
      this.pendings.add(this.ifSource.nodeId);
    }
    this.dynamicParams = Object.keys(this.params).reduce((tmp: Record<string, DataSource>, key) => {
      const dataSource = parseNodeName(this.params[key], graph.version < 0.3 ? 0.3 : graph.version);
      if (dataSource.nodeId) {
        assert(!this.anyInput, "Dynamic params are not supported with anyInput");
        tmp[key] = dataSource;
        this.pendings.add(dataSource.nodeId);
      } else if (dataSource.isHook) {
        const hook = graph.getHook(dataSource.value);
        assert(hook !== undefined, `Specified hook does not exist: ${dataSource.value}`);
        this.params[key] = hook;
      }
      return tmp;
    }, {});

    this.log.initForComputedNode(this);
  }

  public getAgentId() {
    return this.agentId ?? "__custom__function"; // only for display purpose in the log.
  }

  public isReadyNode() {
    if (this.state === NodeState.Waiting && this.pendings.size === 0) {
      // Count the number of data actually available.
      // We care it only when this.anyInput is true.
      // Notice that this logic enables dynamic data-flows.
      const counter = this.dataSources.reduce((count, source) => {
        const [result] = this.graph.resultsOf([source]);
        return result === undefined ? count : count + 1;
      }, 0);
      if (!this.anyInput || counter > 0) {
        if (this.ifSource) {
          const [condition] = this.graph.resultsOf([this.ifSource]);
          if (!condition) {
            this.state = NodeState.Skipped;
            this.log.onSkipped(this, this.graph);
            return false;
          }
          return true;
        }
        return true;
      }
    }
    return false;
  }

  // This private method (only called while executing execute()) performs
  // the "retry" if specified. The transaction log must be updated before
  // callling this method.
  private retry(state: NodeState, error: Error) {
    this.state = state; // this.execute() will update to NodeState.Executing
    this.log.onError(this, this.graph, error.message);

    if (this.retryCount < this.retryLimit) {
      this.retryCount++;
      this.execute();
    } else {
      this.result = undefined;
      this.error = error;
      this.transactionId = undefined; // This is necessary for timeout case
      this.graph.onExecutionComplete(this);
    }
  }

  private checkDataAvailability() {
    assert(this.anyInput, "checkDataAvailability should be called only for anyInput case");
    const results = this.graph.resultsOf(this.dataSources).filter((result) => {
      return result !== undefined;
    });
    return results.length > 0;
  }

  // This method is called right before the Graph add this node to the task manager.
  public beforeAddTask() {
    this.state = NodeState.Queued;
    this.log.beforeAddTask(this, this.graph);
  }

  // This method is called when the data became available on one of nodes,
  // which this node needs data from.
  public removePending(nodeId: string) {
    if (this.anyInput) {
      if (this.checkDataAvailability()) {
        this.pendings.clear();
      }
    } else {
      this.pendings.delete(nodeId);
    }
  }

  private isCurrentTransaction(transactionId: number) {
    return this.transactionId === transactionId;
  }

  // This private method (called only fro execute) checks if the callback from
  // the timer came before the completion of agent function call, record it
  // and attempt to retry (if specified).
  private executeTimeout(transactionId: number) {
    if (this.state === NodeState.Executing && this.isCurrentTransaction(transactionId)) {
      console.log(`-- ${this.nodeId}: timeout ${this.timeout}`);
      this.retry(NodeState.TimedOut, Error("Timeout"));
    }
  }

  // Check if we need to apply this filter to this node or not.
  private shouldApplyAgentFilter(agentFilter: AgentFilterInfo) {
    if (agentFilter.agentIds && Array.isArray(agentFilter.agentIds) && agentFilter.agentIds.length > 0) {
      if (this.agentId && agentFilter.agentIds.includes(this.agentId)) {
        return true;
      }
    }
    if (agentFilter.nodeIds && Array.isArray(agentFilter.nodeIds) && agentFilter.nodeIds.length > 0) {
      if (agentFilter.nodeIds.includes(this.nodeId)) {
        return true;
      }
    }
    return !agentFilter.agentIds && !agentFilter.nodeIds;
  }

  private agentFilterHandler(context: AgentFunctionContext, agent: AgentFunction): Promise<ResultData> {
    let index = 0;

    const next = (context: AgentFunctionContext): Promise<ResultData> => {
      const agentFilter = this.graph.agentFilters[index++];
      if (agentFilter) {
        if (this.shouldApplyAgentFilter(agentFilter)) {
          if (agentFilter.filterParams) {
            context.filterParams = { ...agentFilter.filterParams, ...context.filterParams };
          }
          return agentFilter.agent(context, next);
        }
        return next(context);
      }
      return agent(context);
    };

    return next(context);
  }

  // This method is called when this computed node became ready to run.
  // It asynchronously calls the associated with agent function and set the result,
  // then it removes itself from the "running node" list of the graph.
  // Notice that setting the result of this node may make other nodes ready to run.
  public async execute() {
    const previousResults = this.graph.resultsOf(this.dataSources).filter((result) => {
      // Remove undefined if anyInput flag is set.
      return !this.anyInput || result !== undefined;
    });
    const transactionId = Date.now();
    this.prepareExecute(transactionId, previousResults);

    if (this.timeout && this.timeout > 0) {
      setTimeout(() => {
        this.executeTimeout(transactionId);
      }, this.timeout);
    }

    try {
      const callback = this.agentFunction ?? this.graph.getCallback(this.agentId);
      const localLog: TransactionLog[] = [];
      const params = Object.keys(this.dynamicParams).reduce(
        (tmp, key) => {
          const [result] = this.graph.resultsOf([this.dynamicParams[key]]);
          tmp[key] = result;
          return tmp;
        },
        { ...this.params },
      );
      const context: AgentFunctionContext<DefaultParamsType, DefaultInputData | string | number | boolean | undefined> = {
        params: params,
        inputs: previousResults,
        debugInfo: {
          nodeId: this.nodeId,
          agentId: this.agentId,
          retry: this.retryCount,
          verbose: this.graph.verbose,
        },
        filterParams: this.filterParams,
        log: localLog,
      };

      // NOTE: We use the existence of graph object in the agent-specific params to determine
      // if this is a nested agent or not.
      if (this.nestedGraph) {
        this.graph.taskManager.prepareForNesting();
        context.taskManager = this.graph.taskManager;
        context.graphData = this.nestedGraph;
        context.agents = this.graph.callbackDictonary;
      }

      const result = await this.agentFilterHandler(context as AgentFunctionContext, callback);

      if (this.nestedGraph) {
        this.graph.taskManager.restoreAfterNesting();
      }

      if (!this.isCurrentTransaction(transactionId)) {
        // This condition happens when the agent function returns
        // after the timeout (either retried or not).
        console.log(`-- ${this.nodeId}: transactionId mismatch`);
        return;
      }

      this.state = NodeState.Completed;
      this.result = result;
      this.log.onComplete(this, this.graph, localLog);

      this.onSetResult();

      this.graph.onExecutionComplete(this);
    } catch (error) {
      this.errorProcess(error, transactionId);
    }
  }

  // This private method (called only by execute()) prepares the ComputedNode object
  // for execution, and create a new transaction to record it.
  private prepareExecute(transactionId: number, inputs: Array<ResultData>) {
    this.state = NodeState.Executing;
    this.log.beforeExecute(this, this.graph, transactionId, inputs);
    this.transactionId = transactionId;
  }

  // This private method (called only by execute) processes an error received from
  // the agent function. It records the error in the transaction log and handles
  // the retry if specified.
  private errorProcess(error: unknown, transactionId: number) {
    if (error instanceof Error && error.message !== strIntentionalError) {
      console.error(`<-- ${this.nodeId}, ${this.agentId}`);
      console.log(error);
      console.log("-->");
    }
    if (!this.isCurrentTransaction(transactionId)) {
      console.log(`-- ${this.nodeId}: transactionId mismatch(error)`);
      return;
    }

    if (error instanceof Error) {
      this.retry(NodeState.Failed, error);
    } else {
      console.error(`-- ${this.nodeId}: Unexpecrted error was caught`);
      this.retry(NodeState.Failed, Error("Unknown"));
    }
  }
}

export class StaticNode extends Node {
  public value?: ResultData;
  public readonly update?: DataSource;
  public readonly isResult: boolean;
  public readonly isStaticNode = true;
  public readonly isComputedNode = false;

  constructor(nodeId: string, data: StaticNodeData, graph: GraphAI) {
    super(nodeId, graph);
    this.value = data.value;
    this.update = data.update ? parseNodeName(data.update, graph.version) : undefined;
    this.isResult = data.isResult ?? false;
  }

  public injectValue(value: ResultData, injectFrom?: string) {
    this.state = NodeState.Injected;
    this.result = value;
    this.log.onInjected(this, this.graph, injectFrom);
    this.onSetResult();
  }
}
