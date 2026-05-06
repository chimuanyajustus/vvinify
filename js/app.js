// Vvinify Premium Music App with Audius API Integration

// State Management
const appState = {
  isPlaying: false,
  currentSong: null,
  currentPlaylist: [],
  playlists: JSON.parse(localStorage.getItem('playlists')) || [],
  songs: JSON.parse(localStorage.getItem('songs')) || [],
  currentSection: 'home',
  user: JSON.parse(localStorage.getItem('userData')) || { name: 'Guest', isPremium: false, skipsUsed: 0, likedSongs: [] },
  searchResults: [],
  isLoading: false
};

const AUDIUS_API = 'https://api.audius.co/v1/tracks/search';
const MAX_SKIPS_FREE = 6; // 6 skips per hour for free users
const SEARCH_TIMEOUT = 10000; // 10 second timeout

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  loadSongs();
  updateUserDisplay();
  updateAdVisibility();
});

function initializeApp() {
  setupEventListeners();
  updateUI();
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

// Song Playback with Error Handling
function playSong(index) {
  const songs = appState.searchResults.length > 0 ? appState.searchResults : appState.songs;
  if (songs.length === 0) {
    showError('No songs to play');
    return;
  }
  
  appState.currentSong = songs[index];
  appState.isPlaying = true;
  
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

function updatePlayButton() {
  const playBtn = document.getElementById('play');
  playBtn.textContent = appState.isPlaying ? '⏸' : '▶';
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

function updateMainContent() {
  const title = document.getElementById('sectionTitle');
  
  switch(appState.currentSection) {
    case 'home':
      title.textContent = 'Recently Played';
      displaySongs(appState.songs);
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
      <div class="overlay">▶</div>
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
    saveToLocalStorage();
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
        saveToLocalStorage();
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
    
    saveToLocalStorage();
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
  // Reset user to guest
  appState.user = { name: 'Guest', isPremium: false, skipsUsed: 0 };
  saveUserData();
  updateUserDisplay();
  updateAdVisibility();
  // Redirect to landing page
  window.location.href = 'landing.html';
}

function updateUserDisplay() {
  document.getElementById('userDisplay').textContent = `👤 ${appState.user.name}`;
  
  const premiumBadge = document.getElementById('premiumBadge');
  const loginBtn = document.querySelector('.login-btn-sidebar');
  const signoutBtn = document.querySelector('.signout-btn-sidebar');
  const premiumBtn = document.querySelector('.premium-btn-sidebar');
  
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
  } else {
    if (loginBtn) loginBtn.style.display = 'block';
    if (signoutBtn) signoutBtn.style.display = 'none';
  }
}

// Local Storage
function saveToLocalStorage() {
  localStorage.setItem('songs', JSON.stringify(appState.songs));
  localStorage.setItem('playlists', JSON.stringify(appState.playlists));
}

function saveUserData() {
  localStorage.setItem('user', JSON.stringify(appState.user));
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
