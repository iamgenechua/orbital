let fs = require('fs')

questionsDatabase = [];
answersDatabase = [];

// add questions to questionsDatabase. * In the future, this will be replaced by a function that parses strings from an Excel file *
// for (let question = 0; question < 30; question++) {
//     questionsDatabase.push("Question " + question);
// }

questionsDatabase = fs.readFileSync('questions.csv', {encoding: 'utf8'});
questionsDatabase = questionsDatabase.split('\n');

// add answers to answersDatabase. * In the future, this will be replaced by a function that parses strings from an Excel file *
// for (let answer = 0; answer < 30; answer++) {
//     answersDatabase.push("Answer " + answer);
// }

answersDatabase = fs.readFileSync('answers.csv', { encoding : 'utf8'});
answersDatabase = answersDatabase.split('\n');

// arrays to be exported to index.js
module.exports = {questionsDatabase, answersDatabase};