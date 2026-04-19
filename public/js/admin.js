const token = localStorage.getItem('token');
if (!token || localStorage.getItem('role') !== 'admin') window.location.href = 'index.html';

const API = (url, opt = {}) => fetch(url, {
  ...opt,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    ...(opt.headers || {})
  }
});

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('btn-' + name)?.classList.add('active');
  document.getElementById('tab-' + name)?.classList.add('active');
  if (name === 'teachers') loadTeachers();
  if (name === 'students') loadStudents();
}

async function loadStats() {
  try {
    const [t, s] = await Promise.all([
      API('/api/admin/teachers').then(r => r.json()),
      API('/api/admin/students').then(r => r.json())
    ]);
    const teachers = Array.isArray(t) ? t : [];
    const students = Array.isArray(s) ? s : [];
    const depts = [...new Set([
      ...teachers.map(x => x.dept),
      ...students.map(x => x.dept)
    ].filter(Boolean))];

    const statsRow = document.getElementById('statsRow');
    if (statsRow) {
      statsRow.innerHTML = `
        <div class="stat-card cyan">
          <div class="stat-num">${teachers.length}</div>
          <div class="stat-lbl">Teachers</div>
        </div>
        <div class="stat-card green">
          <div class="stat-num">${students.length}</div>
          <div class="stat-lbl">Students</div>
        </div>
        <div class="stat-card neutral">
          <div class="stat-num">${depts.length}</div>
          <div class="stat-lbl">Depts</div>
        </div>
      `;
    }
  } catch (err) {
    console.log('Stats error:', err);
  }
}

async function loadTeachers() {
  try {
    const res = await API('/api/admin/teachers');
    const teachers = await res.json();
    const el = document.getElementById('teachersList');
    if (!Array.isArray(teachers) || !teachers.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-emoji">👨‍🏫</div>
          <div class="empty-title">No teachers added yet</div>
          <div class="empty-sub">Click ➕ Add Teacher tab to add one</div>
        </div>`;
      return;
    }
    el.innerHTML = teachers.map(t => `
      <div class="list-item">
        <div class="list-emoji">👨‍🏫</div>
        <div style="flex:1">
          <div class="list-name">${t.name}</div>
          <div class="list-sub">${t.dept} · ${t.email}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">
            ${(t.subjects || []).map(s =>
              `<span class="subject-chip">📚 ${s.subjectName} · ${s.className}</span>`
            ).join('')}
          </div>
        </div>
        <button onclick="deleteTeacher('${t._id}')" class="del-icon-btn">🗑️</button>
      </div>
    `).join('');
  } catch (err) {
    console.log('Load teachers error:', err);
  }
}

async function loadStudents() {
  try {
    const res = await API('/api/admin/students');
    const students = await res.json();
    const el = document.getElementById('studentsList');
    if (!Array.isArray(students) || !students.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-emoji">🎓</div>
          <div class="empty-title">No students added yet</div>
          <div class="empty-sub">Click ➕ Add Student tab to add one</div>
        </div>`;
      return;
    }
    el.innerHTML = students.map(s => `
      <div class="list-item">
        <div class="list-emoji green">🎓</div>
        <div style="flex:1">
          <div class="list-name">${s.name}</div>
          <div class="list-sub">Roll: ${s.rollNo} · ${s.dept} · ${s.className}</div>
          <div class="list-sub">${s.email}</div>
        </div>
        <button onclick="deleteStudent('${s._id}')" class="del-icon-btn">🗑️</button>
      </div>
    `).join('');
  } catch (err) {
    console.log('Load students error:', err);
  }
}

async function deleteTeacher(id) {
  if (!confirm('Delete this teacher? This cannot be undone.')) return;
  try {
    await API('/api/admin/teacher/' + id, { method: 'DELETE' });
    loadTeachers();
    loadStats();
  } catch (err) {
    alert('Error deleting teacher');
  }
}

async function deleteStudent(id) {
  if (!confirm('Delete this student? This cannot be undone.')) return;
  try {
    await API('/api/admin/student/' + id, { method: 'DELETE' });
    loadStudents();
    loadStats();
  } catch (err) {
    alert('Error deleting student');
  }
}

let subjectRows = [];

function addSubjectRow() {
  const id = Date.now();
  subjectRows.push(id);
  const container = document.getElementById('subjectList');
  const div = document.createElement('div');
  div.className = 'subject-row';
  div.id = 'sr-' + id;
  div.innerHTML = `
    <input type="text"
      id="sn-${id}"
      placeholder="Subject name (e.g. OS)"
      style="flex:1;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;font-family:inherit">
    <input type="text"
      id="cn-${id}"
      placeholder="Class (e.g. CSE-A)"
      style="flex:1;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;font-family:inherit">
    <button
      type="button"
      onclick="removeRow(${id})"
      style="background:#fff1f2;border:1.5px solid #fca5a5;color:#e11d48;font-size:14px;cursor:pointer;border-radius:8px;padding:8px 12px;font-weight:700;flex-shrink:0">
      ✕
    </button>
  `;
  container.appendChild(div);

  // Focus first input
  setTimeout(() => document.getElementById('sn-' + id)?.focus(), 50);
}

function removeRow(id) {
  const el = document.getElementById('sr-' + id);
  if (el) el.remove();
  subjectRows = subjectRows.filter(x => x !== id);
}

async function addTeacher() {
  const msg = document.getElementById('tMsg');
  msg.textContent = '';
  msg.className = 'msg';

  const name = document.getElementById('tName').value.trim();
  const email = document.getElementById('tEmail').value.trim();
  const password = document.getElementById('tPass').value;
  const dept = document.getElementById('tDept').value;

  // Collect subjects
  const subjects = [];
  for (const id of subjectRows) {
    const snEl = document.getElementById('sn-' + id);
    const cnEl = document.getElementById('cn-' + id);
    if (snEl && cnEl) {
      const subjectName = snEl.value.trim();
      const className = cnEl.value.trim();
      if (subjectName && className) {
        subjects.push({ subjectName, className });
      }
    }
  }

  // Validate
  if (!name) {
    msg.textContent = '❌ Enter teacher full name';
    msg.className = 'msg err';
    document.getElementById('tName').focus();
    return;
  }
  if (!email) {
    msg.textContent = '❌ Enter email address';
    msg.className = 'msg err';
    return;
  }
  if (!password) {
    msg.textContent = '❌ Set a password';
    msg.className = 'msg err';
    return;
  }
  if (!dept) {
    msg.textContent = '❌ Select department';
    msg.className = 'msg err';
    return;
  }
  if (subjects.length === 0) {
    msg.textContent = '❌ Add at least one subject and class using ➕ Add Subject & Class button';
    msg.className = 'msg err';
    return;
  }

  msg.textContent = '⏳ Saving...';
  msg.className = 'msg';

  try {
    const res = await API('/api/admin/add-teacher', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, dept, subjects })
    });
    const data = await res.json();

    if (res.ok) {
      msg.textContent = `✅ Teacher "${name}" added with ${subjects.length} subject(s)!`;
      msg.className = 'msg ok';
      // Clear form
      document.getElementById('tName').value = '';
      document.getElementById('tEmail').value = '';
      document.getElementById('tPass').value = '';
      document.getElementById('tDept').value = '';
      document.getElementById('subjectList').innerHTML = '';
      subjectRows = [];
      loadStats();
    } else {
      msg.textContent = '❌ ' + data.message;
      msg.className = 'msg err';
    }
  } catch (err) {
    msg.textContent = '❌ Server error: ' + err.message;
    msg.className = 'msg err';
  }
}

async function addStudent() {
  const msg = document.getElementById('sMsg');
  msg.textContent = '';
  msg.className = 'msg';

  const name = document.getElementById('sName').value.trim();
  const rollNo = document.getElementById('sRoll').value.trim();
  const email = document.getElementById('sEmail').value.trim();
  const dept = document.getElementById('sDept').value;
  const className = document.getElementById('sClass').value.trim();
  const password = document.getElementById('sPass').value;

  if (!name) { msg.textContent = '❌ Enter student name'; msg.className = 'msg err'; return; }
  if (!rollNo) { msg.textContent = '❌ Enter roll number'; msg.className = 'msg err'; return; }
  if (!email) { msg.textContent = '❌ Enter email'; msg.className = 'msg err'; return; }
  if (!dept) { msg.textContent = '❌ Select department'; msg.className = 'msg err'; return; }
  if (!className) { msg.textContent = '❌ Enter class section (e.g. CSE-A)'; msg.className = 'msg err'; return; }
  if (!password) { msg.textContent = '❌ Set a password'; msg.className = 'msg err'; return; }

  msg.textContent = '⏳ Saving...';
  msg.className = 'msg';

  try {
    const res = await API('/api/admin/add-student', {
      method: 'POST',
      body: JSON.stringify({ name, rollNo, email, dept, className, password })
    });
    const data = await res.json();

    if (res.ok) {
      msg.textContent = `✅ Student "${name}" added successfully!`;
      msg.className = 'msg ok';
      document.getElementById('sName').value = '';
      document.getElementById('sRoll').value = '';
      document.getElementById('sEmail').value = '';
      document.getElementById('sDept').value = '';
      document.getElementById('sClass').value = '';
      document.getElementById('sPass').value = '';
      loadStats();
    } else {
      msg.textContent = '❌ ' + data.message;
      msg.className = 'msg err';
    }
  } catch (err) {
    msg.textContent = '❌ Server error: ' + err.message;
    msg.className = 'msg err';
  }
}

// Init
loadStats();
loadTeachers();