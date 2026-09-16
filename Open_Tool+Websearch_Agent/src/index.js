import express from 'express';
import { agent } from './agent';

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    return res.status(200).send("Perfectly well");
})

app.post("/call", async (req, res) => {
    const { query } = req.body;
    if (!query?.length) {
        return res.status(401).send({ message: "Please send some query" });
    }
    console.log(query);

    // set sse header 
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    res.flushHeaders();

    try {
        const stream = await agent.stream({
            messages: [
                {
                    role: "human",
                    content: query
                }
            ]
        },
            {
                streamMode: "messages"
            }
        );

        let gatheredText = "";
        for await (const [message, metadata] of stream) {
            console.log("EVENT node:", metadata?.langgraph_node, "| content:", message?.content);

            let contentText = "";
            if (typeof message.content === "string") {
                contentText = message.content;
            } else if (Array.isArray(message.content)) {
                contentText = message.content
                    .map((item) => (typeof item === "string" ? item : item?.text || ""))
                    .join("");
            }

            if (contentText) {
                gatheredText += contentText;
                res.write(`data: ${JSON.stringify({ type: "token", content: contentText })}\n\n`);
                if (typeof res.flush === "function") res.flush();
            }
        }


        res.write(`data: ${JSON.stringify({
            type: "done",
            content : gatheredText
        })}\n\n`);
        if (typeof res.flush === "function") res.flush();
        res.end();
    }
    // const responseState = await agent.invoke({
    //     messages : [
    //         {
    //             role: "human",
    //             content: query
    //         }
    //     ]
    // })

    // const totalMessages = responseState.messages;
    // const finalAnswer = totalMessages[totalMessages.length - 1].content;

    // return res.status(200).json({ response: finalAnswer });
    // return res.status(400).json({ message: query });

    catch (error) {
        console.log(error);

        if (!res.writableEnded) {
            res.write(
                `data: ${JSON.stringify({
                    type: "error",
                    message: error?.message || "Something went wrong",
                    code: error?.code || error?.status || undefined
                })}\n\n`
            );
            if (typeof res.flush === "function") res.flush();
            res.end();
        }
    }
})

const port = 3000;

app.listen(port, () => {
    console.log(`app is listen to port no:${port}`)
});