const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const sessions = {}; // In-memory sessions

/* 
CURRENT IMPLEMENTATIONS:
CREATE USER /createuser
LOGIN /login
CHAT WITH HISTORY LOG (OPENAI GPT3.5) /chat

NEXT:
PROFILING :(
SUMMARY OF CONTENTS ??
    DIRECT
SOURCE CHECK (GPT OR GEMINI) 
*/

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Function to start a new session for a user
function startSession(username) {
  if (!sessions[username]) {
    sessions[username] = {
      conversationHistory: [],
      currentState: 'idle' // Initial state
      // Add other session data as needed
    };
  }
}
  // Functions to log conversation (replace with your implementations)
  function addToConversation(username, message) {
    if (!sessions[username]) {
      sessions[username] = { conversationHistory: [] };
    }
    sessions[username].conversationHistory.push(message);
  }
  
  function saveConversationToFile(username, conversation) {
    const filename = `${username}_conversations.json`;
    let conversations = [];
  
    try {
      if (fs.existsSync(filename)) {
        const data = fs.readFileSync(filename, 'utf8');
        conversations = JSON.parse(data);
      }
  
      conversations.push(conversation);
      fs.writeFileSync(filename, JSON.stringify(conversations, null, 2), 'utf8');
  
      console.log(`Conversation with ${username} saved successfully.`);
    } catch (error) {
      console.error(`Error saving conversation with ${username}:`, error);
    }
  }
// Function to add a message to the conversation history of a session
function addToConversation(username, message) {
    if (sessions[username]) {
      sessions[username].conversationHistory.push(message);
    } else {
      console.error(`Session for ${username} does not exist.`);
    }
  }
  
  // Function to save conversation to a JSON file
  function saveConversationToFile(username, conversation) {
    const filename = `${username}_conversations.json`;
    let conversations = [];
  
    try {
      // Read existing conversations from file
      if (fs.existsSync(filename)) {
        const data = fs.readFileSync(filename, 'utf8');
        conversations = JSON.parse(data);
      }
  
      // Append new conversation
      conversations.push(conversation);
  
      // Write updated conversations back to file
      fs.writeFileSync(filename, JSON.stringify(conversations, null, 2), 'utf8');
  
      console.log(`Conversation with ${username} saved successfully.`);
    } catch (error) {
      console.error(`Error saving conversation with ${username}:`, error);
    }
  }

// Function to verify hashed password
async function verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

app.post('/createuser', async (req, res) => {
    const { username, password } = req.body;
  
    if (!username || !password) {
      return res.status(400).send("Bad Request: 'username' and 'password' are required.");
    }
  
    try {
      // Read the existing users from users.json
      const data = fs.readFileSync("./users.json", "utf-8");
      const users = JSON.parse(data);
  
      // Check for duplicate username
      const duplicateUser = users.find(user => user.username === username);
      if (duplicateUser) {
        return res.status(409).send("Conflict: Username already exists.");
      }
  
      // Generate a sequential ID
      const newId = users.length ? users[users.length - 1].id + 1 : 1;
  
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create the new user object
      const newUser = {
        id: newId,
        username: username,
        password: hashedPassword
      };
  
      // Add the new user to the users array
      users.push(newUser);
  
      // Write the updated users array back to the file
      fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
  
      // Start a session for the new user
      startSession(newUser.id);
  
      // Send a success response
      res.status(201).send("User created successfully.");
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).send("An error occurred while creating the user.");
    }
  });



// POST endpoint for user interacting with AI
app.post('/chat', async (req, res) => {
  const { username, message } = req.body;

  if (!username || !message) {
    return res.status(400).send("Bad Request: 'username' and 'message' are required.");
  }

  try {
    // Ensure session is started for the user
    startSession(username);

    // Interact with OpenAI API
    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: message }
      ],
      model: 'gpt-3.5-turbo'
    });

    const response = completion.choices[0].message.content;

    // Add user input and AI response to session conversation history
    addToConversation(username, { role: 'user', content: message });
    addToConversation(username, { role: 'system', content: response });

    // Save conversation to file
    const conversation = {
      username: username,
      timestamp: new Date().toISOString(),
      messages: sessions[username].conversationHistory // Ensure sessions[username] exists
    };

    saveConversationToFile(username, conversation);

    // Send the AI response back to the client
    res.json({ response });

  } catch (error) {
    console.error('Error interacting with OpenAI:', error);
    res.status(500).json({ error: error.message });
  }
});



  
// Login endpoint
app.post('/login', async (req, res) => {
    const { username, password, answers } = req.body;
    console.log(req.body);
  
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
  
    try {
      // Read users from JSON file
      const users = JSON.parse(fs.readFileSync("./users.json", 'utf8'));
  
      // Find user by username
      const user = users.find(u => u.username === username);
  
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
  
      // Verify password
      const passwordMatch = await verifyPassword(password, user.password);
      if (passwordMatch) {
        // Passwords match, login successful
        res.json({ message: 'Login successful!', userId: user.id });
      } else {
        // Passwords do not match
        res.status(401).json({ error: 'Incorrect password.' });
      }
    } catch (error) {
      console.error('Error reading users file or verifying password:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });
  const GEMINI_API_KEY = "AIzaSyBpl7lBXkcqH1rdqgpou6idsUbhiB2N-Nw";
  const GEMINI_API_ENDPOINT = "https://www.wikipedia.org/";


  // Access your API key as an environment variable (see "Set up your API key" above)
  const genAI = new GoogleGenerativeAI(process.env.API_KEY);
  
  // ...
  
  // The Gemini 1.5 models are versatile and work with most use cases
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
  
  // ...
  // Function to get recommendations from Gemini API
  async function getRecommendations(domain) {
    try {
      const response = await axios.post(GEMINI_API_ENDPOINT, {
        domain: domain
      }, {
        headers: {
          'Authorization': `Bearer ${GEMINI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
  
      return response.data;
    } catch (error) {
      console.error('Error fetching recommendations from Gemini API:', error);
      throw error;
    }
  }

  


  // POST endpoint to recommend resources based on domain
  app.post('/recommend', async (req, res) => {
    const { username, domain } = req.body;
    const message = `Give me website links to online resources about ${domain} to learn, and summarize the content into bullet points that's easy to understand`

    if (!username || !message) {
      return res.status(400).send("Bad Request: 'username' and 'message' are required.");
    }
  
    try {
      // Ensure session is started for the user
      startSession(username);
  
      // Interact with OpenAI API
      const completion = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: message }
        ],
        model: 'gpt-3.5-turbo'
      });
  
      const response = completion.choices[0].message.content;
  
      // Add user input and AI response to session conversation history
      addToConversation(username, { role: 'user', content: message });
      addToConversation(username, { role: 'system', content: response });
  
      // Save conversation to file
      const conversation = {
        username: username,
        timestamp: new Date().toISOString(),
        messages: sessions[username].conversationHistory // Ensure sessions[username] exists
      };
  
      saveConversationToFile(username, conversation);
  
      // Send the AI response back to the client
      res.json({ response });
  
    } catch (error) {
      console.error('Error interacting with OpenAI:', error);
      res.status(500).json({ error: error.message });
    }
  });
  



//-------------------------------------------------------------------------------------------
// POST endpoint for profiling user
// POST endpoint for profiling user dynamically
app.post('/profiling', async (req, res) => {
    const { username, domain , answersU} = req.body;
  
    if (!username || !domain) {
      return res.status(400).json({ error: "Bad Request: 'username' and 'domain' are required." });
    }
  
    try {
      // Function to interact with OpenAI to generate questions dynamically
      async function generateQuestions(domain) {
        // Simulate generating questions for the domain
        const questions = [`What is ${domain}?`, `Explain ${domain} in detail.`, `What are the main concepts of ${domain}?`];
        return questions;
      }
  
      // Function to simulate checking answers against dynamically generated correct answers
      async function checkAnswers(username, domain, questions, answersU) {
        // Simulate generating correct answers
        // const correctAnswers = [`Correct answer for "What is ${domain}?" is ...`, `Correct answer for "Explain ${domain} in detail." is ...`, 
        //     `Correct answer for "What are the main concepts of ${domain}?" is ...`];
        const correctAnswers = ["1", "2", "3"];
        let score = 0;
        for (let i = 0; i < answersU.length; i++) {
          if (answersU[i].toLowerCase() === correctAnswers[i].toLowerCase()) {
            score++;
          }
        }
        
        return score;
      }
  
      // Generate questions dynamically from OpenAI
      const questions = await generateQuestions(domain);
  
      // Simulate presenting questions to the user and receiving answers
    //   const answers = ['user answer 1', 'user answer 2', 'user answer 3']; // Replace with actual user input
      const answers = answersU;
  
      // Simulate checking answers against dynamically generated correct answers
      const score = await checkAnswers(username, domain, questions, answersU);
  
      // Determine proficiency level based on score
      let proficiencyLevel;
      if (score === 0 || score === 1) {
        proficiencyLevel = 'beginner';
      } else if (score === 2) {
        proficiencyLevel = 'intermediate';
      } else if (score === 3) {
        proficiencyLevel = 'advanced';
      } else {
        return res.status(400).json({ error: 'Invalid score. Something went wrong.' });
      }
  
      // Add user input and system responses to session conversation history
      addToConversation(username, { role: 'system', content: `Generated questions for ${domain}: ${questions.join(', ')}` });
      addToConversation(username, { role: 'user', content: `Answers provided: ${answers.join(', ')}` });
      addToConversation(username, { role: 'system', content: `Scored ${score} out of 3. Proficiency level: ${proficiencyLevel}` });
  
      // Save conversation to file
      const conversation = {
        username: username,
        timestamp: new Date().toISOString(),
        messages: sessions[username] ? sessions[username].conversationHistory : [] // Ensure sessions[username] exists
      };
  
      saveConversationToFile(username, conversation);
  
      // Example: Save the proficiency level to user profile or sessions
      // sessions[username].proficiencyLevel = proficiencyLevel;
  
      res.json({ message: `Profiling completed for ${username}. Proficiency level in ${domain} is ${proficiencyLevel}.` });
    } catch (error) {
      console.error('Error profiling user:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

//-----------------------------------------------------------------------------------------------------------------

// Start the server
const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
