// import dependencies
let ArrayList = require('arraylist');
let express = require('express')();
let http = require('http').Server(express);
let io = require('socket.io')(http);

// import cards
let cardDeck = require('./database');

// declare global variables
let ROUND_TIME = 5;
let REST_TIME = 3;
let MAX_HAND = 5;
let NUMBER_ROUNDS = 10;

let voterIndex = 0; // the index of the voter. Loop around with %.
let questions = cardDeck.questionsDatabase; // array of questions
let answers = cardDeck.answersDatabase; // array of answers
let questionIndex = 0;
let answerIndex = 0;
let voterHasVoted = false;


// Constructor for player whenever someone joins the server
function Player(socketID, score, hand = []) {
    this.socketID = socketID;
    this.score = score;
    this.hand = hand;
}

// Create a mutable array of users playing
let players = new ArrayList;

// Create server
express.get('/', function(req, res) {
    res.sendFile('index.html', {root: __dirname});
});

// Change player turn
function changeVoter() {
    totalPlayers = players.length // get the total number of players in the game
    if (totalPlayers == 0) { // if no one playing
        console.log("\x1b[31m%s\x1b[0m", "Cannot assign voter. No one playing");
    } else {
        voterForTheRound = voterIndex % totalPlayers; // change the voter for the round
        for (let i = 0; i < totalPlayers; i++) {
            if (i == voterForTheRound) {
                // Emit voting rights to the client
                voter = players.get(i);
                io.to(voter.socketID).emit('voter', 0);
            } else {
                // Emit answering rights to the client
                answerer = players.get(i);
                io.to(answerer.socketID).emit('answerer', 0);
            }
        }
        voterIndex++;
    }
};

// helper function sleep
function sleep(sec) {
    return new Promise(resolve => setTimeout(resolve, sec*1000));
}

// helper function to deal question card for all players to see
function dealQuestionCard() {
    let questionPosition = questionIndex % questions.length;
    io.sockets.emit('question', questions[questionPosition]);
    questionIndex++;
}
// helper function to deal individual answer cards to each player
function dealAnswerCards() {
    try {
        for (let player = 0; player < players.length; player++) {
            let answerPosition = answerIndex % answers.length; // prevent arrayOutOfBoundsException
            let currentPlayer = players.get(player);
            if (currentPlayer.hand.length < MAX_HAND) {
                currentPlayer.hand.push(answers[answerPosition]);
                console.log(currentPlayer.socketID);
                io.sockets.to(currentPlayer.socketID).emit('answer', currentPlayer.hand); // emitting an array
                answerIndex++;
            }
        }
    } catch (e) {
        console.log(e.message);
    }
}

// function to represent one game round
async function gameRound() {
    voterHasVoted = false;
    // logs the start of the round
    console.log("\x1b[5m%s\x1b[0m", "Round Starting now");
    // logs how many players playing this round
    console.log("\x1b[33m%s\x1b[0m", "Total online players: " + players.length);

    // change Voter
    changeVoter();

    // deal question cards for all to see
    dealQuestionCard();

    // deal answer cards to all players if needed
    dealAnswerCards();

    // ** in client side ** , clients will be able to select the answer from their hand
    // 

    // broadcast timer for the time left in round
    let timeLeftInRound = ROUND_TIME;
    while (timeLeftInRound >= 0) {
        io.sockets.emit('timeLeftInRound', timeLeftInRound);
        timeLeftInRound--;
        await sleep(1);
    }

    // TODO: io.sockets.emit('noMoreAnswering', ""); --> stops players from selecting the answer cards + turn cards face up
    
    
    // broadcast voting time left in the round
    let timeToVote = ROUND_TIME;
    while(timeToVote >= 0 && !voterHasVoted) {
        io.sockets.emit('timeLeftToVote', timeLeftInRound);
        timeToVote--;
        await sleep(1);
    }

    // TODO: tell the players the winning card
    // io.sockets.emit('winningCard', "");
    


    // broadcast resting time for the next round
    let restTimeLeft = REST_TIME;
    while (restTimeLeft >= 0) {
        io.sockets.emit('timeLeftToRest', restTimeLeft);
        restTimeLeft--;
        await sleep(1);
    }

    // next round
    gameRound();
};

io.on('connection', function(socket) {
    console.log("\x1b[42m%s\x1b[0m", 'A new player ' + socket.id + ' has connected');
    player = new Player(socket.id, 0, []);
    // TODO: DEAL MAX_HAND to each player's hand 
    players.add(player);
    
    // TODO: socket.on('answererPicksCard', function(answerString) {adds the [socket.id, answerString] to the playArea array});

    // TODO: socket.on('voterhasVoted' function(answerString) {... }); --> change voterHasVoted = true;


    socket.on('disconnect', function(socket) {
        let removedPlayer;
        players.find(function(player) {
            if (player.socketID == socket.id) {
                removedPlayer = player;
            }
        });
        players.remove(removedPlayer);
        console.log("\x1b[41m%s\x1b[0m", "Player " + socket.id + " has left");
    });
});

// Start server
http.listen(3000, function() {
    console.log("SERVER GAME STARTED ON PORT: 3000");
    // ADD CODE HERE TO:
    // bring them to waiting room
    gameRound();
})