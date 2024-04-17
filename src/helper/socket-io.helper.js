class SocketIoHelper {
    static io
    static init (socketIo) {
        this.io = socketIo
    }

    static watchConnection() {
        this.io.on("connection", (socket) => {
            console.log("[WS] Connected: ", socket.id)
            socket.on("join-room", (room) => {
                console.log("[WS] Join Room:", socket.id, room)
                socket.join(room)
            })
            socket.on("disconnect", () => {
                console.log("[WS] Disconnected:", socket.id);
                socket.disconnect();
            });
            socket.on("get-id", () => {
                socket.emit("socket-id", socket.id)
            })
        })
    }
}

module.exports = SocketIoHelper