const token = localStorage.getItem('token');
if (!token || localStorage.getItem('role') !== 'teacher') window.location.href = 'index.html';
let teacherData = null;
let qrTimer = null;

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
  if (name === 'activity') loadActivities();
  if (name === 'attendance') {
    fillSelect('attSubject');
    fillSelect('manSubject');
  }
  if (name === 'marks') {
    fillSelect('mSubject');
    fillSelect('viewMSubject');
  }
  if (name === 'qr') fillSelect('qrSubject');
  if (name === 'activity') fillSelect('actSubject');
}

function fillSelect(id) {
  const sel = document.getElementById(id);
  if (!sel || !teacherData || !teacherData.subjects || !teacherData.subjects.length) return;
  sel.innerHTML = teacherData.subjects.map(s =>
    `<option value="${s.subjectName}|${s.className}">${s.subjectName} · ${s.className}</option>`
  ).join('');
}

function fillAllSelects() {
  ['qrSubject', 'attSubject', 'manSubject', 'mSubject', 'viewMSubject', 'actSubject'].forEach(fillSelect);
}

async function loadProfile() {
  try {
    const res = await API('/api/teacher/profile');
    if (!res.ok) { logout(); return; }
    teacherData = await res.json();

    // Set header
    document.getElementById('tName').textContent = teacherData.name;
    document.getElementById('tDeptShow').textContent = teacherData.dept + ' Department';

    // Set hero
    document.getElementById('heroName').textContent = teacherData.name;
    document.getElementById('heroRole').textContent = teacherData.dept + ' · Faculty';

    // Stats
    const subjects = teacherData.subjects || [];
    const classes = [...new Set(subjects.map(s => s.className))];
    document.getElementById('subCount').textContent = subjects.length;
    document.getElementById('clsCount').textContent = classes.length;

    // Profile pic
    if (teacherData.profilePic) {
      const img = document.getElementById('profileImg');
      img.src = '/uploads/' + teacherData.profilePic;
      img.style.display = 'block';
    }

    // Subject display chips
    const subjectDisplay = document.getElementById('subjectDisplay');
    if (subjectDisplay) {
      subjectDisplay.innerHTML = subjects.length
        ? subjects.map(s => `<span class="subject-display-item">📚 ${s.subjectName} · ${s.className}</span>`).join('')
        : '<p style="color:#94a3b8;font-size:12px">No subjects assigned</p>';
    }

    // Fill all dropdowns
    fillAllSelects();

    // Student count
    let total = 0;
    for (const cls of classes) {
      try {
        const r = await API(`/api/teacher/students?className=${cls}&dept=${teacherData.dept}`);
        const arr = await r.json();
        if (Array.isArray(arr)) total += arr.length;
      } catch (e) {}
    }
    document.getElementById('stuCount').textContent = total;

  } catch (err) {
    console.error('Profile load error:', err);
  }
}

async function generateQR() {
  const sel = document.getElementById('qrSubject');
  if (!sel || !sel.value) {
    alert('Please select a subject first');
    return;
  }
  const [subject, className] = sel.value.split('|');
  const dept = teacherData.dept;

  try {
    const res = await API('/api/teacher/generate-qr', {
      method: 'POST',
      body: JSON.stringify({ subject, className, dept })
    });
    const data = await res.json();

    document.getElementById('qrDisplay').style.display = 'block';
    document.getElementById('qrLabel').textContent = subject + ' · ' + className;
    document.getElementById('qrCode').innerHTML = '';

    new QRCode(document.getElementById('qrCode'), {
      text: data.token,
      width: 200,
      height: 200,
      colorDark: '#0c1a2e',
      colorLight: '#ffffff'
    });

    // Countdown timer
    if (qrTimer) clearInterval(qrTimer);
    let seconds = 30;
    const ring = document.getElementById('cdRing');
    const bar = document.getElementById('cdBar');
    const txt = document.getElementById('cdText');

    ring.textContent = seconds;
    bar.style.width = '100%';

    qrTimer = setInterval(() => {
      seconds--;
      ring.textContent = seconds;
      bar.style.width = (seconds / 30 * 100) + '%';
      txt.textContent = 'Expires in ' + seconds + ' seconds';
      if (seconds <= 0) {
        clearInterval(qrTimer);
        document.getElementById('qrCode').innerHTML =
          '<p style="color:#e11d48;font-weight:700;padding:20px;text-align:center">⛔ QR Expired<br>Click Regenerate</p>';
        txt.textContent = 'QR Expired';
        ring.textContent = '0';
        bar.style.width = '0%';
      }
    }, 1000);

  } catch (err) {
    alert('Error generating QR: ' + err.message);
  }
}

async function loadAttendance() {
  const sel = document.getElementById('attSubject');
  if (!sel || !sel.value) return;
  const [subject, className] = sel.value.split('|');

  try {
    const records = await API(`/api/teacher/attendance?subject=${subject}&className=${className}`).then(r => r.json());
    const el = document.getElementById('attendanceTable');

    if (!records.length) {
      el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px">No attendance records yet for this subject</p>';
      return;
    }

    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Roll No</th><th>Name</th><th>Date</th><th>Time</th><th>Method</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${records.map(r => `
              <tr>
                <td>${r.rollNo}</td>
                <td>${r.studentName}</td>
                <td>${r.date}</td>
                <td>${r.time}</td>
                <td><span class="badge badge-cyan">${r.method}</span></td>
                <td><span class="badge ${r.status === 'present' ? 'badge-green' : 'badge-red'}">${r.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    console.error('Load attendance error:', err);
  }
}

async function manualAttendance(status) {
  const rollNo = document.getElementById('manRoll').value.trim();
  const sel = document.getElementById('manSubject');
  const msg = document.getElementById('manMsg');

  if (!rollNo) {
    msg.textContent = '❌ Enter roll number';
    msg.className = 'msg err';
    return;
  }
  if (!sel || !sel.value) {
    msg.textContent = '❌ Select a subject';
    msg.className = 'msg err';
    return;
  }

  const [subject, className] = sel.value.split('|');
  const dept = teacherData.dept;

  try {
    const res = await API('/api/teacher/manual-attendance', {
      method: 'POST',
      body: JSON.stringify({ rollNo, subject, className, dept, status })
    });
    const data = await res.json();
    msg.textContent = res.ok ? '✅ ' + data.message : '❌ ' + data.message;
    msg.className = res.ok ? 'msg ok' : 'msg err';
    if (res.ok) {
      document.getElementById('manRoll').value = '';
      loadAttendance();
    }
  } catch (err) {
    msg.textContent = '❌ Server error';
    msg.className = 'msg err';
  }
}

async function addMarks() {
  const sel = document.getElementById('mSubject');
  const msg = document.getElementById('mMsg');

  if (!sel || !sel.value) {
    msg.textContent = '❌ Select a subject';
    msg.className = 'msg err';
    return;
  }

  const [subject, className] = sel.value.split('|');
  const rollNo = document.getElementById('mRoll').value.trim();
  const maxMarks = Number(document.getElementById('mMax').value);
  const scored = Number(document.getElementById('mScored').value);

  if (!rollNo || !maxMarks || scored === '') {
    msg.textContent = '❌ Fill all required fields';
    msg.className = 'msg err';
    return;
  }

  const body = {
    rollNo, subject, className,
    dept: teacherData.dept,
    examType: document.getElementById('mExamType').value,
    maxMarks, scored,
    remarks: document.getElementById('mRemarks').value
  };

  try {
    const res = await API('/api/teacher/marks', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = await res.json();
    msg.textContent = res.ok ? `✅ ${data.message} — Grade: ${data.grade || ''}` : '❌ ' + data.message;
    msg.className = res.ok ? 'msg ok' : 'msg err';
    if (res.ok) {
      document.getElementById('mRoll').value = '';
      document.getElementById('mMax').value = '';
      document.getElementById('mScored').value = '';
      document.getElementById('mRemarks').value = '';
    }
  } catch (err) {
    msg.textContent = '❌ Server error';
    msg.className = 'msg err';
  }
}

async function loadMarks() {
  const sel = document.getElementById('viewMSubject');
  if (!sel || !sel.value) return;
  const [subject, className] = sel.value.split('|');
  const examType = document.getElementById('viewMExam').value;

  try {
    const marks = await API(`/api/teacher/marks?subject=${subject}&className=${className}`).then(r => r.json());
    const filtered = marks.filter(m => m.examType === examType);
    const el = document.getElementById('marksTable');

    if (!filtered.length) {
      el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px">No marks found for this exam</p>';
      return;
    }

    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Roll No</th><th>Name</th><th>Max</th><th>Scored</th><th>%</th><th>Grade</th><th>Remarks</th></tr>
          </thead>
          <tbody>
            ${filtered.map(m => `
              <tr>
                <td>${m.rollNo}</td>
                <td>${m.studentName}</td>
                <td>${m.maxMarks}</td>
                <td>${m.scored}</td>
                <td>${Math.round(m.scored / m.maxMarks * 100)}%</td>
                <td><span class="badge grade-${m.grade?.charAt(0)}">${m.grade}</span></td>
                <td>${m.remarks || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    console.error('Load marks error:', err);
  }
}

async function postActivity() {
  const sel = document.getElementById('actSubject');
  const msg = document.getElementById('actMsg');

  if (!sel || !sel.value) {
    msg.textContent = '❌ Select a subject';
    msg.className = 'msg err';
    return;
  }

  const [subject, className] = sel.value.split('|');
  const content = document.getElementById('actContent').value.trim();

  if (!content) {
    msg.textContent = '❌ Type something to post';
    msg.className = 'msg err';
    return;
  }

  try {
    const res = await API('/api/teacher/activity', {
      method: 'POST',
      body: JSON.stringify({
        dept: teacherData.dept,
        className, subject, content
      })
    });
    const data = await res.json();
    msg.textContent = res.ok ? '✅ Posted successfully!' : '❌ ' + data.message;
    msg.className = res.ok ? 'msg ok' : 'msg err';
    if (res.ok) {
      document.getElementById('actContent').value = '';
      loadActivities();
    }
  } catch (err) {
    msg.textContent = '❌ Server error';
    msg.className = 'msg err';
  }
}

async function loadActivities() {
  if (!teacherData) return;
  const classes = [...new Set(teacherData.subjects.map(s => s.className))];
  const el = document.getElementById('activitiesList');
  el.innerHTML = '';

  try {
    for (const cls of classes) {
      const acts = await API('/api/teacher/activities?className=' + cls).then(r => r.json());
      if (Array.isArray(acts)) {
        acts.forEach(a => {
          el.innerHTML += `
            <div class="act-card">
              <span class="act-tag">${a.subject} · ${a.className}</span>
              <div class="act-title">${a.content.slice(0, 80)}${a.content.length > 80 ? '...' : ''}</div>
              <div class="act-body">${a.content}</div>
              <div class="act-foot">
                <span>👨‍🏫 ${a.teacherName}</span>
                <span>${new Date(a.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
            </div>`;
        });
      }
    }
    if (!el.innerHTML) {
      el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px">No activities posted yet</p>';
    }
  } catch (err) {
    console.error('Load activities error:', err);
  }
}

async function uploadPic() {
  const file = document.getElementById('picInput').files[0];
  if (!file) return;
  const form = new FormData();
  form.append('pic', file);
  try {
    const res = await fetch('/api/teacher/profile-pic', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: form
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('profileImg').src = '/uploads/' + data.filename;
      document.getElementById('profileImg').style.display = 'block';
    }
  } catch (err) {
    console.error('Upload error:', err);
  }
}

// Start
loadProfile();