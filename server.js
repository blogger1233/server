const express = require("express")
const cors = require("cors")
const app = express()

app.use(cors())
app.use(express.json())


//importing userRegistration.js
const user = require("./authentication/userRegistration")
app.use("/user",user)


//importing login.js
const login = require("./authentication/login");
app.use("/login",login)



//importing resource route resources.json
const resource = require("./routes/resources")
app.use("/resource",resource)

app.listen(8000,function(){
    console.log("http://localhost:8000")
})
