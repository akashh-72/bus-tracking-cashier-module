import { db, ref, get, set, update, push } from './firebase-config.js';

const pendingTableBody = document.getElementById('pending-table-body');
const historyTableBody = document.getElementById('history-table-body');
const searchHistory = document.getElementById('search-history');

// Manual Payment Form Elements
const manualForm = document.getElementById('manual-payment-form');
const manualStudentSelect = document.getElementById('manual-student-select');

let paymentData = {};
let studentDataCache = {};
let routeDataCache = {};
let currentFeePerMonth = 0;

// 1. Initialize
Promise.all([
    get(ref(db, 'paymentRequests')),
    get(ref(db, 'students')),
    get(ref(db, 'routes'))
]).then(([paymentsSnap, studentsSnap, routesSnap]) => {
    paymentData = paymentsSnap.val() || {};
    studentDataCache = studentsSnap.val() || {};
    routeDataCache = routesSnap.val() || {};

    populateStudentDropdown(studentDataCache);
    renderFees(paymentData);

    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.add('hidden');
});

const manualStopSelect = document.getElementById('manual-stop-select');
const feeHintText = document.getElementById('fee-hint-text');

manualStudentSelect.addEventListener('change', (e) => {
    populateStopsDropdown(e.target.value);
    updateManualAmount();
});

manualStopSelect.addEventListener('change', (e) => {
    currentFeePerMonth = parseInt(e.target.value) || 0;
    if (e.target.value) {
        feeHintText.innerText = `Mapped Fee: ₹${currentFeePerMonth}/mo`;
        feeHintText.style.color = '#10B981';
    } else {
        feeHintText.innerText = `Select a stop to auto-calculate fees.`;
        feeHintText.style.color = 'var(--text-secondary)';
    }
    updateManualAmount();
});

function populateStopsDropdown(enrollmentId) {
    manualStopSelect.innerHTML = '<option value="">-- Select Stop --</option>';
    currentFeePerMonth = 0;
    feeHintText.innerText = "Select a stop to auto-calculate fees.";
    feeHintText.style.color = 'var(--text-secondary)';

    if (!enrollmentId) return;

    const student = studentDataCache[enrollmentId];
    if (!student || !student.busNo || student.busNo === "Not Assigned") {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.text = "Student has no assigned bus.";
        manualStopSelect.appendChild(opt);
        return;
    }

    const route = Object.values(routeDataCache).find(r => r.busNo === student.busNo);
    if (!route) return;

    const allStops = [];
    if (route.source) allStops.push(route.source);
    if (route.stops) {
        Object.values(route.stops).forEach(s => allStops.push(s));
    }

    allStops.forEach(stop => {
        const option = document.createElement('option');
        const fee = parseInt(stop.feeAmount) || 0;
        option.value = fee;
        option.text = `${stop.name} (₹${fee}/mo)`;
        option.dataset.stopName = stop.name;

        if (student.pickupStop && student.pickupStop === stop.name) {
            option.selected = true;
            currentFeePerMonth = fee;
            feeHintText.innerText = `Mapped Fee: ₹${currentFeePerMonth}/mo`;
            feeHintText.style.color = '#10B981';
        }

        manualStopSelect.appendChild(option);
    });
}

document.querySelectorAll('#manual-month-checkboxes input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', updateManualAmount);
});

function updateManualAmount() {
    const checkedCount = document.querySelectorAll('#manual-month-checkboxes input:checked').length;
    const total = currentFeePerMonth * checkedCount;
    document.getElementById('manual-amount').value = total > 0 ? total : '';
}

function populateStudentDropdown(students) {
    manualStudentSelect.innerHTML = '<option value="">-- Select Student --</option>';
    Object.values(students).forEach(s => {
        const option = document.createElement('option');
        option.value = s.enrollmentId;
        option.text = `${s.name} (${s.enrollmentId})`;
        option.dataset.name = s.name;
        option.dataset.bus = s.busNo;
        manualStudentSelect.appendChild(option);
    });
}

function renderFees(data) {
    pendingTableBody.innerHTML = '';
    historyTableBody.innerHTML = '';

    const requests = Object.entries(data).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    let pendingCount = 0;
    let historyCount = 0;

    requests.forEach(([key, req]) => {
        const dateStr = req.timestamp ? new Date(req.timestamp).toLocaleDateString() : 'N/A';

        if (req.status === 'Pending') {
            pendingCount++;
            const row = `
                <tr class="fade-in">
                    <td>
                        <div style="font-weight: 600;">${req.studentName}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${req.enrollmentId}</div>
                    </td>
                    <td><span class="status-pills status-active" style="background: #E0F2FE; color: #0369A1;">${req.semester || 'N/A'}</span></td>
                    <td><span style="color: var(--primary-color); font-weight: 600;">₹${req.amount || 0}</span></td>
                    <td style="font-family: monospace; font-weight: bold; font-size: 12px; letter-spacing: 1px;">${req.utr}</td>
                    <td>${dateStr}</td>
                    <td>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-primary" style="background: var(--accent-emerald); padding: 8px 12px; font-size: 12px;" onclick="approvePayment('${key}')">Approve</button>
                            <button class="btn-primary" style="background: var(--accent-rose); padding: 8px 12px; font-size: 12px;" onclick="rejectPayment('${key}')">Reject</button>
                        </div>
                    </td>
                </tr>
            `;
            pendingTableBody.innerHTML += row;
        } else {
            historyCount++;
            const statusClass = req.status === 'Approved' ? 'status-active' : 'status-offline';
            const row = `
                <tr class="fade-in" data-search="${req.studentName.toLowerCase()} ${req.utr.toLowerCase()}">
                    <td>
                        <div style="font-weight: 600;">${req.studentName}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${req.enrollmentId}</div>
                    </td>
                    <td>${req.semester || 'N/A'}</td>
                    <td><span style="font-weight: 600;">₹${req.amount || 0}</span></td>
                    <td style="font-family: monospace; font-size: 11px;">${req.utr}</td>
                    <td><span class="status-pills ${statusClass}">${req.status.toUpperCase()}</span></td>
                </tr>
            `;
            historyTableBody.innerHTML += row;
        }
    });

    if (pendingCount === 0) {
        pendingTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color: var(--text-secondary);">No pending Verification requests.</td></tr>';
    }
    if (historyCount === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: var(--text-secondary);">No transaction history available.</td></tr>';
    }
}

// Search History
searchHistory.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = historyTableBody.querySelectorAll('tr[data-search]');
    rows.forEach(row => {
        if (row.dataset.search.includes(term)) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
});

// Apporoval / Rejection logic
window.approvePayment = async (requestId) => {
    if (!confirm("Confirm UTR verification and approve payment?")) return;

    const requestRef = ref(db, `paymentRequests/${requestId}`);
    const snapshot = await get(requestRef);
    if (!snapshot.exists()) return;

    const req = snapshot.val();
    const enrollmentId = req.enrollmentId;

    // 1. Update Student Record
    // We update student's monthlyFees collection
    const studentRef = ref(db, `students/${enrollmentId}`);
    const studentSnap = await get(studentRef);

    if (studentSnap.exists()) {
        const student = studentSnap.val();
        const monthlyFees = student.monthlyFees || {};

        const monthsKeyList = req.semester ? req.semester.split(',').map(m => m.trim()).filter(m => m) : [];
        const splitAmount = monthsKeyList.length > 0 ? (req.amount / monthsKeyList.length) : req.amount;

        monthsKeyList.forEach(monthKey => {
            monthlyFees[monthKey] = {
                status: "Paid",
                amount: splitAmount,
                utr: req.utr,
                timestamp: Date.now()
            };
        });

        const updates = { monthlyFees: monthlyFees };
        // We also set feeStatus to Paid if it's currently Pending, just for legacy checks
        updates.feeStatus = "Paid";
        updates.passStatus = "Valid";
        if (req.busNo && (!student.busNo || student.busNo === "Not Assigned")) {
            updates.busNo = req.busNo;
        }
        await update(studentRef, updates);
    }

    // 2. Mark Request as Approved
    await update(requestRef, {
        status: 'Approved',
        processedAt: Date.now(),
        processedBy: localStorage.getItem('cashier_id') || 'Cashier'
    });

    alert("Payment Approved Successfully");
    window.location.reload();
};

window.rejectPayment = async (requestId) => {
    if (!confirm("Reject this payment request?")) return;

    const requestRef = ref(db, `paymentRequests/${requestId}`);
    const snapshot = await get(requestRef);
    if (!snapshot.exists()) return;

    const req = snapshot.val();
    const enrollmentId = req.enrollmentId;

    const studentRef = ref(db, `students/${enrollmentId}`);
    const studentSnap = await get(studentRef);
    if (studentSnap.exists() && req.semester) {
        const student = studentSnap.val();
        const monthlyFees = student.monthlyFees || {};
        const monthsKeyList = req.semester.split(',').map(m => m.trim()).filter(m => m);

        let changed = false;
        monthsKeyList.forEach(monthKey => {
            if (monthlyFees[monthKey] && monthlyFees[monthKey].status === "Pending") {
                monthlyFees[monthKey].status = "Rejected";
                changed = true;
            }
        });

        if (changed) {
            await update(studentRef, { monthlyFees: monthlyFees });
        }
    }

    await update(requestRef, {
        status: 'Rejected',
        processedAt: Date.now(),
        processedBy: localStorage.getItem('cashier_id') || 'Cashier'
    });
    window.location.reload();
};

// Manual Payment Entry
window.initiateManualPayment = () => {
    document.getElementById('manual-payment-form').reset();
    currentFeePerMonth = 0;
    document.getElementById('manual-amount').value = '';
    manualStopSelect.innerHTML = '<option value="">-- Select Stop --</option>';
    feeHintText.innerText = "Select a stop to auto-calculate fees.";
    feeHintText.style.color = 'var(--text-secondary)';
    document.getElementById('manual-payment-modal').style.display = 'grid';
};

manualForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = manualForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "RECORDING...";

    const studentSelect = document.getElementById('manual-student-select');
    const option = studentSelect.options[studentSelect.selectedIndex];

    const enrollmentId = option.value;
    const name = option.dataset.name;
    const busNo = option.dataset.bus || "";

    const checkedBoxes = document.querySelectorAll('#manual-month-checkboxes input:checked');
    if (checkedBoxes.length === 0) {
        alert("Please select at least one month.");
        btn.disabled = false;
        btn.innerText = "RECORD PAYMENT";
        return;
    }
    const selectedMonthKeys = Array.from(checkedBoxes).map(cb => cb.value);
    const monthString = selectedMonthKeys.join(", ");

    const amount = document.getElementById('manual-amount').value;
    const utr = "CASH";

    // 1. Push to paymentRequests as Approved
    const newReqRef = push(ref(db, 'paymentRequests'));
    const paymentObj = {
        requestId: newReqRef.key,
        enrollmentId: enrollmentId,
        studentName: name,
        busNo: busNo,
        utr: utr,
        amount: amount,
        semester: monthString,
        status: "Approved",
        timestamp: Date.now(),
        processedAt: Date.now(),
        processedBy: localStorage.getItem('cashier_id') || 'Cashier',
        type: 'Manual Cash'
    };
    await set(newReqRef, paymentObj);

    // 2. Update Student Record
    const studentRef = ref(db, `students/${enrollmentId}`);
    const studentSnap = await get(studentRef);

    if (studentSnap.exists()) {
        const student = studentSnap.val();
        const monthlyFees = student.monthlyFees || {};

        const splitAmount = amount / selectedMonthKeys.length;

        selectedMonthKeys.forEach(month => {
            monthlyFees[month] = {
                status: "Paid",
                amount: splitAmount,
                utr: utr,
                timestamp: Date.now(),
                type: "Cash"
            };
        });

        // Save selected stop if any
        let selectedStopName = student.pickupStop;
        if (manualStopSelect.selectedIndex > 0) {
            const stopOpt = manualStopSelect.options[manualStopSelect.selectedIndex];
            selectedStopName = stopOpt.dataset.stopName || student.pickupStop;
        }

        await update(studentRef, {
            monthlyFees: monthlyFees,
            feeStatus: "Paid",
            passStatus: "Valid",
            pickupStop: selectedStopName || "Not Assigned"
        });
    }

    alert("Cash Payment Recorded Successfully");
    window.location.reload();
};
