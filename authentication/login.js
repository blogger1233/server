const express = require("express")
const sendMail = require("./sendmail")
const router = express.Router();
//importing database module
const conn = require("../database/connect")
//importing jwt token
const fs = require("fs")
const jwt = require("jsonwebtoken")
const path = require("path")



router.post("/",async function(req,res){
    const { client, database } = await conn("streaming_application");
    if(!client){
        res.json(400).json({message:"database is not connected try again"})
    }
    const email = req.body.email;
    const password = req.body.password

    if(email&&password){

            try{
                const collection = database.collection("userinfo");
                if(email){
                    if ( !/^\S+@\S+\.\S+$/.test(email)) {
                        res.status(400).json({message:"invalid email"})
                        return;
                    }
                    const data = await collection.findOne({email:email},{ projection: { email: 1, password: 1,verified:1 }});
                    if(data){
                        if(!data.verified){
                          res.json({message:"user is not verfied"})
                          return;
                        }
                        if(data.email==email&&data.password==password){
                          const filepath = path.resolve(__dirname,"../database/private_key.pem")

                           fs.readFile(filepath,'utf-8',function(error,data){
                              if(error){
                                if(error.code=="ENOENT"){
                                  res.status(404).json(error)
                                  return;
                                }
                                else{
                                  res.status(500).json(error)
                                  return;
                                }
                              }
                              else{
                                const payload = {
                                  email: email,
                                };

                                const options = {
                                  expiresIn: '20h',
                                  algorithm:'RS256'
                                };

                                jwt.sign(payload, data, options, async function (error, token) {
                                  if (error) {
                                    res.status(500).json({ error: error.message });
                                    return;
                                  } else {
                                    const { client, database } =await conn("streaming_application");
                                      const collection = database.collection("tokens");

                                      try {
                                        const response = await collection.findOne({ email: email }, { projection: { email: 1 } });

                                        if (response) {
                                          await collection.updateOne({ email: email }, { $set: { token: token } });
                                          res.status(200).json({token:token,email:email})
                                          return;
                                        } else {
                                          await collection.insertOne({ email: email, token: token });
                                          res.status(200).json({ token: token, email: email });
                                        }


                                      } catch (error) {
                                        console.error("Error processing request:", error);
                                        res.status(500).json({ error: "Internal server error" });
                                      }


                                  }
                                });

                              }
                           })

                        }
                        else{
                         res.status(400).json({message:"incorrect password"})
                        }

                    }
                    else{
                      res.status(400).json({message:"email is not registered"})
                      return;
                    }
                }
            }
            catch(error){
                res.status(200).json({message:error})
            }
            finally{
                 client.close();
            }
    }
    else{
        res.status(400).json({message:"invalid password username and email"})
        return;
    }

  })

module.exports = router;