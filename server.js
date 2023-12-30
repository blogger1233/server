const express = require("express")
const cors = require("cors")
const fs = require("fs")
const app = express();
app.use(cors())
var port = process.env.PORT || 8000;
app.get("/navbar",(req,res)=>{

    fs.readFile("info.json",function(error,data){
        if(error){
            res.json({error:error})
        }
        else{
            var data = JSON.parse(data.toString());
            res.json({data:data})
        }
    })
})
app.get("/user/:username",(req,res)=>{
    const id = req.params.username;
    fs.readFile("info.json",(error,data)=>{
        if(error){
            res.json({error:error})
        }
        else{
            var data = JSON.parse(data.toString());
            var userData = data.filter((value)=>{
                return value.id == id
            })
            res.json({
                data:userData
            })
        }
    })
})
app.listen(port,()=>{
    console.log(`http://localhost:${port}`)
})