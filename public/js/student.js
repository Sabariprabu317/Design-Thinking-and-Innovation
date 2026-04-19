const token = localStorage.getItem('token');
if (!token || localStorage.getItem('role') !== 'student') window.location.href = 'index.html';

let studentData = null;
let html5QrCode = null;
let scannerStarted = false;

const API = (url, opt = {}) => fetch(url, {
  ...opt,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    ...(opt.headers || {})
  }
});

function logout() { localStorage.clear(); window.location.href = 'index.html'; }

function showNav(name) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-content').forEach(t => t.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
  if (name !== 'scan') stopScanner();
  if (name === 'scan') {
    document.getElementById('scanResult').innerHTML = '';
    setTimeout(() => startScanner(), 500);
  }
  if (name === 'attendance') loadStudentAttendance();
  if (name === 'marks') loadStudentMarks();
  if (name === 'activity') loadStudentActivity();
}

// ─── PROFILE ───
async function loadProfile() {
  try {
    const res = await API('/api/student/profile');
    if (!res.ok) { logout(); return; }
    studentData = await res.json();

    document.getElementById('sName').textContent = studentData.name;
    document.getElementById('sRollShow').textContent = studentData.rollNo + ' · ' + studentData.className;
    document.getElementById('heroSName').textContent = studentData.name;
    document.getElementById('heroSRole').textContent = studentData.rollNo + ' · ' + studentData.dept;
    document.getElementById('heroBatch').textContent = studentData.className;

    if (studentData.profilePic) {
      const img = document.getElementById('profileImg');
      img.src = '/uploads/' + studentData.profilePic;
      img.style.display = 'block';
    }

    const attRes = await API('/api/student/attendance');
    const attData = await attRes.json();
    const records = attData.records || [];
    const subjects = [...new Set(records.map(r => r.subject))];

    const attEl = document.getElementById('attOverview');
    attEl.innerHTML = '';

    if (!subjects.length) {
      attEl.innerHTML = `
        <p style="color:#94a3b8;font-size:12px;
        text-align:center;padding:10px">
        No attendance records yet</p>`;
    } else {
      subjects.forEach(sub => {
        const subRecs = records.filter(r => r.subject === sub);
        const present = subRecs.filter(r => r.status === 'present').length;
        const pct = Math.round((present / subRecs.length) * 100);
        const cls = pct >= 75 ? 'good' : pct >= 60 ? 'warn' : 'danger';
        const color = pct >= 75 ? '#059669' : pct >= 60 ? '#d97706' : '#e11d48';
        attEl.innerHTML += `
          <div class="att-row">
            <div class="att-lbl">${sub}</div>
            <div class="att-track">
              <div class="att-fill ${cls}" style="width:${pct}%"></div>
            </div>
            <div class="att-pct" style="color:${color}">${pct}%</div>
          </div>
          ${pct < 75
            ? `<div class="alert alert-warn">
               ⚠️ ${sub}: ${pct}% — below 75%!</div>`
            : ''}`;
      });
    }

    ['attSubjectStu', 'markSubjectStu', 'actSubjectStu'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) {
        sel.innerHTML = '<option value="">All Subjects</option>' +
          subjects.map(s => `<option value="${s}">${s}</option>`).join('');
      }
    });

  } catch (err) {
    console.error('Profile error:', err);
  }
}

// ─── SCANNER ───
async function startScanner() {
  const resultEl = document.getElementById('scanResult');
  if (scannerStarted) return;

  resultEl.innerHTML = `
    <div class="toast warning">
      <div class="toast-dot"></div>
      <div>
        <div class="toast-title">📷 Starting camera...</div>
        <div class="toast-sub">Please allow camera permission</div>
      </div>
    </div>`;

  try {
    const devices = await Html5Qrcode.getCameras();
    console.log('Cameras:', devices);

    if (!devices || devices.length === 0) {
      resultEl.innerHTML = `
        <div class="toast error">
          <div class="toast-dot"></div>
          <div>
            <div class="toast-title">❌ No camera found</div>
            <div class="toast-sub">Allow camera permission and reload</div>
          </div>
        </div>`;
      return;
    }

    // Pick back camera
    let cameraId = devices[devices.length - 1].id;
    for (const d of devices) {
      if (d.label && (
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      )) {
        cameraId = d.id;
        break;
      }
    }

    console.log('Using camera id:', cameraId);

    html5QrCode = new Html5Qrcode('qr-reader');

    await html5QrCode.start(
      cameraId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      () => {} // ignore per-frame errors
    );

    scannerStarted = true;
    resultEl.innerHTML = '';
    console.log('✅ Scanner started!');

  } catch (err) {
    console.error('Scanner error:', err);

    // Fallback — try with facingMode instead of deviceId
    try {
      html5QrCode = new Html5Qrcode('qr-reader');
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}
      );
      scannerStarted = true;
      resultEl.innerHTML = '';
      console.log('✅ Scanner started with facingMode fallback!');
    } catch (err2) {
      resultEl.innerHTML = `
        <div class="toast error">
          <div class="toast-dot"></div>
          <div>
            <div class="toast-title">❌ Camera Error</div>
            <div class="toast-sub">${err2.message || err2}</div>
          </div>
        </div>`;
    }
  }
}

async function stopScanner() {
  try {
    if (html5QrCode && scannerStarted) {
      await html5QrCode.stop();
      html5QrCode.clear();
      html5QrCode = null;
    }
  } catch (e) {
    console.log('Stop error (ignored):', e);
  }
  scannerStarted = false;
}

async function onScanSuccess(decodedText) {
  console.log('🎯 QR Detected:', decodedText);

  await stopScanner();

  const resultEl = document.getElementById('scanResult');
  resultEl.innerHTML = `
    <div class="toast warning">
      <div class="toast-dot"></div>
      <div>
        <div class="toast-title">⏳ Marking attendance...</div>
        <div class="toast-sub">Please wait</div>
      </div>
    </div>`;

  // Extract token
  let qrToken = decodedText.trim();
  try {
    const parsed = JSON.parse(decodedText);
    if (parsed && parsed.token) qrToken = parsed.token;
  } catch (e) {
    qrToken = decodedText.trim();
  }

  console.log('Token to send:', qrToken);

  try {
    const res = await fetch('/api/student/scan-qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ token: qrToken })
    });

    const data = await res.json();
    console.log('Response:', res.status, data);

    if (res.ok) {
      resultEl.innerHTML = `
        <div class="toast success">
          <div class="toast-dot"></div>
          <div>
            <div class="toast-title">✅ Attendance Marked!</div>
            <div class="toast-sub">
              📚 ${data.subject} · ${data.className}<br>
              🕐 ${data.time}
            </div>
          </div>
        </div>`;
      setTimeout(() => loadProfile(), 1000);

    } else {
      let cls = 'error';
      let icon = '❌';
      let hint = 'Please try again';

      if (data.message.includes('already')) {
        cls = 'warning'; icon = '⚠️'; hint = 'Already recorded today';
      } else if (data.message.includes('expired')) {
        icon = '⛔'; hint = 'Ask teacher to regenerate QR';
      } else if (data.message.includes('class') ||
                 data.message.includes('Wrong')) {
        icon = '🚫'; hint = 'Wrong class QR code';
      }

      resultEl.innerHTML = `
        <div class="toast ${cls}">
          <div class="toast-dot"></div>
          <div>
            <div class="toast-title">${icon} ${data.message}</div>
            <div class="toast-sub">${hint}</div>
          </div>
        </div>`;

      if (!data.message.includes('already')) {
        setTimeout(() => {
          scannerStarted = false;
          startScanner();
        }, 3000);
      }
    }

  } catch (err) {
    console.error('Fetch error:', err);
    resultEl.innerHTML = `
      <div class="toast error">
        <div class="toast-dot"></div>
        <div>
          <div class="toast-title">❌ Network Error</div>
          <div class="toast-sub">${err.message}</div>
        </div>
      </div>`;
    setTimeout(() => {
      scannerStarted = false;
      startScanner();
    }, 3000);
  }
}

// ─── ATTENDANCE HISTORY ───
async function loadStudentAttendance() {
  try {
    const subject = document.getElementById('attSubjectStu')?.value || '';
    const url = '/api/student/attendance' +
      (subject ? '?subject=' + subject : '');
    const data = await API(url).then(r => r.json());
    const records = data.records || [];
    const el = document.getElementById('studentAttTable');

    if (!records.length) {
      el.innerHTML = `<p style="color:#94a3b8;text-align:center;
        padding:20px">No attendance records yet</p>`;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;gap:8px;padding:8px 0 12px">
        <div class="stat-card green" style="flex:1">
          <div class="stat-num">${data.percentage}%</div>
          <div class="stat-lbl">Attendance</div>
        </div>
        <div class="stat-card cyan" style="flex:1">
          <div class="stat-num">${data.present}</div>
          <div class="stat-lbl">Present</div>
        </div>
        <div class="stat-card neutral" style="flex:1">
          <div class="stat-num">${data.total}</div>
          <div class="stat-lbl">Total</div>
        </div>
      </div>
      ${data.percentage < 75
        ? `<div class="alert alert-danger">
           ⚠️ Attendance ${data.percentage}% — below 75%!</div>`
        : ''}
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Subject</th><th>Date</th>
              <th>Time</th><th>Method</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => `
              <tr>
                <td>${r.subject}</td>
                <td>${r.date}</td>
                <td>${r.time}</td>
                <td><span class="badge badge-cyan">${r.method}</span></td>
                <td>
                  <span class="badge ${r.status === 'present'
                    ? 'badge-green' : 'badge-red'}">
                    ${r.status === 'present' ? '✅ Present' : '❌ Absent'}
                  </span>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    console.error('Attendance error:', err);
  }
}

// ─── MARKS ───
async function loadStudentMarks() {
  try {
    const subject = document.getElementById('markSubjectStu')?.value || '';
    const url = '/api/student/marks' +
      (subject ? '?subject=' + subject : '');
    const marks = await API(url).then(r => r.json());
    const el = document.getElementById('studentMarksTable');

    if (!marks.length) {
      el.innerHTML = `<p style="color:#94a3b8;text-align:center;
        padding:20px">No marks added yet</p>`;
      return;
    }

    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Subject</th><th>Exam</th><th>Max</th>
              <th>Scored</th><th>%</th><th>Grade</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${marks.map(m => `
              <tr>
                <td>${m.subject}</td>
                <td>${m.examType}</td>
                <td>${m.maxMarks}</td>
                <td>${m.scored}</td>
                <td>${Math.round(m.scored / m.maxMarks * 100)}%</td>
                <td><span class="grade-${m.grade?.charAt(0)}">
                  ${m.grade}</span></td>
                <td>${m.remarks || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    console.error('Marks error:', err);
  }
}

// ─── ACTIVITY ───
async function loadStudentActivity() {
  try {
    const subject = document.getElementById('actSubjectStu')?.value || '';
    const url = '/api/student/activities' +
      (subject ? '?subject=' + subject : '');
    const acts = await API(url).then(r => r.json());
    const el = document.getElementById('studentActivityList');

    if (!acts.length) {
      el.innerHTML = `<p style="color:#94a3b8;text-align:center;
        padding:20px">No activities posted yet</p>`;
      return;
    }

    el.innerHTML = acts.map(a => `
      <div class="act-card">
        <span class="act-tag">${a.subject} · ${a.className}</span>
        <div class="act-title">
          ${a.content.slice(0, 80)}${a.content.length > 80 ? '...' : ''}
        </div>
        <div class="act-body">${a.content}</div>
        <div class="act-foot">
          <span>👨‍🏫 ${a.teacherName}</span>
          <span>${new Date(a.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
      </div>`).join('');
  } catch (err) {
    console.error('Activity error:', err);
  }
}

// ─── UPLOAD PIC ───
async function uploadPic() {
  const file = document.getElementById('picInput').files[0];
  if (!file) return;
  const form = new FormData();
  form.append('pic', file);
  try {
    const res = await fetch('/api/student/profile-pic', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: form
    });
    const data = await res.json();
    if (res.ok) {
      const img = document.getElementById('profileImg');
      img.src = '/uploads/' + data.filename;
      img.style.display = 'block';
    }
  } catch (err) {
    console.error('Upload error:', err);
  }
}

loadProfile();