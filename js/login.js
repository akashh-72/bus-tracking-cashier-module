import { db, ref, get } from './firebase-config.js';

document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    const submitBtn = document.querySelector('button[type="submit"]');

    // UI Loading state
    submitBtn.innerText = "VERIFYING...";
    submitBtn.disabled = true;

    try {
        const cashiersRef = ref(db, 'cashiers');
        const snapshot = await get(cashiersRef);

        let isValid = false;
        let cashierData = null;

        if (snapshot.exists()) {
            const index = snapshot.val();
            for (const key in index) {
                if (index[key].email === email && index[key].password === password) {
                    isValid = true;
                    cashierData = { ...index[key], id: key };
                    break;
                }
            }
        }

        if (isValid) {
            localStorage.setItem('cashier_logged_in', 'true');
            localStorage.setItem('cashier_id', cashierData.id || '');
            localStorage.setItem('cashier_name', cashierData.name || '');
            window.location.href = 'index.html';
        } else {
            showError("Invalid credentials provided.");
        }
    } catch (err) {
        console.error(err);
        showError("Authentication failed. Please check connection.");
    } finally {
        submitBtn.innerText = "ACCESS DASHBOARD";
        submitBtn.disabled = false;
    }

    function showError(msg) {
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
};

// Clear session if any
localStorage.removeItem('cashier_logged_in');
localStorage.removeItem('cashier_id');
localStorage.removeItem('cashier_name');
