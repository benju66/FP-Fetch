document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const dropZone = document.getElementById('dropZone');
    const companyInput = document.getElementById('companyNameInput');
    const ghostText = document.getElementById('ghostText');
    const saveBtn = document.getElementById('saveBtn');
    const statusLog = document.getElementById('statusLog');

    // SOW Elements
    const sowSearchInput = document.getElementById('sowSearchInput');
    const sowList = document.getElementById('sowList');
    const selectedSowCode = document.getElementById('selectedSowCode');

    let currentFile = null;
    let predictedCompany = "";
    let allSows = []; // Store SOWs for filtering

    // 1. Load SOWs and Setup Custom Dropdown
    fetch(chrome.runtime.getURL('sows.json'))
        .then(response => response.json())
        .then(sows => {
            allSows = sows;
            renderSowList(allSows);
            logStatus("SOW List loaded successfully.");
        })
        .catch(err => logStatus("Error loading SOW list.", true));

    function renderSowList(sows) {
        sowList.innerHTML = '';
        sows.forEach(sow => {
            const li = document.createElement('li');
            li.textContent = `${sow.code} - ${sow.name}`;
            li.addEventListener('click', () => {
                sowSearchInput.value = li.textContent;
                selectedSowCode.value = sow.code; // Store the code for the backend
                sowList.classList.remove('active');
                checkFormReady();
            });
            sowList.appendChild(li);
        });
    }

    // Fuzzy search event listener
    sowSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allSows.filter(sow =>
            sow.code.toLowerCase().includes(term) ||
            sow.name.toLowerCase().includes(term)
        );
        renderSowList(filtered);
        sowList.classList.add('active'); // Keep open while typing
    });

    sowSearchInput.addEventListener('focus', () => {
        sowSearchInput.value = ''; // Clear input to show full list on focus
        renderSowList(allSows);
        sowList.classList.add('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!sowSearchInput.contains(e.target) && !sowList.contains(e.target)) {
            sowList.classList.remove('active');
        }
    });

    // 2. Drag and Drop Handling
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files.length > 0) {
            currentFile = dt.files[0];
            companyInput.placeholder = "Scanning..."; // Reset placeholder just in case
            logStatus(`Received: ${currentFile.name}. Scanning...`);
            setTimeout(() => { simulateDocumentScan(currentFile.name); }, 500);
        }
    }, false);

    // 3. The Ghost Text & Prediction Logic
    function simulateDocumentScan(filename) {
        predictedCompany = "North Construction";

        companyInput.value = "";
        companyInput.placeholder = ""; // FIX: Wipe out the placeholder so it doesn't overlap
        ghostText.textContent = predictedCompany;

        logStatus(`Scan complete. Target: OP III`);
        companyInput.focus();
        checkFormReady();
    }

    companyInput.addEventListener('input', (e) => {
        const typed = e.target.value;
        if (typed.length === 0) {
            ghostText.textContent = predictedCompany;
            return;
        }
        if (predictedCompany.toLowerCase().startsWith(typed.toLowerCase())) {
            const tail = predictedCompany.slice(typed.length);
            ghostText.textContent = typed + tail;
        } else {
            ghostText.textContent = "";
        }
        checkFormReady();
    });

    companyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && ghostText.textContent !== "" && ghostText.textContent !== companyInput.value) {
            e.preventDefault();
            companyInput.value = ghostText.textContent;
            ghostText.textContent = companyInput.value;
            logStatus("Company name confirmed.");
            sowSearchInput.focus(); // Jump right to the SOW search
            checkFormReady();
        }
    });

    // 5. The Bridge: Send to Background Service Worker
    saveBtn.addEventListener('click', () => {
        if (!currentFile || !companyInput.value || !selectedSowCode.value) return;

        // Lock UI while processing
        saveBtn.disabled = true;
        saveBtn.textContent = "Processing...";
        logStatus("Reading file and sending to background worker...");

        // Read the dropped file into a Base64 string
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Data = e.target.result;

            const sowName = allSows.find(s => s.code === selectedSowCode.value)?.name || "Unknown";
            const finalPdfName = `${selectedSowCode.value} - ${sowName} - ${companyInput.value}.pdf`;

            // Make sure this path is verified in your File Explorer!
            const targetDirectory = "C:\\Users\\BUrness\\OneDrive - Fendler Patterson\\Projects\\1024 - Orchard Path III\\Bids\\Quotes";

            const payload = {
                fileName: currentFile.name,
                fileData: base64Data,
                targetDirectory: targetDirectory,
                finalPdfName: finalPdfName
            };

            // Send to background.js instead of Native Host directly
            chrome.runtime.sendMessage(
                { action: "sendToPython", payload: payload },
                (response) => {
                    // Unlock UI
                    saveBtn.disabled = false;
                    saveBtn.textContent = "Send to Processor";

                    if (!response) {
                        logStatus("Connection Error: Background worker did not respond.", true);
                    } else if (response.status === 'success') {
                        logStatus(response.message);

                        // Reset the form
                        currentFile = null;
                        companyInput.value = '';
                        ghostText.textContent = '';
                        sowSearchInput.value = '';
                        selectedSowCode.value = '';
                        checkFormReady();
                    } else {
                        logStatus("Backend Error: " + response.message, true);
                    }
                }
            );
        };

        reader.readAsDataURL(currentFile);
    });

    // 4. Utility Functions
    function checkFormReady() {
        // Enable save if we have a file, a company name, and an SOW
        if (currentFile && companyInput.value.length > 0 && selectedSowCode.value) {
            saveBtn.disabled = false;
        } else {
            saveBtn.disabled = true;
        }
    }

    function logStatus(message, isError = false) {
        statusLog.textContent = `> ${message}`;
        statusLog.style.color = isError ? "red" : "var(--text-muted)";
    }
});
