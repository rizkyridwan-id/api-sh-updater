const express = require("express")
const {Server} = require("socket.io")
const cors = require("cors")

const app = express();
const appRouter = require("./modules/app/app.router");
const SocketIoHelper = require("./helper/socket-io.helper");

app.use(express.json())
app.use(cors());
app.use("/api/v1", appRouter)

const port = 3939
const listener = app.listen(port, () => console.log("App listening at port ", port))
const io = new Server(listener, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

SocketIoHelper.init(io)
SocketIoHelper.watchConnection()