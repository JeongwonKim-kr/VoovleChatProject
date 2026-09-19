const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Voovle Chat running on port ${PORT}`);
});

// ==========================================
// VOOVLE CHAT SETTINGS
// ==========================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CHATTER_PASSWORD = process.env.CHATTER_PASSWORD;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// ==========================================
// APPROVED ACCOUNTS
// ==========================================

const ACCOUNTS = {
    joy: {
        role: "admin",
        password: ADMIN_PASSWORD
    },

    jake: {
        role: "chatter",
        password: CHATTER_PASSWORD
    },

    shaun: {
        role: "chatter",
        password: CHATTER_PASSWORD
    },

    matthew: {
        role: "chatter",
        password: CHATTER_PASSWORD
    }
};

// ==========================================
// FOLDERS
// ==========================================

const publicFolder = path.join(__dirname, "public");
const uploadFolder = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
}

// ==========================================
// EXPRESS
// ==========================================

app.use(express.json());
app.use(express.static(publicFolder));
app.use("/uploads", express.static(uploadFolder));

// ==========================================
// IMAGE UPLOAD
// ==========================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadFolder);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        const safeName =
            Date.now() +
            "-" +
            Math.random().toString(36).substring(2, 10) +
            extension;

        cb(null, safeName);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: MAX_IMAGE_SIZE
    },

    fileFilter: (req, file, cb) => {
        const allowed = [
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/gif",
            "image/webp"
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed."));
        }
    }
});

// ==========================================
// USERS
// ==========================================

const users = new Map();

// ==========================================
// CHAT DATA
// ==========================================

let messages = [];
let messageId = 1;

// ==========================================
// HELPERS
// ==========================================

function cleanUsername(username) {
    return String(username || "")
        .trim()
        .replace(/[<>]/g, "")
        .substring(0, 20);
}

function getUsers() {
    return Array.from(users.values()).map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        isAdmin: user.isAdmin,
        muted: user.muted
    }));
}

function broadcastUsers() {
    io.emit("users:update", getUsers());
}

function broadcastMessage(message) {
    messages.push(message);

    // Keep the most recent 200 messages.
    if (messages.length > 200) {
        messages.shift();
    }

    io.emit("message:new", message);
}

function createSystemMessage(text) {
    return {
        id: messageId++,
        type: "system",
        text,
        timestamp: Date.now()
    };
}

// ==========================================
// SOCKET.IO
// ==========================================

io.on("connection", socket => {

    console.log("Client connected:", socket.id);

    // ======================================
    // LOGIN
    // ======================================

    socket.on("login", data => {

        if (users.has(socket.id)) {
            return;
        }

        const username = cleanUsername(data?.username);
        const password = String(data?.password || "");

        if (!username) {
            socket.emit(
                "login:error",
                "Please enter a username."
            );

            return;
        }

        if (username.length < 2) {
            socket.emit(
                "login:error",
                "Username must be at least 2 characters."
            );

            return;
        }

        // ----------------------------------
        // Find account
        // ----------------------------------

        const account = ACCOUNTS[username.toLowerCase()];

        let role = "viewer";

        // ----------------------------------
        // Correct account + password
        // ----------------------------------

        if (account && password === account.password) {
            role = account.role;
        }

        const isAdmin = role === "admin";

        const user = {
            id: socket.id,
            username,
            role,
            isAdmin,
            muted: false
        };

        users.set(socket.id, user);

        // ----------------------------------
        // Tell client login succeeded
        // ----------------------------------

        socket.emit("login:success", {
            id: socket.id,
            username,
            role,
            isAdmin
        });

        // ----------------------------------
        // Send existing chat history
        // ----------------------------------

        socket.emit("chat:history", messages);

        broadcastUsers();

        // ----------------------------------
        // Join message
        // ----------------------------------

        const roleText =
            role === "admin"
                ? " (ADMIN)"
                : role === "chatter"
                    ? " (CHATTER)"
                    : " (VIEWER)";

        const systemMessage = createSystemMessage(
            `${username} joined Voovle Chat${roleText}.`
        );

        broadcastMessage(systemMessage);

        console.log(
            `${username} joined as ${role}`
        );
    });

    // ======================================
    // SEND MESSAGE
    // ======================================

    socket.on("message:send", text => {

        const user = users.get(socket.id);

        if (!user) {
            return;
        }

        // Viewers cannot chat
        if (user.role === "viewer") {
            socket.emit(
                "chat:error",
                "Viewers cannot send messages. Enter the correct password to chat."
            );

            return;
        }

        // Muted users cannot chat
        if (user.muted) {
            socket.emit(
                "chat:error",
                "You are muted by an administrator."
            );

            return;
        }

        const cleanText = String(text || "")
            .trim()
            .substring(0, 1000);

        if (!cleanText) {
            return;
        }

        const message = {
            id: messageId++,
            type: "text",
            userId: user.id,
            username: user.username,
            text: cleanText,
            role: user.role,
            isAdmin: user.isAdmin,
            timestamp: Date.now()
        };

        broadcastMessage(message);
    });

    // ======================================
    // IMAGE MESSAGE
    // ======================================

    socket.on("image:send", imageData => {

        const user = users.get(socket.id);

        if (!user) {
            return;
        }

        // Viewers cannot upload images
        if (user.role === "viewer") {
            socket.emit(
                "chat:error",
                "Viewers cannot send images."
            );

            return;
        }

        if (user.muted) {
            socket.emit(
                "chat:error",
                "You are muted by an administrator."
            );

            return;
        }

        if (!imageData || typeof imageData !== "string") {
            return;
        }

        if (!imageData.startsWith("/uploads/")) {
            return;
        }

        const message = {
            id: messageId++,
            type: "image",
            userId: user.id,
            username: user.username,
            image: imageData,
            role: user.role,
            isAdmin: user.isAdmin,
            timestamp: Date.now()
        };

        broadcastMessage(message);
    });

    // ======================================
    // TYPING
    // ======================================

    socket.on("typing", isTyping => {

        const user = users.get(socket.id);

        if (!user) {
            return;
        }

        // Viewers cannot show typing status
        if (user.role === "viewer") {
            return;
        }

        socket.broadcast.emit("user:typing", {
            username: user.username,
            typing: Boolean(isTyping)
        });
    });

    // ======================================
    // ADMIN: DELETE MESSAGE
    // ======================================

    socket.on("admin:deleteMessage", messageIdToDelete => {

        const user = users.get(socket.id);

        if (!user?.isAdmin) {
            return;
        }

        const targetMessageId = Number(messageIdToDelete);

        messages = messages.filter(
            message => message.id !== targetMessageId
        );

        io.emit(
            "message:deleted",
            targetMessageId
        );
    });

    // ======================================
    // ADMIN: CLEAR CHAT
    // ======================================

    socket.on("admin:clearChat", () => {

        const user = users.get(socket.id);

        if (!user?.isAdmin) {
            return;
        }

        messages = [];

        io.emit("chat:cleared");

        const systemMessage = createSystemMessage(
            "The administrator cleared the chat."
        );

        io.emit(
            "message:new",
            systemMessage
        );

        // Keep the system message in history
        messages.push(systemMessage);
    });

    // ======================================
    // ADMIN: KICK USER
    // ======================================

    socket.on("admin:kickUser", targetId => {

        const admin = users.get(socket.id);
        const target = users.get(targetId);

        if (!admin?.isAdmin || !target) {
            return;
        }

        // Admin cannot kick another admin
        if (target.isAdmin) {
            return;
        }

        io.to(targetId).emit(
            "admin:kicked",
            "You were removed from Voovle Chat."
        );

        const targetSocket = io.sockets.sockets.get(targetId);

        if (targetSocket) {
            targetSocket.disconnect(true);
        }

        users.delete(targetId);

        broadcastUsers();

        broadcastMessage(
            createSystemMessage(
                `${target.username} was removed by an administrator.`
            )
        );
    });

    // ======================================
    // ADMIN: MUTE USER
    // ======================================

    socket.on("admin:muteUser", targetId => {

        const admin = users.get(socket.id);
        const target = users.get(targetId);

        if (!admin?.isAdmin || !target) {
            return;
        }

        // Admin cannot mute another admin
        if (target.isAdmin) {
            return;
        }

        target.muted = true;

        io.to(targetId).emit(
            "user:muted",
            "You have been muted by an administrator."
        );

        broadcastUsers();

        broadcastMessage(
            createSystemMessage(
                `${target.username} was muted by an administrator.`
            )
        );
    });

    // ======================================
    // ADMIN: UNMUTE USER
    // ======================================

    socket.on("admin:unmuteUser", targetId => {

        const admin = users.get(socket.id);
        const target = users.get(targetId);

        if (!admin?.isAdmin || !target) {
            return;
        }

        target.muted = false;

        io.to(targetId).emit(
            "user:unmuted",
            "You have been unmuted."
        );

        broadcastUsers();
    });

    // ======================================
    // DISCONNECT
    // ======================================

    socket.on("disconnect", () => {

        const user = users.get(socket.id);

        if (!user) {
            return;
        }

        users.delete(socket.id);

        broadcastUsers();

        broadcastMessage(
            createSystemMessage(
                `${user.username} left Voovle Chat.`
            )
        );

        console.log(
            `${user.username} disconnected`
        );
    });
});

// ==========================================
// IMAGE API
// ==========================================

app.post("/upload", upload.single("image"), (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            error: "No image uploaded."
        });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    res.json({
        success: true,
        url: imageUrl
    });
});

// ==========================================
// UPLOAD ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {

    if (error instanceof multer.MulterError) {

        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                error: "Image must be smaller than 5 MB."
            });
        }
    }

    res.status(400).json({
        error: error.message || "Upload failed."
    });
});

// ==========================================
// START
// ==========================================

server.listen(PORT, () => {

    console.log("");
    console.log("================================");
    console.log("        VOOVLE CHAT");
    console.log("================================");
    console.log(`Running at http://localhost:${PORT}`);
    console.log("================================");
    console.log("");
});