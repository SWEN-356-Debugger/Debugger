import vscode from "vscode";
import fs from 'fs';
import { AIRequest } from "../types/AIRequest";
import { AIFeedback } from "../types/AIFeedback";
import { APICaller } from "../types/APICaller";
import { settings } from "../settings";
import { fileFromPath } from "openai/_shims/registry.mjs";
import { Message } from "openai/resources/beta/threads/messages.mjs";
import { Assistant } from "openai/resources/beta/assistants.mjs";
import { VectorStore } from "openai/resources/beta/index.mjs";

export class OpenAICaller implements APICaller {
    response!: VectorStore;
    assistant!: Assistant;

    async setup() {
        // TODO: check if key valid or something (it will not work if the key is invalid you will be waiting forever)
        this.response = await settings.openai.beta.vectorStores.create({
            name: "Debugging Assistant Vector Store"
        });
        this.assistant = await settings.openai.beta.assistants.create({
            name: "Assistant",
            model: "gpt-4o-mini",
            instructions: `
                        You are a helpful code debugging assistant that is knowledgable on runtime and compile-time errors.
                        
                        The user will ask for assistance by supplying a JSON object with contextual information. The format of this request is:
                        {
                            prompt: string; // This is the message of assistance sent by the user.
                        }

                        You must analyze their issue and all contextual information to eliminate the issue altogether. You MUST respond with a JSON object in the following format, even if you are confused:
                        {
                            text: string; // Your solution and reasoning goes here.
                        }

                        Again, you CANNOT deviate from this request/response communication protocol defined above.
                        `,
            tools: [{"type": "file_search"}],
            tool_resources: {
                file_search: {
                    vector_store_ids: [this.response.id]  // Attach vector store containing your files
                }
            }
        });
        // Clear files
        // const list = await settings.openai.files.list()
        // for await (const file of list) {
        //     await settings.openai.files.del(file.id);
        // }

        // Clear Vector Stores
        // const vectorStores = await settings.openai.beta.vectorStores.list();
        // for await (const store of vectorStores) {
        //     vscode.window.showInformationMessage("Trying to delete store: " + store.id)
        //     await settings.openai.beta.vectorStores.del(store.id);
        //     vscode.window.showInformationMessage("Deleted store: " + store.id)
        // }
        
        vscode.window.showInformationMessage("Setup Complete!" + this.assistant.id);
    }
    
    constructor() {
        this.setup();
    }

    isConnected(): boolean {
        return !!settings.openai.apiKey;
    }

    async sendRequest(request: AIRequest): Promise<AIFeedback> {
        if(!this.isConnected()) {
            const answer = await vscode.window.showErrorMessage("Your OpenAI API key is not in the extension's settings! Please set it before continuing.", "Go To Settings");
            if(answer === "Go To Settings") {
                vscode.env.openExternal(vscode.Uri.parse("vscode://settings/debuggingAiAssistant.apiKey"));
            }
            return Promise.reject();
        }
        if (request.fileStructure) {
            const fileBuffer = fs.readFileSync(request.fileStructure[0])
            const blob = new Blob([fileBuffer], { type: "application/javascript" });
            const file = new File([blob], "test.js", { type: 'application/javascript' })
            const upload = await settings.openai.files.create({
                file: file,
                purpose: "assistants",
            })
            await blob.text();
            await settings.openai.beta.vectorStores.fileBatches.createAndPoll(this.response.id, {
                file_ids: [upload.id]
            });
            // TODO: ask ai what other files it would like maybe and then send it in
        };
        const thread = await settings.openai.beta.threads.create();
        const message = await settings.openai.beta.threads.messages.create(
            thread.id,
            {
              role: "user",
              content: `
                        {
                            "prompt": "${request.prompt}'"
                        }
                        `
            }
        );
        const run = await settings.openai.beta.threads.runs.create(thread.id, {
            assistant_id: this.assistant.id
        })
        let retrievedRun = await settings.openai.beta.threads.runs.retrieve(thread.id, run.id);
        while (retrievedRun.status !== "completed") {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
            retrievedRun = await settings.openai.beta.threads.runs.retrieve(thread.id, run.id);
        }

        const responseMessages: Message[] = (
            await settings.openai.beta.threads.messages.list(thread.id, {
                after: message.id,
                order: 'asc',
            })
        ).data;
        let responseText = ''
        for (const message of responseMessages) {
            if (message.content[0].type == 'text') {
                responseText = message.content[0].text.value
            }
        }
        var json = JSON.parse(responseText);
        if (json.text != undefined)
            responseText = json.text

        let feedback: AIFeedback = {
            request: request,
            text: responseText
        };
        return feedback;
    }

    followUp(response: AIFeedback): Promise<AIFeedback> {
        let newRequest: AIRequest = { prompt: "Test" };
        let finalResponse: AIFeedback = {request: newRequest, filename: response.filename, line: response.line, text: ""};

        // TODO: implement this

        return new Promise(() => finalResponse);
    }
}