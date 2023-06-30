require("dotenv").config();

const TelegramApi = require("node-telegram-bot-api");

const bot = new TelegramApi(process.env.TG_BOT_TOKEN, { polling: true });

const mongoose = require("mongoose");

try {
    mongoose
        .connect(`mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONHO_PASSWORD}@cluster.dvfjqpc.mongodb.net/bpla-bot`)
        .then((res) => console.log("Connected to DB"))
        .catch((error) => console.log(error));
} catch (error) {
    console.log(error);
}

bot.setMyCommands([
    {
        command: "/menu",
        description: "Открыть меню канала"
    },
    {
        command: "/edit",
        description: "Настроить меню"
    }
]);

const buttonSchema = new mongoose.Schema({
    text: String,
    order: { type: Number, required: true },
    url: String
});

const Button = mongoose.model("button", buttonSchema);

const userSchema = new mongoose.Schema({
    memberId: String
});

const User = mongoose.model("user", userSchema);

const messageSchema = new mongoose.Schema({
    messageId: String,
    chatId: String
});

const Message = mongoose.model("message", messageSchema);

let passCheck = 0;
let addingTitle = 0;
let addingUrl = 0;
let titleFunc = () => {};
let urlFunc = () => {};

let addingButton = [0, 0];
let newButton = () => {};
let newButton2 = () => {};

bot.on("polling_error", console.log);

const start = () => {
    bot.on("channel_post", newMessage);
    bot.on("message", newMessage);

    bot.on("callback_query", async (message) => {
        let chatId = message.message.chat.id;
        let messageId = message.message.message_id;

        if (message.data == "cancel") {
            bot.deleteMessage(chatId, messageId);
            passCheck = 0;
        }

        if (message.data == "cancelEdit") {
            addingTitle = 0;
            addingUrl = 0;

            editButtons(message.message);
        }

        if (message.data.includes("newButton")) {
            newButton = addButton(message.data.split(" ")[1]);
            bot.sendMessage(chatId, "Введите название новой кнопки");
            addingButton = [chatId, 1];
        }

        if (message.data.includes("edit")) {
            bot.deleteMessage(chatId, messageId);

            let button = await getButton(message.data.split(" ")[1]);

            bot.sendMessage(chatId, `Кнопка: ${button.text} \nСсылка: ${button.url}`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "⚙Изменить название",
                                callback_data: `buttonEditTitle ${button.order}`
                            }
                        ],
                        [
                            {
                                text: "⚙Изменить ссылку",
                                callback_data: `buttonEditUrl ${button.order}`
                            }
                        ],
                        [
                            {
                                text: "❌Удалить кнопку",
                                callback_data: `deleteButton ${button.order}`
                            }
                        ]
                    ]
                }
            });
        }

        if (message.data.includes("buttonEditTitle")) {
            addingTitle = chatId;

            let button = await getButton(message.data.split(" ")[1]);

            bot.deleteMessage(chatId, messageId);
            bot.sendMessage(chatId, `Текущее название кнопки: ${button.text} \nВведите новое название кнопки`, {
                reply_markup: {
                    inline_keyboard: [[{ text: "Отменить", callback_data: "cancelEdit" }]]
                }
            });

            titleFunc = editButtonTitle(message.data.split(" ")[1]);
        }

        if (message.data.includes("buttonEditUrl")) {
            addingUrl = chatId;

            let button = await getButton(message.data.split(" ")[1]);

            bot.deleteMessage(chatId, messageId);
            bot.sendMessage(chatId, `Текущая ссылка кнопки: ${button.url} \nВведите новую ссылку кнопки`, {
                reply_markup: {
                    inline_keyboard: [[{ text: "Отменить", callback_data: "cancelEdit" }]]
                }
            });

            urlFunc = editButtonUrl(message.data.split(" ")[1]);
        }

        if (message.data.includes("deleteButton")) {
            deleteButton(message.data.split(" ")[1]);
            bot.deleteMessage(chatId, messageId);
            rerenderMessages();
            bot.sendMessage(chatId, "✅Кнопка удалена!");
        }
    });

    async function newMessage(message) {
        if (!message.text) {
            return;
        }

        let chatId = message.chat.id;

        if (addingTitle == chatId) {
            bot.deleteMessage(chatId, message.message_id - 1);

            titleFunc(message.text).then(() => {
                editButtons(message);
                rerenderMessages();
            });

            return;
        }

        if (addingUrl == chatId) {
            bot.deleteMessage(chatId, message.message_id - 1);

            urlFunc(message.text).then(() => {
                editButtons(message);
                rerenderMessages();
            });

            return;
        }

        if (addingButton[0] == chatId && addingButton[1] == 1) {
            newButton2 = newButton(message.text);
            bot.sendMessage(chatId, "Введите ссылку новой кнопки");
            addingButton[1] = 2;

            return;
        }

        if (addingButton[0] == chatId && addingButton[1] == 2) {
            newButton2(message.text);
            bot.sendMessage(chatId, "✅Новая кнопка добавлена!");
            addingButton = [0, 1];

            getEditButtons(message);
            rerenderMessages();

            return;
        }

        if (message.text.includes("/menu")) {
            bot.deleteMessage(chatId, message.message_id);
            bot.sendMessage(chatId, "🧭Навигация по каналу", { reply_markup: { inline_keyboard: await getButtons() } }).then((sentMessage) => {
                addMessage(chatId, sentMessage.message_id);
            });
            return;
        }

        if (message.text.includes("/edit")) {
            editButtons(message);
        }

        if (passCheck == message.chat.id && message.text != "bplaadmin") {
            bot.deleteMessage(chatId, message.message_id);
            return bot.sendMessage(chatId, "⛔Пароль неверный. Повторите попытку", { reply_markup: { inline_keyboard: [[{ text: "Отменить", callback_data: "cancel" }]] } });
        } else if (passCheck == message.chat.id && message.text == "bplaadmin") {
            passCheck = 0;

            bot.sendMessage(chatId, "✅Вход выполнен");
            bot.deleteMessage(chatId, message.message_id);
            addAdmin(message.from.id);
            return editButtons(message);
        }
    }
};

start();

bot.on("new_chat_members", (message) => {
    const newUsers = message.new_chat_members;
    const chatId = message.chat.id;

    newUsers.forEach(async (user) => {
        bot.sendMessage(chatId, `Добро пожаловать, ${user.first_name}! \n \n🧭Навигация по каналу`, { reply_markup: await getButtons(), reply_to_message_id: message.message_id }).then((sentMessage) => {
            setTimeout(() => {
                bot.deleteMessage(chatId, sentMessage.message_id);
            }, 120000);
        });
    });
});

async function addMessage(chatId, messageId) {
    try {
        let message = new Message({
            messageId: messageId,
            chatId: chatId
        });

        await message.save();
    } catch (error) {
        console.log(error);
    }
}

async function rerenderMessages() {
    let messages = await Message.find();

    messages.forEach(async (message) => {
        bot.editMessageReplyMarkup({ inline_keyboard: await getButtons() }, { chat_id: message.chatId, message_id: message.messageId });
    });
}

function editButtonTitle(order) {
    return async function (newTitle) {
        try {
            let button = await Button.findOne({ order: order });

            button.text = newTitle;

            await button.save();

            addingTitle = 0;
        } catch (error) {
            console.log(error);
        }
    };
}

function editButtonUrl(order) {
    return async function (newUrl) {
        try {
            let button = await Button.findOne({ order: order });

            button.url = newUrl;

            await button.save();

            addingUrl = 0;
        } catch (error) {
            console.log(error);
        }
    };
}

async function editButtons(message) {
    let chatId = message.chat.id;
    bot.deleteMessage(chatId, message.message_id);

    if ((await checkAuth(message.from.id)) || message.from.is_bot) {
        return bot.sendMessage(chatId, "Выберете, что изменить", {
            reply_markup: {
                inline_keyboard: await getEditButtons()
            }
        });
    } else {
        bot.sendMessage(chatId, "🔑Введите пароль");
        return (passCheck = chatId);
    }
}

async function checkAuth(memberId) {
    try {
        let user = await User.findOne({ memberId: memberId });

        if (!user) {
            return false;
        } else {
            return true;
        }
    } catch (error) {
        console.log(error);
    }
}

async function addAdmin(memberId) {
    try {
        let newUser = new User({
            memberId: memberId
        });

        await newUser.save();
    } catch (error) {
        console.log(error);
    }
}

async function getButton(order) {
    try {
        let button = await Button.findOne({ order: order });

        return button;
    } catch (error) {
        console.log(error);
    }
}

async function getButtons() {
    try {
        let buttons = await Button.find().sort({ order: 1 });

        for (let i = 0; i < buttons.length; i++) {
            buttons[i] = [buttons[i]];
        }

        return buttons;
    } catch (error) {
        console.log(error);
    }
}

async function getEditButtons() {
    try {
        let buttons = await Button.find().sort({ order: 1 });

        for (let i = 0; i < buttons.length; i++) {
            buttons[i] = [buttons[i], { text: "⚙", callback_data: `edit ${i + 1}` }];
        }

        buttons.push([{ text: "➕", callback_data: `newButton ${buttons.length + 1}` }]);

        return buttons;
    } catch (error) {
        console.log(error);
    }
}

async function deleteButton(order) {
    try {
        await Button.deleteOne({ order: order });

        let num = Number(order) + Number(1);

        while (true) {
            let button = await Button.findOne({ order: num });

            if (!button) {
                break;
            } else {
                button.order--;
                num++;

                button.save();
            }
        }
    } catch (error) {
        console.log(error);
    }
}

function addButton(order) {
    return function (text) {
        return async function (url) {
            try {
                let newButton = new Button({
                    text: text,
                    order: order,
                    url: url
                });

                await newButton.save();
            } catch (error) {
                console.log(error);
            }
        };
    };
}
