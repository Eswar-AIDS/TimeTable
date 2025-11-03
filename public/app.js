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
  const sheetEl = document.getElementById('sheet');
  const sheetNewEl = document.getElementById('sheetNew');
  const daysEl = document.getElementById('days');
  const slotsEl = document.getElementById('slots');
  const coursesEl = document.getElementById('courses');
  const labsEl = document.getElementById('labs');
  const tableEl = document.getElementById('timetable');
  const generateBtn = document.getElementById('generateBtn');
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

  function setStatus(text, isError){
    statusEl.textContent = text || '';
    statusEl.style.color = isError ? '#f87171' : '#94a3b8';
  }

  function renderTable(values){
    tableEl.innerHTML = '';
    if(!values || !values.length){ return; }
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    values.forEach((row, idx) => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const el = document.createElement(idx === 0 ? 'th' : 'td');
        el.textContent = cell ?? '';
        if(idx > 0 && roleSelect.value === 'Admin') {
          el.contentEditable = 'true';
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
    // If a manual save button exists in markup, don't create another.
    const manual = document.getElementById('saveBtnManual');
    if(manual){
      manual.style.display = roleSelect.value === 'Admin' ? 'inline-block' : 'none';
      return;
    }
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
  }

  function effectiveSheetName(){
    const fromNew = (sheetNewEl && sheetNewEl.value || '').trim();
    return fromNew || (sheetEl && sheetEl.value) || 'Timetable';
  }

  function effectiveSaveSheetName(){
    const fromNew = (sheetNewEl && sheetNewEl.value || '').trim();
    if(fromNew) return fromNew;
    const saveSelect = document.getElementById('saveSheet');
    const selected = saveSelect ? (saveSelect.value || '').trim() : '';
    return selected || effectiveSheetName();
  }

  async function saveEdits(){
    if(roleSelect.value !== 'Admin'){ setStatus('Only Admin can save.'); return; }
    const rows = [];
    tableEl.querySelectorAll('tr').forEach((tr, idx) => {
      const row = [];
      tr.querySelectorAll(idx === 0 ? 'th' : 'td').forEach(cell => row.push(cell.textContent || ''));
      rows.push(row);
    });
    const sheet = effectiveSaveSheetName();
    setStatus('Saving...');
    try{
      const res = await fetch(`/timetable?sheet=${encodeURIComponent(sheet)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Failed');
      setStatus('Saved');
    }catch(e){ setStatus(e.message, true); }
  }

  async function loadSheet(){
    const sheet = effectiveSheetName();
    setStatus('Loading...');
    try{
      const res = await fetch(`/timetable?sheet=${encodeURIComponent(sheet)}`);
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Failed');
      const values = data.values || [];
      const headerRow = (values[0] || []).map(x => String(x || ''));
      const header = headerRow.map(x => x.toLowerCase());
      const looksLikeCourses = header.some(h => ['course code','course title','faculty in-charge','faculty incharge','acronym'].includes(h));
      // Heuristic for simple subject→faculty sheets: few columns, many rows, no time labels
      const looksLikeSubjectFaculty = (headerRow.length > 0 && headerRow.length <= 3 && values.length > 5 && !header.some(h => h.includes(':') || h.includes('break') || h.includes('lunch')));

      if(looksLikeCourses || looksLikeSubjectFaculty){
        // Extract names from Acronym or Course Title; split labs by the word 'lab'
        const acrIdx = header.indexOf('acronym');
        const titleIdx = header.indexOf('course title');
        const names = [];
        for(let i = 1; i < values.length; i++){
          const row = values[i] || [];
          // Prefer acronym/title; fallback to first column for subject→faculty sheets
          const primary = (acrIdx >= 0 ? row[acrIdx] : undefined) || (titleIdx >= 0 ? row[titleIdx] : undefined) || row[0] || '';
          const name = primary;
          const trimmed = String(name || '').trim();
          if(trimmed) names.push(trimmed);
        }
        const labRegex = /\blab\b/i;
        const labNames = names.filter(n => labRegex.test(n));
        const courseNames = names.filter(n => !labRegex.test(n));
        if(coursesEl) coursesEl.value = courseNames.join(',');
        if(labsEl) labsEl.value = labNames.map(n => `${n}:1`).join(',');
        // Do not render the entire sheet table in UI
      } else {
        // Render timetable-like sheets
        renderTable(values);
      }
      setStatus('Loaded');
    }catch(e){
      setStatus(e.message, true);
    }
  }

  async function generate(){
    const sheet = effectiveSheetName();
    const days = daysEl.value.split(',').map(s => s.trim()).filter(Boolean);
    const courses = (coursesEl.value || '').split(',').map(s => s.trim()).filter(Boolean);
    if(courses.length === 0){ setStatus('Please enter at least one course.', true); return; }
    const labs = (labsEl.value || '').split(',').map(s => s.trim()).filter(Boolean).map(pair => {
      const [name, blocksStr] = pair.split(':').map(x => x.trim());
      const blocks = Math.max(1, Math.min(10, Number(blocksStr || '1')));
      return { name, blocks };
    });
    setStatus('Generating...');
    generateBtn.disabled = true;
    try{
      const res = await fetch('/timetable/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet: effectiveSaveSheetName(), days, courses, labs })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Failed');
      renderTable(data.rows);
      setStatus('Generated and saved');
    }catch(e){
      setStatus(e.message, true);
    }finally{
      generateBtn.disabled = false;
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
      const res = await fetch('/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, name, message }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Failed');
      setStatus('Request submitted');
    }catch(e){ setStatus(e.message, true); }
  }

  generateBtn.addEventListener('click', generate);
  loadBtn.addEventListener('click', loadSheet);
  const saveManualBtn = document.getElementById('saveBtnManual');
  if(saveManualBtn) saveManualBtn.addEventListener('click', saveEdits);
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
    generateBtn.disabled = !isAdmin;
    generateBtn.style.display = isAdmin ? 'inline-block' : 'none';
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
      const ev = new EventSource('/requests/stream');
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
      const res = await fetch('/requests');
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
        const res = await fetch('/requests/export', { method: 'POST' });
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
        const res = await fetch('/requests', { method: 'DELETE' });
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
  generateBtn.style.display = roleSelect.value === 'Admin' ? 'inline-block' : 'none';
  requestBtn.addEventListener('click', submitRequest);
  updateInputsForRole();

  // Populate sheet list
  (async function initSheets(){
    try{
      const res = await fetch('/timetable/sheets');
      const data = await res.json();
      if(Array.isArray(data.sheets)){
        sheetEl.innerHTML = '';
        const hidden = ['users','roles','notifications'];
        data.sheets
          .filter(name => !hidden.includes(String(name).toLowerCase()))
          .forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name; sheetEl.appendChild(opt);
          });
      }
    }catch{}
  })();

  // Populate editable save sheet list
  (async function initSaveSheets(){
    try{
      const inputEl = document.getElementById('saveSheet');
      const listEl = document.getElementById('saveSheetList');
      if(!inputEl || !listEl) return;
      const res = await fetch('/timetable/sheets-editable');
      const data = await res.json();
      if(Array.isArray(data.sheets)){
        listEl.innerHTML = '';
        const hidden = ['users','roles','notifications'];
        data.sheets
          .filter(name => !hidden.includes(String(name).toLowerCase()))
          .forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; listEl.appendChild(opt);
          });
      }
    }catch{}
  })();

  // initial load
  loadSheet();
})();


