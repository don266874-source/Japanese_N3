// /js/shadowing-player.js

let currentLineIndex = -1;
let loopMode = 'none';
let player;

// 录音相关全局变量
let mediaRecorder;
let audioChunks = [];
let userAudioBlobs = {};
let currentRecordingIndex = -1;

// 1. 动态引入 YouTube Iframe API
(function initYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
})();

// 2. YouTube API 准备就绪回调
window.onYouTubeIframeAPIReady = function() {
    if (typeof ytVideoId === 'undefined') {
        console.error("ytVideoId is not defined in the page.");
        return;
    }
    player = new YT.Player('youtube-player', {
        height: '80',
        width: '100%',
        videoId: ytVideoId,
        playerVars: { 'playsinline': 1, 'controls': 1 },
        events: { 'onReady': onPlayerReady }
    });
};

function onPlayerReady(event) {
    renderSubtitles();
    setInterval(monitorPlayback, 100);
    
    if (typeof pageId !== 'undefined') {
        const lastRead = localStorage.getItem(`last-read-${pageId}`);
        if (lastRead !== null) {
            const targetLine = document.getElementById(`line-${lastRead}`);
            if (targetLine) {
                targetLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetLine.classList.add('active');
            }
        }
    }
}

// 3. 渲染字幕与操作按钮
function renderSubtitles() {
    const container = document.getElementById('subtitle-container');
    if (!container || typeof subtitleData === 'undefined') return;

    subtitleData.forEach((line, index) => {
        const div = document.createElement('div');
        div.className = 'shadow-line';
        div.id = `line-${index}`;
        
        div.innerHTML = `
            <div class="text-content">
                <div class="ja-text">${line.ja}</div>
                <div class="en-text" id="en-${index}">${line.en}</div>
            </div>
            <div class="action-buttons">
                <button class="action-btn record-btn" id="record-btn-${index}" onclick="toggleRecord(event, ${index})" title="Hold or Click to Record">
                    <svg class="icon-mic" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                </button>
                <button class="action-btn play-btn" id="play-btn-${index}" onclick="playUserRecord(event, ${index})" style="display:none;" title="Play your recording">▶️</button>
            </div>
        `;
        
        div.onclick = (e) => {
            if (e.target.closest('.action-btn')) return;
            currentLineIndex = index;
            player.seekTo(line.start, true);
            player.playVideo();
            if (typeof pageId !== 'undefined') {
                localStorage.setItem(`last-read-${pageId}`, index);
            }
        };

        div.ondblclick = (e) => {
            if (e.target.closest('.action-btn')) return;
            player.pauseVideo();
        };

        container.appendChild(div);
    });
}

// 4. 显示/隐藏中日英文字幕
window.toggleSubtitles = function(lang) {
    const container = document.getElementById('subtitle-container');
    const checkbox = document.getElementById(`toggle-${lang}`);
    if (!container || !checkbox) return;

    if (checkbox.checked) {
        container.classList.remove(`hide-${lang}`);
    } else {
        container.classList.add(`hide-${lang}`);
    }
};

// 5. 录音功能
window.toggleRecord = async function(event, index) {
    event.stopPropagation();
    const recordBtn = document.getElementById(`record-btn-${index}`);
    const playBtn = document.getElementById(`play-btn-${index}`);

    if (currentRecordingIndex === index) {
        mediaRecorder.stop();
        recordBtn.classList.remove('recording');
        currentRecordingIndex = -1;
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            userAudioBlobs[index] = URL.createObjectURL(audioBlob);
            playBtn.style.display = 'block';
            playBtn.classList.add('has-audio');
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        currentRecordingIndex = index;
        recordBtn.classList.add('recording');
        player.pauseVideo();

    } catch (err) {
        alert("Permission denied or microphone not found. Please allow microphone access.");
        console.error(err);
    }
};

// 6. 播放用户录音
window.playUserRecord = function(event, index) {
    event.stopPropagation();
    if (userAudioBlobs[index]) {
        player.pauseVideo();
        const audio = new Audio(userAudioBlobs[index]);
        audio.play();
    }
};

// 7. 实时时间监听与滚动
function monitorPlayback() {
    if (!player || typeof player.getCurrentTime !== 'function' || typeof subtitleData === 'undefined') return;
    const currentTime = player.getCurrentTime();
    const playerState = player.getPlayerState(); 

    let activeIndex = subtitleData.findIndex(line => currentTime >= line.start && currentTime <= line.end);
    
    if (activeIndex !== -1) {
        currentLineIndex = activeIndex;
        document.querySelectorAll('.shadow-line').forEach(el => el.classList.remove('active'));
        const activeElement = document.getElementById(`line-${activeIndex}`);
        if (activeElement) {
            activeElement.classList.add('active');
            if (playerState === 1) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
}