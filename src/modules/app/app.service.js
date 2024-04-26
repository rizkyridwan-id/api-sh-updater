const { spawn } = require("child_process");
const readline = require('readline')
const appList = require('../../../app.json')
const SocketIoHelper = require("../../helper/socket-io.helper");
const path = require("path");
const fs = require("fs");
const { DateFormatValueObject } = require("./value-object/date-format.value-object");

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
        console.log(`[SH][UPDATE][INFO] ${app.name} is updating.`)
        if(branchBe && branchFe) {
            console.log("[SH][UPDATE][INFO] BranchBe:", branchBe)
            console.log("[SH][UPDATE][INFO] BranchFe:", branchFe)
        }
        const sh = spawn("sh", [app.sh_path, branchBe, branchFe]);
        this.updateQueue.push(app.name)

        readline.createInterface({
            input     : sh.stdout,
            terminal  : false
          }).on('line', function(line) {
            SocketIoHelper.io.to(app.name).emit("update-progress",{status: "PROGRESS", message: line})
          });

        let errorSh = ""
        sh.stderr.on("data", (error) => {
            errorSh = error.toString()
            console.error(`[SH][UPDATE][ERROR]: ${error}`);
            SocketIoHelper.io.to(app.name).emit("update-progress",{status: "ERROR", message: error})
        });

        sh.on("close", (code) => {
            const queueIndex = this.updateQueue.findIndex(it => it === app.name)
            this.updateQueue.splice(queueIndex, 1)

            console.log(`[SH][UPDATE][FINISH] ChildProcessStatusCode: ${code}`);
            console.log("[SH][UPDATE][FINISH] CleanedQueue:", app.name)
            
            // Write file
            const dateFormated = new Date().toISOString().slice(0, -5).replace("T", " ")
            const reasonError = code !== 0 ? `(${errorSh || this._generateMessageResponse(code)})` : ""
            const branchInfo = branchBe && branchFe ? `(HEAD ${branchBe}::${branchFe})` : ""
            const logMsg = `[${dateFormated}] Name: ${app.name} | (code: ${code}) ${reasonError || branchInfo} \n`
            fs.promises.writeFile(path.resolve(this._getLogFilePath()), logMsg, {flag: "a"})
                .then(() => console.log("[SH][UPDATE][FINISH] Activity added to log history."))
                .catch(e => console.log("[SH][UPDATE][ERROR]", e))

            // Send Finish Socket
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
            : code === 2
                ? "Backend Script Error" 
                : code === 3
                    ? "Frontend Script Error" 
                    : "Internal Script Error"
    }

    getUpdateHistory(req, res) {
        const {date} = req.query

        const dateFormat = date && new DateFormatValueObject(date)
        const filePath = this._getLogFilePath(dateFormat)

        if(!fs.statSync(filePath, {throwIfNoEntry: false})) {
            return res.status(404).send({message: "Log file is not registered."})
        }

        fs.promises.readFile(filePath, {encoding: "utf8"})
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

    _getLogFilePath(dateFormat) {
        const isLogsExists = fs.statSync("./logs", {throwIfNoEntry: false})
        if(!isLogsExists) {
            fs.mkdirSync("./logs")
        }

        let date = new Date().toISOString().split("T")[0]
        if(dateFormat && (dateFormat instanceof DateFormatValueObject)) {
            date = dateFormat.value
        }

        return path.join("./logs", date+"-updated-log.log")
    }
}

module.exports = AppService