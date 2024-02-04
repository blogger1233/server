const express = require("express")
const router = express.Router();
//importing database module
const conn = require("../database/connect")
//importing jwt token
const fs = require("fs")
const jwt = require("jsonwebtoken")
const path = require("path");
const sendMail = require("./sendmail");

const validateReg = (obj) => {
    const {  email, password, confirmPassword } = obj;

    // Check if email is provided and matches a basic email pattern
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return "Invalid email address";
    }

    // Check if password is provided and has at least 10 characters
    if (!password) {
        return "Invalid password";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match";
  }
    if(password.length<10){
      return "Password must be at least 10 characters"
    }

    return null;
};

router.post("/registration", async function (req, res) {
    const { email, password, confirmPassword } = req.body;
    const validationError = validateReg(req.body)
    if (validationError) {
        res.status(400).json({ message: validationError });
        return;
    }
    else {
        const { client, database } = await conn("streaming_application");
        if(!client){
            res.status(400).json({message:"database not connected"})
            return;
        }
        try {
            const collection = database.collection("userinfo")
            const result2 = await collection.find({ email: req.body.email }).toArray();
          if (result2.length > 0) {
                res.status(400).json({ message: "email is already registered" })
                return;
            }
            const code=Math.floor(Math.random()*1000000)
            const mail = await sendMail(req.body.email, code)
            if (mail.messageId) {
                const response = await collection.insertOne({
                    email: req.body.email,
                    password: req.body.password,
                    verified: false,
                    code:code,
                    timer:Date.now()
                })
                if (response.acknowledged) {
                    res.status(200).json({ response ,email:email})
                    return;
                }
                else {
                    res.status(500).json({ response })
                    return;
                }
            }
            else {
                res.status(200).json({ message: "error while sending mail" })
            }

        }
        catch (error) {
            res.status(400).json({ message: error })
        }
        finally {
           await  client.close();
        }

    }
})

router.get("/ver/:email/:code", async function (req, res) {
    const email = req.params.email;
    var code = req.params.code;
    console.log(req.params);
    const { client, database } = await conn("streaming_application");
    if (!client) {
      res.status(400).json({ message: "database not connected" });
      return;
    }
    try {
      const collection = database.collection("userinfo");
      const response = await collection.findOne({ email: email }, { verified: 1, timer: 1 ,code,email});

      if (!response) {
        res.status(400).json({ message: "email is not found" });
        return;
      }

      if (response.verified) {
        res.status(200).json({ message: "user is already verified" });
        return;
      }

      const data = await collection.findOne({ email: email },{code});

      if (data.code==code) {
        if (!(data.timer + 300000 < Date.now())) {
          const updateResponse = await collection.updateOne(
            { email: email },
            {
              $set: { verified: true },
              $unset: { code: 1 ,timer:1}
            }
          );

          if (updateResponse.acknowledged) {
            res.json({ message: "user is verified" });
            return;
          } else {
            res.json({ message: "retry again" });
            return;
          }
        } else {
          res.status(400).json({ message: "code expired" });
          return;
        }
      } else {
        res.status(400).json({ message: "invalid code" });
        return;
      }
    } catch (error) {
      res.status(400).json({ message: error.message || "Internal Server Error" });
      return;
    } finally {
      await client.close();
    }
  });

router.get("/vresend/:email", async function (req, res) {
    const { client, database } = await conn("streaming_application");
    try {
      if (!client) {
        res.status(400).json({ message: "Database not connected" });
        return;
      }

      const collection = database.collection("userinfo");

      const data = await collection.findOne(
        { email: req.params.email },
        { verified: 1, timer: 1, code: 1, email: 1 }
      );

      if (data) {
        if (data.email) {
          if (data.verified) {
            res.status(200).json({ message: "Email is already verified" });
            return;
          } else {
            if (data.code) {
              if (data.timer) {
                if(Date.now-data.timer>240000){
                  res.json({message:"code expired (2min)"})
                  return;
                }
                if (Date.now() - data.timer > 120000) {
                  const updatedCode = Math.floor(Math.random() * 1000000);
                  const response2 = await collection.updateOne(
                    { email: req.params.email },
                    { $set: { timer: Date.now(), code: updatedCode } }

                  );
                    if(response2.acknowledged){
                      const mail = await sendMail(data.email,updatedCode)
                      res.json({message:mail})
                    }

                } else {
                  res.json({ message: "wait " + (120000-(Date.now() - data.timer)) });
                }

              }
            }
          }
        } else {
          res.status(400).json({ message: "Email not found" });
          return;
        }
      } else {
        res.status(400).json({ message: "Data not found" });
        return;
      }
    } catch (error) {
      res
        .status(400)
        .json({ message: error.message || "Internal Server Error" });
      return;
    } finally {
      client.close();
    }
  });






module.exports = router;

