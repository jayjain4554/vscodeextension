const puppeteer = require('puppeteer');

function cleanInput(input) {
    input += ",";
    const processedInput = [];
    let index = 0;

    while (index < input.length) {
        let char = input[index];
        if (char !== "=") {
            index++;
        } else {
            index += 2; // Skip '=' and the following space
            let tempString = "";
            let dimensionCount = 0;

            while (input[index] === "[") {
                index++;
                dimensionCount++;
            }

            if (dimensionCount > 0) { // Handle nested arrays
                index -= dimensionCount;
                tempString = "";
                const closingBrackets = "]".repeat(dimensionCount);

                while (input.slice(index, index + dimensionCount) !== closingBrackets) {
                    tempString += input[index];
                    index++;
                }
                tempString += "]".repeat(dimensionCount);

                const arrayData = JSON.parse(tempString);
                const dimensions = getDimensions(arrayData);
                if (dimensions.length !== dimensionCount && (dimensions.length === 0 && dimensionCount !== 1)) {
                    throw new Error("Invalid array dimensions");
                }

                const flattened = [...flattenArray(arrayData)];
                const output = dimensions.join(" ") + " " + flattened.join(" ");
                processedInput.push(output);
            } else {
                if (input[index] === '"') {
                    index++;
                    while (input[index] !== '"') {
                        tempString += input[index];
                        index++;
                    }
                } else {
                    while (input[index] !== ",") {
                        tempString += input[index];
                        index++;
                    }
                }
                processedInput.push(tempString);
            }
            index++;
        }
    }
    return processedInput.join(" ");
}

function getDimensions(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
        return [];
    }
    return [arr.length].concat(getDimensions(arr[0]));
}

function* flattenArray(nestedArray) {
    for (const item of nestedArray) {
        if (Array.isArray(item)) {
            yield* flattenArray(item);
        } else {
            yield item;
        }
    }
}

async function scrapePage(url) {
    if (!url || typeof url !== 'string') {
        console.error("Invalid URL. Please provide a valid URL.");
        return;
    }

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        await page.goto(url);
        const elements = await page.$$('.elfjS pre');

        const inputs = [];
        const outputs = [];
        console.log("Number of elements found:", elements.length);

        for (const element of elements) {
            const textContent = await page.evaluate(el => el.textContent, element);
            const cleanedContent = textContent.replace(/(Input:|Output:|Explanation:)\s*/g, '').trim();
            const [rawInput, rawOutput] = cleanedContent.split('\n');

            console.log(rawInput);
            console.log(rawOutput);

            let processedOutput = rawOutput.startsWith('[') ? JSON.parse(rawOutput) : rawOutput;

            if (Array.isArray(processedOutput)) {
                const dimensions = getDimensions(processedOutput);
                processedOutput = dimensions.length > 1
                    ? processedOutput.map(subArray => subArray.join(' ')).join('\n')
                    : processedOutput.join(' ');
            } else if (typeof processedOutput === 'string' && processedOutput.startsWith('"')) {
                processedOutput = processedOutput.slice(1, -1);
            }

            inputs.push(cleanInput(rawInput));
            outputs.push(processedOutput);
        }

        const result = [inputs, outputs];
        console.log(result);
        return result;

    } catch (error) {
        console.error("An error occurred during scraping:", error);
    } finally {
        await browser.close();
    }
}

module.exports = { scrapePage };
