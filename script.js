const pieceImages = {
    'wP': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
    'wN': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    'wB': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    'wR': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    'wQ': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    'wK': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
    'bP': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
    'bN': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    'bB': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    'bR': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    'bQ': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    'bK': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
};

let currentUser = JSON.parse(localStorage.getItem('clipchess_user')) || { username: 'Guest', elo: 1500 };
let game = new Chess();
let selectedSquare = null;
let possibleMoves = [];
let boardOrientation = 'white';
let gameActive = false;
let gameMode = 'computer';
let aiDifficulty = 5;
let whiteTime = 300;
let blackTime = 300;
let timerInterval = null;
let currentTurnTimer = 'w';
let viewingHistoryIndex = -1;

let stockfishWorker = null;
let currentEval = 0;

let conversations = JSON.parse(localStorage.getItem('clipchess_conversations')) || [
    { id: 1, peer: 'Stockfish Bot', messages: [{ sender: 'Stockfish Bot', text: 'Welcome to ClipChess! Ready for a game?' }] }
];
let activeChatId = null;

let communityClips = [
    {
        id: 1,
        title: "Immortal Game Brilliant Finish",
        author: "Adolf Anderssen",
        pgn: "1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7#"
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initAccountUI();
    initTabs();
    initBoardUI();
    initStockfishWorker();
    initEventListeners();
    renderClipsFeed();
    renderConversations();
});

function initAccountUI() {
    document.getElementById('current-username').innerText = currentUser.username;
    document.getElementById('current-elo').innerText = currentUser.elo;
    document.getElementById('user-name-display').innerText = currentUser.username;
    document.getElementById('user-rating-display').innerText = currentUser.elo;
}

function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

            item.classList.add('active');
            const targetTab = document.getElementById(item.getAttribute('data-tab'));
            if (targetTab) targetTab.classList.add('active');
        });
    });
}

function initStockfishWorker() {
    try {
        stockfishWorker = new Worker("https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js");
        stockfishWorker.onmessage = function(event) {
            const message = event.data;
            if (typeof message === 'string') {
                if (message.startsWith('info') && message.includes('score')) {
                    parseStockfishInfo(message);
                } else if (message.startsWith('bestmove') && gameActive && gameMode === 'computer' && game.turn() === 'b') {
                    const bestMoveStr = message.split(' ')[1];
                    if (bestMoveStr) {
                        const from = bestMoveStr.substring(0, 2);
                        const to = bestMoveStr.substring(2, 4);
                        const promotion = bestMoveStr.length > 4 ? bestMoveStr[4] : 'q';
                        game.move({ from, to, promotion });
                        handlePostMove();
                    }
                }
            }
        };
        stockfishWorker.postMessage('uci');
    } catch(e) {
        console.log("Stockfish worker fallback mode enabled.");
    }
}

function parseStockfishInfo(infoStr) {
    if (infoStr.includes('cp ')) {
        const match = infoStr.match(/cp\s+(-?\d+)/);
        if (match) {
            currentEval = parseInt(match[1]) / 100;
            updateEvalBar();
        }
    } else if (infoStr.includes('mate ')) {
        const match = infoStr.match(/mate\s+(-?\d+)/);
        if (match) {
            const mateIn = parseInt(match[1]);
            currentEval = mateIn > 0 ? 10 + (10 / mateIn) : -10 - (10 / Math.abs(mateIn));
            updateEvalBar();
        }
    }
}

function requestStockfishEvaluation() {
    if (stockfishWorker) {
        stockfishWorker.postMessage('position fen ' + game.fen());
        stockfishWorker.postMessage('go depth 10');
    }
}

function initBoardUI() {
    const boardEl = document.getElementById('chessboard');
    boardEl.innerHTML = '';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    let outerRanks = boardOrientation === 'white' ? ranks : [...ranks].reverse();
    let outerFiles = boardOrientation === 'white' ? files : [...files].reverse();

    outerRanks.forEach((r, rIdx) => {
        outerFiles.forEach((f, fIdx) => {
            const squareId = f + r;
            const squareEl = document.createElement('div');
            squareEl.classList.add('square');
            squareEl.classList.add((rIdx + fIdx) % 2 === 0 ? 'light' : 'dark');
            squareEl.setAttribute('data-square', squareId);

            squareEl.addEventListener('click', () => onSquareClick(squareId));
            boardEl.appendChild(squareEl);
        });
    });

    updateBoardPieces();
}

function updateBoardPieces() {
    let displayGame = game;
    if (viewingHistoryIndex >= 0) {
        displayGame = new Chess();
        const history = game.history({ verbose: true });
        for (let i = 0; i <= viewingHistoryIndex; i++) {
            displayGame.move(history[i]);
        }
    }

    const squares = document.querySelectorAll('.square');
    squares.forEach(sq => {
        const squareId = sq.getAttribute('data-square');
        sq.innerHTML = '';
        sq.classList.remove('highlight', 'selected');

        if (viewingHistoryIndex === -1) {
            if (selectedSquare === squareId) sq.classList.add('selected');
            if (possibleMoves.includes(squareId)) sq.classList.add('highlight');
        }

        const piece = displayGame.get(squareId);
        if (piece) {
            const pieceKey = piece.color + piece.type.toUpperCase();
            const pieceDiv = document.createElement('div');
            pieceDiv.classList.add('piece');
            pieceDiv.style.backgroundImage = `url('${pieceImages[pieceKey]}')`;
            sq.appendChild(pieceDiv);
        }
    });

    updateEvalBar();
}

function onSquareClick(squareId) {
    if (!gameActive || viewingHistoryIndex !== -1) return;
    if (gameMode === 'computer' && game.turn() === 'b') return;

    if (selectedSquare === null) {
        const piece = game.get(squareId);
        if (piece && piece.color === game.turn()) {
            selectedSquare = squareId;
            possibleMoves = game.moves({ square: squareId, verbose: true }).map(m => m.to);
            updateBoardPieces();
        }
    } else {
        if (possibleMoves.includes(squareId)) {
            const move = game.move({ from: selectedSquare, to: squareId, promotion: 'q' });
            if (move) {
                selectedSquare = null;
                possibleMoves = [];
                handlePostMove();
            }
        } else {
            const piece = game.get(squareId);
            if (piece && piece.color === game.turn()) {
                selectedSquare = squareId;
                possibleMoves = game.moves({ square: squareId, verbose: true }).map(m => m.to);
            } else {
                selectedSquare = null;
                possibleMoves = [];
            }
            updateBoardPieces();
        }
    }
}

function handlePostMove() {
    viewingHistoryIndex = -1;
    updateBoardPieces();
    updateMoveHistoryUI();
    checkGameOver();

    if (!gameActive) return;

    currentTurnTimer = game.turn();
    updateClockDisplay();
    requestStockfishEvaluation();

    if (gameActive && gameMode === 'computer' && game.turn() === 'b') {
        if (stockfishWorker) {
            stockfishWorker.postMessage('position fen ' + game.fen());
            stockfishWorker.postMessage(`go movetime ${aiDifficulty * 200}`);
        } else {
            setTimeout(makeFallbackAIMove, 400);
        }
    }
}

function makeFallbackAIMove() {
    if (!gameActive) return;
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return;
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    game.move(randomMove);
    handlePostMove();
}

function checkGameOver() {
    const statusEl = document.getElementById('game-status');
    if (game.in_checkmate()) {
        const winner = game.turn() === 'w' ? 'Black' : 'White';
        statusEl.innerHTML = `<i class="fa-solid fa-trophy"></i> Checkmate! ${winner} wins!`;
        endGame();
    } else if (game.in_draw()) {
        statusEl.innerHTML = `<i class="fa-solid fa-handshake"></i> Game Drawn!`;
        endGame();
    } else if (game.in_check()) {
        const inCheckColor = game.turn() === 'w' ? 'White' : 'Black';
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${inCheckColor} is in Check!`;
    } else {
        statusEl.innerHTML = game.turn() === 'w' ? 'White to move' : 'Black to move';
    }
}

function endGame() {
    gameActive = false;
    clearInterval(timerInterval);
    document.querySelectorAll('.clock').forEach(c => c.classList.remove('active-clock'));
}

function startTimers() {
    clearInterval(timerInterval);
    if (whiteTime <= 0 && blackTime <= 0) return;

    timerInterval = setInterval(() => {
        if (!gameActive) return;
        if (currentTurnTimer === 'w') {
            if (whiteTime > 0) whiteTime--;
            if (whiteTime <= 0) { document.getElementById('game-status').innerHTML = "Black wins on time!"; endGame(); }
        } else {
            if (blackTime > 0) blackTime--;
            if (blackTime <= 0) { document.getElementById('game-status').innerHTML = "White wins on time!"; endGame(); }
        }
        updateClockDisplay();
    }, 1000);
}

function updateClockDisplay() {
    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };
    document.getElementById('white-clock').innerText = formatTime(whiteTime);
    document.getElementById('black-clock').innerText = formatTime(blackTime);
    document.getElementById('white-clock').classList.toggle('active-clock', currentTurnTimer === 'w' && gameActive);
    document.getElementById('black-clock').classList.toggle('active-clock', currentTurnTimer === 'b' && gameActive);
}

function updateEvalBar() {
    let percentage = 50 + (currentEval * 5);
    percentage = Math.max(5, Math.min(95, percentage));
    
    if (boardOrientation === 'black') {
        percentage = 100 - percentage;
    }

    document.getElementById('eval-bar-fill').style.height = `${percentage}%`;
}

function updateMoveHistoryUI() {
    const historyBody = document.getElementById('move-history-body');
    historyBody.innerHTML = '';
    const history = game.history({ verbose: true });

    for (let i = 0; i < history.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const whitePly = i;
        const blackPly = i + 1;

        const whiteMove = history[whitePly] ? history[whitePly].san : '';
        const blackMove = history[blackPly] ? history[blackPly].san : '';

        const tr = document.createElement('tr');
        
        const tdNum = document.createElement('td');
        tdNum.innerText = `${moveNum}.`;

        const tdWhite = document.createElement('td');
        tdWhite.innerText = whiteMove;
        if (viewingHistoryIndex === whitePly) tdWhite.classList.add('active-history-move');
        tdWhite.addEventListener('click', () => jumpToHistory(whitePly));

        const tdBlack = document.createElement('td');
        tdBlack.innerText = blackMove;
        if (blackMove) {
            if (viewingHistoryIndex === blackPly) tdBlack.classList.add('active-history-move');
            tdBlack.addEventListener('click', () => jumpToHistory(blackPly));
        }

        tr.appendChild(tdNum);
        tr.appendChild(tdWhite);
        tr.appendChild(tdBlack);
        historyBody.appendChild(tr);
    }

    const container = document.querySelector('.move-history-container');
    container.scrollTop = container.scrollHeight;
}

function jumpToHistory(plyIndex) {
    viewingHistoryIndex = plyIndex;
    updateBoardPieces();
    updateMoveHistoryUI();
    document.getElementById('game-status').innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Inspecting move history (Ply ${plyIndex + 1})`;
}

function initEventListeners() {
    const modeSelect = document.getElementById('game-mode');
    const diffGroup = document.getElementById('difficulty-group');

    modeSelect.addEventListener('change', (e) => {
        gameMode = e.target.value;
        diffGroup.classList.toggle('hidden', gameMode !== 'computer');
    });

    document.getElementById('start-game-btn').addEventListener('click', () => {
        aiDifficulty = parseInt(document.getElementById('ai-difficulty').value);
        const timeSecs = parseInt(document.getElementById('time-control').value);
        whiteTime = timeSecs;
        blackTime = timeSecs;

        game.reset();
        gameActive = true;
        selectedSquare = null;
        possibleMoves = [];
        viewingHistoryIndex = -1;
        currentTurnTimer = 'w';
        currentEval = 0;

        if (gameMode === 'computer') {
            document.getElementById('opponent-name').innerText = `Stockfish Bot (Lvl ${aiDifficulty})`;
            document.getElementById('opponent-rating').innerText = 1000 + (aiDifficulty * 150);
        } else {
            document.getElementById('opponent-name').innerText = `Friend`;
            document.getElementById('opponent-rating').innerText = currentUser.elo;
        }

        document.getElementById('setup-card').classList.add('hidden');
        document.getElementById('game-card').classList.remove('hidden');

        initBoardUI();
        updateMoveHistoryUI();
        updateClockDisplay();
        if (timeSecs > 0) startTimers();
        requestStockfishEvaluation();
    });

    document.getElementById('resign-btn').addEventListener('click', () => {
        if (!gameActive) return;
        const loser = game.turn() === 'w' ? 'White' : 'Black';
        document.getElementById('game-status').innerHTML = `<i class="fa-solid fa-flag"></i> ${loser} resigned. Game Over.`;
        endGame();
    });

    document.getElementById('flip-btn').addEventListener('click', () => {
        boardOrientation = boardOrientation === 'white' ? 'black' : 'white';
        initBoardUI();
    });

    const accountModal = document.getElementById('account-modal');
    document.getElementById('user-profile-trigger').addEventListener('click', () => {
        document.getElementById('modal-username').value = currentUser.username;
        document.getElementById('modal-elo').value = currentUser.elo;
        accountModal.style.display = 'flex';
    });
    document.getElementById('close-account-modal').addEventListener('click', () => accountModal.style.display = 'none');
    document.getElementById('save-account-btn').addEventListener('click', () => {
        currentUser.username = document.getElementById('modal-username').value.trim() || 'Player';
        currentUser.elo = parseInt(document.getElementById('modal-elo').value) || 1500;
        localStorage.setItem('clipchess_user', JSON.stringify(currentUser));
        initAccountUI();
        accountModal.style.display = 'none';
    });

    const shareModal = document.getElementById('share-modal');
    document.getElementById('share-clip-btn').addEventListener('click', () => {
        document.getElementById('clip-pgn').value = game.pgn();
        shareModal.style.display = 'flex';
    });
    document.getElementById('share-current-btn').addEventListener('click', () => {
        document.getElementById('clip-pgn').value = game.pgn();
        shareModal.style.display = 'flex';
    });
    document.getElementById('close-share-modal').addEventListener('click', () => shareModal.style.display = 'none');

    document.getElementById('publish-clip-btn').addEventListener('click', () => {
        const title = document.getElementById('clip-title').value.trim() || "Epic Match";
        const pgn = document.getElementById('clip-pgn').value.trim() || game.pgn();
        communityClips.unshift({ id: Date.now(), title, author: currentUser.username, pgn });
        shareModal.style.display = 'none';
        renderClipsFeed();
        document.querySelector('[data-tab="clips-tab"]').click();
    });

    document.getElementById('new-message-btn').addEventListener('click', () => {
        const peerName = prompt("Enter username to message:");
        if (peerName) {
            let existing = conversations.find(c => c.peer === peerName);
            if (!existing) {
                existing = { id: Date.now(), peer: peerName, messages: [] };
                conversations.push(existing);
                saveConversations();
            }
            renderConversations();
            openChat(existing.id);
        }
    });
}

function renderConversations() {
    const listEl = document.getElementById('conversations-list');
    listEl.innerHTML = '';
    conversations.forEach(conv => {
        const div = document.createElement('div');
        div.classList.add('conv-item');
        if (activeChatId === conv.id) div.classList.add('active');
        div.innerHTML = `<strong>${escapeHTML(conv.peer)}</strong><br><small style="color:var(--text-main);">${conv.messages.length ? escapeHTML(conv.messages[conv.messages.length - 1].text) : 'No messages yet'}</small>`;
        div.addEventListener('click', () => openChat(conv.id));
        listEl.appendChild(div);
    });
}

function openChat(convId) {
    activeChatId = convId;
    renderConversations();
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    const chatPane = document.getElementById('chat-pane');
    chatPane.innerHTML = `
        <h3 style="border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; margin-bottom:1rem;"><i class="fa-solid fa-user"></i> ${escapeHTML(conv.peer)}</h3>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-area">
            <input type="text" id="chat-input" placeholder="Type a message...">
            <button id="send-msg-btn" class="btn btn-success"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
    `;

    const msgsEl = document.getElementById('chat-messages');
    conv.messages.forEach(m => {
        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble');
        bubble.classList.add(m.sender === currentUser.username ? 'outgoing' : 'incoming');
        bubble.innerText = m.text;
        msgsEl.appendChild(bubble);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;

    document.getElementById('send-msg-btn').addEventListener('click', sendChatMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const conv = conversations.find(c => c.id === activeChatId);
    if (!conv) return;

    conv.messages.push({ sender: currentUser.username, text });
    input.value = '';
    saveConversations();
    renderConversations();
    openChat(conv.id);

    if (conv.peer === 'Stockfish Bot') {
        setTimeout(() => {
            conv.messages.push({ sender: 'Stockfish Bot', text: `I evaluated your message at +0.00. Good point!` });
            saveConversations();
            renderConversations();
            if (activeChatId === conv.id) openChat(conv.id);
        }, 1000);
    }
}

function saveConversations() {
    localStorage.setItem('clipchess_conversations', JSON.stringify(conversations));
}

function renderClipsFeed() {
    const grid = document.getElementById('clips-grid');
    grid.innerHTML = '';
    communityClips.forEach((clip, idx) => {
        const card = document.createElement('div');
        card.classList.add('clip-card');
        card.innerHTML = `
            <div class="clip-card-header">
                <div class="clip-title">${escapeHTML(clip.title)}</div>
                <div class="clip-author">by ${escapeHTML(clip.author)}</div>
            </div>
            <div class="clip-preview-board" id="clip-preview-${idx}"></div>
            <div class="clip-card-footer">
                <button class="btn btn-primary btn-sm" onclick="loadClipToPlay(${idx})"><i class="fa-solid fa-play"></i> Analyze / Play</button>
            </div>
        `;
        grid.appendChild(card);
        renderMiniBoard(clip.pgn, `clip-preview-${idx}`);
    });
}

function renderMiniBoard(pgn, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const tempGame = new Chess();
    try { tempGame.load_pgn(pgn); } catch(e) {}

    const miniBoard = document.createElement('div');
    miniBoard.style.display = 'grid';
    miniBoard.style.gridTemplateColumns = 'repeat(8, 26px)';
    miniBoard.style.gridTemplateRows = 'repeat(8, 26px)';
    miniBoard.style.border = '1px solid var(--border-color)';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    ranks.forEach((r, rIdx) => {
        files.forEach((f, fIdx) => {
            const sq = document.createElement('div');
            sq.style.width = '26px';
            sq.style.height = '26px';
            sq.style.backgroundColor = (rIdx + fIdx) % 2 === 0 ? '#f0d9b5' : '#b58863';
            sq.style.display = 'flex';
            sq.style.justifyContent = 'center';
            sq.style.alignItems = 'center';

            const piece = tempGame.get(f + r);
            if (piece) {
                const pieceKey = piece.color + piece.type.toUpperCase();
                const pDiv = document.createElement('div');
                pDiv.style.width = '22px';
                pDiv.style.height = '22px';
                pDiv.style.backgroundImage = `url('${pieceImages[pieceKey]}')`;
                pDiv.style.backgroundSize = 'contain';
                pDiv.style.backgroundRepeat = 'no-repeat';
                pDiv.style.backgroundPosition = 'center';
                sq.appendChild(pDiv);
            }
            miniBoard.appendChild(sq);
        });
    });
    container.appendChild(miniBoard);
}

function loadClipToPlay(index) {
    const clip = communityClips[index];
    game.load_pgn(clip.pgn);
    gameActive = true;
    selectedSquare = null;
    possibleMoves = [];
    viewingHistoryIndex = -1;

    document.getElementById('setup-card').classList.add('hidden');
    document.getElementById('game-card').classList.remove('hidden');
    document.getElementById('game-status').innerText = `Viewing clip: ${clip.title}`;

    document.querySelector('[data-tab="play-tab"]').click();
    initBoardUI();
    updateMoveHistoryUI();
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}