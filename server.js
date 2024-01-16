const express = require("express")
const cors = require("cors")
const app = express()
app.use(cors({origin:"http://localhost:5173"}))
app.use(express.json())


//importing userRegistration.js
const user = require("./authentication/userRegistration")
app.use("/user",user)




app.listen(8000,function(){
    console.log("http://localhost:8000")
})
