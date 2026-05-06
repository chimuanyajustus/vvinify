// Vvinify Premium Music App with Audius API Integration and Firebase Backend

// Firebase imports and initialization with fallback
let firebaseAuth = null;
let firestoreDB = null;

try {
  // Try to import Firebase modules
  if (window.firebaseInitialized) {
    firebaseAuth = window.firebaseAuth;
    firestoreDB = {
      getUserData: async (userId) => {
        try {
          const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          const userDoc = await getDoc(doc(window.firebaseDb, 'users', userId));
          return userDoc.exists() ? userDoc.data() : null;
        } catch (error) {
          console.warn('Firestore getUserData failed:', error);
          return null;
        }
      },
      saveUserData: async (userId, data) => {
        try {
          const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          await setDoc(doc(window.firebaseDb, 'users', userId), data, { merge: true });
          return true;
        } catch (error) {
          console.warn('Firestore saveUserData failed:', error);
          return false;
        }
      },
      getUserPlaylists: async (userId) => {
        try {
          const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          const userDoc = await getDoc(doc(window.firebaseDb, 'users', userId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          return userData.playlists || [];
        } catch (error) {
          console.warn('Firestore getUserPlaylists failed:', error);
          return [];
        }
      },
      saveUserPlaylists: async (userId, playlists) => {
        try {
          const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          await updateDoc(doc(window.firebaseDb, 'users', userId), { playlists });
          return true;
        } catch (error) {
          console.warn('Firestore saveUserPlaylists failed:', error);
          return false;
        }
      },
      getUserSongs: async (userId) => {
        try {
          const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          const userDoc = await getDoc(doc(window.firebaseDb, 'users', userId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          return userData.songs || [];
        } catch (error) {
          console.warn('Firestore getUserSongs failed:', error);
          return [];
        }
      },
      saveUserSongs: async (userId, songs) => {
        try {
          const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          await updateDoc(doc(window.firebaseDb, 'users', userId), { songs });
          return true;
        } catch (error) {
          console.warn('Firestore saveUserSongs failed:', error);
          return false;
        }
      },
      getAllUsers: async () => {
        try {
          const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          const querySnapshot = await getDocs(collection(window.firebaseDb, 'users'));
          return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
          console.warn('Firestore getAllUsers failed:', error);
          return [];
        }
      },
      updateUserPremiumStatus: async (userId, isPremium) => {
        try {
          const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          await updateDoc(doc(window.firebaseDb, 'users', userId), { isPremium });
          return true;
        } catch (error) {
          console.warn('Firestore updateUserPremiumStatus failed:', error);
          return false;
        }
      },
      deleteUser: async (userId) => {
        try {
          const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          await deleteDoc(doc(window.firebaseDb, 'users', userId));
          return true;
        } catch (error) {
          console.warn('Firestore deleteUser failed:', error);
          return false;
        }
      }
    };
  }
} catch (error) {
  console.warn('Firebase import failed, using localStorage only mode:', error);
  firebaseAuth = null;
  firestoreDB = null;
}

// State Management
const appState = {
  isPlaying: false,
  currentSong: null,
  currentPlaylist: [],
  playlists: [],
  songs: [],
  recentlyPlayed: [],
  currentSection: 'home',
  user: { name: 'Guest', isPremium: false, skipsUsed: 0, likedSongs: [] },
  searchResults: [],
  isLoading: false,
  isRepeat: false,
  firebaseUser: null
};

const AUDIUS_API = 'https://api.audius.co/v1/tracks/search';
const MAX_SKIPS_FREE = 6; // 6 skips per hour for free users
const SEARCH_TIMEOUT = 10000; // 10 second timeout

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // Check if Firebase is available
  if (firebaseAuth && window.firebaseInitialized) {
    // Firebase is available - use Firebase auth
    firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        // User is signed in with Firebase
        appState.firebaseUser = user;
        appState.user = {
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          isPremium: false, // Will be loaded from Firestore
          skipsUsed: 0,
          likedSongs: []
        };

        // Load user data from Firestore with fallback
        const firebaseLoaded = await loadUserDataFromFirestore(user.uid);
        if (!firebaseLoaded) {
          // Load from localStorage as fallback
          const localUserData = JSON.parse(localStorage.getItem('userData')) || {};
          appState.user = { ...appState.user, ...localUserData };
        }

        // Load user playlists and songs with fallbacks
        await loadUserPlaylistsFromFirestore(user.uid);
        await loadUserSongsFromFirestore(user.uid);

        // Load recently played from localStorage
        appState.recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed')) || [];

        updateUserDisplay();
        updateAdVisibility();
      } else {
        // No Firebase user - check for localStorage user (legacy support)
        const localUserData = localStorage.getItem('userData');
        const userMode = localStorage.getItem('userMode');

        if (localUserData && userMode === 'loggedIn') {
          // Use localStorage user data
          const user = JSON.parse(localUserData);
          appState.user = {
            name: user.name || 'Guest',
            email: user.email || '',
            isPremium: user.isPremium || false,
            skipsUsed: user.skipsUsed || 0,
            likedSongs: user.likedSongs || []
          };

          // Load playlists and songs from localStorage
          appState.playlists = JSON.parse(localStorage.getItem('playlists')) || [];
          appState.songs = JSON.parse(localStorage.getItem('songs')) || [];

          updateUserDisplay();
          updateAdVisibility();
        } else {
          // No user data found - redirect to landing page
          window.location.href = 'landing.html';
          return;
        }
      }

      // Continue with app initialization
      initializeApp();
      loadSongs();
      updateUserDisplay();
      updateAdVisibility();

      // Check for shared song
      const urlParams = new URLSearchParams(window.location.search);
      const sharedSongId = urlParams.get('song');
      if (sharedSongId) {
        loadSharedSong(sharedSongId);
      }
    });
  } else {
    // Firebase not available - use localStorage only mode
    console.log('Firebase not available, using localStorage-only mode');

    const localUserData = localStorage.getItem('userData');
    const userMode = localStorage.getItem('userMode');

    if (localUserData && userMode === 'loggedIn') {
      console.log('Loading from localStorage');
      // Use localStorage user data
      const user = JSON.parse(localUserData);
      appState.user = {
        name: user.name || 'Guest',
        email: user.email || '',
        isPremium: user.isPremium || false,
        skipsUsed: user.skipsUsed || 0,
        likedSongs: user.likedSongs || []
      };

      // Load playlists and songs from localStorage
      appState.playlists = JSON.parse(localStorage.getItem('playlists')) || [];
      appState.songs = JSON.parse(localStorage.getItem('songs')) || [];
      appState.recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed')) || [];
      console.log('Loaded recentlyPlayed:', appState.recentlyPlayed);

      initializeApp();
      loadSongs();
      updateUserDisplay();
      updateAdVisibility();
    } else {
      // No user data - redirect to landing page
      window.location.href = 'landing.html';
      return;
    }

    // Check for shared song
    const urlParams = new URLSearchParams(window.location.search);
    const sharedSongId = urlParams.get('song');
    if (sharedSongId) {
      loadSharedSong(sharedSongId);
    }
  }
});

// Firebase Firestore Functions with localStorage fallback
async function loadUserDataFromFirestore(userId) {
  try {
    const userDoc = await firestoreDB.getUserData(userId);
    if (userDoc) {
      appState.user = {
        ...appState.user,
        ...userDoc,
        likedSongs: userDoc.likedSongs || [],
        skipsUsed: userDoc.skipsUsed || 0
      };
      return true;
    }
  } catch (error) {
    console.warn('Firebase user data load failed, using localStorage fallback:', error);
  }
  return false;
}

async function saveUserDataToFirestore() {
  if (!appState.firebaseUser) return false;

  try {
    await firestoreDB.saveUserData(appState.firebaseUser.uid, {
      name: appState.user.name,
      email: appState.user.email,
      isPremium: appState.user.isPremium,
      likedSongs: appState.user.likedSongs,
      skipsUsed: appState.user.skipsUsed,
      lastLogin: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.warn('Firebase user data save failed, using localStorage fallback:', error);
    // Fallback to localStorage
    localStorage.setItem('userData', JSON.stringify(appState.user));
    return false;
  }
}

async function loadUserPlaylistsFromFirestore(userId) {
  try {
    const playlists = await firestoreDB.getUserPlaylists(userId);
    appState.playlists = playlists || [];
    return true;
  } catch (error) {
    console.warn('Firebase playlists load failed, using localStorage fallback:', error);
    // Fallback to localStorage
    appState.playlists = JSON.parse(localStorage.getItem('playlists')) || [];
    return false;
  }
}

async function saveUserPlaylistsToFirestore() {
  if (!appState.firebaseUser) return false;

  try {
    await firestoreDB.saveUserPlaylists(appState.firebaseUser.uid, appState.playlists);
    return true;
  } catch (error) {
    console.warn('Firebase playlists save failed, using localStorage fallback:', error);
    // Fallback to localStorage
    localStorage.setItem('playlists', JSON.stringify(appState.playlists));
    return false;
  }
}

async function loadUserSongsFromFirestore(userId) {
  try {
    const songs = await firestoreDB.getUserSongs(userId);
    appState.songs = songs || [];
    return true;
  } catch (error) {
    console.warn('Firebase songs load failed, using localStorage fallback:', error);
    // Fallback to localStorage
    appState.songs = JSON.parse(localStorage.getItem('songs')) || [];
    return false;
  }
}

async function saveUserSongsToFirestore() {
  if (!appState.firebaseUser) return false;

  try {
    await firestoreDB.saveUserSongs(appState.firebaseUser.uid, appState.songs);
    return true;
  } catch (error) {
    console.warn('Firebase songs save failed, using localStorage fallback:', error);
    // Fallback to localStorage
    localStorage.setItem('songs', JSON.stringify(appState.songs));
    return false;
  }
}

// Initialize App UI and Event Listeners
function initializeApp() {
  console.log('initializeApp called');
  setupEventListeners();
  updateUI();
  loadSongs();
}

// Event Listeners Setup
function setupEventListeners() {
  const playBtn = document.getElementById('play');
  playBtn.addEventListener('click', togglePlay);

  const navLinks = document.querySelectorAll('.sidebar nav a');
  navLinks.forEach((link, index) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link, index);
    });
  });

  // Mobile navigation
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
  mobileNavItems.forEach((item, index) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      handleMobileNav(section);
    });
  });

  document.querySelector('.create-playlist').addEventListener('click', createPlaylist);
  document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchMusic();
  });

  const progressBar = document.getElementById('progressBar');
  progressBar.addEventListener('change', seekSong);

  const volumeControl = document.getElementById('volumeControl');
  volumeControl.addEventListener('change', (e) => {
    const audio = document.getElementById('audioPlayer');
    audio.volume = e.target.value / 100;
  });

  const hamburgerBtn = document.querySelector('.hamburger-btn');
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', toggleSidebar);
  }

  window.addEventListener('resize', updateSidebarMode);
  updateSidebarMode();

  const audio = document.getElementById('audioPlayer');
  audio.addEventListener('timeupdate', updateProgressBar);
  audio.addEventListener('loadedmetadata', updateDuration);
  audio.addEventListener('play', () => {
    appState.isPlaying = true;
    updatePlayButton();
  });
  audio.addEventListener('pause', () => {
    appState.isPlaying = false;
    updatePlayButton();
  });
  audio.addEventListener('ended', () => {
    appState.isPlaying = false;
    updatePlayButton();
    // Auto-play next song
    nextSong();
  });
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  sidebar.classList.toggle('open');
  sidebar.classList.toggle('collapsed');
}

function updateSidebarMode() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  if (window.innerWidth < 768) {
    sidebar.classList.add('collapsed');
    sidebar.classList.remove('open');
  } else {
    sidebar.classList.remove('collapsed', 'open');
  }
}

// Audius API Search with Error Handling & Loading State
async function searchMusic() {
  const query = document.getElementById('searchInput').value.trim();

  if (!query) {
    displaySongs(appState.songs);
    return;
  }

  // Show loading state
  showLoading(true);
  closeError();

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);

    // Audius hosts for fallback
    const hosts = [
      'https://discoveryprovider.audius.co/v1',
      'https://discoveryprovider2.audius.co/v1',
      'https://discoveryprovider3.audius.co/v1'
    ];

    // Try Jamendo API as primary source
    let response;
    let data;

    try {
      response = await fetch(
        `https://api.jamendo.com/v3.0/tracks/?client_id=5a64e0c8&format=json&limit=20&search=${encodeURIComponent(query)}&include=musicinfo&groupby=artist_id`,
        {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (response.ok) {
        data = await response.json();
      }
    } catch (e) {
      console.log('Jamendo API error:', e);
    }

    // Fallback to Audius if Jamendo fails
    if (!data || !data.results || data.results.length === 0) {
      for (const host of hosts) {
        try {
          response = await fetch(
            `${host}/tracks/search?query=${encodeURIComponent(query)}&limit=20&app_name=Vvinify`,
            {
              signal: controller.signal,
              headers: {
                'Accept': 'application/json'
              }
            }
          );

          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      throw new Error(`API Error: ${response?.status || 'Unknown'} ${response?.statusText || 'Error'}`);
    }

    if (!data || ((!data.results || data.results.length === 0) && (!data.data && !data.tracks))) {
      showLoading(false);
      showError('No songs found. Try a different search!');
      displaySongs([]);
      return;
    }

    // Handle different response formats
    let tracks = [];

    if (data.results) {
      // Jamendo format
      tracks = data.results;
    } else {
      // Audius format
      tracks = data.data || data.tracks || [];
    }

    if (tracks.length === 0) {
      showLoading(false);
      showError('No songs found. Try a different search!');
      displaySongs([]);
      return;
    }

    // Transform data to our format
    const songs = tracks.map(track => {
      if (track.artist_name) {
        // Jamendo format
        return {
          id: track.id,
          name: track.name || 'Unknown Track',
          artist: track.artist_name || 'Unknown Artist',
          cover: track.image || track.album_image || 'https://picsum.photos/200?default',
          previewUrl: track.audio || null,
          streamUrl: track.audio || `https://api.jamendo.com/v3.0/tracks/file?client_id=5a64e0c8&id=${track.id}`,
          duration: track.duration,
          genre: track.genre || track.musicinfo?.genre,
          releaseDate: track.releasedate,
          source: 'jamendo'
        };
      } else {
        // Audius format
        return {
          id: track.id,
          name: track.title || track.name || 'Unknown Track',
          artist: track.user?.name || track.artist || 'Unknown Artist',
          cover: track.artwork?.['1000x1000'] || track.artwork?.['480x480'] || track.artwork?.large_url || track.artwork?.medium_url || 'https://picsum.photos/200?default',
          previewUrl: track.download?.url || null,
          streamUrl: track.stream_url || track.audio_url || `https://discoveryprovider.audius.co/v1/tracks/${track.id}/stream`,
          duration: track.duration,
          genre: track.genre,
          releaseDate: track.release_date,
          source: 'audius'
        };
      }
    });

    appState.searchResults = songs;
    displaySongs(songs);
    document.getElementById('sectionTitle').textContent = `Search Results: ${query} (${songs.length})`;
    showLoading(false);

  } catch (error) {
    showLoading(false);

    if (error.name === 'AbortError') {
      showError('⏱️ Search took too long. Please try again.');
    } else if (error instanceof TypeError) {
      showError('🌐 Network error. Check your internet connection.');
    } else {
      showError(`❌ ${error.message || 'Failed to search music. Please try again.'}`);
    }

    console.error('Search error:', error);
    // Fallback to default songs
    displaySongs(appState.songs);
    document.getElementById('sectionTitle').textContent = 'Recently Played (Search failed - showing defaults)';
  }
}

// Show/Hide Loading State
function showLoading(show) {
  appState.isLoading = show;
  const loadingEl = document.getElementById('loadingState');
  if (show) {
    loadingEl.style.display = 'flex';
  } else {
    loadingEl.style.display = 'none';
  }
}

// Show Error Message
function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  errorText.textContent = message;
  errorEl.style.display = 'flex';
  
  // Auto-hide after 6 seconds
  setTimeout(() => {
    if (errorEl.style.display !== 'none') {
      closeError();
    }
  }, 6000);
}

// Close Error Message
function closeError() {
  const errorEl = document.getElementById('errorMessage');
  errorEl.style.display = 'none';
}

// Play/Pause with Skip Limit & Error Handling
function togglePlay() {
  const playBtn = document.getElementById('play');

  if (!appState.currentSong) {
    if (appState.songs.length > 0) {
      playSong(0);
    } else if (appState.searchResults.length > 0) {
      playSong(0);
    } else {
      showError('No songs available. Search or upload music!');
      return;
    }
  }

  appState.isPlaying = !appState.isPlaying;
  const audio = document.getElementById('audioPlayer');

  if (appState.isPlaying) {
    if (appState.currentSong.streamUrl) {
      // Try to play the stream URL with CORS handling
      audio.crossOrigin = 'anonymous';
      audio.src = appState.currentSong.streamUrl;
      audio.play().catch(e => {
        console.log('Stream error:', e);
        // Fallback to preview if available
        if (appState.currentSong.previewUrl) {
          audio.src = appState.currentSong.previewUrl;
          audio.play().catch(e2 => {
            console.log('Preview error:', e2);
            showError('⚠️ This track is not available for streaming.');
            appState.isPlaying = false;
            updatePlayButton();
          });
        } else {
          showError('⚠️ This track is not available for streaming.');
          appState.isPlaying = false;
          updatePlayButton();
        }
      });
    } else if (appState.currentSong.previewUrl) {
      audio.crossOrigin = 'anonymous';
      audio.src = appState.currentSong.previewUrl;
      audio.play().catch(e => {
        console.log('Preview error:', e);
        showError('⚠️ Preview unavailable for this track.');
        appState.isPlaying = false;
        updatePlayButton();
      });
    } else if (appState.currentSong.file) {
      try {
        audio.src = URL.createObjectURL(new Blob([appState.currentSong.file]));
        audio.play();
      } catch (e) {
        showError('❌ Cannot play uploaded file.');
        console.log('File playback error:', e);
        appState.isPlaying = false;
        updatePlayButton();
      }
    } else {
      showError('⚠️ No playable audio available for this track.');
      appState.isPlaying = false;
      updatePlayButton();
    }
  } else {
    audio.pause();
  }

  updatePlayButton();
}

// Update Recently Played List
function updateRecentlyPlayed(song) {
  if (!song) return;

  // Ensure recentlyPlayed is an array
  if (!appState.recentlyPlayed) {
    appState.recentlyPlayed = [];
  }

  // Remove if already exists
  appState.recentlyPlayed = appState.recentlyPlayed.filter(s => s.id !== song.id);

  // Add to beginning
  appState.recentlyPlayed.unshift(song);

  // Keep only last 10
  if (appState.recentlyPlayed.length > 10) {
    appState.recentlyPlayed = appState.recentlyPlayed.slice(0, 10);
  }

  // Save to localStorage
  localStorage.setItem('recentlyPlayed', JSON.stringify(appState.recentlyPlayed));

  // Update UI
  updateRecentlyPlayedUI();
}

// Update Recently Played UI
function updateRecentlyPlayedUI() {
  const recentlyPlayedContainer = document.querySelector('.recently-played .song-grid');
  if (!recentlyPlayedContainer) return;

  recentlyPlayedContainer.innerHTML = '';

  appState.recentlyPlayed.forEach(song => {
    const songElement = createSongElement(song);
    recentlyPlayedContainer.appendChild(songElement);
  });
}

// Song Playback with Error Handling
function playSong(index) {
  const songs = appState.searchResults.length > 0 ? appState.searchResults : appState.songs;
  if (songs.length === 0) {
    showError('No songs to play');
    return;
  }
  
  appState.currentSong = songs[index];
  appState.isPlaying = true;
  
  // Update recently played
  updateRecentlyPlayed(appState.currentSong);
  
  const audio = document.getElementById('audioPlayer');
  
  try {
    if (appState.currentSong.streamUrl) {
      audio.src = appState.currentSong.streamUrl;
      audio.play().catch(e => {
        console.log('Stream error:', e);
        showError('⚠️ Stream unavailable for this track.');
      });
    } else if (appState.currentSong.previewUrl) {
      audio.src = appState.currentSong.previewUrl;
      audio.play().catch(e => {
        console.log('Preview error:', e);
        showError('⚠️ Preview unavailable.');
      });
    } else if (appState.currentSong.file) {
      audio.src = URL.createObjectURL(new Blob([appState.currentSong.file]));
      audio.play();
    } else {
      showError('⚠️ This track cannot be played.');
      appState.isPlaying = false;
    }
  } catch (e) {
    showError('❌ Error playing track.');
    console.error('Playback error:', e);
    appState.isPlaying = false;
  }
  
  updatePlayButton();
  updateSongInfo();
}

function seekSong(e) {
  const audio = document.getElementById('audioPlayer');
  const duration = audio.duration;
  audio.currentTime = (e.target.value / 100) * duration;
}

function updateProgressBar() {
  const audio = document.getElementById('audioPlayer');
  const duration = audio.duration;
  
  if (duration) {
    const progress = (audio.currentTime / duration) * 100;
    document.getElementById('progressBar').value = progress;
    document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
  }
}

function updateDuration() {
  const audio = document.getElementById('audioPlayer');
  document.getElementById('duration').textContent = formatTime(audio.duration);
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateSongInfo() {
  if (!appState.currentSong) return;
  
  document.getElementById('playerSongName').textContent = appState.currentSong.name;
  document.getElementById('playerArtist').textContent = appState.currentSong.artist || 'Unknown Artist';
  document.getElementById('playerImg').src = appState.currentSong.cover;
}

function openAdminPanel() {
  document.getElementById('adminModal').style.display = 'flex';
  document.getElementById('adminLoginSection').style.display = 'block';
  document.getElementById('adminDashboardSection').style.display = 'none';
}

function closeAdminModal() {
  document.getElementById('adminModal').style.display = 'none';
}

function handleAdminLogin() {
  const password = document.getElementById('adminPasswordInput').value;
  if (password === 'admin123') { // Simple admin password
    document.getElementById('adminLoginSection').style.display = 'none';
    document.getElementById('adminDashboardSection').style.display = 'block';
    loadAdminStats();
  } else {
    alert('Invalid admin password');
  }
}

function loadAdminStats() {
  const users = JSON.parse(localStorage.getItem('allUsers')) || [];
  const totalUsers = users.length;
  const premiumUsers = users.filter(u => u.isPremium).length;
  
  document.getElementById('adminTotalUsers').textContent = totalUsers;
  document.getElementById('adminPremiumUsers').textContent = premiumUsers;
}

function exportUsers() {
  const users = JSON.parse(localStorage.getItem('allUsers')) || [];
  
  if (users.length === 0) {
    alert('No users to export');
    return;
  }

  const csvContent = [
    ['Name', 'Email', 'Premium', 'Signup Date'],
    ...users.map(user => [
      user.name || 'Unknown',
      user.email,
      user.isPremium ? 'Yes' : 'No',
      new Date(user.signupTime || user.loginTime).toLocaleDateString()
    ])
  ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

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

function updatePlayButton() {
  const playBtn = document.getElementById('play');
  playBtn.textContent = appState.isPlaying ? '⏸' : '▶';
  
  const repeatBtn = document.getElementById('repeatBtn');
  if (repeatBtn) {
    repeatBtn.textContent = appState.isRepeat ? '🔁' : '🔄';
    repeatBtn.style.opacity = appState.isRepeat ? '1' : '0.5';
  }
}

function toggleRepeat() {
  appState.isRepeat = !appState.isRepeat;
  const audio = document.getElementById('audioPlayer');
  audio.loop = appState.isRepeat;
  updatePlayButton();
}

function shareSong() {
  if (!appState.currentSong) {
    showError('No song to share');
    return;
  }
  
  const shareUrl = `${window.location.origin}${window.location.pathname}?song=${encodeURIComponent(appState.currentSong.id)}`;
  
  if (navigator.share) {
    navigator.share({
      title: appState.currentSong.name,
      text: `Check out "${appState.currentSong.name}" by ${appState.currentSong.artist}`,
      url: shareUrl
    });
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      showError('Share link copied to clipboard!');
    }).catch(() => {
      showError('Share link: ' + shareUrl);
    });
  }
}

function loadSharedSong(songId) {
  // First check if song exists in our library
  let song = appState.songs.find(s => s.id === songId);
  
  if (song) {
    // Find index and play
    const index = appState.songs.findIndex(s => s.id === songId);
    playSong(index);
    return;
  }
  
  // If not found, try to search for it
  fetch(`${AUDIUS_API}?query=${encodeURIComponent(songId)}&limit=1`)
    .then(response => response.json())
    .then(data => {
      if (data.data && data.data.length > 0) {
        const track = data.data[0];
        song = {
          id: track.id,
          name: track.title,
          artist: track.user.name,
          cover: track.artwork['150x150'] || track.artwork['1000x1000'] || 'https://picsum.photos/200',
          streamUrl: track.streamUrl,
          previewUrl: track.previewUrl
        };
        appState.songs.unshift(song); // Add to beginning
        playSong(0);
      } else {
        showError('Shared song not found');
      }
    })
    .catch(error => {
      console.error('Error loading shared song:', error);
      showError('Could not load shared song');
    });
}

// Premium Skip Control with Error Handling
function nextSong() {
  if (appState.songs.length === 0 && appState.searchResults.length === 0) {
    showError('No songs available');
    return;
  }
  
  // Check skip limit for free users
  if (!appState.user.isPremium && appState.user.skipsUsed >= MAX_SKIPS_FREE) {
    showError(`⏸ Free users have ${MAX_SKIPS_FREE} skips/hour. Upgrade to Premium for unlimited skips!`);
    return;
  }

  const songs = appState.searchResults.length > 0 ? appState.searchResults : appState.songs;
  const currentIndex = songs.indexOf(appState.currentSong);
  const nextIndex = (currentIndex + 1) % songs.length;
  
  if (!appState.user.isPremium) {
    appState.user.skipsUsed++;
    saveUserData();
  }
  
  playSong(nextIndex);
}

function previousSong() {
  const songs = appState.searchResults.length > 0 ? appState.searchResults : appState.songs;
  if (songs.length === 0) {
    showError('No songs available');
    return;
  }
  
  const currentIndex = songs.indexOf(appState.currentSong);
  const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
  playSong(prevIndex);
}

// Navigation
function navigateTo(link, index) {
  const sections = ['home', 'discover', 'library', 'playlists', 'liked'];
  appState.currentSection = sections[index];
  appState.searchResults = [];
  
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach((button, idx) => button.classList.toggle('active', idx === index));
  link.classList.add('active');
  
  updateMainContent();
}

function handleMobileNav(section) {
  const sectionMapping = {
    home: 0,
    search: 1,
    library: 2,
    premium: 'premium',
    create: 'create'
  };

  const index = sectionMapping[section];
  
  if (index === 'premium') {
    openPremiumModal();
    return;
  }
  
  if (index === 'create') {
    createPlaylist();
    return;
  }

  const link = document.querySelector(`.sidebar nav a:nth-child(${index + 1})`);
  if (link) {
    navigateTo(link, index);
  }
}

function updateMainContent() {
  const title = document.getElementById('sectionTitle');
  
  switch(appState.currentSection) {
    case 'home':
      title.textContent = 'Recently Played';
      const recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed')) || [];
      if (recentlyPlayed.length > 0) {
        // Convert recently played to song format and display
        const recentSongs = recentlyPlayed.map(item => ({
          id: item.id,
          name: item.name,
          artist: item.artist,
          cover: item.cover
        }));
        displaySongs(recentSongs);
      } else {
        displaySongs(appState.songs.slice(0, 10)); // Fallback to first 10 songs
      }
      break;
    case 'discover':
      title.textContent = 'Discover';
      displaySongs(appState.songs.slice(0, 10));
      break;
    case 'library':
      title.textContent = 'Your Library';
      displaySongs(appState.songs);
      break;
    case 'playlists':
      title.textContent = 'Your Playlists';
      displayPlaylists();
      break;
    case 'liked':
      title.textContent = 'Liked Songs';
      displaySongs(appState.songs.filter(s => (appState.user.likedSongs || []).includes(s.id)));
      break;
  }
  updateMobileNavState();
}

function updateMobileNavState() {
  const mapping = { home: 0, discover: 1, library: 2, playlists: 3, liked: 4 };
  const activeIndex = mapping[appState.currentSection] ?? 0;
  document.querySelectorAll('.mobile-nav-item').forEach((button, idx) => {
    button.classList.toggle('active', idx === activeIndex);
  });
}

// Display Songs
function displaySongs(songs) {
  const cardsContainer = document.getElementById('cardsContainer');
  
  if (songs.length === 0) {
    cardsContainer.innerHTML = '<p style="color: #aaa; padding: 20px;">No songs found. Try searching!</p>';
    return;
  }
  
  cardsContainer.innerHTML = songs.map((song, index) => `
    <div class="card" onclick="playSong(${index})">
      <img src="${song.cover}" alt="${song.name}" onerror="this.src='https://picsum.photos/200?default'">
      <button class="like-btn ${(appState.user.likedSongs || []).includes(song.id) ? 'liked' : ''}" onclick="toggleLike(event, ${JSON.stringify(song.id)})">♥</button>
      <div class="card-meta">
        <p>${song.name}</p>
        <span class="artist">${song.artist}</span>
      </div>
      <div class="card-tags">
        <span>${song.genre || 'Smart Mix'}</span>
        <span>${song.releaseDate || 'Live'}</span>
      </div>
    </div>
  `).join('');
}

function toggleLike(event, songId) {
  event.stopPropagation();
  const likedSongs = appState.user.likedSongs || [];
  const index = likedSongs.indexOf(songId);
  
  if (index > -1) {
    likedSongs.splice(index, 1);
  } else {
    likedSongs.push(songId);
  }
  
  appState.user.likedSongs = likedSongs;
  saveUserData();
  
  // Update the UI
  const songs = appState.searchResults.length > 0 ? appState.searchResults : appState.songs;
  displaySongs(songs);
}

// Display Playlists
function displayPlaylists() {
  const cardsContainer = document.getElementById('cardsContainer');
  
  if (appState.playlists.length === 0) {
    cardsContainer.innerHTML = '<p style="color: #aaa; padding: 20px;">No playlists yet. Create one!</p>';
    return;
  }
  
  cardsContainer.innerHTML = appState.playlists.map((playlist) => `
    <div class="card">
      <div style="width: 100%; height: 150px; background: linear-gradient(135deg, #1DB954, #191414); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px;">
        🎵
      </div>
      <p>${playlist.name}</p>
    </div>
  `).join('');
}

// Playlist Management with Error Handling
function createPlaylist() {
  const name = prompt('Enter playlist name:');
  
  if (name === null) {
    // User cancelled
    return;
  }

  if (!name.trim()) {
    showError('❌ Playlist name cannot be empty');
    return;
  }

  if (name.length > 50) {
    showError('❌ Playlist name must be less than 50 characters');
    return;
  }

  try {
    const playlist = {
      id: Date.now(),
      name: name.trim(),
      songs: [],
      createdAt: new Date().toLocaleDateString()
    };

    appState.playlists.push(playlist);
    saveUserPlaylistsToFirestore();
    updateMainContent();
    showError(`✨ Playlist "${name}" created!`);
  } catch (error) {
    showError('❌ Error creating playlist');
    console.error('Playlist error:', error);
  }
}

// Song Upload with Error Handling
function uploadSongs() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'audio/*';
  
  input.addEventListener('change', (e) => {
    const files = e.target.files;
    
    if (files.length === 0) {
      showError('No files selected');
      return;
    }

    let successCount = 0;
    let totalFiles = files.length;

    Array.from(files).forEach((file, index) => {
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        showError(`⚠️ File "${file.name}" is too large (max 50MB)`);
        totalFiles--;
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const song = {
            id: Date.now() + index,
            name: file.name.replace(/\.[^/.]+$/, ''),
            artist: 'Your Library',
            cover: 'https://picsum.photos/200?random=' + Math.random(),
            file: event.target.result,
            liked: false,
            uploadedAt: new Date().toLocaleDateString(),
            source: 'local'
          };
          
          appState.songs.push(song);
          successCount++;
        } catch (error) {
          showError(`❌ Error processing "${file.name}"`);
          console.error('Upload error:', error);
        }
      };

      reader.onerror = () => {
        showError(`❌ Failed to read "${file.name}"`);
        totalFiles--;
      };
      
      reader.readAsArrayBuffer(file);
    });
    
    setTimeout(() => {
      if (successCount > 0) {
        saveUserSongsToFirestore();
        updateMainContent();
        showError(`✅ ${successCount}/${totalFiles} song(s) added to your library!`);
      } else {
        showError('❌ No files were uploaded');
      }
    }, 1000);
  });
  
  input.click();
}

// Load Sample Songs
function loadSongs() {
  if (appState.songs.length === 0) {
    appState.songs = [
      {
        id: 1,
        name: 'Midnight Feelings',
        artist: 'Luna Dreams',
        cover: 'https://picsum.photos/200?1',
        liked: false,
        source: 'default'
      },
      {
        id: 2,
        name: 'Chill Vibes',
        artist: 'Ambient Waves',
        cover: 'https://picsum.photos/200?2',
        liked: false,
        source: 'default'
      },
      {
        id: 3,
        name: 'Lo-Fi Lounge',
        artist: 'Beat Keeper',
        cover: 'https://picsum.photos/200?3',
        liked: false,
        source: 'default'
      }
    ];
    
    saveUserSongsToFirestore();
  }
  
  displaySongs(appState.songs);
}

// Premium Features
function openPremiumModal() {
  document.getElementById('premiumModal').style.display = 'flex';
}

function closePremiumModal() {
  document.getElementById('premiumModal').style.display = 'none';
}

function upgradeToPremium() {
  appState.user.isPremium = true;
  appState.user.skipsUsed = 0;
  saveUserData();
  updateUserDisplay();
  updateAdVisibility();
  closePremiumModal();
  showError('🎉 Welcome to Vvvinify Premium! Enjoy unlimited skips, ad-free experience, and more!');
}

// User Authentication
function openLoginModal() {
  document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
  document.getElementById('loginModal').style.display = 'none';
}

function handleLogin() {
  const email = document.getElementById('emailInput').value.trim();
  
  if (!email) {
    showError('❌ Please enter an email address');
    return;
  }

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('❌ Please enter a valid email address');
    return;
  }

  try {
    appState.user.name = email.split('@')[0];
    appState.user.email = email;
    saveUserData();
    updateUserDisplay();
    closeLoginModal();
    
    // Clear inputs
    document.getElementById('emailInput').value = '';
    document.getElementById('passwordInput').value = '';
    
    showError(`👋 Welcome back, ${appState.user.name}!`);
  } catch (error) {
    showError('❌ Login failed. Please try again.');
    console.error('Login error:', error);
  }
}

function handleSignup() {
  const email = document.getElementById('emailInput').value.trim();
  
  if (!email) {
    showError('❌ Please enter an email address');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('❌ Please enter a valid email address');
    return;
  }

  handleLogin();
}

function handleSignOut() {
  // Save user data before signing out
  saveUserDataToFirestore();
  saveUserPlaylistsToFirestore();
  saveUserSongsToFirestore();

  // Try Firebase sign out first
  try {
    firebaseAuth.signOut().then(() => {
      console.log('Firebase sign out successful');
    }).catch((error) => {
      console.warn('Firebase sign out failed:', error);
    });
  } catch (error) {
    console.warn('Firebase sign out error:', error);
  }

  // Clear localStorage data
  localStorage.removeItem('userData');
  localStorage.removeItem('userMode');
  localStorage.removeItem('playlists');
  localStorage.removeItem('songs');

  // Reset app state
  appState.user = { name: 'Guest', isPremium: false, skipsUsed: 0, likedSongs: [] };
  appState.firebaseUser = null;
  appState.playlists = [];
  appState.songs = [];

  // Redirect to landing page
  window.location.href = 'landing.html';
}

function updateUserDisplay() {
  document.getElementById('userDisplay').textContent = `👤 ${appState.user.name}`;
  
  const premiumBadge = document.getElementById('premiumBadge');
  const loginBtn = document.querySelector('.login-btn-sidebar');
  const signoutBtn = document.querySelector('.signout-btn-sidebar');
  const premiumBtn = document.querySelector('.premium-btn-sidebar');
  const adminBtn = document.querySelector('.admin-btn-sidebar');
  
  if (appState.user.isPremium) {
    premiumBadge.style.display = 'inline-block';
    if (premiumBtn) premiumBtn.style.display = 'none';
  } else {
    premiumBadge.style.display = 'none';
    if (premiumBtn) premiumBtn.style.display = 'block';
  }
  
  // Show sign out if logged in (not guest), hide login
  if (appState.user.name !== 'Guest') {
    if (loginBtn) loginBtn.style.display = 'none';
    if (signoutBtn) signoutBtn.style.display = 'block';
    if (adminBtn) adminBtn.style.display = 'block'; // Show admin for logged-in users
  } else {
    if (loginBtn) loginBtn.style.display = 'block';
    if (signoutBtn) signoutBtn.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none'; // Hide admin for guests
  }
}

// Local Storage
function saveToLocalStorage() {
  // Legacy function - now saves to Firestore
  saveUserSongsToFirestore();
  saveUserPlaylistsToFirestore();
}

function saveUserData() {
  saveUserDataToFirestore();
}

function updateUI() {
  updateMainContent();
  updateSongInfo();
}

// Make functions globally accessible
window.uploadSongs = uploadSongs;
window.searchMusic = searchMusic;
window.playSong = playSong;
window.openPremiumModal = openPremiumModal;
window.closePremiumModal = closePremiumModal;
window.upgradeToPremium = upgradeToPremium;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleSignOut = handleSignOut;
window.navigateTo = navigateTo;
window.toggleSidebar = toggleSidebar;
window.togglePlay = togglePlay;
window.nextSong = nextSong;
window.previousSong = previousSong;
window.seekSong = seekSong;
window.showError = showError;
window.closeError = closeError;
window.showLoading = showLoading;

// Ad Management Functions
function updateAdVisibility() {
  const isPremium = appState.user.isPremium;
  const adsBanner = document.getElementById('adsBanner');
  const inlineAd = document.getElementById('inlineAd');

  if (isPremium) {
    if (adsBanner) adsBanner.classList.add('hidden');
    if (inlineAd) inlineAd.classList.add('hidden');
  } else {
    if (adsBanner) adsBanner.classList.remove('hidden');
    if (inlineAd) inlineAd.classList.remove('hidden');
  }
}

function closeInlineAd() {
  const inlineAd = document.getElementById('inlineAd');
  if (inlineAd) {
    inlineAd.classList.add('hidden');
  }
}

// Initialize ads on page load
document.addEventListener('DOMContentLoaded', function() {
  updateAdVisibility();
});
