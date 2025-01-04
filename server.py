import asyncio
import websockets
import json
import sqlite3

psc = 0
connected_clients = set()

# Ініціалізація бази даних
def init_db():
    conn = sqlite3.connect('ct_eu.db')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS chat_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL,
                        message TEXT NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

async def notify_clients(message):
    if connected_clients:
        tasks = [asyncio.create_task(client.send(message)) for client in connected_clients]
        await asyncio.wait(tasks)

async def handle_client(websocket, path):
    global connected_clients, psc  # Додаємо global для psc
    connected_clients.add(websocket)

    try:
        # Отримання повідомлення від клієнта
        async for message in websocket:
            data = json.loads(message)

            # Ініціалізуємо змінну username для безпечного використання
            username = None

            if isinstance(data, list):
                print(data)
                ip, username, password, action = data
            else:
                action = data.get('action', None)

            conn = sqlite3.connect('ct_eu.db')
            cursor = conn.cursor()

            # Верифікація користувача
            if action == "login":
                username = data.get('username', None)
                password = data.get('password', None)

                if username and password:
                    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
                    user = cursor.fetchone()
                    if user:
                        response = {"message": "Логін успішний!","success":"true", "action":"login", "username":username}
                        psc += 1  # Зміна значення psc
                    else:
                        response = {"message": "Невірне ім'я користувача або пароль.","success":"false" ,"action":"login"}
                else:
                    response = {"message": "Ім'я користувача або пароль не надані.","success":"false" ,"action":"login"}

            # Створення нового акаунта
            elif action == "create_account":
                username = data.get('username', None)
                password = data.get('password', None)

                if username and password:
                    try:
                        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
                        conn.commit()
                        response = {"message": "Акаунт створено успішно!","success" : "true","action":"create_account"}
                        psc += 1  # Зміна значення psc
                    except sqlite3.IntegrityError:
                        response = {"message": "Ім'я користувача вже існує.","success":"false","action":"create_account"}
                else:
                    response = {"message": "Ім'я користувача або пароль не надані.","success":"false","action":"create_account"}

            # Відправка історії чату
            elif action == "load_chat_history":
                cursor.execute("SELECT username, message FROM chat_history ORDER BY timestamp ASC")
                history = cursor.fetchall()
                response = [{"username": row[0], "message": row[1]} for row in history]

            elif action == "send_message":
                username = data.get('username', None)
                print(username)
                message = data.get('message', None)
                print(message)

                if username and message:
                    print(username, message)
                    cursor.execute("INSERT INTO chat_history (username, message) VALUES (?, ?)", (username, message))
                    conn.commit()
                    response = {"username": username, "message": message}
                    await notify_clients(json.dumps(response))
                    continue  # Повідомлення вже надіслано всім клієнтам, не надсилати повторно
                else:
                    response = {"message": "Повідомлення або ім'я користувача не надані.","success":"false","action":"send_message"}

            # Відправка значення psc
            elif action == 'get_isc':
                response = {"isc_value": psc}

            # Відправка відповіді клієнту
            await websocket.send(json.dumps(response))

    except Exception as e:
        response = {"message": f"Виникла помилка: {str(e)}"}
        await websocket.send(json.dumps(response))

    finally:
        connected_clients.remove(websocket)


# Основна функція
async def main():
    init_db()
    async with websockets.serve(handle_client, "127.0.0.1", 2573):
        await asyncio.Future()  # Чекаємо на завершення

if __name__ == "__main__":
    asyncio.run(main())
