const DOMAIN = '@srec.ac.in';
const API_BASE = window.location.origin;

// Get DOM elements
const emailEl = document.getElementById('emailInput');
const pwdEl = document.getElementById('passwordInput');
const newPwdEl = document.getElementById('newPasswordInput');
const confirmPwdEl = document.getElementById('confirmPasswordInput');
const loginBtn = document.getElementById('loginBtn');
const createBtn = document.getElementById('createAccountBtn');
const createSubmitBtn = document.getElementById('createAccountSubmitBtn');
const resetBtn = document.getElementById('resetBtn');
const togglePwdBtn = document.getElementById('togglePassword');
const toggleNewPwdBtn = document.getElementById('toggleNewPassword');
const toggleConfirmPwdBtn = document.getElementById('toggleConfirmPassword');
const createAccountSection = document.getElementById('createAccountSection');
const errorMessage = document.getElementById('errorMessage');

// Check if user is already logged in
if (localStorage.getItem('tt_user')) {
    window.location.href = '/';
}

function isValidDomainEmail(email) {
    return email && email.toLowerCase().endsWith(DOMAIN);
}

function setStatus(message, isError = false) {
    errorMessage.textContent = message;
    errorMessage.className = 'error-message' + (isError ? ' show' : '');
    if (!isError && message) {
        errorMessage.style.color = '#28a745';
        errorMessage.style.background = 'rgba(40, 167, 69, 0.1)';
        errorMessage.classList.add('show');
    }
}

function attachVisibilityToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', function() {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? 'Show' : 'Hide';
    });
}

// Initialize visibility toggles
attachVisibilityToggle(togglePwdBtn, pwdEl);
attachVisibilityToggle(toggleNewPwdBtn, newPwdEl);
attachVisibilityToggle(toggleConfirmPwdBtn, confirmPwdEl);

// Toggle create account section
createBtn.addEventListener('click', function() {
    createAccountSection.classList.toggle('show');
    if (createAccountSection.classList.contains('show')) {
        createBtn.textContent = 'Cancel';
    } else {
        createBtn.textContent = 'Create account';
    }
});

// Create account
createSubmitBtn.addEventListener('click', async function() {
    const email = (emailEl.value || '').trim().toLowerCase();
    if (!isValidDomainEmail(email)) {
        setStatus('Email must end with ' + DOMAIN, true);
        return;
    }
    
    const pwd = String(newPwdEl.value || '');
    const confirm = String(confirmPwdEl.value || '');
    
    if (pwd.length < 8) {
        setStatus('Password must be at least 8 characters.', true);
        return;
    }
    
    if (pwd !== confirm) {
        setStatus('Passwords do not match.', true);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password: pwd })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || 'Failed to create account');
        }

        setStatus('Account created. You can now sign in.', false);
        createAccountSection.classList.remove('show');
        newPwdEl.value = '';
        confirmPwdEl.value = '';
        createBtn.textContent = 'Create account';
    } catch (e) {
        setStatus(e.message, true);
    }
});

// Login
loginBtn.addEventListener('click', async function() {
    const email = (emailEl.value || '').trim().toLowerCase();
    const pwd = String(pwdEl.value || '');
    
    if (!isValidDomainEmail(email)) {
        setStatus('Email must end with ' + DOMAIN, true);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password: pwd })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Invalid credentials' }));
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        const role = data?.user?.role || 'Student';
        
        localStorage.setItem('tt_user', JSON.stringify({ email, role }));
        localStorage.setItem('tt_role', role);
        
        window.location.href = '/';
    } catch (e) {
        setStatus(e.message, true);
    }
});

// Reset password
resetBtn.addEventListener('click', function() {
    const email = (emailEl.value || '').trim().toLowerCase();
    if (!isValidDomainEmail(email)) {
        setStatus('Please enter a valid email first.', true);
        return;
    }
    
    // Implement password reset logic here
    setStatus('Password reset functionality coming soon.', false);
});

// Handle form submission
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    loginBtn.click();
});

