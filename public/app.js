(function(){
  // Sync role from stored user on load
  try{
    const user = JSON.parse(localStorage.getItem('tt_user') || 'null');
    if(user && user.role){
      const rs = document.getElementById('roleSelect');
      if(rs) rs.value = user.role;
    }
  }catch{}
  const statusEl = document.getElementById('status');
  const deptEl = document.getElementById('dept');
  const yearEl = document.getElementById('year');
  const semEl = document.getElementById('semester');
  const sheetEl = document.getElementById('sheet');
  const sheetNewEl = document.getElementById('sheetNew');
  const daysEl = document.getElementById('days');
  const slotsEl = document.getElementById('slots');
  const coursesEl = document.getElementById('courses');
  const labsEl = document.getElementById('labs');
  const tableEl = document.getElementById('timetable');
  const previewBtn = document.getElementById('previewBtn');
  const loadBtn = document.getElementById('loadBtn');
  const roleSelect = document.getElementById('roleSelect');
  const requestBtn = document.getElementById('requestBtn');
  const notifBadge = document.getElementById('notifBadge');
  const notifList = document.getElementById('notifList');
  const notifEmpty = document.getElementById('notifEmpty');
  const notifWrap = document.getElementById('notifWrap');
  const notifSave = document.getElementById('notifSave');
  const notifClear = document.getElementById('notifClear');
  const notifDropdown = document.getElementById('notifDropdown');

  // API base URL
  const API_BASE = 'http://localhost:3000';

  // Presets for program-specific sheets and helpers
  const TEMPLATE_SHEETS = new Set(['secondyear 3rd sem']);
  function isTemplateSheet(name){ return !!name && TEMPLATE_SHEETS.has(String(name).toLowerCase()); }
  function redirectedSheetName(original){
    if(!isTemplateSheet(original)) return original;
    return `${original} - Generated`;
  }
  const programPresets = {
    'AI&DS|II|III': {
      sheetName: 'Secondyear 3rd sem',
      coursesPlaceholder: 'e.g., DS, DAA, DBMS',
      labsPlaceholder: 'e.g., DBMS Lab:2, DSA Lab:2'
    },
    'AI&DS|III|V': {
      sheetName: 'Thirdyear 5th sem',
      coursesPlaceholder: 'Auto-filled from readonly sheet',
      labsPlaceholder: 'Auto-filled from readonly sheet'
    },
    'AI&DS|IV|VII': {
      sheetName: 'Fourthyear 7th sem',
      coursesPlaceholder: 'Auto-filled from readonly sheet',
      labsPlaceholder: 'Auto-filled from readonly sheet'
    }
  };

  // Global set of conflict keys for highlighting: `${dayIdx}:${periodIdx}:${instructorLower}`
  let currentConflictKeys = null;
  let previewContexts = [];

  // Map years to allowed semesters and keep semester dropdown in sync
  const YEAR_TO_SEMS = {
    'II': ['III', 'IV'],
    'III': ['V', 'VI'],
    'IV': ['VII', 'VIII']
  };

  function syncSemestersToYear(){
    if(!yearEl || !semEl) return;
    const selectedYear = yearEl.value;
    const allowedSems = YEAR_TO_SEMS[selectedYear] || [];
    const currentSem = semEl.value;
    // Rebuild options only if needed
    let needsRebuild = false;
    const existing = Array.from(semEl.options).map(o => o.value);
    if(existing.length !== allowedSems.length){
      needsRebuild = true;
    } else {
      for(let i=0;i<existing.length;i++){
        if(existing[i] !== allowedSems[i]){ needsRebuild = true; break; }
      }
    }
    if(!needsRebuild) return;
    semEl.innerHTML = '';
    allowedSems.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s; semEl.appendChild(opt);
    });
    // Preserve previously selected semester if still valid
    if(allowedSems.includes(currentSem)){
      semEl.value = currentSem;
    }
  }

  // In-memory mappings pulled from template for coordinator/incharge enrichment
  let templateCourseToCoordinator = {};
  let templateLabToInfo = {};

  function addSheetOptionIfMissing(name, selectIt){
    if(!sheetEl || !name) return;
    const exists = Array.from(sheetEl.options).some(o => String(o.value).toLowerCase() === String(name).toLowerCase());
    if(!exists){
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name; sheetEl.appendChild(opt);
    }
    if(selectIt){ sheetEl.value = name; }
  }

  function rememberAppSheet(name, selectIt){
    try{
      const key = 'tt_app_sheets';
      const cur = JSON.parse(localStorage.getItem(key) || '[]');
      if(!cur.find(x => String(x).toLowerCase() === String(name).toLowerCase())){
        cur.push(name);
        localStorage.setItem(key, JSON.stringify(cur));
      }
    }catch{}
    addSheetOptionIfMissing(name, !!selectIt);
  }

  function applyProgramPreset(){
    const dept = (deptEl && deptEl.value) || '';
    const year = (yearEl && yearEl.value) || '';
    const sem = (semEl && semEl.value) || '';
    const key = `${dept}|${year}|${sem}`;
    const preset = programPresets[key];
    if(!preset) return;
    // Never select the template sheet directly; suggest a new name instead
    if(sheetEl){ sheetEl.value = sheetEl.options[0] ? sheetEl.options[0].value : ''; }
    if(sheetNewEl && preset.sheetName){ sheetNewEl.value = `${preset.sheetName} - Generated`; }
    // Update placeholders to cue expected input format
    if(coursesEl && preset.coursesPlaceholder){ coursesEl.placeholder = preset.coursesPlaceholder; }
    if(labsEl && preset.labsPlaceholder){ labsEl.placeholder = preset.labsPlaceholder; }
    // Do not auto-fill with pipe format; we'll load from template and fill plain values
    // Force 5-day week by default, still editable
    if(daysEl){ daysEl.value = 'Mon,Tue,Wed,Thu,Fri'; }

    // Additionally, pull real names from the predefined template grid
    loadNamesFromTemplate();
    updateLabsControlForSem();
  }

  function isSeventhSemester(){
    return (semEl && semEl.value) === 'VII';
  }

  function updateLabsControlForSem(){
    if(!labsEl) return;
    if(isSeventhSemester()){
      // Keep the control visible and editable, but clear any manual content
      labsEl.value = '';
      labsEl.placeholder = 'Labs auto-managed from 7th sem sheet';
      return;
    }
    // For other semesters, keep role-based enable/disable handled elsewhere
  }

  async function loadNamesFromTemplate(){
    try{
      const dept = (deptEl && deptEl.value) || '';
      const year = (yearEl && yearEl.value) || '';
      const sem = (semEl && semEl.value) || '';
      const preset = programPresets[`${dept}|${year}|${sem}`];
      const template = (preset && preset.sheetName) ? preset.sheetName : 'Secondyear 3rd sem';
      const res = await fetch(`${API_BASE}/timetable?sheet=${encodeURIComponent(template)}`);
      const data = await res.json();
      if(!Array.isArray(data.values)) return;
      const values = data.values;
      // Reset caches
      templateCourseToCoordinator = {};
      templateLabToInfo = {};
      // Courses range depends on template
      const lower = String(template).toLowerCase();
      let courseEndIdx = 6; // 0..6 for 3rd sem
      if(lower === 'thirdyear 5th sem') courseEndIdx = 10; // 0..10 (rows 1..11)
      if(lower === 'fourthyear 7th sem') courseEndIdx = 7; // 0..7 (rows 1..8)
      const courseList = [];
      for(let i=0;i<=courseEndIdx;i++){
        const row = values[i] || [];
        const course = (row[0] || '').toString().trim();
        const coord = (row[1] || '').toString().trim();
        if(course){ courseList.push(course); }
        if(course && coord){ templateCourseToCoordinator[course] = coord; }
      }
      if(courseList.length && coursesEl){ coursesEl.value = courseList.join(', '); }
      // Labs default 9..12; for 5th sem specifically rows 13 and 14 (indices 12,13)
      const labList = [];
      if(lower === 'thirdyear 5th sem'){
        [12,13].forEach(i => {
          const row = values[i] || [];
          const lab = (row[0] || '').toString().trim();
          const incharge = (row[1] || '').toString().trim();
          const blocks = Math.max(1, Math.min(10, Number((row[2]||'2'))));
          if(lab){ labList.push(`${lab}:${blocks}`); templateLabToInfo[lab] = { incharge, blocks }; }
        });
      } else {
        for(let i=8;i<=11;i++){
          const row = values[i] || [];
          const lab = (row[0] || '').toString().trim();
          const incharge = (row[1] || '').toString().trim();
          const blocks = Math.max(1, Math.min(10, Number((row[2]||'2'))));
          if(lab){ labList.push(`${lab}:${blocks}`); }
          if(lab){ templateLabToInfo[lab] = { incharge, blocks }; }
        }
      }
      if(labList.length && labsEl){ labsEl.value = labList.join(', '); }
    }catch{}
  }

  function setStatus(text, isError){
    statusEl.textContent = text || '';
    statusEl.style.color = isError ? '#f87171' : '#94a3b8';
  }

  function renderTable(values){
    tableEl.innerHTML = '';
    if(!values || !values.length){ return; }
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    // Track this table for live re-check
    previewContexts = previewContexts.filter(c => c.type !== 'main');
    previewContexts.push({ type: 'main', rowsRef: values, element: tableEl, title: 'Current' });
    values.forEach((row, idx) => {
      const tr = document.createElement('tr');
      row.forEach((cell, colIdx) => {
        const el = document.createElement(idx === 0 ? 'th' : 'td');
        el.textContent = cell ?? '';
        // Highlight if this cell is a conflicting instructor slot
        if(idx > 0 && currentConflictKeys && Array.isArray(currentConflictKeys.periodIdxs)){
          const dayIdx = idx - 1;
          if(currentConflictKeys.periodIdxs.includes(colIdx)){
            const inst = parseInstructor(cell || '');
            if(inst){
              const key = `${dayIdx}:${currentConflictKeys.periodIdxs.indexOf(colIdx)}:${inst.toLowerCase()}`;
              if(currentConflictKeys.set.has(key)){
                el.style.backgroundColor = '#3f1d1d';
                el.style.color = '#fca5a5';
                el.dataset.conflict = '1';
              } else {
                delete el.dataset.conflict;
              }
            }
          }
        }
        if(idx > 0 && roleSelect.value === 'Admin') {
          el.contentEditable = 'true';
          el.addEventListener('input', handleLiveEditConflictCheck);
        }
        tr.appendChild(el);
      });
      if(idx === 0) thead.appendChild(tr); else tbody.appendChild(tr);
    });
    tableEl.appendChild(thead);
    tableEl.appendChild(tbody);

    // Add Save button for Admin to persist edits
    ensureSaveButton();
  }

  function ensureSaveButton(){
    let btn = document.getElementById('saveBtn');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'saveBtn';
      btn.textContent = 'Save to Sheet';
      btn.className = 'secondary';
      document.querySelector('.actions').appendChild(btn);
      btn.addEventListener('click', saveEdits);
    }
    btn.style.display = roleSelect.value === 'Admin' ? 'inline-block' : 'none';
  }

  function getExtraPreviewContainer(){
    let wrap = document.getElementById('extraPreviews');
    if(!wrap){
      wrap = document.createElement('section');
      wrap.id = 'extraPreviews';
      wrap.className = 'table-wrap';
      const mainWrap = document.querySelector('.table-wrap');
      if(mainWrap && mainWrap.parentNode){
        mainWrap.parentNode.appendChild(wrap);
      }
    }
    return wrap;
  }

  function clearExtraPreviews(){
    const wrap = document.getElementById('extraPreviews');
    if(wrap) wrap.innerHTML = '';
  }

  function renderReadOnlyTable(rows, title){
    const wrap = getExtraPreviewContainer();
    const box = document.createElement('details');
    box.className = 'extra-preview';
    // collapsed by default for minimized view
    // box.open = false;
    const summary = document.createElement('summary');
    summary.textContent = title || 'Preview';
    summary.style.color = '#94a3b8';
    summary.style.fontSize = '13px';
    summary.style.cursor = 'pointer';
    summary.style.margin = '12px 0';
    const container = document.createElement('div');
    container.style.maxHeight = '300px';
    container.style.overflow = 'auto';
    container.style.border = '1px solid #1f2937';
    container.style.borderRadius = '6px';
    container.style.padding = '6px';
    const table = document.createElement('table');
    table.style.fontSize = '12px';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    (rows || []).forEach((row, idx) => {
      const tr = document.createElement('tr');
      row.forEach((cell, colIdx) => {
        const el = document.createElement(idx === 0 ? 'th' : 'td');
        el.textContent = cell ?? '';
        if(idx > 0 && currentConflictKeys && Array.isArray(currentConflictKeys.periodIdxs)){
          const dayIdx = idx - 1;
          if(currentConflictKeys.periodIdxs.includes(colIdx)){
            const inst = parseInstructor(cell || '');
            if(inst){
              const key = `${dayIdx}:${currentConflictKeys.periodIdxs.indexOf(colIdx)}:${inst.toLowerCase()}`;
              if(currentConflictKeys.set.has(key)){
                el.style.backgroundColor = '#3f1d1d';
                el.style.color = '#fca5a5';
              }
            }
          }
        }
        tr.appendChild(el);
      });
      if(idx === 0) thead.appendChild(tr); else tbody.appendChild(tr);
    });
    table.appendChild(thead); table.appendChild(tbody);
    container.appendChild(table);
    box.appendChild(summary);
    box.appendChild(container);
    wrap.appendChild(box);
    // Track preview context for live checks (read-only view)
    previewContexts.push({ type: 'preview', rowsRef: rows, element: table, title: title || 'Preview' });
  }

  function ensureSheetInDropdown(name){
    try{
      if(!sheetEl || !name) return;
      const target = String(name);
      const exists = Array.from(sheetEl.options).some(o => String(o.value).toLowerCase() === target.toLowerCase());
      if(!exists){
        const opt = document.createElement('option');
        opt.value = target; opt.textContent = target; sheetEl.appendChild(opt);
      }
      sheetEl.value = target;
    }catch{}
  }

  function updateInputsForRole(){
    const isStudent = roleSelect.value === 'Student';
    if(daysEl) daysEl.disabled = isStudent;
    if(slotsEl) slotsEl.disabled = isStudent;
    if(coursesEl) coursesEl.disabled = isStudent;
    if(labsEl) labsEl.disabled = isStudent;
    if(sheetNewEl) sheetNewEl.disabled = isStudent;
    // For Faculty: disable generator inputs, but allow request button; Admin keeps enabled
    const isFaculty = roleSelect.value === 'Faculty';
    if(isFaculty){
      if(daysEl) daysEl.disabled = true;
      if(slotsEl) slotsEl.disabled = true;
      if(coursesEl) coursesEl.disabled = true;
      if(labsEl) labsEl.disabled = true;
      if(sheetNewEl) sheetNewEl.disabled = true;
    }
    // Hide preview button for non-admins
    if(previewBtn) previewBtn.style.display = (roleSelect.value === 'Admin') ? 'inline-block' : 'none';
  }

  function effectiveSheetName(){
    const fromNew = (sheetNewEl && sheetNewEl.value || '').trim();
    return fromNew || (sheetEl && sheetEl.value) || 'Timetable';
  }

  function selectedSheetNameForLoad(){
    // For loading, always prefer the dropdown selection, not the new-name input
    return (sheetEl && sheetEl.value) || (sheetNewEl && sheetNewEl.value) || 'Timetable';
  }

  async function saveEdits(){
    if(roleSelect.value !== 'Admin'){ setStatus('Only Admin can save.'); return; }
    const rows = [];
    tableEl.querySelectorAll('tr').forEach((tr, idx) => {
      const row = [];
      tr.querySelectorAll(idx === 0 ? 'th' : 'td').forEach(cell => row.push(cell.textContent || ''));
      rows.push(row);
    });
    let sheet = effectiveSheetName();
    sheet = redirectedSheetName(sheet);
    setStatus('Saving...');
    try{
      const res = await fetch(`${API_BASE}/timetable?sheet=${encodeURIComponent(sheet)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Failed');
      setStatus('Saved');
      // Remember and show this sheet in dropdown immediately
      rememberAppSheet(sheet, true);
    }catch(e){ setStatus(e.message, true); }
  }

  async function loadSheet(){
    const sheet = selectedSheetNameForLoad();
    setStatus('Loading...');
    try{
      const res = await fetch(`${API_BASE}/timetable?sheet=${encodeURIComponent(sheet)}`);
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Failed');
      // If values look like our saved timetable (with headers), render as-is.
      // Otherwise, try to read from A1:Z50 and render whatever exists.
      renderTable(data.values);
      setStatus('Loaded');
    }catch(e){
      setStatus(e.message, true);
    }
  }

  async function generate(preview){
    let sheet = effectiveSheetName();
    sheet = redirectedSheetName(sheet);
    const department = deptEl && deptEl.value;
    const year = yearEl && yearEl.value;
    const semester = semEl && semEl.value;
    const days = daysEl.value.split(',').map(s => s.trim()).filter(Boolean);
    // Allow syntax: Course|Coordinator → will render as "Course (Coord: Coordinator)"
    const courses = (coursesEl.value || '').split(',')
      .map(s => s.trim()).filter(Boolean)
      .map(s => {
        // If user included a coordinator manually via pipe, keep it; otherwise enrich from template cache
        const [course, coord] = s.split('|').map(x => x && x.trim());
        const enrichedCoord = coord || templateCourseToCoordinator[course];
        return enrichedCoord ? `${course} (Coord: ${enrichedCoord})` : course;
      });
    if(courses.length === 0){ setStatus('Please enter at least one course.', true); return; }
    // Allow syntax: Lab:blocks|Incharge → will render as "Lab [Incharge: Name]"
    let labs = [];
    if(isSeventhSemester()){
      // Ignore manual input; rely solely on what Admin has put in the 7th sem sheet
      labs = Object.entries(templateLabToInfo).map(([name, info]) => {
        const blocks = Math.max(1, Math.min(10, Number((info && info.blocks) || 1)));
        const nameWithLab = /lab/i.test(name) ? name : `${name} Lab`;
        const label = (info && info.incharge) ? `${nameWithLab} [Incharge: ${info.incharge}]` : nameWithLab;
        return { name: label, blocks };
      });
    } else {
      labs = (labsEl.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(entry => {
          const [pair, incharge] = entry.split('|').map(x => x && x.trim());
          const [name, blocksStr] = String(pair || '').split(':').map(x => x.trim());
          const blocks = Math.max(1, Math.min(10, Number(blocksStr || '1')));
          const cached = templateLabToInfo[name] || {};
          const finalIncharge = incharge || cached.incharge;
          const nameWithLab = /lab/i.test(name) ? name : `${name} Lab`;
          const label = finalIncharge ? `${nameWithLab} [Incharge: ${finalIncharge}]` : nameWithLab;
          return { name: label, blocks };
        });
    }
    setStatus(preview ? 'Generating (preview)...' : 'Generating...');
    // only preview button exists now
    if(preview && previewBtn) previewBtn.disabled = true;
    try{
      const res = await fetch(`${API_BASE}/timetable/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet, days, courses, labs, department, year, semester, preview: !!preview })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Failed');
      renderTable(data.rows);
      setStatus(preview ? 'Generated (not saved)' : 'Generated and saved');
      // Only remember in dropdown when it is actually saved (non-preview)
      if(!preview){
        rememberAppSheet(sheet, true);
      }
      // If generating any odd/even semester, also generate other odd/even semesters as previews to display and check overlaps
      try{
        const isOddSem = ['III','V','VII'].includes(String(semester));
        const isEvenSem = ['IV','VI','VIII'].includes(String(semester));
        if(isOddSem){
          await generateLinkedOddSemestersAndReportConflicts(days, data.rows, { triggerYear: String(year), triggerSem: String(semester), sheetName: sheet });
        } else if(isEvenSem){
          await generateLinkedEvenSemestersAndReportConflicts(days, data.rows, { triggerYear: String(year), triggerSem: String(semester), sheetName: sheet });
        }
      }catch{}
    }catch(e){
      setStatus(e.message, true);
    }finally{
      if(preview && previewBtn) previewBtn.disabled = false;
    }
  }

  function parseInstructor(label){
    if(!label) return '';
    const m1 = /Coord:\s*([^\)\]]+)/i.exec(label);
    if(m1) return (m1[1]||'').trim();
    const m2 = /Incharge:\s*([^\]\)]+)/i.exec(label);
    if(m2) return (m2[1]||'').trim();
    return '';
  }

  async function fetchCoursesAndLabsFromTemplate(template){
    try{
      const res = await fetch(`${API_BASE}/timetable?sheet=${encodeURIComponent(template)}`);
      const data = await res.json();
      if(!Array.isArray(data.values)) return { courses: [], labs: [] };
      const values = data.values;
      const lower = String(template).toLowerCase();
      let courseEndIdx = 6;
      if(lower === 'thirdyear 5th sem') courseEndIdx = 10;
      if(lower === 'fourthyear 7th sem') courseEndIdx = 7;
      const courses = [];
      for(let i=0;i<=courseEndIdx;i++){
        const row = values[i] || [];
        const course = (row[0] || '').toString().trim();
        const coord = (row[1] || '').toString().trim();
        if(course){ courses.push(coord ? `${course} (Coord: ${coord})` : course); }
      }
      const labs = [];
      if(lower === 'thirdyear 5th sem'){
        [12,13].forEach(i => {
          const row = values[i] || [];
          const lab = (row[0] || '').toString().trim();
          const incharge = (row[1] || '').toString().trim();
          if(lab){
            const nameWithLab = /lab/i.test(lab) ? lab : `${lab} Lab`;
            labs.push({ name: incharge ? `${nameWithLab} [Incharge: ${incharge}]` : nameWithLab, blocks: 1 });
          }
        });
      } else {
        for(let i=8;i<=11;i++){
          const row = values[i] || [];
          const lab = (row[0] || '').toString().trim();
          const incharge = (row[1] || '').toString().trim();
          if(lab){
            const nameWithLab = /lab/i.test(lab) ? lab : `${lab} Lab`;
            labs.push({ name: incharge ? `${nameWithLab} [Incharge: ${incharge}]` : nameWithLab, blocks: 1 });
          }
        }
      }
      return { courses, labs };
    }catch{ return { courses: [], labs: [] }; }
  }

  async function generatePreviewRows(sheetName, days, courses, labs){
    const res = await fetch(`${API_BASE}/timetable/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheetName, days, courses, labs, department: deptEl.value, year: '', semester: '', preview: true })
    });
    const data = await res.json();
    return Array.isArray(data.rows) ? data.rows : [];
  }

  function computeConflictsAcrossGrids(rowsList){
    // rows have header with breaks; build map day->slotIndex(non-break)->instructors[]
    const isPeriodCol = (header) => !/Break|Lunch/i.test(header) && header !== 'Day';
    if(rowsList.length === 0) return [];
    // Normalize input: allow either rows[][] or { rows, title }
    const contexts = rowsList.map((it, idx) => Array.isArray(it) ? { rows: it, title: `Grid ${idx+1}` } : it);
    const header = rowsList[0][0]; // not used
    const headers = rowsList[0][0] ? rowsList[0][0] : null;
    const head = rowsList[0][0];
    const hrow = rowsList[0][0];
    const conflictDetails = [];
    const headerRow = rowsList[0][0] ? rowsList[0][0] : null;
    // Use headers from first grid
    const headersRow = rowsList[0][0] ? rowsList[0][0] : null;
    const headersArr = rowsList[0][0] ? rowsList[0][0] : null;
    const headersFromGrid = rowsList[0][0];
    const headersRowVals = rowsList[0][0];
    const headersList = rowsList[0][0];
    const headersFinal = rowsList[0][0];
    // Determine column indices of periods
    const periodIdxs = [];
    // Fallback: derive from table in DOM if available
    const tableHeaders = Array.from(document.querySelectorAll('#timetable thead th')).map(th => th.textContent);
    const usableHeaders = tableHeaders.length ? tableHeaders : contexts[0].rows[0];
    usableHeaders.forEach((label, idx) => { if(isPeriodCol(label)) periodIdxs.push(idx); });
    const daysOrder = ['Mon','Tue','Wed','Thu','Fri'];
    const dayIndex = (day) => daysOrder.indexOf(day);
    const seen = new Set();
    const conflictsSet = new Set();
    const details = [];
    for(let g=0; g<contexts.length; g++){
      const rows = contexts[g].rows;
      const semTitle = contexts[g].title;
      for(let r=1; r<rows.length; r++){
        const day = rows[r][0];
        const dayIdx = dayIndex(day);
        if(dayIdx < 0) continue;
        periodIdxs.forEach((cIdx, pIdx) => {
          const cell = rows[r][cIdx] || '';
          const inst = parseInstructor(cell);
          if(!inst) return;
          const key = `${dayIdx}:${pIdx}:${inst.toLowerCase()}`;
          if(seen.has(key)){
            const info = { day, slot: usableHeaders[cIdx], instructor: inst, sem: semTitle };
            details.push(info);
            conflictsSet.add(key);
          } else {
            seen.add(key);
          }
        });
      }
    }
    // Save keys and mapping data to highlight later
    currentConflictKeys = { set: conflictsSet, periodIdxs };
    return details;
  }

  function computePeriodIdxsFromTable(table){
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent || '');
    const idxs = [];
    headers.forEach((label, idx) => { if(!/Break|Lunch/i.test(label) && label !== 'Day') idxs.push(idx); });
    return idxs;
  }

  function refreshHighlightsOnTable(table){
    if(!currentConflictKeys) return;
    const periodIdxs = computePeriodIdxsFromTable(table);
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach((tr, rIdx) => {
      periodIdxs.forEach((cIdx, pIdx) => {
        const cell = tr.children[cIdx];
        if(!cell) return;
        const inst = parseInstructor(cell.textContent || '');
        const key = inst ? `${rIdx}:${pIdx}:${inst.toLowerCase()}` : '';
        if(key && currentConflictKeys.set.has(key)){
          cell.style.backgroundColor = '#3f1d1d';
          cell.style.color = '#fca5a5';
        } else {
          cell.style.backgroundColor = '';
          cell.style.color = '';
        }
      });
    });
  }

  let liveEditTimer = null;
  function handleLiveEditConflictCheck(){
    if(liveEditTimer) clearTimeout(liveEditTimer);
    liveEditTimer = setTimeout(() => {
      try{
        // Rebuild contexts from DOM: main table and all previews
        const contexts = [];
        const mainTable = document.querySelector('#timetable');
        if(mainTable){
          const rows = captureRowsFromTable(mainTable);
          contexts.push({ rows, title: 'Current' });
        }
        document.querySelectorAll('#extraPreviews details').forEach((det) => {
          const table = det.querySelector('table');
          const title = (det.querySelector('summary') && det.querySelector('summary').textContent) || 'Preview';
          if(table){
            contexts.push({ rows: captureRowsFromTable(table), title });
          }
        });
        const conflicts = computeConflictsAcrossGrids(contexts);
        // Update status with human-readable references
        if(conflicts.length){
          const msg = conflicts.map(c => `${c.instructor}: ${c.sem} - ${c.day} ${c.slot}`).join('; ');
          setStatus(`Overlaps: ${conflicts.length} — ${msg}`, true);
        } else {
          setStatus('No instructor overlaps detected.', false);
        }
        // Refresh highlights on all tables
        if(mainTable) refreshHighlightsOnTable(mainTable);
        document.querySelectorAll('#extraPreviews table').forEach((t) => refreshHighlightsOnTable(t));
      }catch{}
    }, 300);
  }

  function captureRowsFromTable(table){
    const rows = [];
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    const headRow = Array.from((thead && thead.querySelectorAll('th')) || []).map(th => th.textContent || '');
    rows.push(headRow);
    Array.from((tbody && tbody.querySelectorAll('tr')) || []).forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent || '');
      // Prepend Day cell from first column which may be a th in some styles
      const dayCell = tr.querySelector('td,th');
      if(dayCell){ cells.unshift(dayCell.textContent || ''); }
      rows.push(cells);
    });
    return rows;
  }

  async function generateLinkedOddSemestersAndReportConflicts(days, currentRows, info){
    clearExtraPreviews();
    // Determine which two additional odd sems to generate based on trigger
    const all = [
      { label: 'Secondyear 3rd sem - Generated', template: 'Secondyear 3rd sem' },
      { label: 'Thirdyear 5th sem - Generated', template: 'Thirdyear 5th sem' },
      { label: 'Fourthyear 7th sem - Generated', template: 'Fourthyear 7th sem' }
    ];
    const targetOrder = ['III','V','VII'];
    const rowsList = [];
    // Insert the current one first with a proper title
    const currentTitle = `${deptEl.value} ${info && info.triggerYear ? info.triggerYear : ''} ${info && info.triggerSem ? info.triggerSem : ''} - Preview`;
    renderReadOnlyTable(currentRows, currentTitle);
    rowsList.push(currentRows);
    for(const item of all){
      const semFromLabel = item.template.toLowerCase().includes('3rd') ? 'III' : item.template.toLowerCase().includes('5th') ? 'V' : 'VII';
      if(semFromLabel === String(info && info.triggerSem)) continue; // skip current
      const { courses, labs } = await fetchCoursesAndLabsFromTemplate(item.template);
      const rows = await generatePreviewRows(item.label, days, courses, labs);
      if(rows.length){
        renderReadOnlyTable(rows, `${item.template} - Preview`);
        rowsList.push(rows);
      }
    }
    const conflicts = computeConflictsAcrossGrids([
      { rows: currentRows, title: currentTitle },
      ...rowsList.slice(1).map((r, i) => ({ rows: r, title: (document.querySelectorAll('#extraPreviews summary')[i] || {}).textContent || 'Preview' }))
    ]);
    if(conflicts.length){
      const msg = conflicts.map(c => `${c.instructor}: ${c.day} ${c.slot}`).join('; ');
      console.warn('Instructor overlaps detected:', conflicts);
      setStatus(`Overlaps: ${conflicts.length} — ${msg}`, true);
    } else {
      setStatus('Generated. No instructor overlaps across odd semesters.', false);
    }
  }

  async function generateLinkedEvenSemestersAndReportConflicts(days, currentRows, info){
    clearExtraPreviews();
    const all = [
      { label: 'Secondyear 4th sem - Generated', template: 'Secondyear 4th sem' },
      { label: 'Thirdyear 6th sem - Generated', template: 'Thirdyear 6th sem' },
      { label: 'Fourthyear 8th sem - Generated', template: 'Fourthyear 8th sem' }
    ];
    const rowsList = [];
    const currentTitle = `${deptEl.value} ${info && info.triggerYear ? info.triggerYear : ''} ${info && info.triggerSem ? info.triggerSem : ''} - Preview`;
    renderReadOnlyTable(currentRows, currentTitle);
    rowsList.push(currentRows);
    for(const item of all){
      const semFromLabel = item.template.toLowerCase().includes('4th') ? 'IV' : item.template.toLowerCase().includes('6th') ? 'VI' : 'VIII';
      if(semFromLabel === String(info && info.triggerSem)) continue; // skip current
      const { courses, labs } = await fetchCoursesAndLabsFromTemplate(item.template);
      const rows = await generatePreviewRows(item.label, days, courses, labs);
      if(rows.length){
        renderReadOnlyTable(rows, `${item.template} - Preview`);
        rowsList.push(rows);
      }
    }
    const conflicts = computeConflictsAcrossGrids([
      { rows: currentRows, title: currentTitle },
      ...rowsList.slice(1).map((r, i) => ({ rows: r, title: (document.querySelectorAll('#extraPreviews summary')[i] || {}).textContent || 'Preview' }))
    ]);
    if(conflicts.length){
      const msg = conflicts.map(c => `${c.instructor}: ${c.day} ${c.slot}`).join('; ');
      console.warn('Instructor overlaps detected:', conflicts);
      setStatus(`Overlaps: ${conflicts.length} — ${msg}`, true);
    } else {
      setStatus('Generated. No instructor overlaps across even semesters.', false);
    }
  }

  async function submitRequest(){
    const role = roleSelect.value;
    if(role !== 'Faculty') { setStatus('Only Faculty can submit requests.'); return; }
    const message = prompt('Describe the change you want:');
    if(!message) return;
    setStatus('Submitting request...');
    try{
      let name = undefined;
      try{ const u = JSON.parse(localStorage.getItem('tt_user') || 'null'); name = u && u.email; }catch{}
      const res = await fetch(`${API_BASE}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, name, message }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Failed');
      setStatus('Request submitted');
    }catch(e){ setStatus(e.message, true); }
  }

  if(previewBtn) previewBtn.addEventListener('click', () => generate(true));
  loadBtn.addEventListener('click', loadSheet);
  roleSelect.addEventListener('change', () => {
    // Prevent non-admins from changing role
    try{
      const user = JSON.parse(localStorage.getItem('tt_user') || 'null') || {};
      if(user.role !== 'Admin'){
        roleSelect.value = user.role || 'Student';
        return; // ignore changes
      }
    }catch{}
    try{
      const user = JSON.parse(localStorage.getItem('tt_user') || 'null') || {};
      user.role = roleSelect.value;
      localStorage.setItem('tt_user', JSON.stringify(user));
      localStorage.setItem('tt_role', user.role);
    }catch{}
    // Re-render current table to toggle editability
    const current = [];
    tableEl.querySelectorAll('tr').forEach((tr, idx) => {
      const row = [];
      tr.querySelectorAll('th,td').forEach(cell => row.push(cell.textContent || ''));
      current.push(row);
    });
    if(current.length) renderTable(current);
    const isAdmin = roleSelect.value === 'Admin';
    requestBtn.style.display = roleSelect.value === 'Faculty' ? 'inline-block' : 'none';
    if(notifWrap) notifWrap.style.display = isAdmin ? 'inline-block' : 'none';
    notifBadge.style.display = isAdmin ? 'inline-block' : 'none';
    // Rename Load button for Student role
    loadBtn.textContent = roleSelect.value === 'Student' ? 'Generated TT' : 'Load Sheet';
    updateInputsForRole();
  });

  // SSE stream for admin notifications
  function startSse(){
    try{
      const ev = new EventSource(`${API_BASE}/requests/stream`);
      ev.onmessage = (e) => {
        if(roleSelect.value !== 'Admin') return;
        try{
          const data = JSON.parse(e.data);
          addNotificationItem(data);
          setStatus(`New request: ${data.message}`);
        }catch{}
      };
      ev.onerror = () => { /* keep alive */ };
    }catch{}
  }

  startSse();

  function addNotificationItem(data){
    try{
      const cur = Number(notifBadge.textContent || '0') + 1;
      notifBadge.textContent = String(cur);
      notifBadge.style.display = 'inline-block';
      if(notifEmpty) notifEmpty.style.display = 'none';
      if(notifList){
        const li = document.createElement('li');
        const name = data.name || 'Faculty';
        const ts = data.created_at ? ` [${data.created_at}]` : '';
        li.textContent = `${name}: ${data.message}${ts}`;
        notifList.prepend(li);
      }
    }catch{}
  }

  // Preload recent requests for dropdown (optional)
  (async function preloadRequests(){
    try{
      if(roleSelect.value !== 'Admin'){ if(notifWrap) notifWrap.style.display = 'none'; return; }
      const res = await fetch(`${API_BASE}/requests`);
      const data = await res.json();
      if(Array.isArray(data.rows)){
        const recent = data.rows.slice(0, 10);
        if(recent.length === 0 && notifEmpty) notifEmpty.style.display = 'block';
        recent.reverse().forEach(addNotificationItem);
      }
    }catch{}
  })();

  // Save to sheet and Clear handlers (Admin only)
  if(notifSave){
    notifSave.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if(roleSelect.value !== 'Admin') return;
      setStatus('Saving notifications...');
      try{
        const res = await fetch(`${API_BASE}/requests/export`, { method: 'POST' });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Failed to save');
        setStatus(`Saved ${data.count} notifications to sheet`);
      }catch(err){ setStatus((err && err.message) || 'Failed', true); }
    });
  }

  // Toggle dropdown on click and close on outside click
  if(notifWrap && notifBadge){
    notifWrap.addEventListener('click', (e) => {
      if(roleSelect.value !== 'Admin') return;
      e.stopPropagation();
      notifWrap.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if(!notifWrap.classList.contains('open')) return;
      const target = e.target;
      if(notifWrap.contains(target)) return; // clicks inside keep open handled above
      notifWrap.classList.remove('open');
    });
  }
  if(notifClear){
    notifClear.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if(roleSelect.value !== 'Admin') return;
      const ok = confirm('Clear all notifications? They should be saved first.');
      if(!ok) return;
      try{
        const res = await fetch(`${API_BASE}/requests`, { method: 'DELETE' });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Failed to clear');
        // reset UI
        notifBadge.textContent = '0';
        if(notifList) notifList.innerHTML = '';
        if(notifEmpty) notifEmpty.style.display = 'block';
        setStatus('Notifications cleared');
      }catch(err){ setStatus((err && err.message) || 'Failed', true); }
    });
  }

  // Initialize role-specific UI on first load
  loadBtn.textContent = roleSelect.value === 'Student' ? 'Generated TT' : 'Load Sheet';
  requestBtn.style.display = roleSelect.value === 'Faculty' ? 'inline-block' : 'none';
  // Hide preview button when not Admin
  if(previewBtn) previewBtn.style.display = (roleSelect.value === 'Admin') ? 'inline-block' : 'none';
  requestBtn.addEventListener('click', submitRequest);
  updateInputsForRole();
  // Keep semesters aligned with selected year and apply preset on first load
  syncSemestersToYear();
  applyProgramPreset();

  // Populate sheet list
  (async function initSheets(){
    try{
      const res = await fetch(`${API_BASE}/timetable/sheets`);
      const data = await res.json();
      if(Array.isArray(data.sheets)){
        sheetEl.innerHTML = '';
        const hidden = ['users','roles','notifications'];
        // Only show sheets that are either pre-existing app sheets or created/saved via this app
        // Track app-created sheets in localStorage key 'tt_app_sheets'
        let appSheets = [];
        try{ appSheets = JSON.parse(localStorage.getItem('tt_app_sheets') || '[]'); }catch{}
        // Remove any template names that might have been recorded previously
        try{
          const cleaned = appSheets.filter(name => !isTemplateSheet(name));
          if(cleaned.length !== appSheets.length){
            appSheets = cleaned;
            localStorage.setItem('tt_app_sheets', JSON.stringify(cleaned));
          }
        }catch{}
        // For non-admins (Faculty/Student), allow all app-managed generated sheets to be visible.
        const isAdmin = roleSelect.value === 'Admin';
        const allowed = new Set(appSheets.map(x => String(x).toLowerCase()));
        data.sheets
          .filter(name => !hidden.includes(String(name).toLowerCase()))
          .filter(name => allowed.has(String(name).toLowerCase()))
          .filter(name => !isTemplateSheet(name))
          .forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name; sheetEl.appendChild(opt);
          });
        // For Faculty/Student: auto-pick the most recent available generated sheet
        if(sheetEl.options.length > 0 && roleSelect.value !== 'Admin'){
          sheetEl.selectedIndex = sheetEl.options.length - 1;
        }
      }
    }catch{}
  })();

  // initial load
  loadSheet();

  // Re-apply preset when these controls change
  if(deptEl) deptEl.addEventListener('change', applyProgramPreset);
  if(yearEl) yearEl.addEventListener('change', function(){
    syncSemestersToYear();
    applyProgramPreset();
  });
  if(semEl) semEl.addEventListener('change', function(){
    updateLabsControlForSem();
    applyProgramPreset();
  });
  if(semEl) semEl.addEventListener('change', applyProgramPreset);
})();


