const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const CodeBlock = require('./models/CodeBlock');
const connectDB = require('./db');

const app = express();
app.use(express.json());

const cors = require('cors');
app.use(cors());

// Connect to MongoDB
connectDB();

// Create an HTTP server
const server = http.createServer(app);

// Set up Socket.IO server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store the state of mentors, students, and code per room
const codeBlockState = {};

// Handle new client connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // When a user joins a code block page
  socket.on('joinCodeBlock', (codeBlockId) => {
    if (!codeBlockState[codeBlockId]) {
      codeBlockState[codeBlockId] = {
        mentorId: null,
        studentsCount: 0,
        currentCode: '', // Keep track of the latest code for this code block
      };
    }

    const currentRoom = codeBlockState[codeBlockId];

    // Assign mentor if no mentor exists for the code block
    if (!currentRoom.mentorId) {
      currentRoom.mentorId = socket.id;
      socket.emit('role', 'mentor'); // Inform the client they are the mentor
      console.log(`Mentor assigned to code block ${codeBlockId}: ${socket.id}`);
    } else {
      // Otherwise, the client is a student
      currentRoom.studentsCount++;
      socket.emit('role', 'student');
    }

    // Join the specific room for this code block
    socket.join(codeBlockId);

    // Send the latest code and student count to the newly joined user
    socket.emit('codeUpdate', currentRoom.currentCode);
    socket.emit('studentsCountUpdate', currentRoom.studentsCount);

    // Broadcast the updated student count to everyone in the room
    io.to(codeBlockId).emit('studentsCountUpdate', currentRoom.studentsCount);

    // Handle code updates
    socket.on('codeChange', (newCode) => {
      currentRoom.currentCode = newCode; // Update the latest code in the room state
      io.to(codeBlockId).emit('codeUpdate', newCode); // Broadcast code changes to all clients in the room
    });

    // Handle mentor or student leaving
    socket.on('disconnect', () => {
      if (currentRoom.mentorId === socket.id) {
        // If the mentor leaves, notify students and reset the room
        currentRoom.mentorId = null;
        io.to(codeBlockId).emit('mentorLeft'); // Notify students that the mentor has left
        console.log(`Mentor left code block ${codeBlockId}: ${socket.id}`);
      } else {
        // If a student leaves, just decrease the student count
        currentRoom.studentsCount--;
        io.to(codeBlockId).emit('studentsCountUpdate', currentRoom.studentsCount);
        console.log(`Student left code block ${codeBlockId}: ${socket.id}`);
      }

      // Clean up if there are no students and no mentor left in the room
      if (currentRoom.studentsCount <= 0 && !currentRoom.mentorId) {
        delete codeBlockState[codeBlockId];
        console.log(`Cleaned up state for code block ${codeBlockId}`);
      }
    });
  });
});

// Route to fetch code blocks
app.get('/api/codeblocks', async (req, res) => {
  try {
    const codeBlocks = await CodeBlock.find();
    res.json(codeBlocks);
  } catch (error) {
    console.error('Error fetching code blocks:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Route to fetch a specific code block by ID
app.get('/api/codeblock/:id', async (req, res) => {
  try {
    const codeBlock = await CodeBlock.findById(req.params.id);
    if (!codeBlock) {
      return res.status(404).json({ message: 'Code block not found' });
    }
    res.json(codeBlock);
  } catch (error) {
    console.error('Error fetching specific code block:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Route to fetch the current rating for a code block
app.get('/api/codeblock/:id/rating', async (req, res) => {
  try {
    const codeBlock = await CodeBlock.findById(req.params.id);
    if (!codeBlock) {
      return res.status(404).json({ message: 'Code block not found' });
    }
    // Calculate the average rating
    const averageRating = codeBlock.numRatings === 0 ? 0 : codeBlock.totalRating / codeBlock.numRatings;
    res.json({ averageRating, numRatings: codeBlock.numRatings });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Route to submit a new rating for a code block
app.post('/api/codeblock/:id/rating', async (req, res) => {
  try {
    const { rating } = req.body; // Rating should be a number between 1 and 5
    const codeBlock = await CodeBlock.findById(req.params.id);

    if (!codeBlock) {
      return res.status(404).json({ message: 'Code block not found' });
    }

    // Update the totalRating and numRatings
    codeBlock.totalRating += rating;
    codeBlock.numRatings += 1;

    await codeBlock.save();

    // Calculate the new average rating
    const averageRating = codeBlock.totalRating / codeBlock.numRatings;

    res.json({ averageRating, numRatings: codeBlock.numRatings });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Start the server
server.listen(4000, () => console.log('Server running on port 4000'));
