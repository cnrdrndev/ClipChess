// ClipChess Main Script

// Piece image mapping (using Wikimedia Commons high quality chess piece SVG vectors)
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

// Global State
let game = new Chess();
let selectedSquare = null;
let possibleMoves = [];
let boardOrientation = 'white'; // 'white' or 'black'
let gameActive = false;
let gameMode = 'computer';
let aiDifficulty = 3;
let whiteTime = 300;
let blackTime = 300;
let timerInterval = null;
let currentTurnTimer = 'w';

// Sample community clips seed data
let communityClips = [
    {
        id: 1,
        title: "Immortal Game Brilliant Finish",
        author: "Adolf Anderssen",
        pgn: "1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7#"
    },
    {
        id: 2,
        title: "Fast Queen Trap in the Center",
        author: "GrandmasterBlitz",
        pgn: "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. Bg5 dxe4 5. Nxe4 Be7 6. Bxf6 Bxf6 7. Nf3 O-O 8. Qd2 b6 9. O-O-O Bb7 10. Qf4 Nd7 11. Bd3 Qe7"
    }
];

// DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initBoardUI();
    initEventListeners();
    renderClipsFeed();
});

// Navigation Tabs
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

// Initialize Chessboard DOM grid
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

// Render Pieces and highlights
function updateBoardPieces() {
    const squares = document.querySelectorAll('.square');
    squares.forEach(sq => {
        const squareId = sq.getAttribute('data-square');
        sq.innerHTML = '';
        sq.classList.remove('highlight', 'selected');

        // Highlight selected square and possible moves
        if (selectedSquare === squareId) {
            sq.classList.add('selected');
        }
        if (possibleMoves.includes(squareId)) {
            sq.classList.add('highlight');
        }

        const piece = game.get(squareId);
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

// Square Click Handling
function onSquareClick(squareId) {
    if (!gameActive) return;

    // If computer mode and it's black's turn, ignore user clicks
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
            // Make move
            const move = game.move({
                from: selectedSquare,
                to: squareId,
                promotion: 'q' // auto promote to queen for simplicity
            });

            if (move) {
                selectedSquare = null;
                possibleMoves = [];
                handlePostMove();
            }
        } else {
            // Reselect or deselect
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

// Handle actions after every valid move
function handlePostMove() {
    updateBoardPieces();
    updateMoveHistoryUI();
    checkGameOver();

    if (!gameActive) return;

    // Switch clock turn
    currentTurnTimer = game.turn();
    updateClockDisplay();

    // If AI turn
    if (gameActive && gameMode === 'computer' && game.turn() === 'b') {
        setTimeout(makeAIMove, 300);
    }
}

// Simple heuristic AI for Stockfish simulation
function makeAIMove() {
    if (!gameActive) return;
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return;

    let chosenMove = null;

    if (aiDifficulty === 1) {
        // Random moves
        chosenMove = moves[Math.floor(Math.random() * moves.length)];
    } else {
        // Basic capture preference & center control heuristic
        let scoredMoves = moves.map(m => {
            let score = 0;
            if (m.captured) {
                const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
                score += values[m.captured] * 10;
            }
            if (['d4', 'd5', 'e4', 'e5'].includes(m.to)) score += 2;
            return { move: m, score };
        });
        scoredMoves.sort((a, b) => b.score - a.score);
        chosenMove = scoredMoves[0].move;
    }

    game.move(chosenMove);
    handlePostMove();
}

// Check game over conditions
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
        const turnColor = game.turn() === 'w' ? 'White to move' : 'Black to move';
        statusEl.innerHTML = turnColor;
    }
}

function endGame() {
    gameActive = false;
    clearInterval(timerInterval);
    document.querySelectorAll('.clock').forEach(c => c.classList.remove('active-clock'));
}

// Timers
function startTimers() {
    clearInterval(timerInterval);
    if (whiteTime <= 0 && blackTime <= 0) return;

    timerInterval = setInterval(() => {
        if (!gameActive) return;

        if (currentTurnTimer === 'w') {
            if (whiteTime > 0) whiteTime--;
            if (whiteTime <= 0) {
                document.getElementById('game-status').innerHTML = "Black wins on time!";
                endGame();
            }
        } else {
            if (blackTime > 0) blackTime--;
            if (blackTime <= 0) {
                document.getElementById('game-status').innerHTML = "White wins on time!";
                endGame();
            }
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

// Evaluation Bar estimation
function updateEvalBar() {
    let score = 0;
    const board = game.board();
    const pieceVals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    
    board.forEach(row => {
        row.forEach(piece => {
            if (piece) {
                const val = pieceVals[piece.type];
                if (piece.color === 'w') score += val;
                else score -= val;
            }
        });
    });

    // Map score (-10 to +10) to percentage (0 to 100)
    let percentage = 50 + (score * 5);
    percentage = Math.max(5, Math.min(95, percentage));
    
    if (boardOrientation === 'black') {
        percentage = 100 - percentage;
    }

    document.getElementById('eval-bar-fill').style.height = `${percentage}%`;
}

// Move History UI
function updateMoveHistoryUI() {
    const historyBody = document.getElementById('move-history-body');
    historyBody.innerHTML = '';
    const history = game.history({ verbose: true });

    for (let i = 0; i < history.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const whiteMove = history[i] ? history[i].san : '';
        const blackMove = history[i + 1] ? history[i + 1].san : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${moveNum}.</td><td>${whiteMove}</td><td>${blackMove}</td>`;
        historyBody.appendChild(tr);
    }

    const container = document.querySelector('.move-history-container');
    container.scrollTop = container.scrollHeight;
}

// Event Listeners for UI Controls
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
        currentTurnTimer = 'w';

        if (gameMode === 'computer') {
            document.getElementById('opponent-name').innerText = `Stockfish (Level ${aiDifficulty})`;
            document.getElementById('opponent-rating').innerText = 1200 + (aiDifficulty * 150);
        } else {
            document.getElementById('opponent-name').innerText = `Player 2`;
            document.getElementById('opponent-rating').innerText = '1500';
        }

        document.getElementById('setup-card').classList.add('hidden');
        document.getElementById('game-card').classList.remove('hidden');

        initBoardUI();
        updateMoveHistoryUI();
        updateClockDisplay();
        if (timeSecs > 0) startTimers();
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

    // Share Modal
    const modal = document.getElementById('share-modal');
    const shareBtn = document.getElementById('share-clip-btn');
    const shareCurrentBtn = document.getElementById('share-current-btn');
    const closeModal = document.querySelector('.close-modal');

    const openShareModal = (pgnString = '') => {
        document.getElementById('clip-pgn').value = pgnString || game.pgn();
        modal.style.display = 'flex';
    };

    shareBtn.addEventListener('click', () => openShareModal());
    shareCurrentBtn.addEventListener('click', () => openShareModal());
    closeModal.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    document.getElementById('publish-clip-btn').addEventListener('click', () => {
        const title = document.getElementById('clip-title').value.trim() || "Epic Chess Battle";
        const author = document.getElementById('clip-author').value.trim() || "Anonymous";
        const pgn = document.getElementById('clip-pgn').value.trim() || game.pgn();

        communityClips.unshift({
            id: Date.now(),
            title,
            author,
            pgn
        });

        modal.style.display = 'none';
        renderClipsFeed();
        
        // Switch to clips tab to show published clip
        document.querySelector('[data-tab="clips-tab"]').click();
    });
}

// Render Community Clips Grid
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
            <div class="clip-preview-board" id="clip-preview-${idx}">
                <!-- Mini board representation -->
            </div>
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
    try {
        tempGame.load_pgn(pgn);
    } catch(e) {
        // fallback
    }

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

    document.getElementById('setup-card').classList.add('hidden');
    document.getElementById('game-card').classList.remove('hidden');
    document.getElementById('game-status').innerText = `Viewing clip: ${clip.title}`;

    // Switch to play tab
    document.querySelector('[data-tab="play-tab"]').click();
    initBoardUI();
    updateMoveHistoryUI();
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}