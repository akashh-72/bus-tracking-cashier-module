import { db, ref, get } from './firebase-config.js';

// DOM Elements
const studentTableBody = document.getElementById('student-table-body');
const studentModal = document.getElementById('student-modal');
const searchStudent = document.getElementById('search-student');

// Modal Elements
const vName = document.getElementById('v-name');
const vEnroll = document.getElementById('v-enroll');
const vPhone = document.getElementById('v-phone');
const vEmail = document.getElementById('v-email');
const vBus = document.getElementById('v-bus');
const vStop = document.getElementById('v-stop');
const vFeeTarget = document.getElementById('v-fee-target');
const monthlyFeeStatus = document.getElementById('monthly-fee-status');

// State
let studentsData = {};
let routesData = {};

// 1. Fetch Students & Routes
Promise.all([
    get(ref(db, 'students')),
    get(ref(db, 'routes'))
]).then(([studentsSnap, routesSnap]) => {
    studentsData = studentsSnap.val() || {};
    routesData = routesSnap.val() || {};
    renderStudents(studentsData);

    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.add('hidden');
});

// Calculate stop fee
function getStopFee(busNo, stopName) {
    if (!busNo || !stopName) return 0;
    const route = Object.values(routesData).find(r => r.busNo === busNo);
    if (!route) return 0;

    // Check if it's the source
    if (route.source && route.source.name === stopName) return Number(route.source.feeAmount || 0);

    // Check waypoints
    if (route.stops) {
        const stop = Object.values(route.stops).find(s => s.name === stopName);
        if (stop) return Number(stop.feeAmount || 0);
    }

    return 0;
}

function renderStudents(data) {
    studentTableBody.innerHTML = '';
    Object.entries(data).forEach(([key, student]) => {
        const pickup = student.pickupStop || 'Not Assigned';
        const feeAmount = getStopFee(student.busNo, pickup);

        let feeStatusHtml = '';
        if (feeAmount > 0) {
            feeStatusHtml = `<span style="color: var(--primary-color); font-weight: 600;">₹${feeAmount}/mo</span>`;
        } else {
            feeStatusHtml = `<span style="color: var(--text-secondary); font-size: 12px;">No fee mapped</span>`;
        }

        const row = `
            <tr class="fade-in">
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random" style="width: 32px; border-radius: 8px;">
                        <span>${student.name}</span>
                    </div>
                </td>
                <td>${student.enrollmentId}</td>
                <td>
                    <span style="color: var(--primary-color); font-weight: 600;">BUS-${student.busNo}</span>
                </td>
                <td><span style="font-size: 11px; color: var(--text-secondary);"><i class="fas fa-map-marker-alt" style="margin-right: 4px;"></i>${pickup}</span></td>
                <td>${feeStatusHtml}</td>
                <td>
                    <button class="nav-link" style="padding: 8px 12px; height: auto;" onclick="viewStudent('${key}')">
                        <i class="fas fa-eye" style="font-size: 14px;"></i> View
                    </button>
                </td>
            </tr>
        `;
        studentTableBody.innerHTML += row;
    });
}

// 3. Search
searchStudent.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = Object.fromEntries(
        Object.entries(studentsData).filter(([_, s]) =>
            s.name.toLowerCase().includes(term) || s.enrollmentId.toLowerCase().includes(term)
        )
    );
    renderStudents(filtered);
});

// 4. View Details
window.viewStudent = (id) => {
    const s = studentsData[id];
    if (!s) return;

    vName.innerText = s.name;
    vEnroll.innerText = s.enrollmentId;
    vPhone.innerText = s.phone || 'N/A';
    vEmail.innerText = s.email || 'N/A';
    vBus.innerText = s.busNo ? `BUS-${s.busNo}` : 'Unassigned';
    vStop.innerText = s.pickupStop || 'Not Assigned';

    const targetFee = getStopFee(s.busNo, s.pickupStop);
    vFeeTarget.innerText = targetFee > 0 ? `₹${targetFee} per month` : 'Not Configured';

    // Render Monthly Status
    monthlyFeeStatus.innerHTML = '';
    const months = ['Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'];
    const monthlyFees = s.monthlyFees || {};

    months.forEach(m => {
        const isPaid = monthlyFees[m] && monthlyFees[m].status === 'Paid';
        const isPending = monthlyFees[m] && monthlyFees[m].status === 'Pending';

        let statusClass = 'status-offline'; // default unpaid
        let statusText = 'UNPAID';

        if (isPaid) {
            statusClass = 'status-active';
            statusText = 'PAID';
        } else if (isPending) {
            statusClass = 'status-pending';
            statusText = 'PENDING APP.';
            // adding yellow coloring for pending
            statusClass = '';
        }

        monthlyFeeStatus.innerHTML += `
            <div style="background: var(--bg-light); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid var(--border-color);">
                <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">${m}</div>
                ${isPending
                ? `<span style="background: rgba(245, 158, 11, 0.1); color: var(--accent-amber); padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">PENDING</span>`
                : `<span class="status-pills ${statusClass}" style="padding: 4px 8px; border-radius: 4px; font-size: 10px;">${statusText}</span>`
            }
            </div>
        `;
    });

    studentModal.style.display = 'grid';
};
