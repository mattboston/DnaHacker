import { unzip } from 'https://unpkg.com/unzipit@1.4.0/dist/unzipit.module.js';
import { parseDnaData } from './csvParser.js';
import UIManager from './uiManager.js';

/**
 * Detects the DNA file format based on content analysis
 * @param {string} content - The file content
 * @returns {string} The detected format ('myheritage', 'ancestry', or 'unknown')
 */
function detectFileFormat(content) {
    const lines = content.split('\n');

    // Look for Ancestry.com specific markers
    if (content.includes('AncestryDNA raw data download') ||
        content.includes('AncestryDNA array version') ||
        content.includes('AncestryDNA converter version')) {
        return 'ancestry';
    }

    // Look for MyHeritage format (no headers, comma-separated, 4 columns)
    const firstDataLine = lines.find(line =>
        line.trim() &&
        !line.startsWith('#') &&
        line.includes(',') &&
        line.split(',').length === 4
    );

    if (firstDataLine) {
        const columns = firstDataLine.split(',');
        // Check if it looks like MyHeritage format (rsid, chromosome, position, genotype)
        if (columns[0].trim().startsWith('rs') &&
            !isNaN(columns[1].trim()) &&
            !isNaN(columns[2].trim()) &&
            columns[3].trim().length <= 2) {
            return 'myheritage';
        }
    }

    return 'unknown';
}

export async function processZipFile(fileObject) {
    UIManager.updateStatus(`Unpacking ${fileObject.name}...`);
    try {
        const { entries } = await unzip(fileObject);

        let fileContent = null;
        let foundFilename = null;
        let detectedFormat = null;

        // Find CSV or TXT file inside ZIP
        const potentialFiles = Object.keys(entries).filter(filename =>
            filename.toLowerCase().endsWith('.csv') || filename.toLowerCase().endsWith('.txt')
        );

        if (potentialFiles.length === 0) {
            const errorMsg = "No CSV or TXT file found in the ZIP archive.";
            console.error(`Error processing ${fileObject.name}: ${errorMsg}`);
            UIManager.updateStatus(`Error processing ${fileObject.name}: ${errorMsg}`, true);
            return null;
        }

        // Prioritize CSV, otherwise take first TXT
        foundFilename = potentialFiles.find(name => name.toLowerCase().endsWith('.csv')) || potentialFiles[0];

        if (!foundFilename || !entries[foundFilename]) {
            const errorMsg = "Could not access the identified CSV/TXT file.";
            console.error(`Error processing ${fileObject.name}: ${errorMsg}`);
            UIManager.updateStatus(`Error processing ${fileObject.name}: ${errorMsg}`, true);
            return null;
        }

        UIManager.updateStatus(`Extracting ${foundFilename} from ${fileObject.name}...`);
        const targetEntry = entries[foundFilename];
        fileContent = await targetEntry.text();
        UIManager.updateStatus(`Extraction of ${foundFilename} complete.`);

        if (!fileContent) {
            const errorMsg = "The content of the CSV/TXT file could not be extracted.";
            console.error(`Error processing ${fileObject.name}: ${errorMsg}`);
            UIManager.updateStatus(`Error processing ${fileObject.name}: ${errorMsg}`, true);
            return null;
        }

        // Detect the file format
        detectedFormat = detectFileFormat(fileContent);
        UIManager.updateStatus(`Detected format: ${detectedFormat} for ${fileObject.name}`);

        if (detectedFormat === 'unknown') {
            const errorMsg = "Could not determine the DNA file format. Please ensure this is a valid MyHeritage or Ancestry.com DNA file.";
            console.error(`Error processing ${fileObject.name}: ${errorMsg}`);
            UIManager.updateStatus(`Error processing ${fileObject.name}: ${errorMsg}`, true);
            return null;
        }

        return await parseDnaData(fileContent, fileObject.name, detectedFormat);

    } catch (error) {
        console.error(`Error unpacking ${fileObject.name}:`, error);
        UIManager.updateStatus(`Error unpacking ${fileObject.name}: ${error.message}`, true);
        return null;
    }
}