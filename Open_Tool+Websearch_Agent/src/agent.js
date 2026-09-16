import 'dotenv/config'
import { ChatGroq } from "@langchain/groq"
import { MessagesAnnotation, StateGraph, START, END } from "@langchain/langgraph";
import SearchTool from "./tools/searchTool.js";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from '@langchain/openai';

const tools = [SearchTool];

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

// const model = new ChatGroq({
//     model: 'openai/gpt-oss-120b',
//     maxTokens: 16512,
//     maxRetries: 2,
//     temperature: 0.2,
// });

const modelWithTool = model.bindTools(tools);

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callAgent = async (state) => {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const tokenStream = await modelWithTool.stream(state.messages);

            let gathered;
            for await (const chunk of tokenStream) {
                console.log("CHUNK:", JSON.stringify(chunk.content), chunk.tool_call_chunks);
                gathered = gathered ? gathered.concat(chunk) : chunk;
            }

            console.log("FINAL:", gathered?.content);
            return { messages: [gathered] };
        } catch (err) {
            lastError = err;
            const isOverloaded = err?.code === 503 ||
                err?.status === 503 ||
                (err?.message && err.message.toLowerCase().includes("overloaded")) ||
                (err?.message && err.message.toLowerCase().includes("service unavailable"));

            if (isOverloaded && attempt < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * attempt;
                console.warn(`[Agent] NVIDIA 503 overloaded. Retry ${attempt}/${MAX_RETRIES - 1} in ${delay}ms...`);
                await sleep(delay);
            } else {
                throw err;
            }
        }
    }
    throw lastError;
};

const toolNode = new ToolNode(tools);
const GraphState = new StateGraph(MessagesAnnotation);

GraphState.addNode("agent", callAgent)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition)
    .addEdge("tools", "agent");

const agent = GraphState.compile();
export { agent };