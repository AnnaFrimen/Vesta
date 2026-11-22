/* ===== Necot — вся логика ===== */

// ---------- Состояние ----------
const state = {
    activeTab: 'recommendations',
    activeCard: null,
    muted: true
};

const LIKE_KEY = 'necot_likes';      // { "card-0": true, ... }
const COMMENT_KEY = 'necot_comments'; // { "card-0": [{user, text}, ...] }

function loadJSON(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || {};
    } catch (e) {
        return {};
    }
}

function saveJSON(key, obj) {
    try {
        localStorage.setItem(key, JSON.stringify(obj));
    } catch (e) { /* localStorage может быть недоступен — игнорируем */ }
}

// Уникальный ключ карточки по её позиции в документе
function cardKey(card) {
    const all = Array.from(document.querySelectorAll('.video-card'));
    return 'card-' + all.indexOf(card);
}

// Форматирование числа: 1200 -> 1.2K
function formatCount(n) {
    if (n >= 1000) {
        const k = n / 1000;
        return (k >= 10 ? Math.round(k) : k.toFixed(1).replace('.0', '')) + 'K';
    }
    return String(n);
}

// ---------- Переключение вкладок ----------
function switchTab(element) {
    document.querySelectorAll('.top-nav span').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    state.activeTab = element.dataset.tab;

    // Пауза для всех видео при смене вкладки
    document.querySelectorAll('.video-card').forEach(card => pauseCard(card));

    document.querySelectorAll('.video-card').forEach(card => {
        card.classList.toggle('hidden-tab', card.dataset.tab !== state.activeTab);
    });

    // Прокрутка к началу ленты
    document.getElementById('videoFeed').scrollTop = 0;
}

// ---------- Воспроизведение ----------
function pauseCard(card) {
    const video = card.querySelector('video');
    if (video && !video.paused) video.pause();
    card.classList.add('paused');
    if (state.activeCard === card) state.activeCard = null;
}

function togglePlay(card) {
    const video = card.querySelector('video');
    if (!video || video.readyState === 0) return; // видео ещё не загружено

    if (card.classList.contains('paused')) {
        // Останавливаем предыдущее видео
        if (state.activeCard && state.activeCard !== card) pauseCard(state.activeCard);
        video.muted = state.muted;
        video.play().catch(() => {});
        card.classList.remove('paused');
        state.activeCard = card;
    } else {
        pauseCard(card);
    }
}

// Автовоспроизведение видимой карточки при скролле
function setupAutoPlay() {
    const feed = document.getElementById('videoFeed');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const card = entry.target;
            if (entry.intersectionRatio > 0.6) {
                if (card.classList.contains('paused') && card.querySelector('video').readyState > 0) {
                    togglePlay(card);
                }
            } else if (!card.classList.contains('paused')) {
                pauseCard(card);
            }
        });
    }, { root: feed, threshold: 0.6 });

    document.querySelectorAll('.video-card').forEach(card => observer.observe(card));
}

// Полоса прогресса
function setupProgress() {
    document.querySelectorAll('.video-card').forEach(card => {
        const video = card.querySelector('video');
        const bar = card.querySelector('.progress-bar');
        video.addEventListener('timeupdate', () => {
            if (video.duration) {
                bar.style.width = (video.currentTime / video.duration) * 100 + '%';
            }
        });
    });
}

// Если видеофайла нет — прячем тег video, остаётся красивая заглушка
function setupVideoFallback() {
    document.querySelectorAll('.video-card').forEach(card => {
        const video = card.querySelector('video');
        const source = video.querySelector('source');
        source.addEventListener('error', () => {
            video.style.display = 'none';
            card.querySelector('.play-indicator').style.display = 'none';
        });
    });
}

// ---------- Лайки ----------
const likes = loadJSON(LIKE_KEY);

function like(btn) {
    const card = btn.closest('.video-card');
    const key = cardKey(card);
    const countSpan = btn.querySelector('.action-count');
    let count = parseInt(card.dataset.likes, 10) || 0;

    const isLiked = !btn.classList.contains('liked');
    btn.classList.toggle('liked', isLiked);
    count += isLiked ? 1 : -1;
    if (count < 0) count = 0;

    card.dataset.likes = count;
    countSpan.innerText = formatCount(count);
    likes[key] = isLiked;
    saveJSON(LIKE_KEY, likes);
}

// Восстановление лайков после перезагрузки
function restoreLikes() {
    document.querySelectorAll('.like-btn').forEach(btn => {
        const card = btn.closest('.video-card');
        const key = cardKey(card);
        let count = parseInt(card.dataset.likes, 10) || 0;
        if (likes[key]) {
            btn.classList.add('liked');
            count += 1;
        }
        btn.querySelector('.action-count').innerText = formatCount(count);
    });
}

// ---------- Звук ----------
const muteBtn = document.getElementById('muteBtn');
muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    document.querySelectorAll('video').forEach(v => { v.muted = state.muted; });
    muteBtn.textContent = state.muted ? '🔇' : '🔊';
});
muteBtn.textContent = '🔇';

// ---------- Комментарии ----------
const commentsData = loadJSON(COMMENT_KEY);
const commentsModal = document.getElementById('commentsModal');
const commentsList = document.getElementById('commentsList');
const commentInput = document.getElementById('commentInput');
let currentCard = null;

const seedComments = [
    { user: '@user123', text: 'Очень крутой концепт!' },
    { user: '@tech_fan', text: 'На Raspberry Pi должно летать.' }
];

function renderComments() {
    const key = cardKey(currentCard);
    const list = commentsData[key] || seedComments.slice();
    commentsList.innerHTML = '';
    list.forEach(c => {
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.innerHTML = '<div class="comment-user"></div><div></div>';
        item.querySelector('.comment-user').textContent = c.user;
        item.children[1].textContent = c.text;
        commentsList.appendChild(item);
    });
    commentsList.scrollTop = 0;
}

function openComments() {
    currentCard = state.activeCard || document.querySelector('.video-card:not(.hidden-tab)');
    renderComments();
    commentsModal.classList.add('open');
    setTimeout(() => commentInput.focus(), 300);
}

function closeComments() {
    commentsModal.classList.remove('open');
}

function addComment() {
    const text = commentInput.value.trim();
    if (!text || !currentCard) return;

    const key = cardKey(currentCard);
    if (!commentsData[key]) commentsData[key] = seedComments.slice();
    commentsData[key].unshift({ user: '@you', text: text });
    saveJSON(COMMENT_KEY, commentsData);

    commentInput.value = '';
    renderComments();

    // Обновляем счётчик комментариев
    const btn = currentCard.querySelector('.action-bar .action-btn:nth-child(3) .action-count');
    if (btn) btn.innerText = String(commentsData[key].length);
}

commentInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addComment();
});

// ---------- Старт ----------
document.addEventListener('DOMContentLoaded', () => {
    restoreLikes();
    setupProgress();
    setupVideoFallback();
    setupAutoPlay();
});
