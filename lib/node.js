"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticNode = exports.ComputedNode = exports.Node = void 0;
const utils_1 = require("./utils/utils");
const type_1 = require("./type");
const utils_2 = require("./utils/utils");
const transaction_log_1 = require("./transaction_log");
class Node {
    constructor(nodeId, graph) {
        this.waitlist = new Set(); // List of nodes which need data from this node.
        this.state = type_1.NodeState.Waiting;
        this.result = undefined;
        this.nodeId = nodeId;
        this.graph = graph;
        this.log = new transaction_log_1.TransactionLog(nodeId);
    }
    asString() {
        return `${this.nodeId}: ${this.state} ${[...this.waitlist]}`;
    }
    // This method is called either as the result of computation (computed node) or
    // injection (static node).
    onSetResult() {
        this.waitlist.forEach((waitingNodeId) => {
            const waitingNode = this.graph.nodes[waitingNodeId];
            if (waitingNode.isComputedNode) {
                waitingNode.removePending(this.nodeId);
                this.graph.pushQueueIfReadyAndRunning(waitingNode);
            }
        });
    }
}
exports.Node = Node;
class ComputedNode extends Node {
    constructor(graphId, nodeId, data, graph) {
        super(nodeId, graph);
        this.retryCount = 0;
        this.isStaticNode = false;
        this.isComputedNode = true;
        this.graphId = graphId;
        this.params = data.params ?? {};
        this.nestedGraph = data.graph;
        this.agentId = data.agentId;
        this.retryLimit = data.retry ?? 0;
        this.timeout = data.timeout;
        this.isResult = data.isResult ?? false;
        this.anyInput = data.anyInput ?? false;
        this.dataSources = (data.inputs ?? []).map(utils_2.parseNodeName);
        this.pendings = new Set(this.dataSources.map((source) => source.nodeId));
        this.log.initForComputedNode(this);
    }
    isReadyNode() {
        if (this.state === type_1.NodeState.Waiting && this.pendings.size === 0) {
            // Notice that this logic enables dynamic data-flows for anyInput case.
            return !this.anyInput || this.checkDataAvailability();
        }
        return false;
    }
    // This private method (only called while executing execute()) performs
    // the "retry" if specified. The transaction log must be updated before
    // callling this method.
    retry(state, error) {
        this.state = state; // this.execute() will update to NodeState.Executing
        this.log.onError(this, this.graph, error.message);
        if (this.retryCount < this.retryLimit) {
            this.retryCount++;
            this.execute();
        }
        else {
            this.result = undefined;
            this.error = error;
            this.transactionId = undefined; // This is necessary for timeout case
            this.graph.onExecutionComplete(this);
        }
    }
    checkDataAvailability() {
        (0, utils_2.assert)(this.anyInput, "checkDataAvailability should be called only for anyInput case");
        const results = this.graph.resultsOf(this.dataSources, true).filter((result) => {
            return result !== undefined;
        });
        return results.length > 0;
    }
    // This method is called when the data became available on one of nodes,
    // which this node needs data from.
    removePending(nodeId) {
        if (this.anyInput) {
            if (this.checkDataAvailability()) {
                this.pendings.clear();
            }
        }
        else {
            this.pendings.delete(nodeId);
        }
    }
    isCurrentTransaction(transactionId) {
        return this.transactionId === transactionId;
    }
    // This private method (called only fro execute) checks if the callback from
    // the timer came before the completion of agent function call, record it
    // and attempt to retry (if specified).
    executeTimeout(transactionId) {
        if (this.state === type_1.NodeState.Executing && this.isCurrentTransaction(transactionId)) {
            console.log(`-- ${this.nodeId}: timeout ${this.timeout}`);
            this.retry(type_1.NodeState.TimedOut, Error("Timeout"));
        }
    }
    // This method is called when this computed node became ready to run.
    // It asynchronously calls the associated with agent function and set the result,
    // then it removes itself from the "running node" list of the graph.
    // Notice that setting the result of this node may make other nodes ready to run.
    async execute() {
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
            const callback = this.graph.getCallback(this.agentId);
            const localLog = [];
            const context = {
                params: this.params,
                inputs: previousResults,
                debugInfo: {
                    nodeId: this.nodeId,
                    retry: this.retryCount,
                    verbose: this.graph.verbose,
                },
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
            const result = await callback(context);
            if (this.nestedGraph) {
                this.graph.taskManager.restoreAfterNesting();
            }
            if (!this.isCurrentTransaction(transactionId)) {
                // This condition happens when the agent function returns
                // after the timeout (either retried or not).
                console.log(`-- ${this.nodeId}: transactionId mismatch`);
                return;
            }
            this.state = type_1.NodeState.Completed;
            this.result = result;
            this.log.onComplete(this, this.graph, localLog);
            this.onSetResult();
            this.graph.onExecutionComplete(this);
        }
        catch (error) {
            this.errorProcess(error, transactionId);
        }
    }
    // This private method (called only by execute()) prepares the ComputedNode object
    // for execution, and create a new transaction to record it.
    prepareExecute(transactionId, inputs) {
        this.state = type_1.NodeState.Executing;
        this.log.beforeExecute(this, this.graph, transactionId, inputs);
        this.transactionId = transactionId;
    }
    // This private method (called only by execute) processes an error received from
    // the agent function. It records the error in the transaction log and handles
    // the retry if specified.
    errorProcess(error, transactionId) {
        if (error instanceof Error && error.message !== utils_1.strIntentionalError) {
            console.error(this.agentId + ": error");
            console.error(error);
        }
        if (!this.isCurrentTransaction(transactionId)) {
            console.log(`-- ${this.nodeId}: transactionId mismatch(error)`);
            return;
        }
        if (error instanceof Error) {
            this.retry(type_1.NodeState.Failed, error);
        }
        else {
            console.error(`-- ${this.nodeId}: Unexpecrted error was caught`);
            this.retry(type_1.NodeState.Failed, Error("Unknown"));
        }
    }
}
exports.ComputedNode = ComputedNode;
class StaticNode extends Node {
    constructor(nodeId, data, graph) {
        super(nodeId, graph);
        this.isStaticNode = true;
        this.isComputedNode = false;
        this.value = data.value;
        this.update = data.update;
        this.isResult = data.isResult ?? false;
    }
    injectValue(value, injectFrom) {
        this.state = type_1.NodeState.Injected;
        this.result = value;
        this.log.onInjected(this, this.graph, injectFrom);
        this.onSetResult();
    }
}
exports.StaticNode = StaticNode;
