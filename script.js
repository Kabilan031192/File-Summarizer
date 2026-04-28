// File storage
let uploadedFiles = [];
let summariesData = [];

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');
const summariesSection = document.getElementById('summariesSection');
const summariesContainer = document.getElementById('summariesContainer');
const actions = document.getElementById('actions');
const summarizeBtn = document.getElementById('summarizeBtn');
const clearBtn = document.getElementById('clearBtn');
const exportActions = document.getElementById('exportActions');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportPptBtn = document.getElementById('exportPptBtn');

// Drag and drop events
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
});

// Handle file uploads
function handleFiles(files) {
    files.forEach(file => {
        if (!uploadedFiles.find(f => f.name === file.name && f.size === file.size)) {
            uploadedFiles.push(file);
        }
    });

    if (uploadedFiles.length > 0) {
        filesSection.style.display = 'block';
        actions.style.display = 'flex';
        renderFilesList();
    }
}

// Render files list
function renderFilesList() {
    filesList.innerHTML = '';

    uploadedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const fileExt = file.name.split('.').pop().toUpperCase();
        const fileSize = formatFileSize(file.size);

        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-icon">${fileExt}</div>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${fileSize}</p>
                </div>
            </div>
            <button class="file-remove" onclick="removeFile(${index})">Remove</button>
        `;

        filesList.appendChild(fileItem);
    });
}

// Remove file
function removeFile(index) {
    uploadedFiles.splice(index, 1);

    if (uploadedFiles.length === 0) {
        filesSection.style.display = 'none';
        actions.style.display = 'none';
        summariesSection.style.display = 'none';
        exportActions.style.display = 'none';
    }

    renderFilesList();
}

// Clear all files
clearBtn.addEventListener('click', () => {
    uploadedFiles = [];
    summariesData = [];
    filesSection.style.display = 'none';
    actions.style.display = 'none';
    summariesSection.style.display = 'none';
    exportActions.style.display = 'none';
    summariesContainer.innerHTML = '';
    fileInput.value = '';
});

// Summarize files
summarizeBtn.addEventListener('click', async () => {
    summariesSection.style.display = 'block';
    summariesContainer.innerHTML = '';
    summariesData = [];
    summarizeBtn.disabled = true;

    for (const file of uploadedFiles) {
        await summarizeFile(file);
    }

    summarizeBtn.disabled = false;
    exportActions.style.display = 'block';
});

// Summarize individual file
async function summarizeFile(file) {
    const summaryCard = document.createElement('div');
    summaryCard.className = 'summary-card';
    summaryCard.innerHTML = `
        <h4>
            📄 ${file.name}
        </h4>
        <div class="summary-content">
            <div class="loading">
                <div class="spinner"></div>
                <span>Analyzing content...</span>
            </div>
        </div>
    `;
    summariesContainer.appendChild(summaryCard);

    try {
        const content = await readFileContent(file);
        const summary = generateSummary(file, content);

        // Store summary data for export
        summariesData.push({
            fileName: file.name,
            fileType: file.name.split('.').pop().toUpperCase(),
            fileSize: formatFileSize(file.size),
            content: content,
            summary: summary
        });

        // Simulate AI processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        summaryCard.querySelector('.summary-content').innerHTML = summary;
    } catch (error) {
        summaryCard.querySelector('.summary-content').innerHTML = `
            <p style="color: #ff4757;">❌ Error: ${error.message}</p>
        `;
    }
}

// Read file content
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const fileExt = file.name.split('.').pop().toLowerCase();

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        if (['txt', 'csv', 'json', 'xml', 'html', 'css', 'js'].includes(fileExt)) {
            reader.onload = (e) => {
                resolve({ type: 'text', content: e.target.result });
            };
            reader.readAsText(file);
        } else if (['xlsx', 'xls'].includes(fileExt)) {
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    resolve({ type: 'excel', content: workbook });
                } catch (error) {
                    reject(new Error('Failed to parse Excel file: ' + error.message));
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (['pdf', 'docx', 'doc'].includes(fileExt)) {
            resolve({ type: 'binary', content: null });
        } else {
            reader.onload = (e) => {
                resolve({ type: 'text', content: e.target.result });
            };
            reader.readAsText(file);
        }
    });
}

// Detect specifications in Excel sheet
function detectSpecifications(jsonData) {
    const specs = {};

    // Scan ALL rows for spec patterns (not just first 20)
    for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        if (!row) continue;

        for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const cell = row[colIndex];
            if (!cell) continue;

            const cellStr = String(cell).trim();
            const cellLower = cellStr.toLowerCase();

            // Pattern 1: Just a number with unit (like "2.5 bar")
            const specMatch = cellStr.match(/^(\d+\.?\d*)\s*(bar|mm|kg|psi|mpa|°c|celsius|mbar|kpa)/i);
            if (specMatch) {
                const value = parseFloat(specMatch[1]);
                const unit = specMatch[2];

                // Look for tolerance in same row, nearby columns
                let tolerance = null;

                // Check next few cells in same row
                for (let offset = 1; offset <= 3; offset++) {
                    const nearbyCell = row[colIndex + offset];
                    if (nearbyCell) {
                        const nearbyCellStr = String(nearbyCell).trim();

                        // Look for ±X or just X (tolerance value)
                        const tolMatch = nearbyCellStr.match(/[±]?\s*(\d+\.?\d*)/);
                        if (tolMatch && nearbyCellStr.length < 10) { // Short cell likely tolerance
                            tolerance = parseFloat(tolMatch[1]);
                            break;
                        }

                        // Check if cell contains "bilateral" or "tolerance"
                        if (nearbyCellStr.toLowerCase().includes('bilateral') ||
                            nearbyCellStr.toLowerCase().includes('tolerance')) {
                            const tolMatch2 = nearbyCellStr.match(/(\d+\.?\d*)/);
                            if (tolMatch2) {
                                tolerance = parseFloat(tolMatch2[1]);
                                break;
                            }
                        }
                    }
                }

                // Also check for "±" in the same cell
                if (!tolerance && cellStr.includes('±')) {
                    const tolMatch = cellStr.match(/±\s*(\d+\.?\d*)/);
                    if (tolMatch) {
                        tolerance = parseFloat(tolMatch[1]);
                    }
                }

                // Store spec for this column
                specs[`col${colIndex}`] = {
                    target: value,
                    tolerance: tolerance || 0,
                    unit: unit,
                    min: tolerance ? value - tolerance : value * 0.95, // Default 5% if no tolerance
                    max: tolerance ? value + tolerance : value * 1.05,
                    rowIndex: rowIndex,
                    colIndex: colIndex,
                    originalCell: cellStr
                };
            }

            // Pattern 2: Range format "2.3 - 2.7" or "2.3-2.7"
            const rangeMatch = cellStr.match(/(\d+\.?\d*)\s*[-–—]\s*(\d+\.?\d*)/);
            if (rangeMatch) {
                const min = parseFloat(rangeMatch[1]);
                const max = parseFloat(rangeMatch[2]);
                const target = (min + max) / 2;

                specs[`col${colIndex}`] = {
                    target: target,
                    min: min,
                    max: max,
                    tolerance: (max - min) / 2,
                    rowIndex: rowIndex,
                    colIndex: colIndex,
                    originalCell: cellStr
                };
            }

            // Pattern 3: Number with ± in same cell "2.5±0.2" or "2.5 ± 0.2 Bar" or "Spec - 65 ± 10 mm"
            const combinedMatch = cellStr.match(/(\d+\.?\d*)\s*[±]\s*(\d+\.?\d*)/);
            if (combinedMatch) {
                const value = parseFloat(combinedMatch[1]);
                const tolerance = parseFloat(combinedMatch[2]);

                // Extract unit if present
                const unitMatch = cellStr.match(/[±]\s*\d+\.?\d*\s*([a-zA-Z°\/]+)/i);
                const unit = unitMatch ? unitMatch[1] : '';

                const specData = {
                    target: value,
                    tolerance: tolerance,
                    unit: unit,
                    min: value - tolerance,
                    max: value + tolerance,
                    rowIndex: rowIndex,
                    colIndex: colIndex,
                    originalCell: cellStr
                };

                // Store for current column
                specs[`col${colIndex}`] = specData;

                // IMPORTANT: Propagate this spec to all following columns in the same row
                // BUT: Do NOT propagate if this spec is from column I (index 8)
                // This handles cases where one spec applies to multiple columns (like J9 applying to J-Y)
                if (colIndex !== 8) {
                    for (let offset = 1; offset <= 30; offset++) {
                        const nextColIndex = colIndex + offset;
                        if (nextColIndex >= row.length) break;

                        // Skip column I (index 8) during propagation
                        if (nextColIndex === 8) continue;

                        const nextCell = row[nextColIndex];
                        // Only propagate if next cell is empty or doesn't contain another spec
                        const nextCellStr = nextCell ? String(nextCell).trim() : '';
                        const hasSpec = nextCellStr.match(/\d+\.?\d*\s*[±]/) || nextCellStr.match(/^\d+\.?\d*\s*(bar|mm|kg)/i);

                        if (!nextCell || !hasSpec) {
                            specs[`col${nextColIndex}`] = { ...specData, propagated: true, propagatedFrom: colIndex };
                        } else {
                            break; // Stop if we hit another spec
                        }
                    }
                }
            }
        }
    }

    return specs;
}

// Check if value is within spec
function isWithinSpec(value, spec) {
    if (!spec || spec.min === null || spec.max === null) return null;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return null;
    return numValue >= spec.min && numValue <= spec.max;
}

// Extract metadata for TRANSCODING files
function extractMetadataTranscoding(jsonData) {
    const metadata = [];
    console.log('=== Starting Transcoding Metadata Extraction ===');

    // Metadata headers are in MERGED cells from rows 3-8 (indices 2-7)
    // Data is in rows 9-14 (indices 8-13)
    // Columns A-F (indices 0-5) - include column A for "Line"
    const headerStartRow = 2;  // Row 3 in Excel
    const headerEndRow = 7;    // Row 8 in Excel
    const dataStartRow = 8;    // Row 9 in Excel
    const metadataStartCol = 0; // Column A (was 1 for B)
    const metadataEndCol = 5;   // Column F

    // Find headers by checking all rows 3-8 for each column
    const headersFound = {};

    for (let col = metadataStartCol; col <= metadataEndCol; col++) {
        // Check rows 3-8 for this column to find the header (merged cell value)
        for (let row = headerStartRow; row <= headerEndRow; row++) {
            if (jsonData[row] && jsonData[row][col]) {
                const cellStr = String(jsonData[row][col]).trim();
                if (cellStr.length > 0 && cellStr.length < 100) {
                    headersFound[col] = cellStr;
                    console.log(`Found metadata header at row ${row + 1}, col ${col}: ${cellStr}`);
                    break; // Found header for this column, move to next column
                }
            }
        }
    }

    // Process each header column
    Object.keys(headersFound).forEach(col => {
        const colIndex = parseInt(col);
        const headerStr = headersFound[col];

        // Collect ALL unique values from rows 9-14 (indices 8-13)
        const values = [];

        for (let dataRow = dataStartRow; dataRow < Math.min(dataStartRow + 10, jsonData.length); dataRow++) {
            if (jsonData[dataRow] && jsonData[dataRow][colIndex] !== undefined && jsonData[dataRow][colIndex] !== null) {
                let val = String(jsonData[dataRow][colIndex]).trim();

                // Clean up trailing characters: comma, backtick, apostrophe, quotes
                val = val.replace(/[,`'"]+$/g, '').trim();

                // Accept any non-empty value that's not the header itself
                if (val && val !== '' && val.toLowerCase() !== headerStr.toLowerCase()) {
                    if (!values.includes(val)) {
                        values.push(val);
                        console.log(`  Found value for "${headerStr}": ${val}`);
                    }
                }
            }
        }

        if (values.length > 0) {
            const uniqueValues = [...new Set(values)];
            // Clean each value before joining
            const cleanedValues = uniqueValues.map(v => v.replace(/[,`'"]+$/g, '').trim());
            const displayValue = cleanedValues.length === 1 ? cleanedValues[0] : cleanedValues.join(', ');
            const cleanKey = headerStr.replace(/:/g, '').trim();

            metadata.push({ key: cleanKey, value: displayValue, row: headerStartRow, col: colIndex });
            console.log(`✓ Added metadata: ${cleanKey} = ${displayValue}`);
        } else {
            console.log(`✗ No values found for header: ${headerStr}`);
        }
    });

    console.log(`=== Total transcoding metadata items found: ${metadata.length} ===`);
    return metadata;
}

// Extract metadata for POLISHING/SANDING files
function extractMetadataPolishing(jsonData) {
    const metadata = [];
    console.log('=== Starting Polishing/Sanding Metadata Extraction ===');

    const polishingKeywords = ['site', 'program', 'process', 'stage', 'vendor',
        'updated', 'by', 'date', 'version', 'author', 'building', 'location',
        'sanding', 'repeatability', 'calibration', 'serial', 'robot', 'cell'];

    for (let row = 0; row < Math.min(6, jsonData.length); row++) {
        if (!jsonData[row]) continue;
        for (let keyCol = 0; keyCol <= 1; keyCol++) {
            const valueCol = keyCol + 1;
            if (valueCol >= jsonData[row].length) continue;
            const key = jsonData[row][keyCol];
            const value = jsonData[row][valueCol];
            if (key && value) {
                const keyStr = String(key).trim();
                const valueStr = String(value).trim();
                const keyLower = keyStr.toLowerCase().replace(/:/g, '');
                const isMetadataKey = polishingKeywords.some(keyword => keyLower.includes(keyword)) || keyStr.endsWith(':');
                if (isMetadataKey && valueStr.length > 0 && valueStr.length < 100) {
                    const cleanKey = keyStr.replace(/:/g, '').trim();
                    metadata.push({ key: cleanKey, value: valueStr, row: row, col: keyCol });
                    console.log(`Found polishing metadata: ${cleanKey} = ${valueStr}`);
                }
            }
        }
    }

    for (let headerRow = 7; headerRow < Math.min(12, jsonData.length); headerRow++) {
        if (!jsonData[headerRow]) continue;
        const row = jsonData[headerRow];
        let headerCount = 0;
        const potentialHeaders = [];
        for (let col = 0; col < Math.min(10, row.length); col++) {
            const cell = row[col];
            if (cell) {
                const cellStr = String(cell).trim();
                if (cellStr.length > 0 && cellStr.length < 50 && !cellStr.match(/^\d+\.?\d*$/) && !cellStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
                    headerCount++;
                    potentialHeaders.push({ col, name: cellStr });
                }
            }
        }
        if (headerCount >= 3 && headerRow + 1 < jsonData.length) {
            const dataRow = jsonData[headerRow + 1];
            if (dataRow) {
                potentialHeaders.forEach(header => {
                    const values = [];
                    for (let dataRowIdx = headerRow + 1; dataRowIdx < Math.min(headerRow + 5, jsonData.length); dataRowIdx++) {
                        if (jsonData[dataRowIdx] && jsonData[dataRowIdx][header.col]) {
                            const val = String(jsonData[dataRowIdx][header.col]).trim();
                            if (val && val !== '') values.push(val);
                        }
                    }
                    if (values.length > 0) {
                        const uniqueValues = [...new Set(values)];
                        const headerLower = header.name.toLowerCase();
                        const isMetadata = polishingKeywords.some(keyword => headerLower.includes(keyword));

                        // Skip if header looks like "Polishing-1-1" or "Polishing-1-2" (these are duplicate data, not metadata)
                        const isDuplicatePolishingData = header.name.match(/^Polishing-\d+-\d+$/i);

                        if (isMetadata && !isDuplicatePolishingData) {
                            const displayValue = uniqueValues.length === 1 ? uniqueValues[0] : uniqueValues.join(', ');
                            const exists = metadata.find(m => m.key.toLowerCase() === header.name.toLowerCase());
                            if (!exists) {
                                metadata.push({ key: header.name, value: displayValue, row: headerRow, col: header.col });
                                console.log(`Found polishing metadata from header: ${header.name} = ${displayValue}`);
                            }
                        }
                    }
                });
            }
        }
    }
    console.log(`=== Total polishing metadata items found: ${metadata.length} ===`);
    return metadata;
}

// Extract metadata for DEBURRING files
function extractMetadataDeburring(jsonData) {
    const metadata = [];
    console.log('=== Starting Deburring Metadata Extraction ===');

    const deburringKeywords = ['site', 'program', 'process', 'stage', 'vendor',
        'updated', 'by', 'date', 'version', 'author', 'building', 'location',
        'machine', 'internal', 'type', 'blast', 'media', 'belt', 'speed'];

    for (let row = 0; row < Math.min(6, jsonData.length); row++) {
        if (!jsonData[row]) continue;
        for (let keyCol = 0; keyCol <= 1; keyCol++) {
            const valueCol = keyCol + 1;
            if (valueCol >= jsonData[row].length) continue;
            const key = jsonData[row][keyCol];
            const value = jsonData[row][valueCol];
            if (key && value) {
                const keyStr = String(key).trim();
                const valueStr = String(value).trim();
                const keyLower = keyStr.toLowerCase().replace(/:/g, '');
                const isMetadataKey = deburringKeywords.some(keyword => keyLower.includes(keyword)) || keyStr.endsWith(':');
                if (isMetadataKey && valueStr.length > 0 && valueStr.length < 100) {
                    const cleanKey = keyStr.replace(/:/g, '').trim();
                    metadata.push({ key: cleanKey, value: valueStr, row: row, col: keyCol });
                    console.log(`Found deburring metadata: ${cleanKey} = ${valueStr}`);
                }
            }
        }
    }

    for (let headerRow = 7; headerRow < Math.min(12, jsonData.length); headerRow++) {
        if (!jsonData[headerRow]) continue;
        const row = jsonData[headerRow];
        let headerCount = 0;
        const potentialHeaders = [];
        for (let col = 0; col < Math.min(10, row.length); col++) {
            const cell = row[col];
            if (cell) {
                const cellStr = String(cell).trim();
                if (cellStr.length > 0 && cellStr.length < 50 && !cellStr.match(/^\d+\.?\d*$/) && !cellStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
                    headerCount++;
                    potentialHeaders.push({ col, name: cellStr });
                }
            }
        }
        if (headerCount >= 3 && headerRow + 1 < jsonData.length) {
            const dataRow = jsonData[headerRow + 1];
            if (dataRow) {
                potentialHeaders.forEach(header => {
                    const values = [];
                    for (let dataRowIdx = headerRow + 1; dataRowIdx < Math.min(headerRow + 5, jsonData.length); dataRowIdx++) {
                        if (jsonData[dataRowIdx] && jsonData[dataRowIdx][header.col]) {
                            const val = String(jsonData[dataRowIdx][header.col]).trim();
                            if (val && val !== '') values.push(val);
                        }
                    }
                    if (values.length > 0) {
                        const uniqueValues = [...new Set(values)];
                        const headerLower = header.name.toLowerCase();
                        const isMetadata = deburringKeywords.some(keyword => headerLower.includes(keyword));
                        if (isMetadata) {
                            const displayValue = uniqueValues.length === 1 ? uniqueValues[0] : uniqueValues.join(', ');
                            const exists = metadata.find(m => m.key.toLowerCase() === header.name.toLowerCase());
                            if (!exists) {
                                metadata.push({ key: header.name, value: displayValue, row: headerRow, col: header.col });
                                console.log(`Found deburring metadata from header: ${header.name} = ${displayValue}`);
                            }
                        }
                    }
                });
            }
        }
    }
    console.log(`=== Total deburring metadata items found: ${metadata.length} ===`);
    return metadata;
}

// Extract metadata dynamically from Excel files (GENERIC - fallback)
function extractMetadata(jsonData) {
    const metadata = [];

    console.log('=== Starting Dynamic Metadata Extraction ===');

    // STRATEGY 1: Extract from top-left corner (A1:C6 or A1:B6)
    // Look for key-value pairs in first 6 rows, first 3 columns
    for (let row = 0; row < Math.min(6, jsonData.length); row++) {
        if (!jsonData[row]) continue;

        // Check columns A and B (indices 0 and 1)
        for (let keyCol = 0; keyCol <= 1; keyCol++) {
            const valueCol = keyCol + 1;
            if (valueCol >= jsonData[row].length) continue;

            const key = jsonData[row][keyCol];
            const value = jsonData[row][valueCol];

            if (key && value) {
                const keyStr = String(key).trim();
                const valueStr = String(value).trim();

                // Check if this looks like a metadata key (ends with : or is a known metadata term)
                const metadataKeywords = ['site', 'program', 'process', 'stage', 'vendor',
                    'updated', 'by', 'date', 'version', 'author', 'building', 'location'];

                const keyLower = keyStr.toLowerCase().replace(/:/g, '');
                const isMetadataKey = metadataKeywords.some(keyword => keyLower.includes(keyword)) ||
                    keyStr.endsWith(':');

                if (isMetadataKey && valueStr.length > 0 && valueStr.length < 100) {
                    // Clean up the key (remove colons)
                    const cleanKey = keyStr.replace(/:/g, '').trim();

                    metadata.push({
                        key: cleanKey,
                        value: valueStr,
                        row: row,
                        col: keyCol
                    });

                    console.log(`Found metadata: ${cleanKey} = ${valueStr} (at row ${row}, col ${keyCol})`);
                }
            }
        }
    }

    // STRATEGY 2: Look for header rows with data below them
    // Scan rows 7-12 for potential header rows
    for (let headerRow = 7; headerRow < Math.min(12, jsonData.length); headerRow++) {
        if (!jsonData[headerRow]) continue;

        const row = jsonData[headerRow];
        let headerCount = 0;
        const potentialHeaders = [];

        // Check if this row has multiple non-empty cells that look like headers
        for (let col = 0; col < Math.min(10, row.length); col++) {
            const cell = row[col];
            if (cell) {
                const cellStr = String(cell).trim();
                // Check if it looks like a header (not a number, not too long)
                if (cellStr.length > 0 && cellStr.length < 50 &&
                    !cellStr.match(/^\d+\.?\d*$/) &&
                    !cellStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
                    headerCount++;
                    potentialHeaders.push({ col, name: cellStr });
                }
            }
        }

        // If we found 3+ headers, check if there's data below
        if (headerCount >= 3 && headerRow + 1 < jsonData.length) {
            const dataRow = jsonData[headerRow + 1];
            if (dataRow) {
                // For each header, collect unique values from rows below
                potentialHeaders.forEach(header => {
                    const values = [];
                    for (let dataRowIdx = headerRow + 1; dataRowIdx < Math.min(headerRow + 5, jsonData.length); dataRowIdx++) {
                        if (jsonData[dataRowIdx] && jsonData[dataRowIdx][header.col]) {
                            const val = String(jsonData[dataRowIdx][header.col]).trim();
                            if (val && val !== '') {
                                values.push(val);
                            }
                        }
                    }

                    if (values.length > 0) {
                        const uniqueValues = [...new Set(values)];

                        // Check if this is a metadata-type header
                        const metadataKeywords = ['site', 'building', 'machine', 'id', 'type',
                            'setup', 'date', 'line', 'item', 'serial', 'internal'];
                        const headerLower = header.name.toLowerCase();
                        const isMetadata = metadataKeywords.some(keyword => headerLower.includes(keyword));

                        if (isMetadata) {
                            const displayValue = uniqueValues.length === 1 ? uniqueValues[0] : uniqueValues.join(', ');

                            // Avoid duplicates
                            const exists = metadata.find(m => m.key.toLowerCase() === header.name.toLowerCase());
                            if (!exists) {
                                metadata.push({
                                    key: header.name,
                                    value: displayValue,
                                    row: headerRow,
                                    col: header.col
                                });

                                console.log(`Found metadata from header: ${header.name} = ${displayValue}`);
                            }
                        }
                    }
                });
            }
        }
    }

    console.log(`=== Total metadata items found: ${metadata.length} ===`);
    return metadata;
}

// OLD GENERIC EXTRACTION (keeping for backward compatibility with other file types)
function extractMetadataGeneric(jsonData) {
    const metadata = [];
    const maxRows = Math.min(10, jsonData.length);
    const maxCols = 10;

    for (let row = 0; row < maxRows; row++) {
        const rowData = jsonData[row] || [];
        for (let col = 0; col < Math.min(maxCols, rowData.length); col++) {
            const cell = rowData[col];
            if (cell !== undefined && cell !== null && cell !== '') {
                const cellStr = String(cell).trim();

                // Look for standalone labels in one cell with value in adjacent cell (to the right)
                if (col < rowData.length - 1) {
                    const nextCell = rowData[col + 1];
                    if (nextCell !== undefined && nextCell !== null && nextCell !== '') {
                        const nextCellStr = String(nextCell).trim();

                        // Simple label detection
                        if (cellStr.length < 50 && cellStr.length > 2 &&
                            !cellStr.match(/^\d+\.?\d*$/) &&
                            !cellStr.match(/^\d+\.?\d*\s*(bar|mm|kg|psi)/i)) {

                            const metadataKeywords = ['date', 'robot', 'sanding'];
                            const cellLower = cellStr.toLowerCase();
                            const isMetadataKey = metadataKeywords.some(keyword =>
                                cellLower === keyword || cellLower.startsWith(keyword + ' ')
                            );

                            if (isMetadataKey && nextCellStr.length < 100) {
                                metadata.push({
                                    key: cellStr,
                                    value: nextCellStr,
                                    row,
                                    col
                                });
                            }
                        }
                    }
                }

                // ALSO look for labels with values in the cell BELOW (for C10:J10 style metadata)
                if (row < jsonData.length - 1) {
                    const belowRow = jsonData[row + 1];
                    if (belowRow) {
                        const belowCell = belowRow[col];
                        if (belowCell !== undefined && belowCell !== null && belowCell !== '') {
                            const belowCellStr = String(belowCell).trim();

                            // If current cell looks like a label and cell below is a value
                            if (cellStr.length < 50 && cellStr.length > 2 &&
                                !cellStr.match(/^\d+\.?\d*$/) &&
                                !cellStr.match(/^\d+\.?\d*\s*(bar|mm|kg|psi)/i) &&
                                belowCellStr.length < 100 &&
                                !belowCellStr.match(/^\d+\.?\d*\s*[±]/)) {

                                // Check if it's a common metadata label
                                const metadataKeywords = ['date', 'time', 'name', 'id', 'number', 'code', 'type',
                                    'model', 'serial', 'version', 'operator', 'inspector',
                                    'location', 'machine', 'part', 'batch', 'lot', 'shift',
                                    'customer', 'project', 'order', 'reference', 'status',
                                    'site', 'program', 'process', 'stage', 'update', 'updated',
                                    'by', 'created', 'modified', 'author', 'description',
                                    'title', 'subject', 'category', 'department', 'division',
                                    'vendor', 'supplier', 'manufacturer'];

                                const cellLower = cellStr.toLowerCase();
                                const isMetadataKey = metadataKeywords.some(keyword => cellLower.includes(keyword));

                                if (isMetadataKey) {
                                    metadata.push({
                                        key: cellStr,
                                        value: belowCellStr,
                                        row,
                                        col
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Remove duplicates based on key
    const uniqueMetadata = [];
    const seenKeys = new Set();

    metadata.forEach(item => {
        const normalizedKey = item.key.toLowerCase().trim();
        if (!seenKeys.has(normalizedKey)) {
            seenKeys.add(normalizedKey);
            uniqueMetadata.push(item);
        }
    });

    return uniqueMetadata;
}

// Analyze Excel data content deeply
function analyzeExcelContent(workbook, fileName = '') {
    let analysis = [];

    // Check file type at the very beginning
    const fileNameLower = fileName.toLowerCase();

    // Determine file type based on filename
    const isDeburring = fileNameLower.includes('deburring') || fileNameLower.includes('db');
    const isSandingOrPolishing = fileNameLower.includes('sanding') || fileNameLower.includes('polishing');
    const isTranscoding = fileNameLower.includes('transcoding');

    console.log(`=== Analyzing file: ${fileName} ===`);
    if (isDeburring) {
        console.log(`File type: DEBURRING (Old Format)`);
    } else if (isSandingOrPolishing) {
        console.log(`File type: SANDING/POLISHING (New Calibration Format)`);
    } else if (isTranscoding) {
        console.log(`File type: TRANSCODING (New Format)`);
    } else {
        console.log(`File type: UNKNOWN - Will try old format as fallback`);
    }

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Extract metadata based on file type
        let metadata = [];
        if (isSandingOrPolishing) {
            metadata = extractMetadataPolishing(jsonData);
        } else if (isDeburring) {
            metadata = extractMetadataDeburring(jsonData);
        } else if (isTranscoding) {
            metadata = extractMetadataTranscoding(jsonData);
        } else {
            metadata = extractMetadata(jsonData);
        }

        // Add metadata to analysis if found
        if (metadata.length > 0) {
            analysis.push({
                type: 'metadata',
                items: metadata
            });
        }

        // First, scan for specifications in the sheet
        const specs = detectSpecifications(jsonData);

        // POLISHING/SANDING FILES - Read headers, subheaders, and machine data
        if (isSandingOrPolishing) {
            console.log('=== Polishing/Sanding File Detected ===');

            // Extract Machine IDs from metadata
            let machineIds = [];
            if (metadata.length > 0) {
                const robotCellItem = metadata.find(item =>
                    item.key.toLowerCase().includes('robot') && item.key.toLowerCase().includes('cell')
                );
                if (robotCellItem) {
                    machineIds = robotCellItem.value.split(',').map(id => id.trim());
                    console.log(`Found ${machineIds.length} machines: ${machineIds.join(', ')}`);
                }
            }

            // Row 9 in Excel = index 8 (merged headers)
            // Row 10 in Excel = index 9 (sub-headers)
            // Rows 11-14 in Excel = index 10-13 (data rows, one per machine)
            const mergedHeaderRowIndex = 8;
            const subHeaderRowIndex = 9;
            const dataStartRowIndex = 10;

            if (jsonData.length > dataStartRowIndex && machineIds.length > 0) {
                const mergedHeaderRow = jsonData[mergedHeaderRowIndex] || [];
                const subHeaderRow = jsonData[subHeaderRowIndex] || [];

                // Collect data rows (one per machine)
                const dataRows = [];
                for (let i = dataStartRowIndex; i < dataStartRowIndex + machineIds.length; i++) {
                    if (jsonData[i]) {
                        dataRows.push(jsonData[i]);
                    }
                }

                console.log(`Processing ${machineIds.length} machines with ${dataRows.length} data rows`);

                // Group data by machine
                const machineData = {};
                machineIds.forEach((machineId, machineIdx) => {
                    machineData[machineId] = {
                        headers: {}
                    };
                });

                // Process each column starting from J (index 9)
                let currentMergedHeader = '';

                for (let col = 9; col < Math.max(mergedHeaderRow.length, subHeaderRow.length); col++) {
                    const mergedHeader = mergedHeaderRow[col];
                    const subHeader = subHeaderRow[col];

                    // Update current merged header if we find a new one
                    if (mergedHeader && String(mergedHeader).trim() !== '') {
                        currentMergedHeader = String(mergedHeader).trim();
                    }

                    // Process sub-header and data
                    if (subHeader && String(subHeader).trim() !== '' && currentMergedHeader) {
                        const subHeaderStr = String(subHeader).trim();

                        // Collect values for each machine
                        dataRows.forEach((dataRow, machineIdx) => {
                            const machineId = machineIds[machineIdx];
                            const value = dataRow[col];

                            if (value !== undefined && value !== '') {
                                // Initialize header group if needed
                                if (!machineData[machineId].headers[currentMergedHeader]) {
                                    machineData[machineId].headers[currentMergedHeader] = {};
                                }

                                // Store the value
                                machineData[machineId].headers[currentMergedHeader][subHeaderStr] = value;
                            }
                        });
                    }
                }

                console.log('Machine data structure:', machineData);

                // Add each machine as a spec_validation item
                Object.keys(machineData).forEach(machineId => {
                    const machine = machineData[machineId];

                    analysis.push({
                        type: 'spec_validation',
                        field: machineId,
                        machineId: machineId,
                        message: `${machineId}`,
                        status: 'good',
                        spec: null,
                        stats: {},
                        headers: machine.headers
                    });
                });
            }

            // Skip further processing
            return;
        }

        // TRANSCODING FILES - Metadata in columns A-F, spec data from column H onwards (skip G)
        if (isTranscoding) {
            console.log('=== Transcoding File Detected ===');

            // Row structure:
            // Row 4 (index 3): Spec headers (columns H to P), merged header "Scanner calibration" at O4-P4
            // Row 5 (index 4): Sometimes contains spec limits like "<=1.5" or subheaders like "X @ 50mmX50mm"
            // Row 6 (index 5): Units
            // Row 7 (index 6): USL
            // Row 8 (index 7): LSL
            // Rows 9-14 (index 8-13): Actual values (2 rows per machine)

            const headerRow = 3;   // Row 4 in Excel
            const specLimitRow = 4; // Row 5 in Excel (for limits like "<=1.5" or subheaders)
            const unitRow = 5;     // Row 6
            const uslRow = 6;      // Row 7
            const lslRow = 7;      // Row 8
            const dataStartRow = 8; // Row 9

            // Read main header from I4 (column I = index 8, row 4 = index 3)
            const mainHeaderColIndex = 8; // Column I
            let mainHeader = '';
            if (jsonData[headerRow] && jsonData[headerRow][mainHeaderColIndex]) {
                mainHeader = String(jsonData[headerRow][mainHeaderColIndex]).trim();
                console.log(`Found main header at I4: ${mainHeader}`);
            }

            // Scanner calibration will be handled directly from row 5 for columns O and P
            // No need to read from row 4 for these columns

            // Find machine serial column (column E, index 4)
            const machineSerialColIndex = 4;

            // Collect unique machine serial numbers from column E
            let machineSerials = [];
            const seenValues = new Set();
            for (let row = dataStartRow; row < Math.min(dataStartRow + 10, jsonData.length); row++) {
                if (jsonData[row] && jsonData[row][machineSerialColIndex]) {
                    const val = String(jsonData[row][machineSerialColIndex]).trim();
                    // Clean trailing characters
                    const cleanVal = val.replace(/[,`'"]+$/g, '').trim();
                    if (cleanVal && cleanVal.length > 0 && !seenValues.has(cleanVal)) {
                        seenValues.add(cleanVal);
                        machineSerials.push(cleanVal);
                    }
                }
            }

            console.log(`Found ${machineSerials.length} machines: ${machineSerials.join(', ')}`);

            // Collect spec headers from column H to P (indices 7-15)
            const specDataStartCol = 7;  // Column H = index 7
            const specDataEndCol = 15;   // Column P = index 15

            console.log(`Processing columns ${specDataStartCol} to ${specDataEndCol} (${String.fromCharCode(65 + specDataStartCol)} to ${String.fromCharCode(65 + specDataEndCol)})`);

            if (jsonData.length > dataStartRow && machineSerials.length > 0) {
                const headerRowData = jsonData[headerRow] || [];
                const specLimitRowData = jsonData[specLimitRow] || [];
                const unitRowData = jsonData[unitRow] || [];
                const uslRowData = jsonData[uslRow] || [];
                const lslRowData = jsonData[lslRow] || [];

                // Collect headers from column H to P (row 4)
                const specHeaders = [];
                console.log(`Header row length: ${headerRowData.length}, will process cols ${specDataStartCol} to ${Math.min(specDataEndCol, headerRowData.length - 1)}`);

                for (let col = specDataStartCol; col <= Math.min(specDataEndCol, headerRowData.length - 1); col++) {
                    let headerStr = '';
                    console.log(`\n=== Column ${col} (${String.fromCharCode(65 + col)}) ===`);

                    // For columns O and P (indices 14-15), read from row 5 instead of row 4
                    const isScannerCalibrationColumn = (col === 14 || col === 15);

                    if (isScannerCalibrationColumn) {
                        // Read from row 5 (index 4) to get "X @50mmX50mm" or "Y @50mmX50mm"
                        const subHeaderRowData = jsonData[4]; // Row 5 (index 4)
                        const subHeader = subHeaderRowData ? subHeaderRowData[col] : null;
                        console.log(`  Reading from row 5, col ${col}: "${subHeader}"`);

                        if (subHeader) {
                            const subHeaderStr = String(subHeader).trim();
                            // Extract X or Y from "X @50mmX50mm" or "Y @50mmX50mm"
                            const match = subHeaderStr.match(/^([XY])\s+@/);
                            if (match) {
                                const axis = match[1]; // "X" or "Y"
                                headerStr = `${axis} Scanner Calibration`;
                                console.log(`  → Created header "${headerStr}" from "${subHeaderStr}"`);
                            } else {
                                // Fallback if pattern doesn't match
                                headerStr = `${subHeaderStr} Scanner Calibration`;
                                console.log(`  → Fallback header "${headerStr}"`);
                            }
                        }
                    } else {
                        // For all other columns, read from row 4
                        const header = headerRowData[col];
                        console.log(`  Reading from row 4, col ${col}: "${header}"`);
                        if (header) {
                            headerStr = String(header).trim();
                        }
                    }

                    if (headerStr && headerStr.length > 0) {
                        const unit = unitRowData[col] ? String(unitRowData[col]).trim() : '';
                        let usl = uslRowData[col] ? String(uslRowData[col]).trim() : '';
                        let lsl = lslRowData[col] ? String(lslRowData[col]).trim() : '';

                        // Ignore USL/LSL if they contain "/" or other non-numeric values
                        if (usl === '/' || usl === '-' || (usl && isNaN(parseFloat(usl)))) {
                            usl = '';
                        }
                        if (lsl === '/' || lsl === '-' || (lsl && isNaN(parseFloat(lsl)))) {
                            lsl = '';
                        }

                        // Check Row 5 for spec limits (but skip if we already used it as subheader for Scanner calibration)
                        const specLimitCell = specLimitRowData[col] ? String(specLimitRowData[col]).trim() : '';
                        let specLimit = '';

                        if (specLimitCell && !isScannerCalibrationColumn) {
                            // Parse spec limits from Row 5 (only if not used as subheader)
                            console.log(`Checking Row 5 for col ${col} (${String.fromCharCode(65 + col)}): "${specLimitCell}"`);

                            // Convert to string and trim
                            const specStr = String(specLimitCell).trim();
                            console.log(`  After string conversion: "${specStr}"`);
                            console.log(`  Char codes: ${Array.from(specStr).map(c => `${c}(${c.charCodeAt(0)})`).join(', ')}`);

                            // Match ≤ (U+2264), ≥ (U+2265), <=, >=, <, >
                            // Be very flexible with whitespace and optional = sign
                            const lteMatch = specStr.match(/[<≤]\s*=?\s*(\d+(?:\.\d+)?)/);
                            const gteMatch = specStr.match(/[>≥]\s*=?\s*(\d+(?:\.\d+)?)/);
                            const numOnlyMatch = specStr.match(/^(\d+(?:\.\d+)?)$/);

                            if (lteMatch) {
                                // Upper limit (≤1.5 or <=1.5 means USL is 1.5)
                                usl = lteMatch[1];
                                // Normalize the spec limit display to use <=
                                specLimit = `<=${lteMatch[1]}`;
                                console.log(`✓ Found <= spec limit in Row 5 for col ${col}: original="${specStr}", normalized="${specLimit}", USL set to ${usl}`);
                            } else if (gteMatch) {
                                // Lower limit (≥0.5 or >=0.5 means LSL is 0.5)
                                lsl = gteMatch[1];
                                // Normalize the spec limit display to use >=
                                specLimit = `>=${gteMatch[1]}`;
                                console.log(`✓ Found >= spec limit in Row 5 for col ${col}: original="${specStr}", normalized="${specLimit}", LSL set to ${lsl}`);
                            } else if (numOnlyMatch) {
                                // Just a number like "0.05" - treat as <=0.05
                                usl = numOnlyMatch[1];
                                specLimit = `<=${numOnlyMatch[1]}`;
                                console.log(`✓ Found numeric spec in Row 5 for col ${col}: "${specLimit}", USL set to ${usl}`);
                            } else {
                                console.log(`✗ No spec pattern matched for col ${col}: "${specStr}"`);
                            }
                        } else if (isScannerCalibrationColumn) {
                            // For Scanner calibration X/Y, check Row 6 for spec limit (might be "0.05")
                            const row6Cell = unitRowData[col] ? String(unitRowData[col]).trim() : '';
                            const numMatch = row6Cell.match(/^(\d+\.?\d*)$/);
                            if (numMatch) {
                                // Found a number in Row 6 - treat as <=value
                                if (!usl) usl = numMatch[1];
                                specLimit = `<=${numMatch[1]}`;
                                console.log(`Found Scanner calibration spec in Row 6 for col ${col}: ${specLimit}`);
                            }
                        }

                        specHeaders.push({
                            col: col,
                            name: headerStr,
                            unit: unit,
                            usl: usl,
                            lsl: lsl,
                            specLimit: specLimit, // Store the original spec limit text
                            parentHeader: null // No parent header - display as standalone parameters
                        });
                        console.log(`✓ Created spec header at col ${col}:`);
                        console.log(`  name: "${headerStr}"`);
                        console.log(`  unit: "${unit}"`);
                        console.log(`  usl: "${usl}", lsl: "${lsl}"`);
                        console.log(`  specLimit: "${specLimit}"`);
                    }
                }

                console.log(`Found ${specHeaders.length} spec headers from column H to P`);

                // Group data by machine serial
                const machineData = {};
                machineSerials.forEach((serial) => {
                    machineData[serial] = {
                        parameters: []
                    };
                });

                // Map data rows to machines (rows 9-10 = machine 1, rows 11-12 = machine 2, etc.)
                // Each machine occupies 2 rows (merged cells)
                const rowsPerMachine = 2;

                machineSerials.forEach((serial, machineIdx) => {
                    const machineStartRow = dataStartRow + (machineIdx * rowsPerMachine);

                    // Read spec data for this machine from column H onwards
                    specHeaders.forEach(header => {
                        // Collect values from both rows (might be merged or separate)
                        const values = [];
                        for (let rowOffset = 0; rowOffset < rowsPerMachine; rowOffset++) {
                            const row = machineStartRow + rowOffset;
                            if (jsonData[row] && jsonData[row][header.col]) {
                                const value = jsonData[row][header.col];
                                if (value !== undefined && value !== '') {
                                    values.push(String(value).trim());
                                }
                            }
                        }

                        // Combine values (if both rows have values like "X=0.9" and "Y=0.7")
                        let displayValue = '';
                        if (values.length === 1) {
                            displayValue = values[0];
                        } else if (values.length === 2) {
                            // Check if they look like separate X/Y values
                            if (values[0].includes('=') || values[1].includes('=')) {
                                displayValue = values.join(', ');
                            } else {
                                displayValue = values[0]; // Use first value if both are same
                            }
                        }

                        // Special handling for "Working table levelness" - extract X and Y values
                        if (header.name.toLowerCase().includes('working') && header.name.toLowerCase().includes('table') &&
                            header.name.toLowerCase().includes('levelness') && displayValue.includes('X=') && displayValue.includes('Y=')) {
                            // Parse "X=0.9, Y=0.7" format
                            const xMatch = displayValue.match(/X\s*=\s*(-?\d+\.?\d*)/i);
                            const yMatch = displayValue.match(/Y\s*=\s*(-?\d+\.?\d*)/i);
                            if (xMatch && yMatch) {
                                displayValue = `X=${xMatch[1]}, Y=${yMatch[1]}`;
                            }
                        }

                        if (displayValue) {
                            // Special handling for "Working table levelness" - hardcode spec if not found
                            let finalUsl = header.usl;
                            let finalLsl = header.lsl;
                            let finalSpecLimit = header.specLimit || '';

                            if (header.name.toLowerCase().includes('working') &&
                                header.name.toLowerCase().includes('table') &&
                                header.name.toLowerCase().includes('levelness')) {
                                // Hardcode spec for Working table levelness
                                if (!finalUsl) finalUsl = '1.5';
                                if (!finalSpecLimit) finalSpecLimit = '<=1.5';
                                console.log(`Applied hardcoded spec for Working table levelness: USL=1.5, SpecLimit=<=1.5`);
                            }

                            const param = {
                                name: header.name,
                                value: displayValue,
                                unit: header.unit,
                                usl: finalUsl,
                                lsl: finalLsl,
                                specLimit: finalSpecLimit,
                                parentHeader: header.parentHeader || null
                            };
                            machineData[serial].parameters.push(param);
                            console.log(`Added parameter for ${serial}: ${header.name} = ${displayValue}`);
                            console.log(`  USL: "${finalUsl}", LSL: "${finalLsl}", SpecLimit: "${finalSpecLimit}", Unit: "${header.unit}"`);
                        }
                    });
                });

                console.log('Transcoding machine data structure:', machineData);

                // Log parameter counts for each machine
                Object.keys(machineData).forEach(serial => {
                    console.log(`Machine ${serial} has ${machineData[serial].parameters.length} parameters`);
                });

                // Add each machine as a spec_validation item
                Object.keys(machineData).forEach(serial => {
                    const machine = machineData[serial];

                    analysis.push({
                        type: 'spec_validation',
                        field: serial,
                        machineId: serial,
                        message: `${serial}`,
                        status: 'good',
                        spec: null,
                        stats: {},
                        parameters: machine.parameters,
                        mainHeader: mainHeader // Store the main header from I4
                    });
                });
            }

            // Skip further processing
            return;
        }

        // ORIGINAL FORMAT PROCESSING (for deburring and other files)
        // Find the first non-empty column (starting from column J, index 9)
        let firstDataCol = -1;
        for (let col = 9; col < 100; col++) {
            let hasData = false;
            for (let row = 0; row < Math.min(20, jsonData.length); row++) {
                if (jsonData[row] && jsonData[row][col]) {
                    hasData = true;
                    break;
                }
            }
            if (hasData) {
                firstDataCol = col;
                break;
            }
        }

        if (firstDataCol === -1) {
            // No data found, skip this sheet
            return;
        }

        // Find the row with nozzle numbers (sequence starting from 1, 2, 3...)
        let nozzleRowIndex = -1;
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
            const row = jsonData[i];
            if (row) {
                // Check if this row starts with 1, 2, 3 sequence in the data columns
                const firstThree = [row[firstDataCol], row[firstDataCol + 1], row[firstDataCol + 2]];
                if (firstThree[0] === 1 && firstThree[1] === 2 && firstThree[2] === 3) {
                    nozzleRowIndex = i;
                    break;
                }
            }
        }

        // Find header row (row before nozzle numbers with parameter names)
        let headerRowIndex = -1;
        if (nozzleRowIndex > 0) {
            for (let i = nozzleRowIndex - 1; i >= 0; i--) {
                const row = jsonData[i];
                if (row && row[firstDataCol]) {
                    const cellStr = String(row[firstDataCol]).toLowerCase();
                    if (cellStr.includes('pressure') || cellStr.includes('distance') || cellStr.includes('angle') || cellStr.includes('speed') || cellStr.includes('numeric') || cellStr.includes('go/no-go')) {
                        headerRowIndex = i;
                        break;
                    }
                }
            }
        }

        // Data row is right after nozzle numbers
        const dataRowIndex = nozzleRowIndex >= 0 ? nozzleRowIndex + 1 : -1;

        if (headerRowIndex === -1 || dataRowIndex === -1 || dataRowIndex >= jsonData.length) {
            // Couldn't find proper structure, skip
            return;
        }

        const headers = jsonData[headerRowIndex] || [];
        const identifiers = nozzleRowIndex >= 0 ? jsonData[nozzleRowIndex] || [] : [];

        // Get ALL data rows starting from dataRowIndex
        // Look for rows that have actual numeric data in the data columns
        const dataRows = [];
        for (let i = dataRowIndex; i < Math.min(dataRowIndex + 20, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row[firstDataCol] !== undefined && row[firstDataCol] !== '') {
                // Check if this row has numeric data or is a machine identifier
                const firstVal = row[firstDataCol];
                if (!isNaN(parseFloat(firstVal)) || String(firstVal).match(/DB\d+-(CG|BG)/i)) {
                    dataRows.push(row);
                }
            }
        }

        // Analyze each parameter group for EACH data row (machine)
        // Track which headers we've already processed
        const processedHeaders = new Set();

        headers.forEach((header, colIndex) => {
            if (!header) return;
            if (colIndex < firstDataCol) return; // Skip columns before first data column

            // Only process each unique header once
            if (processedHeaders.has(header)) return;
            processedHeaders.add(header);

            // Process EACH data row separately (for multiple machines)
            dataRows.forEach((dataRow, rowIdx) => {
                // Get machine identifier - try to use actual Machine ID from metadata
                let machineId = '';
                const machinePattern = /DB[-\s]*\d+\s*-\s*(CG|BG)/i;
                let gunType = ''; // BG or CG

                // First, get the gun type (BG or CG) from column G
                if (dataRow[6]) {
                    const cellValue = String(dataRow[6]).trim();
                    const match = cellValue.match(machinePattern);
                    if (match) {
                        gunType = match[1]; // Extract BG or CG
                    }
                }

                // If not found in column G, search entire row
                if (!gunType) {
                    for (let c = 0; c < dataRow.length; c++) {
                        const cellValue = String(dataRow[c] || '').trim();
                        const match = cellValue.match(machinePattern);
                        if (match) {
                            gunType = match[1]; // Extract BG or CG
                            break;
                        }
                    }
                }

                // Try to get actual Machine ID from metadata
                if (metadata.length > 0) {
                    const machineIdItem = metadata.find(item =>
                        item.key.toLowerCase().includes('machine') &&
                        item.key.toLowerCase().includes('id') &&
                        !item.key.toLowerCase().includes('internal')
                    );

                    if (machineIdItem && machineIdItem.value) {
                        // Parse comma-separated machine IDs
                        const machineIds = machineIdItem.value.split(',').map(id => id.trim());

                        // Map based on row index or gun type
                        // Typically: first machine = BG, second machine = CG
                        if (gunType === 'BG' && machineIds.length > 0) {
                            machineId = machineIds[0];
                        } else if (gunType === 'CG' && machineIds.length > 1) {
                            machineId = machineIds[1];
                        } else if (machineIds.length > rowIdx) {
                            machineId = machineIds[rowIdx];
                        }
                    }
                }

                // Fallback to DB-X-BG/CG format if no metadata found
                if (!machineId && gunType) {
                    machineId = `DB-2-${gunType}`;
                }

                // For nozzle-based measurements, collect data across columns for THIS parameter group
                // Stop when nozzle number resets to 1 (indicates new parameter group)
                let columnData = [];
                let seenFirstNozzle = false;

                for (let col = colIndex; col < dataRow.length; col++) {
                    const val = dataRow[col];
                    const nozzleNum = identifiers[col];

                    // Stop if we see nozzle "1" again after already seeing it (new parameter group)
                    if (nozzleNum === 1 && seenFirstNozzle) {
                        break;
                    }
                    if (nozzleNum === 1) {
                        seenFirstNozzle = true;
                    }

                    if (val !== undefined && val !== '' && !isNaN(parseFloat(val))) {
                        columnData.push(val);
                    }
                }

                if (columnData.length === 0) return;

                // Create a unique header for this machine + parameter combination
                const fullHeader = machineId ? `${machineId} - ${header}` : header;

                // Detect data type
                const isNumeric = columnData.every(val => !isNaN(parseFloat(val)));
                const isDate = columnData.some(val => {
                    const str = String(val);
                    return str.match(/\d{4}-\d{2}-\d{2}/) || str.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
                });
                const isYesNo = columnData.every(val => ['Yes', 'No', 'yes', 'no', 'YES', 'NO'].includes(String(val).trim()));

                if (isYesNo) {
                    const yesCount = columnData.filter(val => ['Yes', 'yes', 'YES'].includes(String(val).trim())).length;
                    const noCount = columnData.length - yesCount;
                    const passRate = ((yesCount / columnData.length) * 100).toFixed(1);

                    analysis.push({
                        type: 'compliance',
                        field: header,
                        message: `${header}: ${yesCount} passed, ${noCount} failed (${passRate}% pass rate)`,
                        status: passRate >= 95 ? 'good' : passRate >= 80 ? 'warning' : 'critical',
                        passRate: passRate
                    });
                } else if (isNumeric) {
                    const numbers = columnData.map(val => parseFloat(val));
                    const min = Math.min(...numbers);
                    const max = Math.max(...numbers);
                    const avg = (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2);

                    // Check if there's a spec for this column
                    let applicableSpec = null;

                    // First, try exact column match
                    if (specs[`col${colIndex}`]) {
                        applicableSpec = specs[`col${colIndex}`];
                    }

                    // If not found, look for specs in nearby columns (±2 columns)
                    if (!applicableSpec) {
                        for (let offset = -2; offset <= 2; offset++) {
                            if (specs[`col${colIndex + offset}`]) {
                                applicableSpec = specs[`col${colIndex + offset}`];
                                break;
                            }
                        }
                    }

                    // Also check old format specs
                    if (!applicableSpec) {
                        for (const specKey in specs) {
                            const spec = specs[specKey];
                            if (Math.abs(spec.colIndex - colIndex) <= 2) {
                                applicableSpec = spec;
                                break;
                            }
                        }
                    }

                    if (applicableSpec && applicableSpec.min !== null && applicableSpec.max !== null) {
                        // Parse the original spec cell for special nozzle specifications
                        let groupedSpecs = []; // Array of {count or nozzles, spec} objects

                        if (applicableSpec.originalCell) {
                            const specText = applicableSpec.originalCell;

                            // Pattern 1: Explicit nozzle numbers like "4 Nozzle (7,11,12,14) Spec- 90 ± 3°"
                            const explicitMatch = specText.match(/nozzle\s*\(([0-9,\s]+)\)[^0-9]*(\d+\.?\d*)\s*[±]\s*(\d+\.?\d*)\s*([a-zA-Z°]+)/i);
                            if (explicitMatch) {
                                const nozzleStr = explicitMatch[1];
                                const nozzleNumbers = nozzleStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                                const target = parseFloat(explicitMatch[2]);
                                const tolerance = parseFloat(explicitMatch[3]);
                                const unit = explicitMatch[4];

                                groupedSpecs.push({
                                    nozzles: nozzleNumbers,
                                    spec: {
                                        target: target,
                                        tolerance: tolerance,
                                        unit: unit,
                                        min: target - tolerance,
                                        max: target + tolerance
                                    }
                                });
                            }

                            // Pattern 2: Grouped specs like "2 Nozzles - 50 ± 10 mm" or "22 Nozzle 100 ±10 mm"
                            // Match with or without dash, with or without space before ±
                            const groupedPattern = /(\d+)\s*nozzles?\s*[-–]?\s*(\d+\.?\d*)\s*[±]\s*(\d+\.?\d*)\s*([a-zA-Z°]+)?/gi;
                            let match;
                            while ((match = groupedPattern.exec(specText)) !== null) {
                                const count = parseInt(match[1]);
                                const target = parseFloat(match[2]);
                                const tolerance = parseFloat(match[3]);
                                const unit = match[4] || ''; // Unit might be missing

                                groupedSpecs.push({
                                    count: count,
                                    spec: {
                                        target: target,
                                        tolerance: tolerance,
                                        unit: unit,
                                        min: target - tolerance,
                                        max: target + tolerance
                                    }
                                });
                            }
                        }

                        // Collect ALL measurements with identifiers for table display
                        const allMeasurements = [];
                        let withinSpecCount = 0;

                        // Build list of all available specs (main + grouped)
                        const allSpecs = [applicableSpec];
                        if (groupedSpecs.length > 0) {
                            groupedSpecs.forEach(g => {
                                if (g.spec && !allSpecs.find(s => s.target === g.spec.target)) {
                                    allSpecs.push(g.spec);
                                }
                            });
                        }

                        columnData.forEach((val, idx) => {
                            const numVal = parseFloat(val);
                            // Get identifier from the corresponding column
                            const identifierCol = colIndex + idx;
                            const identifier = identifiers[identifierCol] || `#${idx + 1}`;

                            // Find the best matching spec for this nozzle's value
                            let useSpec = applicableSpec;
                            let minDistance = Math.abs(numVal - applicableSpec.target);

                            // Check if there's an explicit nozzle assignment first
                            let explicitSpec = null;
                            groupedSpecs.forEach(group => {
                                if (group.nozzles && group.nozzles.includes(identifier)) {
                                    explicitSpec = group.spec;
                                }
                            });

                            if (explicitSpec) {
                                // Use explicit assignment
                                useSpec = explicitSpec;
                            } else {
                                // Find closest spec by target value
                                allSpecs.forEach(spec => {
                                    const distance = Math.abs(numVal - spec.target);
                                    if (distance < minDistance) {
                                        minDistance = distance;
                                        useSpec = spec;
                                    }
                                });
                            }

                            const isWithinSpec = numVal >= useSpec.min && numVal <= useSpec.max;
                            if (isWithinSpec) withinSpecCount++;

                            const deviation = !isWithinSpec ? (numVal < useSpec.min ?
                                (numVal - useSpec.min).toFixed(2) :
                                (numVal - useSpec.max).toFixed(2)) : null;

                            allMeasurements.push({
                                identifier: identifier,
                                value: numVal,
                                isWithinSpec: isWithinSpec,
                                deviation: deviation,
                                status: !isWithinSpec ? (numVal < useSpec.min ? 'below' : 'above') : 'ok',
                                spec: useSpec // Store which spec was used
                            });
                        });

                        const outOfSpecCount = columnData.length - withinSpecCount;
                        const complianceRate = ((withinSpecCount / columnData.length) * 100).toFixed(1);

                        // Build detailed message with unique specs only
                        let detailedMessage = `${fullHeader}: Spec ${applicableSpec.target}${applicableSpec.unit || ''} ±${applicableSpec.tolerance} (${applicableSpec.min.toFixed(1)}-${applicableSpec.max.toFixed(1)})`;

                        // Add grouped spec details if present - show only unique specs without counts
                        if (groupedSpecs.length > 0) {
                            // Collect unique specs (by target value)
                            const uniqueSpecs = [];
                            const seenTargets = new Set([applicableSpec.target]);

                            groupedSpecs.forEach(g => {
                                if (g.spec && !seenTargets.has(g.spec.target)) {
                                    seenTargets.add(g.spec.target);
                                    uniqueSpecs.push(g.spec);
                                }
                            });

                            // Format as "target±tolerance (min-max)"
                            if (uniqueSpecs.length > 0) {
                                const specDetails = uniqueSpecs.map(spec => {
                                    // Normalize unit: "set" should be "mm"
                                    const normalizedUnit = spec.unit === 'set' ? 'mm' : spec.unit;
                                    return `${spec.target}${normalizedUnit} ±${spec.tolerance} (${spec.min.toFixed(1)}-${spec.max.toFixed(1)})`;
                                }).join(' | ');

                                detailedMessage += ` | ${specDetails}`;
                            }
                        }

                        // Collect out-of-spec details
                        const outOfSpecDetails = allMeasurements.filter(m => !m.isWithinSpec);

                        analysis.push({
                            type: 'spec_validation',
                            field: fullHeader, // Use fullHeader which includes machine name
                            message: `${detailedMessage} | ${withinSpecCount}/${numbers.length} within spec (${complianceRate}%)`,
                            status: complianceRate >= 95 ? 'good' : complianceRate >= 80 ? 'warning' : 'critical',
                            spec: applicableSpec,
                            stats: { min, max, avg, withinSpec: withinSpecCount, outOfSpec: outOfSpecCount, complianceRate },
                            allMeasurements: allMeasurements,
                            outOfSpecDetails: outOfSpecDetails,
                            machineId: machineId // Store machine ID separately
                        });

                        // List out-of-spec values with detailed information
                        if (outOfSpecCount > 0) {
                            const detailsText = outOfSpecDetails.map(d =>
                                `${d.identifier}: ${d.value}${applicableSpec.unit || ''} (${d.status === 'below' ? '' : '+'}${d.deviation})`
                            ).join(', ');

                            analysis.push({
                                type: 'spec_failure',
                                field: header,
                                message: `⚠️ Out-of-spec in ${header}: ${detailsText}`,
                                status: 'critical',
                                outOfSpecDetails: outOfSpecDetails
                            });
                        }
                    } else {
                        analysis.push({
                            type: 'numeric',
                            field: header,
                            message: `${header}: Range ${min} to ${max}, Average: ${avg}`,
                            stats: { min, max, avg, count: numbers.length }
                        });
                    }
                } else if (isDate) {
                    const dates = columnData.map(val => String(val));
                    const earliest = dates[0];
                    const latest = dates[dates.length - 1];

                    analysis.push({
                        type: 'date',
                        field: header,
                        message: `${header}: From ${earliest} to ${latest}`,
                        range: { earliest, latest }
                    });
                } else {
                    // Categorical data
                    const uniqueValues = [...new Set(columnData.map(v => String(v)))];
                    if (uniqueValues.length <= 10) {
                        const valueCounts = {};
                        columnData.forEach(val => {
                            const key = String(val);
                            valueCounts[key] = (valueCounts[key] || 0) + 1;
                        });

                        const topValues = Object.entries(valueCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([val, count]) => `${val} (${count})`)
                            .join(', ');

                        analysis.push({
                            type: 'categorical',
                            field: header,
                            message: `${header}: ${uniqueValues.length} unique values - ${topValues}`,
                            uniqueCount: uniqueValues.length
                        });
                    }
                }
            });
        });

        // Overall data quality check
        const totalCells = dataRows.length * headers.length;
        const filledCells = dataRows.reduce((sum, row) => {
            return sum + row.filter(cell => cell !== undefined && cell !== '').length;
        }, 0);
        const completeness = ((filledCells / totalCells) * 100).toFixed(1);

        analysis.push({
            type: 'quality',
            field: 'Data Completeness',
            message: `${completeness}% of cells contain data (${filledCells}/${totalCells})`,
            status: completeness >= 95 ? 'good' : completeness >= 80 ? 'warning' : 'critical',
            completeness: completeness
        });
    });

    return analysis;
}

// Generate intelligent content summary for export
function generateIntelligentSummary(data) {
    let insights = [];

    if (data.type === 'excel') {
        const analysis = analyzeExcelContent(data.content, '');

        analysis.forEach(item => {
            if (item.type === 'compliance') {
                insights.push(`✓ ${item.message}`);
            } else if (item.type === 'quality') {
                insights.push(`📊 ${item.message}`);
            } else {
                insights.push(`• ${item.message}`);
            }
        });
    } else if (data.type === 'text') {
        const content = data.content;
        const lines = content.split('\n').filter(l => l.trim());

        // Extract first meaningful line as title/summary
        const firstLine = lines[0];
        if (firstLine && firstLine.length < 100) {
            insights.push(`Content: "${firstLine.trim()}"`);
        }

        // Look for key patterns
        if (content.toLowerCase().includes('pass') || content.toLowerCase().includes('fail')) {
            insights.push('Document contains pass/fail criteria');
        }
    }

    return insights;
}

// Generate summary (Content-focused)
function generateSummary(file, data) {
    let summary = '';

    if (data.type === 'excel') {
        // Excel content analysis
        const analysis = analyzeExcelContent(data.content, file.name);

        summary += `<div style="margin-bottom: 20px;">`;
        summary += `<p style="font-size: 1.1rem; color: #667eea; font-weight: 600; margin-bottom: 15px;">📊 Data Analysis Results</p>`;

        // Group by type
        const metadata = analysis.filter(a => a.type === 'metadata');
        const specValidation = analysis.filter(a => a.type === 'spec_validation');
        const specFailures = analysis.filter(a => a.type === 'spec_failure');
        const compliance = analysis.filter(a => a.type === 'compliance');
        const quality = analysis.filter(a => a.type === 'quality');
        const numeric = analysis.filter(a => a.type === 'numeric');
        const categorical = analysis.filter(a => a.type === 'categorical');
        const dates = analysis.filter(a => a.type === 'date');
        const polishingValidation = analysis.filter(a => a.type === 'polishing_validation');
        const polishingData = analysis.filter(a => a.type === 'polishing_data');

        // Check if this is calibration data (has calibrationGroup property)
        const isCalibrationData = specValidation.some(item => item.calibrationGroup);
        const isPolishingData = polishingValidation.length > 0 || polishingData.length > 0;

        // Display Metadata First (if found)
        if (metadata.length > 0 && metadata[0].items && metadata[0].items.length > 0) {
            summary += `<div style="margin-top: 15px; padding: 15px; background: #e8eaf6; border-radius: 8px; border-left: 4px solid #5c6bc0;">`;
            summary += `<p style="font-weight: 600; color: #3949ab; margin-bottom: 10px;">📋 Document Metadata</p>`;

            metadata[0].items.forEach(item => {
                // Remove any colons from the key
                const cleanKey = item.key.replace(/:/g, '');

                let displayValue = item.value;

                // Format date values if they look like Excel serial numbers or timestamps
                if (!isNaN(displayValue) && displayValue > 40000 && displayValue < 60000) {
                    // Excel date serial number - convert to readable date
                    const excelEpoch = new Date(1899, 11, 30);
                    const date = new Date(excelEpoch.getTime() + displayValue * 86400000);
                    displayValue = date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } else if (String(displayValue).match(/^\d{4}-\d{2}-\d{2}/)) {
                    // ISO date format - make it more readable
                    const date = new Date(displayValue);
                    if (!isNaN(date.getTime())) {
                        displayValue = date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                    }
                }

                summary += `<p style="margin: 6px 0; color: #37474f;"><strong>${cleanKey}</strong> - ${displayValue}</p>`;
            });

            summary += `</div>`;
        }

        // POLISHING DATA TABLE VISUALIZATION
        if (isPolishingData) {
            const allPolishingItems = [...polishingValidation, ...polishingData];

            // Group by merged header (group)
            const byGroup = {};
            allPolishingItems.forEach(item => {
                const group = item.group || 'General';
                if (!byGroup[group]) {
                    byGroup[group] = [];
                }
                byGroup[group].push(item);
            });

            // Display each group as a table
            Object.keys(byGroup).forEach((groupName, groupIdx) => {
                const groupItems = byGroup[groupName];

                summary += `<div style="margin-top: ${groupIdx === 0 ? '20px' : '25px'}; padding: 20px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid #667eea;">`;
                summary += `<p style="font-weight: 700; color: #667eea; margin-bottom: 15px; font-size: 1.2rem;">📊 ${groupName}</p>`;

                // Get all unique machines from the first item
                const firstItem = groupItems[0];
                const machines = firstItem.machineData ? firstItem.machineData.map(d => d.machineId) : [];
                const uniqueMachines = [...new Set(machines)];

                // Create table
                summary += `<div style="overflow-x: auto;">`;
                summary += `<table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;

                // Table header
                summary += `<thead>`;
                summary += `<tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">`;
                summary += `<th style="padding: 12px; text-align: left; color: white; font-weight: 600; border-right: 1px solid rgba(255,255,255,0.2);">Machine ID</th>`;

                // Add column for each parameter
                groupItems.forEach(item => {
                    summary += `<th style="padding: 12px; text-align: center; color: white; font-weight: 600; border-right: 1px solid rgba(255,255,255,0.2);">${item.parameter}</th>`;
                });

                summary += `</tr>`;
                summary += `</thead>`;

                // Table body
                summary += `<tbody>`;

                uniqueMachines.forEach((machineId, rowIdx) => {
                    const rowBg = rowIdx % 2 === 0 ? '#ffffff' : '#f8f9fa';
                    summary += `<tr style="background: ${rowBg}; border-bottom: 1px solid #e0e0e0;">`;
                    summary += `<td style="padding: 12px; font-weight: 600; color: #333; border-right: 1px solid #e0e0e0;">${machineId}</td>`;

                    // Add value for each parameter
                    groupItems.forEach(item => {
                        const machineDataItem = item.machineData ? item.machineData.find(d => d.machineId === machineId) : null;

                        if (machineDataItem) {
                            const value = machineDataItem.value;
                            const numVal = parseFloat(value);

                            // Check if within spec
                            let isWithinSpec = true;
                            let icon = '';
                            let cellColor = '#333';
                            let cellBg = 'transparent';

                            if (item.spec && !isNaN(numVal)) {
                                isWithinSpec = numVal >= item.spec.min && numVal <= item.spec.max;
                                icon = isWithinSpec ? '✓' : '✗';
                                cellColor = isWithinSpec ? '#2e7d32' : '#c62828';
                                cellBg = isWithinSpec ? '#e8f5e9' : '#ffebee';
                            }

                            const displayValue = !isNaN(numVal) ? numVal.toFixed(6) : value;
                            const specText = item.spec ? ` (Spec: ${item.spec.target}±${item.spec.tolerance})` : '';

                            summary += `<td style="padding: 12px; text-align: center; color: ${cellColor}; background: ${cellBg}; border-right: 1px solid #e0e0e0; font-weight: 500;">`;
                            summary += `${icon} ${displayValue}`;
                            if (item.spec) {
                                summary += `<br><span style="font-size: 0.75rem; color: #666;">${specText}</span>`;
                            }
                            summary += `</td>`;
                        } else {
                            summary += `<td style="padding: 12px; text-align: center; color: #999; border-right: 1px solid #e0e0e0;">-</td>`;
                        }
                    });

                    summary += `</tr>`;
                });

                summary += `</tbody>`;
                summary += `</table>`;
                summary += `</div>`;

                // Add summary statistics if validation data exists
                const validationItems = groupItems.filter(item => item.type === 'polishing_validation');
                if (validationItems.length > 0) {
                    summary += `<div style="margin-top: 15px; padding: 12px; background: white; border-radius: 8px; border-left: 3px solid #667eea;">`;
                    summary += `<p style="font-weight: 600; color: #667eea; margin-bottom: 8px;">Summary:</p>`;

                    validationItems.forEach(item => {
                        const icon = item.status === 'good' ? '✅' : item.status === 'warning' ? '⚠️' : '❌';
                        const color = item.status === 'good' ? '#2e7d32' : item.status === 'warning' ? '#f57c00' : '#c62828';

                        summary += `<p style="margin: 4px 0; color: ${color}; font-weight: 500;">• ${icon} ${item.message}</p>`;
                    });

                    summary += `</div>`;
                }

                summary += `</div>`;
            });
        }

        // CALIBRATION DATA TABLE VISUALIZATION - DISABLED (showing only machine-wise summary below)
        // if (isCalibrationData && specValidation.length > 0) {
        //     ... table code removed to show only machine-wise summary
        // }

        // Specification Validation - MACHINE-CENTRIC VIEW
        if (specValidation.length > 0 && !isCalibrationData) {
            // Check if this is polishing data (has headers property)
            const hasPolishingHeaders = specValidation.some(item => item.headers);

            // Check if this is transcoding data (has parameters property instead of headers)
            const isTranscodingData = specValidation.some(item => item.parameters && item.parameters.length > 0);

            console.log('=== Display Detection ===');
            console.log('hasPolishingHeaders:', hasPolishingHeaders);
            console.log('isTranscodingData:', isTranscodingData);
            console.log('specValidation items:', specValidation.length);
            if (specValidation.length > 0) {
                console.log('First item:', specValidation[0]);
            }

            if (hasPolishingHeaders && !isTranscodingData) {
                // POLISHING DATA DISPLAY - Robot/Cell ID header with detailed values
                summary += `<div style="margin-top: 15px; padding: 20px; background: #e8f5e9; border-radius: 12px; border-left: 4px solid #4caf50;">`;
                summary += `<p style="font-weight: 700; color: #2e7d32; margin-bottom: 15px; font-size: 1.2rem;">📏 Specification Compliance</p>`;
                summary += `<p style="font-weight: 600; color: #5a67d8; margin-top: 10px; margin-bottom: 8px; font-size: 1.05rem;">Robot/Cell ID</p>`;

                specValidation.forEach((item, idx) => {
                    if (item.headers) {
                        const machineId = item.machineId;

                        // Validate all values against spec (0 to 0.2)
                        const specMin = 0;
                        const specMax = 0.2;
                        let totalParams = 0;
                        let passedParams = 0;

                        Object.keys(item.headers).forEach((headerName) => {
                            const subHeaders = item.headers[headerName];

                            Object.keys(subHeaders).forEach(subHeaderName => {
                                const value = subHeaders[subHeaderName];
                                const numVal = parseFloat(value);

                                if (!isNaN(numVal)) {
                                    totalParams++;
                                    const isWithinSpec = numVal >= specMin && numVal <= specMax;

                                    if (isWithinSpec) {
                                        passedParams++;
                                    }
                                }
                            });
                        });

                        const passRate = totalParams > 0 ? ((passedParams / totalParams) * 100).toFixed(1) : 0;
                        const icon = passRate >= 95 ? '✅' : passRate >= 80 ? '⚠️' : '❌';
                        const color = passRate >= 95 ? '#2e7d32' : passRate >= 80 ? '#f57c00' : '#c62828';

                        // Show machine name
                        summary += `<p style="font-weight: 600; color: #667eea; margin-top: 10px; margin-bottom: 4px; font-size: 1.05rem; margin-left: 10px;">${machineId}</p>`;

                        // Display in same format as deburring: "• ✅ X/Y parameters within spec (Z%)"
                        summary += `<p style="margin: 4px 0 4px 20px; color: ${color}; font-weight: 500;">• ${icon} ${passedParams}/${totalParams} parameters within spec (${passRate}%)</p>`;
                    }
                });

                // ADD DETAILED VALUES TABLE INSIDE THE SAME SECTION
                summary += `<div style="margin-top: 20px; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;
                summary += `<p style="font-weight: 700; color: #667eea; margin-bottom: 15px; font-size: 1.2rem;">📊 Detailed Measurement Values</p>`;

                // Collect all machines
                const allMachines = specValidation.filter(item => item.headers).map(item => item.machineId);

                // Collect all unique merged headers and their sub-headers
                const headerStructure = {};
                specValidation.forEach(item => {
                    if (item.headers) {
                        Object.keys(item.headers).forEach(mergedHeader => {
                            if (!headerStructure[mergedHeader]) {
                                headerStructure[mergedHeader] = new Set();
                            }
                            Object.keys(item.headers[mergedHeader]).forEach(subHeader => {
                                headerStructure[mergedHeader].add(subHeader);
                            });
                        });
                    }
                });

                // Create table
                summary += `<div style="overflow-x: auto;">`;
                summary += `<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">`;

                // Table header - First row (merged headers)
                summary += `<thead>`;
                summary += `<tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">`;
                summary += `<th rowspan="2" style="padding: 12px; text-align: left; color: white; font-weight: 600; border: 1px solid rgba(255,255,255,0.3); min-width: 120px;">Machine #</th>`;

                Object.keys(headerStructure).forEach(mergedHeader => {
                    const subHeaderCount = headerStructure[mergedHeader].size;
                    summary += `<th colspan="${subHeaderCount}" style="padding: 12px; text-align: center; color: white; font-weight: 600; border: 1px solid rgba(255,255,255,0.3);">${mergedHeader}</th>`;
                });

                summary += `</tr>`;

                // Table header - Second row (sub-headers)
                summary += `<tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">`;

                Object.keys(headerStructure).forEach(mergedHeader => {
                    Array.from(headerStructure[mergedHeader]).forEach(subHeader => {
                        summary += `<th style="padding: 10px 8px; text-align: center; color: white; font-weight: 500; border: 1px solid rgba(255,255,255,0.3); font-size: 0.85rem; min-width: 100px;">${subHeader}</th>`;
                    });
                });

                summary += `</tr>`;
                summary += `</thead>`;

                // Table body - Data rows
                summary += `<tbody>`;

                specValidation.forEach((item, rowIdx) => {
                    if (item.headers) {
                        const machineId = item.machineId;
                        const rowBg = rowIdx % 2 === 0 ? '#ffffff' : '#f8f9fa';

                        summary += `<tr style="background: ${rowBg};">`;
                        summary += `<td style="padding: 12px; font-weight: 600; color: #333; border: 1px solid #e0e0e0;">${machineId}</td>`;

                        // Add values for each merged header and sub-header
                        Object.keys(headerStructure).forEach(mergedHeader => {
                            Array.from(headerStructure[mergedHeader]).forEach(subHeader => {
                                const value = item.headers[mergedHeader] && item.headers[mergedHeader][subHeader]
                                    ? item.headers[mergedHeader][subHeader]
                                    : '-';

                                // Check if value is within spec
                                const numVal = parseFloat(value);
                                const specMin = 0;
                                const specMax = 0.2;
                                let cellColor = '#333';
                                let cellBg = 'transparent';

                                if (!isNaN(numVal)) {
                                    const isWithinSpec = numVal >= specMin && numVal <= specMax;
                                    cellColor = isWithinSpec ? '#2e7d32' : '#c62828';
                                    cellBg = isWithinSpec ? '#e8f5e9' : '#ffebee';
                                }

                                summary += `<td style="padding: 10px 8px; text-align: center; color: ${cellColor}; background: ${cellBg}; border: 1px solid #e0e0e0; font-weight: 500;">${value}</td>`;
                            });
                        });

                        summary += `</tr>`;
                    }
                });

                summary += `</tbody>`;
                summary += `</table>`;
                summary += `</div>`;

                // Add legend
                summary += `<div style="margin-top: 15px; padding: 12px; background: #f8f9fa; border-radius: 8px; display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">`;
                summary += `<div style="display: flex; align-items: center; gap: 8px;">`;
                summary += `<div style="width: 20px; height: 20px; background: #e8f5e9; border: 2px solid #2e7d32; border-radius: 4px;"></div>`;
                summary += `<span style="color: #666; font-size: 0.9rem;">Within Spec (0 - 0.2)</span>`;
                summary += `</div>`;
                summary += `<div style="display: flex; align-items: center; gap: 8px;">`;
                summary += `<div style="width: 20px; height: 20px; background: #ffebee; border: 2px solid #c62828; border-radius: 4px;"></div>`;
                summary += `<span style="color: #666; font-size: 0.9rem;">Out of Spec</span>`;
                summary += `</div>`;
                summary += `</div>`;
                summary += `</div>`; // Close the detailed values table div
                summary += `</div>`; // Close the specification compliance section
            } else if (isTranscodingData) {
                // TRANSCODING DATA DISPLAY - Show detailed parameter headers
                summary += `<div style="margin-top: 15px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">`;
                summary += `<p style="font-weight: 600; color: #2e7d32; margin-bottom: 10px;">📏 Specification Compliance</p>`;

                // Display main header from I4 if available
                const firstItem = specValidation[0];
                if (firstItem && firstItem.mainHeader) {
                    summary += `<p style="font-weight: 600; color: #5a67d8; margin-top: 10px; margin-bottom: 8px; font-size: 1.05rem;">${firstItem.mainHeader}</p>`;
                }

                // Display each machine with its spec data
                specValidation.forEach((item, idx) => {
                    const machineId = item.machineId || item.field;

                    // Machine header
                    summary += `<p style="font-weight: 600; color: #667eea; margin-top: ${idx > 0 ? '15px' : '10px'}; margin-bottom: 8px; font-size: 1.05rem; margin-left: 10px;">${machineId}</p>`;

                    if (item.parameters && item.parameters.length > 0) {
                        // Count parameters and check compliance
                        let totalParams = 0;
                        let passedParams = 0;
                        let outOfSpecDetails = [];

                        // Group parameters by parent header
                        const paramsByParent = {};
                        const noParent = [];

                        item.parameters.forEach(param => {
                            if (param.parentHeader) {
                                if (!paramsByParent[param.parentHeader]) {
                                    paramsByParent[param.parentHeader] = [];
                                }
                                paramsByParent[param.parentHeader].push(param);
                            } else {
                                noParent.push(param);
                            }
                        });

                        // Display each parameter with its header
                        summary += `<div style="margin-left: 20px; margin-top: 8px;">`;

                        // First display parameters without parent header
                        noParent.forEach(param => {
                            // Extract numeric value from the parameter value
                            // Handle cases like "Y", "X=0.9", "0.022", "X=0.9, Y=0.7", etc.
                            let numVal = null;
                            let displayValue = param.value;

                            // Special handling for "Working table levelness" with X=0.9, Y=0.7 format
                            if (param.value.includes('X=') && param.value.includes('Y=')) {
                                // Extract X and Y values
                                const xMatch = param.value.match(/X\s*=\s*(-?\d+\.?\d*)/i);
                                const yMatch = param.value.match(/Y\s*=\s*(-?\d+\.?\d*)/i);

                                if (xMatch && yMatch) {
                                    const xVal = parseFloat(xMatch[1]);
                                    const yVal = parseFloat(yMatch[1]);
                                    // Use the maximum of X and Y for spec checking
                                    numVal = Math.max(xVal, yVal);
                                }
                            }
                            // If value contains "=" (but not X= Y= format), extract the number after it
                            else if (param.value.includes('=')) {
                                const match = param.value.match(/=\s*(-?\d+\.?\d*)/);
                                if (match) {
                                    numVal = parseFloat(match[1]);
                                }
                            } else if (!isNaN(parseFloat(param.value))) {
                                numVal = parseFloat(param.value);
                            }

                            // Check compliance if we have numeric value and spec limits
                            let isWithinSpec = null;
                            let icon = '•';
                            let color = '#333';

                            if (numVal !== null && param.usl && param.lsl) {
                                totalParams++;
                                const uslNum = parseFloat(param.usl);
                                const lslNum = parseFloat(param.lsl);

                                if (!isNaN(uslNum) && !isNaN(lslNum)) {
                                    isWithinSpec = numVal >= lslNum && numVal <= uslNum;
                                    if (isWithinSpec) {
                                        passedParams++;
                                        icon = '✅';
                                        color = '#2e7d32';
                                    } else {
                                        icon = '❌';
                                        color = '#c62828';
                                        outOfSpecDetails.push({
                                            name: param.name,
                                            value: param.value,
                                            spec: `${lslNum}-${uslNum}${param.unit ? ' ' + param.unit : ''}`
                                        });
                                    }
                                }
                            } else if (numVal !== null && param.usl) {
                                // Only USL specified (like <=0.05)
                                totalParams++;
                                const uslNum = parseFloat(param.usl);

                                if (!isNaN(uslNum)) {
                                    isWithinSpec = numVal <= uslNum;
                                    if (isWithinSpec) {
                                        passedParams++;
                                        icon = '✅';
                                        color = '#2e7d32';
                                    } else {
                                        icon = '❌';
                                        color = '#c62828';
                                        outOfSpecDetails.push({
                                            name: param.name,
                                            value: param.value,
                                            spec: `<=${uslNum}${param.unit ? ' ' + param.unit : ''}`
                                        });
                                    }
                                }
                            } else if (numVal !== null && param.lsl) {
                                // Only LSL specified
                                totalParams++;
                                const lslNum = parseFloat(param.lsl);

                                if (!isNaN(lslNum)) {
                                    isWithinSpec = numVal >= lslNum;
                                    if (isWithinSpec) {
                                        passedParams++;
                                        icon = '✅';
                                        color = '#2e7d32';
                                    } else {
                                        icon = '❌';
                                        color = '#c62828';
                                        outOfSpecDetails.push({
                                            name: param.name,
                                            value: param.value,
                                            spec: `>=${lslNum}${param.unit ? ' ' + param.unit : ''}`
                                        });
                                    }
                                }
                            } else if (param.value.toLowerCase() === 'y' || param.value.toLowerCase() === 'yes') {
                                // Handle Y/N type parameters
                                totalParams++;
                                passedParams++;
                                icon = '✅';
                                color = '#2e7d32';
                            }

                            // Display parameter with header, value, and spec
                            let specText = '';
                            if (param.specLimit) {
                                // Use the spec limit from Row 5 if available
                                // Don't add unit if specLimit already contains it
                                const needsUnit = param.unit && !param.specLimit.includes(param.unit);
                                specText = ` (Spec: ${param.specLimit}${needsUnit ? ' ' + param.unit : ''})`;
                            } else if (param.usl && param.lsl) {
                                // Use USL/LSL if available - add unit after both values
                                const uslHasUnit = param.usl.includes(param.unit || '');
                                const lslHasUnit = param.lsl.includes(param.unit || '');

                                if (uslHasUnit || lslHasUnit) {
                                    // If either already has unit, don't add it
                                    specText = ` (LSL: ${param.lsl}, USL: ${param.usl})`;
                                } else if (param.unit) {
                                    // Add unit after both values
                                    specText = ` (LSL: ${param.lsl} ${param.unit}, USL: ${param.usl} ${param.unit})`;
                                } else {
                                    specText = ` (LSL: ${param.lsl}, USL: ${param.usl})`;
                                }
                            } else if (param.usl) {
                                // Only USL
                                const needsUnit = param.unit && !param.usl.includes(param.unit);
                                specText = ` (Spec: <=${param.usl}${needsUnit ? ' ' + param.unit : ''})`;
                            } else if (param.lsl) {
                                // Only LSL
                                const needsUnit = param.unit && !param.lsl.includes(param.unit);
                                specText = ` (Spec: >=${param.lsl}${needsUnit ? ' ' + param.unit : ''})`;
                            }
                            // Add unit after the value if available
                            const valueWithUnit = param.unit ? `${displayValue} ${param.unit}` : displayValue;
                            summary += `<p style="margin: 4px 0; color: ${color}; font-size: 0.95rem;">${icon} <strong>${param.name}:</strong> ${valueWithUnit}${specText}</p>`;
                        });

                        // Then display grouped parameters under their parent headers
                        Object.keys(paramsByParent).forEach(parentHeader => {
                            const groupParams = paramsByParent[parentHeader];

                            // Display parent header
                            summary += `<p style="font-weight: 600; color: #5a67d8; margin-top: 12px; margin-bottom: 6px; font-size: 1rem;">${parentHeader}</p>`;

                            // Display each parameter in the group
                            groupParams.forEach(param => {
                                // Extract numeric value from the parameter value
                                let numVal = null;
                                let displayValue = param.value;

                                // If value contains "=", extract the number after it
                                if (param.value.includes('=')) {
                                    const match = param.value.match(/=\s*(-?\d+\.?\d*)/);
                                    if (match) {
                                        numVal = parseFloat(match[1]);
                                    }
                                } else if (!isNaN(parseFloat(param.value))) {
                                    numVal = parseFloat(param.value);
                                }

                                // Check compliance if we have numeric value and spec limits
                                let isWithinSpec = null;
                                let icon = '•';
                                let color = '#333';

                                if (numVal !== null && param.usl && param.lsl) {
                                    totalParams++;
                                    const uslNum = parseFloat(param.usl);
                                    const lslNum = parseFloat(param.lsl);

                                    if (!isNaN(uslNum) && !isNaN(lslNum)) {
                                        isWithinSpec = numVal >= lslNum && numVal <= uslNum;
                                        if (isWithinSpec) {
                                            passedParams++;
                                            icon = '✅';
                                            color = '#2e7d32';
                                        } else {
                                            icon = '❌';
                                            color = '#c62828';
                                            outOfSpecDetails.push({
                                                name: param.name,
                                                value: param.value,
                                                spec: `${lslNum}-${uslNum}${param.unit ? ' ' + param.unit : ''}`
                                            });
                                        }
                                    }
                                } else if (numVal !== null && param.usl) {
                                    // Only USL specified
                                    totalParams++;
                                    const uslNum = parseFloat(param.usl);

                                    if (!isNaN(uslNum)) {
                                        isWithinSpec = numVal <= uslNum;
                                        if (isWithinSpec) {
                                            passedParams++;
                                            icon = '✅';
                                            color = '#2e7d32';
                                        } else {
                                            icon = '❌';
                                            color = '#c62828';
                                            outOfSpecDetails.push({
                                                name: param.name,
                                                value: param.value,
                                                spec: `<=${uslNum}${param.unit ? ' ' + param.unit : ''}`
                                            });
                                        }
                                    }
                                } else if (param.value.toLowerCase() === 'y' || param.value.toLowerCase() === 'yes') {
                                    // Handle Y/N type parameters
                                    totalParams++;
                                    passedParams++;
                                    icon = '✅';
                                    color = '#2e7d32';
                                }

                                // Display parameter with header, value, and spec
                                let specText = '';
                                if (param.specLimit) {
                                    // Use the spec limit from Row 5 if available
                                    const needsUnit = param.unit && !param.specLimit.includes(param.unit);
                                    specText = ` (Spec: ${param.specLimit}${needsUnit ? ' ' + param.unit : ''})`;
                                } else if (param.usl && param.lsl) {
                                    // Use USL/LSL if available - add unit after both values
                                    const uslHasUnit = param.usl.includes(param.unit || '');
                                    const lslHasUnit = param.lsl.includes(param.unit || '');

                                    if (uslHasUnit || lslHasUnit) {
                                        // If either already has unit, don't add it
                                        specText = ` (LSL: ${param.lsl}, USL: ${param.usl})`;
                                    } else if (param.unit) {
                                        // Add unit after both values
                                        specText = ` (LSL: ${param.lsl} ${param.unit}, USL: ${param.usl} ${param.unit})`;
                                    } else {
                                        specText = ` (LSL: ${param.lsl}, USL: ${param.usl})`;
                                    }
                                } else if (param.usl) {
                                    // Only USL
                                    const needsUnit = param.unit && !param.usl.includes(param.unit);
                                    specText = ` (USL: ${param.usl}${needsUnit ? ' ' + param.unit : ''})`;
                                } else if (param.lsl) {
                                    // Only LSL
                                    const needsUnit = param.unit && !param.lsl.includes(param.unit);
                                    specText = ` (LSL: ${param.lsl}${needsUnit ? ' ' + param.unit : ''})`;
                                }
                                // Add unit after the value if available
                                const valueWithUnit = param.unit ? `${displayValue} ${param.unit}` : displayValue;
                                summary += `<p style="margin: 4px 0 4px 10px; color: ${color}; font-size: 0.95rem;">${icon} <strong>${param.name}:</strong> ${valueWithUnit}${specText}</p>`;
                            });
                        });

                        summary += `</div>`;

                        // Show summary statistics
                        if (totalParams > 0) {
                            const passRate = ((passedParams / totalParams) * 100).toFixed(1);
                            const summaryIcon = passRate >= 95 ? '✅' : passRate >= 80 ? '⚠️' : '❌';
                            const summaryColor = passRate >= 95 ? '#2e7d32' : passRate >= 80 ? '#f57c00' : '#c62828';

                            summary += `<p style="margin: 12px 0 4px 20px; color: ${summaryColor}; font-weight: 600; font-size: 1rem; padding-top: 8px; border-top: 1px solid #e0e0e0;">Summary: ${summaryIcon} ${passedParams}/${totalParams} parameters within spec (${passRate}%)</p>`;
                        } else {
                            // If no numeric params, just show that data is present
                            const paramCount = item.parameters.length;
                            summary += `<p style="margin: 12px 0 4px 20px; color: #2e7d32; font-weight: 600; padding-top: 8px; border-top: 1px solid #e0e0e0;">Summary: ✅ ${paramCount} parameters recorded</p>`;
                        }
                    } else {
                        // No parameters found - show debug info
                        summary += `<p style="margin: 4px 0 4px 20px; color: #666; font-weight: 500;">• ℹ️ No parameter data available</p>`;
                    }
                });

                summary += `</div>`;
            } else {
                // DEBURRING DATA DISPLAY - No header, just machine names
                summary += `<div style="margin-top: 15px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">`;
                summary += `<p style="font-weight: 600; color: #2e7d32; margin-bottom: 10px;">📏 Specification Compliance</p>`;

                // Group by machine
                const byMachine = {};
                specValidation.forEach(item => {
                    const machine = item.machineId || 'General';
                    if (!byMachine[machine]) {
                        byMachine[machine] = [];
                    }
                    byMachine[machine].push(item);
                });

                // Display grouped by machine
                Object.keys(byMachine).forEach(machine => {
                    if (machine !== 'General') {
                        summary += `<p style="font-weight: 600; color: #667eea; margin-top: 10px; margin-bottom: 4px; font-size: 1.05rem; margin-left: 10px;">${machine}</p>`;
                    }

                    byMachine[machine].forEach(item => {
                        const icon = item.status === 'good' ? '✅' : item.status === 'warning' ? '⚠️' : '❌';
                        const color = item.status === 'good' ? '#2e7d32' : item.status === 'warning' ? '#f57c00' : '#c62828';

                        // Remove machine ID from message since it's in the header
                        let displayMessage = item.message;
                        if (machine !== 'General' && displayMessage.startsWith(machine)) {
                            // Remove "MachineID - " prefix from the message
                            displayMessage = displayMessage.substring(machine.length).replace(/^\s*-\s*/, '');
                        }

                        summary += `<p style="margin: 4px 0 4px 20px; color: ${color}; font-weight: 500;">• ${icon} ${displayMessage}</p>`;
                    });
                });

                summary += `</div>`;
            }
        }

        // CALIBRATION DATA - DETAILED MACHINE-CENTRIC VIEW
        if (isCalibrationData && specValidation.length > 0) {
            summary += `<div style="margin-top: 20px; padding: 20px; background: #e8f5e9; border-radius: 12px; border-left: 4px solid #4caf50;">`;
            summary += `<p style="font-weight: 700; color: #2e7d32; margin-bottom: 20px; font-size: 1.3rem;">📋 Detailed Calibration Results by Machine</p>`;

            // Group by machine
            const byMachine = {};
            specValidation.forEach(item => {
                if (item.calibrationGroup) {
                    const machine = item.machineId;
                    if (!byMachine[machine]) {
                        byMachine[machine] = [];
                    }
                    byMachine[machine].push(item);
                }
            });

            // Display each machine's results
            Object.keys(byMachine).forEach((machine, idx) => {
                const machineData = byMachine[machine];

                // Calculate machine statistics - count total nozzles across all parameters
                let totalNozzles = 0;
                let passedNozzles = 0;

                machineData.forEach(item => {
                    if (item.stats.totalNozzles) {
                        totalNozzles += item.stats.totalNozzles;
                        passedNozzles += item.stats.passedNozzles || 0;
                    }
                });

                const passRate = totalNozzles > 0 ? ((passedNozzles / totalNozzles) * 100).toFixed(1) : 0;
                const statusColor = passRate >= 95 ? '#2e7d32' : passRate >= 80 ? '#f57c00' : '#c62828';
                const statusBg = passRate >= 95 ? '#e8f5e9' : passRate >= 80 ? '#fff3e0' : '#ffebee';

                summary += `<div style="margin-top: ${idx > 0 ? '25px' : '0'}; padding: 18px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;

                // Machine header with status badge
                summary += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #e0e0e0;">`;
                summary += `<h3 style="margin: 0; color: #667eea; font-size: 1.3rem; font-weight: 700;">🔧 ${machine}</h3>`;
                summary += `<div style="background: ${statusBg}; padding: 8px 16px; border-radius: 20px; border: 2px solid ${statusColor};">`;
                summary += `<span style="color: ${statusColor}; font-weight: 700; font-size: 1.1rem;">${passRate}% Pass</span>`;
                summary += `<span style="color: #666; font-size: 0.9rem; margin-left: 8px;">(${passedNozzles}/${totalNozzles} nozzles)</span>`;
                summary += `</div>`;
                summary += `</div>`;

                // Group by calibration group
                const byGroup = {};
                machineData.forEach(item => {
                    if (!byGroup[item.calibrationGroup]) {
                        byGroup[item.calibrationGroup] = [];
                    }
                    byGroup[item.calibrationGroup].push(item);
                });

                // Display each calibration group
                Object.keys(byGroup).forEach((groupName, groupIdx) => {
                    summary += `<div style="margin-top: ${groupIdx > 0 ? '15px' : '0'};">`;
                    summary += `<p style="font-weight: 600; color: #5a67d8; margin-bottom: 10px; font-size: 1.05rem; padding-left: 8px; border-left: 3px solid #5a67d8;">📊 ${groupName}</p>`;

                    byGroup[groupName].forEach(item => {
                        const icon = item.status === 'good' ? '✅' : item.status === 'warning' ? '⚠️' : '❌';
                        const color = item.status === 'good' ? '#2e7d32' : item.status === 'warning' ? '#f57c00' : '#c62828';
                        const bgColor = item.status === 'good' ? '#f1f8f4' : item.status === 'warning' ? '#fff8e1' : '#fef1f1';

                        const spec = item.spec;
                        const parameter = item.parameter;

                        // Show nozzle summary count
                        const passedNozzles = item.stats.passedNozzles || 0;
                        const totalNozzles = item.stats.totalNozzles || 0;

                        summary += `<div style="margin: 6px 0 6px 20px; padding: 10px 15px; background: ${bgColor}; border-radius: 6px; border-left: 3px solid ${color};">`;
                        summary += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
                        summary += `<span style="color: #333; font-weight: 500;">${icon} ${parameter}</span>`;
                        summary += `<div style="text-align: right;">`;
                        summary += `<span style="color: ${color}; font-weight: 700; font-size: 1.05rem;">${passedNozzles}/${totalNozzles} nozzles</span>`;
                        if (spec) {
                            summary += `<span style="color: #666; font-size: 0.85rem; margin-left: 8px;">(Spec: ${spec.target}±${spec.tolerance}${spec.unit || ''})</span>`;
                        }
                        summary += `</div>`;
                        summary += `</div>`;
                        summary += `</div>`;
                    });

                    summary += `</div>`;
                });

                summary += `</div>`;
            });

            summary += `</div>`;
        }

        // Out-of-Spec Failures
        if (specFailures.length > 0) {
            summary += `<div style="margin-top: 15px; padding: 15px; background: #ffebee; border-radius: 8px; border-left: 4px solid #f44336;">`;
            summary += `<p style="font-weight: 600; color: #c62828; margin-bottom: 10px;">❌ Out-of-Specification Values</p>`;
            specFailures.forEach(item => {
                summary += `<p style="margin: 8px 0; color: #c62828;">${item.message}</p>`;
            });
            summary += `</div>`;
        }

        // Compliance/Pass-Fail Analysis
        if (compliance.length > 0) {
            summary += `<div style="margin-top: 15px; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">`;
            summary += `<p style="font-weight: 600; color: #1565c0; margin-bottom: 10px;">✓ Pass/Fail Status</p>`;
            compliance.forEach(item => {
                const icon = item.status === 'good' ? '✅' : item.status === 'warning' ? '⚠️' : '❌';
                const color = item.status === 'good' ? '#1565c0' : item.status === 'warning' ? '#f57c00' : '#c62828';
                summary += `<p style="margin: 8px 0; color: ${color};">${icon} ${item.message}</p>`;
            });
            summary += `</div>`;
        }

        // Data Quality - REMOVED (not relevant for nozzle compliance checking)

        // Numeric Analysis
        if (numeric.length > 0) {
            summary += `<div style="margin-top: 15px; padding: 15px; background: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800;">`;
            summary += `<p style="font-weight: 600; color: #e65100; margin-bottom: 10px;">📊 Numeric Data Analysis</p>`;
            numeric.forEach(item => {
                summary += `<p style="margin: 8px 0;">• ${item.message}</p>`;
            });
            summary += `</div>`;
        }

        // Categorical Data
        if (categorical.length > 0) {
            summary += `<div style="margin-top: 15px; padding: 15px; background: #f3e5f5; border-radius: 8px; border-left: 4px solid #9c27b0;">`;
            summary += `<p style="font-weight: 600; color: #6a1b9a; margin-bottom: 10px;">🏷️ Categorical Data</p>`;
            categorical.forEach(item => {
                summary += `<p style="margin: 8px 0;">• ${item.message}</p>`;
            });
            summary += `</div>`;
        }

        // Date Ranges
        if (dates.length > 0) {
            summary += `<div style="margin-top: 15px; padding: 15px; background: #fce4ec; border-radius: 8px; border-left: 4px solid #e91e63;">`;
            summary += `<p style="font-weight: 600; color: #880e4f; margin-bottom: 10px;">📅 Date Ranges</p>`;
            dates.forEach(item => {
                summary += `<p style="margin: 8px 0;">• ${item.message}</p>`;
            });
            summary += `</div>`;
        }

        summary += `</div>`;

    } else if (data.type === 'binary') {
        const fileExt = file.name.split('.').pop().toUpperCase();
        summary += `<p style="margin-top: 10px;">This is a ${fileExt} document. `;
        summary += `To analyze the content, you would need to integrate a document parsing library.</p>`;
    } else {
        // Text-based file analysis
        const content = data.content;
        const lines = content.split('\n').filter(l => l.trim());
        const preview = content.substring(0, 500).trim();

        summary += `<p style="margin-top: 15px;"><strong>📄 Content Preview:</strong></p>`;
        summary += `<div style="margin-top: 10px; padding: 15px; background: #f0f4ff; border-radius: 8px; font-family: monospace; font-size: 0.9rem; max-height: 300px; overflow-y: auto; white-space: pre-wrap;">`;
        summary += preview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (content.length > 500) {
            summary += '...';
        }
        summary += `</div>`;
    }

    return summary;
}

// Export to PDF
exportPdfBtn.addEventListener('click', async () => {
    exportPdfBtn.disabled = true;
    exportPdfBtn.innerHTML = '<div class="spinner"></div> Generating PDF...';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        let yPosition = 20;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const maxWidth = 170;

        // Title
        doc.setFontSize(20);
        doc.setTextColor(102, 126, 234);
        doc.text('Content Analysis Report', margin, yPosition);
        yPosition += 15;

        // Date
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
        yPosition += 15;

        // Process each file summary
        summariesData.forEach((fileData, index) => {
            // Check if we need a new page
            if (yPosition > pageHeight - 40) {
                doc.addPage();
                yPosition = 20;
            }

            // File name
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(`${index + 1}. ${fileData.fileName}`, margin, yPosition);
            yPosition += 10;

            // Content insights
            const insights = generateIntelligentSummary(fileData.content);
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);

            insights.forEach(insight => {
                const lines = doc.splitTextToSize(insight, maxWidth - 10);
                lines.forEach(line => {
                    if (yPosition > pageHeight - 20) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    doc.text(line, margin + 5, yPosition);
                    yPosition += 6;
                });
            });

            yPosition += 10;
        });

        // Save PDF
        doc.save('content-analysis-report.pdf');

        exportPdfBtn.disabled = false;
        exportPdfBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export as PDF
        `;
    } catch (error) {
        alert('Error generating PDF: ' + error.message);
        exportPdfBtn.disabled = false;
        exportPdfBtn.innerHTML = 'Export as PDF';
    }
});

// Export to Excel
exportPptBtn.addEventListener('click', async () => {
    exportPptBtn.disabled = true;
    exportPptBtn.innerHTML = '<div class="spinner"></div> Generating Excel...';

    try {
        const wb = XLSX.utils.book_new();

        // Create summary sheet
        const summaryData = [
            ['Content Analysis Report'],
            ['Generated: ' + new Date().toLocaleString()],
            [''],
            ['File Name', 'Analysis Summary']
        ];

        summariesData.forEach(fileData => {
            const insights = generateIntelligentSummary(fileData.content);
            summaryData.push([
                fileData.fileName,
                insights.join(' | ')
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(summaryData);

        // Set column widths
        ws['!cols'] = [
            { wch: 40 },
            { wch: 80 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Analysis Summary');

        // Add detailed sheets for Excel files
        summariesData.forEach((fileData, index) => {
            if (fileData.content.type === 'excel') {
                const workbook = fileData.content.content;
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const sheetTitle = `${index + 1}_${sheetName}`.substring(0, 31);
                    XLSX.utils.book_append_sheet(wb, worksheet, sheetTitle);
                });
            }
        });

        // Write file
        XLSX.writeFile(wb, 'content-analysis-report.xlsx');

        exportPptBtn.disabled = false;
        exportPptBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export as Excel
        `;
    } catch (error) {
        alert('Error generating file: ' + error.message);
        exportPptBtn.disabled = false;
        exportPptBtn.innerHTML = 'Export as Excel';
    }
});

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
