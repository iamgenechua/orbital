questionsDatabase = [];
answersDatabase = [];

// add questions to questionsDatabase. * In the future, this will be replaced by a function that parses strings from an Excel file *
for (let question = 0; question < 30; question++) {
    questionsDatabase.push("Question " + question);
}

// add answers to answersDatabase. * In the future, this will be replaced by a function that parses strings from an Excel file *
for (let answer = 0; answer < 30; answer++) {
    answersDatabase.push("Answer " + answer);
}

shuffleDeck(questionsDatabase); // shuffle the questions deck
shuffleDeck(answersDatabase); // shuffle the answers deck

// arrays to be exported to index.js
module.exports = {questionsDatabase, answersDatabase};




// FISHER-YATES SHUFFLE ALGORITHM
function shuffleDeck(deckArray) {
    const deckSize = deckArray.length; // get size of the deck
    // start from last element and swap one by one
    // don't need to run till first element. Hence position > 0
    for (let position = deckSize - 1; position > 0; position--) {
        let randIndex = Math.floor(Math.random() * (position+1)); // pick a random index from 0 to position
        // swap newDeck[position] with element at random index
        let temp = deckArray[position];
        deckArray[position] = deckArray[randIndex];
        deckArray[randIndex] = temp;
    }
}