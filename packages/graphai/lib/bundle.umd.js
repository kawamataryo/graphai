!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports):"function"==typeof define&&define.amd?define(["exports"],e):e((t="undefined"!=typeof globalThis?globalThis:t||self).graphai={})}(this,(function(t){"use strict";const e=t=>{if("string"==typeof t){const e=/^:(.*)$/,s=t.match(e);if(!s)return{value:t};const n=s[1].split(".");return 1==n.length?{nodeId:n[0]}:{nodeId:n[0],propIds:n.slice(1)}}return{value:t}};function s(t,e,s=!1){if(!t){if(!s)throw new Error(e);console.warn("warn: "+e)}}const n=t=>null!==t&&"object"==typeof t,i=t=>null==t,r="Intentional Error for Debugging",o={name:"defaultAgentInfo",samples:[{inputs:[],params:{},result:{}}],description:"",category:[],author:"",repository:"",license:""},a=t=>{const e=[];return Object.keys(t).forEach((s=>{e.push([s]),Object.keys(t[s]).length>0&&a(t[s]).forEach((t=>{e.push([s,...t])}))})),e},h=t=>null==t||"string"==typeof t?{}:Array.isArray(t)?Array.from(t.keys()).reduce(((e,s)=>(e["$"+String(s)]=h(t[s]),e)),{}):Object.keys(t).reduce(((e,s)=>(e[s]=h(t[s]),e)),{}),u=t=>!!(Array.isArray(t)?0!==t.length:t),d=t=>n(t)&&!Array.isArray(t)&&Object.keys(t||{}).length>0,c=t=>{if(Array.isArray(t))return t.map((t=>c(t))).flat();if(n(t))return Object.values(t).map((t=>c(t))).flat();if("string"==typeof t){const e=[...t.matchAll(/\${(:[^}]+)}/g)].map((t=>t[1]));if(e.length>0)return c(e)}return e(t)},l=t=>t.filter((t=>t.nodeId)).map((t=>t.nodeId));var g;t.NodeState=void 0,(g=t.NodeState||(t.NodeState={})).Waiting="waiting",g.Queued="queued",g.Executing="executing",g.ExecutingServer="executing-server",g.Failed="failed",g.TimedOut="timed-out",g.Completed="completed",g.Injected="injected",g.Skipped="skipped";class p{constructor(e){this.nodeId=e,this.state=t.NodeState.Waiting}initForComputedNode(t,e){this.agentId=t.getAgentId(),this.params=t.params,e.appendLog(this)}onInjected(t,e,s){const n="endTime"in this;this.result=t.result,this.state=t.state,this.endTime=Date.now(),this.injectFrom=s,e.setLoopLog(this),n?e.updateLog(this):e.appendLog(this)}onComplete(t,e,s){var n,i;this.result=t.result,this.resultKeys=(n=this.agentId||"",i=t.result,a({[n]:h(i)}).map((t=>":"+t.join(".")))),this.state=t.state,this.endTime=Date.now(),e.setLoopLog(this),s.length>0&&(this.log=s),e.updateLog(this)}beforeExecute(t,e,s,n){this.state=t.state,this.retryCount=t.retryCount>0?t.retryCount:void 0,this.startTime=s,this.inputs=l(t.dataSources),this.inputsData=n.length>0?n:void 0,e.setLoopLog(this),e.appendLog(this)}beforeAddTask(t,e){this.state=t.state,e.setLoopLog(this),e.appendLog(this)}onError(t,e,s){this.state=t.state,this.errorMessage=s,this.endTime=Date.now(),e.setLoopLog(this),e.updateLog(this)}onSkipped(t,e){this.state=t.state,e.setLoopLog(this),e.updateLog(this)}}class f{constructor(e,s){this.waitlist=new Set,this.state=t.NodeState.Waiting,this.result=void 0,this.nodeId=e,this.graph=s,this.log=new p(e),this.console={}}asString(){return`${this.nodeId}: ${this.state} ${[...this.waitlist]}`}onSetResult(){this.waitlist.forEach((t=>{const e=this.graph.nodes[t];e.isComputedNode&&(e.removePending(this.nodeId),this.graph.pushQueueIfReadyAndRunning(e))}))}afterConsoleLog(t){!0===this.console.after?console.log("string"==typeof t?t:JSON.stringify(t,null,2)):this.console.after&&console.log(this.console.after)}}class y extends f{constructor(t,n,i,r){if(super(n,r),this.retryCount=0,this.dataSources=[],this.isStaticNode=!1,this.isComputedNode=!0,this.graphId=t,this.params=i.params??{},this.console=i.console??{},this.filterParams=i.filterParams??{},this.passThrough=i.passThrough,this.retryLimit=i.retry??r.retryLimit??0,this.timeout=i.timeout,this.isResult=i.isResult??!1,this.priority=i.priority??0,this.anyInput=i.anyInput??!1,this.inputs=i.inputs,this.dataSources=i.inputs?c(i.inputs).flat(10):[],i.inputs&&Array.isArray(i.inputs))throw new Error(`array inputs have been deprecated. nodeId: ${n}: see https://github.com/receptron/graphai/blob/main/docs/NamedInputs.md`);if(this.pendings=new Set(l(this.dataSources)),s(["function","string"].includes(typeof i.agent),"agent must be either string or function"),"string"==typeof i.agent)this.agentId=i.agent;else{const t=i.agent;this.agentFunction=async({namedInputs:e,params:s})=>t(e,s)}i.graph&&(this.nestedGraph="string"==typeof i.graph?this.addPendingNode(i.graph):i.graph),i.graphLoader&&r.graphLoader&&(this.nestedGraph=r.graphLoader(i.graphLoader)),i.if&&(this.ifSource=this.addPendingNode(i.if)),i.unless&&(this.unlessSource=this.addPendingNode(i.unless)),this.dynamicParams=Object.keys(this.params).reduce(((t,n)=>{const i=e(this.params[n]);return i.nodeId&&(s(!this.anyInput,"Dynamic params are not supported with anyInput"),t[n]=i,this.pendings.add(i.nodeId)),t}),{}),this.log.initForComputedNode(this,r)}getAgentId(){return this.agentId??"__custom__function"}addPendingNode(t){const n=e(t);return s(!!n.nodeId,`Invalid data source ${t}`),this.pendings.add(n.nodeId),n}isReadyNode(){return this.state===t.NodeState.Waiting&&0===this.pendings.size&&(!(this.ifSource&&!u(this.graph.resultOf(this.ifSource))||this.unlessSource&&u(this.graph.resultOf(this.unlessSource)))||(this.state=t.NodeState.Skipped,this.log.onSkipped(this,this.graph),!1))}retry(t,e){this.state=t,this.log.onError(this,this.graph,e.message),this.retryCount<this.retryLimit?(this.retryCount++,this.execute()):(this.result=void 0,this.error=e,this.transactionId=void 0,this.graph.onExecutionComplete(this))}checkDataAvailability(){return Object.values(this.graph.resultsOf(this.inputs)).flat().some((t=>void 0!==t))}beforeAddTask(){this.state=t.NodeState.Queued,this.log.beforeAddTask(this,this.graph)}removePending(t){this.anyInput?this.checkDataAvailability()&&this.pendings.clear():this.pendings.delete(t)}isCurrentTransaction(t){return this.transactionId===t}executeTimeout(e){this.state===t.NodeState.Executing&&this.isCurrentTransaction(e)&&(console.warn(`-- timeout ${this.timeout} with ${this.nodeId}`),this.retry(t.NodeState.TimedOut,Error("Timeout")))}shouldApplyAgentFilter(t){return!!(t.agentIds&&Array.isArray(t.agentIds)&&t.agentIds.length>0&&this.agentId&&t.agentIds.includes(this.agentId))||(!!(t.nodeIds&&Array.isArray(t.nodeIds)&&t.nodeIds.length>0&&t.nodeIds.includes(this.nodeId))||!t.agentIds&&!t.nodeIds)}agentFilterHandler(t,e){let s=0;const n=t=>{const i=this.graph.agentFilters[s++];return i?this.shouldApplyAgentFilter(i)?(i.filterParams&&(t.filterParams={...i.filterParams,...t.filterParams}),i.agent(t,n)):n(t):e(t)};return n(t)}async execute(){const e=this.graph.resultsOf(this.inputs,this.anyInput),s=Date.now();this.prepareExecute(s,Object.values(e)),this.timeout&&this.timeout>0&&setTimeout((()=>{this.executeTimeout(s)}),this.timeout);try{const n=this.agentFunction??this.graph.getAgentFunctionInfo(this.agentId).agent,i=[],r=this.getContext(e,i);this.nestedGraph&&(this.graph.taskManager.prepareForNesting(),r.onLogCallback=this.graph.onLogCallback,r.forNestedGraph={graphData:"nodes"in this.nestedGraph?this.nestedGraph:this.graph.resultOf(this.nestedGraph),agents:this.graph.agentFunctionInfoDictionary,graphOptions:{agentFilters:this.graph.agentFilters,taskManager:this.graph.taskManager,bypassAgentIds:this.graph.bypassAgentIds,config:this.graph.config,graphLoader:this.graph.graphLoader},onLogCallback:this.graph.onLogCallback}),this.beforeConsoleLog(r);const o=await this.agentFilterHandler(r,n);if(this.afterConsoleLog(o),this.nestedGraph&&this.graph.taskManager.restoreAfterNesting(),!this.isCurrentTransaction(s))return void console.log(`-- transactionId mismatch with ${this.nodeId} (probably timeout)`);this.state=t.NodeState.Completed,this.result=this.getResult(o),this.log.onComplete(this,this.graph,i),this.onSetResult(),this.graph.onExecutionComplete(this)}catch(t){this.errorProcess(t,s,e)}}prepareExecute(e,s){this.state=t.NodeState.Executing,this.log.beforeExecute(this,this.graph,e,s),this.transactionId=e}errorProcess(e,s,n){e instanceof Error&&e.message!==r&&(console.error(`<-- NodeId: ${this.nodeId}, Agent: ${this.agentId}`),console.error({namedInputs:n}),console.error(e),console.error("--\x3e")),this.isCurrentTransaction(s)?e instanceof Error?this.retry(t.NodeState.Failed,e):(console.error(`-- NodeId: ${this.nodeId}: Unknown error was caught`),this.retry(t.NodeState.Failed,Error("Unknown"))):console.warn(`-- transactionId mismatch with ${this.nodeId} (not timeout)`)}getParams(){return Object.keys(this.dynamicParams).reduce(((t,e)=>{const s=this.graph.resultOf(this.dynamicParams[e]);return t[e]=s,t}),{...this.params})}getContext(t,e){return{params:this.getParams(),namedInputs:t,inputSchema:this.agentFunction?void 0:this.graph.getAgentFunctionInfo(this.agentId)?.inputs,debugInfo:this.getDebugInfo(),cacheType:this.agentFunction?void 0:this.graph.getAgentFunctionInfo(this.agentId)?.cacheType,filterParams:this.filterParams,agentFilters:this.graph.agentFilters,config:this.graph.config,log:e}}getResult(t){if(t&&this.passThrough){if(n(t)&&!Array.isArray(t))return{...t,...this.passThrough};if(Array.isArray(t))return t.map((t=>n(t)&&!Array.isArray(t)?{...t,...this.passThrough}:t))}return t}getDebugInfo(){return{nodeId:this.nodeId,agentId:this.agentId,retry:this.retryCount,verbose:this.graph.verbose,version:this.graph.version,isResult:this.isResult}}beforeConsoleLog(t){!0===this.console.before?console.log(JSON.stringify(t.namedInputs,null,2)):this.console.before&&console.log(this.console.before)}}class m extends f{constructor(t,s,n){super(t,n),this.isStaticNode=!0,this.isComputedNode=!1,this.value=s.value,this.update=s.update?e(s.update):void 0,this.isResult=s.isResult??!1,this.console=s.console??{}}injectValue(e,s){this.state=t.NodeState.Injected,this.result=e,this.log.onInjected(this,this.graph,s),this.onSetResult()}consoleLog(){this.afterConsoleLog(this.result)}}const I=/^[a-zA-Z]+\([^)]*\)$/,w=[(t,e)=>{if(Array.isArray(t)){if("length()"===e)return t.length;if("flat()"===e)return t.flat();if("toJSON()"===e)return JSON.stringify(t);if("isEmpty()"===e)return 0===t.length;const s=e.match(/^join\(([,-]?)\)$/);if(s&&Array.isArray(s))return t.join(s[1]??"")}},(t,e)=>{if(n(t)){if("keys()"===e)return Object.keys(t);if("values()"===e)return Object.values(t);if("toJSON()"===e)return JSON.stringify(t)}},(t,e)=>{if("string"==typeof t){if("codeBlock()"===e){const e=("\n"+t).match(/\n```[a-zA-z]*([\s\S]*?)\n```/);if(e)return e[1]}if("jsonParse()"===e)return JSON.parse(t);if("toNumber()"===e){const e=Number(t);if(!isNaN(e))return e}if("trim()"===e)return t.trim();if("toLowerCase()"===e)return t.toLowerCase();if("toUpperCase()"===e)return t.toUpperCase()}},(t,e)=>{if(void 0!==t&&Number.isFinite(t)){if("toString()"===e)return String(t);const s=/^add\((-?\d+)\)$/,n=e.match(s);if(n)return Number(t)+Number(n[1])}},(t,e)=>{if("boolean"==typeof t&&"not()"===e)return!t}],b=(t,e,s)=>{if(!i(t)&&e&&e.length>0){const r=((t,e,s)=>{if(e.match(I))for(const n of s){const s=n(t,e);if(!i(s))return s}if(Array.isArray(t)){const s=/^\$(\d+)$/,n=e.match(s);if(n)return t[parseInt(n[1],10)];if("$last"===e)return t[t.length-1]}else if(n(t)&&e in t)return t[e]})(t,e[0],s);return void 0===r&&console.error(`prop: ${e.join(".")} is not hit`),e.length>1?b(r,e.slice(1),s):r}return t},N=(t,e,s=[])=>e.nodeId?b(t,e.propIds,s):e.value,v=(t,s,n)=>{if(Array.isArray(t))return t.map((t=>v(t,s,n)));if(d(t))return k(t,s,n);if("string"==typeof t){const e=[...t.matchAll(/\${(:[^}]+)}/g)].map((t=>t[1]));if(e.length>0){const i=v(e,s,n);return Array.from(e.keys()).reduce(((t,s)=>t.replaceAll("${"+e[s]+"}",i[s])),t)}}return A(e(t),s,n)},k=(t,e,s)=>Array.isArray(t)?t.reduce(((t,n)=>(t[n]=v(n,e,s),t)),{}):Object.keys(t).reduce(((n,i)=>{const r=t[i];return n[i]=d(r)?k(r,e,s):v(r,e,s),n}),{}),A=(t,e,s)=>{const{result:n}=t.nodeId?e[t.nodeId]:{result:void 0};return N(n,t,s)},S=t=>Array.isArray(t)?t.map((t=>S(t))).filter((t=>!i(t))):n(t)?Object.keys(t).reduce(((e,s)=>{const n=S(t[s]);return i(n)||(e[s]=n),e}),{}):t,L=["nodes","concurrency","agentId","loop","verbose","version"],C=["inputs","anyInput","params","retry","timeout","agent","graph","graphLoader","isResult","priority","if","unless","filterParams","console","passThrough"],j=["value","update","isResult","console"];class O extends Error{constructor(t){super(`[41m${t}[0m`),Object.setPrototypeOf(this,O.prototype)}}const E=(t,s)=>{(t=>{if(void 0===t.nodes)throw new O("Invalid Graph Data: no nodes");if("object"!=typeof t.nodes)throw new O("Invalid Graph Data: invalid nodes");if(Array.isArray(t.nodes))throw new O("Invalid Graph Data: nodes must be object");if(0===Object.keys(t.nodes).length)throw new O("Invalid Graph Data: nodes is empty");Object.keys(t).forEach((t=>{if(!L.includes(t))throw new O("Graph Data does not allow "+t)}))})(t),(t=>{if(t.loop){if(void 0===t.loop.count&&void 0===t.loop.while)throw new O("Loop: Either count or while is required in loop");if(void 0!==t.loop.count&&void 0!==t.loop.while)throw new O("Loop: Both count and while cannot be set")}if(void 0!==t.concurrency){if(!Number.isInteger(t.concurrency))throw new O("Concurrency must be an integer");if(t.concurrency<1)throw new O("Concurrency must be a positive integer")}})(t);const n=[],i=[],r=new Set;return Object.keys(t.nodes).forEach((e=>{const s=t.nodes[e],o="value"in s;(t=>{if(t.agent&&t.value)throw new O("Cannot set both agent and value");if(!("agent"in t)&&!("value"in t))throw new O("Either agent or value is required")})(s);const a=o?"":s.agent;var h;o&&(h=s,Object.keys(h).forEach((t=>{if(!j.includes(t))throw new O("Static node does not allow "+t)})),1)&&i.push(e),!o&&(t=>(Object.keys(t).forEach((t=>{if(!C.includes(t))throw new O("Computed node does not allow "+t)})),!0))(s)&&n.push(e)&&"string"==typeof a&&r.add(a)})),((t,e)=>{t.forEach((t=>{if(!e.has(t))throw new O("Invalid Agent : "+t+" is not in AgentFunctionInfoDictionary.")}))})(r,new Set(s)),((t,s,n)=>{const i=new Set(Object.keys(t.nodes)),r={},o={};n.forEach((e=>{const s=t.nodes[e];r[e]=new Set;const n=(t,s)=>{s.forEach((s=>{if(s){if(!i.has(s))throw new O(`${t} not match: NodeId ${e}, Inputs: ${s}`);void 0===o[s]&&(o[s]=new Set),r[e].add(s),o[s].add(e)}}))};"agent"in s&&s&&(s.inputs&&n("Inputs",l(c(s.inputs))),s.if&&n("If",l(c({if:s.if}))),s.unless&&n("Unless",l(c({unless:s.unless}))),s.graph&&"string"==typeof s?.graph&&n("Graph",l(c({graph:s.graph}))))})),s.forEach((s=>{const n=t.nodes[s];if("value"in n&&n.update){const t=n.update,r=e(t).nodeId;if(!r)throw new O("Update it a literal");if(!i.has(r))throw new O(`Update not match: NodeId ${s}, update: ${t}`)}}));const a=t=>{t.forEach((t=>{(o[t]||[]).forEach((e=>{r[e].delete(t)}))}));const e=[];return Object.keys(r).forEach((t=>{0===r[t].size&&(e.push(t),delete r[t])})),e};let h=a(s);if(0===h.length)throw new O("No Initial Runnning Node");do{h=a(h)}while(h.length>0);if(Object.keys(r).length>0)throw new O("Some nodes are not executed: "+Object.keys(r).join(", "))})(t,i,n),!0};class T{constructor(t){this.taskQueue=[],this.runningNodes=new Set,this.concurrency=t}dequeueTaskIfPossible(){if(this.runningNodes.size<this.concurrency){const t=this.taskQueue.shift();t&&(this.runningNodes.add(t.node),t.callback(t.node))}}addTask(t,e,n){const i=this.taskQueue.filter((e=>e.node.priority>=t.priority)).length;s(i<=this.taskQueue.length,"TaskManager.addTask: Something is really wrong."),this.taskQueue.splice(i,0,{node:t,graphId:e,callback:n}),this.dequeueTaskIfPossible()}isRunning(t){return[...this.runningNodes].filter((e=>e.graphId==t)).length>0||Array.from(this.taskQueue).filter((e=>e.graphId===t)).length>0}onComplete(t){s(this.runningNodes.has(t),`TaskManager.onComplete node(${t.nodeId}) is not in list`),this.runningNodes.delete(t),this.dequeueTaskIfPossible()}prepareForNesting(){this.concurrency++}restoreAfterNesting(){this.concurrency--}getStatus(t=!1){const e=Array.from(this.runningNodes).map((t=>t.nodeId)),s=this.taskQueue.map((t=>t.node.nodeId)),n=t?{runningNodes:e,queuedNodes:s}:{};return{concurrency:this.concurrency,queue:this.taskQueue.length,running:this.runningNodes.size,...n}}}const F=.5;t.GraphAI=class{createNodes(t){const e=Object.keys(t.nodes).reduce(((e,s)=>{const n=t.nodes[s];if("value"in n)e[s]=new m(s,n,this);else{if(!("agent"in n))throw new Error("Unknown node type (neither value nor agent): "+s);e[s]=new y(this.graphId,s,n,this)}return e}),{});return Object.keys(e).forEach((t=>{const s=e[t];s.isComputedNode&&s.pendings.forEach((s=>{if(!e[s])throw new Error(`createNode: invalid input ${s} for node, ${t}`);e[s].waitlist.add(t)}))})),e}getValueFromResults(t,e){return N(t.nodeId?e[t.nodeId]:void 0,t,this.propFunctions)}initializeStaticNodes(t=!1){Object.keys(this.data.nodes).forEach((e=>{const s=this.nodes[e];if(s?.isStaticNode){const n=s?.value;void 0!==n&&this.injectValue(e,n,e),t&&s.consoleLog()}}))}updateStaticNodes(t,e=!1){Object.keys(this.data.nodes).forEach((s=>{const n=this.nodes[s];if(n?.isStaticNode){const i=n?.update;if(i&&t){const e=this.getValueFromResults(i,t);this.injectValue(s,e,i.nodeId)}e&&n.consoleLog()}}))}constructor(t,e,s={taskManager:void 0,agentFilters:[],bypassAgentIds:[],config:{},graphLoader:void 0}){this.logs=[],this.config={},this.onLogCallback=(t,e)=>{},this.repeatCount=0,t.version||s.taskManager||console.warn("------------ missing version number"),this.version=t.version??F,this.version<F&&console.warn("------------ upgrade to 0.5!"),this.retryLimit=t.retry,this.graphId=URL.createObjectURL(new Blob).slice(-36),this.data=t,this.agentFunctionInfoDictionary=e,this.propFunctions=w,this.taskManager=s.taskManager??new T(t.concurrency??8),this.agentFilters=s.agentFilters??[],this.bypassAgentIds=s.bypassAgentIds??[],this.config=s.config,this.graphLoader=s.graphLoader,this.loop=t.loop,this.verbose=!0===t.verbose,this.onComplete=()=>{throw new Error("SOMETHING IS WRONG: onComplete is called without run()")},E(t,[...Object.keys(e),...this.bypassAgentIds]),this.nodes=this.createNodes(t),this.initializeStaticNodes(!0)}getAgentFunctionInfo(t){if(t&&this.agentFunctionInfoDictionary[t])return this.agentFunctionInfoDictionary[t];if(t&&this.bypassAgentIds.includes(t))return{agent:async()=>null,inputs:null,cacheType:void 0};throw new Error("No agent: "+t)}asString(){return Object.values(this.nodes).map((t=>t.asString())).join("\n")}results(t){return Object.keys(this.nodes).filter((e=>t||this.nodes[e].isResult)).reduce(((t,e)=>{const s=this.nodes[e];return void 0!==s.result&&(t[e]=s.result),t}),{})}errors(){return Object.keys(this.nodes).reduce(((t,e)=>{const s=this.nodes[e];return s.isComputedNode&&void 0!==s.error&&(t[e]=s.error),t}),{})}pushReadyNodesIntoQueue(){Object.keys(this.nodes).forEach((t=>{const e=this.nodes[t];e.isComputedNode&&this.pushQueueIfReady(e)}))}pushQueueIfReady(t){t.isReadyNode()&&this.pushQueue(t)}pushQueueIfReadyAndRunning(t){this.isRunning()&&this.pushQueueIfReady(t)}pushQueue(t){t.beforeAddTask(),this.taskManager.addTask(t,this.graphId,(e=>{s(t.nodeId===e.nodeId,"GraphAI.pushQueue node mismatch"),t.execute()}))}async run(t=!1){if(this.isRunning())throw new Error("This GraphUI instance is already running");return this.pushReadyNodesIntoQueue(),this.isRunning()?new Promise(((e,s)=>{this.onComplete=()=>{const n=this.errors(),i=Object.keys(n);i.length>0?s(n[i[0]]):e(this.results(t))}})):(console.warn("-- nothing to execute"),{})}isRunning(){return this.taskManager.isRunning(this.graphId)}onExecutionComplete(t){this.taskManager.onComplete(t),this.isRunning()||this.processLoopIfNecessary()||this.onComplete()}processLoopIfNecessary(){this.repeatCount++;const t=this.loop;if(!t)return!1;const s=this.results(!0);if(this.updateStaticNodes(s),void 0===t.count||this.repeatCount<t.count){if(t.while){const s=e(t.while),n=this.getValueFromResults(s,this.results(!0));if(!u(n))return!1}return this.nodes=this.createNodes(this.data),this.initializeStaticNodes(),this.updateStaticNodes(s,!0),this.pushReadyNodesIntoQueue(),!0}return!1}setLoopLog(t){t.isLoop=!!this.loop,t.repeatCount=this.repeatCount}appendLog(t){this.logs.push(t),this.onLogCallback(t,!1)}updateLog(t){this.onLogCallback(t,!0)}transactionLogs(){return this.logs}injectValue(t,e,s){const n=this.nodes[t];if(!n||!n.isStaticNode)throw new Error(`injectValue with Invalid nodeId, ${t}`);n.injectValue(e,s)}resultsOf(t,e=!1){const s=k(t??[],this.nodes,this.propFunctions);return e?(t=>Object.keys(t).reduce(((e,s)=>{const n=S(t[s]);return i(n)||(e[s]=n),e}),{}))(s):s}resultOf(t){return A(t,this.nodes,this.propFunctions)}},t.ValidationError=O,t.agentInfoWrapper=t=>({agent:t,mock:t,...o}),t.assert=s,t.defaultAgentInfo=o,t.defaultConcurrency=8,t.defaultTestContext={debugInfo:{nodeId:"test",retry:0,verbose:!0},params:{},filterParams:{},agents:{},log:[]},t.graphDataLatestVersion=F,t.inputs2dataSources=c,t.isObject=n,t.parseNodeName=e,t.sleep=async t=>await new Promise((e=>setTimeout(e,t))),t.strIntentionalError=r}));
//# sourceMappingURL=bundle.umd.js.map
