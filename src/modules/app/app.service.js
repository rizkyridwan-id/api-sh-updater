const { spawn } = require("child_process");
const readline = require('readline')
const appList = require('../../../app.json')
const SocketIoHelper = require("../../helper/socket-io.helper");
const path = require("path");
const fs = require("fs").promises

class AppService {
    updateQueue = []
    getAppNames(req, res) {
        const appNames = appList.map( it => ({
            name: it.name,
            link_qc: it.link_qc,
            is_branch_avail: it.is_branch_avail
        }))
        res.status(200).send({names: appNames})
    }

    getUpdateQueue(req, res) {
        res.status(200).send(this.updateQueue)
    }

    updateApp(req, res) {
        const {name, branchBe = "", branchFe = ""} = req.body
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
        if(branchBe && branchFe) {
            console.log("[INFO] BRANCH INFO")
            console.log("BranchBe:", branchBe)
            console.log("BranchFe:", branchFe)
        }
        const sh = spawn("sh", [app.sh_path, branchBe, branchFe]);
        this.updateQueue.push(app.name)

        readline.createInterface({
            input     : sh.stdout,
            terminal  : false
          }).on('line', function(line) {
            SocketIoHelper.io.to(app.name).emit("update-progress",{status: "PROGRESS", message: line})
          });

        sh.stderr.on("data", (error) => {
            console.error(`[SH][UPDATE][ERROR]: ${error}`);
            SocketIoHelper.io.to(app.name).emit("update-progress",{status: "ERROR", message: error})
        });

        sh.on("close", (code) => {
            const queueIndex = this.updateQueue.findIndex(it => it === app.name)
            this.updateQueue.splice(queueIndex, 1)

            console.log(`[SH][UPDATE][FINISH] ChildProcessStatusCode: ${code}`);
            console.log("[SH][UPDATE][FINISH] CleanedQueue:", app.name)
            
            if(code === 0) {
                const logMsg = `[${new Date().toISOString()}] Name: ${app.name}\n`
                fs.writeFile(path.resolve("./updated-app.log"), logMsg, {flag: "a"}).then(() => console.log("App registered to log."))
            }

            const statusSocket = code ? "ERROR" : "FINISH"
            const httpStatus = code ? 500 : 200
            const response = {
                code,
                message: this._generateMessageResponse(code)
            }
            
            SocketIoHelper.io.to(app.name).emit("update-progress",{status: statusSocket, message: ` child process exited with code ${code}`})
            res.status(httpStatus).send(response)
        });
    }

    _generateMessageResponse(code) {
        return code === 0 
            ? "Updated Success." 
            : code === 1 
                ? "Internal Script Error" 
                : code === 2 
                    ? "Backend Script Error" 
                    : "Frontend Script Error"
    }

    getUpdateHistory(req, res) {
        fs.readFile("./updated-app.log", {encoding: "utf8"})
            .then((data) => res.status(200).send(data))
            .catch((error) => {
                console.log("[ERROR](getUpdateHistory)", error.message)
                res.status(500).send("Something went wrong. please check server log.")
            })
    }

    showGitLog(req, res) {
        const {name} = req.body
        const app = appList.find(it => it.name === name)
        if(!app) {
            return res.status(404).send({message: "App Name is not registered."})
        }

        if(!app.project_dir) {
            return res.status(409).send({message: "`project_dir` is not set."})
        }

        this.runGitLog(app, res)
    }

    runGitLog(app, res) {
        const option = {
            cwd: app.project_dir
        }
        const sh = spawn("git", ["--no-pager","log","--decorate=short","-n10"], option);
        readline.createInterface({
            input: sh.stdout,
            terminal: false
        }).on("line", function(line) {
            SocketIoHelper.io.to(app.name).emit("git-log", {status: "PROGRESS", message: line})
        })

        sh.stderr.on("data", (error) => {
            console.error(`[SH][GITLOG][ERROR]: ${error.toString().trim()}`);
            SocketIoHelper.io.to(app.name).emit("git-log", {status: "PROGRESS", message: error.toString().trim()})
        })

        sh.on("close", (code) => {
            console.log(`[SH][GITLOG][FINISH] ChildProcessStatusCode: ${code}`);
            const statusSocket = code ? "ERROR" : "FINISH"
            const httpStatus = code ? 500 : 200
            const response = {
                code,
            }

            SocketIoHelper.io.to(app.name).emit("git-log", {status: statusSocket, message: `child process exited with code ${code}`})
            res.status(httpStatus).send(response)
        })
    }
}

module.exports = AppService