import vscode from "vscode";
import { Settings } from "./types/Settings";
import OpenAI from "openai";

export let settings: Settings;

export function initSettings() {
    settings = {
        openai: new OpenAI({ apiKey: vscode.workspace.getConfiguration("debuggingAiAssistant").get("apiKey")! })
    };

    vscode.workspace.onDidChangeConfiguration(event => {
        if(event.affectsConfiguration("debuggingAiAssistant.apiKey")) {
            settings.openai.apiKey = vscode.workspace.getConfiguration("debuggingAiAssistant").get("apiKey")!;
        }
    });
} 