// Landing Page JavaScript

// Modal Functions
function showLoginModal() {
  document.getElementById('loginModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
  document.getElementById('loginModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

function showSignupModal() {
  document.getElementById('signupModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeSignupModal() {
  document.getElementById('signupModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

function switchToSignup() {
  closeLoginModal();
  showSignupModal();
}

function switchToLogin() {
  closeSignupModal();
  showLoginModal();
}

// Mobile Menu Toggle
function toggleMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  const toggle = document.querySelector('.mobile-menu-toggle');

  navLinks.classList.toggle('mobile-menu-open');
  toggle.classList.toggle('active');
}

// Enter App Function
function enterApp() {
  // Store guest mode in localStorage
  localStorage.setItem('userMode', 'guest');
  // Redirect to main app
  window.location.href = 'index.html';
}

// Dismiss Hero Function
function dismissHero() {
  const hero = document.querySelector('.hero');
  hero.style.display = 'none';
  // Scroll to features section
  const features = document.getElementById('features');
  if (features) {
    features.scrollIntoView({ behavior: 'smooth' });
  }
}

// Handle Login
function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!email || !password) {
    alert('Please fill in all fields');
    return;
  }

  // Simple validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Please enter a valid email address');
    return;
  }

  // Get all users
  const allUsers = JSON.parse(localStorage.getItem('allUsers')) || [];

  // Check if user exists
  const existingUser = allUsers.find(u => u.email === email);
  if (!existingUser) {
    alert('User not found. Please sign up first.');
    return;
  }

  // Store user data
  const userData = {
    email: email,
    name: existingUser.name,
    isLoggedIn: true,
    isPremium: existingUser.isPremium || false,
    loginTime: new Date().toISOString()
  };

  localStorage.setItem('userData', JSON.stringify(userData));
  localStorage.setItem('userMode', 'loggedIn');

  // Redirect to main app
  window.location.href = 'index.html';
}

// Handle Signup
function handleSignup() {
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value.trim();
  const confirmPassword = document.getElementById('signupConfirmPassword').value.trim();

  if (!email || !password || !confirmPassword) {
    alert('Please fill in all fields');
    return;
  }

  if (password !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }

  if (password.length < 6) {
    alert('Password must be at least 6 characters long');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Please enter a valid email address');
    return;
  }

  // Get all users
  const allUsers = JSON.parse(localStorage.getItem('allUsers')) || [];

  // Check if user already exists
  const existingUser = allUsers.find(u => u.email === email);
  if (existingUser) {
    alert('User already exists. Please login instead.');
    return;
  }

  // Create new user
  const newUser = {
    email: email,
    name: email.split('@')[0],
    isPremium: false,
    signupTime: new Date().toISOString()
  };

  // Add to all users
  allUsers.push(newUser);
  localStorage.setItem('allUsers', JSON.stringify(allUsers));

  // Store user data
  const userData = {
    email: email,
    name: newUser.name,
    isLoggedIn: true,
    isPremium: false,
    signupTime: new Date().toISOString()
  };

  localStorage.setItem('userData', JSON.stringify(userData));
  localStorage.setItem('userMode', 'loggedIn');

  // Redirect to main app
  window.location.href = 'index.html';
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Close modals when clicking outside
window.addEventListener('click', function(event) {
  const loginModal = document.getElementById('loginModal');
  const signupModal = document.getElementById('signupModal');

  if (event.target === loginModal) {
    closeLoginModal();
  }
  if (event.target === signupModal) {
    closeSignupModal();
  }
});

// Handle Enter key in forms
document.addEventListener('DOMContentLoaded', function() {
  // Login form
  document.getElementById('loginEmail').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('loginPassword').focus();
    }
  });

  document.getElementById('loginPassword').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });

  // Signup form
  document.getElementById('signupEmail').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('signupPassword').focus();
    }
  });

  document.getElementById('signupPassword').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('signupConfirmPassword').focus();
    }
  });

  document.getElementById('signupConfirmPassword').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleSignup();
    }
  });

  // Check if user is already logged in
  const userData = localStorage.getItem('userData');
  if (userData) {
    const user = JSON.parse(userData);
    if (user.isLoggedIn) {
      // User is already logged in, redirect to app
      window.location.href = 'index.html';
    }
  }
});