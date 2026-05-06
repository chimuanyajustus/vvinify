// Admin Dashboard JavaScript

const ADMIN_PASSWORD = 'admin123'; // Simple admin password

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in as admin
  const isAdminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
  if (isAdminLoggedIn) {
    showAdminDashboard();
  }
});

// Admin login function
function adminLogin() {
  const password = document.getElementById('adminPassword').value;

  if (password === ADMIN_PASSWORD) {
    localStorage.setItem('adminLoggedIn', 'true');
    showAdminDashboard();
  } else {
    alert('Invalid admin password');
  }
}

// Admin logout function
function adminLogout() {
  localStorage.removeItem('adminLoggedIn');
  document.getElementById('adminDashboard').classList.add('hidden');
  document.getElementById('adminLogin').classList.remove('hidden');
  document.getElementById('adminPassword').value = '';
}

// Show admin dashboard
function showAdminDashboard() {
  document.getElementById('adminLogin').classList.add('hidden');
  document.getElementById('adminDashboard').classList.remove('hidden');
  loadUsers();
  updateStats();
}

// Load users from localStorage
function loadUsers() {
  const users = JSON.parse(localStorage.getItem('allUsers')) || [];
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';

  users.forEach((user, index) => {
    const row = document.createElement('tr');

    const signupDate = new Date(user.signupTime || user.loginTime).toLocaleDateString();

    row.innerHTML = `
      <td>${user.name || 'Unknown'}</td>
      <td>${user.email}</td>
      <td>${signupDate}</td>
      <td>
        <label class="premium-toggle">
          <input type="checkbox" ${user.isPremium ? 'checked' : ''} onchange="togglePremium(${index})">
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <button onclick="deleteUser(${index})" style="background: #e53e3e; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// Update dashboard statistics
function updateStats() {
  const users = JSON.parse(localStorage.getItem('allUsers')) || [];
  const totalUsers = users.length;
  const premiumUsers = users.filter(u => u.isPremium).length;
  const freeUsers = totalUsers - premiumUsers;
  const conversionRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0;

  document.getElementById('totalUsers').textContent = totalUsers;
  document.getElementById('premiumUsers').textContent = premiumUsers;
  document.getElementById('freeUsers').textContent = freeUsers;
  document.getElementById('conversionRate').textContent = `${conversionRate}%`;
}

// Toggle premium status for a user
function togglePremium(userIndex) {
  const users = JSON.parse(localStorage.getItem('allUsers')) || [];
  if (users[userIndex]) {
    users[userIndex].isPremium = !users[userIndex].isPremium;
    localStorage.setItem('allUsers', JSON.stringify(users));

    // Update current user if they're the one being modified
    const currentUserData = localStorage.getItem('userData');
    if (currentUserData) {
      const currentUser = JSON.parse(currentUserData);
      if (currentUser.email === users[userIndex].email) {
        currentUser.isPremium = users[userIndex].isPremium;
        localStorage.setItem('userData', JSON.stringify(currentUser));
      }
    }

    updateStats();
    loadUsers();
  }
}

// Delete a user
function deleteUser(userIndex) {
  if (confirm('Are you sure you want to delete this user?')) {
    const users = JSON.parse(localStorage.getItem('allUsers')) || [];
    users.splice(userIndex, 1);
    localStorage.setItem('allUsers', JSON.stringify(users));
    updateStats();
    loadUsers();
  }
}

// Handle Enter key in admin password field
document.addEventListener('DOMContentLoaded', () => {
  const adminPasswordInput = document.getElementById('adminPassword');
  if (adminPasswordInput) {
    adminPasswordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        adminLogin();
      }
    });
  }
});