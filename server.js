// server.js

const express = require('express'); // Import Express to build the server.
const http = require('http'); // Import Node's HTTP module to create an HTTP server.
const { Server } = require('socket.io'); // Import Socket.IO for real-time WebSocket communication.
const CodeBlock = require('./models/CodeBlock'); // Import the CodeBlock model to interact with the MongoDB database.
const connectDB = require('./db'); // Import the database connection function.

const app = express(); // Create an Express app instance.
app.use(express.json()); // Middleware to parse JSON request bodies.

const cors = require('cors'); // Import CORS to handle cross-origin requests.
app.use(cors()); // Enable CORS for all requests.

// Connect to MongoDB
connectDB(); // Establish the connection to the MongoDB database.

// Create an HTTP server from the Express app.
const server = http.createServer(app);

// Set up the Socket.IO server for real-time communication.
const io = new Server(server, {
  cors: {
    origin: '*', // Allow requests from any origin.
    methods: ['GET', 'POST'], // Allow GET and POST requests.
  },
});

// Store the state of mentors, students, and code for each code block (room).
const codeBlockState = {};

// Handle new client connections.
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id); // Log the new client's ID.

  // Handle when a user joins a specific code block.
  socket.on('joinCodeBlock', (codeBlockId) => {
    // Initialize the code block state if it doesn't exist.
    if (!codeBlockState[codeBlockId]) {
      codeBlockState[codeBlockId] = {
        mentorId: null, // Track the mentor's ID.
        studentsCount: 0, // Track the number of students in the room.
        currentCode: '', // Store the latest version of the code.
      };
    }

    const currentRoom = codeBlockState[codeBlockId];

    // Assign the client as a mentor if no mentor exists for the code block.
    if (!currentRoom.mentorId) {
      currentRoom.mentorId = socket.id;
      socket.emit('role', 'mentor'); // Notify the client that they are the mentor.
      console.log(`Mentor assigned to code block ${codeBlockId}: ${socket.id}`);
    } else {
      // Otherwise, the client is a student.
      currentRoom.studentsCount++; // Increment the student count.
      socket.emit('role', 'student'); // Notify the client that they are a student.
    }

    // Join the WebSocket room for this specific code block.
    socket.join(codeBlockId);

    // Send the latest code and student count to the newly joined user.
    socket.emit('codeUpdate', currentRoom.currentCode);
    socket.emit('studentsCountUpdate', currentRoom.studentsCount);

    // Broadcast the updated student count to all users in the room.
    io.to(codeBlockId).emit('studentsCountUpdate', currentRoom.studentsCount);

    // Handle when a client submits a code update.
    socket.on('codeChange', (newCode) => {
      currentRoom.currentCode = newCode; // Update the latest code in the room state.
      io.to(codeBlockId).emit('codeUpdate', newCode); // Broadcast the code update to all clients in the room.
    });

    // Handle when the solution is matched.
    socket.on('solutionMatched', (codeBlockId) => {
      io.to(codeBlockId).emit('solutionMatched'); // Notify all clients in the room that the solution was matched.
    });

    // Handle when a client disconnects (either mentor or student).
    socket.on('disconnect', () => {
      if (currentRoom.mentorId === socket.id) {
        // If the mentor leaves, notify students and reset the room's mentor state.
        currentRoom.mentorId = null;
        io.to(codeBlockId).emit('mentorLeft'); // Notify students that the mentor has left.
        console.log(`Mentor left code block ${codeBlockId}: ${socket.id}`);
      } else {
        // If a student leaves, just decrease the student count.
        currentRoom.studentsCount--;
        io.to(codeBlockId).emit('studentsCountUpdate', currentRoom.studentsCount);
        console.log(`Student left code block ${codeBlockId}: ${socket.id}`);
      }

      // Clean up the room state if no students or mentor remain.
      if (currentRoom.studentsCount <= 0 && !currentRoom.mentorId) {
        delete codeBlockState[codeBlockId]; // Remove the room from memory.
        console.log(`Cleaned up state for code block ${codeBlockId}`);
      }
    });
  });
});

// REST API route to fetch all code blocks.
app.get('/api/codeblocks', async (req, res) => {
  try {
    const codeBlocks = await CodeBlock.find(); // Fetch all code blocks from MongoDB.
    res.json(codeBlocks); // Send the code blocks as JSON.
  } catch (error) {
    console.error('Error fetching code blocks:', error);
    res.status(500).json({ message: 'Server Error' }); // Return a 500 error if something goes wrong.
  }
});

// REST API route to fetch a specific code block by its ID.
app.get('/api/codeblock/:id', async (req, res) => {
  try {
    const codeBlock = await CodeBlock.findById(req.params.id); // Find the code block by its ID.
    if (!codeBlock) {
      return res.status(404).json({ message: 'Code block not found' }); // Return 404 if the code block doesn't exist.
    }
    res.json(codeBlock); // Send the code block as JSON.
  } catch (error) {
    console.error('Error fetching specific code block:', error);
    res.status(500).json({ message: 'Server Error' }); // Return a 500 error if something goes wrong.
  }
});

// REST API route to fetch the current rating for a specific code block.
app.get('/api/codeblock/:id/rating', async (req, res) => {
  try {
    const codeBlock = await CodeBlock.findById(req.params.id); // Find the code block by its ID.
    if (!codeBlock) {
      return res.status(404).json({ message: 'Code block not found' }); // Return 404 if the code block doesn't exist.
    }
    // Calculate the average rating of the code block.
    const averageRating = codeBlock.numRatings === 0 ? 0 : codeBlock.totalRating / codeBlock.numRatings;
    res.json({ averageRating, numRatings: codeBlock.numRatings }); // Send the average rating as JSON.
  } catch (error) {
    res.status(500).json({ message: 'Server Error' }); // Return a 500 error if something goes wrong.
  }
});

// REST API route to submit a new rating for a specific code block.
app.post('/api/codeblock/:id/rating', async (req, res) => {
  try {
    const { rating } = req.body; // Get the rating from the request body (should be between 1 and 5).
    const codeBlock = await CodeBlock.findById(req.params.id); // Find the code block by its ID.

    if (!codeBlock) {
      return res.status(404).json({ message: 'Code block not found' }); // Return 404 if the code block doesn't exist.
    }

    // Update the total rating and the number of ratings.
    codeBlock.totalRating += rating;
    codeBlock.numRatings += 1;

    await codeBlock.save(); // Save the updated code block.

    // Calculate the new average rating.
    const averageRating = codeBlock.totalRating / codeBlock.numRatings;

    res.json({ averageRating, numRatings: codeBlock.numRatings }); // Send the new average rating as JSON.
  } catch (error) {
    res.status(500).json({ message: 'Server Error' }); // Return a 500 error if something goes wrong.
  }
});

// Start the server and listen on port 4000.
server.listen(4000, () => console.log('Server running on port 4000'));
