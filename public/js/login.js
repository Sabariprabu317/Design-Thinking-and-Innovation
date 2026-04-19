let currentRole = 'admin';

function switchRole(role) {
  currentRole = role;
  document.querySelectorAll('.rsw').forEach(b => b.classList.remove('active', 'active-green'));
  const btn = document.getElementById('rsw-' + role);
  btn.classList.add(role === 'student' ? 'active-green' : 'active');

  document.getElementById('adminFields').style.display = role === 'admin' ? 'block' : 'none';
  document.getElementById('teacherFields').style.display = role === 'teacher' ? 'block' : 'none';
  document.getElementById('studentFields').style.display = role === 'student' ? 'block' : 'none';

  const emojis = { admin: '🛡️', teacher: '👨‍🏫', student: '🎓' };
  const titles = { admin: 'Admin Portal', teacher: 'Teacher Portal', student: 'Student Portal' };
  const subs = { admin: 'Full system control', teacher: 'Classes · QR · Attendance', student: 'Scan QR · View Activity' };

  document.getElementById('roleEmoji').textContent = emojis[role];
  document.getElementById('roleTitle').textContent = titles[role];
  document.getElementById('roleSub').textContent = subs[role];

  const orb1 = document.querySelector('.orb1');
  if (role === 'student') orb1.style.background = '#059669';
  else orb1.style.background = '#0891b2';
}

async function doLogin() {
  const pass = document.getElementById('password').value;
  const msg = document.getElementById('loginMsg');
  msg.textContent = '';

  let url, body;
  if (currentRole === 'admin') {
    const username = document.getElementById('username').value;
    url = '/api/admin/login';
    body = { username, password: pass };
  } else if (currentRole === 'teacher') {
    const email = document.getElementById('teacherEmail').value;
    const dept = document.getElementById('teacherDept').value;
    url = '/api/teacher/login';
    body = { email, dept, password: pass };
  } else {
    const email = document.getElementById('studentEmail').value;
    url = '/api/student/login';
    body = { email, password: pass };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = '❌ ' + data.message;
      msg.className = 'msg err';
      return;
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    if (data.teacher) localStorage.setItem('user', JSON.stringify(data.teacher));
    if (data.student) localStorage.setItem('user', JSON.stringify(data.student));
    window.location.href = data.role + '.html';
  } catch (err) {
    msg.textContent = '❌ Server error';
    msg.className = 'msg err';
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });