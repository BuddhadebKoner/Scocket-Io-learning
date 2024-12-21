const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (HTML, CSS, client-side JS)
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users
let users = [];

io.on('connection', (socket) => {
  // console.log('A user connected');

  // Handle user joining with a username
  socket.on('user joined', (username) => {
    socket.username = username;
    users.push(username);
    io.emit('user joined', { username, users });
  });

  // Listen for chat messages
  socket.on('chat message', (msg) => {
    io.emit('chat message', { username: socket.username, msg });
  });

  // Handle user disconnecting
  socket.on('disconnect', () => {
    // console.log('user disconnected');
    users = users.filter((user) => user !== socket.username);
    io.emit('user left', { username: socket.username, users });
  });
});

// Start server on port 3000
server.listen(3000, () => {
  console.log('listening on *:3000');
});
