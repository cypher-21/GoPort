// Port Scanner Web Interface JavaScript

class PortScanner {
    constructor() {
        this.isScanning = false;
        this.currentScan = null;
        this.scanHistory = this.loadScanHistory();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadScanHistoryUI();
        this.updateAdvancedOptionsVisibility();
    }

    setupEventListeners() {
        // Form controls
        const portPreset = document.getElementById('portPreset');
        const toggleAdvanced = document.getElementById('toggleAdvanced');
        const startScan = document.getElementById('startScan');
        const stopScan = document.getElementById('stopScan');

        if (portPreset) {
            portPreset.addEventListener('change', this.handlePortPresetChange.bind(this));
        }
        
        if (toggleAdvanced) {
            toggleAdvanced.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleAdvancedOptions();
            });
        }
        
        if (startScan) {
            startScan.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startScan();
            });
        }
        
        if (stopScan) {
            stopScan.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.stopScan();
            });
        }
        
        // Target suggestions
        document.querySelectorAll('.suggestion-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('target').value = e.target.dataset.target;
            });
        });

        // Results controls
        const statusFilter = document.getElementById('statusFilter');
        const exportResults = document.getElementById('exportResults');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', this.filterResults.bind(this));
        }
        
        if (exportResults) {
            exportResults.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportResults();
            });
        }
        
        // History controls
        const clearHistory = document.getElementById('clearHistory');
        if (clearHistory) {
            clearHistory.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearHistory();
            });
        }
        
        // Modal controls
        const showHelp = document.getElementById('showHelp');
        const closeHelp = document.getElementById('closeHelp');
        const helpModal = document.getElementById('helpModal');
        
        if (showHelp) {
            showHelp.addEventListener('click', (e) => {
                e.preventDefault();
                this.showHelp();
            });
        }
        
        if (closeHelp) {
            closeHelp.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideHelp();
            });
        }
        
        if (helpModal) {
            helpModal.addEventListener('click', (e) => {
                if (e.target.id === 'helpModal') {
                    this.hideHelp();
                }
            });
        }

        // Scan method change updates max workers
        document.querySelectorAll('input[name="scanMethod"]').forEach(radio => {
            radio.addEventListener('change', this.updateMaxWorkers.bind(this));
        });
    }

    handlePortPresetChange() {
        const preset = document.getElementById('portPreset').value;
        const customPortsGroup = document.querySelector('.custom-ports');
        
        if (customPortsGroup) {
            if (preset === 'custom') {
                customPortsGroup.classList.remove('hidden');
            } else {
                customPortsGroup.classList.add('hidden');
            }
        }
    }

    toggleAdvancedOptions() {
        const advancedOptions = document.getElementById('advancedOptions');
        const toggleBtn = document.getElementById('toggleAdvanced');
        
        if (advancedOptions && toggleBtn) {
            if (advancedOptions.classList.contains('hidden')) {
                advancedOptions.classList.remove('hidden');
                toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Hide Advanced Options';
            } else {
                advancedOptions.classList.add('hidden');
                toggleBtn.innerHTML = '<i class="fas fa-cog"></i> Advanced Options';
            }
        }
    }

    updateAdvancedOptionsVisibility() {
        const scanMethodInput = document.querySelector('input[name="scanMethod"]:checked');
        const maxWorkers = document.getElementById('maxWorkers');
        
        if (scanMethodInput && maxWorkers) {
            const scanMethod = scanMethodInput.value;
            
            if (scanMethod === 'threaded') {
                maxWorkers.value = 200;
                maxWorkers.max = 200;
            } else {
                maxWorkers.value = 1000;
                maxWorkers.max = 1000;
            }
        }
    }

    updateMaxWorkers() {
        this.updateAdvancedOptionsVisibility();
    }

    getPortsToScan() {
        const presetSelect = document.getElementById('portPreset');
        const customPortsInput = document.getElementById('customPorts');
        
        if (!presetSelect) return [];
        
        const preset = presetSelect.value;
        const customPorts = customPortsInput ? customPortsInput.value : '';
        
        const portPresets = {
            common: [21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3389, 3306, 5432, 6379, 8080],
            web: [80, 443, 8080, 8443, 8000, 8888, 9000],
            database: [3306, 5432, 1433, 1521, 6379, 9200, 27017],
            top100: Array.from({length: 100}, (_, i) => i + 1),
            top1000: Array.from({length: 1000}, (_, i) => i + 1)
        };

        if (preset === 'custom') {
            return this.parseCustomPorts(customPorts);
        }
        
        return portPresets[preset] || [];
    }

    parseCustomPorts(input) {
        if (!input) return [];
        
        const ports = [];
        const parts = input.split(',');
        
        for (let part of parts) {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => parseInt(n.trim()));
                if (start && end && start <= end && start > 0 && end <= 65535) {
                    for (let i = start; i <= end; i++) {
                        ports.push(i);
                    }
                }
            } else {
                const port = parseInt(part);
                if (port && port > 0 && port <= 65535) {
                    ports.push(port);
                }
            }
        }
        
        return [...new Set(ports)].sort((a, b) => a - b);
    }

    async startScan() {
        if (this.isScanning) {
            return;
        }

        const targetInput = document.getElementById('target');
        if (!targetInput) {
            alert('Target input not found');
            return;
        }

        const target = targetInput.value.trim();
        if (!target) {
            alert('Please enter a target host or IP address');
            return;
        }

        const ports = this.getPortsToScan();
        if (ports.length === 0) {
            alert('Please select ports to scan');
            return;
        }

        const scanMethodInput = document.querySelector('input[name="scanMethod"]:checked');
        const timeoutInput = document.getElementById('timeout');
        const maxWorkersInput = document.getElementById('maxWorkers');
        const bannerGrabInput = document.getElementById('bannerGrab');

        const scanMethod = scanMethodInput ? scanMethodInput.value : 'threaded';
        const timeout = timeoutInput ? parseFloat(timeoutInput.value) : 1.0;
        const maxWorkers = maxWorkersInput ? parseInt(maxWorkersInput.value) : 200;
        const bannerGrab = bannerGrabInput ? bannerGrabInput.checked : false;

        this.isScanning = true;
        this.currentScan = {
            target,
            ports,
            scanMethod,
            timeout,
            maxWorkers,
            bannerGrab,
            startTime: new Date(),
            results: []
        };

        this.updateUI('scanning');
        try {
            await this.performScan();
            if (this.isScanning) {
                this.updateUI('completed');
            }
        } catch (error) {
            console.error('Scan error:', error);
            this.updateUI('stopped');
        }
    }

    stopScan() {
        this.isScanning = false;
        if (this.currentScan) {
            this.currentScan.stopped = true;
        }
        this.updateUI('stopped');
    }

    updateUI(state) {
        const startBtn = document.getElementById('startScan');
        const stopBtn = document.getElementById('stopScan');
        const progressSection = document.getElementById('progressSection');
        const resultsSection = document.getElementById('resultsSection');

        if (!startBtn || !stopBtn) return;

        switch (state) {
            case 'scanning':
                startBtn.classList.add('hidden');
                stopBtn.classList.remove('hidden');
                if (progressSection) {
                    progressSection.classList.remove('hidden');
                    progressSection.classList.add('slide-in');
                }
                break;
            case 'completed':
            case 'stopped':
                startBtn.classList.remove('hidden');
                stopBtn.classList.add('hidden');
                if (state === 'completed' && resultsSection) {
                    resultsSection.classList.remove('hidden');
                    resultsSection.classList.add('slide-in');
                    this.addToHistory();
                }
                break;
        }
    }

    async performScan() {
        if (!this.currentScan) return;

        const { ports, scanMethod, timeout, maxWorkers, bannerGrab } = this.currentScan;
        const totalPorts = ports.length;
        const liveUpdatesElement = document.getElementById('liveUpdates');
        
        if (liveUpdatesElement) {
            liveUpdatesElement.innerHTML = '';
        }

        let scannedPorts = 0;
        let startTime = Date.now();

        // Simulate scanning speed based on method
        const baseSpeed = scanMethod === 'async' ? 1000 : 300; // ports per second
        const actualSpeed = Math.min(baseSpeed, maxWorkers * 5);
        const delay = 1000 / actualSpeed; // milliseconds per port

        // Simulate realistic open/closed port distribution
        const openPortChance = 0.1; // 10% of ports typically open
        
        for (let i = 0; i < totalPorts && this.isScanning; i++) {
            const port = ports[i];
            const isOpen = Math.random() < openPortChance || this.isCommonOpenPort(port);
            
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, Math.max(delay, 10)));
            
            if (!this.isScanning) break;

            const result = {
                port,
                status: isOpen ? 'open' : 'closed',
                service: this.getServiceName(port),
                banner: bannerGrab && isOpen ? this.getBanner(port) : ''
            };
            
            this.currentScan.results.push(result);
            scannedPorts++;
            
            // Update live display
            if (liveUpdatesElement) {
                this.updateLiveProgress(result, liveUpdatesElement);
            }
            this.updateProgressBar(scannedPorts, totalPorts, startTime);
            
            // Yield control occasionally
            if (scannedPorts % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        if (this.isScanning && this.currentScan) {
            this.currentScan.endTime = new Date();
            this.currentScan.duration = this.currentScan.endTime - this.currentScan.startTime;
            this.displayResults();
        }
    }

    isCommonOpenPort(port) {
        // Simulate more realistic open ports for common services
        const commonOpen = [22, 80, 443, 8080];
        return commonOpen.includes(port) && Math.random() < 0.7;
    }

    getServiceName(port) {
        const services = {
            21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
            80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS",
            993: "IMAPS", 995: "POP3S", 3306: "MySQL", 3389: "RDP",
            5432: "PostgreSQL", 6379: "Redis", 8080: "HTTP-Alt",
            8443: "HTTPS-Alt", 9200: "Elasticsearch", 27017: "MongoDB"
        };
        return services[port] || "Unknown";
    }

    getBanner(port) {
        const banners = {
            22: "SSH-2.0-OpenSSH_8.2p1 Ubuntu-4ubuntu0.5",
            80: "HTTP/1.1 200 OK\nServer: Apache/2.4.41 (Ubuntu)",
            443: "HTTP/1.1 200 OK\nServer: nginx/1.18.0 (Ubuntu)",
            3306: "MySQL 8.0.28-0ubuntu0.20.04.3",
            5432: "PostgreSQL 12.9 on x86_64-pc-linux-gnu",
            6379: "Redis server v=6.0.16 sha=00000000:0 malloc=jemalloc-5.2.1",
            8080: "HTTP/1.1 200 OK\nServer: Jetty(9.4.43.v20210629)"
        };
        return banners[port] || "";
    }

    updateLiveProgress(result, container) {
        const update = document.createElement('div');
        update.className = 'live-update slide-in';
        update.innerHTML = `
            <span>Port ${result.port}</span>
            <span class="port-status ${result.status}">${result.status.toUpperCase()}</span>
        `;
        
        container.insertBefore(update, container.firstChild);
        
        // Keep only last 10 updates visible
        while (container.children.length > 10) {
            container.removeChild(container.lastChild);
        }
    }

    updateProgressBar(current, total, startTime) {
        const percentage = Math.round((current / total) * 100);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const portsPerSec = Math.round(current / (elapsed || 1));

        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        const progressPorts = document.getElementById('progressPorts');
        const elapsedElement = document.getElementById('elapsed');
        const portsPerSecElement = document.getElementById('portsPerSec');

        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressPercent) progressPercent.textContent = `${percentage}%`;
        if (progressPorts) progressPorts.textContent = `${current} / ${total} ports`;
        if (elapsedElement) elapsedElement.textContent = this.formatTime(elapsed);
        if (portsPerSecElement) portsPerSecElement.textContent = portsPerSec;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    displayResults() {
        if (!this.currentScan) return;

        const results = this.currentScan.results;
        const openPorts = results.filter(r => r.status === 'open').length;
        const closedPorts = results.length - openPorts;
        const duration = Math.round(this.currentScan.duration / 1000);

        // Update summary
        const summary = document.getElementById('resultsSummary');
        if (summary) {
            summary.innerHTML = `
                <div class="summary-stat">
                    <span class="number">${results.length}</span>
                    <span class="label">Total Ports</span>
                </div>
                <div class="summary-stat">
                    <span class="number" style="color: var(--color-success)">${openPorts}</span>
                    <span class="label">Open Ports</span>
                </div>
                <div class="summary-stat">
                    <span class="number" style="color: var(--color-error)">${closedPorts}</span>
                    <span class="label">Closed Ports</span>
                </div>
                <div class="summary-stat">
                    <span class="number">${duration}s</span>
                    <span class="label">Duration</span>
                </div>
            `;
        }

        this.renderResultsTable();
    }

    renderResultsTable(filter = 'all') {
        if (!this.currentScan) return;

        const results = this.currentScan.results;
        const filteredResults = filter === 'all' ? results : 
                              results.filter(r => r.status === filter);

        const tbody = document.getElementById('resultsBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        filteredResults.forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${result.port}</strong></td>
                <td><span class="port-status ${result.status}">${result.status.toUpperCase()}</span></td>
                <td>
                    <div class="service-info">
                        ${this.getServiceIcon(result.service)}
                        <span>${result.service}</span>
                    </div>
                </td>
                <td><code class="banner-text">${result.banner || 'N/A'}</code></td>
            `;
            tbody.appendChild(row);
        });
    }

    getServiceIcon(service) {
        const icons = {
            'HTTP': '<i class="fas fa-globe service-icon"></i>',
            'HTTPS': '<i class="fas fa-lock service-icon"></i>',
            'SSH': '<i class="fas fa-terminal service-icon"></i>',
            'FTP': '<i class="fas fa-folder service-icon"></i>',
            'MySQL': '<i class="fas fa-database service-icon"></i>',
            'PostgreSQL': '<i class="fas fa-database service-icon"></i>',
            'Redis': '<i class="fas fa-memory service-icon"></i>',
            'DNS': '<i class="fas fa-network-wired service-icon"></i>'
        };
        return icons[service] || '<i class="fas fa-question service-icon"></i>';
    }

    filterResults() {
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            const filter = statusFilter.value;
            this.renderResultsTable(filter);
        }
    }

    exportResults() {
        if (!this.currentScan) return;

        const exportData = {
            target: this.currentScan.target,
            scanTime: this.currentScan.startTime.toISOString(),
            duration: this.currentScan.duration,
            method: this.currentScan.scanMethod,
            results: this.currentScan.results
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portscan-${this.currentScan.target}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    addToHistory() {
        if (!this.currentScan) return;

        const historyItem = {
            id: Date.now(),
            target: this.currentScan.target,
            timestamp: this.currentScan.startTime.toISOString(),
            duration: this.currentScan.duration,
            totalPorts: this.currentScan.results.length,
            openPorts: this.currentScan.results.filter(r => r.status === 'open').length,
            method: this.currentScan.scanMethod
        };

        this.scanHistory.unshift(historyItem);
        this.scanHistory = this.scanHistory.slice(0, 10); // Keep only last 10 scans
        
        this.saveScanHistory();
        this.loadScanHistoryUI();
    }

    loadScanHistory() {
        try {
            return JSON.parse(localStorage.getItem('scanHistory') || '[]');
        } catch (e) {
            return [];
        }
    }

    saveScanHistory() {
        try {
            localStorage.setItem('scanHistory', JSON.stringify(this.scanHistory));
        } catch (e) {
            // localStorage not available, ignore
        }
    }

    loadScanHistoryUI() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        if (this.scanHistory.length === 0) {
            historyList.innerHTML = '<p class="no-history">No previous scans</p>';
            return;
        }

        historyList.innerHTML = this.scanHistory.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-header">
                    <span class="history-target">${item.target}</span>
                    <span class="history-time">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div class="history-stats">
                    <span class="open-ports">${item.openPorts}</span> open ports of ${item.totalPorts} 
                    • ${Math.round(item.duration / 1000)}s 
                    • ${item.method}
                </div>
            </div>
        `).join('');
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear scan history?')) {
            this.scanHistory = [];
            try {
                localStorage.removeItem('scanHistory');
            } catch (e) {
                // localStorage not available, ignore
            }
            this.loadScanHistoryUI();
        }
    }

    showHelp() {
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.classList.remove('hidden');
        }
    }

    hideHelp() {
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.classList.add('hidden');
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new PortScanner();
});