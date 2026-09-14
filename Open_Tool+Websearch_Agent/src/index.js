import express from 'express';
import { agent } from './agent';
import { FaissStore } from '@langchain/community/vectorstores/faiss';

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    return res.status(200).send("Perfectly well");
})

app.post("/call", async(req, res) => {
    const { query } = req.body;
    if (!query?.length) {
        return res.status(401).send({ message: "Please send some query" });
    }
    console.log(query);
    const responseState = await agent.invoke({
        messages : [
            {
                role: "human",
                content: query
            }
        ]
    })

    const totalMessages = responseState.messages;
    const finalAnswer = totalMessages[totalMessages.length - 1].content;

    return res.status(200).json({ response: finalAnswer });
    // return res.status(400).json({ message: query });
})

const port = 3000;

app.listen(port, () => {
    console.log(`app is listen to port no:${port}`)
});