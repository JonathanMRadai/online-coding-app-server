const mongoose = require('mongoose');
const connectDB = require('./db');
const CodeBlock = require('./models/CodeBlock');

const seedData = async () => {
  await connectDB();

  const codeBlocks = [
    {
      codeBlockName: 'Async case',
      initialCode: `async function fetchData() { /* Your code here */ }`,
      solution: 'async function fetchData() {}'
    },
    {
      codeBlockName: 'Loop Example',
      initialCode: `for (let i = 0; i < 10; i++) { console.log(i); }`,
      solution: 'for (let i = 0; i < 10; i++) { console.log(i); }'
    },
    {
      codeBlockName: 'Function Example',
      initialCode: `function add(a, b) { return a + b; }`,
      solution: 'function add(a, b) { return a + b; }'
    },
    {
      codeBlockName: 'Array Manipulation',
      initialCode: `let arr = [1, 2, 3]; arr.push(4);`,
      solution: 'let arr = [1, 2, 3]; arr.push(4);'
    }
  ];

  await CodeBlock.insertMany(codeBlocks);
  console.log('Database seeded with code blocks!');
  mongoose.connection.close();
};

seedData();
