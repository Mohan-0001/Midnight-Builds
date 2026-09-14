import 'dotenv/config'
import { ChatGroq } from "@langchain/groq"
import { MessagesAnnotation, StateGraph, START, END } from "@langchain/langgraph";
import SearchTool from "./tools/searchTool.js";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";


const tools = [SearchTool]

const model = new ChatOpenAI({
  model: "nvidia/nemotron-3-ultra-550b-a55b", // long-horizon agentic/coding flagship on NIM
  apiKey: process.env.NVIDIA_API_KEY,
  configuration: {
    baseURL: "https://integrate.api.nvidia.com/v1",
  },
  temperature: 0.4,
  topP: 0.95,
  maxTokens: 16384,
  // NVIDIA's reasoning models need this passed through the request body
  modelKwargs: {
    chat_template_kwargs: { enable_thinking: true },
  },
});



const modelWithTool = model.bindTools(tools);

const callAgent = async(state) => {
    const res = await modelWithTool.invoke(state.messages);

    console.log(state);
    return {messages: [res] };
}

const toolNode = new ToolNode(tools);

const GraphState = new StateGraph(MessagesAnnotation);

GraphState.addNode("agent", callAgent)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition)
    .addEdge("tools", "agent");

const agent = GraphState.compile();


export { agent };