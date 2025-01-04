const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');

// Створюємо HTTP-сервер
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Підключення до бази даних SQLite
const db = new sqlite3.Database('./users.db');

// Створюємо таблиці, якщо їх ще не існує
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS friends (
        username TEXT,
        friend TEXT,
        FOREIGN KEY(username) REFERENCES users(username),
        FOREIGN KEY(friend) REFERENCES users(username)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        message TEXT,
        FOREIGN KEY(username) REFERENCES users(username)
    )`);
});

// Обробка WebSocket-з'єднань
wss.on('connection', (ws) => {
    console.log('Новий клієнт підключився');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log('Отримане повідомлення:', data);

        switch (data.action) {
            case 'login':
                handleLogin(ws, data.username, data.password);
                break;
            case 'create_account':
                handleCreateAccount(ws, data.username, data.password);
                break;
            case 'send_message':
                handleSendMessage(ws, data.username, data.message);
                break;
            case 'addFriend':
                handleAddFriend(ws, data.username, data.friendUsername);
                break;
            case 'loadFriendList':
                handleLoadFriendList(ws, data.username);
                break;
            case 'loadChatHistory':
                handleLoadChatHistory(ws);
                break;
            default:
                ws.send(JSON.stringify({ message: 'Невідома команда' }));
                break;
        }
    });

    ws.on('close', () => {
        console.log('Клієнт відключився');
    });

    ws.on('error', (error) => {
        console.error('Помилка WebSocket:', error);
    });
});

// Логінізація
function handleLogin(ws, username, password) {
    console.log('login def')
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) {
            ws.send(JSON.stringify({ action: "login", success: false, message: 'Помилка під час логіну' }));
            console.error('Login error:', err);
        } else if (row) {
            ws.send(JSON.stringify({ action: "login", success: true, username: username }));
            console.log(JSON.stringify({ action: "login", success: true, username: username }))
            
        } else {
            
            ws.send(JSON.stringify({ action: "login", success: false, message: 'Неправильне ім\'я користувача або пароль' }));
            console.log(JSON.stringify({ action: "login", success: false, message: 'Неправильне ім\'я користувача або пароль' }))
        }
    });
}

// Створення акаунта
function handleCreateAccount(ws, username, password) {
    // Перевірити, чи ім'я користувача вже існує
    db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            ws.send(JSON.stringify({ action: 'createAccount', success: false, message: 'Помилка перевірки наявності користувача' }));
            console.error('Error checking user existence:', err);
            return;
        }
        
        if (row && row.username === username) {
            // Ім'я користувача вже існує
            ws.send(JSON.stringify({ action: 'createAccount', success: false, message: 'Ім\'я користувача вже існує' }));
            return;
        }

        // Створити новий акаунт
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
            if (err) {
                ws.send(JSON.stringify({ action: 'createAccount', success: false, message: 'Помилка під час створення акаунту' }));
                console.error('Error creating account:', err);
            } else {
                ws.send(JSON.stringify({ action: 'createAccount', success: true }));
            }
        });
    });
}

// Додавання друга
function handleAddFriend(ws, username, friendUsername) {
    db.get('SELECT * FROM users WHERE username = ?', [friendUsername], (err, row) => {
        if (err) {
            ws.send(JSON.stringify({ action: 'addFriend', success: false, message: 'Помилка під час додавання друга' }));
        } else if (row) {
            db.run('INSERT INTO friends (username, friend) VALUES (?, ?)', [username, friendUsername], function(err) {
                if (err) {
                    ws.send(JSON.stringify({ action: 'addFriend', success: false, message: 'Помилка під час додавання друга' }));
                } else {
                    ws.send(JSON.stringify({ action: 'addFriend', success: true, friendUsername }));
                }
            });
        } else {
            ws.send(JSON.stringify({ action: 'addFriend', success: false, message: 'Користувача не знайдено' }));
        }
    });
}

// Завантаження списку друзів
function handleLoadFriendList(ws, username) {
    db.all('SELECT friend FROM friends WHERE username = ?', [username], (err, rows) => {
        if (err) {
            ws.send(JSON.stringify({ action: 'loadFriendList', success: false, message: 'Помилка завантаження списку друзів' }));
        } else {
            const friends = rows.map(row => row.friend);
            ws.send(JSON.stringify({ action: 'loadFriendList', friends }));
        }
    });
}

// Завантаження історії чату// Завантаження історії чату
function handleLoadChatHistory(ws) {
    db.all('SELECT username, message FROM chat_history ORDER BY id ASC', [], (err, rows) => {
        if (err) {
            ws.send(JSON.stringify({ action: 'loadChatHistory', success: false, message: 'Помилка завантаження історії чату' }));
        } else {
            ws.send(JSON.stringify({ action: 'loadChatHistory', chatHistory: rows }));
        }
    });
}

// Відправлення повідомлення
function handleSendMessage(ws, username, message) {
    db.run('INSERT INTO chat_history (username, message) VALUES (?, ?)', [username, message], function(err) {
        if (err) {
            ws.send(JSON.stringify({ action: 'sendMessage', success: false, message: 'Помилка під час відправлення повідомлення' }));
        } else {
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ action: 'new_message', username, message }));
                }
            });
            ws.send(JSON.stringify({ action: 'sendMessage', success: true }));
        }
    });
}

// Запускаємо сервер
server.listen(2573, () => {
    console.log('Сервер запущено на порту 2400');
});
