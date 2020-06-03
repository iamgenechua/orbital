// ===================================================== START OF GLOBAL VARIABLES ===================================================== //

// import dependencies
let ArrayList = require('arraylist');
let HashMap = require('hashmap');
let express = require('express')();
let http = require('http').Server(express);
let io = require('socket.io')(http);

// import cards from the database
let cardDeck = require('./database');

// // declare global variables
// let ROUND_TIME = 10;
// let REST_TIME = 1;
// let MAX_HAND = 5;
// let NUMBER_ROUNDS = 10;

// let voterIndex = 0; // the index of the voter. Loop around with %.
// let questions = cardDeck.questionsDatabase; // array of questions
// let answers = cardDeck.answersDatabase; // array of answers
// let questionIndex = 0;
// let answerIndex = 0;
// let voterHasVoted = false;

// // Create a mutable arraylist of users playing
// let players = new ArrayList;
// // Create a mutable array of the cards in the play area
// let playArea = [];


// Constructor for player whenever someone joins the server
function Player(socketID, score, hand = [], name) {
    this.socketID = socketID;
    this.score = score;
    this.hand = hand;
    this.name = name;
}

// Create a mutable hashmap with roomName being the Key and json object containing the room info as Value
var roomMap = new HashMap();

// Create a mutable hashmap to keep track of which socketID belongs to which room
var roomNameSocketIdMap = new HashMap();

// Create server
express.get('/', function(req, res) {
    res.sendFile('index.html', {root: __dirname});
});

// ===================================================== END OF GLOBAL VARIABLES ===================================================== //

// ===================================================== START OF FUNCTIONS ===================================================== //
// Create a room when player creates a room
function createRoom(roomName) {
    var gameRoom = {
        ROUND_TIME : 10,
        REST_TIME : 1,
        MAX_HAND : 5,
        NUMBER_ROUNDS : 10,
        voterIndex : 0, // the index of the voter. Loop around with %.
        questions : cardDeck.questionsDatabase.slice(), // array of questions
        answers : cardDeck.answersDatabase.slice(), // array of answers
        questionIndex : 0,
        answerIndex : 0,
        voterHasVoted : false,
        // Create a mutable arraylist of users playing
        players : new ArrayList,
        playerNames : new ArrayList,
        // Create a mutable array of the cards in the play area
        playArea : []
    }
    roomMap.set(roomName, gameRoom);// Create a Key-Value pair of roomName with room attributes
}

// Adds a player to a game room
// function joinRoom(roomName, player) {
//     var gameRoom = roomMap.get(roomName);
//     gameRoom.players.push(player);
// }

// Create a player when player connects to Server
function createPlayer(roomName, socketID, name) {
    roomNameSocketIdMap.set(socketID, roomName);// register ID-roomName relationship inside the map
    var gameRoom = roomMap.get(roomName);
    player = new Player(socketID, 0, [], name);
    for (let i = 0; i < gameRoom.MAX_HAND; i++) {
        let answerPosition = gameRoom.answerIndex % gameRoom.answers.length; // prevent arrayOutOfBoundsException
        player.hand.push(gameRoom.answers[answerPosition]); // deal MAX_HAND to each player's hand upon connection
        gameRoom.answerIndex++;
    }
    gameRoom.players.add(player);
    gameRoom.playerNames.add(name);// to keep track of playerNames for the sake of namelist
    io.to(player.socketID).emit('answer', player.hand); // emitting an array
}

// Reset and/or update variables before the round starts
function updateVariables(roomName) {
    var gameRoom = roomMap.get(roomName);

    console.log("\x1b[5m%s\x1b[0m", "Round Starting now"); // logs the start of the round. (Testing purposes)
    //console.log("\x1b[33m%s\x1b[0m", "Total online players: " + gameRoom.players.length); // logs how many players playing this round. To change to emitting the list of players online
    gameRoom.voterHasVoted = false; // reset voter to state to haven't voted yet

    // update playArea
    gameRoom.playArea.length = 0; // clear the play Area
    io.in(roomName).emit('updatePlayArea', gameRoom.playArea); // emit the updated play area

    // update player scores
    io.in(roomName).emit('updatePlayerScores', gameRoom.players); // emit the updated list of players and their respective scores (client side not done)
}

// Change player turn
function changeVoter(roomName) {
    var gameRoom = roomMap.get(roomName);

    totalPlayers = gameRoom.players.length // get the total number of players in the game
    if (totalPlayers == 0) { // if no one playing
        console.log("\x1b[31m%s\x1b[0m", "Cannot assign voter. No one playing"); // (Testing purposes)
    } else {
        voterForTheRound = gameRoom.voterIndex % totalPlayers; // change the voter for the round
        for (let i = 0; i < totalPlayers; i++) {
            if (i == voterForTheRound) {
                // Emit voting rights to the client
                voter = gameRoom.players.get(i);
                io.to(voter.socketID).emit('voter', 0);
            } else {
                // Emit answering rights to the client
                answerer = gameRoom.players.get(i);
                io.to(answerer.socketID).emit('answerer', 0);
            }
        }
        gameRoom.voterIndex++;
    }
};

// helper function sleep
function sleep(sec) {
    return new Promise(resolve => setTimeout(resolve, sec*1000));
}

// helper function to deal question card for all players to see
function dealQuestionCard(roomName) {
    var gameRoom = roomMap.get(roomName);
    let questionPosition = gameRoom.questionIndex % gameRoom.questions.length; // prevent arrayOutOfBoundsException
    io.in(roomName).emit('question', gameRoom.questions[questionPosition]); // emit the question from the shuffled array
    gameRoom.questionIndex++;
}
// helper function to deal individual answer cards to each player
function dealAnswerCards(roomName) {
    var gameRoom = roomMap.get(roomName);
    try {
        // console.log("Player arr size: " + gameRoom.players.length);
        for (let player = 0; player < gameRoom.players.length; player++) {
            let answerPosition = gameRoom.answerIndex % gameRoom.answers.length; // prevent arrayOutOfBoundsException
            let currentPlayer = gameRoom.players.get(player);
            if (currentPlayer.hand.length < gameRoom.MAX_HAND) { // if the player's hand doesn't have the maximum number of cards, deal card
                currentPlayer.hand.push(gameRoom.answers[answerPosition]);
                console.log(currentPlayer.socketID); // (Testing purposes to see who is dealt the card)
                gameRoom.answerIndex++;
            }
            io.to(currentPlayer.socketID).emit('answer', currentPlayer.hand); // emitting an array
        }
    } catch (e) {
        console.log(e.message);
    }
}

function noMoreAnswering(roomName) {
    io.in(roomName).emit('noMoreAnswering', 0); // signal to all clients that they cannot submit answers anymore
}

// ===================================================== END OF FUNCTIONS ===================================================== //

// ===================================================== START OF MAIN LOGIC ===================================================== //
async function gameRound(roomName) {
    // the current game room
    var gameRoom = roomMap.get(roomName);
    
    // reset round and update variables
    updateVariables(roomName);
    
    // change Voter
    changeVoter(roomName);

    // deal question cards for all to see
    dealQuestionCard(roomName);

    // deal answer cards to all players if needed
    dealAnswerCards(roomName);

    // ** in client side ** , socket.on('selectAnswer', function(answerString) { ... }); to get answer from client and submit to play area

    // broadcast timer for the time left in round
    let timeLeftInRound = gameRoom.ROUND_TIME;
    while (timeLeftInRound >= 0) {
        io.in(roomName).emit('timeLeftInRound', timeLeftInRound);
        timeLeftInRound--;
        await sleep(1);
    }

    // signal no more time left to choose answer card. Stop players from selecting answer cards. Update the play area once again to make cards visible
    noMoreAnswering(roomName);

    // ** in client side ** , socket.on('voterHasVoted', function(answerString) { ... }); to get voted answer from the voter client
    
    // broadcast voting time left in the round
    let timeToVote = gameRoom.ROUND_TIME;
    while(timeToVote >= 0 && !gameRoom.voterHasVoted) {
        io.in(roomName).emit('timeLeftToVote', timeToVote);
        timeToVote--;
        await sleep(1);
    }

    // broadcast resting time for the next round
    let restTimeLeft = gameRoom.REST_TIME;
    while (restTimeLeft >= 0) {
        io.in(roomName).emit('timeLeftToRest', restTimeLeft); // I didn't add this in the client side
        restTimeLeft--;
        await sleep(1);
    }

    // next round
    gameRound(roomName);
};

// ===================================================== END OF MAIN LOGIC ===================================================== //


// ===================================================== START OF SOCKET LISTENERS ===================================================== //
io.on('connection', function(socket) {
    console.log("\x1b[42m%s\x1b[0m", 'A new player ' + socket.id + ' has connected');

    // socket listener to get roomID and username when a new player joins
    socket.on("joinRoom", function(userInfo) {
        roomName = userInfo.RoomID;
        userName = userInfo.Username;
        console.log(userName);
        
        if (!roomMap.has(roomName)) {
            createRoom(roomName);  
        }
        createPlayer(roomName, socket.id, userName);
        socket.join(roomName);

        var gameRoom = roomMap.get(roomName);
        console.log(gameRoom.players.length);
        io.in(roomName).emit("newPlayerJoined", gameRoom.playerNames);// inform the waiting lobby of this room that a new player has joined
    });


    // socket listener to get the game started for a particular room when a player decides to start
    socket.on("startGameServer", function(roomName) {
        io.in(roomName).emit("startGameClient");
        gameRound(roomName);
    });
    
    // socket listener to get the answer string that the client selects
    socket.on('selectAnswer', function(answerInfo) {
        roomName = answerInfo.roomName;
        var gameRoom = roomMap.get(roomName);
        answerString = answerInfo.answerString;

        let submissionPair = new Array(answerString, socket.id); // create an Array Pair with the answerString and the player's socketID
        gameRoom.playArea.push(submissionPair); // push the array pair into the array play area

        // to remove the string from the player's hand
        let updatedPlayer;
        gameRoom.players.find(function(player) {
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
        for (let i = 0; i < gameRoom.playArea.length; i++) {
            tempDisplay.push(gameRoom.playArea[i][0]);
        }

        io.in(roomName).emit('updatePlayArea', tempDisplay); // emit the playArea with the added card
        io.sockets.to(updatedPlayer.socketID).emit('answer', updatedPlayer.hand); // emitting an array
    });

    // socket listener to get the answer string voted by the voter
    socket.on('voterHasVoted', function(votedInfo) {
        roomName = votedInfo.roomName;
        var gameRoom = roomMap.get(roomName);
        votedAnswerString = votedInfo.votedAnswer;
        
        gameRoom.voterHasVoted = true; // to skip the timer when the voter has voted
        
        // find the player that played the winning card and increase his score
        for (let i = 0; i < gameRoom.playArea.length; i++) { // remember that playArea contains arrayPairs of [answerString, socketID]
            if (gameRoom.playArea[i][0] === gameRoom.votedAnswerString) { // look for the player with the winning card
                let winningSocketID = gameRoom.playArea[i][1]; // get the socketID of the winning player
                gameRoom.players.find(function(winningPlayer) {
                    if (winningPlayer.socketID == winningSocketID) {
                        winningPlayer.score += 1; // add 1 to the score of the winning player;
                        
                        io.in(roomName).emit('winningPlayer', new Array(winningPlayer.socketID, votedAnswerString) ); // right now, emit socketID, in the future, emit the name
                    }
                });
                break;
            }
        }
    });


    socket.on('disconnect', function() {
        if (roomNameSocketIdMap.has(socket.id)) {
            roomName = roomNameSocketIdMap.get(socket.id);
            var gameRoom = roomMap.get(roomName);
            let removedPlayer;
            gameRoom.players.find(function(player) {
                if (player.socketID == socket.id) {
                    removedPlayer = player;
                }
            });
            gameRoom.players.remove(removedPlayer);
            console.log("\x1b[41m%s\x1b[0m", "Player " + socket.id + " has left");
        }
    });
});

// Start server
http.listen(3000, function() {
    console.log("SERVER GAME STARTED ON PORT: 3000");
    // ADD CODE HERE TO:
    // bring them to waiting room
    
    // NOTICE: Because i start the game round ASAP, the players have to wait for one round to pass after connection. 
    // but once you bring them to game room, and the game round starts when the press the button, i think this problem will go away
    //gameRound();
})

// ===================================================== END OF SOCKET LISTENERS ===================================================== //