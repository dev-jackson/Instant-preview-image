import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import sizeOf from 'image-size';

export function activate(context: vscode.ExtensionContext) {
	const supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];

	const provider = vscode.languages.registerHoverProvider(
		supportedLanguages,
		{
			async provideHover(document, position, token) {
				const line = document.lineAt(position.line);
				const text = line.text;

				const regex = /(['"])(.+?\.(png|jpg|jpeg|gif|svg))\1/;
				const match = regex.exec(text);

				if (!match) {
					return undefined;
				}

				const matchedText = match[2];
				const matchedRange = new vscode.Range(
					line.lineNumber,
					match.index + match[1].length,
					line.lineNumber,
					match.index + match[1].length + matchedText.length
				);

				if (!matchedText) {
					console.log("Matched text is undefined");
					return undefined;
				}

				const fileExtensions = vscode.workspace.getConfiguration().get<string[]>('instantPreviewImage.fileExtensions') || ['.png', '.jpg', '.jpeg', '.gif', '.svg'];

				if (fileExtensions.some(ext => matchedText.endsWith(ext))) {
					let filePath: string | undefined;
					const workspaceFolders = vscode.workspace.workspaceFolders;
					console.log(workspaceFolders);
					if (workspaceFolders) {
						for (const folder of workspaceFolders) {
							const projectRootPath = path.join(folder.uri.fsPath, matchedText);
							const srcPath = path.join(folder.uri.fsPath, 'src', matchedText);

							if (fs.existsSync(projectRootPath)) {
								filePath = projectRootPath;
								break;
							} else if (fs.existsSync(srcPath)) {
								filePath = srcPath;
								break;
							}

							const subfolders = fs.readdirSync(folder.uri.fsPath, { withFileTypes: true })
								.filter(dirent => dirent.isDirectory())
								.map(dirent => path.join(folder.uri.fsPath, dirent.name));

							for (const subfolder of subfolders) {
								const subfolderProjectRootPath = path.join(subfolder, matchedText);
								const subfolderSrcPath = path.join(subfolder, 'src', matchedText);

								if (fs.existsSync(subfolderProjectRootPath)) {
									filePath = subfolderProjectRootPath;
									break;
								} else if (fs.existsSync(subfolderSrcPath)) {
									filePath = subfolderSrcPath;
									break;
								}
							}

							if (filePath) {
								break;
							}
						}
					} else {
						console.log("No workspace folders found.");
					}

					if (!filePath) {
						filePath = path.resolve(path.dirname(document.uri.fsPath), matchedText);
					}

					const imagePath = vscode.Uri.file(filePath);
					if (!fs.existsSync(filePath)) {
						return undefined;
					}

					try {
						const dimensions = sizeOf(filePath);
						const fileSizeInBytes = fs.statSync(filePath).size;
						const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);
						const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
						const fileSize = fileSizeInBytes > 1024 * 1024 ? `${fileSizeInMB} MB` : `${fileSizeInKB} KB`;

						const markdownString = new vscode.MarkdownString();
						markdownString.appendMarkdown(`![Image Preview](${imagePath.toString()})\n\n`);
						markdownString.appendMarkdown(`**File Name:** ${path.basename(filePath)}\n\n`);
						markdownString.appendMarkdown(`**Type:** ${dimensions.type?.toUpperCase()}\n\n`);
						markdownString.appendMarkdown(`**Dimensions:** ${dimensions.width} x ${dimensions.height} px\n\n`);
						markdownString.appendMarkdown(`**Size:** ${fileSize}`);
						markdownString.isTrusted = true;

						return new vscode.Hover(markdownString, matchedRange);
					} catch (error) {
						return undefined;
					}
				} else {
					console.log("File extension does not match:", matchedText);
				}

				return undefined;
			}
		}
	);

	context.subscriptions.push(provider);
}

export function deactivate() { }