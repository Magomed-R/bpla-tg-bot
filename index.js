require("dotenv").config();

const TelegramApi = require("node-telegram-bot-api");

const bot = new TelegramApi(process.env.TG_BOT_TOKEN, { polling: true });

bot.setMyCommands([
    {
        command: "/menu",
        description: "Открыть меню канала"
    }
]);

const buttons = JSON.stringify({
    inline_keyboard: [[{ text: "✅Запись на занятия", url: "https://t.me/fpvair/6" }], [{ text: "📊Статистика", url: "https://t.me/fpvair/38" }], [{ text: "💬Наш чат", url: "https://t.me/fpvair/32" }], [{ text: "🕹Где пригодится", url: "https://t.me/fpvair/56" }], [{ text: "❔О нас", url: "https://t.me/fpvair/61" }]]
});

bot.on("polling_error", console.log);

const start = () => {
    bot.on("channel_post", newMessage);
    bot.on("message", newMessage);

    function newMessage(message) {
        console.log(message);

        if (!message.text) {
            return;
        }

        let chatId = message.chat.id;

        if (message.text.includes("/menu")) {
            bot.deleteMessage(chatId, message.message_id);
            bot.sendMessage(chatId, "🧭Навигация по каналу", { reply_markup: buttons });
        }
    }
};

start();

bot.on("new_chat_members", (message) => {
    console.log(message);

    const newUsers = message.new_chat_members;
    const chatId = message.chat.id;

    newUsers.forEach((user) => {
        bot.sendMessage(chatId, `Добро пожаловать, ${user.first_name}! \n \n 🧭Навигация по каналу`, { reply_markup: buttons, reply_to_message_id: message.message_id }).then((sentMessage) => {
            setTimeout(() => {
                bot.deleteMessage(chatId, sentMessage.message_id);
            }, 120000);
        });
    });
});
