import * as vscode from "vscode";
import { OpenAICaller } from "./ai/OpenAICaller";
import { initSettings } from "./settings";
import { InlineDiagnostic } from "./extension/InlineDiagnostic";

export function activate(context: vscode.ExtensionContext) {
	initSettings();
	let caller: OpenAICaller = new OpenAICaller();
	const callAI = vscode.commands.registerCommand("debuggingAiAssistant.callAI", () => {
		
		context.asAbsolutePath("test.ts")
	 
		caller.sendRequest({ prompt: "What is wrong with the my file: test.js" , fileStructure: [vscode.workspace.workspaceFolders![0].uri.fsPath.toString() + "\\test.js"]}).then(response => {
			vscode.window.showInformationMessage(`Response: ${response.text}`);
		});
	});

	const sendError = vscode.commands.registerCommand("debuggingAiAssistant.sendError", () => {
		const file: vscode.Uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, "test.js");
		const inline: InlineDiagnostic = new InlineDiagnostic(file, new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), "Test Message");
		inline.show();
	});

	context.subscriptions.push(callAI);
	context.subscriptions.push(sendError);
}

export function deactivate() {}