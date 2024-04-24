export { AgentFunction, AgentFunctionDictonary, GraphData } from "@/type";

import {
  AgentFunctionDictonary,
  GraphData,
  DataSource,
  LoopData,
  ResultDataDictonary,
  ResultData,
  DefaultResultData,
  StaticNodeData,
  ComputedNodeData,
} from "@/type";
import { TransactionLog } from "@/log";

import { ComputedNode, StaticNode } from "@/node";
import { parseNodeName } from "@/utils/utils";
import { validateGraphData } from "@/validator";
import { NodeState } from "./type";

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type TaskEntry = {
  node: ComputedNode;
  callback: (node: ComputedNode) => void;
};

class TaskManager {
  private concurrency: number;
  private taskQueue: Array<TaskEntry> = [];
  private runningNodes = new Set<ComputedNode>();

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  private dequeueTaskIfPossible() {
    if (this.runningNodes.size < this.concurrency) {
      const task = this.taskQueue.shift();
      if (task) {
        this.runningNodes.add(task.node);
        task.callback(task.node);
      }
    }
  }

  public addTask(node: ComputedNode, callback: (node: ComputedNode) => void) {
    this.taskQueue.push({ node, callback });
    this.dequeueTaskIfPossible();
  }

  public onComplete(node: ComputedNode) {
    assert(this.runningNodes.has(node), `TaskManager.onComplete node(${node.nodeId}) is not in list`);
    this.runningNodes.delete(node);
    this.dequeueTaskIfPossible();
  }
}

type GraphNodes = Record<string, ComputedNode | StaticNode>;

const defaultConcurrency = 8;

export class GraphAI {
  private data: GraphData;
  public nodes: GraphNodes;
  public callbackDictonary: AgentFunctionDictonary;

  public onLogCallback = (__log: TransactionLog, __isUpdate: boolean) => {};
  private runningNodes = new Set<string>();
  private onComplete: () => void;
  private taskManager: TaskManager;
  private loop?: LoopData;
  private repeatCount = 0;
  public verbose: boolean;
  private logs: Array<TransactionLog> = [];

  // This method is called when either the GraphAI obect was created,
  // or we are about to start n-th iteration (n>2).
  private createNodes(data: GraphData) {
    const nodeId2forkedNodeIds: Record<string, string[]> = {};
    const forkedNodeId2Index: Record<string, number> = {};
    const forkedNodeId2NodeId: Record<string, string> = {}; // for sources

    const nodes = Object.keys(data.nodes).reduce((_nodes: GraphNodes, nodeId: string) => {
      const isStaticNode = "value" in data.nodes[nodeId];
      if (isStaticNode) {
        _nodes[nodeId] = new StaticNode(nodeId, data.nodes[nodeId] as StaticNodeData, this);
      } else {
        const nodeData = data.nodes[nodeId] as ComputedNodeData;
        const fork = nodeData.fork;
        if (fork) {
          // For fork, change the nodeId and increase the node
          nodeId2forkedNodeIds[nodeId] = new Array(fork).fill(undefined).map((_, i) => {
            const forkedNodeId = `${nodeId}_${i}`;
            _nodes[forkedNodeId] = new ComputedNode(forkedNodeId, i, nodeData, this);
            // Data for pending and waiting
            forkedNodeId2Index[forkedNodeId] = i;
            forkedNodeId2NodeId[forkedNodeId] = nodeId;
            return forkedNodeId;
          });
        } else {
          _nodes[nodeId] = new ComputedNode(nodeId, undefined, nodeData, this);
        }
      }
      return _nodes;
    }, {});

    // Generate the waitlist for each node, and update the pendings in case of forked node.
    Object.keys(nodes).forEach((nodeId) => {
      const node = nodes[nodeId];
      if (node.isComputedNode) {
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
        node.sources = node.inputs.reduce((sources: Record<string, DataSource>, input) => {
          const refNodeId = forkedNodeId2NodeId[input] ?? input;
          sources[input] = { nodeId: input, propId: node.sources[refNodeId].propId };
          return sources;
        }, {});
      }
    });
    return nodes;
  }

  private getValueFromResults(key: string, results: ResultDataDictonary<DefaultResultData>) {
    const source = parseNodeName(key);
    const result = results[source.nodeId];
    return result && source.propId ? result[source.propId] : result;
  }

  // for static
  private initializeNodes(previousResults?: ResultDataDictonary<DefaultResultData>) {
    // If the result property is specified, inject it.
    // If the previousResults exists (indicating we are in a loop),
    // process the update property (nodeId or nodeId.propId).
    Object.keys(this.data.nodes).forEach((nodeId) => {
      const node = this.nodes[nodeId];
      if (node?.isStaticNode) {
        const value = node?.value;
        const update = node?.update;
        if (value) {
          this.injectValue(nodeId, value);
        }
        if (update && previousResults) {
          const result = this.getValueFromResults(update, previousResults);
          if (result) {
            this.injectValue(nodeId, result);
          }
        }
      }
    });
  }

  constructor(data: GraphData, callbackDictonary: AgentFunctionDictonary) {
    this.data = data;
    this.callbackDictonary = callbackDictonary;
    this.taskManager = new TaskManager(data.concurrency ?? defaultConcurrency);
    this.loop = data.loop;
    this.verbose = data.verbose === true;
    this.onComplete = () => {
      console.error("-- SOMETHING IS WRONG: onComplete is called without run()");
    };

    validateGraphData(data, Object.keys(callbackDictonary));

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
    return Object.values(this.nodes)
      .map((node) => node.asString())
      .join("\n");
  }

  // Public API
  public results<T = DefaultResultData>(): ResultDataDictonary<T> {
    return Object.keys(this.nodes).reduce((results: ResultDataDictonary<T>, nodeId) => {
      const node = this.nodes[nodeId];
      if (node.result !== undefined) {
        results[nodeId] = node.result as T;
      }
      return results;
    }, {});
  }

  // Public API
  public errors(): Record<string, Error> {
    return Object.keys(this.nodes).reduce((errors: Record<string, Error>, nodeId) => {
      const node = this.nodes[nodeId];
      if (node.isComputedNode) {
        if (node.error !== undefined) {
          errors[nodeId] = node.error;
        }
      }
      return errors;
    }, {});
  }

  private pushReadyNodesIntoQueue() {
    // Nodes without pending data should run immediately.
    Object.keys(this.nodes).forEach((nodeId) => {
      const node = this.nodes[nodeId];
      if (node.isComputedNode) {
        node.pushQueueIfReady();
      }
    });
  }

  // for computed
  public pushQueue(node: ComputedNode) {
    node.state = NodeState.Queued;
    this.taskManager.addTask(node, (__node: ComputedNode) => {
      assert(node.nodeId === __node.nodeId, "GraphAI.PushQueue Node mismatch");
      this.runNode(node);
    });
  }

  // Public API
  public async run<T = DefaultResultData>(): Promise<ResultDataDictonary<T>> {
    if (this.isRunning()) {
      console.error("-- Already Running");
    }
    this.pushReadyNodesIntoQueue();

    return new Promise((resolve, reject) => {
      this.onComplete = () => {
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

  // for computed
  private runNode(node: ComputedNode) {
    this.runningNodes.add(node.nodeId);
    node.execute();
  }

  // callback from execute
  public onExecutionComplete(node: ComputedNode) {
    this.removeRunning(node);
    this.processLoopIfNecessary();
  }

  // Must be called only from on ExecitionComplete
  private removeRunning(node: ComputedNode) {
    this.runningNodes.delete(node.nodeId);
    this.taskManager.onComplete(node);
  }

  public isRunning() {
    return this.runningNodes.size > 0;
  }

  // Must be called only from onExecutionComplete righ after removeRunning
  // Check if there is any running computed nodes.
  // In case of no running computed note, start the another iteration if ncessary (loop)
  private processLoopIfNecessary() {
    if (!this.isRunning()) {
      this.repeatCount++;
      const loop = this.loop;
      if (loop && (loop.count === undefined || this.repeatCount < loop.count)) {
        const results = this.results(); // results from previous loop

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
          this.pushReadyNodesIntoQueue();
          return;
        }
      }
      this.onComplete();
    }
  }

  public appendLog(log: TransactionLog) {
    this.logs.push(log);
    this.onLogCallback(log, false);
  }

  public updateLog(log: TransactionLog) {
    this.onLogCallback(log, true);
  }

  // Public API
  public transactionLogs() {
    return this.logs;
  }

  // Public API
  public injectValue(nodeId: string, value: ResultData): void {
    const node = this.nodes[nodeId];
    if (node && node.isStaticNode) {
      node.injectValue(value);
    } else {
      console.error("-- Invalid nodeId", nodeId);
    }
  }

  public resultsOf(sources: Array<DataSource>) {
    return sources.map((source) => {
      const result = this.nodes[source.nodeId].result;
      return result && source.propId ? result[source.propId] : result;
    });
  }
}
