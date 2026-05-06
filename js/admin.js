// Admin Dashboard JavaScript with Firebase Integration

import { firestoreDB } from './firebase.js';

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

// Load users from Firestore with localStorage fallback
async function loadUsers() {
  try {
    const users = await firestoreDB.getAllUsers();
    displayUsersFromFirebase(users);
  } catch (error) {
    console.warn('Firebase user load failed, using localStorage fallback:', error);
    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem('allUsers')) || [];
    displayUsersFromLocalStorage(users);
  }
}

// Display users from Firebase
function displayUsersFromFirebase(users) {
  const tbody = document.getElementById('usersTableBody');
  const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
  const filterType = document.getElementById('userFilter')?.value || 'all';

  // Filter users based on search and filter criteria
  let filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      (user.name || '').toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm);

    const matchesFilter = filterType === 'all' ||
      (filterType === 'premium' && user.isPremium) ||
      (filterType === 'free' && !user.isPremium);

    return matchesSearch && matchesFilter;
  });

  tbody.innerHTML = '';

  filteredUsers.forEach((user) => {
    const row = document.createElement('tr');

    const signupDate = user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'Unknown';

    row.innerHTML = `
      <td><input type="checkbox" class="user-checkbox" data-user-id="${user.id}"></td>
      <td>${user.name || 'Unknown'}</td>
      <td>${user.email}</td>
      <td>${signupDate}</td>
      <td>
        <label class="premium-toggle">
          <input type="checkbox" ${user.isPremium ? 'checked' : ''} onchange="togglePremium('${user.id}')">
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <button onclick="deleteUser('${user.id}')" style="background: #e53e3e; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// Display users from localStorage (fallback)
function displayUsersFromLocalStorage(users) {
  const tbody = document.getElementById('usersTableBody');
  const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
  const filterType = document.getElementById('userFilter')?.value || 'all';

  // Filter users based on search and filter criteria
  let filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      (user.name || '').toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm);

    const matchesFilter = filterType === 'all' ||
      (filterType === 'premium' && user.isPremium) ||
      (filterType === 'free' && !user.isPremium);

    return matchesSearch && matchesFilter;
  });

  tbody.innerHTML = '';

  filteredUsers.forEach((user, originalIndex) => {
    const row = document.createElement('tr');

    const signupDate = new Date(user.signupTime || user.loginTime).toLocaleDateString();

    row.innerHTML = `
      <td><input type="checkbox" class="user-checkbox" data-index="${originalIndex}"></td>
      <td>${user.name || 'Unknown'}</td>
      <td>${user.email}</td>
      <td>${signupDate}</td>
      <td>
        <label class="premium-toggle">
          <input type="checkbox" ${user.isPremium ? 'checked' : ''} onchange="togglePremium(${originalIndex})">
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <button onclick="deleteUser(${originalIndex})" style="background: #e53e3e; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// Update dashboard statistics with Firebase fallback
async function updateStats() {
  try {
    const users = await firestoreDB.getAllUsers();
    updateStatsDisplay(users);
  } catch (error) {
    console.warn('Firebase stats load failed, using localStorage fallback:', error);
    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem('allUsers')) || [];
    updateStatsDisplay(users);
  }
}

// Display stats from user data
function updateStatsDisplay(users) {
  const totalUsers = users.length;
  const premiumUsers = users.filter(u => u.isPremium).length;
  const freeUsers = totalUsers - premiumUsers;
  const conversionRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0;

  // Calculate new users today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newUsersToday = users.filter(u => {
    const signupDate = u.createdAt ? new Date(u.createdAt.toDate()) : new Date(u.signupTime || u.loginTime);
    signupDate.setHours(0, 0, 0, 0);
    return signupDate.getTime() === today.getTime();
  }).length;

  document.getElementById('totalUsers').textContent = totalUsers;
  document.getElementById('premiumUsers').textContent = premiumUsers;
  document.getElementById('freeUsers').textContent = freeUsers;
  document.getElementById('conversionRate').textContent = `${conversionRate}%`;
  document.getElementById('newUsersToday').textContent = newUsersToday;
  document.getElementById('avgSessionTime').textContent = '24m'; // Placeholder
}

// Toggle premium status with Firebase fallback
async function togglePremium(userId) {
  try {
    const userDoc = await firestoreDB.getUserData(userId);
    if (userDoc) {
      const newPremiumStatus = !userDoc.isPremium;
      await firestoreDB.updateUserPremiumStatus(userId, newPremiumStatus);
      updateStats();
      loadUsers();
      return;
    }
  } catch (error) {
    console.warn('Firebase premium toggle failed, using localStorage fallback:', error);
  }

  // Fallback to localStorage
  const users = JSON.parse(localStorage.getItem('allUsers')) || [];
  const userIndex = parseInt(userId);
  if (users[userIndex]) {
    users[userIndex].isPremium = !users[userIndex].isPremium;
    localStorage.setItem('allUsers', JSON.stringify(users));
    updateStats();
    loadUsers();
  }
}

// Delete user with Firebase fallback
async function deleteUser(userId) {
  if (confirm('Are you sure you want to delete this user?')) {
    try {
      await firestoreDB.deleteUser(userId);
      updateStats();
      loadUsers();
      return;
    } catch (error) {
      console.warn('Firebase user delete failed, using localStorage fallback:', error);
    }

    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem('allUsers')) || [];
    const userIndex = parseInt(userId);
    if (users[userIndex]) {
      users.splice(userIndex, 1);
      localStorage.setItem('allUsers', JSON.stringify(users));
      updateStats();
      loadUsers();
    }
  }
}

// Export users to CSV with Firebase fallback
async function exportUsers() {
  let users = [];
  try {
    users = await firestoreDB.getAllUsers();
  } catch (error) {
    console.warn('Firebase export failed, using localStorage fallback:', error);
    users = JSON.parse(localStorage.getItem('allUsers')) || [];
  }

  if (users.length === 0) {
    alert('No users to export');
    return;
  }

  // Create CSV content
  const csvHeaders = ['Name', 'Email', 'Signup Date', 'Premium Status'];
  const csvRows = users.map(user => [
    user.name || 'Unknown',
    user.email,
    user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : new Date(user.signupTime || user.loginTime).toLocaleDateString(),
    user.isPremium ? 'Premium' : 'Free'
  ]);

  const csvContent = [csvHeaders, ...csvRows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  // Create and download CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `vvinify_users_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

  if (users.length === 0) {
    alert('No users to export');
    return;
  }

  // Create CSV content
  const csvHeaders = ['Name', 'Email', 'Signup Date', 'Premium Status'];
  const csvRows = users.map(user => [
    user.name || 'Unknown',
    user.email,
    new Date(user.signupTime || user.loginTime).toLocaleDateString(),
    user.isPremium ? 'Premium' : 'Free'
  ]);

  const csvContent = [csvHeaders, ...csvRows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  // Create and download CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `vvinify_users_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Bulk actions with Firebase fallback
async function bulkAction(action) {
  const checkboxes = document.querySelectorAll('.user-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Please select users first');
    return;
  }

  const userIds = Array.from(checkboxes).map(cb => cb.dataset.userId || cb.dataset.index);

  if (action === 'delete' && !confirm(`Delete ${userIds.length} selected users?`)) {
    return;
  }

  try {
    if (action === 'makePremium') {
      await Promise.all(userIds.map(userId => firestoreDB.updateUserPremiumStatus(userId, true)));
    } else if (action === 'makeFree') {
      await Promise.all(userIds.map(userId => firestoreDB.updateUserPremiumStatus(userId, false)));
    } else if (action === 'delete') {
      await Promise.all(userIds.map(userId => firestoreDB.deleteUser(userId)));
    }
    updateStats();
    loadUsers();
    return;
  } catch (error) {
    console.warn('Firebase bulk action failed, using localStorage fallback:', error);
  }

  // Fallback to localStorage
  const users = JSON.parse(localStorage.getItem('allUsers')) || [];
  const userIndices = userIds.map(id => parseInt(id)).filter(idx => !isNaN(idx));

  userIndices.forEach(index => {
    if (action === 'makePremium') {
      users[index].isPremium = true;
    } else if (action === 'makeFree') {
      users[index].isPremium = false;
    } else if (action === 'delete') {
      users.splice(index, 1);
    }
  });

  localStorage.setItem('allUsers', JSON.stringify(users));
  updateStats();
  loadUsers();
}
  updateStats();
  loadUsers();
}

// Select all users
function selectAll() {
  const checkboxes = document.querySelectorAll('.user-checkbox');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const allChecked = selectAllCheckbox.checked;

  checkboxes.forEach(cb => cb.checked = !allChecked);
  selectAllCheckbox.checked = !allChecked;
}

// Toggle select all checkbox
function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const checkboxes = document.querySelectorAll('.user-checkbox');

  checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
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

  // Add search and filter event listeners
  const userSearch = document.getElementById('userSearch');
  const userFilter = document.getElementById('userFilter');

  if (userSearch) {
    userSearch.addEventListener('input', loadUsers);
  }

  if (userFilter) {
    userFilter.addEventListener('change', loadUsers);
  }
});