export enum NodeState {
  Waiting = "waiting",
  Executing = "executing",
  Failed = "failed",
  TimedOut = "timed-out",
  Completed = "completed",
  Injected = "injected",
  Dispatched = "dispatched",
}
type ResultData<ResultType = Record<string, any>> = ResultType | undefined;
type ResultDataDictonary<ResultType = Record<string, any>> = Record<string, ResultData<ResultType>>;

export type NodeDataParams<ParamsType = Record<string, any>> = ParamsType; // Agent-specific parameters

type NodeData = {
  inputs?: Array<string>;
  anyInput?: boolean;
  params?: NodeDataParams;
  retry?: number;
  timeout?: number; // msec
  agentId?: string;
  fork?: number;
  source?: boolean;
  value?: ResultData; // initial value for static node.
  update?: string; // nodeId (+.propId) to get value after a loop
  outputs?: Record<string, string>; // mapping from routeId to nodeId
};

type LoopData = {
  count?: number;
  while?: string;
};

export type GraphData = {
  agentId?: string;
  nodes: Record<string, NodeData>;
  concurrency?: number;
  loop?: LoopData;
  verbose?: boolean;
};

export type TransactionLog = {
  nodeId: string;
  state: NodeState;
  startTime: number;
  endTime?: number;
  retryCount?: number;
  agentId?: string;
  params?: NodeDataParams;
  inputs?: Array<ResultData>;
  errorMessage?: string;
  result?: ResultData;
  log?: TransactionLog[];
};

export type AgentFunctionContext<ParamsType, PreviousResultType> = {
  nodeId: string;
  forkIndex?: number;
  retry: number;
  params: NodeDataParams<ParamsType>;
  inputs: Array<PreviousResultType>;
  verbose: boolean;
  agents: CallbackDictonaryArgs;
  log: TransactionLog[];
};

export type AgentFunction<ParamsType = Record<string, any>, ResultType = Record<string, any>, PreviousResultType = Record<string, any>> = (
  context: AgentFunctionContext<ParamsType, PreviousResultType>,
) => Promise<ResultData<ResultType>>;

export type AgentFunctionDictonary = Record<string, AgentFunction<any, any, any>>;

const parseNodeName = (name: string) => {
  const parts = name.split(".");
  if (parts.length == 1) {
    return { sourceNodeId: parts[0] };
  } else {
    return { sourceNodeId: parts[0], propId: parts[1] };
  }
};

class Node {
  public nodeId: string;
  public params: NodeDataParams; // Agent-specific parameters
  public inputs: Array<string>; // List of nodes this node needs data from.
  public anyInput: boolean;
  public inputProps: Record<string, string> = {}; // optional properties for input
  public pendings: Set<string>; // List of nodes this node is waiting data from.
  public waitlist = new Set<string>(); // List of nodes which need data from this node.
  public state = NodeState.Waiting;
  public agentId?: string;
  public fork?: number;
  public forkIndex?: number;
  public result: ResultData = undefined;
  public retryLimit: number;
  public retryCount: number = 0;
  public transactionId: undefined | number; // To reject callbacks from timed-out transactions
  public timeout?: number; // msec
  public error?: Error;
  public source: boolean;
  public outputs?: Record<string, string>; // Mapping from routeId to nodeId

  private graph: GraphAI;

  constructor(nodeId: string, forkIndex: number | undefined, data: NodeData, graph: GraphAI) {
    this.nodeId = nodeId;
    this.forkIndex = forkIndex;
    this.inputs = (data.inputs ?? []).map((input) => {
      const { sourceNodeId, propId } = parseNodeName(input);
      if (propId) {
        this.inputProps[sourceNodeId] = propId;
      }
      return sourceNodeId;
    });
    this.anyInput = data.anyInput ?? false;
    this.pendings = new Set(this.inputs);
    this.params = data.params ?? {};
    this.agentId = data.agentId ?? graph.agentId;
    this.fork = data.fork;
    this.retryLimit = data.retry ?? 0;
    this.timeout = data.timeout;
    this.source = this.agentId === undefined;
    this.outputs = data.outputs;
    this.graph = graph;
  }

  public asString() {
    return `${this.nodeId}: ${this.state} ${[...this.waitlist]}`;
  }

  private retry(state: NodeState, error: Error) {
    if (this.retryCount < this.retryLimit) {
      this.retryCount++;
      this.execute();
    } else {
      this.state = state;
      this.result = undefined;
      this.error = error;
      this.transactionId = undefined; // This is necessary for timeout case
      this.graph.removeRunning(this);
    }
  }

  public removePending(nodeId: string) {
    this.pendings.delete(nodeId);
    if (this.graph.isRunning) {
      this.pushQueueIfReady();
    }
  }

  public pushQueueIfReady() {
    if (this.pendings.size === 0 && !this.source) {
      /*
      // If input property is specified, we need to ensure that the property value exists.
      Object.keys(this.inputProps).forEach((nodeId) => {
        const [result] = this.graph.resultsOf([nodeId]);
        const propId = this.inputProps[nodeId];
        if (!result || !(propId in result)) {
          return;
        }
      });
      */
      this.graph.pushQueue(this);
    }
  }

  public injectValue(value: ResultData) {
    if (this.source) {
      const log: TransactionLog = {
        nodeId: this.nodeId,
        retryCount: this.retryCount,
        state: NodeState.Injected,
        startTime: Date.now(),
        endTime: Date.now(),
        result: value,
      };
      this.graph.appendLog(log);
      this.setResult(value, NodeState.Injected);
    } else {
      console.error("- injectValue called on non-source node.", this.nodeId);
    }
  }

  private setResult(result: ResultData, state: NodeState) {
    this.state = state;
    this.result = result;
    this.waitlist.forEach((nodeId) => {
      const node = this.graph.nodes[nodeId];
      // Todo: Avoid running before Run()
      node.removePending(this.nodeId);
    });
  }

  public async execute() {
    const results = this.inputs.reduce((results: Array<ResultData>, nodeId) => {
      const [result] = this.graph.resultsOf([nodeId]);
      const propId = this.inputProps[nodeId];
      if (this.anyInput) {
        // skip undefined
        if (result) {
          if (!propId) {
            results.push(result);
          } else if (result[propId]) {
            results.push(result[propId]);
          }
        }
      } else {
        results.push(propId? result![propId] : result);
      }
      return results;
    }, []);

    const transactionId = Date.now();
    const log: TransactionLog = {
      nodeId: this.nodeId,
      retryCount: this.retryCount > 0 ? this.retryCount : undefined,
      state: NodeState.Executing,
      startTime: transactionId,
      agentId: this.agentId,
      params: this.params,
      inputs: results.length > 0 ? results : undefined,
    };
    this.graph.appendLog(log);
    this.state = NodeState.Executing;
    this.transactionId = transactionId;

    if (this.timeout && this.timeout > 0) {
      setTimeout(() => {
        if (this.state === NodeState.Executing && this.transactionId === transactionId) {
          console.log(`-- ${this.nodeId}: timeout ${this.timeout}`);
          log.errorMessage = "Timeout";
          log.state = NodeState.TimedOut;
          log.endTime = Date.now();
          this.retry(NodeState.TimedOut, Error("Timeout"));
        }
      }, this.timeout);
    }

    try {
      const callback = this.graph.getCallback(this.agentId);
      const localLog: TransactionLog[] = [];
      const result = await callback({
        nodeId: this.nodeId,
        retry: this.retryCount,
        params: this.params,
        inputs: results,
        forkIndex: this.forkIndex,
        verbose: this.graph.verbose,
        agents: this.graph.callbackDictonary,
        log: localLog,
      });
      if (this.transactionId !== transactionId) {
        console.log(`-- ${this.nodeId}: transactionId mismatch`);
        return;
      }

      log.endTime = Date.now();
      log.result = result;
      if (localLog.length > 0) {
        log.log = localLog;
      }

      const outputs = this.outputs;
      if (outputs !== undefined) {
        Object.keys(outputs).forEach((outputId) => {
          const nodeId = outputs[outputId];
          const value = result[outputId];
          if (value) {
            this.graph.injectValue(nodeId, value);
          } else {
            console.error("-- Invalid outputId", outputId, result);
          }
        });
        log.state = NodeState.Dispatched;
        this.state = NodeState.Dispatched;
        this.graph.removeRunning(this);
        return;
      }
      log.state = NodeState.Completed;
      this.setResult(result, NodeState.Completed);
      this.graph.removeRunning(this);
    } catch (error) {
      if (this.transactionId !== transactionId) {
        console.log(`-- ${this.nodeId}: transactionId mismatch(error)`);
        return;
      }
      log.state = NodeState.Failed;
      log.endTime = Date.now();
      if (error instanceof Error) {
        log.errorMessage = error.message;
        this.retry(NodeState.Failed, error);
      } else {
        console.error(`-- ${this.nodeId}: Unexpecrted error was caught`);
        log.errorMessage = "Unknown";
        this.retry(NodeState.Failed, Error("Unknown"));
      }
    }
  }
}

type GraphNodes = Record<string, Node>;
export type CallbackDictonaryArgs = AgentFunctionDictonary;

const defaultConcurrency = 8;

export class GraphAI {
  private data: GraphData;
  public nodes: GraphNodes;
  public agentId?: string;
  public callbackDictonary: AgentFunctionDictonary;
  public isRunning = false;
  private runningNodes = new Set<string>();
  private nodeQueue: Array<Node> = [];
  private onComplete: () => void;
  private concurrency: number;
  private loop?: LoopData;
  private repeatCount = 0;
  public verbose: boolean;
  private logs: Array<TransactionLog> = [];

  private createNodes(data: GraphData) {
    const nodeId2forkedNodeIds: Record<string, string[]> = {};
    const forkedNodeId2Index: Record<string, number> = {};

    const nodes = Object.keys(data.nodes).reduce((nodes: GraphNodes, nodeId: string) => {
      const fork = data.nodes[nodeId].fork;
      if (fork) {
        // For fork, change the nodeId and increase the node
        nodeId2forkedNodeIds[nodeId] = new Array(fork).fill(undefined).map((_, i) => {
          const forkedNodeId = `${nodeId}_${i}`;
          nodes[forkedNodeId] = new Node(forkedNodeId, i, data.nodes[nodeId], this);
          // Data for pending and waiting
          forkedNodeId2Index[forkedNodeId] = i;
          return forkedNodeId;
        });
      } else {
        nodes[nodeId] = new Node(nodeId, undefined, data.nodes[nodeId], this);
      }
      return nodes;
    }, {});

    // Generate the waitlist for each node, and update the pendings in case of forked node.
    Object.keys(nodes).forEach((nodeId) => {
      const node = nodes[nodeId];
      node.pendings.forEach((pending) => {
        // If the pending(previous) node is forking
        if (nodeId2forkedNodeIds[pending]) {
          //  update node.pending and pending(previous) node.wailtlist
          if (node.fork) {
            //  1:1 if current nodes are also forking.
            const newPendingId = nodeId2forkedNodeIds[pending][forkedNodeId2Index[nodeId]];
            nodes[newPendingId].waitlist.add(nodeId); // previousNode
            node.pendings.add(newPendingId);
          } else {
            //  1:n if current node is not forking.
            nodeId2forkedNodeIds[pending].forEach((newPendingId) => {
              nodes[newPendingId].waitlist.add(nodeId); // previousNode
              node.pendings.add(newPendingId);
            });
          }
          node.pendings.delete(pending);
        } else {
          if (nodes[pending]) {
            nodes[pending].waitlist.add(nodeId); // previousNode
          } else {
            console.error(`--- invalid input ${pending} for node, ${nodeId}`);
          }
        }
      });
      node.inputs = Array.from(node.pendings); // for fork.
    });
    return nodes;
  }

  private getValueFromResults(key: string, results: ResultDataDictonary<Record<string, any>>) {
    const { sourceNodeId, propId } = parseNodeName(key);
    const result = results[sourceNodeId];
    return result ? (propId ? result[propId] : result) : undefined;
  }

  private initializeNodes(previousResults?: ResultDataDictonary<Record<string, any>>) {
    // If the result property is specified, inject it.
    // If the previousResults exists (indicating we are in a loop),
    // process the update property (nodeId or nodeId.propId).
    Object.keys(this.data.nodes).forEach((nodeId) => {
      const node = this.data.nodes[nodeId];
      const { value, update } = node;
      if (value) {
        this.injectValue(nodeId, value);
      }
      if (update && previousResults) {
        const result = this.getValueFromResults(update, previousResults);
        if (result) {
          this.injectValue(nodeId, result);
        }
      }
    });
  }

  constructor(data: GraphData, callbackDictonary: CallbackDictonaryArgs) {
    this.data = data;
    this.callbackDictonary = callbackDictonary;
    this.concurrency = data.concurrency ?? defaultConcurrency;
    this.loop = data.loop;
    this.agentId = data.agentId;
    this.verbose = data.verbose === true;
    this.onComplete = () => {
      console.error("-- SOMETHING IS WRONG: onComplete is called without run()");
    };

    this.nodes = this.createNodes(data);
    this.initializeNodes();
  }

  public getCallback(agentId?: string) {
    if (agentId && this.callbackDictonary[agentId]) {
      return this.callbackDictonary[agentId];
    }
    throw new Error("No agent: " + agentId);
  }

  public asString() {
    return Object.keys(this.nodes)
      .map((nodeId) => {
        return this.nodes[nodeId].asString();
      })
      .join("\n");
  }

  public results() {
    return Object.keys(this.nodes).reduce((results: ResultDataDictonary, nodeId) => {
      const node = this.nodes[nodeId];
      if (node.result !== undefined) {
        results[nodeId] = node.result;
      }
      return results;
    }, {});
  }

  public errors() {
    return Object.keys(this.nodes).reduce((errors: Record<string, Error>, nodeId) => {
      const node = this.nodes[nodeId];
      if (node.error !== undefined) {
        errors[nodeId] = node.error;
      }
      return errors;
    }, {});
  }

  private pushReadyNodesIntoQueue() {
    // Nodes without pending data should run immediately.
    Object.keys(this.nodes).forEach((nodeId) => {
      const node = this.nodes[nodeId];
      node.pushQueueIfReady();
    });
  }

  public async run(): Promise<ResultDataDictonary> {
    if (this.isRunning) {
      console.error("-- Already Running");
    }
    this.isRunning = true;
    this.pushReadyNodesIntoQueue();

    return new Promise((resolve, reject) => {
      this.onComplete = () => {
        this.isRunning = false;
        const errors = this.errors();
        const nodeIds = Object.keys(errors);
        if (nodeIds.length > 0) {
          reject(errors[nodeIds[0]]);
        } else {
          resolve(this.results());
        }
      };
    });
  }

  private runNode(node: Node) {
    this.runningNodes.add(node.nodeId);
    node.execute();
  }

  public pushQueue(node: Node) {
    if (this.runningNodes.size < this.concurrency) {
      this.runNode(node);
    } else {
      this.nodeQueue.push(node);
    }
  }

  public removeRunning(node: Node) {
    this.runningNodes.delete(node.nodeId);
    if (this.nodeQueue.length > 0) {
      const n = this.nodeQueue.shift();
      if (n) {
        this.runNode(n);
      }
    }
    if (this.runningNodes.size === 0) {
      this.repeatCount++;
      const loop = this.loop;
      if (loop && (loop.count === undefined || this.repeatCount < loop.count)) {
        const results = this.results(); // results from previous loop

        this.isRunning = false; // temporarily stop it
        this.nodes = this.createNodes(this.data);
        this.initializeNodes(results);

        const checkWhileCondition = () => {
          if (loop.while) {
            const value = this.getValueFromResults(loop.while, this.results());
            // NOTE: We treat an empty array as false.
            return Array.isArray(value) ? value.length > 0 : !!value;
          }
          return true;
        };
        if (checkWhileCondition()) {
          this.isRunning = true; // restore it
          this.pushReadyNodesIntoQueue();
          return;
        }
      }
      this.onComplete();
    }
  }

  public appendLog(log: TransactionLog) {
    this.logs.push(log);
  }

  public transactionLogs() {
    return this.logs;
  }

  public injectValue(nodeId: string, value: ResultData) {
    const node = this.nodes[nodeId];
    if (node) {
      node.injectValue(value);
    } else {
      console.error("-- Invalid nodeId", nodeId);
    }
  }

  public resultsOf(nodeIds: Array<string>) {
    return nodeIds.map((nodeId) => {
      return this.nodes[nodeId].result;
    });
  }
}
