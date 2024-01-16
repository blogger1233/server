const express = require("express")
const sendMail = require("./sendmail")
const router = express.Router();
//importing database module
const conn = require("../database/connect")


const validateReg = (obj) => {
    const { username, email, password, confirmPassword } = obj;

    // Check if email is provided and matches a basic email pattern
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return "Invalid email address";
    }

    // Check if username is provided and meets certain criteria (e.g., at least 3 characters)
    if (!username || username.length < 3) {
        return "Invalid username";
    }

    // Check if password is provided and has at least 10 characters
    if (!password || password.length < 10) {
        return "Password must be at least 10 characters";
    }

    // Check if confirmPassword matches the password
    if (password !== confirmPassword) {
        return "Passwords do not match";
    }

    // If all validations pass, return null (indicating success)
    return null;
};

router.post("/registration", async function (req, res) {
    const { email, username, password, confirmPassword } = req.body;
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
            const result = await collection.find({ username: req.body.username }).toArray();
            const result2 = await collection.find({ email: req.body.email }).toArray();
            if (result.length > 0) {
                res.status(400).json({ message: "username is already registered" })
                return;
            }
            if (result2.length > 0) {
                res.status(400).json({ message: "email is already registered" })
                return;
            }
            const mail = await sendMail(req.body.email, 1242)
            if (mail.messageId) {
                const response = await collection.insertOne({
                    email: req.body.email,
                    username: req.body.username,
                    password: req.body.password,
                    verified: false,
                    code:Math.floor(Math.random()*1000000),
                    timer:Date.now()
                })
                if (response.acknowledged) {
                    res.status(200).json({ response })
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

router.get("/ver/:email/:code",async function(req,res){
    const email = req.params.email;
    const code = req.params.code;
    console.log(req.params)
    const { client, database } = await conn("streaming_application");
    if(!client){
        res.status(400).json({message:"database not connected"})
        return;
    }
    try{
        const collection = database.collection("userinfo");
        const response = await collection.findOne({email:email},{verified:1,timer:1});
        if(response.verified){
            res.status(200).json({message:"user is already verfied"});
            return;
        }
        const data = await collection.findOne({email:email},{code,email});
        if(code==data.code&&email==data.email){
           if(!data.timer+300000<Date.now()) {const response = await collection.updateOne(
                { email: email },
                {
                  $set: { verified: true },
                  $unset: { code: 1 }
                }
              );
            if(response.acknowledged){
                res.json({message:"user is verfied"})
                return
            }
            else{
                res.json({message:"retry again"})
                return;
            }}
            else{
                res.status(400).json({message:"code is expired"})
            }
        }
        else{
            res.status(400).json({message: "invalid code"});
            return;

        }
    }
    catch(error){
        res.json(400).json({message:error})
        return;
    }
    finally{
        await client.close();
    }
})
router.get("/vresend/:email", async function(req, res) {
    const { client, database } = await conn("streaming_application");
    try {
        if (!client) {
            res.status(400).json({ message: "Database not connected" });
            return;
        }

        const collection = database.collection("userinfo");
        const response = await collection.insertOne({email:req.params.email})
        const data = await collection.findOne({ email: req.params.email }, { verified: 1, timer: 1, code: 1, email: 1 });

        if (data) {
            if (data.verified) {
                res.status(200).json({ message: "Email is already verified" });

            } else {
                if (data.code) {
                    if (data.timer) {
                        if (data.timer + 120000 < Date.now()) {
                            if(data.timer+300000<Date.now()){const email_response = await sendMail(data.email, data.code);
                            const set_timer = await collection.updateOne({ email: req.params.email }, { $set: { timer: Date.now() } });

                            res.json(email_response);}
                            else{
                                res.status(400).json({message:"code expired resend code"})
                            }
                        } else {
                            res.status(200).json({ message: `Wait ${(data.timer + 120000 - Date.now()) / 1000} seconds` });
                            return;
                        }
                    } else {
                        const email_response = await sendMail(data.email, data.code);
                        const set_timer = await collection.updateOne({ email: req.params.email }, { $set: { timer: Date.now() } });
                        res.json(email_response);
                        return;
                    }
                } else {
                    res.status(200).json({ message: "Code not found" });
                }
            }
        } else {
            res.status(400).json({ message: "Email not found" });
            return;
        }
    } catch (error) {
        res.status(400).json({ message: error.message || "Internal Server Error" });
        return;
    } finally {
        client.close();
    }
});


module.exports = router;

