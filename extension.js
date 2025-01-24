const path = require('path');
const vscode = require('vscode');
const fs = require('fs');
const { executeCppCode, executePythonCode } = require('./codeexecution.js');
const { scrapePage } = require('./puppets.js');

// Extract problem name from a given URL
function extractProblemName(url) {
    const startIdx = url.indexOf('problems') + 'problems'.length + 1;
    const endIdx = url.indexOf('description');
    const problemSegment = url.slice(startIdx, endIdx);
    return problemSegment.endsWith('/') ? problemSegment.slice(0, -1) : problemSegment;
}

// Format problem name to be lowercase and hyphen-separated
function normalizeName(name) {
    return name.toLowerCase().replace(/\s+/g, '-');
}

// Determine the programming language based on file extension
function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.cpp':
            return 'cpp';
        case '.py':
            return 'python';
        case '.js':
            return 'javascript';
        default:
            return 'unknown';
    }
}

// Fetch test cases from a given problem URL
async function fetchTestCases(url) {
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Extracting Test Cases... Please wait.',
            cancellable: false,
        },
        async (progress) => {
            try {
                const [inputs, outputs] = await scrapePage(url);
                const problemName = normalizeName(extractProblemName(url));

                const workspacePath = getWorkspaceDirectory();
                if (!workspacePath) return;

                const problemDir = createProblemDirectory(workspacePath, problemName);

                await generateTestFiles(problemDir, inputs, 'input', progress);
                await generateTestFiles(problemDir, outputs, 'output', progress);

                vscode.window.showInformationMessage('Test cases successfully saved in the TestData folder! 🎉');
            } catch (error) {
                vscode.window.showErrorMessage(`Error fetching test cases: ${error.message}`);
                console.error(error);
            }
        }
    );
}

// Retrieve the root workspace folder
function getWorkspaceDirectory() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return null;
    }
    return folders[0].uri.fsPath;
}

// Create directories for test cases
function createProblemDirectory(baseDir, problemName) {
    const testDataPath = path.join(baseDir, 'TestData');
    if (!fs.existsSync(testDataPath)) {
        fs.mkdirSync(testDataPath, { recursive: true });
        console.log('Created TestData folder.');
    }

    const problemPath = path.join(testDataPath, problemName);
    if (!fs.existsSync(problemPath)) {
        fs.mkdirSync(problemPath);
        console.log(`Created folder for problem: ${problemName}`);
    }

    return problemPath;
}

// Generate test files from input/output arrays
async function generateTestFiles(folder, dataArray, prefix, progress) {
    for (let i = 0; i < dataArray.length; i++) {
        const fileName = `${prefix}${i + 1}.txt`;
        const filePath = path.join(folder, fileName);

        fs.writeFileSync(filePath, dataArray[i]);
        progress.report({
            increment: Math.floor(((i + 1) / dataArray.length) * 100),
            message: `Writing ${prefix} file ${i + 1}...`,
        });
    }
}

// Extension activation logic
async function activate(context) {
    console.log('Extension "cph-lc" is now active! 🎉');

    // Command: Fetch Test Cases
    const fetchCommand = vscode.commands.registerCommand('cph-lc.FetchTestCases', async () => {
        const url = await vscode.window.showInputBox({
            prompt: 'Enter the problem URL',
            placeHolder: 'https://example.com/problem/123',
        });

        if (!url) {
            vscode.window.showErrorMessage('A URL is required to fetch test cases.');
            return;
        }

        await fetchTestCases(url);
    });

    // Command: Run Test Cases
    const runCommand = vscode.commands.registerCommand('cph-lc.RunTestCases', async () => {
        const workspacePath = getWorkspaceDirectory();
        if (!workspacePath) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.getText().trim()) {
            vscode.window.showErrorMessage('No valid solution file is open.');
            return;
        }

        const solutionCode = editor.document.getText();
        const problemName = await promptForProblemName();
        if (!problemName) return;

        const problemPath = locateProblemDirectory(workspacePath, problemName);
        if (!problemPath) return;

        const filePath = editor.document.uri.fsPath;
        const language = detectLanguage(filePath);

        switch (language) {
            case 'cpp':
                await handleCppExecution(problemPath, solutionCode);
                break;
            case 'python':
                await executePythonCode(filePath, problemPath);
                break;
            default:
                vscode.window.showErrorMessage(`Unsupported language: ${language}`);
        }
    });

    context.subscriptions.push(fetchCommand, runCommand);
}

// Prompt user for problem name
async function promptForProblemName() {
    const problemName = await vscode.window.showInputBox({
        prompt: 'Enter the problem name',
    });

    if (!problemName) {
        vscode.window.showErrorMessage('Problem name is required!');
        return null;
    }

    return normalizeName(problemName);
}

// Locate the folder for the specific problem
function locateProblemDirectory(baseDir, problemName) {
    const testDataPath = path.join(baseDir, 'TestData');
    if (!fs.existsSync(testDataPath)) {
        vscode.window.showErrorMessage('TestData folder is missing in the workspace.');
        return null;
    }

    const problemPath = path.join(testDataPath, problemName);
    if (!fs.existsSync(problemPath)) {
        vscode.window.showErrorMessage(`Folder for problem "${problemName}" not found.`);
        return null;
    }

    return problemPath;
}

// Handle execution of C++ solutions
async function handleCppExecution(problemDir, solutionCode) {
    const solutionFile = path.join(problemDir, 'temp_solution.cpp');
    const executableFile = path.join(problemDir, 'solution_exec.exe');

    fs.writeFileSync(solutionFile, solutionCode, 'utf8');
    await executeCppCode(solutionFile, executableFile, problemDir);
}

// Deactivate the extension
function deactivate() {
    console.log('Extension "cph-lc" has been deactivated.');
}

module.exports = { activate, deactivate };
