function init(player, OPPONENT) {
    const canvas = document.getElementById("cvs");
    const ctx = canvas.getContext("2d");

    let board = [];
    const COLUMN = 3;
    const ROW = 3;
    const SPACE_SIZE = 150;

    let gameData = new Array(9);

    let currentPlayer = player.man;

    const xImage = new Image();
    xImage.src = "img/X.png";

    const oImage = new Image();
    oImage.src = "img/O.png";

    const COMBOS = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    let GAME_OVER = false;

    function drawBoard(){
        let id = 0;
        for (let i = 0; i < ROW; i++){
            board[i] = [];
            for (let j = 0; j < COLUMN; j++){
                board[i][j] = id;
                id++;
            }
        }


    }
}