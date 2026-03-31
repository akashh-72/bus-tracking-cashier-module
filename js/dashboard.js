import { db, ref, get } from './firebase-config.js';

// Setup Cashier Profile UI
const cashierName = localStorage.getItem('cashier_name') || 'Cashier Profile';
document.getElementById('cashier-name').innerText = cashierName;
document.getElementById('cashier-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(cashierName)}&background=0F67FD&color=fff`;

// DOM Elements
const countStudents = document.getElementById('count-students');
const countCollected = document.getElementById('count-collected');
const countPending = document.getElementById('count-pending');
const countRejected = document.getElementById('count-rejected');
const liveTableBody = document.getElementById('live-table-body');

// 1. Loader & Init
Promise.all([
    get(ref(db, 'students')),
    get(ref(db, 'paymentRequests'))
]).then(([studentsSnap, paymentsSnap]) => {

    // 1. Sync Student Count
    let stdData = studentsSnap.val();
    animateCounterUI(countStudents, stdData ? Object.keys(stdData).length : 0);

    // 2. Compute Payment Analytics
    let payments = paymentsSnap.val() || {};
    let collectedAmount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    Object.values(payments).forEach(p => {
        if (p.status === 'Approved') {
            collectedAmount += Number(p.amount || 0);
        } else if (p.status === 'Pending') {
            pendingCount++;
        } else if (p.status === 'Rejected') {
            rejectedCount++;
        }
    });

    animateCounterUI(countPending, pendingCount);
    animateCounterUI(countRejected, rejectedCount);

    // We animate currency separately
    countCollected.innerText = `₹${collectedAmount.toLocaleString('en-IN')}`;

    // 3. Populate Recent Activities Table (Last 5)
    liveTableBody.innerHTML = '';

    // Sort payments by timestamp descending
    const sortedPayments = Object.values(payments).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5);

    if (sortedPayments.length === 0) {
        liveTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 40px;">No recent transactions found.</td></tr>';
    } else {
        sortedPayments.forEach((data) => {
            let statusClass = 'status-pending';
            let statusText = 'PENDING';
            if (data.status === 'Approved') {
                statusClass = 'status-active';
                statusText = 'APPROVED';
            } else if (data.status === 'Rejected') {
                statusClass = 'status-offline';
                statusText = 'REJECTED';
            }

            const row = `
                <tr class="fade-in">
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(data.studentName || 'Student')}&background=random" style="width: 32px; border-radius: 8px;">
                            <span>${data.studentName || 'Unknown Student'}</span>
                        </div>
                    </td>
                    <td><span style="font-weight: 600; color: var(--text-main);">${data.semester || 'N/A'}</span></td>
                    <td><span style="font-weight: 600; color: var(--primary-color);">₹${data.amount || '0'}</span></td>
                    <td>
                        <span class="status-pills ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td>
                        <button class="nav-link" style="padding: 8px 12px; height: auto;" onclick="window.location.href='fees.html'">
                            <i class="fas fa-arrow-right" style="font-size: 14px;"></i>
                        </button>
                    </td>
                </tr>
            `;
            liveTableBody.innerHTML += row;
        });
    }

    // Hide global loader once data is ready
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.add('hidden');
});

// Helper: Animate Counter
function animateCounterUI(element, target) {
    let current = parseInt(element.innerText.replace(/[^0-9]/g, '')) || 0;
    const step = Math.ceil(Math.abs(target - current) / 20) || 1;

    const interval = setInterval(() => {
        if (current < target) {
            current = Math.min(current + step, target);
        } else if (current > target) {
            current = Math.max(current - step, target);
        }

        element.innerText = current.toLocaleString('en-IN');

        if (current === target) clearInterval(interval);
    }, 30);
}
