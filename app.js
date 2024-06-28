const express = require('express');
const crypto = require('crypto');
const mineflayer = require('mineflayer');

const app = express();
const port = process.env.PORT || 3001;

// Function to generate a random 8-character username
function generateRandomUsername() {
    return crypto.randomBytes(4).toString('hex'); // Generates 8 hexadecimal characters
}

// Function to check for authentication
async function checkForAuth(serverIP, serverPort, username, authType) {
    return new Promise((resolve, reject) => {
        let bot;

        try {
            bot = mineflayer.createBot({
                host: serverIP,
                port: serverPort,
                username: username,
                auth: authType, // either 'offline' or 'mojang'
            });
        } catch (error) {
            console.error(`Failed to create bot: ${error.message}`);
            reject(new Error(`Failed to create bot: ${error.message}`));
            return;
        }

        bot.on('kicked', (reason) => {
            const reasonMessage = reason.toString(); // Convert reason to string for comparison
            try {
                const parsedReason = JSON.parse(reason);
                console.log(parsedReason.translate);

                if (parsedReason.translate === "multiplayer.disconnect.unverified_username") {
                    resolve({ result: 'unverified_username' }); // Return "unverified_username"
                } else if (reasonMessage.toLowerCase().includes("white")) {
                    resolve({ result: 'whitelist' }); // Return "whitelist_issue"
                } else {
                    console.error(`Bot kicked: ${reasonMessage}`);
                    reject(new Error(`Bot kicked: ${reasonMessage}`));
                }
            } catch (e) {
                console.error(`Failed to parse kick reason: ${reasonMessage}`);
                reject(new Error(`Failed to parse kick reason: ${reasonMessage}`));
            }
            if (bot && typeof bot.quit === 'function') {
                bot.quit();
            }
        });

        bot.on('error', err => {
            console.error(`Bot encountered an error: ${err.message}`);
            reject(new Error(`Bot encountered an error: ${err.message}`));
            if (bot && typeof bot.quit === 'function') {
                bot.quit();
            }
        });

        bot.on('login', () => {
            console.log(`Bot logged in as ${username}`);
            bot.chat("asdfasdf"); // Attempt to send a message to the chat

            let messageSent = false;

            bot.on('message', (jsonMsg, position) => {
                const message = jsonMsg.toString();
                console.log(`Received message: ${message}`);
                if (message.toLowerCase().includes("asdfasdf")) {
                    messageSent = true;
                    resolve({ result: 'success' }); // If message is found, return "success"
                    if (bot && typeof bot.quit === 'function') {
                        bot.quit();
                    }
                } else if (message.toLowerCase().includes('regis') || message.toLowerCase().includes('auth')) {
                    messageSent = true;
                    resolve({ result: 'auth' }); // If message contains "regis" or "auth", return "auth"
                    if (bot && typeof bot.quit === 'function') {
                        bot.quit();
                    }
                }
            });

            // Timeout after a reasonable period to avoid hanging indefinitely
            setTimeout(() => {
                if (!messageSent) {
                    reject(new Error('Message was not sent successfully or not received within timeout period'));
                    if (bot && typeof bot.quit === 'function') {
                        bot.quit();
                    }
                }
            }, 10000); // 10 seconds timeout
        });
    });
}

// Route to check if server has login plugin
const router = express.Router();
router.get('/checkServerStatus', async (req, res) => {
    const serverIP = req.query.ip ? req.query.ip.split(':')[0] : '';
    const serverPort = req.query.ip ? parseInt(req.query.ip.split(':')[1], 10) : 25565;
    const username = generateRandomUsername();
    const authType = req.query.authType || 'offline'; // Default to offline mode

    try {
        const { result } = await checkForAuth(serverIP, serverPort, username, authType);

        // Return result based on checkForAuth response
        res.send(result);
    } catch (error) {
        console.error('Error occurred:', error.message);
        // Return the error message for unspecified errors
        res.status(500).send(error.message);
    }
});

// Route to check if the server is running
router.get('/isServerRunning', async (req, res) => {
    const serverIP = req.query.ip ? req.query.ip.split(':')[0] : '';
    const serverPort = req.query.ip ? parseInt(req.query.ip.split(':')[1], 10) : 25565;

    try {
        const bot = mineflayer.createBot({
            host: serverIP,
            port: serverPort,
            username: 'checkBot',
            auth: 'offline',
        });

        bot.on('login', () => {
            bot.quit();
            res.send('Server is running');
        });

        bot.on('error', err => {
            res.status(500).send(`Error: ${err.message}`);
        });

        setTimeout(() => {
            bot.quit();
            res.status(500).send('Server did not respond in time');
        }, 10000); // 10 seconds timeout
    } catch (error) {
        res.status(500).send(`Failed to create bot: ${error.message}`);
    }
});

app.use("/api/", router);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`);
});
