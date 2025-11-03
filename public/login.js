(function(){
  const emailEl = document.getElementById('email');
  const pwdEl = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const toggleCreateBtn = document.getElementById('toggleCreateBtn');
  const createBtn = document.getElementById('createBtn');
  const createWrap = document.getElementById('createWrap');
  const newPwdEl = document.getElementById('newPassword');
  const confirmPwdEl = document.getElementById('confirmPassword');
  const statusEl = document.getElementById('loginStatus');
  const resetBtn = document.getElementById('resetBtn');
  const loginPwdRow = document.getElementById('loginPwdRow');
  const togglePwdBtn = document.getElementById('togglePwd');

  const DOMAIN = '@srec.ac.in';

  function setStatus(msg, isError){
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#f87171' : '#94a3b8';
  }

  function isValidDomainEmail(email){
    if(!email) return false;
    const val = String(email).trim().toLowerCase();
    return val.endsWith(DOMAIN);
  }

  if(togglePwdBtn && pwdEl){
    togglePwdBtn.addEventListener('click', function(){
      const show = pwdEl.type === 'password';
      pwdEl.type = show ? 'text' : 'password';
      togglePwdBtn.textContent = show ? '🙈' : '👁️';
      togglePwdBtn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      togglePwdBtn.title = show ? 'Hide password' : 'Show password';
    });
  }

  async function api(path, body){
    const base = (window.API_BASE_URL || '').trim().replace(/\/$/, '');
    const url = base ? (base + path) : path;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = null; try { data = await res.json(); } catch {}
    if(!res.ok){
      let msg = 'Request failed';
      const err = data && data.error;
      if(typeof err === 'string') msg = err;
      else if (err && typeof err === 'object'){
        if (typeof err.message === 'string') msg = err.message;
        else {
          const parts = [];
          const fe = err.formErrors;
          const fiels = err.fieldErrors || err.errors || {};
          if (Array.isArray(fe) && fe.length) parts.push(...fe);
          if (fiels && typeof fiels === 'object'){
            for (const k in fiels){
              const arr = fiels[k];
              if (Array.isArray(arr) && arr.length) parts.push(`${k}: ${arr[0]}`);
            }
          }
          if (parts.length) msg = parts[0];
        }
      }
      throw new Error(msg);
    }
    return data;
  }

  function getAccounts(){
    try{ return JSON.parse(localStorage.getItem('tt_accounts') || '[]'); }catch{ return []; }
  }
  function saveAccounts(list){
    try{ localStorage.setItem('tt_accounts', JSON.stringify(list)); }catch{}
  }
  function findAccount(email){
    const all = getAccounts();
    const target = String(email || '').trim().toLowerCase();
    return all.find(a => (a.email || '').toLowerCase() === target);
  }

  toggleCreateBtn.addEventListener('click', function(){
    const opening = createWrap.style.display === 'none';
    createWrap.style.display = opening ? 'block' : 'none';
    // Hide login password field while in create account mode
    if(loginPwdRow){ loginPwdRow.style.display = opening ? 'none' : 'flex'; }
    if(resetBtn){ resetBtn.style.display = opening ? 'none' : 'inline-block'; }
  });

  createBtn.addEventListener('click', async function(){
    const email = (emailEl.value || '').trim().toLowerCase();
    if(!isValidDomainEmail(email)){
      setStatus('Email must end with ' + DOMAIN, true); return;
    }
    const pwd = String(newPwdEl.value || '');
    const confirm = String(confirmPwdEl.value || '');
    if(pwd.length < 8){ setStatus('Password must be at least 8 characters.', true); return; }
    if(pwd !== confirm){ setStatus('Passwords do not match.', true); return; }
    try{
      await api('/auth/signup', { email, password: pwd });
      setStatus('Account created. You can now sign in.');
    }catch(e){ setStatus(e.message, true); }
  });

  loginBtn.addEventListener('click', async function(){
    const email = (emailEl.value || '').trim().toLowerCase();
    const pwd = String(pwdEl.value || '');
    if(!isValidDomainEmail(email)){
      setStatus('Email must end with ' + DOMAIN, true); return;
    }
    try{
      const data = await api('/auth/login', { email, password: pwd });
      const role = data?.user?.role || 'Student';
      localStorage.setItem('tt_user', JSON.stringify({ email, role }));
      localStorage.setItem('tt_role', role);
      location.replace('/');
    }catch(e){ setStatus(e.message, true); }
  });

  resetBtn.addEventListener('click', async function(){
    const email = (emailEl.value || '').trim().toLowerCase();
    if(!isValidDomainEmail(email)) { setStatus('Enter a valid @srec.ac.in email above.', true); return; }
    const newPwd = prompt('Enter a new password (min 8 chars):') || '';
    if(newPwd.length < 8){ setStatus('New password must be at least 8 characters.', true); return; }
    try{
      await api('/auth/reset', { email, newPassword: newPwd });
      setStatus('Password reset. You can sign in with the new password.');
    }catch(e){ setStatus(e.message, true); }
  });
})();

