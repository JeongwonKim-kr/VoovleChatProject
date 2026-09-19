const socket = io();


// ==========================================
// ELEMENTS
// ==========================================

const loginOverlay = document.getElementById("loginOverlay");

const usernameInput =
    document.getElementById("usernameInput");

const passwordInput =
    document.getElementById("passwordInput");

const joinButton =
    document.getElementById("joinButton");

const loginError =
    document.getElementById("loginError");

const messages =
    document.getElementById("messages");

const welcomeMessage =
    document.getElementById("welcomeMessage");

const messageForm =
    document.getElementById("messageForm");

const messageInput =
    document.getElementById("messageInput");

const peopleList =
    document.getElementById("peopleList");

const peopleCount =
    document.getElementById("peopleCount");

const onlineNumber =
    document.getElementById("onlineNumber");

const myName =
    document.getElementById("myName");

const myAvatar =
    document.getElementById("myAvatar");

const roleBadge =
    document.getElementById("roleBadge");

const typingIndicator =
    document.getElementById("typingIndicator");

const connectionDot =
    document.getElementById("connectionDot");

const connectionText =
    document.getElementById("connectionText");

const logoutButton =
    document.getElementById("logoutButton");

const imageButton =
    document.getElementById("imageButton");

const imageInput =
    document.getElementById("imageInput");

const settingsButton =
    document.getElementById("settingsButton");

const settingsModal =
    document.getElementById("settingsModal");

const closeSettings =
    document.getElementById("closeSettings");

const settingsUsername =
    document.getElementById("settingsUsername");

const adminSettings =
    document.getElementById("adminSettings");


// ==========================================
// STATE
// ==========================================

let currentUser = null;
let typingTimer = null;


// ==========================================
// CONNECTION
// ==========================================

socket.on("connect", () => {

    connectionDot.classList.add("online");
    connectionDot.classList.remove("offline");

    connectionText.textContent = "Connected";
});


socket.on("disconnect", () => {

    connectionDot.classList.remove("online");
    connectionDot.classList.add("offline");

    connectionText.textContent = "Disconnected";
});


// ==========================================
// LOGIN
// ==========================================

function login() {

    const username =
        usernameInput.value.trim();

    const password =
        passwordInput.value;

    loginError.textContent = "";

    if (!username) {
        loginError.textContent =
            "Please enter a username.";
        return;
    }

    socket.emit("login", {
        username,
        password
    });
}


joinButton.addEventListener("click", login);


usernameInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        login();
    }
});


passwordInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        login();
    }
});


socket.on("login:error", error => {

    loginError.textContent = error;
});


socket.on("login:success", user => {

    currentUser = user;

    loginOverlay.style.display = "none";

    myName.textContent =
        user.username;

    myAvatar.textContent =
        user.username.charAt(0).toUpperCase();

    settingsUsername.textContent =
        user.username;

    if (user.isAdmin) {

        roleBadge.style.display = "inline-block";

        adminSettings.style.display = "block";
    }

    messageInput.focus();
});


// ==========================================
// HISTORY
// ==========================================

socket.on("chat:history", history => {

    messages.innerHTML = "";

    history.forEach(message => {
        renderMessage(message);
    });

    scrollToBottom();
});


// ==========================================
// NEW MESSAGE
// ==========================================

socket.on("message:new", message => {

    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    renderMessage(message);

    scrollToBottom();
});


// ==========================================
// RENDER MESSAGE
// ==========================================

function renderMessage(message) {

    if (message.type === "system") {

        const system =
            document.createElement("div");

        system.className =
            "system-message";

        system.textContent =
            message.text;

        messages.appendChild(system);

        return;
    }


    const wrapper =
        document.createElement("div");

    wrapper.className = "message";

    wrapper.dataset.id =
        message.id;


    const avatar =
        document.createElement("div");

    avatar.className =
        "message-avatar";

    avatar.textContent =
        message.username
            .charAt(0)
            .toUpperCase();


    const content =
        document.createElement("div");

    content.className =
        "message-content";


    const meta =
        document.createElement("div");

    meta.className =
        "message-meta";


    const name =
        document.createElement("span");

    name.className =
        "message-name";

    name.textContent =
        message.username;


    if (message.isAdmin) {

        const badge =
            document.createElement("span");

        badge.className =
            "admin-badge";

        badge.textContent =
            "ADMIN";

        name.appendChild(badge);
    }


    const time =
        document.createElement("span");

    time.className =
        "message-time";

    time.textContent =
        formatTime(message.timestamp);


    meta.appendChild(name);
    meta.appendChild(time);


    content.appendChild(meta);


    if (message.type === "image") {

        const image =
            document.createElement("img");

        image.className =
            "message-image";

        image.src =
            message.image;

        image.alt =
            "Uploaded image";

        image.loading =
            "lazy";

        image.addEventListener(
            "click",
            () => {
                window.open(
                    message.image,
                    "_blank"
                );
            }
        );

        content.appendChild(image);

    } else {

        const bubble =
            document.createElement("div");

        bubble.className =
            "message-bubble";

        bubble.textContent =
            message.text;

        content.appendChild(bubble);
    }


    // ======================================
    // ADMIN CONTROLS
    // ======================================

    if (
        currentUser &&
        currentUser.isAdmin &&
        message.userId
    ) {

        const controls =
            document.createElement("div");

        controls.className =
            "message-admin-controls";


        const deleteButton =
            document.createElement("button");

        deleteButton.textContent =
            "Delete";

        deleteButton.addEventListener(
            "click",
            () => {

                socket.emit(
                    "admin:deleteMessage",
                    message.id
                );
            }
        );


        controls.appendChild(deleteButton);

        content.appendChild(controls);
    }


    wrapper.appendChild(avatar);
    wrapper.appendChild(content);

    messages.appendChild(wrapper);
}


// ==========================================
// DELETE MESSAGE
// ==========================================

socket.on("message:deleted", id => {

    const element =
        document.querySelector(
            `.message[data-id="${id}"]`
        );

    if (element) {
        element.remove();
    }
});


// ==========================================
// CLEAR CHAT
// ==========================================

socket.on("chat:cleared", () => {

    messages.innerHTML = "";
});


// ==========================================
// USERS
// ==========================================

socket.on("users:update", users => {

    peopleList.innerHTML = "";

    peopleCount.textContent =
        users.length;

    onlineNumber.textContent =
        users.length;


    users.forEach(user => {

        const person =
            document.createElement("div");

        person.className =
            "person";


        const avatar =
            document.createElement("div");

        avatar.className =
            "person-avatar";

        avatar.textContent =
            user.username
                .charAt(0)
                .toUpperCase();


        const info =
            document.createElement("div");

        info.className =
            "person-info";


        const name =
            document.createElement("span");

        name.className =
            "person-name";

        name.textContent =
            user.username;


        if (user.isAdmin) {

            const badge =
                document.createElement("span");

            badge.className =
                "admin-badge";

            badge.textContent =
                "ADMIN";

            name.appendChild(badge);
        }


        if (user.muted) {

            const muted =
                document.createElement("span");

            muted.className =
                "muted-badge";

            muted.textContent =
                " 🔇";

            name.appendChild(muted);
        }


        const status =
            document.createElement("span");

        status.className =
            "person-status";

        status.textContent =
            user.muted
                ? "Muted"
                : "Online";


        info.appendChild(name);
        info.appendChild(status);


        person.appendChild(avatar);
        person.appendChild(info);


        // ==================================
        // ADMIN USER CONTROLS
        // ==================================

        if (
            currentUser &&
            currentUser.isAdmin &&
            user.id !== currentUser.id &&
            !user.isAdmin
        ) {

            const controls =
                document.createElement("div");

            controls.className =
                "admin-user-actions";


            const muteButton =
                document.createElement("button");

            muteButton.textContent =
                user.muted ? "🔊" : "🔇";

            muteButton.title =
                user.muted
                    ? "Unmute"
                    : "Mute";


            muteButton.addEventListener(
                "click",
                () => {

                    if (user.muted) {

                        socket.emit(
                            "admin:unmuteUser",
                            user.id
                        );

                    } else {

                        socket.emit(
                            "admin:muteUser",
                            user.id
                        );
                    }
                }
            );


            const kickButton =
                document.createElement("button");

            kickButton.textContent =
                "×";

            kickButton.title =
                "Kick user";


            kickButton.addEventListener(
                "click",
                () => {

                    socket.emit(
                        "admin:kickUser",
                        user.id
                    );
                }
            );


            controls.appendChild(
                muteButton
            );

            controls.appendChild(
                kickButton
            );

            person.appendChild(
                controls
            );
        }


        peopleList.appendChild(person);
    });
});


// ==========================================
// SEND MESSAGE
// ==========================================

messageForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        const text =
            messageInput.value.trim();

        if (!text) {
            return;
        }

        socket.emit(
            "message:send",
            text
        );

        messageInput.value = "";

        socket.emit(
            "typing",
            false
        );
    }
);


// ==========================================
// TYPING
// ==========================================

messageInput.addEventListener(
    "input",
    () => {

        socket.emit(
            "typing",
            true
        );

        clearTimeout(typingTimer);

        typingTimer = setTimeout(
            () => {

                socket.emit(
                    "typing",
                    false
                );

            },
            900
        );
    }
);


socket.on(
    "user:typing",
    data => {

        if (!data.typing) {

            typingIndicator.textContent =
                "";

            return;
        }

        typingIndicator.textContent =
            `${data.username} is typing...`;
    }
);


// ==========================================
// IMAGE UPLOAD
// ==========================================

imageButton.addEventListener(
    "click",
    () => {

        imageInput.click();
    }
);


imageInput.addEventListener(
    "change",
    async () => {

        const file =
            imageInput.files[0];

        if (!file) {
            return;
        }


        if (file.size > 5 * 1024 * 1024) {

            alert(
                "Images must be smaller than 5 MB."
            );

            imageInput.value = "";

            return;
        }


        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp"
        ];


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            alert(
                "Please choose a PNG, JPG, GIF, or WebP image."
            );

            imageInput.value = "";

            return;
        }


        const formData =
            new FormData();

        formData.append(
            "image",
            file
        );


        try {

            imageButton.disabled =
                true;

            imageButton.textContent =
                "…";


            const response =
                await fetch(
                    "/upload",
                    {
                        method: "POST",
                        body: formData
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    result.error ||
                    "Upload failed."
                );
            }


            socket.emit(
                "image:send",
                result.url
            );

        } catch (error) {

            alert(
                error.message
            );

        } finally {

            imageButton.disabled =
                false;

            imageButton.textContent =
                "🖼";

            imageInput.value =
                "";
        }
    }
);


// ==========================================
// ADMIN ERRORS / NOTIFICATIONS
// ==========================================

socket.on(
    "chat:error",
    message => {

        alert(message);
    }
);


socket.on(
    "user:muted",
    message => {

        alert(message);
    }
);


socket.on(
    "user:unmuted",
    message => {

        alert(message);
    }
);


socket.on(
    "admin:kicked",
    message => {

        alert(message);

        location.reload();
    }
);


// ==========================================
// SETTINGS
// ==========================================

settingsButton.addEventListener(
    "click",
    () => {

        settingsModal.classList.add(
            "open"
        );
    }
);


closeSettings.addEventListener(
    "click",
    () => {

        settingsModal.classList.remove(
            "open"
        );
    }
);


settingsModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            settingsModal
        ) {

            settingsModal.classList.remove(
                "open"
            );
        }
    }
);


// ==========================================
// LOGOUT
// ==========================================

logoutButton.addEventListener(
    "click",
    () => {

        socket.disconnect();

        location.reload();
    }
);


// ==========================================
// HELPERS
// ==========================================

function formatTime(timestamp) {

    return new Date(timestamp)
        .toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
}


function scrollToBottom() {

    requestAnimationFrame(() => {

        messages.scrollTop =
            messages.scrollHeight;
    });
}