const express = require("express")
const jwt = require("jsonwebtoken")
const fs = require("fs");
const path = require("path");
const conn = require("../database/connect");

const router = express.Router();
async function resource(req,res,next){
  try{

    if(req.params.email){
        if(req.headers.authorization){
            const token = req.headers.authorization.split(" ")[1]
            if(token){
                const {client,database}= await conn("streaming_application")
                const collection = database.collection("tokens");
                const result = await collection.findOne({email:req.params.email,token:token})
                if(result){
                    const filePath = path.resolve(__dirname,"../database/private_key.pem")
                    fs.readFile(filePath,'utf-8',function(error,data){
                        if(error){
                            res.status(500).json(error)
                        }
                        else{
                            jwt.verify(token, data, { algorithms: "RS256" }, async function (error, payload) {
                                if (error) {
                                  if (error.name === "TokenExpiredError") {
                                    const collection_1 = database.collection("tokens");
                                    const response = await collection_1.deleteOne({ token: token, email: req.params.email });

                                    if (response.acknowledged) {
                                      res.status(401).json({ message: "token expired" });
                                      return;
                                    }
                                    else{
                                        res.status(500).json({message:response.error})
                                    }
                                  } else {
                                    res.status(401).json({ user: "unauth", error: error });
                                  }
                                } else {
                                  if(req.params.email===payload.email){
                                    next();
                                  }
                                }
                              });
                        }
                    })
                }
                else{
                    res.status(401).json({message:"unauthorized token not found"})
                    return;
                }
            }
            else{
                res.status(401).json("unauthorized")
                return;
            }
       }
       else{
        res.status(401).json("invalid authorization")
        return;
       }
    }
    else{
        res.status(404).json({message:"unauth"})
    }
  }
  catch(error){
    res.json(error)
  }
}
router.get("/:email",resource,async function(req,res){
    try{
        const {client,database}= await conn("streaming_application");
        const collection = database.collection("videos");
        const data = await collection.find().toArray();
        res.json(data)
    }
    catch(error){
        res.json(500).status(error)
    }
})


const { v4: uuid } = require("uuid");

router.post("/:email", resource, async function (req, res) {


});

module.exports = router;
