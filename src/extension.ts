import path from "path";
import * as vscode from "vscode";
import * as fs from 'fs';
import sizeOf from 'image-size';


export function activate(context: vscode.ExtensionContext) {
	const supportedLanguages = ["javascript", 'typescript'];

	const provider = vscode.languages.registerHoverProvider(supportedLanguages, {
		async provideHover(document, position, token) {
			const line = document.lineAt(position.line);
			const text = line.text;

			// Expresión regular para encontrar importaciones de imágenes
			const regex = /(['"])(.+?\.(png|jpg|jpeg|gif|svg))\1/;
			const match = regex.exec(text);

			if (!match) {
				return undefined;
			}

			const matchedText = match[2]; // El segundo grupo de captura contiene la ruta del archivo
			const matchedRange = new vscode.Range(
				line.lineNumber,
				match.index,
				line.lineNumber,
				match.index + match[0].length
			);

			if (!matchedText) {
				return undefined;
			}
			const fileExtensions = vscode.workspace.getConfiguration().get<string[]>('instantPreviewImage.fileExtensions') || ['.png', '.jpg', '.jpeg', '.gif', '.svg'];

			if (fileExtensions.some(ext => matchedText.endsWith(ext))) {
				const filePath = path.resolve(path.dirname(document.uri.fsPath), matchedText);
				const imagePath = vscode.Uri.file(filePath);

				if (!fs.existsSync(filePath)) {
					return undefined;
				}

				try {
					const dimensions = sizeOf(filePath);

					const markdownString = new vscode.MarkdownString(); markdownString.appendMarkdown(`![Image Preview](${imagePath.toString()})\n\n`);
					markdownString.appendMarkdown(`**File Name:** ${path.basename(filePath)}\n\n`);
					markdownString.appendMarkdown(`**Type:** ${dimensions.type?.toUpperCase()}\n\n`);
					markdownString.appendMarkdown(`**Dimensions:** ${dimensions.width} x ${dimensions.height} px`);
					markdownString.isTrusted = true;
					return new vscode.Hover(markdownString, matchedRange);
				} catch (err) {
					console.error(err);
					return undefined;
				}
			}
			return undefined;
		},

	});
	context.subscriptions.push(provider);

}

export function deactivate() { }