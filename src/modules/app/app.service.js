const { spawn } = require("child_process");
const readline = require('readline')
const appList = require('../../../app.json')
const SocketIoHelper = require("../../helper/socket-io.helper");
const path = require("path");
const fs = require("fs").promises

class AppService {
    updateQueue = []
    getAppNames(req, res) {
        const appNames = appList.map( it => it.name)
        res.status(200).send({names: appNames})
    }

    getUpdateQueue(req, res) {
        res.status(200).send(this.updateQueue)
    }

    updateApp(req, res) {
        const {name, branchBe, branchFe} = req.body
        const app = appList.find(it => it.name === name)
        if(!app) {
            return res.status(404).send({message: "App Name is not registered"})
        }

        const isInQueue = this.updateQueue.find(it=> it === name)
        if(isInQueue) {
            return res.status(409).send({message: "App is already processed. Try again later."})
        }
        this.runSh(app, branchBe, branchFe, res)
    }

    runSh(app, branchBe, branchFe, res) {
        const sh = spawn("sh", [app.sh_path, branchBe, branchFe]);
        this.updateQueue.push(app.name)

        readline.createInterface({
            input     : sh.stdout,
            terminal  : false
          }).on('line', function(line) {
            SocketIoHelper.io.to(app.name).emit("update-progress",{status: "PROGRESS", message: line})
          });

        sh.stderr.on("data", (error) => {
            console.error(`[SH][ERROR]: ${error}`);
            SocketIoHelper.io.to(app.name).emit("update-progress",{status: "ERROR", message: error})

            res.status(500).send(error)
        });

        sh.on("close", (code) => {
            console.log(`[SH][FINISH] child process exited with code ${code}`);
            const queueIndex = this.updateQueue.findIndex(it => it === app.name)
            console.log("[SH][FINISH] Index Finish:", queueIndex)
            this.updateQueue.splice(queueIndex, 1)
            console.log("[SH][FINISH] Cleaned Queue:", this.updateQueue)

            SocketIoHelper.io.to(app.name).emit("update-progress",{status: "FINISH", message: ` child process exited with code ${code}`})

            const logMsg = `[${new Date().toISOString()}] Name: ${app.name}`
            fs.writeFile(path.resolve("../../updated-app.log"), logMsg, {flag: "a"})
            if(code === 0)
                res.status(200).send({code})
        });
    }

    getUpdateHistory(req, res) {
        fs.readFile("../../updated-app.log", {encoding: "utf8"})
            .then((data) => res.status(200).send(data))
            .catch((error) => {
                console.log("[ERROR](getUpdateHistory)", error.message)
                res.status(500).send("Something went wrong. please check server log.")
            })
    }
}

module.exports = AppService