/* eslint-disable no-unused-vars */
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { spawn } = require('child_process');

function showTestResults(allTestsPassed) {
    if (allTestsPassed) {
        vscode.window.showInformationMessage('All test cases passed! 🎉');
    } else {
        vscode.window.showErrorMessage('Some test cases failed. Please check your code. ❌');
    }
}

function configureStatusBar(allTestsPassed) {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = allTestsPassed ? '$(check) All tests passed!' : '$(x) Some tests failed.';
    statusBar.tooltip = 'Click to view test details';
    statusBar.show();

    // Optionally assign a command to the status bar
    // statusBar.command = 'extension.showTestDetails';
}

function logTestResultsToOutput(results, outputs) {
    const outputChannel = vscode.window.createOutputChannel('Test Results');
    outputChannel.clear();
    outputChannel.appendLine('========== Test Results ==========');
    results.forEach((result, index) => {
        const { testCase, passed } = result;
        const { expectedOutput, actualOutput } = outputs[index];
        outputChannel.appendLine(`Test Case ${index + 1}: ${passed ? '✅ Passed' : '❌ Failed'}`);
        if (!passed) {
            outputChannel.appendLine(`Expected: ${expectedOutput}`);
            outputChannel.appendLine(`Actual:   ${actualOutput}`);
        }
    });
    outputChannel.show();
}

async function executeCppCode(solutionPath, compiledPath, testFolderPath) {
    const compileProcess = spawn('g++', [solutionPath, '-o', compiledPath]);

    await new Promise((resolve, reject) => {
        compileProcess.on('close', (code) => {
            code === 0 ? resolve() : reject(new Error('Compilation failed.'));
        });
        compileProcess.stderr.on('data', (data) => {
            console.error(`Compilation Error: ${data}`);
        });
    });

    const inputFiles = fs.readdirSync(testFolderPath).filter(file => file.startsWith('input') && file.endsWith('.txt'));
    let allTestsPassed = true;

    const testResults = [];
    const outputDetails = [];

    for (const inputFile of inputFiles) {
        const testCaseId = inputFile.match(/\d+/)[0];
        const expectedOutputFile = `output${testCaseId}.txt`;

        const inputPath = path.join(testFolderPath, inputFile);
        const expectedOutputPath = path.join(testFolderPath, expectedOutputFile);

        if (!fs.existsSync(expectedOutputPath)) {
            console.error(`Missing expected output file: ${expectedOutputFile}`);
            continue;
        }

        const inputContent = fs.readFileSync(inputPath, 'utf-8');
        const expectedOutput = fs.readFileSync(expectedOutputPath, 'utf-8').trim();

        const program = spawn(compiledPath);
        let actualOutput = '';

        program.stdout.on('data', (data) => {
            actualOutput += data.toString();
        });

        program.stderr.on('data', (data) => {
            console.error(`Error in test case ${testCaseId}: ${data}`);
        });

        program.on('close', () => {
            actualOutput = actualOutput.trim();
            const passed = actualOutput === expectedOutput;

            if (!passed) {
                console.error(`Test case ${testCaseId} failed.`);
                console.error(`Expected: ${expectedOutput}`);
                console.error(`Got: ${actualOutput}`);
                allTestsPassed = false;
            }

            testResults.push({ testCase: testCaseId, passed });
            outputDetails.push({ expectedOutput, actualOutput });
        });

        program.stdin.write(inputContent);
        program.stdin.end();

        await new Promise((resolve) => program.on('close', resolve));
    }

    showTestResults(allTestsPassed);
    configureStatusBar(allTestsPassed);
    logTestResultsToOutput(testResults, outputDetails);
}

async function executePythonCode(scriptPath, testFolderPath) {
    const inputFiles = fs.readdirSync(testFolderPath).filter(file => file.startsWith('ip') && file.endsWith('.txt'));
    let allTestsPassed = true;

    const testResults = [];
    const outputDetails = [];

    for (const inputFile of inputFiles) {
        const testCaseId = inputFile.match(/\d+/)[0];
        const expectedOutputFile = `op${testCaseId}.txt`;

        const inputPath = path.join(testFolderPath, inputFile);
        const expectedOutputPath = path.join(testFolderPath, expectedOutputFile);

        if (!fs.existsSync(expectedOutputPath)) {
            console.error(`Missing expected output file: ${expectedOutputFile}`);
            continue;
        }

        const inputContent = fs.readFileSync(inputPath, 'utf-8');
        const expectedOutput = fs.readFileSync(expectedOutputPath, 'utf-8').trim();

        let actualOutput = '';
        let errorOutput = '';

        await new Promise((resolve, reject) => {
            const pythonProcess = spawn('python', [scriptPath]);

            pythonProcess.stdout.on('data', (data) => {
                actualOutput += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (errorOutput) {
                    console.error(`Error in test case ${testCaseId}: ${errorOutput}`);
                    reject(new Error(`Test case ${testCaseId} encountered an error.`));
                } else {
                    actualOutput = actualOutput.trim();
                    const passed = actualOutput === expectedOutput;

                    if (!passed) {
                        console.error(`Test case ${testCaseId} failed.`);
                        console.error(`Expected: ${expectedOutput}`);
                        console.error(`Got: ${actualOutput}`);
                        allTestsPassed = false;
                    }

                    testResults.push({ testCase: testCaseId, passed });
                    outputDetails.push({ expectedOutput, actualOutput });
                    resolve();
                }
            });

            pythonProcess.stdin.write(inputContent);
            pythonProcess.stdin.end();
        });
    }

    showTestResults(allTestsPassed);
    configureStatusBar(allTestsPassed);
    logTestResultsToOutput(testResults, outputDetails);
}

module.exports = { executeCppCode, executePythonCode };
