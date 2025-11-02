// API base URL - adjust if needed
const API_BASE = window.location.origin;

// Helper function for API calls
async function api(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

// Get user info from localStorage
const user = JSON.parse(localStorage.getItem('tt_user') || '{"email": "user@srec.ac.in", "role": "Admin"}');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    loadUserInfo();
    setupEventListeners();
    generateTimeSlots();
    generateTimetable();
});

function initializeUI() {
    // Set user email if available
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl && user.email) {
        userEmailEl.textContent = user.email;
    }

    // Set role if available
    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect && user.role) {
        roleSelect.value = user.role;
    }

    // Check authentication
    if (!localStorage.getItem('tt_user')) {
        window.location.href = '/login.html';
        return;
    }
}

function loadUserInfo() {
    const storedUser = localStorage.getItem('tt_user');
    if (storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            document.getElementById('userEmail').textContent = userData.email || 'user@srec.ac.in';
            const roleSelect = document.getElementById('roleSelect');
            if (roleSelect && userData.role) {
                roleSelect.value = userData.role;
            }
        } catch (e) {
            console.error('Error loading user info:', e);
        }
    }
}

function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('tt_user');
        localStorage.removeItem('tt_role');
        window.location.href = '/login.html';
    });

    // Generate button
    document.getElementById('generateBtn')?.addEventListener('click', handleGenerate);

    // Load button
    document.getElementById('loadBtn')?.addEventListener('click', handleLoad);

    // Save button
    document.getElementById('saveBtn')?.addEventListener('click', handleSave);
}

// Generate time slots based on slots per day
function generateTimeSlots() {
    const slotsInput = document.getElementById('slotsInput');
    const slotsPerDay = parseInt(slotsInput?.value || 6);
    
    // Default time slots (can be customized)
    const timeSlots = [
        '08:45-09:35',
        '09:35-10:25',
        'Break 10:25-10:45',
        '10:45-11:35',
        '11:35-12:25',
        'Lunch 12:25-13:10',
        '13:10-14:00',
        '14:00-14:50',
        'Break 14:50-15:00',
        '15:00-15:50',
        '15:50-16:40'
    ];

    const thead = document.querySelector('#timetableTable thead tr');
    if (!thead) return;

    // Clear existing headers (except day header)
    const dayHeader = thead.querySelector('.day-header');
    thead.innerHTML = '';
    if (dayHeader) {
        thead.appendChild(dayHeader);
    }

    // Add time slot headers
    timeSlots.forEach(slot => {
        const th = document.createElement('th');
        th.textContent = slot;
        th.className = 'time-slot-header';
        
        // Mark break/lunch cells
        if (slot.toLowerCase().includes('break')) {
            th.classList.add('break-cell');
        } else if (slot.toLowerCase().includes('lunch')) {
            th.classList.add('lunch-cell');
        }
        
        thead.appendChild(th);
    });
}

// Generate timetable structure
function generateTimetable() {
    const daysInput = document.getElementById('daysInput');
    const days = (daysInput?.value || 'Mon, Tue, Wed, Thu, Fri')
        .split(',')
        .map(d => d.trim())
        .filter(d => d);

    const tbody = document.getElementById('timetableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    days.forEach(day => {
        const row = document.createElement('tr');
        
        // Day header cell
        const dayCell = document.createElement('td');
        dayCell.textContent = day;
        dayCell.className = 'day-header';
        row.appendChild(dayCell);

        // Time slot cells
        const slotsPerDay = parseInt(document.getElementById('slotsInput')?.value || 6);
        const totalSlots = 11; // Based on default time slots

        for (let i = 0; i < totalSlots; i++) {
            const cell = document.createElement('td');
            cell.className = 'course-cell';
            cell.textContent = '';
            cell.contentEditable = true;
            cell.dataset.day = day;
            cell.dataset.slot = i;
            row.appendChild(cell);
        }

        tbody.appendChild(row);
    });
}

// Handle Generate button
async function handleGenerate() {
    const daysInput = document.getElementById('daysInput');
    const slotsInput = document.getElementById('slotsInput');
    const coursesInput = document.getElementById('coursesInput');
    const labSessionsInput = document.getElementById('labSessionsInput');
    const sheetSelect = document.getElementById('sheetSelect');

    const days = (daysInput?.value || 'Mon, Tue, Wed, Thu, Fri')
        .split(',')
        .map(d => d.trim())
        .filter(d => d);

    const slotsPerDay = parseInt(slotsInput?.value || 6);
    const courses = (coursesInput?.value || '')
        .split(',')
        .map(c => c.trim())
        .filter(c => c);

    const labSessions = parseLabSessions(labSessionsInput?.value || '');

    const data = {
        sheet: sheetSelect?.value || 'TT',
        days: days,
        slotsPerDay: slotsPerDay,
        courses: courses,
        labSessions: labSessions
    };

    try {
        setStatus('Generating timetable...', false);
        const result = await api('/api/timetable/generate', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        setStatus('Timetable generated successfully!', true);
        
        // Reload timetable display
        await handleLoad();
    } catch (error) {
        console.error('Error generating timetable:', error);
        setStatus(`Error: ${error.message}`, false);
    }
}

// Handle Load button
async function handleLoad() {
    const sheetSelect = document.getElementById('sheetSelect');
    const sheet = sheetSelect?.value || 'TT';

    try {
        setStatus('Loading timetable...', false);
        const data = await api(`/api/timetable?sheet=${encodeURIComponent(sheet)}`);
        
        // Populate timetable with loaded data
        populateTimetable(data);
        
        setStatus('Loaded', true);
    } catch (error) {
        console.error('Error loading timetable:', error);
        setStatus(`Error: ${error.message}`, false);
    }
}

// Handle Save button
async function handleSave() {
    const sheetSelect = document.getElementById('sheetSelect');
    const sheet = sheetSelect?.value || 'TT';
    
    // Get current timetable data from the table
    const timetableData = extractTimetableData();
    
    // Convert to array format for Google Sheets
    const daysInput = document.getElementById('daysInput');
    const days = (daysInput?.value || 'Mon, Tue, Wed, Thu, Fri')
        .split(',')
        .map(d => d.trim())
        .filter(d => d);
    
    const rows = [['Day', ...Array(11).fill(0).map((_, i) => `Slot ${i + 1}`)]];
    days.forEach(day => {
        const row = [day];
        const cells = document.querySelectorAll(`td[data-day="${day}"]`);
        cells.forEach(cell => row.push(cell.textContent.trim()));
        rows.push(row);
    });

    try {
        setStatus('Saving timetable...', false);
        
        // Note: This would need a backend endpoint like POST /api/timetable/save
        // For now, we'll use the generate endpoint or show a message
        setStatus('Save functionality requires backend implementation', false);
    } catch (error) {
        console.error('Error saving timetable:', error);
        setStatus(`Error: ${error.message}`, false);
    }
}

// Parse lab sessions string
function parseLabSessions(labString) {
    if (!labString) return {};
    
    const sessions = {};
    labString.split(',').forEach(session => {
        const [name, blocks] = session.trim().split(':');
        if (name && blocks) {
            sessions[name.trim()] = parseInt(blocks.trim()) || 1;
        }
    });
    
    return sessions;
}

// Populate timetable from data
function populateTimetable(data) {
    // Parse the data from the API response
    // Expected format: { rows: [[...], [...], ...] } or array of arrays
    let rows = [];
    
    if (Array.isArray(data)) {
        rows = data;
    } else if (data.rows && Array.isArray(data.rows)) {
        rows = data.rows;
    } else if (data.values && Array.isArray(data.values)) {
        rows = data.values;
    }
    
    if (!rows || rows.length === 0) {
        console.log('No data to populate');
        return;
    }
    
    // Get the days and time slots
    const daysInput = document.getElementById('daysInput');
    const days = (daysInput?.value || 'Mon, Tue, Wed, Thu, Fri')
        .split(',')
        .map(d => d.trim())
        .filter(d => d);
    
    const tbody = document.getElementById('timetableBody');
    if (!tbody) return;
    
    // Clear existing content except header row
    tbody.innerHTML = '';
    
    // Skip first row if it's headers, start from row 1
    const startRow = rows[0] && rows[0][0] && isNaN(rows[0][0]) ? 1 : 0;
    
    days.forEach((day, dayIndex) => {
        const rowIndex = startRow + dayIndex;
        if (rowIndex >= rows.length) return;
        
        const rowData = rows[rowIndex] || [];
        const row = document.createElement('tr');
        
        // Day header cell
        const dayCell = document.createElement('td');
        dayCell.textContent = day;
        dayCell.className = 'day-header';
        row.appendChild(dayCell);
        
        // Populate cells with data (skip first column if it's day names)
        const dataStartIndex = rowData[0] && typeof rowData[0] === 'string' && days.includes(rowData[0]) ? 1 : 0;
        const totalSlots = 11; // Based on default time slots
        
        for (let i = 0; i < totalSlots; i++) {
            const cell = document.createElement('td');
            const dataIndex = dataStartIndex + i;
            const cellValue = rowData[dataIndex] || '';
            cell.textContent = cellValue;
            cell.className = cellValue ? 'course-cell' : '';
            cell.contentEditable = true;
            cell.dataset.day = day;
            cell.dataset.slot = i;
            row.appendChild(cell);
        }
        
        tbody.appendChild(row);
    });
}

// Extract timetable data from table
function extractTimetableData() {
    const data = {};
    const rows = document.querySelectorAll('#timetableBody tr');
    
    rows.forEach(row => {
        const dayCell = row.querySelector('.day-header');
        const day = dayCell?.textContent.trim();
        
        if (day) {
            data[day] = [];
            const cells = row.querySelectorAll('td:not(.day-header)');
            cells.forEach((cell, index) => {
                data[day][index] = cell.textContent.trim();
            });
        }
    });
    
    return data;
}

// Set status message
function setStatus(message, isSuccess = true) {
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = message;
        statusText.style.color = isSuccess ? '#28a745' : '#dc3545';
    }
}


