// ===================================================== START OF GLOBAL VARIABLES ===================================================== //

// import dependencies
let ArrayList = require('arraylist');
let express = require('express')();
let http = require('http').Server(express);
let io = require('socket.io')(http);

// import cards from the database
let cardDeck = require('./database');

// declare global variables
let ROUND_TIME = 10;
let REST_TIME = 1;
let MAX_HAND = 5;
let NUMBER_ROUNDS = 10;

let voterIndex = 0; // the index of the voter. Loop around with %.
let questions = cardDeck.questionsDatabase; // array of questions
let answers = cardDeck.answersDatabase; // array of answers
let questionIndex = 0;
let answerIndex = 0;
let voterHasVoted = false;

// Create a mutable arraylist of users playing
let players = new ArrayList;
// Create a mutable array of the cards in the play area
let playArea = [];


// Constructor for player whenever someone joins the server
function Player(socketID, score, hand = []) {
    this.socketID = socketID;
    this.score = score;
    this.hand = hand;
}

// Create server
express.get('/', function(req, res) {
    res.sendFile('index.html', {root: __dirname});
});

// ===================================================== END OF GLOBAL VARIABLES ===================================================== //

// ===================================================== START OF FUNCTIONS ===================================================== //
// Create a player when player connects to Server
function createPlayer(socketID) {
    player = new Player(socketID, 0, []);
    for (let i = 0; i < MAX_HAND; i++) {
        let answerPosition = answerIndex % answers.length; // prevent arrayOutOfBoundsException
        player.hand.push(answers[answerPosition]); // deal MAX_HAND to each player's hand upon connection
        answerIndex++;
    }
    players.add(player);
    io.sockets.to(player.socketID).emit('answer', player.hand); // emitting an array
}

// Reset and/or update variables before the round starts
function updateVariables() {
    console.log("\x1b[5m%s\x1b[0m", "Round Starting now"); // logs the start of the round. (Testing purposes)
    console.log("\x1b[33m%s\x1b[0m", "Total online players: " + players.length); // logs how many players playing this round. To change to emitting the list of players online
    voterHasVoted = false; // reset voter to state to haven't voted yet

    // update playArea
    playArea.length = 0; // clear the play Area
    io.sockets.emit('updatePlayArea', playArea); // emit the updated play area

    // update player scores
    io.sockets.emit('updatePlayerScores', players); // emit the updated list of players and their respective scores (client side not done)
}

// Change player turn
function changeVoter() {
    totalPlayers = players.length // get the total number of players in the game
    if (totalPlayers == 0) { // if no one playing
        console.log("\x1b[31m%s\x1b[0m", "Cannot assign voter. No one playing"); // (Testing purposes)
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
    let questionPosition = questionIndex % questions.length; // prevent arrayOutOfBoundsException
    io.sockets.emit('question', questions[questionPosition]); // emit the question from the shuffled array
    questionIndex++;
}
// helper function to deal individual answer cards to each player
function dealAnswerCards() {
    try {
        for (let player = 0; player < players.length; player++) {
            let answerPosition = answerIndex % answers.length; // prevent arrayOutOfBoundsException
            let currentPlayer = players.get(player);
            if (currentPlayer.hand.length < MAX_HAND) { // if the player's hand doesn't have the maximum number of cards, deal card
                currentPlayer.hand.push(answers[answerPosition]);
                console.log(currentPlayer.socketID); // (Testing purposes to see who is dealt the card)
                io.sockets.to(currentPlayer.socketID).emit('answer', currentPlayer.hand); // emitting an array
                answerIndex++;
            }
        }
    } catch (e) {
        console.log(e.message);
    }
}

function noMoreAnswering() {
    io.sockets.emit('noMoreAnswering', 0); // signal to all clients that they cannot submit answers anymore
}

// ===================================================== END OF FUNCTIONS ===================================================== //

// ===================================================== START OF MAIN LOGIC ===================================================== //
async function gameRound() {
    // reset round and update variables
    updateVariables();
    
    // change Voter
    changeVoter();

    // deal question cards for all to see
    dealQuestionCard();

    // deal answer cards to all players if needed
    dealAnswerCards();

    // ** in client side ** , socket.on('selectAnswer', function(answerString) { ... }); to get answer from client and submit to play area

    // broadcast timer for the time left in round
    let timeLeftInRound = ROUND_TIME;
    while (timeLeftInRound >= 0) {
        io.sockets.emit('timeLeftInRound', timeLeftInRound);
        timeLeftInRound--;
        await sleep(1);
    }

    // signal no more time left to choose answer card. Stop players from selecting answer cards. Update the play area once again to make cards visible
    noMoreAnswering();

    // ** in client side ** , socket.on('voterHasVoted', function(answerString) { ... }); to get voted answer from the voter client
    
    // broadcast voting time left in the round
    let timeToVote = ROUND_TIME;
    while(timeToVote >= 0 && !voterHasVoted) {
        io.sockets.emit('timeLeftToVote', timeToVote);
        timeToVote--;
        await sleep(1);
    }

    // broadcast resting time for the next round
    let restTimeLeft = REST_TIME;
    while (restTimeLeft >= 0) {
        io.sockets.emit('timeLeftToRest', restTimeLeft); // I didn't add this in the client side
        restTimeLeft--;
        await sleep(1);
    }

    // next round
    gameRound();
};

// ===================================================== END OF MAIN LOGIC ===================================================== //


// ===================================================== START OF SOCKET LISTENERS ===================================================== //
io.on('connection', function(socket) {
    console.log("\x1b[42m%s\x1b[0m", 'A new player ' + socket.id + ' has connected');
    
    // function to create player
    createPlayer(socket.id);
    
    
    // socket listener to get the answer string that the client selects
    socket.on('selectAnswer', function(answerString) {
        let submissionPair = new Array(answerString, socket.id); // create an Array Pair with the answerString and the player's socketID
        playArea.push(submissionPair); // push the array pair into the array play area

        // to remove the string from the player's hand
        let updatedPlayer;
        players.find(function(player) {
            if (player.socketID == socket.id) {
                updatedPlayer = player;
                updatedPlayer.hand.find(function(card) {
                    if (card === answerString) {
                        let pos = updatedPlayer.hand.indexOf(card); // get position of card
                        updatedPlayer.hand.splice(pos, 1); // remove that card from the hand
                    }
                })
            }
        });
        
        // The only purpose of this tempDisplay array is to just send in the list of strings WITHOUT the socketID.
        let tempDisplay = [];
        for (let i = 0; i < playArea.length; i++) {
            tempDisplay.push(playArea[i][0]);
        }

        io.sockets.emit('updatePlayArea', tempDisplay); // emit the playArea with the added card
        io.sockets.to(updatedPlayer.socketID).emit('answer', updatedPlayer.hand); // emitting an array
    });

    // socket listener to get the answer string voted by the voter
    socket.on('voterHasVoted', function(votedAnswerString) {
        voterHasVoted = true; // to skip the timer when the voter has voted
        
        // find the player that played the winning card and increase his score
        for (let i = 0; i < playArea.length; i++) { // remember that playArea contains arrayPairs of [answerString, socketID]
            if (playArea[i][0] === votedAnswerString) { // look for the player with the winning card
                let winningSocketID = playArea[i][1]; // get the socketID of the winning player
                players.find(function(winningPlayer) {
                    if (winningPlayer.socketID == winningSocketID) {
                        winningPlayer.score += 1; // add 1 to the score of the winning player;
                        
                        io.sockets.emit('winningPlayer', new Array(winningPlayer.socketID, votedAnswerString) ); // right now, emit socketID, in the future, emit the name
                    }
                });
                break;
            }
        }
    });


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
    
    // NOTICE: Because i start the game round ASAP, the players have to wait for one round to pass after connection. 
    // but once you bring them to game room, and the game round starts when the press the button, i think this problem will go away
    gameRound();
})

// ===================================================== END OF SOCKET LISTENERS ===================================================== //